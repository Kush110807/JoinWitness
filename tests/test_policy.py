from pathlib import Path
import pytest
from pydantic import ValidationError

from joinwitness.ingest import load_pair
from joinwitness.policy import (
    PolicyCode, PolicyError, ReviewDraft, ReviewSnapshot, ReviewedEdge, UnmatchedRule,
    allowed_choices, freeze_review, snapshot_hash, validate_snapshot,
)

F = Path(__file__).resolve().parents[1] / "fixtures/flagship_flip"


@pytest.fixture
def b():
    return load_pair(F / "registrations.csv", F / "attendance.csv")


@pytest.fixture
def d():
    return ReviewDraft.model_validate_json((F / "review_policy.json").read_bytes())


def replace_d(d, **k):
    return d.model_copy(update=k)


def e(a, r, s):
    return ReviewedEdge(attendance_id=a, registration_id=r, status=s)


def u(a, s):
    return UnmatchedRule(attendance_id=a, status=s)


def refusal(code, fn):
    with pytest.raises(PolicyError) as err:
        fn()
    assert err.value.code == code


def test_flagship_choices_exact(b, d):
    s = freeze_review(b, d)
    assert allowed_choices(b, s) == {
        "T-01": ("R-A1",), "T-02": ("R-A2", "R-B2"), "T-03": ("R-B1",)
    }
    assert s.registrations_digest == b.registrations_digest
    assert s.attendance_digest == b.attendance_digest
    assert snapshot_hash(s) == s.snapshot_sha256
    assert len(s.snapshot_sha256) == 64
    validate_snapshot(b, s, expected_revision=1, expected_sha256=s.snapshot_sha256)


def test_frozen_snapshot_and_edge(b, d):
    s = freeze_review(b, d)
    with pytest.raises(ValidationError):
        s.revision = 2
    with pytest.raises(ValidationError):
        s.edges[0].status = "POSSIBLE"


def test_unknown_registration(b, d):
    refusal(PolicyCode.UNKNOWN_ID, lambda: freeze_review(b, replace_d(d, edges=d.edges+(e("T-02", "R-Z", "POSSIBLE"),))))


def test_unknown_attendance(b, d):
    refusal(PolicyCode.UNKNOWN_ID, lambda: freeze_review(b, replace_d(d, edges=d.edges+(e("T-Z", "R-A1", "POSSIBLE"),))))


def test_duplicate_edge_even_if_status_differs(b, d):
    refusal(PolicyCode.DUPLICATE_REVIEW, lambda: freeze_review(b, replace_d(d, edges=d.edges+(e("T-02", "R-A2", "PROHIBITED"),))))


def test_missing_unmatched(b, d):
    refusal(PolicyCode.MISSING_UNMATCHED, lambda: freeze_review(b, replace_d(d, unmatched=d.unmatched[:-1])))


def test_duplicate_unmatched(b, d):
    refusal(PolicyCode.DUPLICATE_REVIEW, lambda: freeze_review(b, replace_d(d, unmatched=d.unmatched+(u("T-02", "ALLOWED"),))))


def test_unknown_unmatched_row(b, d):
    refusal(PolicyCode.UNKNOWN_ID, lambda: freeze_review(b, replace_d(d, unmatched=d.unmatched+(u("T-X", "REQUIRED"),))))


def test_conflicting_confirmed_same_attendance(b, d):
    edges = tuple(x for x in d.edges if x.attendance_id != "T-02") + (e("T-02", "R-A2", "CONFIRMED"), e("T-02", "R-B2", "CONFIRMED"))
    refusal(PolicyCode.INVALID_POLICY, lambda: freeze_review(b, replace_d(d, edges=edges)))


def test_two_rows_same_registration_confirmed(b, d):
    edges = tuple(x for x in d.edges if x.attendance_id != "T-02") + (e("T-02", "R-A1", "CONFIRMED"),)
    refusal(PolicyCode.INFEASIBLE, lambda: freeze_review(b, replace_d(d, edges=edges)))


def test_confirmed_with_other_possible_rejected(b, d):
    edges = d.edges + (e("T-01", "R-B2", "POSSIBLE"),)
    refusal(PolicyCode.INVALID_POLICY, lambda: freeze_review(b, replace_d(d, edges=edges)))


