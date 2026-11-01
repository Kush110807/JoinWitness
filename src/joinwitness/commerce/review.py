"""Human review validation and atomic policy freeze (contract section 3).

A review is a complete replacement snapshot: every non-order source row gets
exactly one row entry, every surfaced candidate gets a disposition, unmatched
is explicit everywhere, and the human-adopted reference mapping must itself be
an admissible world. Success commits one indivisible state transition; any
failure commits nothing.
"""
from __future__ import annotations

from typing import Any

from . import COMMERC_VERSION, canonical
from . import candidates as cand
from . import wire, worlds
from .errors import (
    MAX_ALTERNATIVES_PER_VARIABLE,
    MAX_RAW_WORLDS,
    MAX_VARIABLE_RECORDS,
    CommerceError,
)
from .session_state import (
    STATE_REVIEW_FROZEN,
    PolicySnapshot,
    Session,
)
from .source_import import SourceBundle

AUTHORISED_BY = "HUMAN_REVIEW_ATTESTED_NOT_IDENTITY_VERIFIED"
DISPOSITIONS = ("CONFIRMED", "POSSIBLE", "PROHIBITED")
ATTESTATION_KEYS = (
    "all_rows_reviewed",
    "understands_bounded_predicate",
    "conflicting_source_ref_overrides_explained",
)

REVIEW_KEYS = frozenset(
    {
        "contract_version",
        "session_id",
        "expected_source_revision",
        "expected_candidate_revision",
        "expected_policy_revision",
        "threshold_k",
        "reviewer_label",
        "review_attestation",
        "manual_candidates",
        "rows",
        "reference_mapping",
    }
)
MANUAL_KEYS = frozenset({"record_type", "record_id", "target_id", "reason"})
ROW_KEYS = frozenset({"record_type", "record_id", "edges", "unmatched"})
EDGE_KEYS = frozenset({"target_id", "disposition"})


def _invalid_review(message: str, path: str, details: dict[str, Any] | None = None) -> CommerceError:
    return CommerceError("INVALID_REVIEW", message, path, details or {}, 422)


def _invalid_baseline(
    message: str, path: str, details: dict[str, Any] | None = None
) -> CommerceError:
    return CommerceError("INVALID_BASELINE", message, path, details or {}, 422)


def _record_ids(bundle: SourceBundle, record_type: str) -> set[str]:
    if record_type == "payment":
        return {row.payment_id for row in bundle.payments}
    if record_type == "delivery":
        return {row.delivery_id for row in bundle.deliveries}
    return {row.refund_id for row in bundle.refunds}


def _target_ids(bundle: SourceBundle, record_type: str) -> set[str]:
    if record_type == "refund":
        return {row.payment_id for row in bundle.payments}
    return {row.order_id for row in bundle.orders}


def validate_manual(
    bundle: SourceBundle, existing: set[tuple[str, str]], manual: Any
) -> list[cand.Candidate]:
    """Validate the complete manual-candidate replacement catalog."""
    if not isinstance(manual, list):
        raise wire.invalid_value("Field manual_candidates must be an array.", "manual_candidates")
    entries: list[cand.Candidate] = []
    seen: set[tuple[str, str]] = set()
    for index, item in enumerate(manual):
        path = f"manual_candidates[{index}]"
        if not isinstance(item, dict):
            raise CommerceError("MALFORMED_CANDIDATE", "Manual candidate must be an object.", path, {}, 422)
        wire.reject_unknown(item, MANUAL_KEYS, path)
        record_type = item.get("record_type")
        record_id = item.get("record_id")
        target_id = item.get("target_id")
        reason = item.get("reason")
        if record_type not in cand.TYPE_ORDER:
            raise CommerceError(
                "MALFORMED_CANDIDATE", "Manual candidate has an unknown record type.", path, {}, 422
            )
        assert isinstance(record_type, str)
        if not wire.is_str(record_id) or record_id not in _record_ids(bundle, record_type):
            raise CommerceError(
                "MALFORMED_CANDIDATE", "Manual candidate names an unknown record.", path, {}, 422
            )
        assert isinstance(record_id, str)
        if not wire.is_str(target_id) or target_id not in _target_ids(bundle, record_type):
            raise CommerceError(
                "MALFORMED_CANDIDATE", "Manual candidate names an unknown target.", path, {}, 422
            )
        assert isinstance(target_id, str)
        if not wire.is_ascii_text(reason):
            raise wire.invalid_value("Manual candidate reason must be ASCII 1-200 chars.", f"{path}.reason")
        assert isinstance(reason, str)
        key = cand.record_key(record_type, record_id)
        pair = (key, target_id)
        if pair in seen:
            raise _invalid_review(
                "Manual candidates contain a duplicate record target.",
                path,
                {"record_key": key, "target_id": target_id},
            )
        if pair in existing:
            raise _invalid_review(
                "Manual candidate collides with a registered candidate.",
                path,
                {"record_key": key, "target_id": target_id},
            )
        seen.add(pair)
        try:
            cand.check_edge_guard(bundle, record_type, record_id, target_id)
        except CommerceError as exc:
            raise CommerceError(exc.code, exc.message, path, exc.details, exc.http_status)
        entries.append(cand.Candidate(key, target_id, cand.ORIGIN_MANUAL, reason=reason))
    return entries


