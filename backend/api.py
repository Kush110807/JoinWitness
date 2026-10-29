"""JW-T08A bounded local, stateless API around accepted JoinWitness contracts.

No Meta network call, no persistence and no user-facing proof without the T06
checker/receipt. Serve on 127.0.0.1 only; deployment security is JW-T11.
"""
from __future__ import annotations

import base64
import binascii
import json
from typing import Any, TypeVar

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from joinwitness.baseline import ReferenceDraft, freeze_reference
from joinwitness.candidates import build_shortlist
from joinwitness.contracts import InputBundle
from joinwitness.ingest import load_csv_bytes
from joinwitness.policy import ReviewDraft, freeze_review
from joinwitness.receipts import (
    ReceiptError, VerificationReceipt, build_receipt, replay_receipt,
)
from joinwitness.solver import solve_reversal

API_VERSION = "jw.api.v1"
MAX_JSON_BYTES = 750_000
MAX_ENCODED_SOURCE = 450_000

app = FastAPI(
    title="JoinWitness Local API",
    version="0.1.0-t08a",
    description="Offline deterministic prototype. Not secured for public exposure.",
    docs_url="/docs", redoc_url=None,
)


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class SourceRequest(StrictRequest):
    registrations_b64: str = Field(min_length=1, max_length=MAX_ENCODED_SOURCE)
    attendance_b64: str = Field(min_length=1, max_length=MAX_ENCODED_SOURCE)


class ReviewRequest(SourceRequest):
    policy: ReviewDraft
    reference: ReferenceDraft | None = None


class AnalysisRequest(SourceRequest):
    policy: ReviewDraft
    reference: ReferenceDraft
    expected_review_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    expected_revision: int = Field(ge=1, strict=True)


class VerifyRequest(SourceRequest):
    policy: ReviewDraft
    receipt: VerificationReceipt


T = TypeVar("T", bound=BaseModel)


class DuplicateJSONKey(ValueError):
    pass


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in pairs:
        if k in out:
            raise DuplicateJSONKey("duplicate JSON key")
        out[k] = v
    return out


def _constant_error(_: str) -> None:
    raise ValueError("nonfinite JSON number")


async def _read(request: Request, model: type[T]) -> T:
    """Bound stream before JSON allocation; reject duplicate keys and unknown fields."""
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        raise HTTPException(415, detail={"code": "JSON_REQUIRED"})
    declared = request.headers.get("content-length")
    if declared is not None:
        try:
            if int(declared) > MAX_JSON_BYTES:
                raise HTTPException(413, detail={"code": "PAYLOAD_TOO_LARGE"})
        except ValueError:
            raise HTTPException(400, detail={"code": "INVALID_CONTENT_LENGTH"}) from None
    raw = bytearray()
    async for part in request.stream():
        if len(raw) + len(part) > MAX_JSON_BYTES:
            raise HTTPException(413, detail={"code": "PAYLOAD_TOO_LARGE"})
        raw.extend(part)
    try:
        # First reject duplicate keys and nonfinite JSON values, including nested values.
        json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object,
                   parse_constant=_constant_error)
        # JSON-aware validation preserves strict schema checks while accepting
        # JSON arrays for tuple fields in the accepted T03 review/reference models.
        return model.model_validate_json(bytes(raw))
    except (UnicodeError, json.JSONDecodeError, DuplicateJSONKey, ValueError, ValidationError):
        raise HTTPException(422, detail={"code": "INVALID_REQUEST_SCHEMA"}) from None


def _decode(value: str) -> bytes:
    try:
        if len(value) > MAX_ENCODED_SOURCE or len(value) % 4:
            raise ValueError()
        raw = base64.b64decode(value, validate=True)
        if base64.b64encode(raw).decode("ascii") != value:
            raise ValueError()
        return raw
    except (ValueError, binascii.Error):
        raise HTTPException(422, detail={"code": "INVALID_SOURCE_ENCODING"}) from None


def _bundle(payload: SourceRequest) -> InputBundle:
    reg, rd = load_csv_bytes(_decode(payload.registrations_b64), "registrations")
    att, ad = load_csv_bytes(_decode(payload.attendance_b64), "attendance")
    return InputBundle(registrations=reg, attendance=att,
                       registrations_digest=rd, attendance_digest=ad)


def _review(bundle: InputBundle, policy: ReviewDraft):
    return freeze_review(bundle, policy)


def _analysis(payload: AnalysisRequest):
    bundle = _bundle(payload)
    snapshot = _review(bundle, payload.policy)
    if snapshot.snapshot_sha256 != payload.expected_review_sha256 or snapshot.revision != payload.expected_revision:
        raise HTTPException(409, detail={"code": "REVIEW_SNAPSHOT_STALE"})
    ref, baseline = freeze_reference(bundle, snapshot, payload.reference)
    result = solve_reversal(bundle, snapshot, ref)
    receipt = build_receipt(bundle, snapshot, ref, result)
    return bundle, snapshot, ref, baseline, result, receipt


