"""Optional Meta suggestion path (contract sections 2.1, 5.2, 5.7).

G2 implements the deterministic no-provider path: without an approved live
provider the API truthfully returns AI_UNAVAILABLE and mutates nothing. The
pure proposal validation/merge helpers below encode the frozen provenance
rules (ADDED_TARGET / ADDED_PROVENANCE / EXISTING_PROVENANCE_NO_OP) and are
covered by unit tests; no live or fake provider traffic is initiated.
"""
from __future__ import annotations

from typing import Any

from . import COMMERC_VERSION
from . import candidates as cand
from . import wire
from .errors import CommerceError
from .session_state import Session
from .source_import import SourceBundle

PROVIDER = "META"
MODEL = "muse-spark-1.3"


def get_provider() -> None:
    """No approved provider is configured in G2; live Meta calls are a G4 gate."""
    return None


def unavailable_response(session: Session) -> dict[str, Any]:
    return {
        "contract_version": COMMERC_VERSION,
        "session_id": session.session_id,
        "ai_status": "AI_UNAVAILABLE",
        "suggestions": [],
        "source_revision": session.source_revision,
        "candidate_revision": session.candidate_revision,
        "authorisations_changed": False,
        "policy_revision": session.policy_revision,
        "state": session.state,
        "model_call": None,
        "catalog_changed": False,
        "rejected_proposals": [],
    }


def validate_proposals(
    bundle: SourceBundle,
    proposals: list[dict[str, Any]],
    server_call_id: str,
    max_suggestions: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Validate raw provider proposals; quarantine invalid ones by reason code."""
    accepted: list[dict[str, Any]] = []
    rejected: dict[str, int] = {}
    order_ids = {row.order_id for row in bundle.orders}
    payment_ids = {row.payment_id for row in bundle.payments}
    delivery_ids = {row.delivery_id for row in bundle.deliveries}
    refund_ids = {row.refund_id for row in bundle.refunds}

    def record_ids(record_type: str) -> set[str]:
        if record_type == "payment":
            return payment_ids
        if record_type == "delivery":
            return delivery_ids
        return refund_ids

    for proposal in proposals[:max_suggestions]:
        try:
            record_type = proposal["record_type"]
            record_id = proposal["record_id"]
            target_type = proposal["target_type"]
            target_id = proposal["target_id"]
            evidence = proposal["evidence"]
        except (TypeError, KeyError):
            rejected["INVALID_TARGET"] = rejected.get("INVALID_TARGET", 0) + 1
            continue
        if record_type not in cand.TYPE_ORDER or not wire.is_str(record_id):
            rejected["INVALID_RECORD"] = rejected.get("INVALID_RECORD", 0) + 1
            continue
        if record_id not in record_ids(record_type):
            rejected["INVALID_RECORD"] = rejected.get("INVALID_RECORD", 0) + 1
            continue
        if target_type != cand.TARGET_TYPE[record_type] or not wire.is_str(target_id):
            rejected["INVALID_TARGET"] = rejected.get("INVALID_TARGET", 0) + 1
            continue
        pool = payment_ids if record_type == "refund" else order_ids
        if target_id not in pool:
            rejected["INVALID_TARGET"] = rejected.get("INVALID_TARGET", 0) + 1
            continue
        if not wire.is_ascii_text(evidence):
            rejected["INVALID_EVIDENCE"] = rejected.get("INVALID_EVIDENCE", 0) + 1
            continue
        try:
            cand.check_edge_guard(bundle, record_type, record_id, target_id)
        except CommerceError as exc:
            code = "CURRENCY_MISMATCH" if exc.code == "CURRENCY_MISMATCH" else "AMOUNT_EXCEEDS"
            rejected[code] = rejected.get(code, 0) + 1
            continue
        accepted.append(
            {
                "record_type": record_type,
                "record_id": record_id,
                "record_key": cand.record_key(record_type, record_id),
                "target_type": target_type,
                "target_id": target_id,
                "origin": cand.ORIGIN_META,
                "evidence": evidence,
                "server_call_id": server_call_id,
                "authorised": False,
            }
        )
    rejected_list = [{"reason_code": code, "count": rejected[code]} for code in rejected]
    return accepted, rejected_list


def merge_proposals(
    active: list[cand.Candidate], accepted: list[dict[str, Any]]
) -> tuple[list[cand.Candidate], list[dict[str, Any]], bool]:
    """Merge accepted Meta proposals, distinguishing target vs provenance adds."""
    pairs = {(entry.record_key, entry.target_id) for entry in active}
    meta_pairs = {
        (entry.record_key, entry.target_id)
        for entry in active
        if entry.origin == cand.ORIGIN_META
    }
    merged = list(active)
    suggestions: list[dict[str, Any]] = []
    changed = False
    for proposal in accepted:
        pair = (proposal["record_key"], proposal["target_id"])
        if pair in meta_pairs:
            effect = "EXISTING_PROVENANCE_NO_OP"
        else:
            merged.append(
                cand.Candidate(
                    proposal["record_key"],
                    proposal["target_id"],
                    cand.ORIGIN_META,
                    evidence=proposal["evidence"],
                    provider=PROVIDER,
                    model=MODEL,
                    server_call_id=proposal["server_call_id"],
                )
            )
            changed = True
            if pair in pairs:
                effect = "ADDED_PROVENANCE"
            else:
                effect = "ADDED_TARGET"
            pairs.add(pair)
            meta_pairs.add(pair)
        suggestions.append({**proposal, "catalog_effect": effect})
    return cand.sort_catalog(merged), suggestions, changed
