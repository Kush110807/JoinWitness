"""JW-T03: strictly reviewed candidate universe; no AI admission or solver results.

A snapshot is an integrity-bound record of review assertions, not a signature or
proof that reviewer permissions or real-world candidate coverage are truthful.
"""

from collections import defaultdict
from enum import StrEnum
from typing import Literal

from pydantic import Field, StrictBool, StrictStr

from .canonical import canonical_json_bytes, parsed_records_sha256, sha256_hex
from .contracts import FrozenSchema, InputBundle, SourceDigest

POLICY_VERSION = "jw.review.v1"


class PolicyCode(StrEnum):
    INVALID_POLICY = "POLICY_INCONSISTENT"
    UNKNOWN_ID = "UNKNOWN_ID"
    DUPLICATE_REVIEW = "DUPLICATE_REVIEW"
    MISSING_UNMATCHED = "MISSING_UNMATCHED_POLICY"
    INFEASIBLE = "POLICY_INFEASIBLE"
    SNAPSHOT_INVALID = "SNAPSHOT_INVALID"
    SNAPSHOT_STALE = "SNAPSHOT_STALE"


class PolicyError(ValueError):
    def __init__(self, code: PolicyCode):
        self.code = code
        super().__init__(code.value)


class ReviewedEdge(FrozenSchema):
    attendance_id: StrictStr = Field(min_length=1, max_length=128)
    registration_id: StrictStr = Field(min_length=1, max_length=128)
    status: Literal["CONFIRMED", "POSSIBLE", "PROHIBITED"]
    operation: Literal["EXPLICIT_REVIEW"] = "EXPLICIT_REVIEW"
    evidence_reference: StrictStr | None = Field(default=None, max_length=256)


class UnmatchedRule(FrozenSchema):
    attendance_id: StrictStr = Field(min_length=1, max_length=128)
    status: Literal["ALLOWED", "REQUIRED", "FORBIDDEN"]
    operation: Literal["EXPLICIT_REVIEW"] = "EXPLICIT_REVIEW"


class ReviewDraft(FrozenSchema):
    schema_version: Literal["jw.review.v1"] = POLICY_VERSION
    revision: int = Field(ge=1, strict=True)
    edges: tuple[ReviewedEdge, ...]
    unmatched: tuple[UnmatchedRule, ...]
    coverage: Literal["UNREVIEWED", "REVIEWED_PARTIAL", "REVIEWED_CLOSED_SCOPE"]
    scope_note: StrictStr = Field(min_length=12, max_length=1000)
    closed_scope_attested: StrictBool = False


class ReviewSnapshot(ReviewDraft):
    registrations_digest: SourceDigest
    attendance_digest: SourceDigest
    snapshot_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")


def _verify_bundle(bundle: InputBundle) -> None:
    """Detect forged/mismatched in-memory parsed records before policy evaluation.

    Raw-byte SHA cannot be recomputed without original bytes, so callers needing
    byte freshness must re-ingest original files and compare both SourceDigest values.
    """
    for kind, items, digest, limit in (
        ("registrations", bundle.registrations, bundle.registrations_digest, 150),
        ("attendance", bundle.attendance, bundle.attendance_digest, 100),
    ):
        if (digest.source_kind != kind or len(items) != digest.row_count or
                not (1 <= len(items) <= limit) or
                parsed_records_sha256(kind, items) != digest.parsed_sha256):
            raise PolicyError(PolicyCode.SNAPSHOT_INVALID)
    if len({r.registration_id for r in bundle.registrations}) != len(bundle.registrations):
        raise PolicyError(PolicyCode.SNAPSHOT_INVALID)
    if len({a.attendance_id for a in bundle.attendance}) != len(bundle.attendance):
        raise PolicyError(PolicyCode.SNAPSHOT_INVALID)


