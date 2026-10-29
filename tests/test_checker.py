"""JW-T06 structural checker adversarial tests without depending on CP-SAT runtime."""
from pathlib import Path

import pytest

from joinwitness.baseline import ReferenceDraft, freeze_reference
from joinwitness.checker import check_solver_claim
from joinwitness.ingest import load_pair
from joinwitness.oracle import enumerate_oracle
from joinwitness.policy import ReviewDraft, freeze_review
from joinwitness.solver import SolverResult

ROOT = Path(__file__).resolve().parents[1] / "fixtures"


def case(name="flagship_flip"):
    p = ROOT / name
    b = load_pair(p / "registrations.csv", p / "attendance.csv")
    s = freeze_review(b, ReviewDraft.model_validate_json((p / "review_policy.json").read_bytes()))
    r, _ = freeze_reference(b, s, ReferenceDraft.model_validate_json((p / "reference.json").read_bytes()))
    return b, s, r, enumerate_oracle(b, s, r)


def claim_for(b, s, r, oracle, *, status="OPTIMAL"):
    props = dict(
        review_sha256=s.snapshot_sha256, reference_sha256=r.reference_sha256,
        coverage=s.coverage, baseline_counts=oracle.baseline_counts,
        time_limit_seconds=10.0, random_seed=11, workers=1,
        ortools_version="9.15.6755", scope_caveat="Test only",
    )
    if status == "INFEASIBLE":
        return SolverResult(status="SOLVER_INFEASIBLE_UNCHECKED",solver_status="INFEASIBLE",
                            reason="REVERSE_MODEL_INFEASIBLE", solver_proved_infeasible=True, **props)
    if status == "UNKNOWN":
        return SolverResult(status="NOT_VERIFIED",solver_status="UNKNOWN",reason="TIMEOUT_OR_UNKNOWN", **props)
    return SolverResult(
        status="SOLVER_OPTIMAL_WITNESS_UNCHECKED" if status == "OPTIMAL" else "SOLVER_FEASIBLE_WITNESS_UNCHECKED",
        solver_status=status, reason="COMPLETE_OPTIMIZATION" if status == "OPTIMAL" else "FEASIBLE_NO_OPTIMALITY",
        alternative_assignments=oracle.alternative_assignments,
        alternative_counts=oracle.alternative_counts,
        witness_changed_assignments=oracle.minimum_changed_assignments,
        solver_proved_optimal=status == "OPTIMAL", **props,
    )


@pytest.mark.parametrize("name,distance", [("flagship_flip",1),("two_changes",2),("tie",1),("false_reference",1)])
def test_valid_witness_independently_recomputed(name, distance):
    b,s,r,o = case(name)
    checked = check_solver_claim(b,s,r,claim_for(b,s,r,o))
    assert checked.status == "WITNESS_VALID"
    assert checked.recomputed_changed_assignments == distance
    assert checked.recomputed_counts == o.alternative_counts


def test_stable_is_not_independently_proved_by_checker():
    b,s,r,o=case("stable")
    checked=check_solver_claim(b,s,r,claim_for(b,s,r,o,status="INFEASIBLE"))
    assert checked.status == "SCOPED_INFEASIBILITY_SOLVER_ATTRIBUTED"
    assert checked.recomputed_counts is None


def test_unknown_never_becomes_stable():
    b,s,r,o=case("stable")
    assert check_solver_claim(b,s,r,claim_for(b,s,r,o,status="UNKNOWN")).status == "NOT_VERIFIED"


def reject(update, *, scenario="flagship_flip"):
    b,s,r,o=case(scenario)
    original=claim_for(b,s,r,o)
    broken=original.model_copy(update=update(original))
    assert check_solver_claim(b,s,r,broken).reason == "REJECTED_CLAIM"


@pytest.mark.parametrize("change", [
    lambda c: {"review_sha256":"0"*64},
    lambda c: {"reference_sha256":"f"*64},
    lambda c: {"coverage":"UNREVIEWED"},
    lambda c: {"independent_checker_status":"COMPLETE"},
    lambda c: {"schema_version":"fake"},
    lambda c: {"witness_changed_assignments":2},
    lambda c: {"witness_changed_assignments":0},
    lambda c: {"solver_proved_optimal":False},
    lambda c: {"solver_status":"FEASIBLE"},
    lambda c: {"solver_proved_infeasible":True},
    lambda c: {"alternative_counts":c.baseline_counts},
    lambda c: {"alternative_assignments":(("T-01","R-A1"),("T-02","R-A2"),("T-03","R-B1"))},
    lambda c: {"alternative_assignments":(("T-01","R-A1"),("T-02","R-X"),("T-03","R-B1"))},
    lambda c: {"alternative_assignments":(("T-01","R-A1"),("T-02","R-A1"),("T-03","R-B1"))},
    lambda c: {"alternative_assignments":(("T-01","R-A1"),("T-02","R-B2"))},
    lambda c: {"alternative_assignments":(("T-01","R-A1"),("T-02","R-B2"),("T-02","R-B2"))},
    lambda c: {"alternative_assignments":(("T-01","R-A1"),("T-02",None),("T-03","R-B1"))},
    lambda c: {"alternative_assignments":(("T-01","R-A1"),("T-02","R-B2"),("T-03","R-B1"),("T-XX",None))},
    lambda c: {"alternative_assignments":"invalid"},
])
def test_checker_rejects_invalid_claims(change):
    reject(change)


def test_feasible_witness_is_valid_but_not_minimum_proven():
    b,s,r,o=case()
    result=check_solver_claim(b,s,r,claim_for(b,s,r,o,status="FEASIBLE"))
    assert result.status == "WITNESS_VALID"


def test_false_infeasibility_structurally_attributed_not_proven():
    b,s,r,o=case()
    result=check_solver_claim(b,s,r,claim_for(b,s,r,o,status="INFEASIBLE"))
    assert result.status == "SCOPED_INFEASIBILITY_SOLVER_ATTRIBUTED"
    # Integration must compare independent oracle result, not misread this as proof.
    assert o.status == "ORACLE_REVERSIBLE"


def test_checker_never_imports_solver_or_oracle_modules():
    import inspect
    import joinwitness.checker as checker
    source=inspect.getsource(checker)
    assert "from .solver import" not in source
    assert "from .oracle import" not in source
    assert "allowed_choices(" not in source