@app.middleware("http")
async def privacy_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.exception_handler(Exception)
async def _error_handler(request: Request, exc: Exception):
    # No tracebacks, source names, prompts, user CSV values or provider messages.
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    if isinstance(exc, ReceiptError):
        return JSONResponse(status_code=422, content={"detail": {"code": str(exc)}})
    if isinstance(exc, (ValueError, ValidationError, OSError)):
        return JSONResponse(status_code=422, content={"detail": {"code": "INPUT_OR_POLICY_REJECTED"}})
    return JSONResponse(status_code=503, content={"detail": {"code": "ENGINE_UNAVAILABLE"}})


@app.get("/api/health")
def health():
    return {"schema_version": API_VERSION, "status": "LOCAL_API_READY",
            "mode": "OFFLINE_ONLY", "live_meta_available": False,
            "public_deployment_ready": False}


@app.post("/api/parse")
async def parse(request: Request):
    payload = await _read(request, SourceRequest)
    bundle = _bundle(payload)
    return {"schema_version": API_VERSION, "status": "PARSED_UNREVIEWED",
            "registrations": [x.model_dump(mode="json") for x in bundle.registrations],
            "attendance": [x.model_dump(mode="json") for x in bundle.attendance],
            "registrations_digest": bundle.registrations_digest.model_dump(mode="json"),
            "attendance_digest": bundle.attendance_digest.model_dump(mode="json"),
            "analysis_status": "NOT_RUN", "human_permissions_created": False}


@app.post("/api/suggest")
async def suggest(request: Request):
    payload = await _read(request, SourceRequest)
    batch = build_shortlist(_bundle(payload))
    return {"schema_version": API_VERSION, "model_status": "NOT_CALLED_OFFLINE",
            "shortlist": batch.model_dump(mode="json")}


@app.post("/api/review/validate")
async def review_validate(request: Request):
    payload = await _read(request, ReviewRequest)
    bundle = _bundle(payload)
    snapshot = _review(bundle, payload.policy)
    result: dict[str, Any] = {
        "schema_version": API_VERSION, "status": "REVIEW_VALIDATED",
        "coverage": snapshot.coverage,
        "review_sha256": snapshot.snapshot_sha256,
        "review_revision": snapshot.revision,
        "human_review_source": "EXPLICIT_REQUEST_POLICY",
        "analysis_status": "NOT_RUN",
    }
    if payload.reference is not None:
        reference, counts = freeze_reference(bundle, snapshot, payload.reference)
        result["reference_sha256"] = reference.reference_sha256
        result["baseline_counts"] = counts.model_dump(mode="json")
    return result


@app.post("/api/analyze")
async def analyze(request: Request):
    payload = await _read(request, AnalysisRequest)
    _, snapshot, reference, baseline, claim, receipt = _analysis(payload)
    return {"schema_version": API_VERSION,
            "status": "ANALYSIS_VERIFIED" if receipt.verdict != "NOT_VERIFIED" else "NOT_VERIFIED",
            "coverage": snapshot.coverage,
            "baseline_counts": baseline.model_dump(mode="json"),
            "alternative_counts": claim.alternative_counts.model_dump(mode="json") if claim.alternative_counts else None,
            "witness_assignments": claim.alternative_assignments,
            "minimum_changed_assignments": receipt.checker_result.recomputed_changed_assignments,
            "solver_status": claim.solver_status,
            "checker_status": receipt.checker_result.status,
            "oracle_status": receipt.oracle_result.status,
            "verdict": receipt.verdict,
            "proof_basis": receipt.proof_basis,
            "review_sha256": snapshot.snapshot_sha256,
            "reference_sha256": reference.reference_sha256,
            "receipt_sha256": receipt.receipt_sha256,
            "scope_caveat": receipt.scope_caveat}


@app.post("/api/receipt")
async def receipt_create(request: Request):
    payload = await _read(request, AnalysisRequest)
    *_, receipt = _analysis(payload)
    if receipt.verdict == "NOT_VERIFIED":
        raise HTTPException(409, detail={"code": "ANALYSIS_NOT_VERIFIED"})
    return {"schema_version": API_VERSION, "status": "RECEIPT_ISSUED",
            "receipt": receipt.model_dump(mode="json")}


@app.post("/api/verify")
async def verify(request: Request):
    payload = await _read(request, VerifyRequest)
    bundle = _bundle(payload)
    replayed = replay_receipt(payload.receipt, bundle, payload.policy, rerun_solver=True)
    return {"schema_version": API_VERSION, "status": "VERIFIED_REPLAY",
            "verdict": replayed.verdict,
            "proof_basis": replayed.proof_basis,
            "receipt_sha256": replayed.receipt_sha256,
            "scope_caveat": replayed.scope_caveat}