def validate_rows(
    bundle: SourceBundle, catalog_targets: dict[str, list[str]], rows: Any
) -> tuple[list[dict[str, Any]], dict[str, tuple[str | None, ...]]]:
    """Validate dispositions and derive admitted options per record key."""
    if not isinstance(rows, list):
        raise wire.invalid_value("Field rows must be an array.", "rows")
    expected = set(worlds.row_keys_in_order(bundle))
    seen: set[str] = set()
    canonical_rows: list[dict[str, Any]] = []
    options: dict[str, tuple[str | None, ...]] = {}
    for item in rows:
        if not isinstance(item, dict):
            raise _invalid_review("Review row must be an object.", "rows")
        wire.reject_unknown(item, ROW_KEYS, "rows")
        record_type = item.get("record_type")
        record_id = item.get("record_id")
        if record_type not in cand.TYPE_ORDER or not wire.is_str(record_id):
            raise _invalid_review("Review row names an unknown record.", "rows")
        assert isinstance(record_type, str) and isinstance(record_id, str)
        if record_id not in _record_ids(bundle, record_type):
            raise _invalid_review("Review row names an unknown record.", "rows")
        key = cand.record_key(record_type, record_id)
        if key in seen:
            raise _invalid_review("Review rows contain a duplicate record.", "rows", {"record_key": key})
        seen.add(key)
        edges = item.get("edges")
        unmatched = item.get("unmatched")
        if not isinstance(edges, list):
            raise _invalid_review("Review row edges must be an array.", f"rows.{key}")
        if unmatched not in DISPOSITIONS:
            raise _invalid_review("Review row unmatched must have a disposition.", f"rows.{key}")
        dispositions: dict[str, str] = {}
        for edge in edges:
            if not isinstance(edge, dict):
                raise _invalid_review("Review edge must be an object.", f"rows.{key}")
            wire.reject_unknown(edge, EDGE_KEYS, f"rows.{key}")
            target_id = edge.get("target_id")
            disposition = edge.get("disposition")
            if not wire.is_str(target_id):
                raise _invalid_review("Review edge target must be a string.", f"rows.{key}")
            if disposition not in DISPOSITIONS:
                raise _invalid_review("Review edge disposition is invalid.", f"rows.{key}")
            assert isinstance(target_id, str) and isinstance(disposition, str)
            if target_id in dispositions:
                raise _invalid_review("Review row repeats an edge target.", f"rows.{key}")
            dispositions[target_id] = disposition
        required = set(catalog_targets.get(key, []))
        if required - set(dispositions):
            raise CommerceError(
                "UNREVIEWED_CANDIDATE",
                "A surfaced candidate has no reviewer disposition.",
                f"rows.{key}",
                {},
                422,
            )
        for target_id in sorted(set(dispositions) - required):
            raise _invalid_review(
                "Candidate is not active in the current registered catalogue.",
                f"rows.{key}.edges.{target_id}",
            )
        confirmed = [t for t, d in dispositions.items() if d == "CONFIRMED"]
        if unmatched == "CONFIRMED":
            confirmed.append("")
        if confirmed:
            others = [d for d in dispositions.values() if d != "PROHIBITED"] + (
                [] if unmatched == "PROHIBITED" else ["UNMATCHED"]
            )
            if len(confirmed) > 1 or len(others) > 1:
                raise CommerceError(
                    "INCONSISTENT_REVIEW",
                    "Confirmed choice conflicts with another permitted choice.",
                    f"rows.{key}",
                    {},
                    422,
                )
        admitted: list[str | None] = [t for t, d in dispositions.items() if d in ("CONFIRMED", "POSSIBLE")]
        if unmatched in ("CONFIRMED", "POSSIBLE"):
            admitted.append(None)
        if not admitted:
            raise _invalid_review("Review row permits no choice.", f"rows.{key}")
        admitted_sorted = tuple(sorted((t for t in admitted if t is not None)))
        if None in admitted:
            admitted_sorted = (None,) + admitted_sorted
        options[key] = admitted_sorted
        canonical_rows.append(
            {
                "record_type": record_type,
                "record_id": record_id,
                "edges": [
                    {"target_id": target_id, "disposition": dispositions[target_id]}
                    for target_id in sorted(dispositions)
                ],
                "unmatched": unmatched,
            }
        )
    if seen != expected:
        missing = sorted(expected - seen)
        raise CommerceError(
            "REVIEW_INCOMPLETE",
            "Review rows must cover every non-order source row.",
            "rows",
            {"missing_record_key": missing[0]} if missing else {},
            422,
        )
    canonical_rows.sort(key=lambda row: (cand.TYPE_ORDER[row["record_type"]], row["record_id"]))
    return canonical_rows, options


