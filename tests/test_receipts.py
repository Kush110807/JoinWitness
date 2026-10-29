"""JW-T06 receipts and replay; fake solver result keeps tests offline everywhere."""
from pathlib import Path
import json
import pytest
from pydantic import ValidationError

from joinwitness.canonical import canonical_json_bytes
from joinwitness.ingest import load_csv_bytes
from joinwitness.oracle import enumerate_oracle
from joinwitness.policy import ReviewDraft, freeze_review
from joinwitness.receipts import (
    ReceiptError, VerificationReceipt, build_receipt, receipt_hash,
    replay_receipt, write_receipt,
)
from test_checker import case, claim_for


def build(name="flagship_flip", *, status=None):
    b,s,r,o = case(name)
    claim=claim_for(b,s,r,o,status=status or ("INFEASIBLE" if o.status=="ORACLE_STABLE" else "OPTIMAL"))
    return (b,s,r,o,claim,build_receipt(b,s,r,claim,timestamp="2026-10-29T19:00:00+00:00"))


@pytest.mark.parametrize("name,expected", [
    ("flagship_flip","REVERSIBLE_MINIMUM_PROVEN"),
    ("two_changes","REVERSIBLE_MINIMUM_PROVEN"),
    ("stable","STABLE_WITHIN_REVIEWED_POLICY"),
    ("tie","REVERSIBLE_MINIMUM_PROVEN"),
    ("false_reference","REVERSIBLE_MINIMUM_PROVEN"),
])
def test_receipt_build_and_independent_replay(name, expected):
    b,s,r,o,c,receipt=build(name)
    assert receipt.verdict==expected
    assert receipt.proof_basis=="SOLVER_AND_SMALL_ORACLE"
    assert receipt.receipt_sha256==receipt_hash(receipt)
    p=ROOT / name / "review_policy.json"
    assert replay_receipt(receipt,b,ReviewDraft.model_validate_json(p.read_bytes()),rerun_solver=False)==receipt


ROOT=Path(__file__).resolve().parents[1]/"fixtures"


def test_receipt_file_creation_and_utf8_roundtrip(tmp_path):
    b,s,r,o,c,receipt=build()
    f=tmp_path/"receipt.json"
    write_receipt(receipt,f)
    assert VerificationReceipt.model_validate_json(f.read_bytes())==receipt
    with pytest.raises(ReceiptError,match="OUTPUT_EXISTS"):
        write_receipt(receipt,f)


def test_adversarial_receipt_checksum_failure():
    b,s,r,o,c,receipt=build()
    altered=receipt.model_copy(update={"verdict":"STABLE_WITHIN_REVIEWED_POLICY"})
    with pytest.raises(ReceiptError,match="RECEIPT_DIGEST_MISMATCH"):
        replay_receipt(altered,b,ReviewDraft.model_validate_json((ROOT/"flagship_flip/review_policy.json").read_bytes()),rerun_solver=False)


def test_rehashed_lie_about_status_refused():
    b,s,r,o,c,receipt=build()
    altered=receipt.model_copy(update={"verdict":"STABLE_WITHIN_REVIEWED_POLICY"})
    altered=altered.model_copy(update={"receipt_sha256":receipt_hash(altered)})
    with pytest.raises(ReceiptError,match="RESULT_CLASSIFICATION_MISMATCH"):
        replay_receipt(altered,b,ReviewDraft.model_validate_json((ROOT/"flagship_flip/review_policy.json").read_bytes()),rerun_solver=False)


def test_changed_raw_csv_bytes_rejected():
    b,s,r,o,c,receipt=build()
    from joinwitness.contracts import InputBundle
    raw=(ROOT/"flagship_flip/attendance.csv").read_bytes()
    rows,digest=load_csv_bytes(raw.replace(b"\n",b"\r\n"),"attendance")
    changed=InputBundle(registrations=b.registrations,attendance=rows,
                        registrations_digest=b.registrations_digest,attendance_digest=digest)
    with pytest.raises(ReceiptError,match="SOURCE_OR_POLICY_CHANGED"):
        replay_receipt(receipt,changed,ReviewDraft.model_validate_json((ROOT/"flagship_flip/review_policy.json").read_bytes()),rerun_solver=False)


