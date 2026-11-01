"""Commerce operation orchestration: the six frozen v1 operations.

Each operation takes an already-parsed JSON value, validates strictly and
either returns the response body or raises CommerceError. Session mutations
happen under the session lock with compare-and-swap revision checks; any
failure commits nothing.
"""
from __future__ import annotations

import json
import secrets
import time
from typing import Any, Callable

from . import COMMERC_VERSION, ENGINE_IDENTITY, PREDICATE, canonical
from . import candidates as cand
from . import independent_checker as checker
from . import meta_suggestions as meta
from . import receipts, review, wire, worlds
from .errors import (
    MAX_PARSE_RESPONSE_BYTES,
    MAX_RAW_WORLDS,
    MAX_SOURCE_ROWS_VIEW,
    MAX_VIEW_BYTES,
    DEFAULT_TIME_BUDGET_MS,
    MAX_TIME_BUDGET_MS,
    MIN_TIME_BUDGET_MS,
    CommerceError,
)
from .session_state import (
    GLOBAL_STORE,
    STATE_CHALLENGED,
    RunRecord,
    Session,
    Store,
    check_revisions,
)
from .source_import import import_sources, validated_source_rows

PARSE_KEYS = frozenset({"contract_version", "files"})
SUGGEST_KEYS = frozenset(
    {
        "contract_version",
        "session_id",
        "expected_source_revision",
        "expected_candidate_revision",
        "mode",
        "max_suggestions",
        "expected_policy_revision",
    }
)
CHALLENGE_KEYS = frozenset(
    {
        "contract_version",
        "session_id",
        "expected_source_revision",
        "expected_candidate_revision",
        "expected_policy_revision",
        "expected_review_sha256",
        "time_budget_ms",
    }
)
RECEIPT_KEYS = frozenset(
    {"contract_version", "session_id", "run_id", "expected_review_sha256"}
)

LIMITS = {
    "orders": 50,
    "each_other_file": 60,
    "variables": 10,
    "alternatives_per_variable": 2,
    "raw_worlds": 4096,
}

PROOF_EXHAUSTIVE = "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION"


def _session_request(
    store: Store, request: Any, allowed: frozenset[str]
) -> tuple[Session, dict[str, Any]]:
    if not isinstance(request, dict):
        raise wire.invalid_value("Request must be a JSON object.", "")
    wire.reject_unknown(request, allowed, "")
    wire.require_version(request)
    session_id = request.get("session_id")
    if not wire.require_hex_token(session_id, 32):
        raise wire.invalid_value("Session identifier is malformed.", "session_id")
    assert wire.is_str(session_id)
    session = store.get(session_id)
    for key in (
        "expected_source_revision",
        "expected_candidate_revision",
        "expected_policy_revision",
    ):
        if not wire.is_int(request.get(key)):
            raise wire.invalid_value(f"Field {key} must be an integer.", key)
    return session, request


def _check_revisions_locked(session: Session, req: dict[str, Any]) -> None:
    check_revisions(
        session,
        req["expected_source_revision"],
        req["expected_candidate_revision"],
        req["expected_policy_revision"],
    )


def op_parse(
    request: Any,
    store: Store = GLOBAL_STORE,
    clock: Callable[[], float] = time.monotonic,
) -> dict[str, Any]:
    if not isinstance(request, dict):
        raise wire.invalid_value("Request must be a JSON object.", "")
    wire.reject_unknown(request, PARSE_KEYS, "")
    wire.require_version(request)
    if "files" not in request:
        raise CommerceError(
            "MISSING_FILE",
            "Exactly four named CSV files are required.",
            "files.orders.csv",
            {"required_files": ["orders.csv", "payments.csv", "deliveries.csv", "refunds.csv"]},
            400,
        )
    start = clock()
    bundle = import_sources(request.get("files"))
    parse_ms = int((clock() - start) * 1000)
    source_candidates = cand.build_source_candidates(bundle)
    session = store.create(bundle, source_candidates, parse_ms)
    view = validated_source_rows(bundle)
    total_rows = sum(len(rows) for rows in view.values())
    if total_rows > MAX_SOURCE_ROWS_VIEW:
        raise CommerceError("LIMIT_EXCEEDED", "Source read view exceeds its row bound.", "files", {}, 413)
    if len(canonical.cjson_bytes(view)) > MAX_VIEW_BYTES:
        raise CommerceError("LIMIT_EXCEEDED", "Source read view exceeds its size bound.", "files", {}, 413)
    body = {
        "contract_version": COMMERC_VERSION,
        "state": session.state,
        "session_id": session.session_id,
        "source_revision": session.source_revision,
        "candidate_revision": session.candidate_revision,
        "source_bundle_sha256": bundle.bundle_sha256,
        "file_sha256": dict(bundle.file_sha256),
        "row_counts": {
            "orders": len(bundle.orders),
            "payments": len(bundle.payments),
            "deliveries": len(bundle.deliveries),
            "refunds": len(bundle.refunds),
        },
        "deterministic_candidates": cand.deterministic_wire(source_candidates),
        "ai_status": "NOT_REQUESTED",
        "limits": dict(LIMITS),
        "validated_source_rows": view,
    }
    if len(json.dumps(body).encode("utf-8")) > MAX_PARSE_RESPONSE_BYTES:
        raise CommerceError(
            "LIMIT_EXCEEDED", "Parse response exceeds its size bound.", "files", {}, 413
        )
    return body


