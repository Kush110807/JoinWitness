"""Receipt export and stateless replay matrix (service layer)."""
import copy

import pytest

from joinwitness.commerce import ENGINE_IDENTITY, canonical
from joinwitness.commerce.errors import CommerceError
from joinwitness.commerce.service import (
    op_challenge,
    op_parse,
    op_receipt,
    op_replay,
    op_review,
)
from joinwitness.commerce.session_state import Store

from tests.test_commerce_helpers import (
    b64_bytes,
    challenge_request,
    files_payload,
    fixture_bytes,
    review_request,
)

REVIEW_SHA = "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9"


def challenged_session(threshold_k=2):
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    frozen = op_review(review_request(session_id, threshold_k=threshold_k), store)
    challenged = op_challenge(challenge_request(session_id, frozen["review_sha256"]), store)
    return store, session_id, frozen, challenged


def receipt_request(session_id, run_id, review_sha=REVIEW_SHA):
    return {
        "contract_version": "commerce.v1",
        "session_id": session_id,
        "run_id": run_id,
        "expected_review_sha256": review_sha,
    }


def test_receipt_exports_current_run_with_valid_checksum():
    store, session_id, frozen, challenged = challenged_session()
    body = op_receipt(receipt_request(session_id, challenged["run_id"]), store)
    assert body["contract_version"] == "commerce.v1"
    assert body["attestation"] == "CONSISTENCY_HASH_ONLY_NOT_SIGNATURE"
    receipt = body["receipt"]
    assert receipt["format"] == "jw.commerce.receipt.v1"
    assert receipt["engine_identity"] == ENGINE_IDENTITY
    assert receipt["run_id"] == challenged["run_id"]
    assert receipt["review_sha256"] == REVIEW_SHA
    assert (receipt["source_revision"], receipt["candidate_revision"],
            receipt["policy_revision"]) == (1, 2, 1)
    assert receipt["result"] == challenged["result"]
    assert receipt["scope"] == {"max_orders": 50, "max_each_other_file": 60,
                                "max_variable_records": 10,
                                "max_alternatives_per_variable": 2, "max_raw_worlds": 4096}
    assert set(receipt["timings_ms"]) == {"parse", "search", "checker", "wall"}
    assert all(isinstance(value, int) for value in receipt["timings_ms"].values())
    core = {key: value for key, value in receipt.items() if key != "receipt_sha256"}
    assert canonical.domain_digest(canonical.DOMAIN_RECEIPT, core) == receipt["receipt_sha256"]


def test_receipt_unknown_run_rejected():
    store, session_id, _, _ = challenged_session()
    with pytest.raises(CommerceError) as caught:
        op_receipt(receipt_request(session_id, "0" * 32), store)
    assert caught.value.code == "RUN_NOT_FOUND"
    assert caught.value.http_status == 404
    assert caught.value.path == "run_id"


def test_receipt_before_challenge_rejected():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    op_review(review_request(session_id), store)
    with pytest.raises(CommerceError) as caught:
        op_receipt(receipt_request(session_id, "0" * 32), store)
    assert caught.value.code == "RUN_NOT_FOUND"


def test_receipt_stale_review_rejected():
    store, session_id, _, challenged = challenged_session()
    with pytest.raises(CommerceError) as caught:
        op_receipt(receipt_request(session_id, challenged["run_id"], "0" * 64), store)
    assert caught.value.code == "STALE_STATE"


def test_rereview_invalidates_old_run():
    store, session_id, _, challenged = challenged_session()
    old_run = challenged["run_id"]
    op_review(review_request(session_id, candidate_revision=2, policy_revision=1,
                             threshold_k=1), store)
    with pytest.raises(CommerceError) as caught:
        op_receipt(receipt_request(session_id, old_run), store)
    assert caught.value.code == "RUN_NOT_FOUND"


def test_replay_verifies_end_to_end():
    store, session_id, _, challenged = challenged_session()
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"]), store)["receipt"]
    body = op_replay({"contract_version": "commerce.v1", "receipt": receipt,
                      "files": files_payload()["files"]})
    assert body["contract_version"] == "commerce.v1"
    assert body["verification_status"] == "VERIFIED_REPLAY"
    assert (body["source_binding"], body["policy_binding"],
            body["receipt_integrity"]) == ("MATCH", "MATCH", "MATCH")
    assert body["engine_identity"] == ENGINE_IDENTITY
    assert body["independent_checker"] == "PASSED"
    assert body["recomputed"]["baseline_clean_count"] == 2
    assert body["recomputed"]["witness_clean_count"] == 1
    assert body["recomputed"]["link_distance"] == 1
    assert body["recomputed"]["coverage"]["checker_complete"] is True
    assert body["historical_receipt_only"] is True


