"""T05 solver/parity tests; T04 oracle is independent and not imported by solver."""
import importlib.util
import builtins
import random
from pathlib import Path
from types import SimpleNamespace

import pytest

from joinwitness.baseline import ReferenceChoice, ReferenceDraft, freeze_reference
from joinwitness.contracts import InputBundle
from joinwitness.ingest import load_csv_bytes, load_pair
from joinwitness.oracle import enumerate_oracle
from joinwitness.policy import ReviewDraft, ReviewedEdge, UnmatchedRule, freeze_review
from joinwitness.solver import solve_reversal

ROOT = Path(__file__).resolve().parents[1] / "fixtures"
HAS_ORTOOLS = importlib.util.find_spec("ortools") is not None


def case(name):
    f = ROOT / name
    bundle = load_pair(f / "registrations.csv", f / "attendance.csv")
    snapshot = freeze_review(bundle, ReviewDraft.model_validate_json((f / "review_policy.json").read_bytes()))
    reference, _ = freeze_reference(bundle, snapshot,
                                    ReferenceDraft.model_validate_json((f / "reference.json").read_bytes()))
    return bundle, snapshot, reference


@pytest.mark.parametrize("name,expected_changes,expected_oracle", [
    ("flagship_flip", 1, "ORACLE_REVERSIBLE"),
    ("stable", None, "ORACLE_STABLE"),
    ("two_changes", 2, "ORACLE_REVERSIBLE"),
    ("tie", 1, "ORACLE_REVERSIBLE"),
    ("false_reference", 1, "ORACLE_REVERSIBLE"),
])
@pytest.mark.skipif(not HAS_ORTOOLS, reason="T05 live CP-SAT requires OR-Tools")
def test_named_fixtures_match_independent_oracle(name, expected_changes, expected_oracle):
    bundle, policy, reference = case(name)
    oracle = enumerate_oracle(bundle, policy, reference)
    solver = solve_reversal(bundle, policy, reference)
    assert oracle.status == expected_oracle
    assert oracle.minimum_changed_assignments == expected_changes
    assert solver.independent_checker_status == "NOT_RUN_T06"
    assert solver.ortools_version == "9.15.6755"
    assert solver.workers == 1
    assert solver.review_sha256 == oracle.review_sha256
    assert solver.reference_sha256 == oracle.reference_sha256
    if expected_changes is None:
        assert solver.solver_status == "INFEASIBLE"
        assert solver.status == "SOLVER_INFEASIBLE_UNCHECKED"
        assert solver.solver_proved_infeasible
        assert solver.alternative_assignments is None
        assert solver.witness_changed_assignments is None
    else:
        assert solver.solver_status == "OPTIMAL"
        assert solver.status == "SOLVER_OPTIMAL_WITNESS_UNCHECKED"
        assert solver.solver_proved_optimal
        assert solver.witness_changed_assignments == expected_changes
        assert solver.alternative_counts.a_greater_than_b != oracle.baseline_counts.a_greater_than_b
        if name == "flagship_flip":
            assert sorted(solver.alternative_assignments) == sorted(oracle.alternative_assignments)


def test_invalid_options_rejected_even_without_ortools():
    b, s, r = case("flagship_flip")
    for bad in (0, -1, 10.1, float("nan"), float("inf"), True, "10"):
        with pytest.raises(ValueError):
            solve_reversal(b, s, r, time_limit_seconds=bad)
    for bad in (-1, True, 2_147_483_648, 2.5):
        with pytest.raises(ValueError):
            solve_reversal(b, s, r, random_seed=bad)


def test_dependency_missing_is_explicit_not_stable_or_proven(monkeypatch):
    b, s, r = case("flagship_flip")
    ordinary_import = builtins.__import__
    def simulated_missing(name, *args, **kwargs):
        if name == "ortools.sat.python":
            raise ImportError("Synthetic missing OR-Tools dependency")
        return ordinary_import(name, *args, **kwargs)
    monkeypatch.setattr(builtins, "__import__", simulated_missing)
    outcome = solve_reversal(b, s, r)
    assert outcome.status == "NOT_VERIFIED"
    assert outcome.solver_status == "NOT_RUN"
    assert outcome.reason == "DEPENDENCY_MISSING"
    assert outcome.witness_changed_assignments is None


