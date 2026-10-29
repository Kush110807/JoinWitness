"""T06 versioned source-bound receipt generation and strict offline replay.

A SHA-256 receipt hash detects accidental changes, not adversarial replacement
of an entire receipt plus its hash. Replaying checks supplied input files, policy,
independent witness validity, independent small oracle and a fresh CP-SAT run.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import Field, StrictStr

from .baseline import ReferenceDraft, ReferenceMatching, freeze_reference, validate_reference
from .canonical import canonical_json_bytes, sha256_hex
from .checker import WitnessCheck, check_solver_claim
from .contracts import FrozenSchema, InputBundle
from .ingest import load_pair
from .oracle import OracleResult, enumerate_oracle
from .policy import ReviewDraft, ReviewSnapshot, freeze_review, validate_snapshot
from .solver import SolverResult, solve_reversal

RECEIPT_VERSION = "jw.receipt.v1"


class ReceiptError(ValueError):
    """Typed refusal; no source or credential content should be emitted."""


class VerificationReceipt(FrozenSchema):
    schema_version: Literal["jw.receipt.v1"] = RECEIPT_VERSION
    generated_utc: StrictStr
    review_snapshot: ReviewSnapshot
    reference_matching: ReferenceMatching
    solver_result: SolverResult
    checker_result: WitnessCheck
    oracle_result: OracleResult
    verdict: Literal[
        "REVERSIBLE_MINIMUM_PROVEN", "REVERSIBLE_WITNESS_ONLY",
        "STABLE_WITHIN_REVIEWED_POLICY", "NOT_VERIFIED",
    ]
    proof_basis: Literal[
        "SOLVER_AND_SMALL_ORACLE", "SOLVER_ATTRIBUTED_ONLY",
        "CHECKED_WITNESS_ONLY", "INCOMPLETE",
    ]
    scope_caveat: StrictStr
    receipt_sha256: StrictStr = Field(pattern=r"^[0-9a-f]{64}$")


_SCOPE = (
    "No real-world identity is determined. All findings are conditional on the "
    "source files, explicitly reviewed candidate universe, unmatched rules, "
    "reference assignment and fixed A>B predicate. SHA-256 is NOT a signature."
)


def receipt_hash(receipt: VerificationReceipt) -> str:
    return sha256_hex(canonical_json_bytes(receipt.model_dump(mode="json", exclude={"receipt_sha256"})))


def _classify(claim: SolverResult, checked: WitnessCheck, oracle: OracleResult) -> tuple[str, str]:
    """Reject disagreement rather than laundering it as a successful proof."""
    if checked.status == "NOT_VERIFIED" and checked.reason == "REJECTED_CLAIM":
        raise ReceiptError("INVALID_SOLVER_CLAIM")
    if claim.solver_status == "OPTIMAL" and checked.status == "WITNESS_VALID":
        if oracle.status == "ORACLE_STABLE":
            raise ReceiptError("SOLVER_ORACLE_DISAGREE")
        if oracle.status == "ORACLE_REVERSIBLE":
            if oracle.minimum_changed_assignments != checked.recomputed_changed_assignments:
                raise ReceiptError("SOLVER_ORACLE_DISAGREE")
            return "REVERSIBLE_MINIMUM_PROVEN", "SOLVER_AND_SMALL_ORACLE"
        return "REVERSIBLE_MINIMUM_PROVEN", "SOLVER_ATTRIBUTED_ONLY"
    if claim.solver_status == "FEASIBLE" and checked.status == "WITNESS_VALID":
        if oracle.status == "ORACLE_STABLE":
            raise ReceiptError("SOLVER_ORACLE_DISAGREE")
        if (oracle.status == "ORACLE_REVERSIBLE" and
            oracle.minimum_changed_assignments > checked.recomputed_changed_assignments):
            raise ReceiptError("SOLVER_ORACLE_DISAGREE")
        return "REVERSIBLE_WITNESS_ONLY", "CHECKED_WITNESS_ONLY"
    if claim.solver_status == "INFEASIBLE" and checked.status == "SCOPED_INFEASIBILITY_SOLVER_ATTRIBUTED":
        if oracle.status == "ORACLE_REVERSIBLE":
            raise ReceiptError("SOLVER_ORACLE_DISAGREE")
        return ("STABLE_WITHIN_REVIEWED_POLICY", "SOLVER_AND_SMALL_ORACLE"
                if oracle.status == "ORACLE_STABLE" else "SOLVER_ATTRIBUTED_ONLY")
    if claim.status == "NOT_VERIFIED" and checked.status == "NOT_VERIFIED":
        return "NOT_VERIFIED", "INCOMPLETE"
    raise ReceiptError("UNSUPPORTED_OR_INCONSISTENT_RESULT")


def build_receipt(bundle: InputBundle, snapshot: ReviewSnapshot,
                  reference: ReferenceMatching, claim: SolverResult,
                  *, timestamp: str | None = None) -> VerificationReceipt:
    validate_snapshot(bundle, snapshot)
    validate_reference(bundle, snapshot, reference)
    checked = check_solver_claim(bundle, snapshot, reference, claim)
    # The independent oracle refuses large cases honestly rather than silently truncating.
    oracle = enumerate_oracle(bundle, snapshot, reference)
    verdict, basis = _classify(claim, checked, oracle)
    generated = timestamp or datetime.now(timezone.utc).isoformat(timespec="seconds")
    draft = VerificationReceipt(
        generated_utc=generated, review_snapshot=snapshot, reference_matching=reference,
        solver_result=claim, checker_result=checked, oracle_result=oracle,
        verdict=verdict, proof_basis=basis, scope_caveat=_SCOPE,
        receipt_sha256="0" * 64,
    )
    return draft.model_copy(update={"receipt_sha256": receipt_hash(draft)})


def replay_receipt(receipt: VerificationReceipt, bundle: InputBundle,
                   policy: ReviewDraft, *, rerun_solver: bool = True) -> VerificationReceipt:
    """Strict replay from original files/policy; no trust in claimed checksum.

    A fresh solver completion is required for a replayable optimality/infeasibility
    statement. FEASIBLE-only witnesses stay nonminimal and are structurally checked.
    """
    if receipt_hash(receipt) != receipt.receipt_sha256:
        raise ReceiptError("RECEIPT_DIGEST_MISMATCH")
    fresh_snapshot = freeze_review(bundle, policy)
    if fresh_snapshot != receipt.review_snapshot:
        raise ReceiptError("SOURCE_OR_POLICY_CHANGED")
    validate_snapshot(bundle, receipt.review_snapshot,
                      expected_sha256=receipt.review_snapshot.snapshot_sha256)
    validate_reference(bundle, receipt.review_snapshot, receipt.reference_matching)
    ref_draft = ReferenceDraft(assignments=receipt.reference_matching.assignments)
    fresh_ref, _ = freeze_reference(bundle, fresh_snapshot, ref_draft)
    if fresh_ref != receipt.reference_matching:
        raise ReceiptError("REFERENCE_CHANGED")
    actual_checker = check_solver_claim(bundle, fresh_snapshot, fresh_ref, receipt.solver_result)
    if actual_checker != receipt.checker_result:
        raise ReceiptError("CHECKER_RESULT_MISMATCH")
    actual_oracle = enumerate_oracle(bundle, fresh_snapshot, fresh_ref)
    if actual_oracle != receipt.oracle_result:
        raise ReceiptError("ORACLE_RESULT_MISMATCH")
    outcome, basis = _classify(receipt.solver_result, actual_checker, actual_oracle)
    if (outcome != receipt.verdict or basis != receipt.proof_basis or
        receipt.scope_caveat != _SCOPE):
        raise ReceiptError("RESULT_CLASSIFICATION_MISMATCH")

    if rerun_solver:
        old = receipt.solver_result
        if old.status in {"SOLVER_OPTIMAL_WITNESS_UNCHECKED", "SOLVER_INFEASIBLE_UNCHECKED"}:
            fresh = solve_reversal(bundle, fresh_snapshot, fresh_ref,
                                   time_limit_seconds=old.time_limit_seconds,
                                   random_seed=old.random_seed)
            if (fresh.ortools_version != old.ortools_version or
                fresh.solver_status != old.solver_status or
                fresh.solver_proved_optimal != old.solver_proved_optimal or
                fresh.solver_proved_infeasible != old.solver_proved_infeasible):
                raise ReceiptError("SOLVER_REPLAY_DISAGREE")
            if old.solver_status == "OPTIMAL":
                checked_fresh = check_solver_claim(bundle, fresh_snapshot, fresh_ref, fresh)
                if (checked_fresh.status != "WITNESS_VALID" or
                    checked_fresh.recomputed_changed_assignments != actual_checker.recomputed_changed_assignments):
                    raise ReceiptError("SOLVER_REPLAY_DISAGREE")
        elif old.status == "SOLVER_FEASIBLE_WITNESS_UNCHECKED":
            # This witness is checked; solver completion is not implied.
            pass
        # NOT_VERIFIED remains NOT_VERIFIED, never upgraded by replay.
    return receipt


def write_receipt(receipt: VerificationReceipt, path: Path) -> None:
    if path.exists():
        raise ReceiptError("OUTPUT_EXISTS")
    path.parent.mkdir(parents=True, exist_ok=True)
    # Avoid overwriting and preserve exact canonical JSON across platforms.
    with path.open("xb") as file:
        file.write(canonical_json_bytes(receipt.model_dump(mode="json")) + b"\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="T06 create offline receipt from synthetic reviewed inputs")
    parser.add_argument("--registrations", required=True, type=Path)
    parser.add_argument("--attendance", required=True, type=Path)
    parser.add_argument("--policy", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        bundle = load_pair(args.registrations, args.attendance)
        snapshot = freeze_review(bundle, ReviewDraft.model_validate_json(args.policy.read_bytes()))
        ref, _ = freeze_reference(bundle, snapshot,
                                  ReferenceDraft.model_validate_json(args.reference.read_bytes()))
        claim = solve_reversal(bundle, snapshot, ref)
        receipt = build_receipt(bundle, snapshot, ref, claim)
        if receipt.verdict == "NOT_VERIFIED":
            raise ReceiptError("ANALYSIS_NOT_VERIFIED")
        write_receipt(receipt, args.output)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"T06 receipt creation rejected: {type(exc).__name__}: {str(exc) if isinstance(exc, ReceiptError) else 'INVALID_INPUT'}\n")
    print(json.dumps({"verdict": receipt.verdict, "proof_basis": receipt.proof_basis,
                      "checker_status": receipt.checker_result.status,
                      "oracle_status": receipt.oracle_result.status,
                      "receipt_sha256": receipt.receipt_sha256,
                      "file": str(args.output)}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
