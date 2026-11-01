"""Challenge, search semantics and independent checker matrix (service layer)."""
import pytest

from joinwitness.commerce import independent_checker as checker_mod
from joinwitness.commerce.errors import CommerceError
from joinwitness.commerce.service import op_challenge, op_parse, op_review
from joinwitness.commerce.session_state import Store

from tests.test_commerce_helpers import (
    b64_bytes,
    challenge_request,
    files_payload,
    review_request,
)

REVIEW_SHA = "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9"
STABLE_REVIEW_SHA = "0c298a4f34adce5ee5fac514cefafcc1dd7a300fa066500eea9db7787b23a85b"


def reviewed_session(threshold_k=2):
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    frozen = op_review(review_request(session_id, threshold_k=threshold_k), store)
    return store, session_id, frozen


def test_measured_reversal_k2():
    store, session_id, frozen = reviewed_session()
    assert frozen["review_sha256"] == REVIEW_SHA
    body = op_challenge(challenge_request(session_id, REVIEW_SHA), store)
    assert body["state"] == "CHALLENGED"
    assert len(body["run_id"]) == 32
    assert (body["source_revision"], body["candidate_revision"], body["policy_revision"]) == (1, 2, 1)
    assert body["review_sha256"] == REVIEW_SHA
    result = body["result"]
    assert result["status"] == "REVERSED_EXHAUSTIVE"
    assert result["predicate"] == "clean_fulfilled_count >= K"
    assert result["threshold_k"] == 2
    assert result["baseline"] == {"clean_fulfilled_count": 2, "decision": True}
    assert result["witness"] == {
        "reference_changes": [
            {"record_key": "delivery:D2", "from_target_id": "O2", "to_target_id": "O3"}
        ],
        "clean_fulfilled_count": 1,
        "decision": False,
        "link_distance": 1,
    }
    assert result["coverage"] == {
        "raw_worlds_total": 2, "raw_worlds_checked": 2,
        "invalid_worlds_total": 0, "invalid_worlds_checked": 0,
        "admissible_worlds_total": 2, "admissible_worlds_checked": 2,
        "checker_worlds_total": 2, "checker_worlds_checked": 2,
        "fully_enumerated": True, "checker_complete": True,
    }
    assert result["checker_status"] == "PASSED"
    assert result["proof_basis"] == "EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION"
    assert result["minimum_distance_proven_within_scope"] is True
    assert result["reason"] is None
    assert result["minimum_link_distance_within_scope"] == 1


def test_measured_stable_k1_with_frozen_stable_digest():
    store, session_id, frozen = reviewed_session(threshold_k=1)
    assert frozen["review_sha256"] == STABLE_REVIEW_SHA
    assert frozen["policy_sha256"] == "706acbcd45e5fb82c82a118f93daea9bb10dc685a003998679c7047660511c77"
    body = op_challenge(challenge_request(session_id, STABLE_REVIEW_SHA), store)
    result = body["result"]
    assert result["status"] == "STABLE_WITHIN_SCOPE"
    assert result["baseline"] == {"clean_fulfilled_count": 2, "decision": True}
    assert result["witness"] is None
    assert result["checker_status"] == "PASSED"
    assert result["minimum_distance_proven_within_scope"] is False
    assert result["minimum_link_distance_within_scope"] is None
    assert result["coverage"]["fully_enumerated"] is True
    assert result["coverage"]["checker_complete"] is True


def test_challenge_before_review_is_stale():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    with pytest.raises(CommerceError) as caught:
        op_challenge(challenge_request(session_id, "0" * 64, policy_revision=0,
                                       candidate_revision=1), store)
    assert caught.value.code == "STALE_STATE"
    assert caught.value.http_status == 409


def test_challenge_stale_review_sha():
    store, session_id, _ = reviewed_session()
    with pytest.raises(CommerceError) as caught:
        op_challenge(challenge_request(session_id, "0" * 64), store)
    assert caught.value.code == "STALE_STATE"
    assert caught.value.path == "expected_review_sha256"


@pytest.mark.parametrize("bad", [99, 10001, 0, "10000", None, True])
def test_bad_budget_rejected(bad):
    store, session_id, _ = reviewed_session()
    req = challenge_request(session_id, REVIEW_SHA)
    req["time_budget_ms"] = bad
    with pytest.raises(CommerceError) as caught:
        op_challenge(req, store)
    assert caught.value.code == "INVALID_VALUE"


def test_default_budget_when_omitted():
    store, session_id, _ = reviewed_session()
    req = challenge_request(session_id, REVIEW_SHA)
    del req["time_budget_ms"]
    body = op_challenge(req, store)
    assert body["result"]["status"] == "REVERSED_EXHAUSTIVE"


