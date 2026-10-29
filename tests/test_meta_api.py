"""T08B restricted local paid-inference route; tests never access Meta network."""
from __future__ import annotations
import base64
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api import app
from backend import meta_api

F = Path(__file__).resolve().parents[1] / "fixtures" / "flagship_flip"
client = TestClient(app, base_url="http://127.0.0.1:8000", client=("127.0.0.1", 43210), raise_server_exceptions=False)


def payload():
    return {
        "registrations_b64": base64.b64encode((F / "registrations.csv").read_bytes()).decode("ascii"),
        "attendance_b64": base64.b64encode((F / "attendance.csv").read_bytes()).decode("ascii"),
        "explicitly_initiated": True,
        "synthetic_fixture_confirmed": True,
    }


@pytest.fixture(autouse=True)
def safe_env(monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.delenv("JW_META_LIVE_ENABLED", raising=False)
    monkeypatch.setenv("JW_T08B_LOCAL_TOKEN", "a" * 64)
    monkeypatch.setattr(meta_api, "_attempted", False)
    yield
    monkeypatch.setattr(meta_api, "_attempted", False)


def headers(token="a" * 64):
    return {"X-JW-Local-Token": token}


def enable(monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "not-an-actual-key")
    monkeypatch.setenv("JW_META_LIVE_ENABLED", "YES_EXPLICITLY_APPROVED")


def test_old_offline_endpoints_unchanged():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["mode"] == "OFFLINE_ONLY"
    r = client.post("/api/suggest", json={k: v for k, v in payload().items() if k.endswith('_b64')})
    assert r.status_code == 200 and r.json()["model_status"] == "NOT_CALLED_OFFLINE"


def test_reject_absent_token_without_any_call(monkeypatch):
    def fail(*a, **k): raise AssertionError("model must not be called")
    monkeypatch.setattr(meta_api, "run_one_meta_call", fail)
    r = client.post("/api/meta/suggest", json=payload())
    assert r.status_code == 403 and r.json()["detail"]["code"] == "LOCAL_AUTH_REQUIRED"


def test_reject_bad_token():
    r = client.post("/api/meta/suggest", json=payload(), headers=headers("wrong"))
    assert r.status_code == 403


def test_reject_disabled_api_even_with_token():
    r = client.post("/api/meta/suggest", json=payload(), headers=headers())
    assert r.status_code == 503 and r.json()["detail"]["code"] == "LIVE_MODEL_DISABLED"


def test_reject_missing_approval(monkeypatch):
    enable(monkeypatch)
    p = payload(); del p["explicitly_initiated"]
    assert client.post("/api/meta/suggest", json=p, headers=headers()).status_code == 422
    assert meta_api._attempted is False


def test_reject_false_attestation(monkeypatch):
    enable(monkeypatch)
    p = payload(); p["synthetic_fixture_confirmed"] = False
    assert client.post("/api/meta/suggest", json=p, headers=headers()).status_code == 422
    assert meta_api._attempted is False


def test_reject_altered_fixture_bytes(monkeypatch):
    enable(monkeypatch)
    p = payload(); raw = base64.b64decode(p["registrations_b64"]).replace(b"Kim Rao", b"Kimi Rao")
    p["registrations_b64"] = base64.b64encode(raw).decode("ascii")
    r = client.post("/api/meta/suggest", json=p, headers=headers())
    assert r.status_code == 422 and r.json()["detail"]["code"] == "SYNTHETIC_FIXTURE_MISMATCH"
    assert meta_api._attempted is False


def test_reject_foreign_origin(monkeypatch):
    enable(monkeypatch)
    r = client.post("/api/meta/suggest", json=payload(), headers={**headers(), "Origin": "https://evil.invalid"})
    assert r.status_code == 403 and meta_api._attempted is False


def test_accept_same_origin_preflight_free(monkeypatch):
    enable(monkeypatch)
    monkeypatch.setattr(meta_api, "run_one_meta_call", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("offline simulated failure")))
    r = client.post("/api/meta/suggest", json=payload(), headers={**headers(), "Origin": "http://127.0.0.1:8000"})
    assert r.status_code == 503 and r.json()["status"] == "AI_UNAVAILABLE"


