"""Strict ingestion of two bounded UTF-8 CSVs with reproducible provenance."""

import argparse
import csv
import io
import json
from enum import StrEnum
from pathlib import Path
from typing import Literal

from pydantic import ValidationError

from .canonical import parsed_records_sha256, sha256_hex
from .contracts import Attendance, InputBundle, Registration, SourceDigest

MAX_SOURCE_BYTES = 3_000_000
MAX_ROWS = {"registrations": 150, "attendance": 100}
HEADERS = {
    "registrations": ("registration_id", "name", "group"),
    "attendance": ("attendance_id", "recorded_name"),
}


class IngestCode(StrEnum):
    EMPTY_FILE = "EMPTY_FILE"
    TOO_LARGE = "TOO_LARGE"
    INVALID_ENCODING = "INVALID_ENCODING"
    INVALID_CSV = "INVALID_CSV"
    INVALID_HEADERS = "INVALID_HEADERS"
    INVALID_ROW = "INVALID_ROW"
    TOO_MANY_ROWS = "TOO_MANY_ROWS"
    DUPLICATE_ID = "DUPLICATE_ID"


class IngestError(ValueError):
    def __init__(self, code: IngestCode, source: str, row: int | None = None):
        self.code = code
        self.source = source
        self.row = row
        where = f" line {row}" if row is not None else ""
        super().__init__(f"{source}{where}: {code.value}")


def load_csv_bytes(
    raw: bytes, source_kind: Literal["registrations", "attendance"]
) -> tuple[tuple[Registration, ...] | tuple[Attendance, ...], SourceDigest]:
    if source_kind not in HEADERS:
        raise ValueError("Unrecognized source kind")
    if not raw:
        raise IngestError(IngestCode.EMPTY_FILE, source_kind)
    if len(raw) > MAX_SOURCE_BYTES:
        raise IngestError(IngestCode.TOO_LARGE, source_kind)
    if b"\x00" in raw:
        raise IngestError(IngestCode.INVALID_ENCODING, source_kind)
    try:
        # utf-8-sig permits a BOM but the SHA-256 remains over the exact original bytes.
        decoded = raw.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as error:
        raise IngestError(IngestCode.INVALID_ENCODING, source_kind) from error
    if not decoded.strip():
        raise IngestError(IngestCode.EMPTY_FILE, source_kind)
    reader = csv.reader(io.StringIO(decoded, newline=""), strict=True)
    expected = HEADERS[source_kind]
    try:
        header = next(reader, None)
        if header is None:
            raise IngestError(IngestCode.EMPTY_FILE, source_kind)
        # Headers may change order, but no extra/missing/duplicate fields are admitted.
        if len(header) != len(expected) or set(header) != set(expected):
            raise IngestError(IngestCode.INVALID_HEADERS, source_kind, reader.line_num)
        positions = {name: header.index(name) for name in expected}
        out: list[Registration | Attendance] = []
        seen_ids: set[str] = set()
        for values in reader:
            line = reader.line_num
            if len(values) != len(header):
                raise IngestError(IngestCode.INVALID_ROW, source_kind, line)
            if len(out) >= MAX_ROWS[source_kind]:
                raise IngestError(IngestCode.TOO_MANY_ROWS, source_kind, line)
            record = {key: values[pos] for key, pos in positions.items()}
            try:
                if source_kind == "registrations":
                    parsed = Registration(
                        registration_id=record["registration_id"],
                        display_name=record["name"], group=record["group"],
                    )
                    identifier = parsed.registration_id
                else:
                    parsed = Attendance(**record)
                    identifier = parsed.attendance_id
            except ValidationError as error:
                raise IngestError(IngestCode.INVALID_ROW, source_kind, line) from error
            if identifier in seen_ids:
                raise IngestError(IngestCode.DUPLICATE_ID, source_kind, line)
            seen_ids.add(identifier)
            out.append(parsed)
    except csv.Error as error:
        raise IngestError(IngestCode.INVALID_CSV, source_kind, reader.line_num) from error
    if not out:
        raise IngestError(IngestCode.EMPTY_FILE, source_kind)
    rows = tuple(out)
    digest = SourceDigest(
        source_kind=source_kind, raw_sha256=sha256_hex(raw),
        parsed_sha256=parsed_records_sha256(source_kind, rows),
        row_count=len(rows),
    )
    return rows, digest


def load_csv_file(
    path: Path | str, source_kind: Literal["registrations", "attendance"]
) -> tuple[tuple[Registration, ...] | tuple[Attendance, ...], SourceDigest]:
    source = Path(path)
    if source.stat().st_size > MAX_SOURCE_BYTES:
        raise IngestError(IngestCode.TOO_LARGE, source_kind)
    return load_csv_bytes(source.read_bytes(), source_kind)


def load_pair(registrations_path: Path | str, attendance_path: Path | str) -> InputBundle:
    registrations, registration_digest = load_csv_file(registrations_path, "registrations")
    attendance, attendance_digest = load_csv_file(attendance_path, "attendance")
    return InputBundle(
        registrations=registrations, attendance=attendance,
        registrations_digest=registration_digest, attendance_digest=attendance_digest,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="T02 CSV and canonical digest inspection (offline)")
    parser.add_argument("--registrations", type=Path, required=True)
    parser.add_argument("--attendance", type=Path, required=True)
    args = parser.parse_args()
    try:
        bundle = load_pair(args.registrations, args.attendance)
    except (IngestError, OSError) as error:
        parser.exit(2, f"Validation failed: {error}\n")
    print(json.dumps({
        "schema_version": bundle.schema_version,
        "registrations": bundle.registrations_digest.model_dump(),
        "attendance": bundle.attendance_digest.model_dump(),
        "analysis_status": "NOT_RUN_T02_ONLY",
    }, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