def test_timeout_returns_not_verified_without_receipt():
    store, session_id, _ = reviewed_session()
    ticks = [0.0]

    def clock():
        ticks[0] += 60.0
        return ticks[0]

    body = op_challenge(challenge_request(session_id, REVIEW_SHA, budget=100), store, clock)
    assert body["state"] == "REVIEW_FROZEN"
    assert body["run_id"] is None
    result = body["result"]
    assert result["status"] == "NOT_VERIFIED"
    assert result["reason"] == "TIMEOUT"
    assert result["baseline"] is None and result["witness"] is None
    assert result["checker_status"] == "UNRUN"
    assert result["proof_basis"] == "NONE"
    assert result["coverage"]["raw_worlds_total"] == 2
    assert result["coverage"]["fully_enumerated"] is False
    assert result["coverage"]["checker_complete"] is False
    assert result["coverage"]["admissible_worlds_total"] is None
    session = store.get(session_id)
    assert session.run is None and session.state == "REVIEW_FROZEN"


def test_checker_mismatch_returns_not_verified():
    store, session_id, _ = reviewed_session()
    real_verify = checker_mod.verify

    def lying_verify(*args, **kwargs):
        verdict = real_verify(*args, **kwargs)
        return checker_mod.CheckerVerdict(False, 1, "COVERAGE", verdict.recomputed_raw_total,
                                          verdict.recomputed_invalid_total,
                                          verdict.recomputed_admissible_total)

    checker_mod.verify = lying_verify
    try:
        body = op_challenge(challenge_request(session_id, REVIEW_SHA), store)
    finally:
        checker_mod.verify = real_verify
    result = body["result"]
    assert body["run_id"] is None
    assert result["status"] == "NOT_VERIFIED"
    assert result["reason"] == "CHECKER_MISMATCH"
    assert result["baseline"] is None and result["witness"] is None
    assert result["checker_status"] == "FAILED"
    assert result["coverage"]["fully_enumerated"] is True
    assert result["coverage"]["admissible_worlds_total"] == 2
    assert result["coverage"]["checker_worlds_checked"] == 1
    assert result["coverage"]["checker_complete"] is False
    assert store.get(session_id).run is None


def test_checker_exception_returns_engine_interrupted():
    store, session_id, _ = reviewed_session()
    real_verify = checker_mod.verify

    def broken_verify(*args, **kwargs):
        raise RuntimeError("checker blew up")

    checker_mod.verify = broken_verify
    try:
        body = op_challenge(challenge_request(session_id, REVIEW_SHA), store)
    finally:
        checker_mod.verify = real_verify
    assert body["result"]["status"] == "NOT_VERIFIED"
    assert body["result"]["reason"] == "ENGINE_INTERRUPTED"
    assert body["result"]["checker_status"] == "FAILED"


def test_coverage_invariants_hold():
    store, session_id, _ = reviewed_session()
    coverage = op_challenge(challenge_request(session_id, REVIEW_SHA), store)["result"]["coverage"]
    assert set(coverage) == {"raw_worlds_total", "raw_worlds_checked", "invalid_worlds_total",
                             "invalid_worlds_checked", "admissible_worlds_total",
                             "admissible_worlds_checked", "checker_worlds_total",
                             "checker_worlds_checked", "fully_enumerated", "checker_complete"}
    assert coverage["raw_worlds_checked"] == (coverage["invalid_worlds_checked"]
                                              + coverage["admissible_worlds_checked"])
    assert coverage["checker_worlds_checked"] <= coverage["admissible_worlds_checked"]
    assert (coverage["invalid_worlds_total"] + coverage["admissible_worlds_total"]
            == coverage["raw_worlds_total"])