def test_replay_stable_receipt_has_null_witness_counts():
    store = Store()
    session_id = op_parse(files_payload(), store)["session_id"]
    frozen = op_review(review_request(session_id, threshold_k=1), store)
    challenged = op_challenge(challenge_request(session_id, frozen["review_sha256"]), store)
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"],
                                         frozen["review_sha256"]), store)["receipt"]
    body = op_replay({"contract_version": "commerce.v1", "receipt": receipt,
                      "files": files_payload()["files"]})
    assert body["verification_status"] == "VERIFIED_REPLAY"
    assert body["recomputed"]["witness_clean_count"] is None
    assert body["recomputed"]["link_distance"] is None


def test_replay_is_stateless_without_session():
    store, session_id, _, challenged = challenged_session()
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"]), store)["receipt"]
    fresh_files = files_payload()["files"]
    body = op_replay({"contract_version": "commerce.v1", "receipt": copy.deepcopy(receipt),
                      "files": fresh_files})
    assert body["verification_status"] == "VERIFIED_REPLAY"


def test_replay_tampered_checksum_rejected():
    store, session_id, _, challenged = challenged_session()
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"]), store)["receipt"]
    receipt["receipt_sha256"] = "0" * 64
    with pytest.raises(CommerceError) as caught:
        op_replay({"contract_version": "commerce.v1", "receipt": receipt,
                   "files": files_payload()["files"]})
    assert caught.value.code == "RECEIPT_TAMPERED"
    assert caught.value.path == "receipt.receipt_sha256"
    assert caught.value.envelope()["verification_status"] == "NOT_VERIFIED"


def test_replay_tampered_result_rejected():
    store, session_id, _, challenged = challenged_session()
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"]), store)["receipt"]
    receipt["result"]["baseline"]["clean_fulfilled_count"] = 99
    core = {key: value for key, value in receipt.items() if key != "receipt_sha256"}
    receipt["receipt_sha256"] = canonical.domain_digest(canonical.DOMAIN_RECEIPT, core)
    with pytest.raises(CommerceError) as caught:
        op_replay({"contract_version": "commerce.v1", "receipt": receipt,
                   "files": files_payload()["files"]})
    assert caught.value.code == "RECEIPT_TAMPERED"


def test_replay_source_mismatch_on_crlf_bytes():
    store, session_id, _, challenged = challenged_session()
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"]), store)["receipt"]
    payload = files_payload()
    for name in payload["files"]:
        raw = fixture_bytes("commerce_demo", name).replace(b"\n", b"\r\n")
        payload["files"][name] = {"content_base64": b64_bytes(raw)}
    with pytest.raises(CommerceError) as caught:
        op_replay({"contract_version": "commerce.v1", "receipt": receipt,
                   "files": payload["files"]})
    assert caught.value.code == "SOURCE_MISMATCH"
    assert caught.value.http_status == 409


def test_replay_engine_mismatch_rejected():
    store, session_id, _, challenged = challenged_session()
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"]), store)["receipt"]
    receipt["engine_identity"] = "EXAMPLE-NOT-EXECUTED"
    core = {key: value for key, value in receipt.items() if key != "receipt_sha256"}
    receipt["receipt_sha256"] = canonical.domain_digest(canonical.DOMAIN_RECEIPT, core)
    with pytest.raises(CommerceError) as caught:
        op_replay({"contract_version": "commerce.v1", "receipt": receipt,
                   "files": files_payload()["files"]})
    assert caught.value.code == "ENGINE_VERSION_MISMATCH"
    assert caught.value.http_status == 409


def test_replay_invalid_files_propagate_import_code():
    store, session_id, _, challenged = challenged_session()
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"]), store)["receipt"]
    payload = files_payload()
    del payload["files"]["refunds.csv"]
    with pytest.raises(CommerceError) as caught:
        op_replay({"contract_version": "commerce.v1", "receipt": receipt,
                   "files": payload["files"]})
    assert caught.value.code == "MISSING_FILE"
    assert caught.value.envelope()["verification_status"] == "NOT_VERIFIED"


def test_replay_unknown_receipt_field_rejected():
    store, session_id, _, challenged = challenged_session()
    receipt = op_receipt(receipt_request(session_id, challenged["run_id"]), store)["receipt"]
    receipt["issuer_signature"] = "forged"
    with pytest.raises(CommerceError) as caught:
        op_replay({"contract_version": "commerce.v1", "receipt": receipt,
                   "files": files_payload()["files"]})
    assert caught.value.code == "RECEIPT_TAMPERED"
