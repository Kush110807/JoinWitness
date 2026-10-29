"""JW-T07B deterministic pre-review candidate shortlist; never authorizes identities.

No model or solver import. Rankings are lexical heuristics, not probabilities.
"""

from __future__ import annotations

import argparse
from difflib import SequenceMatcher
from enum import StrEnum
import json
import re
import unicodedata
from typing import Literal

from pydantic import Field, StrictStr

from .canonical import canonical_json_bytes, sha256_hex
from .contracts import FrozenSchema, InputBundle
from .suggestions import _verify_source

VERSION = "jw.shortlist.v1"
MAX_PER_ROW = 10
MAX_TOTAL = 1000
MODEL_PER_ROW = 4
MODEL_TOTAL = 24


class CandidateSignal(StrEnum):
    EXACT_NAME = "EXACT_NAME"
    EXPLICIT_SLASH_ALIAS = "EXPLICIT_SLASH_ALIAS"
    CLOSE_TEXT = "CLOSE_TEXT"
    SHARED_NAME_TOKEN = "SHARED_NAME_TOKEN"


class ShortlistItem(FrozenSchema):
    attendance_id: StrictStr
    registration_id: StrictStr
    rank: int = Field(ge=1, le=MAX_PER_ROW)
    signal: CandidateSignal


class ShortlistBatch(FrozenSchema):
    schema_version: Literal["jw.shortlist.v1"] = VERSION
    status: Literal["UNREVIEWED_SHORTLIST"] = "UNREVIEWED_SHORTLIST"
    origin: Literal["DETERMINISTIC_LOCAL"] = "DETERMINISTIC_LOCAL"
    coverage: Literal["PARTIAL_UNREVIEWED"] = "PARTIAL_UNREVIEWED"
    registrations_raw_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    attendance_raw_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    registrations_parsed_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    attendance_parsed_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")
    per_row_limit: int = Field(ge=1, le=MAX_PER_ROW)
    total_limit: int = Field(ge=1, le=MAX_TOTAL)
    candidates: tuple[ShortlistItem, ...]
    no_candidate_attendance_ids: tuple[StrictStr, ...]
    truncated_attendance_ids: tuple[StrictStr, ...]
    was_truncated: bool
    human_permissions_created: Literal[False] = False
    analytical_verification: Literal["NOT_RUN"] = "NOT_RUN"
    scope_caveat: Literal[
        "Heuristic name shortlist only; omitted or unranked pairs remain possible in reality. Human review and manual candidate addition are required."
    ] = "Heuristic name shortlist only; omitted or unranked pairs remain possible in reality. Human review and manual candidate addition are required."
    shortlist_sha256: StrictStr = Field(pattern=r"^[a-f0-9]{64}$")


def _normalize(text: str) -> str:
    """NFKC and casefold for comparison only; never modify input IDs/labels."""
    text = unicodedata.normalize("NFKC", text).casefold()
    return " ".join(re.findall(r"[^\W_]+", text, flags=re.UNICODE))


def _variants(text: str) -> tuple[str, ...]:
    """Resolve one explicit `Kim/Kym` spelling; never invent an unprovided name."""
    values = [_normalize(text)]
    match = re.search(r"(?<!\w)([^\W_]+)/([^\W_]+)(?!\w)", unicodedata.normalize("NFKC", text), re.UNICODE)
    if match:
        values.extend([_normalize(text[: match.start()] + part + text[match.end():]) for part in match.groups()])
    return tuple(dict.fromkeys(v for v in values if v))


def _signals(attendance_name: str, registration_name: str) -> tuple[int, int, CandidateSignal] | None:
    """Return (priority tier, text similarity in 0..1000, signal), never a confidence score."""
    registered = _normalize(registration_name)
    names = _variants(attendance_name)
    if not registered:
        return None
    if registered == names[0]:
        return (0, 1000, CandidateSignal.EXACT_NAME)
    if registered in names[1:]:
        return (1, 1000, CandidateSignal.EXPLICIT_SLASH_ALIAS)
    ratios = [int(round(1000 * SequenceMatcher(None, name, registered, autojunk=False).ratio())) for name in names]
    best = max(ratios, default=0)
    if best >= 760:
        return (2, best, CandidateSignal.CLOSE_TEXT)
    rt = set(registered.split())
    if any(rt.intersection(name.split()) for name in names) and best >= 500:
        return (3, best, CandidateSignal.SHARED_NAME_TOKEN)
    return None


