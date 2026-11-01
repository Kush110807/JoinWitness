"""Receipt export and stateless replay (contract sections 4.2, 5.5, 5.6).

A receipt binds source bytes, the frozen human policy, provenance, revisions,
the actual engine build identity and complete independently checked coverage.
Replay revalidates the digest, the sources, the engine identity and every
material output from scratch. Hashes prove consistency, never issuer identity.
"""
from __future__ import annotations

import time
from typing import Any, Callable

from . import COMMERC_VERSION, ENGINE_IDENTITY, RECEIPT_FORMAT, canonical
from . import independent_checker as checker
from . import wire, worlds
from .errors import CommerceError
from .session_state import Session
from .source_import import import_sources

SCOPE = {
    "max_orders": 50,
    "max_each_other_file": 60,
    "max_variable_records": 10,
    "max_alternatives_per_variable": 2,
    "max_raw_worlds": 4096,
}

ATTESTATION = "CONSISTENCY_HASH_ONLY_NOT_SIGNATURE"

RECEIPT_KEYS = frozenset(
    {
        "format",
        "contract_version",
        "source_bundle_sha256",
        "file_sha256",
        "candidate_catalog_sha256",
        "policy",
        "reference_mapping",
        "policy_sha256",
        "baseline_sha256",
        "review_sha256",
        "run_id",
        "engine_identity",
        "result",
        "timings_ms",
        "scope",
        "receipt_sha256",
        "source_revision",
        "candidate_revision",
        "policy_revision",
    }
)


def receipt_core_without_sha(receipt: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in receipt.items() if key != "receipt_sha256"}


def build_receipt(session: Session) -> dict[str, Any]:
    """Export the current completed checker-passed run. Caller holds the lock."""
    assert session.policy is not None and session.run is not None
    policy = session.policy
    run = session.run
    core = {
        "format": RECEIPT_FORMAT,
        "contract_version": COMMERC_VERSION,
        "source_bundle_sha256": session.bundle.bundle_sha256,
        "file_sha256": dict(session.bundle.file_sha256),
        "candidate_catalog_sha256": policy.catalog_sha256,
        "policy": policy.policy_payload,
        "reference_mapping": dict(policy.reference_mapping),
        "policy_sha256": policy.policy_sha256,
        "baseline_sha256": policy.baseline_sha256,
        "review_sha256": policy.review_sha256,
        "run_id": run.run_id,
        "engine_identity": ENGINE_IDENTITY,
        "result": run.result,
        "timings_ms": dict(run.timings_ms),
        "scope": dict(SCOPE),
        "source_revision": run.source_revision,
        "candidate_revision": run.candidate_revision,
        "policy_revision": run.policy_revision,
    }
    return {**core, "receipt_sha256": canonical.domain_digest(canonical.DOMAIN_RECEIPT, core)}


def _tampered(message: str, path: str) -> CommerceError:
    return CommerceError("RECEIPT_TAMPERED", message, path, {}, 422, "NOT_VERIFIED")


def _options_from_policy_rows(rows: Any) -> tuple[list[str], dict[str, tuple[str | None, ...]]]:
    if not isinstance(rows, list):
        raise _tampered("Receipt policy rows are malformed.", "receipt.policy.rows")
    keys: list[str] = []
    options: dict[str, tuple[str | None, ...]] = {}
    for row in rows:
        try:
            key = f"{row['record_type']}:{row['record_id']}"
            edges = row["edges"]
            unmatched = row["unmatched"]
        except (TypeError, KeyError):
            raise _tampered("Receipt policy rows are malformed.", "receipt.policy.rows")
        choices = sorted(
            edge["target_id"]
            for edge in edges
            if edge["disposition"] in ("CONFIRMED", "POSSIBLE")
        )
        if unmatched in ("CONFIRMED", "POSSIBLE"):
            choices = [None] + choices  # type: ignore[list-item]
        keys.append(key)
        options[key] = tuple(choices)
    order = {"payment": 0, "delivery": 1, "refund": 2}
    keys.sort(key=lambda key: (order[key.split(":")[0]], key.split(":")[1]))
    return keys, options


def verify_replay(
    request: Any,
    engine_identity: str = ENGINE_IDENTITY,
    clock: Callable[[], float] = time.monotonic,
) -> dict[str, Any]:
    """Stateless replay: revalidate everything and recompute every output."""
    try:
        return _replay(request, engine_identity, clock)
    except CommerceError as exc:
        if exc.verification_status is None:
            exc.verification_status = "NOT_VERIFIED"
        raise


