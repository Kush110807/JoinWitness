"""JW-T03: complete frozen reference validation, not reversal optimization."""

import argparse
import json
from enum import StrEnum
from pathlib import Path
from typing import Literal

from pydantic import Field, StrictStr

from .canonical import canonical_json_bytes, sha256_hex
from .contracts import FrozenSchema, InputBundle
from .ingest import load_pair
from .policy import ReviewDraft, ReviewSnapshot, allowed_choices, freeze_review, validate_snapshot

REFERENCE_VERSION = "jw.reference.v1"


class BaselineCode(StrEnum):
    INVALID = "BASELINE_INVALID"
    STALE = "BASELINE_STALE"


class BaselineError(ValueError):
    def __init__(self, code: BaselineCode):
        self.code = code
        super().__init__(code.value)


class ReferenceChoice(FrozenSchema):
    attendance_id: StrictStr = Field(min_length=1, max_length=128)
    registration_id: StrictStr | None = Field(..., max_length=128)


class ReferenceDraft(FrozenSchema):
    schema_version: Literal["jw.reference.v1"] = REFERENCE_VERSION
    assignments: tuple[ReferenceChoice, ...]


class ReferenceMatching(ReferenceDraft):
    review_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    reference_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")


class ReferenceCounts(FrozenSchema):
    a: int = Field(ge=0)
    b: int = Field(ge=0)
    unmatched: int = Field(ge=0)
    a_greater_than_b: bool


def reference_hash(reference: ReferenceMatching) -> str:
    return sha256_hex(canonical_json_bytes(reference.model_dump(mode="json", exclude={"reference_sha256"})))


def _check_choices(bundle: InputBundle, snapshot: ReviewSnapshot,
                   choices: tuple[ReferenceChoice, ...]) -> ReferenceCounts:
    possible = allowed_choices(bundle, snapshot)
    actual_ids = {item.attendance_id for item in bundle.attendance}
    if len(choices) != len(actual_ids) or {item.attendance_id for item in choices} != actual_ids:
        raise BaselineError(BaselineCode.INVALID)
    assignments = {item.attendance_id: item.registration_id for item in choices}
    claimed: set[str] = set()
    groups = {r.registration_id: r.group for r in bundle.registrations}
    a = b = n = 0
    for att_id, reg_id in assignments.items():
        if reg_id not in possible[att_id]:
            raise BaselineError(BaselineCode.INVALID)
        if reg_id is None:
            n += 1
            continue
        if reg_id in claimed:
            raise BaselineError(BaselineCode.INVALID)
        claimed.add(reg_id)
        if groups[reg_id] == "A":
            a += 1
        else:
            b += 1
    return ReferenceCounts(a=a, b=b, unmatched=n, a_greater_than_b=(a > b))


def freeze_reference(bundle: InputBundle, snapshot: ReviewSnapshot,
                     draft: ReferenceDraft) -> tuple[ReferenceMatching, ReferenceCounts]:
    validate_snapshot(bundle, snapshot)
    counts = _check_choices(bundle, snapshot, draft.assignments)
    data = draft.model_dump(mode="python")
    data["assignments"] = tuple(sorted(draft.assignments, key=lambda item: item.attendance_id))
    data["review_sha256"] = snapshot.snapshot_sha256
    data["reference_sha256"] = "0" * 64
    prelim = ReferenceMatching.model_validate(data)
    return prelim.model_copy(update={"reference_sha256": reference_hash(prelim)}), counts


def validate_reference(bundle: InputBundle, snapshot: ReviewSnapshot,
                       reference: ReferenceMatching, *, expected_sha256: str | None = None) -> ReferenceCounts:
    validate_snapshot(bundle, snapshot)
    if reference.review_sha256 != snapshot.snapshot_sha256 or (
        expected_sha256 is not None and expected_sha256 != reference.reference_sha256
    ):
        raise BaselineError(BaselineCode.STALE)
    if reference_hash(reference) != reference.reference_sha256:
        raise BaselineError(BaselineCode.INVALID)
    if tuple(sorted(reference.assignments, key=lambda row: row.attendance_id)) != reference.assignments:
        raise BaselineError(BaselineCode.INVALID)
    return _check_choices(bundle, snapshot, reference.assignments)


def main() -> int:
    parser = argparse.ArgumentParser(description="JW-T03 review and frozen reference inspection (offline)")
    parser.add_argument("--registrations", required=True, type=Path)
    parser.add_argument("--attendance", required=True, type=Path)
    parser.add_argument("--policy", required=True, type=Path)
    parser.add_argument("--reference", required=True, type=Path)
    args = parser.parse_args()
    try:
        bundle = load_pair(args.registrations, args.attendance)
        draft = ReviewDraft.model_validate_json(args.policy.read_bytes())
        snapshot = freeze_review(bundle, draft)
        reference_draft = ReferenceDraft.model_validate_json(args.reference.read_bytes())
        reference, _ = freeze_reference(bundle, snapshot, reference_draft)
        counts = validate_reference(bundle, snapshot, reference)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"T03 validation failed: {type(exc).__name__}\n")
    print(json.dumps({
        "analysis_status": "NOT_RUN_T03_ONLY",
        "policy_version": snapshot.schema_version,
        "policy_revision": snapshot.revision,
        "coverage": snapshot.coverage,
        "review_sha256": snapshot.snapshot_sha256,
        "reference_version": reference.schema_version,
        "reference_sha256": reference.reference_sha256,
        "baseline_counts": counts.model_dump(mode="json"),
        "scope_caveat": "Only the explicit reviewed candidate universe is modeled; no reversal analysis was run.",
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