def test_changed_policy_and_rehashed_receipt_rejected():
    b,s,r,o,c,receipt=build()
    p=ReviewDraft.model_validate_json((ROOT/"flagship_flip/review_policy.json").read_bytes())
    edited=p.model_copy(update={"revision":2})
    with pytest.raises(ReceiptError,match="SOURCE_OR_POLICY_CHANGED"):
        replay_receipt(receipt,b,edited,rerun_solver=False)


def test_rehashed_forged_solver_assignment_refused():
    b,s,r,o,c,receipt=build()
    forged=c.model_copy(update={"witness_changed_assignments":99})
    altered=receipt.model_copy(update={"solver_result":forged})
    altered=altered.model_copy(update={"receipt_sha256":receipt_hash(altered)})
    with pytest.raises(ReceiptError,match="CHECKER_RESULT_MISMATCH"):
        replay_receipt(altered,b,ReviewDraft.model_validate_json((ROOT/"flagship_flip/review_policy.json").read_bytes()),rerun_solver=False)


def test_rehashed_forged_oracle_refused():
    b,s,r,o,c,receipt=build()
    forged=o.model_copy(update={"minimum_changed_assignments":42})
    altered=receipt.model_copy(update={"oracle_result":forged})
    altered=altered.model_copy(update={"receipt_sha256":receipt_hash(altered)})
    with pytest.raises(ReceiptError,match="ORACLE_RESULT_MISMATCH"):
        replay_receipt(altered,b,ReviewDraft.model_validate_json((ROOT/"flagship_flip/review_policy.json").read_bytes()),rerun_solver=False)


def test_infeasibility_contradiction_rejected():
    b,s,r,o=case("flagship_flip")
    fake=claim_for(b,s,r,o,status="INFEASIBLE")
    with pytest.raises(ReceiptError,match="SOLVER_ORACLE_DISAGREE"):
        build_receipt(b,s,r,fake)


def test_optimality_false_minimum_rejected():
    b,s,r,o=case("two_changes")
    fake=claim_for(b,s,r,o)
    # A valid but not necessarily minimal flipping assignment needs an actual
    # independent witness. A fake wrong distance must be rejected by checker.
    fake=fake.model_copy(update={"witness_changed_assignments":1})
    with pytest.raises(ReceiptError,match="INVALID_SOLVER_CLAIM"):
        build_receipt(b,s,r,fake)


def test_unknown_creates_only_incomplete_receipt():
    b,s,r,o=case("stable")
    fake=claim_for(b,s,r,o,status="UNKNOWN")
    rec=build_receipt(b,s,r,fake)
    assert rec.verdict=="NOT_VERIFIED"
    assert rec.proof_basis=="INCOMPLETE"


def test_feasible_never_proves_minimum():
    b,s,r,o=case()
    fake=claim_for(b,s,r,o,status="FEASIBLE")
    rec=build_receipt(b,s,r,fake)
    assert rec.verdict=="REVERSIBLE_WITNESS_ONLY"
    assert rec.proof_basis=="CHECKED_WITNESS_ONLY"


def test_fresh_solver_replay_mismatch_refused(monkeypatch):
    import joinwitness.receipts as receipts
    b,s,r,o,c,rec=build()
    monkeypatch.setattr(receipts,"solve_reversal",lambda *_args,**_kwargs: claim_for(b,s,r,o,status="UNKNOWN"))
    with pytest.raises(ReceiptError,match="SOLVER_REPLAY_DISAGREE"):
        replay_receipt(rec,b,ReviewDraft.model_validate_json((ROOT/"flagship_flip/review_policy.json").read_bytes()))