def _replay(
    request: Any, engine_identity: str, clock: Callable[[], float]
) -> dict[str, Any]:
    if not isinstance(request, dict):
        raise wire.invalid_value("Replay request must be an object.", "")
    wire.reject_unknown(request, frozenset({"contract_version", "receipt", "files"}), "")
    wire.require_version(request)
    receipt = request.get("receipt")
    if not isinstance(receipt, dict):
        raise _tampered("Receipt must be an object.", "receipt")
    for key in sorted(receipt):
        if key not in RECEIPT_KEYS:
            raise _tampered("Receipt carries an unknown field.", f"receipt.{key}")
    for key in sorted(RECEIPT_KEYS):
        if key not in receipt:
            raise _tampered("Receipt is missing a required field.", f"receipt.{key}")
    if receipt["format"] != RECEIPT_FORMAT or receipt["contract_version"] != COMMERC_VERSION:
        raise _tampered("Receipt format or contract version is wrong.", "receipt.format")
    if not wire.require_hex_token(receipt.get("receipt_sha256"), 64):
        raise _tampered("Receipt digest does not match canonical receipt body.", "receipt.receipt_sha256")
    recomputed_sha = canonical.domain_digest(
        canonical.DOMAIN_RECEIPT, receipt_core_without_sha(receipt)
    )
    if recomputed_sha != receipt["receipt_sha256"]:
        raise _tampered("Receipt digest does not match canonical receipt body.", "receipt.receipt_sha256")

    bundle = import_sources(request.get("files"))
    claimed_files = receipt["file_sha256"]
    if not isinstance(claimed_files, dict) or any(
        claimed_files.get(name) != bundle.file_sha256[name]
        for name in ("orders.csv", "payments.csv", "deliveries.csv", "refunds.csv")
    ):
        raise CommerceError(
            "SOURCE_MISMATCH",
            "Replay sources do not match the receipt bundle.",
            "files",
            {},
            409,
            "NOT_VERIFIED",
        )
    if receipt["source_bundle_sha256"] != bundle.bundle_sha256:
        raise CommerceError(
            "SOURCE_MISMATCH",
            "Replay sources do not match the receipt bundle.",
            "files",
            {},
            409,
            "NOT_VERIFIED",
        )
    if receipt["engine_identity"] != engine_identity:
        raise CommerceError(
            "ENGINE_VERSION_MISMATCH",
            "Receipt engine identity does not match this build.",
            "receipt.engine_identity",
            {},
            409,
            "NOT_VERIFIED",
        )
    policy = receipt["policy"]
    if not isinstance(policy, dict):
        raise _tampered("Receipt policy is malformed.", "receipt.policy")
    try:
        catalog = policy["candidate_catalog"]
        catalog_sha = canonical.domain_digest(canonical.DOMAIN_CANDIDATES, catalog)
        policy_sha = canonical.domain_digest(canonical.DOMAIN_POLICY, policy)
        mapping = {
            key: value for key, value in receipt["reference_mapping"].items()
        }
        base_sha = canonical.domain_digest(
            canonical.DOMAIN_BASELINE,
            {"policy_sha256": policy_sha, "reference_mapping": mapping},
        )
        review_sha = canonical.domain_digest(
            canonical.DOMAIN_REVIEW,
            {"policy_sha256": policy_sha, "baseline_sha256": base_sha},
        )
    except (KeyError, TypeError, ValueError, AttributeError):
        raise _tampered("Receipt policy digests do not recompute.", "receipt.policy")
    if (
        catalog_sha != receipt["candidate_catalog_sha256"]
        or catalog_sha != policy.get("candidate_catalog_sha256")
        or policy_sha != receipt["policy_sha256"]
        or base_sha != receipt["baseline_sha256"]
        or review_sha != receipt["review_sha256"]
    ):
        raise _tampered("Receipt policy digests do not recompute.", "receipt.policy")

    threshold_k = policy.get("threshold_k")
    if type(threshold_k) is not int or not 1 <= threshold_k <= len(bundle.orders):
        raise _tampered("Receipt threshold is malformed.", "receipt.policy.threshold_k")
    keys, options = _options_from_policy_rows(policy.get("rows"))
    if set(keys) != set(mapping) or any(
        mapping[key] not in options[key] for key in keys
    ):
        raise _tampered("Receipt baseline is outside reviewed permissions.", "receipt.reference_mapping")

    outcome = worlds.run_search(bundle, keys, options, mapping, threshold_k, 10000, clock)
    if outcome.timed_out or not outcome.fully_enumerated:
        raise CommerceError(
            "TIMEOUT",
            "Replay recomputation exceeded its budget.",
            "receipt",
            {},
            503,
            "NOT_VERIFIED",
        )
    assert outcome.baseline_count is not None
    claim = checker.CheckerClaim(
        raw_total=outcome.raw_total,
        invalid_total=outcome.invalid_total or 0,
        admissible_total=outcome.admissible_total or 0,
        baseline_count=outcome.baseline_count,
        witness_mapping=outcome.witness_mapping,
        witness_count=outcome.witness_count,
        witness_distance=outcome.witness_distance,
        catalog_sha256=catalog_sha,
        policy_sha256=policy_sha,
        baseline_sha256=base_sha,
        review_sha256=review_sha,
    )
    verdict = checker.verify(bundle, policy, mapping, threshold_k, claim, None, clock)
    if not verdict.passed:
        raise CommerceError(
            "CHECKER_MISMATCH",
            "Replay recomputation failed independent checking.",
            "receipt",
            {},
            422,
            "NOT_VERIFIED",
        )
    _compare_result(receipt["result"], outcome, threshold_k)
    coverage = {
        "raw_worlds_total": outcome.raw_total,
        "raw_worlds_checked": outcome.raw_checked,
        "invalid_worlds_total": outcome.invalid_total,
        "invalid_worlds_checked": outcome.invalid_checked,
        "admissible_worlds_total": outcome.admissible_total,
        "admissible_worlds_checked": outcome.admissible_checked,
        "checker_worlds_total": outcome.admissible_total,
        "checker_worlds_checked": verdict.worlds_checked,
        "fully_enumerated": True,
        "checker_complete": True,
    }
    return {
        "contract_version": COMMERC_VERSION,
        "verification_status": "VERIFIED_REPLAY",
        "source_binding": "MATCH",
        "policy_binding": "MATCH",
        "receipt_integrity": "MATCH",
        "engine_identity": engine_identity,
        "independent_checker": "PASSED",
        "recomputed": {
            "baseline_clean_count": outcome.baseline_count,
            "witness_clean_count": outcome.witness_count,
            "link_distance": outcome.witness_distance,
            "coverage": coverage,
        },
        "historical_receipt_only": True,
    }


