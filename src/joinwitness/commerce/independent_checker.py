"""Independent verification by complete recomputation (contract section 4).

This module deliberately reimplements enumeration, collision filtering and
clean scoring from scratch: it never imports the search module or reuses its
world-scoring or filtering routines. It recomputes every authorised world,
the baseline, the reversal witness, the minimum distance with tie-break, the
digest bindings and full coverage, then compares all of them to the claim.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable

from . import canonical


@dataclass
class CheckerClaim:
    raw_total: int
    invalid_total: int
    admissible_total: int
    baseline_count: int
    witness_mapping: dict[str, str | None] | None
    witness_count: int | None
    witness_distance: int | None
    catalog_sha256: str
    policy_sha256: str
    baseline_sha256: str
    review_sha256: str


@dataclass
class CheckerVerdict:
    passed: bool
    worlds_checked: int
    mismatch: str | None
    recomputed_raw_total: int
    recomputed_invalid_total: int | None
    recomputed_admissible_total: int | None


def _ordered_keys(bundle: Any) -> list[str]:
    payments = sorted(f"payment:{row.payment_id}" for row in bundle.payments)
    deliveries = sorted(f"delivery:{row.delivery_id}" for row in bundle.deliveries)
    refunds = sorted(f"refund:{row.refund_id}" for row in bundle.refunds)
    return payments + deliveries + refunds


def _odometer_worlds(keys: list[str], options: dict[str, list[str | None]]):
    """Iterative odometer enumeration over per-key choice lists."""
    pools = [options[key] for key in keys]
    sizes = [len(pool) for pool in pools]
    total = 1
    for size in sizes:
        total *= size
    for serial in range(total):
        world: dict[str, str | None] = {}
        remainder = serial
        for position in range(len(keys) - 1, -1, -1):
            pool = pools[position]
            world[keys[position]] = pool[remainder % sizes[position]]
            remainder //= sizes[position]
        yield world


def _world_is_clean_for_order(bundle: Any, mapping: dict[str, str | None], order_id: str) -> bool:
    order = next(row for row in bundle.orders if row.order_id == order_id)
    full_settled = 0
    for row in bundle.payments:
        if mapping.get(f"payment:{row.payment_id}") != order_id:
            continue
        if row.status == "SETTLED" and row.currency == order.currency and row.amount_cents == order.total_cents:
            full_settled += 1
    if full_settled != 1:
        return False
    delivered = 0
    for row in bundle.deliveries:
        if mapping.get(f"delivery:{row.delivery_id}") == order_id and row.status == "DELIVERED":
            delivered += 1
    if delivered != 1:
        return False
    for row in bundle.refunds:
        if row.status != "COMPLETED":
            continue
        linked = mapping.get(f"refund:{row.refund_id}")
        if linked is None:
            continue
        owner = next(
            (
                prow.payment_id
                for prow in bundle.payments
                if prow.payment_id == linked
                and mapping.get(f"payment:{prow.payment_id}") == order_id
            ),
            None,
        )
        if owner is not None:
            return False
    return True


def _world_clean_total(bundle: Any, mapping: dict[str, str | None]) -> int:
    return sum(
        1 for row in bundle.orders if _world_is_clean_for_order(bundle, mapping, row.order_id)
    )


def _world_is_admissible(bundle: Any, mapping: dict[str, str | None]) -> bool:
    seen_settled: dict[str, int] = {}
    for row in bundle.payments:
        target = mapping.get(f"payment:{row.payment_id}")
        if row.status == "SETTLED" and target is not None:
            seen_settled[target] = seen_settled.get(target, 0) + 1
            if seen_settled[target] > 1:
                return False
    seen_delivered: dict[str, int] = {}
    for row in bundle.deliveries:
        target = mapping.get(f"delivery:{row.delivery_id}")
        if row.status == "DELIVERED" and target is not None:
            seen_delivered[target] = seen_delivered.get(target, 0) + 1
            if seen_delivered[target] > 1:
                return False
    seen_refunds: dict[str, int] = {}
    for row in bundle.refunds:
        target = mapping.get(f"refund:{row.refund_id}")
        if row.status == "COMPLETED" and target is not None:
            seen_refunds[target] = seen_refunds.get(target, 0) + 1
            if seen_refunds[target] > 1:
                return False
    return True


def _changed_records(baseline: dict[str, str | None], mapping: dict[str, str | None]) -> int:
    return sum(1 for key, value in mapping.items() if baseline.get(key) != value)


def _tuple_key(mapping: dict[str, str | None], keys: list[str]) -> tuple:
    parts: list[tuple] = []
    for key in keys:
        value = mapping.get(key)
        parts.append((0,) if value is None else (1, value))
    return tuple(parts)


def verify(
    bundle: Any,
    policy_payload: dict[str, Any],
    baseline_mapping: dict[str, str | None],
    threshold_k: int,
    claim: CheckerClaim,
    deadline_mono: float | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> CheckerVerdict:
    """Recompute everything independently and compare to the search claim."""
    catalog = policy_payload["candidate_catalog"]
    if canonical.domain_digest(canonical.DOMAIN_CANDIDATES, catalog) != claim.catalog_sha256:
        return CheckerVerdict(False, 0, "CATALOG_DIGEST", 0, None, None)
    if canonical.domain_digest(canonical.DOMAIN_CANDIDATES, catalog) != policy_payload.get(
        "candidate_catalog_sha256"
    ):
        return CheckerVerdict(False, 0, "CATALOG_DIGEST", 0, None, None)
    if canonical.domain_digest(canonical.DOMAIN_POLICY, policy_payload) != claim.policy_sha256:
        return CheckerVerdict(False, 0, "POLICY_DIGEST", 0, None, None)
    base_payload = {"policy_sha256": claim.policy_sha256, "reference_mapping": dict(baseline_mapping)}
    if canonical.domain_digest(canonical.DOMAIN_BASELINE, base_payload) != claim.baseline_sha256:
        return CheckerVerdict(False, 0, "BASELINE_DIGEST", 0, None, None)
    review_payload = {"policy_sha256": claim.policy_sha256, "baseline_sha256": claim.baseline_sha256}
    if canonical.domain_digest(canonical.DOMAIN_REVIEW, review_payload) != claim.review_sha256:
        return CheckerVerdict(False, 0, "REVIEW_DIGEST", 0, None, None)

    keys = _ordered_keys(bundle)
    options: dict[str, list[str | None]] = {}
    for row in policy_payload["rows"]:
        key = f"{row['record_type']}:{row['record_id']}"
        choices = [
            edge["target_id"]
            for edge in row["edges"]
            if edge["disposition"] in ("CONFIRMED", "POSSIBLE")
        ]
        choices.sort()
        if row["unmatched"] in ("CONFIRMED", "POSSIBLE"):
            choices = [None] + choices
        options[key] = choices
    raw_total = 1
    for key in keys:
        raw_total *= len(options[key])
    if raw_total != claim.raw_total:
        return CheckerVerdict(False, 0, "RAW_TOTAL", raw_total, None, None)

    base_count = _world_clean_total(bundle, dict(baseline_mapping))
    if base_count != claim.baseline_count:
        return CheckerVerdict(False, 0, "BASELINE_COUNT", raw_total, None, None)
    base_decision = base_count >= threshold_k

    invalid_total = 0
    admissible_total = 0
    checked = 0
    best: dict[str, str | None] | None = None
    best_count: int | None = None
    best_distance: int | None = None
    best_tuple: tuple | None = None
    for world in _odometer_worlds(keys, options):
        if deadline_mono is not None and clock() > deadline_mono:
            return CheckerVerdict(False, checked, "TIMEOUT", raw_total, None, None)
        if not _world_is_admissible(bundle, world):
            invalid_total += 1
            continue
        admissible_total += 1
        checked += 1
        count = _world_clean_total(bundle, world)
        if (count >= threshold_k) == base_decision:
            continue
        distance = _changed_records(dict(baseline_mapping), world)
        order = _tuple_key(world, keys)
        if (
            best is None
            or distance < best_distance  # type: ignore[operator]
            or (distance == best_distance and best_tuple is not None and order < best_tuple)
        ):
            best = dict(world)
            best_count = count
            best_distance = distance
            best_tuple = order

    if invalid_total != claim.invalid_total or admissible_total != claim.admissible_total:
        return CheckerVerdict(
            False, checked, "COVERAGE", raw_total, invalid_total, admissible_total
        )
    if (best is None) != (claim.witness_mapping is None):
        return CheckerVerdict(
            False, checked, "WITNESS_PRESENCE", raw_total, invalid_total, admissible_total
        )
    if best is not None:
        assert claim.witness_mapping is not None
        if (
            best != claim.witness_mapping
            or best_count != claim.witness_count
            or best_distance != claim.witness_distance
        ):
            return CheckerVerdict(
                False, checked, "WITNESS", raw_total, invalid_total, admissible_total
            )
    return CheckerVerdict(True, checked, None, raw_total, invalid_total, admissible_total)