def make_seeded_case(seed):
    rng = random.Random(seed)
    n = rng.randint(1, 5)
    labels = [rng.choice(("A", "B")) for _ in range(n * 2)]
    registrations, r_digest = load_csv_bytes(
        ("registration_id,name,group\n" + "".join(
            f"R-{i},Registered {i},{labels[i]}\n" for i in range(2*n))).encode("utf-8"),
        "registrations")
    attendance, a_digest = load_csv_bytes(
        ("attendance_id,recorded_name\n" + "".join(f"T-{i},Observed {i}\n" for i in range(n))).encode("utf-8"),
        "attendance")
    bundle = InputBundle(registrations=registrations, attendance=attendance,
                         registrations_digest=r_digest, attendance_digest=a_digest)
    edges = []
    for i in range(n):
        choices = [f"R-{i}"]
        if rng.getrandbits(1):
            choices.append(f"R-{i+n}")
        if n > 1 and rng.getrandbits(1):
            choices.append(f"R-{(i+1) % n}")
        for j in dict.fromkeys(choices):
            edges.append(ReviewedEdge(attendance_id=f"T-{i}", registration_id=j, status="POSSIBLE"))
    draft = ReviewDraft(revision=1, edges=tuple(edges),
                        unmatched=tuple(UnmatchedRule(attendance_id=f"T-{i}",status="ALLOWED") for i in range(n)),
                        coverage="REVIEWED_PARTIAL", scope_note="Small randomized model; candidate scope limited")
    snapshot = freeze_review(bundle, draft)
    ref, _ = freeze_reference(bundle, snapshot,
                              ReferenceDraft(assignments=tuple(ReferenceChoice(attendance_id=f"T-{i}",
                                                                              registration_id=f"R-{i}") for i in range(n))))
    return bundle, snapshot, ref


@pytest.mark.skipif(not HAS_ORTOOLS, reason="T05 live CP-SAT requires OR-Tools")
def test_120_seeded_cp_sat_oracle_parity():
    for seed in range(120):
        bundle, snap, ref = make_seeded_case(seed)
        oracle = enumerate_oracle(bundle, snap, ref)
        result = solve_reversal(bundle, snap, ref)
        assert oracle.reason == "COMPLETE_ENUMERATION", seed
        if oracle.status == "ORACLE_STABLE":
            assert result.status == "SOLVER_INFEASIBLE_UNCHECKED", seed
            assert result.solver_status == "INFEASIBLE", seed
            assert result.alternative_assignments is None, seed
        else:
            assert oracle.status == "ORACLE_REVERSIBLE", seed
            assert result.solver_status == "OPTIMAL", seed
            assert result.witness_changed_assignments == oracle.minimum_changed_assignments, seed
            assert result.alternative_counts.a_greater_than_b != oracle.baseline_counts.a_greater_than_b, seed


@pytest.mark.skipif(not HAS_ORTOOLS, reason="T05 live CP-SAT requires OR-Tools")
def test_oracle_row_limit_does_not_cause_false_solver_refusal():
    # 13 rows > T04 max, but each fixed and therefore easy for CP-SAT.
    n = 13
    r, rd = load_csv_bytes(("registration_id,name,group\n" + "".join(f"R{i},Name{i},A\n" for i in range(n))).encode(), "registrations")
    a, ad = load_csv_bytes(("attendance_id,recorded_name\n" + "".join(f"T{i},Name{i}\n" for i in range(n))).encode(), "attendance")
    b = InputBundle(registrations=r, attendance=a, registrations_digest=rd, attendance_digest=ad)
    d = ReviewDraft(revision=1, coverage="REVIEWED_PARTIAL",scope_note="Synthetic fixed candidates only",
                    edges=tuple(ReviewedEdge(attendance_id=f"T{i}",registration_id=f"R{i}",status="CONFIRMED") for i in range(n)),
                    unmatched=tuple(UnmatchedRule(attendance_id=f"T{i}",status="FORBIDDEN") for i in range(n)))
    s=freeze_review(b,d)
    ref,_=freeze_reference(b,s,ReferenceDraft(assignments=tuple(ReferenceChoice(attendance_id=f"T{i}",registration_id=f"R{i}") for i in range(n))))
    assert enumerate_oracle(b,s,ref).status == "NOT_VERIFIED"
    result=solve_reversal(b,s,ref)
    assert result.status == "SOLVER_INFEASIBLE_UNCHECKED"