def _compare_result(result: Any, outcome: worlds.SearchOutcome, threshold_k: int) -> None:
    try:
        baseline = result["baseline"]
        witness = result["witness"]
        coverage = result["coverage"]
    except (TypeError, KeyError):
        raise _tampered("Receipt result is malformed.", "receipt.result")
    if result.get("threshold_k") != threshold_k:
        raise _tampered("Receipt result threshold does not match.", "receipt.result")
    expected_status = "REVERSED_EXHAUSTIVE" if outcome.witness_mapping is not None else "STABLE_WITHIN_SCOPE"
    if result.get("status") != expected_status:
        raise _tampered("Receipt result status does not recompute.", "receipt.result")
    if (
        baseline["clean_fulfilled_count"] != outcome.baseline_count
        or baseline["decision"] != (outcome.baseline_count >= threshold_k)
    ):
        raise _tampered("Receipt baseline does not recompute.", "receipt.result")
    if outcome.witness_mapping is None:
        if witness is not None:
            raise _tampered("Receipt witness does not recompute.", "receipt.result")
    else:
        try:
            changes = witness["reference_changes"]
        except (TypeError, KeyError):
            raise _tampered("Receipt witness does not recompute.", "receipt.result")
        if (
            witness.get("clean_fulfilled_count") != outcome.witness_count
            or witness.get("decision") != (outcome.witness_count >= threshold_k)
            or witness.get("link_distance") != outcome.witness_distance
            or not isinstance(changes, list)
        ):
            raise _tampered("Receipt witness does not recompute.", "receipt.result")
    for key, expected in (
        ("raw_worlds_total", outcome.raw_total),
        ("raw_worlds_checked", outcome.raw_checked),
        ("invalid_worlds_total", outcome.invalid_total),
        ("invalid_worlds_checked", outcome.invalid_checked),
        ("admissible_worlds_total", outcome.admissible_total),
        ("admissible_worlds_checked", outcome.admissible_checked),
    ):
        try:
            if coverage[key] != expected:
                raise _tampered("Receipt coverage does not recompute.", "receipt.result")
        except (TypeError, KeyError):
            raise _tampered("Receipt coverage does not recompute.", "receipt.result")
