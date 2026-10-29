"""JW-T08A request-boundary and real T02–T06 integration tests (Windows)."""
import base64
import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api import MAX_JSON_BYTES, app

F = Path(__file__).resolve().parents[1] / "fixtures"
client = TestClient(app, raise_server_exceptions=False)


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def inputs(case="flagship_flip"):
    d = F / case
    return {
        "registrations_b64": _b64((d / "registrations.csv").read_bytes()),
        "attendance_b64": _b64((d / "attendance.csv").read_bytes()),
    }


def full(case="flagship_flip"):
    d = F / case
    return {**inputs(case), "policy": json.loads((d / "review_policy.json").read_text()),
            "reference": json.loads((d / "reference.json").read_text())}


def analysis_payload(case="flagship_flip"):
    payload = full(case)
    r = client.post("/api/review/validate", json=payload)
    assert r.status_code == 200, r.text
    return {**payload, "expected_review_sha256": r.json()["review_sha256"],
            "expected_revision": r.json()["review_revision"]}


def test_health_explicit_offline():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["mode"] == "OFFLINE_ONLY"
    assert r.json()["live_meta_available"] is False
    assert r.json()["public_deployment_ready"] is False


def test_parse_real_source_rows():
    r = client.post("/api/parse", json=inputs())
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["registrations"]) == 4
    assert len(data["attendance"]) == 3
    assert data["analysis_status"] == "NOT_RUN"
    assert data["human_permissions_created"] is False
    assert len(data["registrations_digest"]["raw_sha256"]) == 64


def test_suggest_local_not_ai():
    r = client.post("/api/suggest", json=inputs())
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["model_status"] == "NOT_CALLED_OFFLINE"
    assert data["shortlist"]["coverage"] == "PARTIAL_UNREVIEWED"
    assert data["shortlist"]["human_permissions_created"] is False
    assert {(item["attendance_id"], item["registration_id"]) for item in data["shortlist"]["candidates"]} == {
        ("T-01", "R-A1"), ("T-02", "R-A2"), ("T-02", "R-B2"), ("T-03", "R-B1")}


def test_review_explicit_policy_and_reference():
    r = client.post("/api/review/validate", json=full())
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["baseline_counts"]["a"] == 2
    assert data["baseline_counts"]["b"] == 1
    assert data["review_revision"] == 1
    assert data["analysis_status"] == "NOT_RUN"


def test_review_without_reference_is_not_baseline():
    payload = full()
    del payload["reference"]
    r = client.post("/api/review/validate", json=payload)
    assert r.status_code == 200
    assert "baseline_counts" not in r.json()


def test_analyze_real_flagship_proven_minimum():
    r = client.post("/api/analyze", json=analysis_payload())
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["verdict"] == "REVERSIBLE_MINIMUM_PROVEN"
    assert data["checker_status"] == "WITNESS_VALID"
    assert data["oracle_status"] == "ORACLE_REVERSIBLE"
    assert data["minimum_changed_assignments"] == 1
    assert data["alternative_counts"]["a"] == 1
    assert data["alternative_counts"]["b"] == 2
    assert "reviewed" in data["scope_caveat"]


def test_analyze_stable_policy_scoped_only():
    r = client.post("/api/analyze", json=analysis_payload("stable"))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["verdict"] == "STABLE_WITHIN_REVIEWED_POLICY"
    assert d["oracle_status"] == "ORACLE_STABLE"
    assert d["witness_assignments"] is None
    assert d["minimum_changed_assignments"] is None


def test_receipt_created_and_replayed():
    p = analysis_payload()
    rec = client.post("/api/receipt", json=p)
    assert rec.status_code == 200, rec.text
    assert rec.json()["status"] == "RECEIPT_ISSUED"
    assert rec.json()["receipt"]["verdict"] == "REVERSIBLE_MINIMUM_PROVEN"
    replay = client.post("/api/verify", json={**inputs(), "policy": p["policy"], "receipt": rec.json()["receipt"]})
    assert replay.status_code == 200, replay.text
    assert replay.json()["status"] == "VERIFIED_REPLAY"
    assert replay.json()["receipt_sha256"] == rec.json()["receipt"]["receipt_sha256"]


def test_tampered_receipt_rejected():
    p = analysis_payload()
    rec = client.post("/api/receipt", json=p).json()["receipt"]
    rec["verdict"] = "STABLE_WITHIN_REVIEWED_POLICY"
    r = client.post("/api/verify", json={**inputs(), "policy": p["policy"], "receipt": rec})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "RECEIPT_DIGEST_MISMATCH"


def test_stale_review_digest_rejected_before_solver():
    p = analysis_payload()
    p["expected_review_sha256"] = "0" * 64
    r = client.post("/api/analyze", json=p)
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "REVIEW_SNAPSHOT_STALE"


def test_stale_review_revision_rejected():
    p = analysis_payload()
    p["expected_revision"] = 99
    assert client.post("/api/analyze", json=p).status_code == 409


def test_revision_change_after_review_invalidates_snapshot():
    p = analysis_payload()
    p["policy"]["revision"] = 2
    assert client.post("/api/analyze", json=p).status_code == 409


def test_invalid_reference_never_reaches_solver():
    p = analysis_payload()
    p["reference"]["assignments"][0]["registration_id"] = "R-FAKE"
    r = client.post("/api/analyze", json=p)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "INPUT_OR_POLICY_REJECTED"


def test_unknown_field_rejected():
    r = client.post("/api/parse", json={**inputs(), "auto_approve": True})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "INVALID_REQUEST_SCHEMA"


def test_noncanonical_base64_rejected():
    p = inputs()
    p["registrations_b64"] = "aa=="
    r = client.post("/api/parse", json=p)
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "INVALID_SOURCE_ENCODING"


def test_duplicate_json_authority_key_rejected():
    p = inputs()
    raw = '{"registrations_b64":"'+p["registrations_b64"]+'","registrations_b64":"'+p["registrations_b64"]+'","attendance_b64":"'+p["attendance_b64"]+'"}'
    r = client.post("/api/parse", data=raw, headers={"content-type": "application/json"})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "INVALID_REQUEST_SCHEMA"


def test_payload_larger_than_limit():
    r = client.post("/api/parse", content=b"x" * (MAX_JSON_BYTES+1), headers={"content-type":"application/json"})
    assert r.status_code == 413


def test_non_json_content_type_rejected():
    r = client.post("/api/parse", content=b"{}", headers={"content-type":"text/plain"})
    assert r.status_code == 415


def test_privacy_headers_on_success():
    r = client.get("/api/health")
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["x-content-type-options"] == "nosniff"


def test_no_cors_or_live_meta_proxy():
    r = client.post("/api/meta/live", json=inputs())
    assert r.status_code == 404
    assert "access-control-allow-origin" not in r.headers


def test_bad_policy_rejected():
    p = full()
    p["policy"]["closed_scope_attested"] = False
    r = client.post("/api/review/validate", json=p)
    assert r.status_code == 422


def test_source_byte_change_rejects_replay():
    p = analysis_payload()
    rec = client.post("/api/receipt", json=p).json()["receipt"]
    changed = inputs()
    csv = base64.b64decode(changed["registrations_b64"]).replace(b"Amara Shah", b"Amara Shaha")
    changed["registrations_b64"] = _b64(csv)
    r = client.post("/api/verify", json={**changed, "policy": p["policy"], "receipt": rec})
    assert r.status_code == 422


def test_missing_source_rejected():
    p = inputs()
    p["attendance_b64"] = _b64(b"attendance_id,recorded_name\n")
    r = client.post("/api/parse", json=p)
    assert r.status_code == 422
