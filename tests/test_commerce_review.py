"""Human review, CAS atomicity and policy-freeze matrix (service layer)."""
import copy

import pytest

from joinwitness.commerce import candidates as cand
from joinwitness.commerce.errors import CommerceError
from joinwitness.commerce.service import op_parse, op_review
from joinwitness.commerce.session_state import Store

from tests.test_commerce_helpers import (
    BASELINE_MAP,
    MANUAL_D2_O3,
    ROWS_7,
    b64_bytes,
    challenge_request,
    files_payload,
    review_request,
)

POLICY_SHA = "cc07bdc869ad4c8f2ad1bbadbb8c853404cbd03701c6baee45111d998ca0ffba"
CATALOG_SHA = "4c8646f8684112ba4cb3a1bfb072b73e8aa2b309ce199e1e9567a6cb99db5098"
BASELINE_SHA = "49cf0a9061605aa42b5735d130a9c9eb1ad692860119fd62c753dd0538c8fd74"
REVIEW_SHA = "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9"
BUNDLE_SHA = "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50"


def fresh_session(bundle="commerce_demo", store=None):
    store = store or Store()
    body = op_parse(files_payload(bundle), store)
    return store, body["session_id"]


def expect_review_error(request, store, code, path=None, status=422):
    with pytest.raises(CommerceError) as caught:
        op_review(request, store)
    assert caught.value.code == code
    assert caught.value.http_status == status
    if path is not None:
        assert caught.value.path == path
    assert caught.value.envelope()["verified"] is False
    return caught.value


def test_valid_manual_review_freezes_frozen_digests():
    store, session_id = fresh_session()
    body = op_review(review_request(session_id), store)
    assert body["state"] == "REVIEW_FROZEN"
    assert (body["source_revision"], body["candidate_revision"], body["policy_revision"]) == (1, 2, 1)
    assert body["candidate_catalog_sha256"] == CATALOG_SHA
    assert body["source_bundle_sha256"] == BUNDLE_SHA
    assert body["policy_sha256"] == POLICY_SHA
    assert body["baseline_sha256"] == BASELINE_SHA
    assert body["review_sha256"] == REVIEW_SHA
    assert body["threshold_k"] == 2
    assert (body["raw_worlds"], body["admissible_worlds"], body["invalid_worlds"]) == (2, 2, 0)
    assert body["variable_records"] == 1
    assert body["baseline_valid"] is True
    assert body["authorised_by"] == "HUMAN_REVIEW_ATTESTED_NOT_IDENTITY_VERIFIED"


def test_unknown_field_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["origin"] = "MANUAL"
    expect_review_error(req, store, "INVALID_VALUE", "origin")


def test_stale_candidate_revision_rejected():
    store, session_id = fresh_session()
    op_review(review_request(session_id), store)
    err = expect_review_error(review_request(session_id), store, "STALE_STATE",
                              "expected_candidate_revision", 409)
    assert err.details == {"expected": 2, "received": 1}


def test_stale_policy_revision_rejected():
    store, session_id = fresh_session()
    op_review(review_request(session_id), store)
    req = review_request(session_id, candidate_revision=2, policy_revision=0)
    err = expect_review_error(req, store, "STALE_STATE", "expected_policy_revision", 409)
    assert err.details == {"expected": 1, "received": 0}


def test_stale_source_revision_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["expected_source_revision"] = 0
    err = expect_review_error(req, store, "STALE_STATE", "expected_source_revision", 409)
    assert err.details == {"expected": 1, "received": 0}


@pytest.mark.parametrize("bad", [0, 4, -1, "2", 2.0, True, None])
def test_bad_threshold_rejected(bad):
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["threshold_k"] = bad
    expect_review_error(req, store, "INVALID_VALUE", "threshold_k")


@pytest.mark.parametrize("bad", ["", "x" * 201, "caf\u00e9", 7, None])
def test_bad_reviewer_label_rejected(bad):
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["reviewer_label"] = bad
    expect_review_error(req, store, "INVALID_VALUE", "reviewer_label")


def test_false_attestation_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["review_attestation"]["all_rows_reviewed"] = False
    expect_review_error(req, store, "INVALID_REVIEW", "review_attestation.all_rows_reviewed")


def test_manual_unknown_record_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["manual_candidates"] = [{"record_type": "payment", "record_id": "P9",
                                 "target_id": "O1", "reason": "No such payment."}]
    expect_review_error(req, store, "MALFORMED_CANDIDATE", "manual_candidates[0]")


def test_manual_unknown_target_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["manual_candidates"] = [{"record_type": "delivery", "record_id": "D2",
                                 "target_id": "O9", "reason": "No such order."}]
    expect_review_error(req, store, "MALFORMED_CANDIDATE", "manual_candidates[0]")