def validate_mapping(
    keys: list[str],
    options: dict[str, tuple[str | None, ...]],
    mapping: Any,
) -> dict[str, str | None]:
    """Validate the human-adopted reference mapping against admitted choices."""
    if not isinstance(mapping, dict):
        raise _invalid_baseline("Reference mapping must be an object.", "reference_mapping")
    for key in sorted(mapping):
        if key not in options:
            raise _invalid_baseline(
                "Reference mapping names an unknown record.", f"reference_mapping.{key}"
            )
    for key in keys:
        if key not in mapping:
            raise _invalid_baseline(
                "Reference mapping must cover every non-order record.", f"reference_mapping.{key}"
            )
    resolved: dict[str, str | None] = {}
    for key in keys:
        value = mapping[key]
        if value is not None and not wire.is_str(value):
            raise _invalid_baseline(
                "Reference mapping target must be a string or null.", f"reference_mapping.{key}"
            )
        if value not in options[key]:
            raise _invalid_baseline(
                "Reference mapping selects a target outside reviewed permissions.",
                f"reference_mapping.{key}",
                {"target_id": value},
            )
        resolved[key] = value
    return resolved


def policy_payload(
    bundle_sha256: str,
    catalog: list[dict[str, Any]],
    catalog_sha256: str,
    threshold_k: int,
    reviewer_label: str,
    manual: list[dict[str, Any]],
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "contract_version": COMMERC_VERSION,
        "source_bundle_sha256": bundle_sha256,
        "candidate_catalog_sha256": catalog_sha256,
        "candidate_catalog": catalog,
        "threshold_k": threshold_k,
        "reviewer_label": reviewer_label,
        "review_attestation": {
            "all_rows_reviewed": True,
            "understands_bounded_predicate": True,
            "conflicting_source_ref_overrides_explained": True,
        },
        "manual_candidates": manual,
        "rows": rows,
    }


def baseline_payload(policy_sha256: str, mapping: dict[str, str | None]) -> dict[str, Any]:
    return {"policy_sha256": policy_sha256, "reference_mapping": dict(mapping)}


def review_payload(policy_sha256: str, baseline_sha256: str) -> dict[str, Any]:
    return {"policy_sha256": policy_sha256, "baseline_sha256": baseline_sha256}


