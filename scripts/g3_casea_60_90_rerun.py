"""G3 HQ-owned Case A 60/90 historical-results rerun (live HTTP).

Replays the protected demo60_90 investigation against the integrated app
and compares semantic outcomes to results/demo60_90_receipt.json:
verdict, proof basis, minimum changed assignments, review sha and
receipt sha. No fixture writes, no Meta calls.
"""
from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("G3_BASE", "http://127.0.0.1:8000")


def b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    fix = ROOT / "fixtures" / "demo60_90"
    stored = json.loads((ROOT / "results" / "demo60_90_receipt.json").read_text())
    policy = json.loads((fix / "review_policy.json").read_text())
    reference = json.loads((fix / "reference.json").read_text())
    sources = {
        "registrations_b64": b64(fix / "registrations.csv"),
        "attendance_b64": b64(fix / "attendance.csv"),
    }
    client = httpx.Client(base_url=BASE, timeout=120.0)

    r = client.post("/api/parse", json=sources)
    assert r.status_code == 200, r.text
    print(f"[PASS] 60-90-parse http={r.status_code}")

    r = client.post("/api/review/validate", json={**sources, "policy": policy})
    body = r.json()
    assert r.status_code == 200, r.text
    review_sha, revision = body["review_sha256"], body["review_revision"]
    print(f"[PASS] 60-90-review sha={review_sha[:12]} rev={revision}")

    r = client.post("/api/analyze", json={
        **sources, "policy": policy, "reference": reference,
        "expected_review_sha256": review_sha, "expected_revision": revision})
    assert r.status_code == 200, r.text
    got = r.json()
    exp_changed = stored["checker_result"]["recomputed_changed_assignments"]
    checks = {
        "verdict": (got["verdict"], stored["verdict"]),
        "proof_basis": (got["proof_basis"], stored["proof_basis"]),
        "minimum_changed_assignments": (got["minimum_changed_assignments"], exp_changed),
    }
    failed = {k: v for k, v in checks.items() if v[0] != v[1]}
    for name, (new, old) in checks.items():
        print(f"[{'PASS' if new == old else 'FAIL'}] 60-90-{name} live={new} stored={old}")
    if failed:
        raise SystemExit(f"60/90 regression mismatch: {sorted(failed)}")

    r = client.post("/api/receipt", json={
        **sources, "policy": policy, "reference": reference,
        "expected_review_sha256": review_sha, "expected_revision": revision})
    assert r.status_code == 200, r.text
    receipt = r.json()["receipt"]
    # Full-receipt equality excluding the wall-clock stamp (receipt_sha256
    # covers generated_utc, so a fresh stamp necessarily re-hashes).
    live_core = {k: v for k, v in receipt.items() if k not in ("generated_utc", "receipt_sha256")}
    stored_core = {k: v for k, v in stored.items() if k not in ("generated_utc", "receipt_sha256")}
    core_match = live_core == stored_core
    print(f"[{'PASS' if core_match else 'FAIL'}] 60-90-receipt-core "
          f"(excl. generated_utc+sha) stamp={receipt['generated_utc']}")
    if not core_match:
        raise SystemExit("60/90 receipt core mismatch")
    r = client.post("/api/verify", json={**sources, "policy": policy, "receipt": receipt})
    assert r.status_code == 200 and r.json()["verdict"] == stored["verdict"], r.text
    print(f"[PASS] 60-90-receipt-replay verdict={r.json()['verdict']}")
    print("G3 Case A 60/90 rerun: all checks passed.")


if __name__ == "__main__":
    sys.exit(main())