def test_manual_cross_currency_rejected():
    payload = files_payload()
    payload["files"]["orders.csv"] = {
        "content_base64": b64_bytes(b"order_id,customer_id,order_total,currency\n"
                                    b"O1,C1,100.00,USD\nO2,C2,100.00,INR\n")}
    payload["files"]["payments.csv"] = {
        "content_base64": b64_bytes(b"payment_id,order_ref,amount,currency,status\n"
                                    b"P1,O1,100.00,USD,SETTLED\n")}
    payload["files"]["deliveries.csv"] = {
        "content_base64": b64_bytes(b"delivery_id,order_ref,status\nD1,O1,DELIVERED\n")}
    payload["files"]["refunds.csv"] = {
        "content_base64": b64_bytes(b"refund_id,payment_ref,amount,status\n")}
    store = Store()
    session_id = op_parse(payload, store)["session_id"]
    req = review_request(session_id)
    req["manual_candidates"] = [{"record_type": "payment", "record_id": "P1",
                                 "target_id": "O2", "reason": "Cross currency link."}]
    expect_review_error(req, store, "CURRENCY_MISMATCH", "manual_candidates[0]")


def test_manual_over_amount_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["manual_candidates"] = [{"record_type": "payment", "record_id": "P1",
                                 "target_id": "O3", "reason": "100 exceeds 80."}]
    expect_review_error(req, store, "MALFORMED_CANDIDATE", "manual_candidates[0]")


def test_manual_duplicate_of_source_pair_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["manual_candidates"] = [{"record_type": "payment", "record_id": "P1",
                                 "target_id": "O1", "reason": "Already a source ref."}]
    expect_review_error(req, store, "INVALID_REVIEW", "manual_candidates[0]")


def test_manual_exact_duplicate_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["manual_candidates"] = MANUAL_D2_O3 + MANUAL_D2_O3
    expect_review_error(req, store, "INVALID_REVIEW", "manual_candidates[1]")


def test_manual_bad_reason_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["manual_candidates"][0]["reason"] = ""
    expect_review_error(req, store, "INVALID_VALUE", "manual_candidates[0].reason")


def test_missing_row_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["rows"] = [row for row in req["rows"] if row["record_id"] != "R1"]
    err = expect_review_error(req, store, "REVIEW_INCOMPLETE", "rows")
    assert err.details == {"missing_record_key": "refund:R1"}


def test_unknown_row_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["rows"].append({"record_type": "payment", "record_id": "P9", "edges": [],
                        "unmatched": "CONFIRMED"})
    expect_review_error(req, store, "INVALID_REVIEW", "rows")


def test_unreviewed_candidate_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    for row in req["rows"]:
        if row["record_id"] == "D2":
            row["edges"] = [edge for edge in row["edges"] if edge["target_id"] == "O2"]
    expect_review_error(req, store, "UNREVIEWED_CANDIDATE", "rows.delivery:D2")


def test_revoked_edge_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id, manual=[])
    expect_review_error(req, store, "INVALID_REVIEW", "rows.delivery:D2.edges.O3")


def test_conflicting_confirmations_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    for row in req["rows"]:
        if row["record_id"] == "D2":
            row["edges"][0]["disposition"] = "CONFIRMED"
            row["edges"][1]["disposition"] = "CONFIRMED"
    expect_review_error(req, store, "INCONSISTENT_REVIEW", "rows.delivery:D2")


def test_no_choice_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    for row in req["rows"]:
        if row["record_id"] == "D2":
            row["edges"] = [{"target_id": "O2", "disposition": "PROHIBITED"},
                            {"target_id": "O3", "disposition": "PROHIBITED"}]
    expect_review_error(req, store, "INVALID_REVIEW", "rows.delivery:D2")


def test_invalid_baseline_target_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["reference_mapping"]["delivery:D2"] = "O9"
    err = expect_review_error(req, store, "INVALID_BASELINE", "reference_mapping.delivery:D2")
    assert err.details == {"target_id": "O9"}


def test_baseline_missing_key_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    del req["reference_mapping"]["refund:R1"]
    expect_review_error(req, store, "INVALID_BASELINE", "reference_mapping.refund:R1")


def test_contradictory_policy_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["manual_candidates"].append({"record_type": "payment", "record_id": "P2",
                                     "target_id": "O1",
                                     "reason": "Reviewer disputes the payment source reference."})
    for row in req["rows"]:
        if row["record_id"] == "P2":
            row["edges"] = [{"target_id": "O1", "disposition": "CONFIRMED"},
                            {"target_id": "O2", "disposition": "PROHIBITED"}]
    req["reference_mapping"]["payment:P2"] = "O1"
    err = expect_review_error(req, store, "CONTRADICTORY_POLICY", "rows")
    assert err.details == {"admissible_worlds": 0, "result_status": "NOT_VERIFIED"}


