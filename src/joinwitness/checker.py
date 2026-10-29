"""T06 independent structural witness checker: no solver/oracle imports.

Only the immutable T02/T03 source and reviewed metadata are authoritative.
A valid witness DOES NOT independently prove optimizer optimality or infeasibility.
"""
from typing import Literal

from pydantic import Field, StrictStr

from .baseline import ReferenceCounts, ReferenceMatching, validate_reference
from .contracts import FrozenSchema, InputBundle
from .policy import ReviewSnapshot, validate_snapshot

CHECKER_VERSION = "jw.checker.v1"


class WitnessCheck(FrozenSchema):
    schema_version: Literal["jw.checker.v1"] = CHECKER_VERSION
    status: Literal["WITNESS_VALID", "SCOPED_INFEASIBILITY_SOLVER_ATTRIBUTED", "NOT_VERIFIED"]
    reason: Literal["VALIDATED_WITNESS", "SOLVER_STATUS_ONLY", "SOLVER_NOT_COMPLETE", "REJECTED_CLAIM"]
    review_sha256: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")
    reference_sha256: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")
    recomputed_counts: ReferenceCounts | None = None
    recomputed_changed_assignments: int | None = Field(default=None, ge=1)
    scope_caveat: StrictStr


_NOTE = (
    "Structural checker independently recomputes permissions, one-to-one use, "
    "A/B counts and distance. It does not independently prove solver optimality or "
    "infeasibility; complete oracle enumeration can cross-check small instances. "
    "All conclusions are conditional on the reviewed candidate universe."
)


def _counts(assignments: dict[str, str | None], groups: dict[str, str]) -> ReferenceCounts:
    a = sum(reg is not None and groups[reg] == "A" for reg in assignments.values())
    b = sum(reg is not None and groups[reg] == "B" for reg in assignments.values())
    return ReferenceCounts(a=a, b=b, unmatched=len(assignments)-a-b, a_greater_than_b=a>b)


def _allowed_from_review(snapshot: ReviewSnapshot, attendance: set[str]) -> dict[str, set[str | None]]:
    """Independently reconstruct choices; do NOT call policy.allowed_choices.

    T03 validates the actual policy before this function is entered.
    """
    by_att: dict[str, set[str]] = {i: set() for i in attendance}
    confirmed: dict[str, str] = {}
    for edge in snapshot.edges:
        if edge.status == "CONFIRMED":
            confirmed[edge.attendance_id] = edge.registration_id
        elif edge.status == "POSSIBLE":
            by_att[edge.attendance_id].add(edge.registration_id)
    unmatched = {u.attendance_id: u.status for u in snapshot.unmatched}
    result: dict[str, set[str | None]] = {}
    for i in attendance:
        if i in confirmed:
            result[i] = {confirmed[i]}
        elif unmatched[i] == "REQUIRED":
            result[i] = {None}
        else:
            choices: set[str | None] = set(by_att[i])
            if unmatched[i] == "ALLOWED":
                choices.add(None)
            result[i] = choices
    return result


def _valid_full_assignment(
    values: object, rows: set[str], choices: dict[str, set[str | None]],
) -> dict[str, str | None] | None:
    if not isinstance(values, (tuple, list)) or len(values) != len(rows):
        return None
    mapping: dict[str, str | None] = {}
    occupied: set[str] = set()
    for pair in values:
        if not isinstance(pair, (tuple, list)) or len(pair) != 2:
            return None
        i, j = pair
        if not isinstance(i, str) or i not in rows or i in mapping:
            return None
        if j is not None and not isinstance(j, str):
            return None
        if j not in choices[i]:
            return None
        if j is not None:
            if j in occupied:
                return None
            occupied.add(j)
        mapping[i] = j
    if set(mapping) != rows:
        return None
    return mapping


