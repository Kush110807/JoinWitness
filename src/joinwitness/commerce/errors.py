"""Frozen commerce.v1 error taxonomy with safe wire envelopes.

Every failure returns a typed UPPER_SNAKE code, a display-safe message, a
generic string path and safe typed details. No stack traces, raw CSV bytes,
credentials or internal identifiers ever leave this module.
"""
from __future__ import annotations

from typing import Any


class CommerceError(Exception):
    """Typed commerce failure mapped 1:1 onto the frozen error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        path: str,
        details: dict[str, Any] | None = None,
        http_status: int = 422,
        verification_status: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.path = path
        self.details = dict(details or {})
        self.http_status = http_status
        self.verification_status = verification_status

    def envelope(self) -> dict[str, Any]:
        body: dict[str, Any] = {
            "error": {
                "code": self.code,
                "message": self.message,
                "path": self.path,
                "details": self.details,
            },
            "verified": False,
        }
        if self.verification_status is not None:
            body["verification_status"] = self.verification_status
        return body


# Frozen bounds (contract sections 1, 1.1, 1.4, 4).
MAX_ORDERS = 50
MAX_OTHER_ROWS = 60
MAX_FILE_BYTES = 64 * 1024
MAX_COMBINED_BYTES = 256 * 1024
MAX_VARIABLE_RECORDS = 10
MAX_ALTERNATIVES_PER_VARIABLE = 2
MAX_RAW_WORLDS = 4096
MAX_SOURCE_ROWS_VIEW = 230
MAX_VIEW_BYTES = 64 * 1024
MAX_PARSE_RESPONSE_BYTES = 128 * 1024
FILE_ORDER = ("orders.csv", "payments.csv", "deliveries.csv", "refunds.csv")

REQUIRED_FILES = list(FILE_ORDER)

# Session TTL (contract section 3.2): idle 30 min, absolute 2 h.
SESSION_IDLE_SECONDS = 30 * 60
SESSION_ABSOLUTE_SECONDS = 2 * 60 * 60

# Challenge budget bounds in ms (contract section 4).
MIN_TIME_BUDGET_MS = 100
MAX_TIME_BUDGET_MS = 10000
DEFAULT_TIME_BUDGET_MS = 10000