def op_suggest(request: Any, store: Store = GLOBAL_STORE) -> dict[str, Any]:
    session, req = _session_request(store, request, SUGGEST_KEYS)
    with session.lock:
        _check_revisions_locked(session, req)
        if req.get("mode") != "META":
            raise wire.invalid_value("Field mode must be META.", "mode")
        max_suggestions = req.get("max_suggestions")
        if not wire.is_int(max_suggestions) or not 1 <= max_suggestions <= 5:
            if wire.is_int(max_suggestions) and max_suggestions > 5:
                raise wire.invalid_value(
                    "max_suggestions exceeds the bounded request limit.", "max_suggestions"
                )
            raise wire.invalid_value("Field max_suggestions must be an integer 1..5.", "max_suggestions")
        if meta.get_provider() is None:
            return meta.unavailable_response(session)
        raise CommerceError("AI_UNAVAILABLE", "No approved provider is available.", "mode", {}, 503)


def op_review(request: Any, store: Store = GLOBAL_STORE) -> dict[str, Any]:
    if not isinstance(request, dict):
        raise wire.invalid_value("Request must be a JSON object.", "")
    wire.require_version(request)
    session_id = request.get("session_id")
    if not wire.require_hex_token(session_id, 32):
        raise wire.invalid_value("Session identifier is malformed.", "session_id")
    assert wire.is_str(session_id)
    session = store.get(session_id)
    for key in (
        "expected_source_revision",
        "expected_candidate_revision",
        "expected_policy_revision",
    ):
        if not wire.is_int(request.get(key)):
            raise wire.invalid_value(f"Field {key} must be an integer.", key)
    with session.lock:
        check_revisions(
            session,
            request["expected_source_revision"],
            request["expected_candidate_revision"],
            request["expected_policy_revision"],
        )
        return review.freeze_review(session, request)


def _coverage_dict(
    outcome: worlds.SearchOutcome,
    checker_total: int | None,
    checker_checked: int,
    checker_complete: bool,
) -> dict[str, Any]:
    return {
        "raw_worlds_total": outcome.raw_total,
        "raw_worlds_checked": outcome.raw_checked,
        "invalid_worlds_total": outcome.invalid_total,
        "invalid_worlds_checked": outcome.invalid_checked,
        "admissible_worlds_total": outcome.admissible_total,
        "admissible_worlds_checked": outcome.admissible_checked,
        "checker_worlds_total": checker_total,
        "checker_worlds_checked": checker_checked,
        "fully_enumerated": outcome.fully_enumerated,
        "checker_complete": checker_complete,
    }


def _not_verified_envelope(
    session: Session,
    reason: str,
    outcome: worlds.SearchOutcome,
    checker_status: str,
    checker_total: int | None,
    checker_checked: int,
    threshold_k: int,
) -> dict[str, Any]:
    result = {
        "status": "NOT_VERIFIED",
        "reason": reason,
        "predicate": PREDICATE,
        "threshold_k": threshold_k,
        "baseline": None,
        "witness": None,
        "coverage": _coverage_dict(outcome, checker_total, checker_checked, False),
        "checker_status": checker_status,
        "proof_basis": "NONE",
        "minimum_distance_proven_within_scope": False,
        "minimum_link_distance_within_scope": None,
    }
    return {
        "contract_version": COMMERC_VERSION,
        "session_id": session.session_id,
        "state": session.state,
        "run_id": None,
        "source_revision": session.source_revision,
        "candidate_revision": session.candidate_revision,
        "policy_revision": session.policy_revision,
        "review_sha256": session.policy.review_sha256 if session.policy else None,
        "result": result,
    }