def check_solver_claim(
    bundle: InputBundle, snapshot: ReviewSnapshot,
    reference: ReferenceMatching, claim: object,
) -> WitnessCheck:
    """Fail closed and recompute, without importing T05 or T04 code.

    ``claim`` is treated as untrusted structured data. A negative or missing
    solver result never becomes a witness. A solver's infeasibility remains a
    solver-attributed claim, NOT a proof independently established by checker.
    """
    validate_snapshot(bundle, snapshot)
    validate_reference(bundle, snapshot, reference)
    common = dict(review_sha256=snapshot.snapshot_sha256,
                  reference_sha256=reference.reference_sha256,
                  scope_caveat=_NOTE)

    def reject() -> WitnessCheck:
        return WitnessCheck(status="NOT_VERIFIED", reason="REJECTED_CLAIM", **common)

    # Duck-typed fields avoid even importing T05's SolverResult class.
    try:
        if (claim.review_sha256 != snapshot.snapshot_sha256 or
            claim.reference_sha256 != reference.reference_sha256 or
            claim.coverage != snapshot.coverage or
            claim.independent_checker_status != "NOT_RUN_T06" or
            claim.schema_version != "jw.solver.v1" or
            claim.baseline_counts is None):
            return reject()
        rows = {a.attendance_id for a in bundle.attendance}
        groups = {r.registration_id: r.group for r in bundle.registrations}
        choices = _allowed_from_review(snapshot, rows)
        reference_values = tuple((a.attendance_id, a.registration_id) for a in reference.assignments)
        base = _valid_full_assignment(reference_values, rows, choices)
        if base is None:
            return reject()
        baseline = _counts(base, groups)
        if claim.baseline_counts != baseline:
            return reject()
        optimal = claim.status == "SOLVER_OPTIMAL_WITNESS_UNCHECKED"
        feasible = claim.status == "SOLVER_FEASIBLE_WITNESS_UNCHECKED"
        infeasible = claim.status == "SOLVER_INFEASIBLE_UNCHECKED"
        if optimal or feasible:
            if not (
                claim.solver_status == ("OPTIMAL" if optimal else "FEASIBLE")
                and claim.reason == ("COMPLETE_OPTIMIZATION" if optimal else "FEASIBLE_NO_OPTIMALITY")
                and claim.solver_proved_optimal is optimal
                and claim.solver_proved_infeasible is False
            ):
                return reject()
            witness = _valid_full_assignment(claim.alternative_assignments, rows, choices)
            if witness is None:
                return reject()
            counts = _counts(witness, groups)
            distance = sum(witness[i] != base[i] for i in rows)
            if (distance < 1 or counts.a_greater_than_b == baseline.a_greater_than_b or
                claim.alternative_counts != counts or
                claim.witness_changed_assignments != distance):
                return reject()
            return WitnessCheck(status="WITNESS_VALID", reason="VALIDATED_WITNESS",
                                recomputed_counts=counts,
                                recomputed_changed_assignments=distance, **common)
        if infeasible:
            if not (
                claim.solver_status == "INFEASIBLE" and
                claim.reason == "REVERSE_MODEL_INFEASIBLE" and
                claim.solver_proved_infeasible is True and
                claim.solver_proved_optimal is False and
                claim.alternative_assignments is None and
                claim.alternative_counts is None and
                claim.witness_changed_assignments is None
            ):
                return reject()
            return WitnessCheck(status="SCOPED_INFEASIBILITY_SOLVER_ATTRIBUTED",
                                reason="SOLVER_STATUS_ONLY", **common)
        if claim.status == "NOT_VERIFIED":
            if (claim.solver_status not in {"UNKNOWN", "MODEL_INVALID", "ERROR", "NOT_RUN"} or
                claim.solver_proved_optimal or claim.solver_proved_infeasible or
                claim.alternative_assignments is not None or
                claim.alternative_counts is not None or
                claim.witness_changed_assignments is not None):
                return reject()
            return WitnessCheck(status="NOT_VERIFIED", reason="SOLVER_NOT_COMPLETE", **common)
        return reject()
    except (AttributeError, TypeError, ValueError, KeyError):
        return reject()
