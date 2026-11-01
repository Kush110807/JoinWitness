"""Deterministic exhaustive world search (contract section 4).

Enumerates the full authorised Cartesian product before filtering, rejects
caps before starting, classifies every world, scores clean fulfilment in
integer cents and selects the minimum-distance reversal with a deterministic
lexicographic tie-break. The independent checker reimplements all of this
separately and this module is never imported by it.
"""
from __future__ import annotations

import itertools
import time
from dataclasses import dataclass
from typing import Any, Callable

from .source_import import SourceBundle


@dataclass
class SearchOutcome:
    raw_total: int
    raw_checked: int
    invalid_checked: int
    admissible_checked: int
    invalid_total: int | None
    admissible_total: int | None
    fully_enumerated: bool
    timed_out: bool
    baseline_count: int | None
    witness_mapping: dict[str, str | None] | None
    witness_count: int | None
    witness_distance: int | None


def row_keys_in_order(bundle: SourceBundle) -> list[str]:
    keys = [f"payment:{row.payment_id}" for row in bundle.payments]
    keys += [f"delivery:{row.delivery_id}" for row in bundle.deliveries]
    keys += [f"refund:{row.refund_id}" for row in bundle.refunds]
    return sorted(keys, key=_row_sort_key)


def _row_sort_key(key: str) -> tuple[int, str]:
    kind, ident = key.split(":")
    return ({"payment": 0, "delivery": 1, "refund": 2}[kind], ident)


def raw_product(keys: list[str], options: dict[str, tuple[str | None, ...]]) -> int:
    total = 1
    for key in keys:
        total *= len(options[key])
    return total


def enumerate_raw_worlds(
    keys: list[str], options: dict[str, tuple[str | None, ...]]
) -> Any:
    pools = [options[key] for key in keys]
    for combo in itertools.product(*pools):
        yield dict(zip(keys, combo))


def classify_world(bundle: SourceBundle, mapping: dict[str, str | None]) -> tuple[bool, str]:
    """Admissibility via hard per-world collision bans. Never aggregates."""
    settled_per_order: dict[str, int] = {}
    for row in bundle.payments:
        if row.status != "SETTLED":
            continue
        target = mapping.get(f"payment:{row.payment_id}")
        if target is None:
            continue
        settled_per_order[target] = settled_per_order.get(target, 0) + 1
        if settled_per_order[target] > 1:
            return False, "DUPLICATE_SETTLED_PAYMENT"
    delivered_per_order: dict[str, int] = {}
    for row in bundle.deliveries:
        if row.status != "DELIVERED":
            continue
        target = mapping.get(f"delivery:{row.delivery_id}")
        if target is None:
            continue
        delivered_per_order[target] = delivered_per_order.get(target, 0) + 1
        if delivered_per_order[target] > 1:
            return False, "DUPLICATE_DELIVERED_DELIVERY"
    completed_per_payment: dict[str, int] = {}
    for row in bundle.refunds:
        if row.status != "COMPLETED":
            continue
        target = mapping.get(f"refund:{row.refund_id}")
        if target is None:
            continue
        completed_per_payment[target] = completed_per_payment.get(target, 0) + 1
        if completed_per_payment[target] > 1:
            return False, "DUPLICATE_COMPLETED_REFUND"
    return True, ""


