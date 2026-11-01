"""Router tests: six frozen POST endpoints, guards and envelopes over HTTP."""
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.commerce_api import router as commerce_router

from tests.test_commerce_helpers import (
    challenge_request,
    files_payload,
    review_request,
)

HEADERS = {"X-JW-Local-Request": "1"}
PREFIX = "/api/commerce/v1"

REVIEW_SHA = "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9"


@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(commerce_router)
    with TestClient(app, base_url="http://127.0.0.1:8000",
                    client=("127.0.0.1", 50000),
                    raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture()
def foreign_client():
    app = FastAPI()
    app.include_router(commerce_router)
    with TestClient(app, base_url="http://testserver",
                    raise_server_exceptions=False) as test_client:
        yield test_client


def post(client, path, payload, headers=None):
    merged = dict(HEADERS)
    if headers:
        merged.update(headers)
    return client.post(PREFIX + path, json=payload, headers=merged)


def test_exactly_six_post_routes(client):
    routes = sorted(f"{','.join(sorted(r.methods))} {r.path}" for r in client.app.routes
                    if getattr(r, "path", "").startswith(PREFIX))
    assert routes == [
        "POST /api/commerce/v1/challenge",
        "POST /api/commerce/v1/parse",
        "POST /api/commerce/v1/receipt",
        "POST /api/commerce/v1/receipt/replay",
        "POST /api/commerce/v1/review/validate",
        "POST /api/commerce/v1/suggest",
    ]


def test_full_flow_over_http(client):
    parsed = post(client, "/parse", files_payload())
    assert parsed.status_code == 201, parsed.text
    session_id = parsed.json()["session_id"]
    assert parsed.json()["source_bundle_sha256"] == (
        "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50")

    suggested = post(client, "/suggest", {
        "contract_version": "commerce.v1", "session_id": session_id,
        "expected_source_revision": 1, "expected_candidate_revision": 1,
        "mode": "META", "max_suggestions": 5, "expected_policy_revision": 0})
    assert suggested.status_code == 200, suggested.text
    assert suggested.json()["ai_status"] == "AI_UNAVAILABLE"

    frozen = post(client, "/review/validate", review_request(session_id))
    assert frozen.status_code == 200, frozen.text
    assert frozen.json()["review_sha256"] == REVIEW_SHA

    challenged = post(client, "/challenge", challenge_request(session_id, REVIEW_SHA))
    assert challenged.status_code == 200, challenged.text
    assert challenged.json()["result"]["status"] == "REVERSED_EXHAUSTIVE"
    run_id = challenged.json()["run_id"]

    receipted = post(client, "/receipt", {
        "contract_version": "commerce.v1", "session_id": session_id, "run_id": run_id,
        "expected_review_sha256": REVIEW_SHA})
    assert receipted.status_code == 200, receipted.text
    receipt = receipted.json()["receipt"]

    replayed = post(client, "/receipt/replay", {
        "contract_version": "commerce.v1", "receipt": receipt,
        "files": files_payload()["files"]})
    assert replayed.status_code == 200, replayed.text
    assert replayed.json()["verification_status"] == "VERIFIED_REPLAY"


def test_missing_local_header_rejected(client):
    response = client.post(PREFIX + "/parse", json=files_payload())
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ACCESS_DENIED"


def test_non_loopback_peer_rejected(foreign_client):
    response = foreign_client.post(PREFIX + "/parse", json=files_payload(), headers=HEADERS)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ACCESS_DENIED"


def test_cross_origin_rejected(client):
    response = post(client, "/parse", files_payload(),
                    headers={"Origin": "http://evil.example"})
    assert response.status_code == 403


def test_same_origin_accepted(client):
    response = post(client, "/parse", files_payload(),
                    headers={"Origin": "http://127.0.0.1:8000"})
    assert response.status_code == 201


def test_cross_site_fetch_metadata_rejected(client):
    response = post(client, "/parse", files_payload(),
                    headers={"Sec-Fetch-Site": "cross-site"})
    assert response.status_code == 403


def test_wrong_content_type_rejected(client):
    response = client.post(PREFIX + "/parse", content="{}", headers=HEADERS)
    assert response.status_code == 415


def test_duplicate_json_key_rejected(client):
    raw = '{"contract_version": "commerce.v1", "files": {}, "files": {}}'
    response = client.post(PREFIX + "/parse", content=raw,
                           headers={**HEADERS, "Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_VALUE"


def test_malformed_json_rejected(client):
    response = client.post(PREFIX + "/parse", content="{oops",
                           headers={**HEADERS, "Content-Type": "application/json"})
    assert response.status_code == 422


def test_unknown_field_rejected_with_envelope(client):
    payload = files_payload()
    payload["trace"] = True
    response = post(client, "/parse", payload)
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "INVALID_VALUE"
    assert body["verified"] is False


def test_bool_threshold_rejected(client):
    session_id = post(client, "/parse", files_payload()).json()["session_id"]
    req = review_request(session_id)
    req["threshold_k"] = True
    response = post(client, "/review/validate", req)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_VALUE"


def test_invalid_review_envelope_over_http(client):
    session_id = post(client, "/parse", files_payload()).json()["session_id"]
    req = review_request(session_id)
    req["reference_mapping"]["delivery:D2"] = "O9"
    response = post(client, "/review/validate", req)
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "INVALID_BASELINE"
    assert body["error"]["path"] == "reference_mapping.delivery:D2"
    assert body["verified"] is False


def test_stale_challenge_over_http(client):
    session_id = post(client, "/parse", files_payload()).json()["session_id"]
    post(client, "/review/validate", review_request(session_id))
    response = post(client, "/challenge", challenge_request(session_id, "0" * 64))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "STALE_STATE"


def test_get_not_allowed(client):
    response = client.get(PREFIX + "/parse", headers=HEADERS)
    assert response.status_code == 405


def test_unknown_route_is_404(client):
    response = post(client, "/hydrate", {"contract_version": "commerce.v1"})
    assert response.status_code == 404


def test_privacy_headers_present(client):
    response = post(client, "/parse", files_payload())
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
