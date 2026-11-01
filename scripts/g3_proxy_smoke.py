"""G3 HQ-owned Vite proxy smoke: both investigations via the dev proxy.

VITE_BASE points at the running Vite dev server (default 5173); the proxy
target is whatever the dev config forwards /api to (G3 backend).
"""
from __future__ import annotations

import base64
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tests.test_commerce_helpers import files_payload  # noqa: E402

VITE_BASE = os.environ.get("G3_VITE_BASE", "http://127.0.0.1:5173")


def main() -> None:
    client = httpx.Client(base_url=VITE_BASE, timeout=30.0)
    r = client.get("/")
    assert r.status_code == 200 and 'id="root"' in r.text, r.status_code
    print(f"[PASS] proxy-index http={r.status_code}")

    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "LOCAL_API_READY", r.text
    print(f"[PASS] proxy-case-a-health status={r.json()['status']}")

    case = ROOT / "fixtures" / "flagship_flip"
    r = client.post("/api/parse", json={
        "registrations_b64": base64.b64encode((case / "registrations.csv").read_bytes()).decode(),
        "attendance_b64": base64.b64encode((case / "attendance.csv").read_bytes()).decode()})
    assert r.status_code == 200 and r.json()["status"] == "PARSED_UNREVIEWED", r.text
    print(f"[PASS] proxy-case-a-parse status={r.json()['status']}")

    r = client.post("/api/commerce/v1/parse", json=files_payload(),
                    headers={"X-JW-Local-Request": "1"})
    assert r.status_code == 201, r.text
    print(f"[PASS] proxy-case-b-parse bundle={r.json()['source_bundle_sha256'][:12]}")
    print("G3 proxy smoke: all checks passed.")


if __name__ == "__main__":
    main()