def clean_fulfilled_count(bundle: SourceBundle, mapping: dict[str, str | None]) -> int:
    """Narrow clean predicate: full settled + delivered + no completed refund."""
    payments_by_order: dict[str, list[str]] = {}
    for row in bundle.payments:
        target = mapping.get(f"payment:{row.payment_id}")
        if target is not None:
            payments_by_order.setdefault(target, []).append(row.payment_id)
    qualifying_payment: dict[str, str | None] = {}
    for row in bundle.orders:
        matches = [
            pid
            for pid in payments_by_order.get(row.order_id, [])
            if _payment_by_id(bundle, pid).status == "SETTLED"
            and _payment_by_id(bundle, pid).currency == row.currency
            and _payment_by_id(bundle, pid).amount_cents == row.total_cents
        ]
        qualifying_payment[row.order_id] = matches[0] if len(matches) == 1 else None
    qualifying_delivery: dict[str, bool] = {}
    for row in bundle.orders:
        matches = [
            drow.delivery_id
            for drow in bundle.deliveries
            if mapping.get(f"delivery:{drow.delivery_id}") == row.order_id
            and drow.status == "DELIVERED"
        ]
        qualifying_delivery[row.order_id] = len(matches) == 1
    clean = 0
    for row in bundle.orders:
        if qualifying_payment[row.order_id] is None or not qualifying_delivery[row.order_id]:
            continue
        assigned = set(payments_by_order.get(row.order_id, []))
        blocked = any(
            rrow.status == "COMPLETED"
            and mapping.get(f"refund:{rrow.refund_id}") in assigned
            for rrow in bundle.refunds
        )
        if not blocked:
            clean += 1
    return clean


def _payment_by_id(bundle: SourceBundle, payment_id: str):
    for row in bundle.payments:
        if row.payment_id == payment_id:
            return row
    raise KeyError(payment_id)


def link_distance(
    baseline: dict[str, str | None], mapping: dict[str, str | None], keys: list[str]
) -> int:
    return sum(1 for key in keys if mapping.get(key) != baseline.get(key))


def witness_sort_key(mapping: dict[str, str | None], keys: list[str]) -> tuple:
    return tuple((0,) if mapping.get(key) is None else (1, mapping.get(key)) for key in keys)


def run_search(
    bundle: SourceBundle,
    keys: list[str],
    options: dict[str, tuple[str | None, ...]],
    baseline: dict[str, str | None],
    threshold_k: int,
    budget_ms: int,
    clock: Callable[[], float] = time.monotonic,
) -> SearchOutcome:
    total = raw_product(keys, options)
    start = clock()
    base_count = clean_fulfilled_count(bundle, baseline)
    base_decision = base_count >= threshold_k
    raw_checked = 0
    invalid_checked = 0
    admissible_checked = 0
    best_mapping: dict[str, str | None] | None = None
    best_count: int | None = None
    best_distance: int | None = None
    best_key: tuple | None = None
    timed_out = False
    for mapping in enumerate_raw_worlds(keys, options):
        if (clock() - start) * 1000 > budget_ms:
            timed_out = True
            break
        raw_checked += 1
        admissible, _ = classify_world(bundle, mapping)
        if not admissible:
            invalid_checked += 1
            continue
        admissible_checked += 1
        count = clean_fulfilled_count(bundle, mapping)
        if (count >= threshold_k) == base_decision:
            continue
        distance = link_distance(baseline, mapping, keys)
        sort_key = witness_sort_key(mapping, keys)
        if (
            best_distance is None
            or distance < best_distance
            or (distance == best_distance and best_key is not None and sort_key < best_key)
        ):
            best_mapping = dict(mapping)
            best_count = count
            best_distance = distance
            best_key = sort_key
    if timed_out:
        return SearchOutcome(
            raw_total=total,
            raw_checked=raw_checked,
            invalid_checked=invalid_checked,
            admissible_checked=admissible_checked,
            invalid_total=None,
            admissible_total=None,
            fully_enumerated=False,
            timed_out=True,
            baseline_count=None,
            witness_mapping=None,
            witness_count=None,
            witness_distance=None,
        )
    return SearchOutcome(
        raw_total=total,
        raw_checked=raw_checked,
        invalid_checked=invalid_checked,
        admissible_checked=admissible_checked,
        invalid_total=invalid_checked,
        admissible_total=admissible_checked,
        fully_enumerated=True,
        timed_out=False,
        baseline_count=base_count,
        witness_mapping=best_mapping,
        witness_count=best_count,
        witness_distance=best_distance,
    )
