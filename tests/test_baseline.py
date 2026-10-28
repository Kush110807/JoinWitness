import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from joinwitness.baseline import (
    BaselineCode, BaselineError, ReferenceChoice, ReferenceDraft,
    ReferenceMatching, freeze_reference, reference_hash, validate_reference,
)
from joinwitness.ingest import load_pair
from joinwitness.policy import ReviewDraft, ReviewedEdge, UnmatchedRule, freeze_review

F = Path(__file__).resolve().parents[1] / "fixtures/flagship_flip"


@pytest.fixture
def setup():
    b = load_pair(F / "registrations.csv", F / "attendance.csv")
    policy = ReviewDraft.model_validate_json((F / "review_policy.json").read_bytes())
    snapshot = freeze_review(b, policy)
    ref = ReferenceDraft.model_validate_json((F / "reference.json").read_bytes())
    return b, policy, snapshot, ref


def pick(a, r):
    return ReferenceChoice(attendance_id=a, registration_id=r)


def fail(code, f):
    with pytest.raises(BaselineError) as err:
        f()
    assert err.value.code == code


def test_flagship_baseline_frozen_correct(setup):
    b, p, s, d = setup
    r, counts = freeze_reference(b, s, d)
    assert (counts.a, counts.b, counts.unmatched, counts.a_greater_than_b) == (2,1,0,True)
    assert validate_reference(b,s,r) == counts
    assert r.reference_sha256 == reference_hash(r)
    assert r.review_sha256 == s.snapshot_sha256


def test_reference_freezes_and_sorts_by_attendance_id(setup):
    b, p, s, d = setup
    r1, _ = freeze_reference(b,s,d)
    r2, _ = freeze_reference(b,s,d.model_copy(update={"assignments": tuple(reversed(d.assignments))}))
    assert r1 == r2


def test_incomplete_baseline_rejected(setup):
    b,p,s,d = setup
    fail(BaselineCode.INVALID, lambda: freeze_reference(b,s,d.model_copy(update={"assignments": d.assignments[:-1]})))


def test_duplicate_attendance_rejected(setup):
    b,p,s,d = setup
    x = tuple(d.assignments[:2]) + (d.assignments[0],)
    fail(BaselineCode.INVALID, lambda: freeze_reference(b,s,d.model_copy(update={"assignments": x})))


def test_unknown_attendance_rejected(setup):
    b,p,s,d = setup
    x = (pick("T-99", "R-A1"),) + d.assignments[1:]
    fail(BaselineCode.INVALID, lambda: freeze_reference(b,s,d.model_copy(update={"assignments": x})))


def test_unreviewed_edge_rejected(setup):
    b,p,s,d = setup
    x = (d.assignments[0], pick("T-02", "R-B1"), d.assignments[2])
    fail(BaselineCode.INVALID, lambda: freeze_reference(b,s,d.model_copy(update={"assignments": x})))


def test_unknown_registration_rejected(setup):
    b,p,s,d = setup
    x = (d.assignments[0], pick("T-02", "R-UNKNOWN"), d.assignments[2])
    fail(BaselineCode.INVALID, lambda: freeze_reference(b,s,d.model_copy(update={"assignments": x})))


def test_forbidden_unmatched_rejected(setup):
    b,p,s,d = setup
    x = (d.assignments[0], pick("T-02", None), d.assignments[2])
    fail(BaselineCode.INVALID, lambda: freeze_reference(b,s,d.model_copy(update={"assignments": x})))


def test_confirmed_cannot_move(setup):
    b,p,s,d = setup
    x = (pick("T-01", "R-A2"), d.assignments[1], d.assignments[2])
    fail(BaselineCode.INVALID, lambda: freeze_reference(b,s,d.model_copy(update={"assignments": x})))


def test_one_to_one_collision_rejected(setup):
    b,p,s,d = setup
    # Both T01 and T02 could conceivably use R-A1, but T01 is confirmed.
    edges = p.edges + (ReviewedEdge(attendance_id="T-02", registration_id="R-A1", status="POSSIBLE"),)
    p2 = p.model_copy(update={"edges": edges, "revision": 2})
    s2 = freeze_review(b,p2)
    x = (pick("T-01", "R-A1"), pick("T-02", "R-A1"), pick("T-03", "R-B1"))
    fail(BaselineCode.INVALID, lambda: freeze_reference(b,s2,d.model_copy(update={"assignments": x})))


