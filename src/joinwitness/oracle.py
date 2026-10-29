"""JW-T04: small, deterministic *exhaustive* matching-universe oracle.

This oracle has its own search and count implementation. In particular it does
not import the T03 permitted-choice generator, baseline counting helper, or any
CP-SAT/optimizer code. T03 validators are used only as authority/freshness gates.
No standalone independent witness checker or replay receipt exists yet (T06).
"""

import argparse
import json
from math import prod
from pathlib import Path
from typing import Literal

from pydantic import Field, StrictStr

from .baseline import ReferenceCounts, ReferenceDraft, ReferenceMatching, freeze_reference, validate_reference
from .contracts import FrozenSchema, InputBundle
from .ingest import load_pair
from .policy import ReviewDraft, ReviewSnapshot, freeze_review, validate_snapshot

ORACLE_VERSION = "jw.oracle.v1"
MAX_ORACLE_ROWS = 12
MAX_ORACLE_COMBINATIONS = 250_000


class OracleResult(FrozenSchema):
    schema_version: Literal["jw.oracle.v1"] = ORACLE_VERSION
    status: Literal["ORACLE_REVERSIBLE", "ORACLE_STABLE", "NOT_VERIFIED"]
    reason: Literal["COMPLETE_ENUMERATION", "ROW_LIMIT", "COMBINATION_LIMIT"]
    reference_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    review_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    coverage: Literal["UNREVIEWED", "REVIEWED_PARTIAL", "REVIEWED_CLOSED_SCOPE"]
    baseline_counts: ReferenceCounts
    combination_upper_bound: int = Field(ge=0)
    enumerated_feasible_assignments: int = Field(ge=0)
    minimum_changed_assignments: int | None = Field(default=None, ge=1)
    alternative_counts: ReferenceCounts | None = None
    alternative_assignments: tuple[tuple[str, str | None], ...] | None = None
    independent_checker_status: Literal["NOT_RUN_T06"] = "NOT_RUN_T06"
    solver_status: Literal["NOT_RUN_T05"] = "NOT_RUN_T05"
    scope_caveat: StrictStr


def _counts(assignment: tuple[str | None, ...], groups: dict[str, str]) -> ReferenceCounts:
    # Independent implementation: do not call baseline._check_choices.
    a = sum(reg is not None and groups[reg] == "A" for reg in assignment)
    b = sum(reg is not None and groups[reg] == "B" for reg in assignment)
    return ReferenceCounts(a=a, b=b, unmatched=len(assignment) - a - b, a_greater_than_b=a > b)


