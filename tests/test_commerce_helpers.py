"""Shared helpers for the commerce.v1 test suite (no tests live here)."""
import base64
import copy
from pathlib import Path

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"
FILES = ("orders.csv", "payments.csv", "deliveries.csv", "refunds.csv")

REASON_D2_O3 = "Carrier reference may have been copied from a neighbouring order."

BASELINE_MAP = {
    "payment:P1": "O1",
    "payment:P2": "O2",
    "payment:P3": "O3",
    "delivery:D1": "O1",
    "delivery:D2": "O2",
    "delivery:D3": "O3",
    "refund:R1": "P3",
}

ROWS_7 = [
    {"record_type": "payment", "record_id": "P1",
     "edges": [{"target_id": "O1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
    {"record_type": "payment", "record_id": "P2",
     "edges": [{"target_id": "O2", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
    {"record_type": "payment", "record_id": "P3",
     "edges": [{"target_id": "O3", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
    {"record_type": "delivery", "record_id": "D1",
     "edges": [{"target_id": "O1", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
    {"record_type": "delivery", "record_id": "D2",
     "edges": [{"target_id": "O2", "disposition": "POSSIBLE"},
               {"target_id": "O3", "disposition": "POSSIBLE"}], "unmatched": "PROHIBITED"},
    {"record_type": "delivery", "record_id": "D3",
     "edges": [{"target_id": "O3", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
    {"record_type": "refund", "record_id": "R1",
     "edges": [{"target_id": "P3", "disposition": "CONFIRMED"}], "unmatched": "PROHIBITED"},
]

MANUAL_D2_O3 = [
    {"record_type": "delivery", "record_id": "D2", "target_id": "O3", "reason": REASON_D2_O3}
]

ATTESTATION = {
    "all_rows_reviewed": True,
    "understands_bounded_predicate": True,
    "conflicting_source_ref_overrides_explained": True,
}


def b64_bytes(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def fixture_bytes(bundle: str, name: str) -> bytes:
    return (FIXTURES / bundle / name).read_bytes()


def files_payload(bundle: str = "commerce_demo") -> dict:
    return {
        "contract_version": "commerce.v1",
        "files": {
            name: {"content_base64": b64_bytes(fixture_bytes(bundle, name))} for name in FILES
        },
    }


def review_request(
    session_id: str,
    candidate_revision: int = 1,
    policy_revision: int = 0,
    threshold_k: int = 2,
    manual: list | None = None,
    rows: list | None = None,
    mapping: dict | None = None,
) -> dict:
    return {
        "contract_version": "commerce.v1",
        "session_id": session_id,
        "expected_source_revision": 1,
        "expected_candidate_revision": candidate_revision,
        "expected_policy_revision": policy_revision,
        "threshold_k": threshold_k,
        "reviewer_label": "demo-reviewer",
        "review_attestation": copy.deepcopy(ATTESTATION),
        "manual_candidates": copy.deepcopy(MANUAL_D2_O3) if manual is None else manual,
        "rows": copy.deepcopy(ROWS_7) if rows is None else rows,
        "reference_mapping": copy.deepcopy(BASELINE_MAP) if mapping is None else mapping,
    }


def challenge_request(session_id: str, review_sha: str, policy_revision: int = 1,
                      candidate_revision: int = 2, budget: int = 10000) -> dict:
    return {
        "contract_version": "commerce.v1",
        "session_id": session_id,
        "expected_source_revision": 1,
        "expected_candidate_revision": candidate_revision,
        "expected_policy_revision": policy_revision,
        "expected_review_sha256": review_sha,
        "time_budget_ms": budget,
    }
