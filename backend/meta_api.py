"""JW-T08B: one-shot, loopback-only Meta suggestion route; NEVER grants permissions.

This route is a bounded LOCAL DEVELOPMENT harness only. It is not suitable for
public deployment: the one-attempt lock is per-process, not a durable global quota.
"""
from __future__ import annotations

import os
import secrets
import threading
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import Field
from starlette.concurrency import run_in_threadpool

from .api import SourceRequest, _read, _bundle
from joinwitness.candidates import build_shortlist, MODEL_PER_ROW, MODEL_TOTAL
from joinwitness.meta_live import run_one_meta_call

router = APIRouter(tags=["Local Meta AI — restricted"])

# Pinned T02 raw-file hashes of the *fictional* flagship fixture, not guesses
# based on names. No other CSV bytes can reach the live model through T08B.
_FLAGSHIP_REG_SHA = "98c829b8d06caaf39e68ffe12f437c734291ccd2ce13da8e66deedb28747c2bf"
_FLAGSHIP_ATT_SHA = "c771e8ae9fd09b08f358ecf40678cf7ff53a448309fb927e1d2a3890be405ea3"
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
_ATTEMPT_LOCK = threading.Lock()
_attempted = False


class MetaSuggestionRequest(SourceRequest):
    # Literal True, not a truthy string or number. This is a local developer
    # diagnostic, NOT proof of actual end-user consent for real private data.
    explicitly_initiated: Literal[True]
    synthetic_fixture_confirmed: Literal[True]


def _deny(status: int, code: str) -> None:
    raise HTTPException(status, detail={"code": code})


def _require_local(request: Request) -> None:
    peer = request.client.host if request.client else None
    if peer not in {"127.0.0.1", "::1"} or request.url.hostname not in _LOCAL_HOSTS:
        _deny(403, "LOOPBACK_ONLY")
    origin = request.headers.get("origin")
    if origin is not None:
        # A foreign webpage cannot trigger the owner's paid local diagnostic.
        expected = f"{request.url.scheme}://{request.headers.get('host', '')}"
        if origin != expected:
            _deny(403, "ORIGIN_REJECTED")


def _require_secret(request: Request) -> None:
    expected = os.environ.get("JW_T08B_LOCAL_TOKEN", "")
    supplied = request.headers.get("x-jw-local-token", "")
    if len(expected) < 32 or not supplied or not secrets.compare_digest(expected, supplied):
        _deny(403, "LOCAL_AUTH_REQUIRED")


def _require_metered_gate() -> None:
    if (os.environ.get("JW_META_LIVE_ENABLED") != "YES_EXPLICITLY_APPROVED"
            or not os.environ.get("MODEL_API_KEY")):
        _deny(503, "LIVE_MODEL_DISABLED")


def _reserve_attempt() -> None:
    global _attempted
    with _ATTEMPT_LOCK:
        if _attempted:
            _deny(429, "LOCAL_LIVE_ATTEMPT_EXHAUSTED")
        # This consumes the one local attempt *even when the provider fails*.
        # The owner must explicitly restart the local process to try again.
        _attempted = True


@router.post("/api/meta/suggest")
async def meta_suggest(request: Request):
    """Explicitly initiated one-shot live call on pinned synthetic fixture only.

    Return the existing T07C validated record or a scoped offline fallback;
    never turn a suggestion into a policy edge, reference or receipt.
    """
    _require_local(request)
    _require_secret(request)
    payload = await _read(request, MetaSuggestionRequest)
    bundle = _bundle(payload)
    if (bundle.registrations_digest.raw_sha256 != _FLAGSHIP_REG_SHA
            or bundle.attendance_digest.raw_sha256 != _FLAGSHIP_ATT_SHA):
        _deny(422, "SYNTHETIC_FIXTURE_MISMATCH")
    _require_metered_gate()

    # Prepare deterministic fallback before reserving the provider request.
    shortlist = build_shortlist(bundle, per_row_limit=MODEL_PER_ROW, total_limit=MODEL_TOTAL)
    if not shortlist.candidates:
        _deny(422, "NO_DETERMINISTIC_CANDIDATES")
    _reserve_attempt()
    try:
        # Sync SDK uses a worker thread; event loop remains responsive.
        record = await run_in_threadpool(
            run_one_meta_call, bundle, owner_approved=True,
            synthetic_data_confirmed=True,
        )
        if (not isinstance(record, dict)
                or record.get("status") != "LIVE_META_SUGGESTIONS_VALIDATED"
                or record.get("provider_evidence_type") != "OBSERVED_LIVE_SDK_CALL"
                or record.get("human_permissions_created") is not False
                or record.get("analytical_verification") != "NOT_RUN"
                or record.get("request_count") != 1
                or record.get("shortlist_sha256") != shortlist.shortlist_sha256):
            raise ValueError("Provider result did not pass live provenance gate")
        return {"schema_version": "jw.api.meta.v1", "status": "UNREVIEWED_META_SUGGESTIONS",
                "live_attempts_remaining_in_process": 0, "meta": record,
                "human_permissions_created": False, "analytical_verification": "NOT_RUN"}
    except Exception:
        # Never echo raw provider exceptions, secrets, prompts or source names.
        return JSONResponse(status_code=503, content={
            "schema_version": "jw.api.meta.v1", "status": "AI_UNAVAILABLE",
            "reason": "PROVIDER_CALL_OR_VALIDATION_FAILED",
            "live_attempts_remaining_in_process": 0,
            "fallback": shortlist.model_dump(mode="json"),
            "human_permissions_created": False, "analytical_verification": "NOT_RUN",
        })