def test_tie_break_picks_null_first_lexicographic_tuple():
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
         "edges": [{"target_id": "O1", "disposition": "POSSIBLE"}], "unmatched": "POSSIBLE"},
        {"record_type": "payment", "record_id": "P2",
         "edges": [{"target_id": "O2", "disposition": "POSSIBLE"}], "unmatched": "POSSIBLE"},
        {"record_type": "delivery", "record_id": "D1",
         "edges": [{"target_id": "O1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "delivery", "record_id": "D2",
         "edges": [{"target_id": "O2", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
    ]
    mapping = {"payment:P1": "O1", "payment:P2": "O2", "delivery:D1": "O1", "delivery:D2": "O2"}
    frozen = op_review(review_request(session_id, manual=[], rows=rows,
                                      mapping=mapping, threshold_k=2), store)
    assert frozen["raw_worlds"] == 4
    result = op_challenge(challenge_request(session_id, frozen["review_sha256"],
                                            candidate_revision=1), store)["result"]
    assert result["status"] == "REVERSED_EXHAUSTIVE"
    assert result["baseline"] == {"clean_fulfilled_count": 2, "decision": True}
    assert result["witness"]["link_distance"] == 1
    assert result["witness"]["reference_changes"] == [
        {"record_key": "payment:P1", "from_target_id": "O1", "to_target_id": None}
    ]


def test_partial_completed_refund_disqualifies_order():
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
        "content_base64": b64_bytes(b"refund_id,payment_ref,amount,status\n"
                                    b"R1,P1,5.00,COMPLETED\n")}
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
         "edges": [{"target_id": "O2", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "refund", "record_id": "R1",
         "edges": [{"target_id": "P1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
    ]
    mapping = {"payment:P1": "O1", "payment:P2": "O2", "delivery:D1": "O1",
               "delivery:D2": "O2", "refund:R1": "P1"}
    frozen = op_review(review_request(session_id, manual=[], rows=rows,
                                      mapping=mapping, threshold_k=2), store)
    result = op_challenge(challenge_request(session_id, frozen["review_sha256"],
                                            candidate_revision=1), store)["result"]
    assert result["status"] == "STABLE_WITHIN_SCOPE"
    assert result["baseline"] == {"clean_fulfilled_count": 1, "decision": False}


def test_refund_reassignment_moves_disqualification():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    manual = [{"record_type": "refund", "record_id": "R1", "target_id": "P1",
               "reason": "Refund receipt names the first payment."}]
    rows = [
        {"record_type": "payment", "record_id": "P1",
         "edges": [{"target_id": "O1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "payment", "record_id": "P2",
         "edges": [{"target_id": "O2", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "payment", "record_id": "P3",
         "edges": [{"target_id": "O3", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "delivery", "record_id": "D1",
         "edges": [{"target_id": "O1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "delivery", "record_id": "D2",
         "edges": [{"target_id": "O2", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "delivery", "record_id": "D3",
         "edges": [{"target_id": "O3", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
        {"record_type": "refund", "record_id": "R1",
         "edges": [{"target_id": "P3", "disposition": "PROHIBITED"},
                   {"target_id": "P1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
    ]
    mapping = dict({"payment:P1": "O1", "payment:P2": "O2", "payment:P3": "O3",
                    "delivery:D1": "O1", "delivery:D2": "O2", "delivery:D3": "O3",
                    "refund:R1": "P1"})
    frozen = op_review(review_request(session_id, manual=manual, rows=rows,
                                      mapping=mapping, threshold_k=1), store)
    assert frozen["raw_worlds"] == 1
    result = op_challenge(challenge_request(session_id, frozen["review_sha256"]), store)["result"]
    assert result["baseline"] == {"clean_fulfilled_count": 1, "decision": True}
    assert result["status"] == "STABLE_WITHIN_SCOPE"


def test_empty_optionals_challenge_is_stable_single_world():
    store = Store()
    session_id = op_parse(files_payload("commerce_demo_empty"), store)["session_id"]
    frozen = op_review(review_request(session_id, manual=[], rows=[], mapping={},
                                      threshold_k=1), store)
    body = op_challenge(challenge_request(session_id, frozen["review_sha256"],
                                          candidate_revision=1), store)
    result = body["result"]
    assert result["status"] == "STABLE_WITHIN_SCOPE"
    assert result["baseline"] == {"clean_fulfilled_count": 0, "decision": False}
    assert result["coverage"]["raw_worlds_total"] == 1
    assert result["checker_status"] == "PASSED"


def test_near_cap_run_completes_with_checker_inside_budget():
    import time
    store = Store()
    session_id = op_parse(files_payload("commerce_demo_cap8"), store)["session_id"]
    reason = "Reviewer permits a competing same-currency parent after record inspection."
    manual, rows, mapping = [], [], {}
    for i in range(1, 9):
        pid = f"P{i}"
        targets = ("O1", "O2", "O3") if i <= 6 else ("O1", "O2")
        for target in targets[1:]:
            manual.append({"record_type": "payment", "record_id": pid,
                           "target_id": target, "reason": reason})
        rows.append({"record_type": "payment", "record_id": pid,
                     "edges": [{"target_id": t, "disposition": "POSSIBLE"} for t in targets],
                     "unmatched": "PROHIBITED"})
        mapping[f"payment:{pid}"] = "O1"
    frozen = op_review(review_request(session_id, manual=manual, rows=rows,
                                      mapping=mapping, threshold_k=1), store)
    assert frozen["raw_worlds"] == 3 ** 6 * 2 ** 2 == 2916
    start = time.monotonic()
    body = op_challenge(challenge_request(session_id, frozen["review_sha256"]), store)
    wall_ms = (time.monotonic() - start) * 1000
    result = body["result"]
    assert result["checker_status"] == "PASSED"
    assert result["coverage"]["checker_worlds_checked"] == 2916
    assert result["coverage"]["checker_complete"] is True
    assert wall_ms < 10000, f"near-cap run took {wall_ms:.0f} ms"
    print(f"\nnear-cap 2916-world search+checker wall: {wall_ms:.0f} ms")


def test_checker_does_not_import_search():
    source = (checker_mod.__file__ or "")
    with open(source, encoding="utf-8") as handle:
        text = handle.read()
    assert "from .worlds" not in text and "from joinwitness.commerce.worlds" not in text
    assert "import worlds" not in text