def build_shortlist(bundle: InputBundle, *, per_row_limit: int = MAX_PER_ROW, total_limit: int = MAX_TOTAL) -> ShortlistBatch:
    """Deterministically rank existing-ID pairs; report *all* cap/empty rows.

    Every cap is a presentation/compute cap only. No admitted permission is inferred.
    """
    _verify_source(bundle)
    if type(per_row_limit) is not int or not 1 <= per_row_limit <= MAX_PER_ROW:
        raise ValueError("INVALID_PER_ROW_LIMIT")
    if type(total_limit) is not int or not 1 <= total_limit <= MAX_TOTAL:
        raise ValueError("INVALID_TOTAL_LIMIT")
    registrations = sorted(bundle.registrations, key=lambda r: r.registration_id)
    attendances = sorted(bundle.attendance, key=lambda a: a.attendance_id)
    items: list[ShortlistItem] = []
    absent: list[str] = []
    truncated: list[str] = []
    for attendance in attendances:
        possible: list[tuple[int, int, str, CandidateSignal]] = []
        for registration in registrations:
            signal = _signals(attendance.recorded_name, registration.display_name)
            if signal is not None:
                tier, similarity, kind = signal
                possible.append((tier, -similarity, registration.registration_id, kind))
        possible.sort(key=lambda value: (value[0], value[1], value[2]))
        if not possible:
            absent.append(attendance.attendance_id)
            continue
        budget = min(per_row_limit, max(0, total_limit - len(items)))
        if len(possible) > budget:
            truncated.append(attendance.attendance_id)
        for ordinal, (_, _, registration_id, signal) in enumerate(possible[:budget], 1):
            items.append(ShortlistItem(attendance_id=attendance.attendance_id, registration_id=registration_id, rank=ordinal, signal=signal))

    content = {
        "schema_version": VERSION,
        "sources": {
            "registration_raw": bundle.registrations_digest.raw_sha256,
            "registration_parsed": bundle.registrations_digest.parsed_sha256,
            "attendance_raw": bundle.attendance_digest.raw_sha256,
            "attendance_parsed": bundle.attendance_digest.parsed_sha256,
        },
        "limits": {"per_row": per_row_limit, "total": total_limit},
        "candidates": [i.model_dump(mode="json") for i in items],
        "no_candidate_attendance_ids": absent,
        "truncated_attendance_ids": truncated,
    }
    return ShortlistBatch(
        registrations_raw_sha256=bundle.registrations_digest.raw_sha256,
        attendance_raw_sha256=bundle.attendance_digest.raw_sha256,
        registrations_parsed_sha256=bundle.registrations_digest.parsed_sha256,
        attendance_parsed_sha256=bundle.attendance_digest.parsed_sha256,
        per_row_limit=per_row_limit,
        total_limit=total_limit,
        candidates=tuple(items),
        no_candidate_attendance_ids=tuple(absent),
        truncated_attendance_ids=tuple(truncated),
        was_truncated=bool(truncated),
        shortlist_sha256=sha256_hex(canonical_json_bytes(content)),
    )


def main() -> int:
    from pathlib import Path
    from .ingest import load_pair
    parser = argparse.ArgumentParser(description="JW-T07B local deterministic shortlist (NO NETWORK)")
    parser.add_argument("--registrations", type=Path, required=True)
    parser.add_argument("--attendance", type=Path, required=True)
    parser.add_argument("--per-row-limit", type=int, default=MAX_PER_ROW)
    parser.add_argument("--total-limit", type=int, default=MAX_TOTAL)
    args = parser.parse_args()
    try:
        shortlist = build_shortlist(load_pair(args.registrations, args.attendance), per_row_limit=args.per_row_limit, total_limit=args.total_limit)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"Shortlist rejected: {type(exc).__name__}: {exc}\n")
    print(json.dumps(shortlist.model_dump(mode="json"), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