def enumerate_oracle(
    bundle: InputBundle, snapshot: ReviewSnapshot, reference: ReferenceMatching,
    *, max_rows: int = MAX_ORACLE_ROWS, max_combinations: int = MAX_ORACLE_COMBINATIONS,
) -> OracleResult:
    """Fully explore a bounded candidate universe, or explicitly refuse proof.

    Refusals have no witness/minimum and cannot be advertised as stable. Cardinality
    bound is evaluated before traversal; no hidden truncation or timeout->stable.
    """
    if not isinstance(max_rows, int) or isinstance(max_rows, bool) or not 1 <= max_rows <= MAX_ORACLE_ROWS:
        raise ValueError("Invalid oracle row bound")
    if (not isinstance(max_combinations, int) or isinstance(max_combinations, bool)
            or not 1 <= max_combinations <= MAX_ORACLE_COMBINATIONS):
        raise ValueError("Invalid oracle combination bound")
    validate_snapshot(bundle, snapshot)
    baseline_counts = validate_reference(bundle, snapshot, reference)
    rows = tuple(sorted((item.attendance_id for item in bundle.attendance)))
    baseline_map = {a.attendance_id: a.registration_id for a in reference.assignments}
    groups = {r.registration_id: r.group for r in bundle.registrations}

    # Independently interpret the *recorded* human review operations.
    by_row: dict[str, list[tuple[str, str]]] = {rid: [] for rid in rows}
    unmatched_rules: dict[str, str] = {}
    for edge in snapshot.edges:
        by_row[edge.attendance_id].append((edge.registration_id, edge.status))
    for rule in snapshot.unmatched:
        unmatched_rules[rule.attendance_id] = rule.status
    options: list[tuple[str | None, ...]] = []
    for rid in rows:
        confirmed = [reg for reg, status in by_row[rid] if status == "CONFIRMED"]
        if confirmed:
            opts: tuple[str | None, ...] = (confirmed[0],)
        elif unmatched_rules[rid] == "REQUIRED":
            opts = (None,)
        else:
            possible = sorted(reg for reg, status in by_row[rid] if status == "POSSIBLE")
            opts = tuple(possible) + ((None,) if unmatched_rules[rid] == "ALLOWED" else ())
        if not opts:
            raise ValueError("Validated snapshot unexpectedly produced no choices")
        options.append(opts)

    bound = prod(len(o) for o in options)
    note = ("Result applies only to explicitly reviewed candidate edges, unmatched rules, "
            "the supplied baseline and fixed A>B question; it does not prove real identities "
            "or completeness of external candidates.")
    common = dict(
        review_sha256=snapshot.snapshot_sha256,
        reference_sha256=reference.reference_sha256,
        coverage=snapshot.coverage,
        baseline_counts=baseline_counts,
        combination_upper_bound=bound,
        scope_caveat=note,
    )
    if len(rows) > max_rows or bound > max_combinations:
        return OracleResult(
            status="NOT_VERIFIED",
            reason="ROW_LIMIT" if len(rows) > max_rows else "COMBINATION_LIMIT",
            enumerated_feasible_assignments=0,
            **common,
        )

    best_distance: int | None = None
    best_values: tuple[str | None, ...] | None = None
    best_counts: ReferenceCounts | None = None
    valid_count = 0
    assigned: list[str | None] = []
    occupied: set[str] = set()

    def visit(index: int) -> None:
        nonlocal valid_count, best_distance, best_values, best_counts
        if index == len(rows):
            valid_count += 1
            values = tuple(assigned)
            counts = _counts(values, groups)
            if counts.a_greater_than_b != baseline_counts.a_greater_than_b:
                distance = sum(value != baseline_map[rid] for rid, value in zip(rows, values))
                if distance > 0 and (best_distance is None or distance < best_distance):
                    best_distance, best_values, best_counts = distance, values, counts
            return
        for choice in options[index]:
            if choice is not None and choice in occupied:
                continue
            if choice is not None:
                occupied.add(choice)
            assigned.append(choice)
            visit(index + 1)
            assigned.pop()
            if choice is not None:
                occupied.remove(choice)

    visit(0)
    # Complete valid baseline exists by validation, so at least one feasible leaf.
    if valid_count == 0:
        raise RuntimeError("Oracle internal invariant: no valid assignment")
    if best_distance is None:
        return OracleResult(
            status="ORACLE_STABLE", reason="COMPLETE_ENUMERATION",
            enumerated_feasible_assignments=valid_count, **common,
        )
    assert best_values is not None and best_counts is not None
    return OracleResult(
        status="ORACLE_REVERSIBLE", reason="COMPLETE_ENUMERATION",
        enumerated_feasible_assignments=valid_count,
        minimum_changed_assignments=best_distance,
        alternative_counts=best_counts,
        alternative_assignments=tuple(zip(rows, best_values)),
        **common,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Independent bounded exhaustive oracle (offline)")
    parser.add_argument("--registrations", required=True, type=Path)
    parser.add_argument("--attendance", required=True, type=Path)
    parser.add_argument("--policy", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    args = parser.parse_args()
    try:
        bundle = load_pair(args.registrations, args.attendance)
        snapshot = freeze_review(bundle, ReviewDraft.model_validate_json(args.policy.read_bytes()))
        reference, _ = freeze_reference(bundle, snapshot, ReferenceDraft.model_validate_json(args.reference.read_bytes()))
        result = enumerate_oracle(bundle, snapshot, reference)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"Oracle input validation failed: {type(exc).__name__}\n")
    print(json.dumps(result.model_dump(mode="json"), indent=2, sort_keys=True))
    return 3 if result.status == "NOT_VERIFIED" else 0


if __name__ == "__main__":
    raise SystemExit(main())