@pytest.mark.skipif(not HAS_ORTOOLS, reason="T05 live CP-SAT requires OR-Tools")
@pytest.mark.parametrize("status,expected_reason", [("UNKNOWN","TIMEOUT_OR_UNKNOWN"),("MODEL_INVALID","MODEL_INVALID")])
def test_no_false_stable_on_unknown_or_invalid(monkeypatch,status,expected_reason):
    from ortools.sat.python import cp_model
    monkeypatch.setattr(cp_model.CpSolver,"solve",lambda self,model: None)
    monkeypatch.setattr(cp_model.CpSolver,"status_name",lambda self,raw: status)
    b,s,r=case("stable")
    result=solve_reversal(b,s,r)
    assert result.status == "NOT_VERIFIED"
    assert result.reason == expected_reason
    assert not result.solver_proved_infeasible


@pytest.mark.skipif(not HAS_ORTOOLS, reason="T05 live CP-SAT requires OR-Tools")
def test_solver_runtime_error_is_not_verified(monkeypatch):
    from ortools.sat.python import cp_model
    def fail(self, model):
        raise RuntimeError("synthetic failure")
    monkeypatch.setattr(cp_model.CpSolver,"solve",fail)
    b,s,r=case("flagship_flip")
    result=solve_reversal(b,s,r)
    assert result.status == "NOT_VERIFIED" and result.reason == "SOLVER_ERROR"


@pytest.mark.skipif(not HAS_ORTOOLS, reason="T05 live CP-SAT requires OR-Tools")
def test_feasible_only_never_claims_optimal(monkeypatch):
    from ortools.sat.python import cp_model
    old=cp_model.CpSolver.status_name
    def rename(self, raw=None):
        label=old(self,raw)
        return "FEASIBLE" if label == "OPTIMAL" else label
    monkeypatch.setattr(cp_model.CpSolver,"status_name",rename)
    b,s,r=case("flagship_flip")
    result=solve_reversal(b,s,r)
    assert result.status=="SOLVER_FEASIBLE_WITNESS_UNCHECKED"
    assert result.solver_status=="FEASIBLE"
    assert result.witness_changed_assignments==1
    assert not result.solver_proved_optimal


@pytest.mark.skipif(not HAS_ORTOOLS, reason="T05 live CP-SAT requires OR-Tools")
def test_solver_bad_witness_refused(monkeypatch):
    from ortools.sat.python import cp_model
    monkeypatch.setattr(cp_model.CpSolver,"value",lambda self,var: 0)
    b,s,r=case("flagship_flip")
    result=solve_reversal(b,s,r)
    assert result.status == "NOT_VERIFIED"
    assert result.reason == "INTERNAL_WITNESS_MISMATCH"
    assert result.alternative_assignments is None


@pytest.mark.skipif(not HAS_ORTOOLS, reason="T05 live CP-SAT requires OR-Tools")
def test_cli_output_and_exit(capsys, monkeypatch):
    import sys
    import json
    from joinwitness.solver import main
    f=ROOT/"flagship_flip"
    argv=["solver", "--registrations",str(f/"registrations.csv"),"--attendance",str(f/"attendance.csv"),
          "--policy",str(f/"review_policy.json"),"--reference",str(f/"reference.json")]
    monkeypatch.setattr(sys, "argv", argv)
    assert main() == 0
    report=json.loads(capsys.readouterr().out)
    assert report["status"]=="SOLVER_OPTIMAL_WITNESS_UNCHECKED"
    assert report["independent_checker_status"]=="NOT_RUN_T06"
