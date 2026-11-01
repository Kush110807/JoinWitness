"""In-memory isolated commerce sessions with revision CAS and TTL.

Sessions are server-held, randomly identified, short-lived and never
persisted. Every mutation compares source/candidate/policy revisions under the
session lock; any mismatch fails STALE_STATE without committing anything.
"""
from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from .candidates import Candidate
from .errors import SESSION_ABSOLUTE_SECONDS, SESSION_IDLE_SECONDS, CommerceError
from .source_import import SourceBundle

STATE_IMPORTED = "IMPORTED"
STATE_REVIEW_FROZEN = "REVIEW_FROZEN"
STATE_CHALLENGED = "CHALLENGED"


@dataclass
class PolicySnapshot:
    policy_payload: dict[str, Any]
    policy_sha256: str
    catalog: list[Candidate]
    catalog_sha256: str
    reference_mapping: dict[str, str | None]
    baseline_sha256: str
    review_sha256: str
    threshold_k: int
    reviewer_label: str
    attestation: dict[str, bool]
    manual: list[dict[str, Any]]
    rows: list[dict[str, Any]]
    options: dict[str, tuple[str | None, ...]]
    row_keys: list[str]
    raw_worlds: int
    admissible_worlds: int
    invalid_worlds: int
    variable_records: int


@dataclass
class RunRecord:
    run_id: str
    envelope: dict[str, Any]
    result: dict[str, Any]
    baseline_mapping: dict[str, str | None]
    baseline_count: int
    witness_mapping: dict[str, str | None] | None
    witness_count: int | None
    coverage: dict[str, Any]
    timings_ms: dict[str, int | None]
    policy_revision: int
    candidate_revision: int
    source_revision: int
    review_sha256: str


@dataclass
class Session:
    session_id: str
    bundle: SourceBundle
    source_candidates: list[Candidate]
    parse_ms: int
    created_mono: float
    last_mono: float
    candidate_revision: int = 1
    policy_revision: int = 0
    source_revision: int = 1
    state: str = STATE_IMPORTED
    meta_entries: list[Candidate] = field(default_factory=list)
    manual_entries: list[Candidate] = field(default_factory=list)
    policy: PolicySnapshot | None = None
    run: RunRecord | None = None
    lock: threading.RLock = field(default_factory=threading.RLock, compare=False)

    def active_catalog(self) -> list[Candidate]:
        return list(self.source_candidates) + list(self.meta_entries) + list(self.manual_entries)


class Store:
    """Thread-safe session registry with TTL expiry."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._sessions: dict[str, Session] = {}
        self._lock = threading.Lock()
        self._clock = clock

    def create(self, bundle: SourceBundle, source_candidates: list[Candidate], parse_ms: int) -> Session:
        session_id = secrets.token_hex(16)
        now = self._clock()
        session = Session(
            session_id=session_id,
            bundle=bundle,
            source_candidates=source_candidates,
            parse_ms=parse_ms,
            created_mono=now,
            last_mono=now,
        )
        with self._lock:
            self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Session:
        with self._lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise CommerceError(
                "SESSION_EXPIRED",
                "Session is expired or unknown; import again.",
                "session_id",
                {},
                409,
            )
        now = self._clock()
        with session.lock:
            if (
                now - session.last_mono > SESSION_IDLE_SECONDS
                or now - session.created_mono > SESSION_ABSOLUTE_SECONDS
            ):
                with self._lock:
                    self._sessions.pop(session_id, None)
                raise CommerceError(
                    "SESSION_EXPIRED",
                    "Session is expired or unknown; import again.",
                    "session_id",
                    {},
                    409,
                )
            session.last_mono = now
        return session


GLOBAL_STORE = Store()


def check_revisions(
    session: Session,
    expected_source: int,
    expected_candidate: int,
    expected_policy: int,
) -> None:
    if expected_source != session.source_revision:
        raise CommerceError(
            "STALE_STATE",
            "Source revision no longer matches.",
            "expected_source_revision",
            {"expected": session.source_revision, "received": expected_source},
            409,
        )
    if expected_candidate != session.candidate_revision:
        raise CommerceError(
            "STALE_STATE",
            "Candidate revision no longer matches registered suggestions.",
            "expected_candidate_revision",
            {"expected": session.candidate_revision, "received": expected_candidate},
            409,
        )
    if expected_policy != session.policy_revision:
        raise CommerceError(
            "STALE_STATE",
            "Policy revision no longer matches the frozen review.",
            "expected_policy_revision",
            {"expected": session.policy_revision, "received": expected_policy},
            409,
        )