def test_fresh_solver_replay_matching_logic_succeeds(monkeypatch):
    import joinwitness.receipts as receipts
    b,s,r,o,c,rec=build()
    monkeypatch.setattr(receipts,"solve_reversal",lambda *_args,**_kwargs: c)
    assert replay_receipt(rec,b,ReviewDraft.model_validate_json((ROOT/"flagship_flip/review_policy.json").read_bytes()))==rec


def test_receipt_schema_rejects_unexpected_fields():
    b,s,r,o,c,rec=build()
    payload=rec.model_dump(mode="json")
    payload["trusted_authority"]="ai"
    with pytest.raises(ValidationError):
        VerificationReceipt.model_validate(payload)


def test_large_instance_solver_attribution_not_oracle_proof():
    from joinwitness.contracts import InputBundle
    from joinwitness.ingest import load_csv_bytes
    from joinwitness.policy import ReviewedEdge, UnmatchedRule, ReviewDraft, freeze_review
    from joinwitness.baseline import ReferenceChoice, ReferenceDraft, ReferenceCounts, freeze_reference
    from joinwitness.solver import SolverResult
    regs_text="registration_id,name,group\n" + "".join(
        f"R-A{i},Person A{i},A\n" for i in range(1,8)
    ) + "".join(f"R-B{i},Person B{i},B\n" for i in range(1,8))
    att_text="attendance_id,recorded_name\n" + "".join(f"T-{i:02d},Recorded {i}\n" for i in range(1,14))
    regs,rd=load_csv_bytes(regs_text.encode(),"registrations")
    atts,ad=load_csv_bytes(att_text.encode(),"attendance")
    bundle=InputBundle(registrations=regs,attendance=atts,registrations_digest=rd,attendance_digest=ad)
    base={f"T-{i:02d}":f"R-A{i}" if i<=6 else f"R-B{i-6}" for i in range(1,13)}
    base["T-13"]="R-A7"
    edges=[ReviewedEdge(attendance_id=a,registration_id=r,status="CONFIRMED") for a,r in list(base.items())[:-1]]
    edges.extend([ReviewedEdge(attendance_id="T-13",registration_id=reg,status="POSSIBLE") for reg in ["R-A7","R-B7"]])
    draft=ReviewDraft(revision=1,coverage="REVIEWED_CLOSED_SCOPE",scope_note="Synthetic thirteen-row bounded candidate universe only",closed_scope_attested=True,
                      edges=tuple(edges),unmatched=tuple(UnmatchedRule(attendance_id=a,status="FORBIDDEN") for a in base))
    snap=freeze_review(bundle,draft)
    ref,_=freeze_reference(bundle,snap,ReferenceDraft(assignments=tuple(ReferenceChoice(attendance_id=a,registration_id=r) for a,r in base.items())))
    flip=tuple(sorted((a,"R-B7" if a=="T-13" else r) for a,r in base.items()))
    claim=SolverResult(status="SOLVER_OPTIMAL_WITNESS_UNCHECKED",solver_status="OPTIMAL",reason="COMPLETE_OPTIMIZATION",
        review_sha256=snap.snapshot_sha256,reference_sha256=ref.reference_sha256,coverage=snap.coverage,
        baseline_counts=ReferenceCounts(a=7,b=6,unmatched=0,a_greater_than_b=True),
        alternative_counts=ReferenceCounts(a=6,b=7,unmatched=0,a_greater_than_b=False),
        alternative_assignments=flip,witness_changed_assignments=1,solver_proved_optimal=True,
        ortools_version="9.15.6755",time_limit_seconds=10,random_seed=11,workers=1,scope_caveat="test")
    rec=build_receipt(bundle,snap,ref,claim)
    assert rec.oracle_result.status=="NOT_VERIFIED"
    assert rec.oracle_result.reason=="ROW_LIMIT"
    assert rec.verdict=="REVERSIBLE_MINIMUM_PROVEN"
    assert rec.proof_basis=="SOLVER_ATTRIBUTED_ONLY"
    assert replay_receipt(rec,bundle,draft,rerun_solver=False)==rec