def test_confirmed_with_allowed_unmatched_rejected(b, d):
    rules = tuple(u(x.attendance_id, "ALLOWED") if x.attendance_id == "T-01" else x for x in d.unmatched)
    refusal(PolicyCode.INVALID_POLICY, lambda: freeze_review(b, replace_d(d, unmatched=rules)))


def test_required_unmatched_cannot_have_possible_edge(b, d):
    rules = tuple(u(x.attendance_id, "REQUIRED") if x.attendance_id == "T-02" else x for x in d.unmatched)
    refusal(PolicyCode.INVALID_POLICY, lambda: freeze_review(b, replace_d(d, unmatched=rules)))


def test_required_unmatched_without_possible_edge(b, d):
    edges = tuple(x for x in d.edges if x.attendance_id != "T-02")
    rules = tuple(u(x.attendance_id, "REQUIRED") if x.attendance_id == "T-02" else x for x in d.unmatched)
    s = freeze_review(b, replace_d(d, edges=edges, unmatched=rules))
    assert allowed_choices(b, s)["T-02"] == (None,)


def test_allowed_unmatched_and_possible(b, d):
    rules = tuple(u(x.attendance_id, "ALLOWED") if x.attendance_id == "T-02" else x for x in d.unmatched)
    s = freeze_review(b, replace_d(d, unmatched=rules))
    assert allowed_choices(b, s)["T-02"] == ("R-A2", "R-B2", None)


def test_allowed_unmatched_only(b, d):
    edges = tuple(x for x in d.edges if x.attendance_id != "T-02")
    rules = tuple(u(x.attendance_id, "ALLOWED") if x.attendance_id == "T-02" else x for x in d.unmatched)
    s = freeze_review(b, replace_d(d, edges=edges, unmatched=rules))
    assert allowed_choices(b, s)["T-02"] == (None,)


def test_forbidden_no_edges_fails(b, d):
    edges = tuple(x for x in d.edges if x.attendance_id != "T-02")
    refusal(PolicyCode.INFEASIBLE, lambda: freeze_review(b, replace_d(d, edges=edges)))


def test_prohibited_does_not_admit_choice(b, d):
    edges = tuple(x for x in d.edges if x.attendance_id != "T-02") + (e("T-02", "R-A2", "PROHIBITED"),)
    rules = tuple(u(x.attendance_id, "ALLOWED") if x.attendance_id == "T-02" else x for x in d.unmatched)
    s = freeze_review(b, replace_d(d, edges=edges, unmatched=rules))
    assert allowed_choices(b, s)["T-02"] == (None,)


def test_hall_collision_without_confirmed_row(b, d):
    # Both T01 and T02 may use only R-A2, and both are FORBIDDEN unmatched.
    edges = (e("T-01", "R-A2", "POSSIBLE"), e("T-02", "R-A2", "POSSIBLE"), e("T-03", "R-B1", "CONFIRMED"))
    refusal(PolicyCode.INFEASIBLE, lambda: freeze_review(b, replace_d(d, edges=edges)))


def test_unreviewed_cannot_admit_possible(b, d):
    refusal(PolicyCode.INVALID_POLICY, lambda: freeze_review(b, replace_d(d, coverage="UNREVIEWED", closed_scope_attested=False)))


def test_closed_scope_requires_explicit_attestation(b, d):
    refusal(PolicyCode.INVALID_POLICY, lambda: freeze_review(b, replace_d(d, closed_scope_attested=False)))


def test_partial_scope_cannot_claim_closed_attestation(b, d):
    refusal(PolicyCode.INVALID_POLICY, lambda: freeze_review(b, replace_d(d, coverage="REVIEWED_PARTIAL")))


def test_partial_scope_valid_when_unattested(b, d):
    s = freeze_review(b, replace_d(d, coverage="REVIEWED_PARTIAL", closed_scope_attested=False))
    assert s.coverage == "REVIEWED_PARTIAL"


def test_snapshot_order_independent_review_records(b, d):
    s1 = freeze_review(b, d)
    s2 = freeze_review(b, replace_d(d, edges=tuple(reversed(d.edges)), unmatched=tuple(reversed(d.unmatched))))
    assert s1 == s2