def freeze_review(session: Session, request: dict[str, Any]) -> dict[str, Any]:
    """Validate a complete replacement snapshot and atomically freeze it."""
    wire.reject_unknown(request, REVIEW_KEYS, "")
    bundle = session.bundle
    threshold_k = request.get("threshold_k")
    if not wire.is_int(threshold_k) or not 1 <= threshold_k <= len(bundle.orders):
        raise wire.invalid_value("Field threshold_k must be an integer 1..N orders.", "threshold_k")
    assert wire.is_int(threshold_k)
    reviewer_label = request.get("reviewer_label")
    if not wire.is_ascii_text(reviewer_label):
        raise wire.invalid_value("Reviewer label must be ASCII 1-200 chars.", "reviewer_label")
    assert wire.is_str(reviewer_label)
    attestation = request.get("review_attestation")
    if not isinstance(attestation, dict) or set(attestation) != set(ATTESTATION_KEYS):
        raise _invalid_review("Review attestation must assert all three statements.", "review_attestation")
    for key in ATTESTATION_KEYS:
        if attestation[key] is not True:
            raise _invalid_review(
                "Review attestation must assert all three statements.", f"review_attestation.{key}"
            )
    frozen_catalog = [entry for entry in session.source_candidates + session.meta_entries]
    existing_pairs = {(entry.record_key, entry.target_id) for entry in frozen_catalog}
    manual_entries = validate_manual(bundle, existing_pairs, request.get("manual_candidates"))
    provisional = cand.sort_catalog(frozen_catalog + manual_entries)
    catalog_dicts = [cand.entry_digest_dict(entry) for entry in provisional]
    catalog_targets = cand.distinct_targets(provisional)
    canonical_rows, options = validate_rows(bundle, catalog_targets, request.get("rows"))
    keys = worlds.row_keys_in_order(bundle)
    mapping = validate_mapping(keys, options, request.get("reference_mapping"))
    _check_caps(keys, options)
    counts = _preflight(bundle, keys, options, mapping)
    _check_unreachable(keys, options, mapping, counts["seen"])
    catalog_sha = canonical.domain_digest(canonical.DOMAIN_CANDIDATES, catalog_dicts)
    manual_wire = []
    for entry in manual_entries:
        parsed = cand.parse_record_key(entry.record_key)
        assert parsed is not None
        manual_wire.append(
            {
                "record_type": parsed[0],
                "record_id": parsed[1],
                "target_id": entry.target_id,
                "reason": entry.reason,
            }
        )
    payload = policy_payload(
        bundle.bundle_sha256,
        catalog_dicts,
        catalog_sha,
        threshold_k,
        reviewer_label,
        manual_wire,
        canonical_rows,
    )
    policy_sha = canonical.domain_digest(canonical.DOMAIN_POLICY, payload)
    base_sha = canonical.domain_digest(
        canonical.DOMAIN_BASELINE, baseline_payload(policy_sha, mapping)
    )
    review_sha = canonical.domain_digest(
        canonical.DOMAIN_REVIEW, review_payload(policy_sha, base_sha)
    )
    previous = [cand.entry_digest_dict(entry) for entry in cand.sort_catalog(session.active_catalog())]
    if catalog_dicts != previous:
        session.candidate_revision += 1
    session.manual_entries = cand.sort_catalog(manual_entries)
    session.policy_revision += 1
    session.policy = PolicySnapshot(
        policy_payload=payload,
        policy_sha256=policy_sha,
        catalog=provisional,
        catalog_sha256=catalog_sha,
        reference_mapping=dict(mapping),
        baseline_sha256=base_sha,
        review_sha256=review_sha,
        threshold_k=threshold_k,
        reviewer_label=reviewer_label,
        attestation={key: True for key in ATTESTATION_KEYS},
        manual=manual_wire,
        rows=canonical_rows,
        options=options,
        row_keys=keys,
        raw_worlds=counts["raw_total"],
        admissible_worlds=counts["admissible"],
        invalid_worlds=counts["invalid"],
        variable_records=len([key for key in keys if len(options[key]) > 1]),
    )
    session.run = None
    session.state = STATE_REVIEW_FROZEN
    return {
        "contract_version": COMMERC_VERSION,
        "session_id": session.session_id,
        "state": session.state,
        "source_revision": session.source_revision,
        "candidate_revision": session.candidate_revision,
        "policy_revision": session.policy_revision,
        "candidate_catalog_sha256": catalog_sha,
        "source_bundle_sha256": bundle.bundle_sha256,
        "policy_sha256": policy_sha,
        "baseline_sha256": base_sha,
        "review_sha256": review_sha,
        "threshold_k": threshold_k,
        "raw_worlds": counts["raw_total"],
        "admissible_worlds": counts["admissible"],
        "invalid_worlds": counts["invalid"],
        "variable_records": len([key for key in keys if len(options[key]) > 1]),
        "baseline_valid": True,
        "authorised_by": AUTHORISED_BY,
    }


