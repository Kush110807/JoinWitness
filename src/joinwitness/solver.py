"""JW-T05 CP-SAT reversal model, NOT a standalone independent witness checker.

Authority is T02/T03 input, review and frozen baseline. The search does not
import or call the T04 independent exhaustive oracle. T06 must check every
witness before upgrading any outcome into a user-facing verified proof.
"""

import argparse
import importlib.metadata
import json
import math
from pathlib import Path
from typing import Literal

from pydantic import Field, StrictStr

from .baseline import ReferenceCounts, ReferenceDraft, ReferenceMatching, freeze_reference, validate_reference
from .contracts import FrozenSchema, InputBundle
from .ingest import load_pair
from .policy import ReviewDraft, ReviewSnapshot, allowed_choices, freeze_review, validate_snapshot

SOLVER_VERSION = "jw.solver.v1"
DEFAULT_TIME_LIMIT = 10.0
MAX_TIME_LIMIT = 10.0
DEFAULT_SEED = 11
WORKERS = 1


class SolverResult(FrozenSchema):
    schema_version: Literal["jw.solver.v1"] = SOLVER_VERSION
    status: Literal[
        "SOLVER_OPTIMAL_WITNESS_UNCHECKED",
        "SOLVER_FEASIBLE_WITNESS_UNCHECKED",
        "SOLVER_INFEASIBLE_UNCHECKED",
        "NOT_VERIFIED",
    ]
    solver_status: Literal["OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNKNOWN", "MODEL_INVALID", "ERROR", "NOT_RUN"]
    reason: Literal[
        "COMPLETE_OPTIMIZATION", "FEASIBLE_NO_OPTIMALITY",
        "REVERSE_MODEL_INFEASIBLE", "TIMEOUT_OR_UNKNOWN", "MODEL_INVALID",
        "SOLVER_ERROR", "DEPENDENCY_MISSING", "INTERNAL_WITNESS_MISMATCH",
    ]
    review_sha256: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")
    reference_sha256: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")
    coverage: Literal["UNREVIEWED", "REVIEWED_PARTIAL", "REVIEWED_CLOSED_SCOPE"]
    baseline_counts: ReferenceCounts
    alternative_counts: ReferenceCounts | None = None
    alternative_assignments: tuple[tuple[str, str | None], ...] | None = None
    # Found witness distance is an upper bound until solver reports OPTIMAL;
    # even at OPTIMAL it is solver-attributed, with independent T06 check pending.
    witness_changed_assignments: int | None = Field(default=None, ge=1)
    solver_proved_optimal: bool = False
    solver_proved_infeasible: bool = False
    independent_checker_status: Literal["NOT_RUN_T06"] = "NOT_RUN_T06"
    time_limit_seconds: float = Field(gt=0, le=MAX_TIME_LIMIT)
    random_seed: int = Field(ge=0, le=2_147_483_647)
    workers: Literal[1] = WORKERS
    ortools_version: StrictStr
    scope_caveat: StrictStr


def _valid_options(time_limit_seconds: float, random_seed: int) -> tuple[float, int]:
    if isinstance(time_limit_seconds, bool) or not isinstance(time_limit_seconds, (int, float)):
        raise ValueError("time limit must be numeric")
    if not math.isfinite(time_limit_seconds) or not 0 < time_limit_seconds <= MAX_TIME_LIMIT:
        raise ValueError("T05 time limit outside permitted range")
    if isinstance(random_seed, bool) or not isinstance(random_seed, int) or not 0 <= random_seed <= 2_147_483_647:
        raise ValueError("invalid random seed")
    return float(time_limit_seconds), random_seed