def test_inadmissible_baseline_with_live_worlds_rejected():
    store, session_id = fresh_session()
    req = review_request(session_id, manual=[])
    for row in req["rows"]:
        if row["record_id"] == "D2":
            row["edges"] = [{"target_id": "O1", "disposition": "POSSIBLE"},
                            {"target_id": "O2", "disposition": "POSSIBLE"}]
    req["manual_candidates"] = [{"record_type": "delivery", "record_id": "D2",
                                 "target_id": "O1", "reason": "Delivery may belong to O1."}]
    req["reference_mapping"]["delivery:D2"] = "O1"
    expect_review_error(req, store, "INVALID_BASELINE", "reference_mapping")


def test_second_identical_review_bumps_policy_only():
    store, session_id = fresh_session()
    first = op_review(review_request(session_id), store)
    second = op_review(review_request(session_id, candidate_revision=2, policy_revision=1), store)
    assert (second["candidate_revision"], second["policy_revision"]) == (2, 2)
    assert second["policy_sha256"] == first["policy_sha256"]
    assert second["review_sha256"] == first["review_sha256"]


def test_failed_review_commits_nothing():
    store, session_id = fresh_session()
    req = review_request(session_id)
    req["reference_mapping"]["delivery:D2"] = "O9"
    with pytest.raises(CommerceError):
        op_review(req, store)
    session = store.get(session_id)
    assert session.state == "IMPORTED"
    assert (session.candidate_revision, session.policy_revision) == (1, 0)
    assert session.policy is None and session.run is None
    assert session.manual_entries == []


def test_empty_optionals_review_freezes_single_world():
    store, session_id = fresh_session("commerce_demo_empty")
    req = review_request(session_id, manual=[], rows=[], mapping={}, threshold_k=1)
    body = op_review(req, store)
    assert (body["raw_worlds"], body["admissible_worlds"], body["variable_records"]) == (1, 1, 0)
    assert (body["candidate_revision"], body["policy_revision"]) == (1, 1)


def test_meta_adoption_review_matches_frozen_meta_digests():
    store, session_id = fresh_session()
    session = store.get(session_id)
    with session.lock:
        session.meta_entries = [cand.Candidate(
            "delivery:D2", "O3", cand.ORIGIN_META,
            evidence="Candidate relates D2 to O3; source references O2 and must be reviewed.",
            provider="META", model="muse-spark-1.3", server_call_id="example-srv-call-001")]
        session.candidate_revision = 2
    req = review_request(session_id, candidate_revision=2, manual=[])
    body = op_review(req, store)
    assert (body["candidate_revision"], body["policy_revision"]) == (2, 1)
    assert body["candidate_catalog_sha256"] == "c81a620e1d70389cfae5b41a2d5dc933293ecafb052fe55e2b427f6cd7a9daab"
    assert body["policy_sha256"] == "91a0a5d819757b7b8b6b17b56a5c7b4526c246553c1642e367067c7366aaed0a"
    assert body["baseline_sha256"] == "a88d21b120afd518dae8c359e6508c2ff11036da96360498576c5d8ed65a1b66"
    assert body["review_sha256"] == "a11d1186c5de25cb42b048e7f2e124070ddbd1e2b24abc0d732680d0819d7b69"


def test_session_expiry_rejects_review():
    now = [1000.0]
    store = Store(clock=lambda: now[0])
    session_id = op_parse(files_payload(), store)["session_id"]
    now[0] += 31 * 60
    with pytest.raises(CommerceError) as caught:
        op_review(review_request(session_id), store)
    assert caught.value.code == "SESSION_EXPIRED"
    assert caught.value.http_status == 409


def _cap8_review(session_id):
    reason = "Reviewer permits a competing same-currency parent after record inspection."
    manual, rows, mapping = [], [], {}
    for i in range(1, 9):
        pid = f"P{i}"
        manual += [{"record_type": "payment", "record_id": pid, "target_id": t, "reason": reason}
                   for t in ("O2", "O3")]
        rows.append({"record_type": "payment", "record_id": pid,
                     "edges": [{"target_id": t, "disposition": "POSSIBLE"} for t in ("O1", "O2", "O3")],
                     "unmatched": "PROHIBITED"})
        mapping[f"payment:{pid}"] = "O1"
    return review_request(session_id, manual=manual, rows=rows, mapping=mapping, threshold_k=1)