def _index_and_check(bundle: InputBundle, draft: ReviewDraft) -> tuple[dict[str, tuple[ReviewedEdge, ...]], dict[str, str]]:
    """Check explicit review authorization and global baseline feasibility.

    Feasibility check uses deterministic bipartite augmenting paths, *not* the
    T04 independent exhaustive oracle or future T05 optimization.
    """
    reg_ids = {row.registration_id for row in bundle.registrations}
    att_ids = {row.attendance_id for row in bundle.attendance}
    if draft.coverage == "REVIEWED_CLOSED_SCOPE":
        if not draft.closed_scope_attested:
            raise PolicyError(PolicyCode.INVALID_POLICY)
    elif draft.closed_scope_attested:
        raise PolicyError(PolicyCode.INVALID_POLICY)
    if draft.coverage == "UNREVIEWED" and any(edge.status != "PROHIBITED" for edge in draft.edges):
        raise PolicyError(PolicyCode.INVALID_POLICY)

    by_att: dict[str, list[ReviewedEdge]] = defaultdict(list)
    seen_edges: set[tuple[str, str]] = set()
    for edge in draft.edges:
        if edge.attendance_id not in att_ids or edge.registration_id not in reg_ids:
            raise PolicyError(PolicyCode.UNKNOWN_ID)
        pair = edge.attendance_id, edge.registration_id
        if pair in seen_edges:
            raise PolicyError(PolicyCode.DUPLICATE_REVIEW)
        seen_edges.add(pair)
        by_att[edge.attendance_id].append(edge)
    if len(draft.edges) > 10 * len(att_ids) or any(len(edges) > 10 for edges in by_att.values()):
        raise PolicyError(PolicyCode.INVALID_POLICY)

    unmatched: dict[str, str] = {}
    for rule in draft.unmatched:
        if rule.attendance_id not in att_ids:
            raise PolicyError(PolicyCode.UNKNOWN_ID)
        if rule.attendance_id in unmatched:
            raise PolicyError(PolicyCode.DUPLICATE_REVIEW)
        unmatched[rule.attendance_id] = rule.status
    if set(unmatched) != att_ids:
        raise PolicyError(PolicyCode.MISSING_UNMATCHED)

    used_confirmed: set[str] = set()
    needed: list[str] = []
    for att_id in sorted(att_ids):
        edges = by_att[att_id]
        confirmed = [edge.registration_id for edge in edges if edge.status == "CONFIRMED"]
        possible = [edge.registration_id for edge in edges if edge.status == "POSSIBLE"]
        choice = unmatched[att_id]
        if len(confirmed) > 1:
            raise PolicyError(PolicyCode.INVALID_POLICY)
        if confirmed:
            # Explicitly confirmed row has one and only one eligible assignment.
            if possible or choice != "FORBIDDEN":
                raise PolicyError(PolicyCode.INVALID_POLICY)
            if confirmed[0] in used_confirmed:
                raise PolicyError(PolicyCode.INFEASIBLE)
            used_confirmed.add(confirmed[0])
        elif choice == "REQUIRED":
            if possible:
                raise PolicyError(PolicyCode.INVALID_POLICY)
        elif choice == "FORBIDDEN":
            if not possible:
                raise PolicyError(PolicyCode.INFEASIBLE)
            needed.append(att_id)
        # choice ALLOWED has a legal unmatched option even with zero candidate edges.

    # Global one-to-one feasibility: each forced-matched row needs a distinct
    # remaining registration, accounting for already claimed CONFIRMED rows.
    graph = {
        att_id: sorted(
            e.registration_id for e in by_att[att_id]
            if e.status == "POSSIBLE" and e.registration_id not in used_confirmed
        )
        for att_id in needed
    }
    owner: dict[str, str] = {}

    def place(att_id: str, seen: set[str]) -> bool:
        for reg_id in graph[att_id]:
            if reg_id in seen:
                continue
            seen.add(reg_id)
            if reg_id not in owner or place(owner[reg_id], seen):
                owner[reg_id] = att_id
                return True
        return False

    for att_id in needed:
        if not place(att_id, set()):
            raise PolicyError(PolicyCode.INFEASIBLE)
    return {key: tuple(value) for key, value in by_att.items()}, unmatched


def snapshot_hash(snapshot: ReviewSnapshot) -> str:
    return sha256_hex(canonical_json_bytes(snapshot.model_dump(mode="json", exclude={"snapshot_sha256"})))


def freeze_review(bundle: InputBundle, draft: ReviewDraft) -> ReviewSnapshot:
    _verify_bundle(bundle)
    _index_and_check(bundle, draft)
    # Normalize order of *review metadata*, never the T02 input record order.
    data = draft.model_dump(mode="python")
    data["edges"] = tuple(sorted(draft.edges, key=lambda item: (item.attendance_id, item.registration_id)))
    data["unmatched"] = tuple(sorted(draft.unmatched, key=lambda item: item.attendance_id))
    data["registrations_digest"] = bundle.registrations_digest
    data["attendance_digest"] = bundle.attendance_digest
    data["snapshot_sha256"] = "0" * 64
    prelim = ReviewSnapshot.model_validate(data)
    return prelim.model_copy(update={"snapshot_sha256": snapshot_hash(prelim)})


def validate_snapshot(bundle: InputBundle, snapshot: ReviewSnapshot, *, expected_revision: int | None = None,
                      expected_sha256: str | None = None) -> None:
    _verify_bundle(bundle)
    if (snapshot.registrations_digest != bundle.registrations_digest or
            snapshot.attendance_digest != bundle.attendance_digest or
            (expected_revision is not None and expected_revision != snapshot.revision) or
            (expected_sha256 is not None and expected_sha256 != snapshot.snapshot_sha256)):
        raise PolicyError(PolicyCode.SNAPSHOT_STALE)
    if snapshot_hash(snapshot) != snapshot.snapshot_sha256:
        raise PolicyError(PolicyCode.SNAPSHOT_INVALID)
    _index_and_check(bundle, snapshot)
    if tuple(sorted(snapshot.edges, key=lambda e: (e.attendance_id, e.registration_id))) != snapshot.edges:
        raise PolicyError(PolicyCode.SNAPSHOT_INVALID)
    if tuple(sorted(snapshot.unmatched, key=lambda r: r.attendance_id)) != snapshot.unmatched:
        raise PolicyError(PolicyCode.SNAPSHOT_INVALID)


def allowed_choices(bundle: InputBundle, snapshot: ReviewSnapshot) -> dict[str, tuple[str | None, ...]]:
    """Compute exact row choice sets for subsequent baseline and oracle; fail closed.

    Snapshot authority and source integrity are validated on every call.
    """
    validate_snapshot(bundle, snapshot)
    by_att: dict[str, list[ReviewedEdge]] = defaultdict(list)
    for edge in snapshot.edges:
        by_att[edge.attendance_id].append(edge)
    rules = {item.attendance_id: item.status for item in snapshot.unmatched}
    choices: dict[str, tuple[str | None, ...]] = {}
    for att_id in sorted(rules):
        confirmed = [e.registration_id for e in by_att[att_id] if e.status == "CONFIRMED"]
        if confirmed:
            choices[att_id] = (confirmed[0],)
        elif rules[att_id] == "REQUIRED":
            choices[att_id] = (None,)
        else:
            possible = sorted(e.registration_id for e in by_att[att_id] if e.status == "POSSIBLE")
            choices[att_id] = tuple(possible + ([None] if rules[att_id] == "ALLOWED" else []))
    return choices
