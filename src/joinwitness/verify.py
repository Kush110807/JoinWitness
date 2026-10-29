"""JW-T06 offline replay from receipt + original source files and review policy."""
import argparse
import json
from pathlib import Path

from .ingest import load_pair
from .policy import ReviewDraft
from .receipts import ReceiptError, VerificationReceipt, replay_receipt


def main() -> int:
    parser = argparse.ArgumentParser(description="JoinWitness offline verification/replay")
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--registrations", required=True, type=Path)
    parser.add_argument("--attendance", required=True, type=Path)
    parser.add_argument("--policy", required=True, type=Path)
    args = parser.parse_args()
    try:
        rec = VerificationReceipt.model_validate_json(args.receipt.read_bytes())
        bundle = load_pair(args.registrations, args.attendance)
        policy = ReviewDraft.model_validate_json(args.policy.read_bytes())
        replay_receipt(rec, bundle, policy, rerun_solver=True)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"T06 replay rejected: {str(exc) if isinstance(exc, ReceiptError) else 'INVALID_INPUT_OR_RECEIPT'}\n")
    print(json.dumps({"replay_status": "VERIFIED_REPLAY", "verdict": rec.verdict,
                      "proof_basis": rec.proof_basis,
                      "checker_status": rec.checker_result.status,
                      "oracle_status": rec.oracle_result.status,
                      "receipt_sha256": rec.receipt_sha256,
                      "scope_caveat": rec.scope_caveat}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