def test_alternative_changes_baseline_counts_but_no_optimum_claim(setup):
    b,p,s,d = setup
    x = (d.assignments[0], pick("T-02", "R-B2"), d.assignments[2])
    _, counts = freeze_reference(b,s,d.model_copy(update={"assignments": x}))
    assert (counts.a, counts.b, counts.a_greater_than_b) == (1,2,False)


def test_reference_stale_after_review_revision_change(setup):
    b,p,s,d = setup
    r, _ = freeze_reference(b,s,d)
    s2 = freeze_review(b,p.model_copy(update={"revision": 2}))
    fail(BaselineCode.STALE, lambda: validate_reference(b,s2,r))


def test_reference_stale_after_policy_permission_edit(setup):
    b,p,s,d = setup
    r, _ = freeze_reference(b,s,d)
    edges = tuple(edge.model_copy(update={"status": "PROHIBITED"}) if edge.registration_id == "R-B2" else edge for edge in p.edges)
    s2 = freeze_review(b,p.model_copy(update={"revision":2, "edges":edges}))
    fail(BaselineCode.STALE, lambda: validate_reference(b,s2,r))


def test_reference_stale_after_source_edit(setup):
    from joinwitness.contracts import InputBundle
    from joinwitness.ingest import load_csv_bytes
    b,p,s,d = setup
    r,_ = freeze_reference(b,s,d)
    raw = (F/"attendance.csv").read_bytes()
    rows, digest = load_csv_bytes(raw.replace(b"\n",b"\r\n"),"attendance")
    b2 = InputBundle(registrations=b.registrations, attendance=rows,registrations_digest=b.registrations_digest,attendance_digest=digest)
    from joinwitness.policy import PolicyError, PolicyCode
    with pytest.raises(PolicyError) as err:
        validate_reference(b2,s,r)
    assert err.value.code == PolicyCode.SNAPSHOT_STALE


def test_forged_reference_content_with_old_hash_rejected(setup):
    b,p,s,d = setup
    r,_ = freeze_reference(b,s,d)
    tampered = r.model_copy(update={"assignments": (r.assignments[0], pick("T-02", "R-B2"),r.assignments[2])})
    fail(BaselineCode.INVALID, lambda: validate_reference(b,s,tampered))


def test_reference_expected_hash_mismatch_is_stale(setup):
    b,p,s,d = setup
    r,_ = freeze_reference(b,s,d)
    fail(BaselineCode.STALE, lambda: validate_reference(b,s,r, expected_sha256="a"*64))


def test_unmatched_allowed_counts_neither_group(setup):
    b,p,s,d = setup
    rules = tuple(UnmatchedRule(attendance_id=x.attendance_id,status="ALLOWED") if x.attendance_id == "T-02" else x for x in p.unmatched)
    s2 = freeze_review(b,p.model_copy(update={"revision":2,"unmatched": rules}))
    x = (d.assignments[0],pick("T-02",None),d.assignments[2])
    _,counts = freeze_reference(b,s2,d.model_copy(update={"assignments":x}))
    assert (counts.a,counts.b,counts.unmatched,counts.a_greater_than_b)==(1,1,1,False)


def test_reference_unknown_fields_rejected(setup):
    b,p,s,d=setup
    x=d.model_dump()
    x["model_chosen"]="anything"
    with pytest.raises(ValidationError):
        ReferenceDraft.model_validate(x)


def test_frozen_reference_cannot_be_mutated(setup):
    b,p,s,d=setup
    ref,_=freeze_reference(b,s,d)
    with pytest.raises(ValidationError):
        ref.review_sha256="e"*64


def test_invalid_reference_payload_missing_assignment_field(setup):
    b,p,s,d=setup
    with pytest.raises(ValidationError):
        ReferenceChoice(attendance_id=10, registration_id="R-A1")


def test_missing_reference_choice_explicitly_rejected():
    with pytest.raises(ValidationError):
        ReferenceChoice(attendance_id="T-01")
