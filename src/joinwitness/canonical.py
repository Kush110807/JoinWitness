"""Documented canonical parsed-record digests. SHA-256 does not authenticate an issuer."""

import hashlib
import json
from typing import Any

from pydantic import BaseModel

from .contracts import SCHEMA_VERSION


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json_bytes(value: Any) -> bytes:
    # RFC-agnostic v1 scheme: UTF-8 JSON; lexicographic object keys; no spaces;
    # ASCII JSON escapes; no NaN/Infinity. Preserve the input order of arrays.
    # Future changes require a new version, never silent migration.
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"),
        ensure_ascii=True, allow_nan=False,
    ).encode("utf-8")


def parsed_records_sha256(source_kind: str, records: tuple[BaseModel, ...]) -> str:
    if source_kind not in {"registrations", "attendance"}:
        raise ValueError("Unknown source kind")
    payload = {
        "schema_version": SCHEMA_VERSION,
        "source_kind": source_kind,
        "records": [record.model_dump(mode="json") for record in records],
    }
    return sha256_hex(canonical_json_bytes(payload))
