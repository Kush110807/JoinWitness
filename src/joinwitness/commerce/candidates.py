"""Deterministic candidate catalog with typed guards and provenance.

One SOURCE_REF candidate per nonempty existing source reference, explicit
human MANUAL candidates and server-registered META_SUGGESTED provenance. The
selection identity is (record_key, target_id); provenance additionally carries
an origin class. No candidate is ever authorised without a full human review.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from . import canonical
from .errors import CommerceError
from .source_import import SourceBundle

TYPE_ORDER = {"payment": 0, "delivery": 1, "refund": 2}
TARGET_TYPE = {"payment": "order", "delivery": "order", "refund": "payment"}

ORIGIN_SOURCE_REF = "SOURCE_REF"
ORIGIN_MANUAL = "MANUAL"
ORIGIN_META = "META_SUGGESTED"


@dataclass(frozen=True)
class Candidate:
    record_key: str
    target_id: str
    origin: str
    reason: str | None = None
    evidence: str | None = None
    provider: str | None = None
    model: str | None = None
    server_call_id: str | None = None


def record_key(record_type: str, record_id: str) -> str:
    return f"{record_type}:{record_id}"


def parse_record_key(key: Any) -> tuple[str, str] | None:
    if not isinstance(key, str) or key.count(":") != 1:
        return None
    record_type, record_id = key.split(":")
    if record_type not in TYPE_ORDER or not record_id:
        return None
    return record_type, record_id


def sort_key(entry: Candidate) -> tuple[int, str, str, str]:
    parsed = parse_record_key(entry.record_key)
    assert parsed is not None
    record_type, record_id = parsed
    return (TYPE_ORDER[record_type], record_id, entry.target_id, entry.origin)


def sort_catalog(entries: list[Candidate]) -> list[Candidate]:
    return sorted(entries, key=sort_key)


def entry_digest_dict(entry: Candidate) -> dict[str, Any]:
    if entry.origin == ORIGIN_SOURCE_REF:
        return {
            "record_key": entry.record_key,
            "target_id": entry.target_id,
            "origin": entry.origin,
        }
    if entry.origin == ORIGIN_MANUAL:
        assert entry.reason is not None
        return {
            "record_key": entry.record_key,
            "target_id": entry.target_id,
            "origin": entry.origin,
            "reason": entry.reason,
        }
    assert entry.origin == ORIGIN_META
    assert entry.evidence is not None
    assert entry.provider is not None
    assert entry.model is not None
    assert entry.server_call_id is not None
    return {
        "record_key": entry.record_key,
        "target_id": entry.target_id,
        "origin": entry.origin,
        "evidence": entry.evidence,
        "provider": entry.provider,
        "model": entry.model,
        "server_call_id": entry.server_call_id,
    }


def catalog_sha256(entries: list[Candidate]) -> str:
    payload = [entry_digest_dict(entry) for entry in sort_catalog(list(entries))]
    return canonical.domain_digest(canonical.DOMAIN_CANDIDATES, payload)


def catalog_payload(entries: list[Candidate]) -> list[dict[str, Any]]:
    return [entry_digest_dict(entry) for entry in sort_catalog(list(entries))]


def build_source_candidates(bundle: SourceBundle) -> list[Candidate]:
    """Exactly one deterministic candidate per nonempty source reference."""
    entries: list[Candidate] = []
    for row in bundle.payments:
        if row.order_ref:
            entries.append(Candidate(f"payment:{row.payment_id}", row.order_ref, ORIGIN_SOURCE_REF))
    for row in bundle.deliveries:
        if row.order_ref:
            entries.append(Candidate(f"delivery:{row.delivery_id}", row.order_ref, ORIGIN_SOURCE_REF))
    for row in bundle.refunds:
        if row.payment_ref:
            entries.append(Candidate(f"refund:{row.refund_id}", row.payment_ref, ORIGIN_SOURCE_REF))
    return sort_catalog(entries)


def deterministic_wire(entries: list[Candidate]) -> list[dict[str, Any]]:
    return [
        {
            "record_key": entry.record_key,
            "target_id": entry.target_id,
            "origin": entry.origin,
            "authorised": False,
        }
        for entry in sort_catalog(list(entries))
    ]


def check_edge_guard(
    bundle: SourceBundle, record_type: str, record_id: str, target_id: str
) -> None:
    """Raise when a proposed edge violates typed amount/currency guards."""
    if record_type == "payment":
        payment = next(row for row in bundle.payments if row.payment_id == record_id)
        order = next(row for row in bundle.orders if row.order_id == target_id)
        if payment.currency != order.currency:
            raise CommerceError(
                "CURRENCY_MISMATCH",
                "Candidate links records with different currencies.",
                "manual_candidates",
                {},
                422,
            )
        if payment.amount_cents > order.total_cents:
            raise CommerceError(
                "MALFORMED_CANDIDATE",
                "Candidate payment amount exceeds the order total.",
                "manual_candidates",
                {},
                422,
            )
    elif record_type == "refund":
        refund = next(row for row in bundle.refunds if row.refund_id == record_id)
        payment = next(row for row in bundle.payments if row.payment_id == target_id)
        if refund.amount_cents > payment.amount_cents:
            raise CommerceError(
                "MALFORMED_CANDIDATE",
                "Candidate refund amount exceeds the payment amount.",
                "manual_candidates",
                {},
                422,
            )


def distinct_targets(entries: list[Candidate]) -> dict[str, list[str]]:
    """Selectable targets per record key: one entry per pair, sorted."""
    grouped: dict[str, set[str]] = {}
    for entry in entries:
        grouped.setdefault(entry.record_key, set()).add(entry.target_id)
    return {key: sorted(targets) for key, targets in grouped.items()}