def test_snapshot_revision_change_invalidates_old_hash(b, d):
    s1 = freeze_review(b, d)
    s2 = freeze_review(b, replace_d(d, revision=2))
    assert s1.snapshot_sha256 != s2.snapshot_sha256
    refusal(PolicyCode.SNAPSHOT_STALE, lambda: validate_snapshot(b, s2, expected_sha256=s1.snapshot_sha256))
    refusal(PolicyCode.SNAPSHOT_STALE, lambda: validate_snapshot(b, s2, expected_revision=1))


def test_snapshot_permission_changed_invalidates_hash(b, d):
    s1 = freeze_review(b, d)
    edges = tuple(e(x.attendance_id, x.registration_id, "PROHIBITED") if x.registration_id == "R-B2" else x for x in d.edges)
    s2 = freeze_review(b, replace_d(d, revision=2, edges=edges))
    assert s1.snapshot_sha256 != s2.snapshot_sha256
    refusal(PolicyCode.SNAPSHOT_STALE, lambda: validate_snapshot(b, s2, expected_sha256=s1.snapshot_sha256))


def test_snapshot_tamper_detected(b, d):
    s = freeze_review(b, d)
    forged = s.model_copy(update={"coverage": "REVIEWED_PARTIAL"})
    refusal(PolicyCode.SNAPSHOT_INVALID, lambda: validate_snapshot(b, forged))


def test_source_raw_byte_mutation_is_stale(b, d):
    from joinwitness.ingest import load_csv_bytes
    from joinwitness.contracts import InputBundle
    s = freeze_review(b, d)
    raw = (F / "attendance.csv").read_bytes()
    rows, digest = load_csv_bytes(raw.replace(b"\n", b"\r\n"), "attendance")
    mutated = InputBundle(registrations=b.registrations, attendance=rows,
                          registrations_digest=b.registrations_digest, attendance_digest=digest)
    assert mutated.attendance_digest.parsed_sha256 == b.attendance_digest.parsed_sha256
    refusal(PolicyCode.SNAPSHOT_STALE, lambda: validate_snapshot(mutated, s))


def test_invalid_extra_policy_field_rejected(d):
    payload = d.model_dump()
    payload["model_confidence"] = 0.99
    with pytest.raises(ValidationError):
        ReviewDraft.model_validate(payload)


def test_review_edges_limited_to_ten_per_row(b, d):
    # More than 10 distinct choices cannot be formed with 4 registrations;
    # use a separate synthetic 11-registration bundle to test the bound.
    from joinwitness.contracts import InputBundle
    from joinwitness.ingest import load_csv_bytes
    raw = b"registration_id,name,group\n" + b"".join(f"Z{i},Name {i},A\n".encode() for i in range(11))
    regs, digest = load_csv_bytes(raw, "registrations")
    custom = InputBundle(registrations=regs, attendance=b.attendance,
                         registrations_digest=digest, attendance_digest=b.attendance_digest)
    draft = replace_d(d, edges=tuple(e("T-02", f"Z{i}", "POSSIBLE") for i in range(11)),
                      unmatched=(u("T-01", "ALLOWED"), u("T-02", "FORBIDDEN"), u("T-03", "ALLOWED")))
    refusal(PolicyCode.INVALID_POLICY, lambda: freeze_review(custom, draft))


def test_in_memory_group_tampering_with_old_hash_rejected(b, d):
    from joinwitness.contracts import Registration, InputBundle
    changed = b.registrations[0].model_copy(update={"group": "B"})
    mutated = InputBundle(registrations=(changed,) + b.registrations[1:], attendance=b.attendance,
                          registrations_digest=b.registrations_digest, attendance_digest=b.attendance_digest)
    refusal(PolicyCode.SNAPSHOT_INVALID, lambda: freeze_review(mutated, d))

def test_in_memory_duplicate_ids_rejected(b, d):
    from joinwitness.contracts import InputBundle
    altered = InputBundle(registrations=(b.registrations[0], b.registrations[0])+b.registrations[2:], attendance=b.attendance,
                          registrations_digest=b.registrations_digest, attendance_digest=b.attendance_digest)
    refusal(PolicyCode.SNAPSHOT_INVALID, lambda: freeze_review(altered, d))