def _witness_wire(
    keys: list[str],
    baseline: dict[str, str | None],
    mapping: dict[str, str | None],
    count: int,
    threshold_k: int,
    distance: int,
) -> dict[str, Any]:
    return {
        "reference_changes": [
            {"record_key": key, "from_target_id": baseline[key], "to_target_id": mapping[key]}
            for key in keys
            if mapping[key] != baseline[key]
        ],
        "clean_fulfilled_count": count,
        "decision": count >= threshold_k,
        "link_distance": distance,
    }


def op_challenge(
    request: Any,
    store: Store = GLOBAL_STORE,
    clock: Callable[[], float] = time.monotonic,
) -> dict[str, Any]:
    session, req = _session_request(store, request, CHALLENGE_KEYS)
    with session.lock:
        _check_revisions_locked(session, req)
        expected_sha = req.get("expected_review_sha256")
        if not wire.require_hex_token(expected_sha, 64):
            raise wire.invalid_value("Review digest is malformed.", "expected_review_sha256")
        policy = session.policy
        if policy is None or expected_sha != policy.review_sha256:
            raise CommerceError(
                "STALE_STATE",
                "Review digest no longer matches the frozen policy and baseline.",
                "expected_review_sha256",
                {},
                409,
            )
        budget_ms = req.get("time_budget_ms", DEFAULT_TIME_BUDGET_MS)
        if (
            not wire.is_int(budget_ms)
            or not MIN_TIME_BUDGET_MS <= budget_ms <= MAX_TIME_BUDGET_MS
        ):
            raise wire.invalid_value(
                "Field time_budget_ms must be an integer 100..10000.", "time_budget_ms"
            )
        assert wire.is_int(budget_ms)
        if worlds.raw_product(policy.row_keys, policy.options) > MAX_RAW_WORLDS:
            raise CommerceError(
                "LIMIT_EXCEEDED",
                "Raw Cartesian product exceeds the 4096 world cap.",
                "review.options",
                {
                    "raw_worlds_total": worlds.raw_product(policy.row_keys, policy.options),
                    "max_raw_worlds": MAX_RAW_WORLDS,
                    "result_status": "NOT_VERIFIED",
                },
                422,
            )
        wall_start = clock()
        search_start = wall_start
        deadline = wall_start + budget_ms / 1000
        outcome = worlds.run_search(
            session.bundle,
            policy.row_keys,
            policy.options,
            policy.reference_mapping,
            policy.threshold_k,
            budget_ms,
            clock,
        )
        search_ms = int((clock() - search_start) * 1000)
        if outcome.timed_out:
            return _not_verified_envelope(
                session, "TIMEOUT", outcome, "UNRUN", None, 0, policy.threshold_k
            )
        assert outcome.baseline_count is not None
        assert outcome.invalid_total is not None and outcome.admissible_total is not None
        claim = checker.CheckerClaim(
            raw_total=outcome.raw_total,
            invalid_total=outcome.invalid_total,
            admissible_total=outcome.admissible_total,
            baseline_count=outcome.baseline_count,
            witness_mapping=outcome.witness_mapping,
            witness_count=outcome.witness_count,
            witness_distance=outcome.witness_distance,
            catalog_sha256=policy.catalog_sha256,
            policy_sha256=policy.policy_sha256,
            baseline_sha256=policy.baseline_sha256,
            review_sha256=policy.review_sha256,
        )
        checker_start = clock()
        try:
            verdict = checker.verify(
                session.bundle,
                policy.policy_payload,
                policy.reference_mapping,
                policy.threshold_k,
                claim,
                deadline,
                clock,
            )
        except Exception:
            return _not_verified_envelope(
                session,
                "ENGINE_INTERRUPTED",
                outcome,
                "FAILED",
                outcome.admissible_total,
                0,
                policy.threshold_k,
            )
        checker_ms = int((clock() - checker_start) * 1000)
        if not verdict.passed:
            reason = "TIMEOUT" if verdict.mismatch == "TIMEOUT" else "CHECKER_MISMATCH"
            return _not_verified_envelope(
                session,
                reason,
                outcome,
                "FAILED",
                outcome.admissible_total,
                verdict.worlds_checked,
                policy.threshold_k,
            )
        wall_ms = int((clock() - wall_start) * 1000)
        reversed_run = outcome.witness_mapping is not None
        baseline_block: dict[str, Any] | None = {
            "clean_fulfilled_count": outcome.baseline_count,
            "decision": outcome.baseline_count >= policy.threshold_k,
        }
        witness_block: dict[str, Any] | None = None
        if reversed_run:
            assert outcome.witness_count is not None and outcome.witness_distance is not None
            assert outcome.witness_mapping is not None
            witness_block = _witness_wire(
                policy.row_keys,
                policy.reference_mapping,
                outcome.witness_mapping,
                outcome.witness_count,
                policy.threshold_k,
                outcome.witness_distance,
            )
        coverage = _coverage_dict(
            outcome, outcome.admissible_total, verdict.worlds_checked, True
        )
        result = {
            "status": "REVERSED_EXHAUSTIVE" if reversed_run else "STABLE_WITHIN_SCOPE",
            "predicate": PREDICATE,
            "threshold_k": policy.threshold_k,
            "baseline": baseline_block,
            "witness": witness_block,
            "coverage": coverage,
            "checker_status": "PASSED",
            "proof_basis": PROOF_EXHAUSTIVE,
            "minimum_distance_proven_within_scope": reversed_run,
            "reason": None,
            "minimum_link_distance_within_scope": outcome.witness_distance,
        }
        run_id = secrets.token_hex(16)
        timings = {
            "parse": session.parse_ms,
            "search": search_ms,
            "checker": checker_ms,
            "wall": wall_ms,
        }
        envelope = {
            "contract_version": COMMERC_VERSION,
            "session_id": session.session_id,
            "state": STATE_CHALLENGED,
            "run_id": run_id,
            "source_revision": session.source_revision,
            "candidate_revision": session.candidate_revision,
            "policy_revision": session.policy_revision,
            "review_sha256": policy.review_sha256,
            "result": result,
        }
        session.run = RunRecord(
            run_id=run_id,
            envelope=envelope,
            result=result,
            baseline_mapping=dict(policy.reference_mapping),
            baseline_count=outcome.baseline_count,
            witness_mapping=dict(outcome.witness_mapping) if outcome.witness_mapping else None,
            witness_count=outcome.witness_count,
            coverage=coverage,
            timings_ms=timings,
            policy_revision=session.policy_revision,
            candidate_revision=session.candidate_revision,
            source_revision=session.source_revision,
            review_sha256=policy.review_sha256,
        )
        session.state = STATE_CHALLENGED
        return envelope