def test_3_pow_8_cap_rejected_before_search():
    store, session_id = fresh_session("commerce_demo_cap8")
    err = expect_review_error(_cap8_review(session_id), store, "LIMIT_EXCEEDED", "review.options")
    assert err.details == {"raw_worlds_total": 6561, "max_raw_worlds": 4096,
                           "result_status": "NOT_VERIFIED"}
    session = store.get(session_id)
    assert session.state == "IMPORTED" and session.policy is None


def test_eleven_variables_rejected():
    payload = files_payload()
    orders = ["order_id,customer_id,order_total,currency", "O1,C1,100.00,USD",
              "O2,C2,100.00,USD", "O3,C3,100.00,USD"]
    pays = ["payment_id,order_ref,amount,currency,status"]
    for i in range(1, 12):
        pays.append(f"P{i},O1,{i}.00,USD,PENDING")
    payload["files"]["orders.csv"] = {"content_base64": b64_bytes(("\n".join(orders) + "\n").encode())}
    payload["files"]["payments.csv"] = {"content_base64": b64_bytes(("\n".join(pays) + "\n").encode())}
    payload["files"]["deliveries.csv"] = {
        "content_base64": b64_bytes(b"delivery_id,order_ref,status\n")}
    payload["files"]["refunds.csv"] = {
        "content_base64": b64_bytes(b"refund_id,payment_ref,amount,status\n")}
    store = Store()
    session_id = op_parse(payload, store)["session_id"]
    reason = "Second possible home for load testing."
    manual = [{"record_type": "payment", "record_id": f"P{i}", "target_id": "O2", "reason": reason}
              for i in range(1, 12)]
    rows = [{"record_type": "payment", "record_id": f"P{i}",
             "edges": [{"target_id": "O1", "disposition": "POSSIBLE"},
                       {"target_id": "O2", "disposition": "POSSIBLE"}],
             "unmatched": "PROHIBITED"} for i in range(1, 12)]
    mapping = {f"payment:P{i}": "O1" for i in range(1, 12)}
    req = review_request(session_id, manual=manual, rows=rows, mapping=mapping, threshold_k=1)
    err = expect_review_error(req, store, "LIMIT_EXCEEDED", "review.options")
    assert err.details["variable_records"] == 11


def test_three_alternatives_rejected():
    store, session_id = fresh_session("commerce_demo_cap8")
    req = _cap8_review(session_id)
    req["rows"][0]["unmatched"] = "POSSIBLE"
    err = expect_review_error(req, store, "LIMIT_EXCEEDED", "rows.payment:P1")
    assert err.details["alternatives"] == 3


def test_unreachable_choice_rejected():
    payload = files_payload()
    payload["files"]["orders.csv"] = {
        "content_base64": b64_bytes(b"order_id,customer_id,order_total,currency\n"
                                    b"O1,C1,100.00,USD\nO2,C2,100.00,USD\n")}
    payload["files"]["payments.csv"] = {
        "content_base64": b64_bytes(b"payment_id,order_ref,amount,currency,status\n"
                                    b"P1,O1,100.00,USD,SETTLED\nP2,O2,100.00,USD,SETTLED\n")}
    payload["files"]["deliveries.csv"] = {
        "content_base64": b64_bytes(b"delivery_id,order_ref,status\n"
                                    b"D1,O1,DELIVERED\nD2,O2,DELIVERED\n")}
    payload["files"]["refunds.csv"] = {
        "content_base64": b64_bytes(b"refund_id,payment_ref,amount,status\n")}
    store = Store()
    session_id = op_parse(payload, store)["session_id"]
    rows = [
        {"record_type": "payment", "record_id": "P1",
         "edges": [{"target_id": "O1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "payment", "record_id": "P2",
         "edges": [{"target_id": "O2", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "delivery", "record_id": "D1",
         "edges": [{"target_id": "O1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "delivery", "record_id": "D2",
         "edges": [{"target_id": "O2", "disposition": "POSSIBLE"},
                   {"target_id": "O1", "disposition": "POSSIBLE"}], "unmatched": "PROHIBITED"},
    ]
    mapping = {"payment:P1": "O1", "payment:P2": "O2", "delivery:D1": "O1", "delivery:D2": "O2"}
    manual = [{"record_type": "delivery", "record_id": "D2", "target_id": "O1",
               "reason": "Delivery may belong to the first order."}]
    req = review_request(session_id, manual=manual, rows=rows, mapping=mapping, threshold_k=1)
    err = expect_review_error(req, store, "UNREACHABLE_CHOICE", "rows.delivery:D2")
    assert err.details == {"target_id": "O1"}
