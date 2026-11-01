"""Strict wire-value helpers shared by every commerce operation.

JSON truthfulness rules: booleans are never integers, every object rejects
unknown fields, and reviewer-controlled strings are printable ASCII 1-200
chars so canonical digests stay unambiguous.
"""
from __future__ import annotations

from typing import Any

from . import COMMERC_VERSION
from .errors import CommerceError


def is_int(value: Any) -> bool:
    return type(value) is int


def is_str(value: Any) -> bool:
    return type(value) is str


def is_ascii_text(value: Any) -> bool:
    return (
        is_str(value)
        and 1 <= len(value) <= 200
        and all(0x20 <= ord(char) <= 0x7E for char in value)
    )


def invalid_value(message: str, path: str) -> CommerceError:
    return CommerceError("INVALID_VALUE", message, path, {}, 422)


def reject_unknown(obj: dict[str, Any], allowed: frozenset[str], path: str) -> None:
    for key in sorted(obj):
        if key not in allowed:
            raise invalid_value("Request carries an unknown field.", f"{path}.{key}" if path else key)


def require_version(obj: Any) -> None:
    if not isinstance(obj, dict) or obj.get("contract_version") != COMMERC_VERSION:
        raise invalid_value("Contract version must be commerce.v1.", "contract_version")


def require_int(obj: dict[str, Any], key: str, path: str) -> int:
    value = obj.get(key)
    if not is_int(value):
        raise invalid_value(f"Field {key} must be an integer.", path or key)
    assert is_int(value)
    return value


def require_hex_token(value: Any, length: int) -> bool:
    if not is_str(value) or len(value) != length:
        return False
    try:
        int(value, 16)
    except ValueError:
        return False
    return value == value.lower() and all(char in "0123456789abcdef" for char in value)