def test_reject_non_loopback_client(monkeypatch):
    enable(monkeypatch)
    remote = TestClient(app, base_url="http://127.0.0.1:8000", client=("192.0.2.30", 8123), raise_server_exceptions=False)
    r = remote.post("/api/meta/suggest", json=payload(), headers=headers())
    assert r.status_code == 403 and r.json()["detail"]["code"] == "LOOPBACK_ONLY"


def test_reject_non_loopback_host(monkeypatch):
    enable(monkeypatch)
    r = client.post("/api/meta/suggest", json=payload(), headers={**headers(), "Host": "public.example"})
    assert r.status_code == 403


def test_provider_failure_returns_safe_shortlist(monkeypatch):
    enable(monkeypatch)
    def fail(*a, **k): raise RuntimeError("SECRET_NOT_FOR_HTTP")
    monkeypatch.setattr(meta_api, "run_one_meta_call", fail)
    r = client.post("/api/meta/suggest", json=payload(), headers=headers())
    assert r.status_code == 503
    d = r.json()
    assert d["status"] == "AI_UNAVAILABLE" and d["fallback"]["status"] == "UNREVIEWED_SHORTLIST"
    assert d["human_permissions_created"] is False and "SECRET_NOT_FOR_HTTP" not in r.text
    assert r.headers["cache-control"] == "no-store"


def test_failed_attempt_cannot_retry(monkeypatch):
    enable(monkeypatch)
    calls=[]
    def fail(*a, **k): calls.append(1); raise RuntimeError()
    monkeypatch.setattr(meta_api, "run_one_meta_call", fail)
    assert client.post("/api/meta/suggest", json=payload(), headers=headers()).status_code == 503
    r = client.post("/api/meta/suggest", json=payload(), headers=headers())
    assert r.status_code == 429 and len(calls) == 1


def test_simulated_transport_is_not_live(monkeypatch):
    enable(monkeypatch)
    monkeypatch.setattr(meta_api, "run_one_meta_call", lambda *a, **k: {
        "status":"SIMULATED_TRANSPORT_VALIDATED", "provider_evidence_type":"INJECTED_TEST_CLIENT"
    })
    r = client.post("/api/meta/suggest", json=payload(), headers=headers())
    assert r.status_code == 503 and r.json()["status"] == "AI_UNAVAILABLE"


def test_success_contract_with_stubbed_trusted_call_not_provider_evidence(monkeypatch):
    # This verifies the API shape only: it is NOT a genuine Meta SDK call.
    enable(monkeypatch)
    from joinwitness.candidates import build_shortlist, MODEL_PER_ROW, MODEL_TOTAL
    from backend.api import _bundle, SourceRequest
    bundle = _bundle(SourceRequest.model_validate({k: v for k, v in payload().items() if k.endswith("_b64")}))
    digest = build_shortlist(bundle, per_row_limit=MODEL_PER_ROW, total_limit=MODEL_TOTAL).shortlist_sha256
    monkeypatch.setattr(meta_api, "run_one_meta_call", lambda *a, **k: {
        "status":"LIVE_META_SUGGESTIONS_VALIDATED", "provider_evidence_type":"OBSERVED_LIVE_SDK_CALL",
        "human_permissions_created":False, "analytical_verification":"NOT_RUN",
        "request_count":1, "shortlist_sha256":digest, "suggestions":[],
    })
    r = client.post("/api/meta/suggest", json=payload(), headers=headers())
    assert r.status_code == 200 and r.json()["status"] == "UNREVIEWED_META_SUGGESTIONS"
    assert r.json()["human_permissions_created"] is False


def test_success_attempt_cannot_repeat(monkeypatch):
    enable(monkeypatch)
    monkeypatch.setattr(meta_api, "run_one_meta_call", lambda *a, **k: (_ for _ in ()).throw(RuntimeError()))
    client.post("/api/meta/suggest", json=payload(), headers=headers())
    assert client.post("/api/meta/suggest", json=payload(), headers=headers()).status_code == 429


def test_wrong_json_and_duplicate_key_refused():
    r = client.post("/api/meta/suggest", content=b"{}", headers={**headers(), "Content-Type": "text/plain"})
    assert r.status_code == 415
    raw = b'{"explicitly_initiated":true,"explicitly_initiated":true}'
    r = client.post("/api/meta/suggest", content=raw, headers={**headers(), "Content-Type": "application/json"})
    assert r.status_code == 422
