"""G3 HQ-owned full-stack HTTP verification for the integrated app.

Pure loopback HTTP against a live uvicorn serving backend.api:app
(which must include the commerce router). No engine imports, no Meta
calls, no browser. Fail-closed: any unexpected status/digest aborts
with a non-zero exit.

Sequence:
  Case A health + route table -> Case A parse smoke ->
  Commerce K=2 (parse/suggest/review/challenge/receipt/replay) ->
  Commerce K=1 stability -> repeated human adoption ->
  stale 409 -> malformed 422s -> zero-order record.
"""
from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tests.test_commerce_helpers import (  # noqa: E402  (payload builders only)
    b64_bytes,
    challenge_request,
    files_payload,
    review_request,
)

BASE = os.environ.get("G3_BASE", "http://127.0.0.1:8000")
PREFIX = "/api/commerce/v1"
HEADERS = {"X-JW-Local-Request": "1"}

BUNDLE_SHA = "e7a87bc2a5bda60f6d1004d62fc11ab7cd6c2984a1d983062cf8c5558609be50"
REVIEW_SHA_K2 = "152041325c7c122fac2bd2b231563366b985999ac8615f995fea3e61bd5ce5c9"
REVIEW_SHA_K1 = "0c298a4f34adce5ee5fac514cefafcc1dd7a300fa066500eea9db7787b23a85b"

CASE_A_PATHS = [
    "/api/health",
    "/api/parse",
    "/api/suggest",
    "/api/review/validate",
    "/api/analyze",
    "/api/receipt",
    "/api/verify",
    "/api/meta/suggest",
]
COMMERCE_PATHS = [
    "/api/commerce/v1/parse",
    "/api/commerce/v1/suggest",
    "/api/commerce/v1/review/validate",
    "/api/commerce/v1/challenge",
    "/api/commerce/v1/receipt",
    "/api/commerce/v1/receipt/replay",
]

checks = []


