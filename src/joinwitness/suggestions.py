"""JW-T07: AI suggestion boundary. Model text never creates reviewed permissions.

No imports from solver, oracle, checker or policy admission layers.
"""

from enum import StrEnum
import json
from typing import Literal

from pydantic import Field, StrictStr, ValidationError

from .canonical import parsed_records_sha256
from .contracts import FrozenSchema, InputBundle

VERSION = "jw.suggestions.v1"
MAX_MODEL_TEXT_BYTES = 16_384
MAX_SUGGESTIONS = 12


class SuggestionCode(StrEnum):
    INVALID_SOURCE = "INVALID_SOURCE"
    INVALID_MODEL_JSON = "INVALID_MODEL_JSON"
    INVALID_MODEL_SCHEMA = "INVALID_MODEL_SCHEMA"
    UNKNOWN_ID = "UNKNOWN_ID"
    DUPLICATE_PAIR = "DUPLICATE_PAIR"
    TOO_MANY = "TOO_MANY_SUGGESTIONS"
    NO_SUGGESTIONS = "NO_SUGGESTIONS"


class SuggestionError(ValueError):
    def __init__(self, code: SuggestionCode):
        self.code = code
        super().__init__(code.value)


class SuggestedPair(FrozenSchema):
    attendance_id: StrictStr = Field(min_length=1, max_length=128)
    registration_id: StrictStr = Field(min_length=1, max_length=128)
    reason: StrictStr = Field(min_length=1, max_length=240)


class ModelSuggestionPayload(FrozenSchema):
    suggestions: tuple[SuggestedPair, ...]


class SuggestionBatch(FrozenSchema):
    schema_version: Literal["jw.suggestions.v1"] = VERSION
    status: Literal["UNREVIEWED_SUGGESTIONS"] = "UNREVIEWED_SUGGESTIONS"
    origin: Literal["OFFLINE_FIXTURE", "META_API_RESPONSE"]
    model_id: Literal["muse-spark-1.3"] = "muse-spark-1.3"
    registrations_raw_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    attendance_raw_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    registrations_parsed_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    attendance_parsed_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    suggestions: tuple[SuggestedPair, ...]
    human_permissions_created: Literal[False] = False
    analytical_verification: Literal["NOT_RUN"] = "NOT_RUN"
    scope_caveat: Literal["Model suggestions are unreviewed; no identity match, permission, baseline, solver result or proof is created."] = (
        "Model suggestions are unreviewed; no identity match, permission, baseline, solver result or proof is created."
    )


def _verify_source(bundle: InputBundle) -> None:
    for kind, rows, digest, maximum in (
        ("registrations", bundle.registrations, bundle.registrations_digest, 150),
        ("attendance", bundle.attendance, bundle.attendance_digest, 100),
    ):
        ids = [r.registration_id if kind == "registrations" else r.attendance_id for r in rows]
        if (digest.source_kind != kind or len(rows) != digest.row_count or
                not 1 <= len(rows) <= maximum or len(ids) != len(set(ids)) or
                parsed_records_sha256(kind, rows) != digest.parsed_sha256):
            raise SuggestionError(SuggestionCode.INVALID_SOURCE)


def validate_model_suggestions(bundle: InputBundle, model_text: str, *, origin: Literal["OFFLINE_FIXTURE", "META_API_RESPONSE"] = "OFFLINE_FIXTURE") -> SuggestionBatch:
    """Fail closed on IDs, extra fields, overlong payloads and duplicate pairs.

    origin is supplied by the local trusted caller; untrusted model output cannot
    choose its own origin. A digest does not authenticate an external provider.
    """
    _verify_source(bundle)
    if not isinstance(model_text, str):
        raise SuggestionError(SuggestionCode.INVALID_MODEL_JSON)
    if len(model_text.encode("utf-8")) > MAX_MODEL_TEXT_BYTES:
        raise SuggestionError(SuggestionCode.INVALID_MODEL_JSON)
    try:
        obj = json.loads(model_text)
    except (ValueError, TypeError):
        raise SuggestionError(SuggestionCode.INVALID_MODEL_JSON) from None
    try:
        parsed = ModelSuggestionPayload.model_validate_json(model_text)
    except ValidationError:
        raise SuggestionError(SuggestionCode.INVALID_MODEL_SCHEMA) from None
    if len(parsed.suggestions) > MAX_SUGGESTIONS:
        raise SuggestionError(SuggestionCode.TOO_MANY)
    if not parsed.suggestions:
        raise SuggestionError(SuggestionCode.NO_SUGGESTIONS)
    reg = {r.registration_id for r in bundle.registrations}
    att = {a.attendance_id for a in bundle.attendance}
    seen: set[tuple[str, str]] = set()
    for suggestion in parsed.suggestions:
        key = (suggestion.attendance_id, suggestion.registration_id)
        if suggestion.attendance_id not in att or suggestion.registration_id not in reg:
            raise SuggestionError(SuggestionCode.UNKNOWN_ID)
        if key in seen:
            raise SuggestionError(SuggestionCode.DUPLICATE_PAIR)
        if not suggestion.reason.strip() or any(ord(c) < 32 or ord(c) == 127 for c in suggestion.reason):
            raise SuggestionError(SuggestionCode.INVALID_MODEL_SCHEMA)
        seen.add(key)
    return SuggestionBatch(
        origin=origin,
        registrations_raw_sha256=bundle.registrations_digest.raw_sha256,
        attendance_raw_sha256=bundle.attendance_digest.raw_sha256,
        registrations_parsed_sha256=bundle.registrations_digest.parsed_sha256,
        attendance_parsed_sha256=bundle.attendance_digest.parsed_sha256,
        suggestions=parsed.suggestions,
    )


def main() -> int:
    """Explicit OFFLINE fixture only. No Meta API code path is called here."""
    import argparse
    from pathlib import Path
    from .ingest import load_pair
    parser = argparse.ArgumentParser(description="JW-T07 offline AI-response validation; NO NETWORK")
    parser.add_argument("--registrations", type=Path, required=True)
    parser.add_argument("--attendance", type=Path, required=True)
    parser.add_argument("--mock-response", type=Path, required=True)
    args = parser.parse_args()
    try:
        bundle = load_pair(args.registrations, args.attendance)
        batch = validate_model_suggestions(bundle, args.mock_response.read_text(encoding="utf-8"))
    except (ValueError, OSError) as exc:
        parser.exit(2, f"T07 offline validation rejected: {type(exc).__name__}\n")
    print(json.dumps(batch.model_dump(mode="json"), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