def solve_reversal(
    bundle: InputBundle,
    snapshot: ReviewSnapshot,
    reference: ReferenceMatching,
    *,
    time_limit_seconds: float = DEFAULT_TIME_LIMIT,
    random_seed: int = DEFAULT_SEED,
) -> SolverResult:
    """Find minimum Hamming distance reversal *under explicit reviewed permissions*.

    Not a public certificate: a separate T06 checker must verify the witness,
    and T04 independently checks exact minimum/nonexistence on small problems.
    No global identity truth or completeness claim follows from a result.
    """
    time_limit_seconds, random_seed = _valid_options(time_limit_seconds, random_seed)
    validate_snapshot(bundle, snapshot)
    baseline = validate_reference(bundle, snapshot, reference)
    allowed = allowed_choices(bundle, snapshot)
    row_ids = tuple(sorted(allowed))
    baseline_map = {item.attendance_id: item.registration_id for item in reference.assignments}
    groups = {item.registration_id: item.group for item in bundle.registrations}
    try:
        from ortools.sat.python import cp_model
        ortools_version = importlib.metadata.version("ortools")
    except (ImportError, importlib.metadata.PackageNotFoundError):
        cp_model = None
        ortools_version = "UNAVAILABLE"

    note = (
        "Solver findings are conditional on explicit reviewed edges, unmatched permissions, "
        "the frozen reference and fixed A>B predicate. No independent T06 witness "
        "check has run. No claim of true identity or complete real-world candidates."
    )
    common = dict(
        review_sha256=snapshot.snapshot_sha256,
        reference_sha256=reference.reference_sha256,
        coverage=snapshot.coverage,
        baseline_counts=baseline,
        time_limit_seconds=time_limit_seconds,
        random_seed=random_seed,
        ortools_version=ortools_version,
        scope_caveat=note,
    )
    if cp_model is None:
        return SolverResult(status="NOT_VERIFIED", solver_status="NOT_RUN", reason="DEPENDENCY_MISSING", **common)

    model = cp_model.CpModel()
    # Independent binary choice per row, including None only where explicitly allowed.
    x = {(i, j): model.new_bool_var(f"x_{k}_{v}")
         for k, i in enumerate(row_ids)
         for v, j in enumerate(allowed[i])}
    for i in row_ids:
        model.add(sum(x[i, j] for j in allowed[i]) == 1)
    for j in sorted(groups):
        claiming = [x[i, j] for i in row_ids if (i, j) in x]
        if claiming:
            model.add(sum(claiming) <= 1)

    a = sum(x[i, j] for i in row_ids for j in allowed[i] if j is not None and groups[j] == "A")
    b = sum(x[i, j] for i in row_ids for j in allowed[i] if j is not None and groups[j] == "B")
    if baseline.a_greater_than_b:
        model.add(a - b <= 0)  # tie is false
    else:
        model.add(a - b >= 1)  # only strict A > B reverses false
    changed = sum(1 - x[i, baseline_map[i]] for i in row_ids)
    model.minimize(changed)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_seconds
    solver.parameters.num_search_workers = WORKERS
    solver.parameters.random_seed = random_seed
    # No approximation/gap acceptance as a minimum certificate.
    solver.parameters.absolute_gap_limit = 0.0
    solver.parameters.relative_gap_limit = 0.0
    try:
        raw_status = solver.solve(model)
        status_name = solver.status_name(raw_status).upper()
    except Exception:
        return SolverResult(status="NOT_VERIFIED", solver_status="ERROR", reason="SOLVER_ERROR", **common)
    if status_name == "INFEASIBLE":
        return SolverResult(status="SOLVER_INFEASIBLE_UNCHECKED", solver_status="INFEASIBLE",
                            reason="REVERSE_MODEL_INFEASIBLE", solver_proved_infeasible=True, **common)
    if status_name in {"UNKNOWN", "MODEL_INVALID"}:
        return SolverResult(status="NOT_VERIFIED", solver_status=status_name,
                            reason="MODEL_INVALID" if status_name == "MODEL_INVALID" else "TIMEOUT_OR_UNKNOWN", **common)
    if status_name not in {"OPTIMAL", "FEASIBLE"}:
        return SolverResult(status="NOT_VERIFIED", solver_status="ERROR", reason="SOLVER_ERROR", **common)

    try:
        assignments: tuple[tuple[str, str | None], ...] = tuple(
            (i, next(j for j in allowed[i] if solver.value(x[i, j]) == 1)) for i in row_ids
        )
        # Redundant T05 internal sanity check; NOT the T06 independent checker.
        registrations = [j for _, j in assignments if j is not None]
        if len(registrations) != len(set(registrations)):
            raise ValueError("one-to-one violated")
        if any(j not in allowed[i] for i, j in assignments):
            raise ValueError("permission violated")
        ca = sum(groups[j] == "A" for j in registrations)
        cb = sum(groups[j] == "B" for j in registrations)
        counts = ReferenceCounts(a=ca, b=cb, unmatched=len(row_ids) - len(registrations),
                                 a_greater_than_b=ca > cb)
        distance = sum(j != baseline_map[i] for i, j in assignments)
        if counts.a_greater_than_b == baseline.a_greater_than_b or distance <= 0:
            raise ValueError("no reversal")
        if abs(float(solver.objective_value) - distance) > 1e-6:
            raise ValueError("reported objective differs from witness distance")
    except Exception:
        return SolverResult(status="NOT_VERIFIED", solver_status="ERROR",
                            reason="INTERNAL_WITNESS_MISMATCH", **common)
    optimal = status_name == "OPTIMAL"
    return SolverResult(
        status="SOLVER_OPTIMAL_WITNESS_UNCHECKED" if optimal else "SOLVER_FEASIBLE_WITNESS_UNCHECKED",
        solver_status=status_name,
        reason="COMPLETE_OPTIMIZATION" if optimal else "FEASIBLE_NO_OPTIMALITY",
        alternative_counts=counts,
        alternative_assignments=assignments,
        witness_changed_assignments=distance,
        solver_proved_optimal=optimal,
        **common,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="T05 solver status (T06 checker not yet run; offline)")
    parser.add_argument("--registrations", type=Path, required=True)
    parser.add_argument("--attendance", type=Path, required=True)
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--time-limit", type=float, default=DEFAULT_TIME_LIMIT)
    args = parser.parse_args()
    try:
        bundle = load_pair(args.registrations, args.attendance)
        snapshot = freeze_review(bundle, ReviewDraft.model_validate_json(args.policy.read_bytes()))
        reference, _ = freeze_reference(bundle, snapshot,
                                        ReferenceDraft.model_validate_json(args.reference.read_bytes()))
        result = solve_reversal(bundle, snapshot, reference, time_limit_seconds=args.time_limit)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"T05 rejected invalid source/policy/reference: {type(exc).__name__}\n")
    print(json.dumps(result.model_dump(mode="json"), indent=2, sort_keys=True))
    return 3 if result.status == "NOT_VERIFIED" else 0


if __name__ == "__main__":
    raise SystemExit(main())
