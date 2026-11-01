"""Canonical JSON and domain-separated SHA-256 digests (contract section 1.2).

CJSON(object) = JSON UTF-8 with lexicographically sorted keys, no
insignificant whitespace and ASCII-only string values in v1. Every digest is
SHA256(UTF8(domain + LF) || CJSON(payload)). Digests are integrity
comparisons, never authentication signatures.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

from .errors import FILE_ORDER

DOMAIN_CANDIDATES = "JW-COMMERCE-CANDIDATES-v1"
DOMAIN_POLICY = "JW-COMMERCE-POLICY-v1"
DOMAIN_BASELINE = "JW-COMMERCE-BASELINE-v1"
DOMAIN_REVIEW = "JW-COMMERCE-REVIEW-v1"
DOMAIN_RECEIPT = "JW-COMMERCE-RECEIPT-v1"
SOURCES_PREAMBLE = "JW-COMMERCE-SOURCES-v1"


def cjson_bytes(payload: Any) -> bytes:
    """Minified sorted-key canonical JSON exactly matching the frozen recipe."""
    text = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    raw = text.encode("utf-8")
    if any(byte >= 0x80 for byte in raw):
        raise ValueError("non-ASCII canonical payload")
    return raw


def domain_digest(domain: str, payload: Any) -> str:
    """SHA256 hex of ASCII(domain) + LF + canonical payload bytes."""
    body = domain.encode("ascii") + b"\n" + cjson_bytes(payload)
    return hashlib.sha256(body).hexdigest()


def file_sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def source_bundle_sha256(hashes: dict[str, str]) -> str:
    """Bundle digest over original file bytes in fixed filename order."""
    text = SOURCES_PREAMBLE + "\n"
    for name in FILE_ORDER:
        text += f"{name}:{hashes[name]}\n"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