def _check_caps(keys: list[str], options: dict[str, tuple[str | None, ...]]) -> None:
    variables = [key for key in keys if len(options[key]) > 1]
    if len(variables) > MAX_VARIABLE_RECORDS:
        raise CommerceError(
            "LIMIT_EXCEEDED",
            "Reviewed policy exceeds the 10 variable record bound.",
            "review.options",
            {
                "variable_records": len(variables),
                "max_variable_records": MAX_VARIABLE_RECORDS,
                "result_status": "NOT_VERIFIED",
            },
            422,
        )
    for key in variables:
        alternatives = len(options[key]) - 1
        if alternatives > MAX_ALTERNATIVES_PER_VARIABLE:
            raise CommerceError(
                "LIMIT_EXCEEDED",
                "Reviewed policy exceeds the 2 alternatives per variable bound.",
                f"rows.{key}",
                {
                    "alternatives": alternatives,
                    "max_alternatives": MAX_ALTERNATIVES_PER_VARIABLE,
                    "result_status": "NOT_VERIFIED",
                },
                422,
            )
    total = worlds.raw_product(keys, options)
    if total > MAX_RAW_WORLDS:
        raise CommerceError(
            "LIMIT_EXCEEDED",
            "Raw Cartesian product exceeds the 4096 world cap.",
            "review.options",
            {
                "raw_worlds_total": total,
                "max_raw_worlds": MAX_RAW_WORLDS,
                "result_status": "NOT_VERIFIED",
            },
            422,
        )


def _preflight(
    bundle: SourceBundle,
    keys: list[str],
    options: dict[str, tuple[str | None, ...]],
    mapping: dict[str, str | None],
) -> dict[str, Any]:
    admissible = 0
    invalid = 0
    seen: dict[str, set[str | None]] = {key: set() for key in keys}
    for world in worlds.enumerate_raw_worlds(keys, options):
        ok, _ = worlds.classify_world(bundle, world)
        if not ok:
            invalid += 1
            continue
        admissible += 1
        for key in keys:
            seen[key].add(world[key])
    if admissible == 0:
        raise CommerceError(
            "CONTRADICTORY_POLICY",
            "No admissible world satisfies all reviewed constraints.",
            "rows",
            {"admissible_worlds": 0, "result_status": "NOT_VERIFIED"},
            422,
        )
    ok, _ = worlds.classify_world(bundle, mapping)
    if not ok:
        raise _invalid_baseline(
            "Reference mapping does not form an admissible world.", "reference_mapping"
        )
    return {
        "raw_total": worlds.raw_product(keys, options),
        "admissible": admissible,
        "invalid": invalid,
        "seen": seen,
    }


def _check_unreachable(
    keys: list[str],
    options: dict[str, tuple[str | None, ...]],
    mapping: dict[str, str | None],
    seen: dict[str, set[str | None]],
) -> None:
    for key in keys:
        for choice in options[key]:
            if choice == mapping[key]:
                continue
            if choice not in seen[key]:
                raise CommerceError(
                    "UNREACHABLE_CHOICE",
                    "An authorised choice occurs in no admissible world.",
                    f"rows.{key}",
                    {"target_id": choice},
                    422,
                )
