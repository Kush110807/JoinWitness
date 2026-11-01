"""JW-G2-B01 standalone commerce.v1 router; LOCAL-ONLY development harness.

Exactly six POST endpoints under /api/commerce/v1. Route-local fail-closed
guards (loopback peer/host, same-origin, JSON content type and the local
request header) mirror the frozen section 3.2 boundary for this router only;
shared app wiring stays HQ-owned and this module never touches backend/api.py.

Integration (HQ/A only, later ruling): app.include_router(commerce_router).
"""
from __future__ import annotations

import json
from typing import Any, Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from joinwitness.commerce import service
from joinwitness.commerce.errors import CommerceError

router = APIRouter(prefix="/api/commerce/v1", tags=["commerce.v1 local-only"])

MAX_JSON_BYTES = 750_000
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
_LOCAL_PEERS = {"127.0.0.1", "::1"}

_PRIVACY_HEADERS = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
}


class _DuplicateJSONKey(ValueError):
    pass


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise _DuplicateJSONKey("duplicate JSON key")
        out[key] = value
    return out


def _reject_constant(_: str) -> None:
    raise ValueError("nonfinite JSON number")


def _failure(status: int, code: str, message: str, path: str) -> JSONResponse:
    return JSONResponse(
        {"error": {"code": code, "message": message, "path": path, "details": {}}, "verified": False},
        status,
        headers=_PRIVACY_HEADERS,
    )


def _require_local(request: Request) -> JSONResponse | None:
    peer = request.client.host if request.client else None
    if peer not in _LOCAL_PEERS or request.url.hostname not in _LOCAL_HOSTS:
        return _failure(403, "ACCESS_DENIED", "Commerce API is loopback-only.", "")
    origin = request.headers.get("origin")
    if origin is not None and origin != f"{request.url.scheme}://{request.headers.get('host', '')}":
        return _failure(403, "ACCESS_DENIED", "Cross-origin request rejected.", "")
    fetch_site = request.headers.get("sec-fetch-site")
    if fetch_site is not None and fetch_site not in ("same-origin", "none"):
        return _failure(403, "ACCESS_DENIED", "Cross-site request rejected.", "")
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        return _failure(415, "INVALID_VALUE", "Requests must use application/json.", "")
    if request.headers.get("x-jw-local-request") != "1":
        return _failure(403, "ACCESS_DENIED", "Local request header is required.", "")
    return None


async def _dispatch(
    request: Request, operation: Callable[[Any], dict[str, Any]], success_status: int
) -> JSONResponse:
    denied = _require_local(request)
    if denied is not None:
        return denied
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            if int(declared) > MAX_JSON_BYTES:
                return _failure(413, "LIMIT_EXCEEDED", "Request body exceeds its size bound.", "")
        except ValueError:
            return _failure(400, "INVALID_VALUE", "Content length is invalid.", "")
    raw = bytearray()
    async for part in request.stream():
        if len(raw) + len(part) > MAX_JSON_BYTES:
            return _failure(413, "LIMIT_EXCEEDED", "Request body exceeds its size bound.", "")
        raw.extend(part)
    try:
        parsed = json.loads(
            bytes(raw).decode("utf-8"),
            object_pairs_hook=_unique_object,
            parse_constant=_reject_constant,
        )
    except (UnicodeError, json.JSONDecodeError, ValueError):
        return _failure(422, "INVALID_VALUE", "Request body must be valid JSON.", "")
    try:
        body = operation(parsed)
    except CommerceError as exc:
        return JSONResponse(exc.envelope(), exc.http_status, headers=_PRIVACY_HEADERS)
    except Exception:
        return _failure(503, "ENGINE_UNAVAILABLE", "Commerce engine is unavailable.", "")
    return JSONResponse(body, success_status, headers=_PRIVACY_HEADERS)


@router.post("/parse")
async def commerce_parse(request: Request) -> JSONResponse:
    return await _dispatch(request, service.op_parse, 201)


@router.post("/suggest")
async def commerce_suggest(request: Request) -> JSONResponse:
    return await _dispatch(request, service.op_suggest, 200)


@router.post("/review/validate")
async def commerce_review_validate(request: Request) -> JSONResponse:
    return await _dispatch(request, service.op_review, 200)


@router.post("/challenge")
async def commerce_challenge(request: Request) -> JSONResponse:
    return await _dispatch(request, service.op_challenge, 200)


@router.post("/receipt")
async def commerce_receipt(request: Request) -> JSONResponse:
    return await _dispatch(request, service.op_receipt, 200)


@router.post("/receipt/replay")
async def commerce_receipt_replay(request: Request) -> JSONResponse:
    return await _dispatch(request, service.op_replay, 200)


commerce_router = router
