"""JW-T07C: bounded single-call Meta smoke and redacted provenance.

Default CLI is a no-network preview. This module cannot grant review permissions
and does not depend on the solver, oracle, checker or receipt implementations.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from .candidates import MODEL_PER_ROW, MODEL_TOTAL, build_shortlist
from .ingest import load_pair
from .meta_suggestions import (
    META_BASE_URL, MODEL, MetaCallBlocked, MetaResponseRejected,
    request_live_meta,
)
from .suggestions import _verify_source, SuggestionError

SCHEMA_VERSION = "jw.meta.live.v1"
PROMPT_VERSION = "jw.meta.prompt.v1"
SWITCH = "YES_EXPLICITLY_APPROVED"


class _CaptureCompletions:
    """Pass-through for one call; captures provider metadata, never logs prompt or key."""

    def __init__(self, provider_client: Any):
        self.provider_client = provider_client
        self.response = None
        self.count = 0

    def create(self, **kwargs: Any) -> Any:
        if self.count:
            raise MetaCallBlocked("MULTIPLE_CALLS_BLOCKED")
        self.count += 1
        self.response = self.provider_client.chat.completions.create(**kwargs)
        return self.response


def _limited_metadata(response: Any) -> dict[str, Any]:
    """Optional observed provider fields; distinguish absent from zero."""
    usage = getattr(response, "usage", None)
    def tokens(field: str) -> int | None:
        value = getattr(usage, field, None)
        return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None

    def identifier(field: str) -> str | None:
        value = getattr(response, field, None)
        if not isinstance(value, str) or not 1 <= len(value) <= 160:
            return None
        if any(ord(ch) < 33 or ord(ch) > 126 for ch in value):
            return None
        return value

    return {
        "provider_response_id": identifier("id"),
        "provider_request_id": identifier("_request_id"),
        "response_model": identifier("model"),
        "prompt_tokens": tokens("prompt_tokens"),
        "completion_tokens": tokens("completion_tokens"),
        "total_tokens": tokens("total_tokens"),
    }


def _validate_usage(metadata: dict[str, Any]) -> str:
    p, c, t = (metadata[k] for k in ("prompt_tokens", "completion_tokens", "total_tokens"))
    if None in (p, c, t):
        return "USAGE_UNAVAILABLE"
    if p + c != t:
        # Some providers may count other token categories; do not assume equality.
        return "USAGE_REPORTED_NONADDITIVE"
    return "USAGE_REPORTED"


def run_one_meta_call(bundle: Any, *, owner_approved: bool = False,
                      synthetic_data_confirmed: bool = False,
                      client: Any = None, timer: Any = None) -> dict[str, Any]:
    """Exactly one request when all gates are open.

    Client injection is exclusively for offline tests and must never be counted
    as a genuine authenticated Meta request.
    """
    if (not owner_approved or not synthetic_data_confirmed or
            os.environ.get("JW_META_LIVE_ENABLED") != SWITCH):
        raise MetaCallBlocked("SPEND_OR_DATA_GATE_CLOSED")
    _verify_source(bundle)
    shortlist = build_shortlist(bundle, per_row_limit=MODEL_PER_ROW, total_limit=MODEL_TOTAL)
    if not shortlist.candidates:
        raise MetaCallBlocked("NO_DETERMINISTIC_CANDIDATES")

    real_transport = client is None
    if real_transport:
        key = os.environ.get("MODEL_API_KEY")
        if not key:
            raise MetaCallBlocked("MODEL_API_KEY_MISSING")
        try:
            from openai import OpenAI
        except ImportError:
            raise MetaCallBlocked("OPENAI_SDK_MISSING") from None
        # Exactly one attempt: disable SDK retries, cap timeout and output tokens
        # in the existing request_live_meta adapter.
        client = OpenAI(base_url=META_BASE_URL, api_key=key, max_retries=0, timeout=15.0)

    captured = _CaptureCompletions(client)
    wrapper = SimpleNamespace(chat=SimpleNamespace(completions=captured))
    timer = timer or time.monotonic
    begin = timer()
    # This function enforces the reviewed shortlist, schema and one-call gate.
    batch = request_live_meta(bundle, owner_approved=True,
                              synthetic_data_confirmed=True, client=wrapper)
    elapsed_ms = max(0, round((timer() - begin) * 1000))
    if captured.count != 1 or captured.response is None:
        raise MetaResponseRejected("PROVIDER_RESPONSE_NOT_CAPTURED")
    metadata = _limited_metadata(captured.response)
    if metadata["response_model"] is not None and metadata["response_model"] != MODEL:
        raise MetaResponseRejected("UNEXPECTED_RESPONSE_MODEL")
    if metadata["total_tokens"] is not None and metadata["total_tokens"] > 500_000:
        raise MetaResponseRejected("UNREASONABLE_TOKEN_USAGE")
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "LIVE_META_SUGGESTIONS_VALIDATED" if real_transport else "SIMULATED_TRANSPORT_VALIDATED",
        "provider_evidence_type": "OBSERVED_LIVE_SDK_CALL" if real_transport else "INJECTED_TEST_CLIENT",
        "requested_model": MODEL,
        "requested_mode": "STANDARD",
        "prompt_version": PROMPT_VERSION,
        "suggestion_schema_version": batch.schema_version,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "duration_ms": elapsed_ms,
        "request_count": captured.count,
        "shortlist_sha256": shortlist.shortlist_sha256,
        "shortlist_truncated": shortlist.was_truncated,
        "shortlist_candidate_count": len(shortlist.candidates),
        "review_coverage": shortlist.coverage,
        "source_raw_sha256": {
            "registrations": batch.registrations_raw_sha256,
            "attendance": batch.attendance_raw_sha256,
        },
        "response_id": metadata["provider_response_id"],
        "request_id": metadata["provider_request_id"],
        "response_model": metadata["response_model"],
        "usage": {
            "status": _validate_usage(metadata),
            "prompt_tokens": metadata["prompt_tokens"],
            "completion_tokens": metadata["completion_tokens"],
            "total_tokens": metadata["total_tokens"],
        },
        "origin": batch.origin,
        "suggestions": [item.model_dump(mode="json") for item in batch.suggestions],
        "human_permissions_created": False,
        "analytical_verification": "NOT_RUN",
        "scope_caveat": (
            "Suggestions are unreviewed; provider text is not identity truth or "
            "mathematical evidence. Credit deduction must be checked on provider dashboard."
        ),
    }


def _preview(bundle: Any) -> dict[str, Any]:
    _verify_source(bundle)
    shortlist = build_shortlist(bundle, per_row_limit=MODEL_PER_ROW, total_limit=MODEL_TOTAL)
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "DRY_RUN_NO_NETWORK",
        "requested_model": MODEL,
        "requested_mode": "STANDARD",
        "shortlist_sha256": shortlist.shortlist_sha256,
        "shortlist_candidate_count": len(shortlist.candidates),
        "shortlist_truncated": shortlist.was_truncated,
        "truncated_attendance_ids": list(shortlist.truncated_attendance_ids),
        "human_permissions_created": False,
        "analytical_verification": "NOT_RUN",
        "network_requests": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="T07C one-call synthetic Meta smoke (offline by default)")
    parser.add_argument("--registrations", type=Path, required=True)
    parser.add_argument("--attendance", type=Path, required=True)
    parser.add_argument("--live-once", action="store_true")
    parser.add_argument("--i-approve-credit-use", action="store_true")
    parser.add_argument("--synthetic-data-only", action="store_true")
    args = parser.parse_args()
    try:
        bundle = load_pair(args.registrations, args.attendance)
        if args.live_once:
            record = run_one_meta_call(
                bundle, owner_approved=args.i_approve_credit_use,
                synthetic_data_confirmed=args.synthetic_data_only,
            )
        else:
            record = _preview(bundle)
    except (MetaCallBlocked, MetaResponseRejected, SuggestionError, ValueError, OSError) as exc:
        # Never print provider exception internals, prompts, keys or raw responses.
        code = str(exc)
        allowed = {
            "SPEND_OR_DATA_GATE_CLOSED", "NO_DETERMINISTIC_CANDIDATES",
            "MODEL_API_KEY_MISSING", "OPENAI_SDK_MISSING", "INPUT_ROW_LIMIT",
            "MODEL_REQUEST_FAILED", "INVALID_PROVIDER_RESPONSE", "UNFINISHED_RESPONSE",
            "MISSING_CONTENT", "PAIR_OUTSIDE_SUPPLIED_SHORTLIST",
            "PROVIDER_RESPONSE_NOT_CAPTURED", "UNEXPECTED_RESPONSE_MODEL",
            "UNREASONABLE_TOKEN_USAGE", "MULTIPLE_CALLS_BLOCKED",
        }
        if code not in allowed:
            code = "INVALID_OR_UNAVAILABLE_RESPONSE"
        print(json.dumps({
            "schema_version": SCHEMA_VERSION,
            "status": "AI_UNAVAILABLE",
            "reason": code,
            "fallback": "DETERMINISTIC_SHORTLIST_AND_MANUAL_REVIEW_AVAILABLE",
            "human_permissions_created": False,
            "analytical_verification": "NOT_RUN",
            "success": False,
        }, sort_keys=True, indent=2))
        return 2
    except Exception:
        print(json.dumps({
            "schema_version": SCHEMA_VERSION,
            "status": "AI_UNAVAILABLE", "reason": "UNKNOWN_FAILURE",
            "fallback": "DETERMINISTIC_SHORTLIST_AND_MANUAL_REVIEW_AVAILABLE",
            "success": False,
        }, sort_keys=True, indent=2))
        return 2
    print(json.dumps(record, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