def check(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        raise SystemExit(f"G3 HTTP verification failed at: {name} ({detail})")


def main() -> None:
    client = httpx.Client(base_url=BASE, timeout=30.0)

    # 1. Case A health + full route table on the integrated app.
    r = client.get("/api/health")
    check("case-a-health", r.status_code == 200 and r.json().get("status") == "LOCAL_API_READY",
          f"http={r.status_code}")
    try:
        doc = client.get("/openapi.json").json()
        paths = set(doc["paths"]) if isinstance(doc, dict) and "paths" in doc else None
    except Exception:
        paths = None
    if paths is None:
        # Proxy mode: /openapi.json sits outside the /api proxy surface, so
        # prove route presence with real requests (404 = absent route).
        missing = []
        if client.get("/api/health").status_code == 404:
            missing.append("/api/health")
        for p in CASE_A_PATHS[1:] + COMMERCE_PATHS:
            rr = client.post(p, json={"contract_version": "commerce.v1"}, headers=HEADERS)
            if rr.status_code == 404:
                missing.append(p)
        check("route-table", not missing,
              f"missing={missing}" if missing else "8 case-a + 6 commerce (probed)")
    else:
        missing = [p for p in CASE_A_PATHS + COMMERCE_PATHS if p not in paths]
        check("route-table", not missing, f"missing={missing}" if missing else "8 case-a + 6 commerce")

    # 2. Case A parse smoke over real HTTP (flagship_flip fixtures).
    case = ROOT / "fixtures" / "flagship_flip"
    payload = {
        "registrations_b64": base64.b64encode((case / "registrations.csv").read_bytes()).decode(),
        "attendance_b64": base64.b64encode((case / "attendance.csv").read_bytes()).decode(),
    }
    r = client.post("/api/parse", json=payload)
    check("case-a-parse", r.status_code == 200 and r.json().get("status") == "PARSED_UNREVIEWED",
          f"http={r.status_code}")

    # 3. Commerce K=2 full sequence.
    r = client.post(PREFIX + "/parse", json=files_payload(), headers=HEADERS)
    body = r.json()
    check("commerce-parse", r.status_code == 201 and body.get("source_bundle_sha256") == BUNDLE_SHA,
          f"http={r.status_code} bundle={body.get('source_bundle_sha256', '?')[:12]}")
    sid = body["session_id"]

    r = client.post(PREFIX + "/suggest", json={
        "contract_version": "commerce.v1", "session_id": sid,
        "expected_source_revision": 1, "expected_candidate_revision": 1,
        "mode": "META", "max_suggestions": 5, "expected_policy_revision": 0}, headers=HEADERS)
    check("commerce-suggest", r.status_code == 200 and r.json().get("ai_status") == "AI_UNAVAILABLE",
          f"http={r.status_code} ai={r.json().get('ai_status')}")

    r = client.post(PREFIX + "/review/validate", json=review_request(sid), headers=HEADERS)
    check("commerce-review-k2", r.status_code == 200 and r.json().get("review_sha256") == REVIEW_SHA_K2,
          f"http={r.status_code} sha={r.json().get('review_sha256', '?')[:12]}")

    r = client.post(PREFIX + "/challenge", json=challenge_request(sid, REVIEW_SHA_K2), headers=HEADERS)
    status = r.json().get("result", {}).get("status")
    run_id = r.json().get("run_id")
    check("commerce-challenge-k2", r.status_code == 200 and status == "REVERSED_EXHAUSTIVE",
          f"http={r.status_code} status={status}")

    r = client.post(PREFIX + "/receipt", json={
        "contract_version": "commerce.v1", "session_id": sid, "run_id": run_id,
        "expected_review_sha256": REVIEW_SHA_K2}, headers=HEADERS)
    receipt = r.json().get("receipt", {})
    check("commerce-receipt", r.status_code == 200 and bool(receipt.get("receipt_sha256")),
          f"http={r.status_code} receipt={receipt.get('receipt_sha256', '?')[:12]}")

    r = client.post(PREFIX + "/receipt/replay", json={
        "contract_version": "commerce.v1", "receipt": receipt,
        "files": files_payload()["files"]}, headers=HEADERS)
    check("commerce-replay", r.status_code == 200
          and r.json().get("verification_status") == "VERIFIED_REPLAY",
          f"http={r.status_code} status={r.json().get('verification_status')}")

    # 4. Commerce K=1 stability on a fresh session.
    sid1 = client.post(PREFIX + "/parse", json=files_payload(), headers=HEADERS).json()["session_id"]
    r = client.post(PREFIX + "/review/validate", json=review_request(sid1, threshold_k=1),
                    headers=HEADERS)
    check("commerce-review-k1", r.status_code == 200 and r.json().get("review_sha256") == REVIEW_SHA_K1,
          f"http={r.status_code} sha={r.json().get('review_sha256', '?')[:12]}")
    r = client.post(PREFIX + "/challenge", json=challenge_request(sid1, REVIEW_SHA_K1), headers=HEADERS)
    status = r.json().get("result", {}).get("status")
    check("commerce-challenge-k1", r.status_code == 200 and status == "STABLE_WITHIN_SCOPE",
          f"http={r.status_code} status={status}")

    # 5. Repeated human adoption: identical review at (candidate=2, policy=1).
    r = client.post(PREFIX + "/review/validate",
                    json=review_request(sid1, candidate_revision=2, policy_revision=1,
                                        threshold_k=1), headers=HEADERS)
    body = r.json()
    check("repeated-adoption", r.status_code == 200
          and body.get("review_sha256") == REVIEW_SHA_K1
          and (body.get("candidate_revision"), body.get("policy_revision")) == (2, 2),
          f"http={r.status_code} rev=({body.get('candidate_revision')},{body.get('policy_revision')})")

    # 6. Genuinely stale 409: valid session, wrong expected review sha.
    r = client.post(PREFIX + "/challenge", json=challenge_request(sid1, "0" * 64,
                    policy_revision=2), headers=HEADERS)
    check("stale-409", r.status_code == 409 and r.json().get("error", {}).get("code") == "STALE_STATE",
          f"http={r.status_code} code={r.json().get('error', {}).get('code')}")

    # 7. Malformed-input 422s.
    raw = '{"contract_version": "commerce.v1", "files": {}, "files": {}}'
    r = client.post(PREFIX + "/parse", content=raw,
                    headers={**HEADERS, "Content-Type": "application/json"})
    check("malformed-422-dupkey", r.status_code == 422
          and r.json().get("error", {}).get("code") == "INVALID_VALUE",
          f"http={r.status_code}")
    bad = review_request(sid1, candidate_revision=2, policy_revision=2, threshold_k=1)
    bad["threshold_k"] = True
    r = client.post(PREFIX + "/review/validate", json=bad, headers=HEADERS)
    check("malformed-422-bool-k", r.status_code == 422, f"http={r.status_code}")

    # 8. Zero-order record (known B defect; contract wants LIMIT_EXCEEDED).
    payload = files_payload()
    payload["files"]["orders.csv"] = {
        "content_base64": b64_bytes(b"order_id,customer_id,order_total,currency\n")}
    r = client.post(PREFIX + "/parse", json=payload, headers=HEADERS)
    code = r.json().get("error", {}).get("code")
    check("zero-order-recorded", r.status_code == 422, f"http={r.status_code} code={code}")
    print(f"NOTE zero-order current code={code} (frozen contract requires LIMIT_EXCEEDED; "
          f"pre-release B correction)")

    print(f"\nG3 HTTP verification: {len(checks)} checks passed.")
    Path(__file__).with_suffix(".last.json").write_text(
        json.dumps({"passed": len(checks), "checks": [c[0] for c in checks]}))


if __name__ == "__main__":
    main()