def op_receipt(request: Any, store: Store = GLOBAL_STORE) -> dict[str, Any]:
    if not isinstance(request, dict):
        raise wire.invalid_value("Request must be a JSON object.", "")
    wire.reject_unknown(request, RECEIPT_KEYS, "")
    wire.require_version(request)
    session_id = request.get("session_id")
    if not wire.require_hex_token(session_id, 32):
        raise wire.invalid_value("Session identifier is malformed.", "session_id")
    assert wire.is_str(session_id)
    session = store.get(session_id)
    with session.lock:
        run_id = request.get("run_id")
        if not wire.require_hex_token(run_id, 32):
            raise wire.invalid_value("Run identifier is malformed.", "run_id")
        expected_sha = request.get("expected_review_sha256")
        if not wire.require_hex_token(expected_sha, 64):
            raise wire.invalid_value("Review digest is malformed.", "expected_review_sha256")
        run = session.run
        if run is None or run.run_id != run_id:
            raise CommerceError(
                "RUN_NOT_FOUND",
                "No completed current run has the supplied identifier.",
                "run_id",
                {},
                404,
            )
        if session.state != STATE_CHALLENGED:
            raise CommerceError(
                "RECEIPT_NOT_READY",
                "No completed current run is available for export.",
                "run_id",
                {},
                409,
            )
        if expected_sha != run.review_sha256:
            raise CommerceError(
                "STALE_STATE",
                "Review digest no longer matches the frozen policy and baseline.",
                "expected_review_sha256",
                {},
                409,
            )
        return {
            "contract_version": COMMERC_VERSION,
            "receipt": receipts.build_receipt(session),
            "attestation": receipts.ATTESTATION,
        }


def op_replay(
    request: Any, clock: Callable[[], float] = time.monotonic
) -> dict[str, Any]:
    return receipts.verify_replay(request, ENGINE_IDENTITY, clock)
