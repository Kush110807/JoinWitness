# JW-T08A — Stateless local FastAPI orchestration, jw.api.v1

Authority: JW-RD-3.0 FINAL, especially §§8–10, 14, 16. Pinned base commit `f81eba8f8221d4afee6bd69a1024214491a03cfd`.

This ticket implements the **local offline** API. It is not a public deployment, and it does not authorize an open unauthenticated Meta Model API endpoint. Existing T02–T07C modules remain read-only.

## Seven routes

- `GET /api/health` — explicitly `LOCAL_API_READY`, `OFFLINE_ONLY`, no public deployment claim.
- `POST /api/parse` — strictly validated base64 original CSV bytes; returns typed records, raw/parsed provenance and `NOT_RUN`.
- `POST /api/suggest` — deterministic local shortlist, never an AI call. Returns `NOT_CALLED_OFFLINE` and coverage caveat.
- `POST /api/review/validate` — accepts an explicitly provided `ReviewDraft` (and optional `ReferenceDraft`), reconstructs frozen review/reference, returns digest and revision. Merely submitting these objects does not assert genuine external human identity verification.
- `POST /api/analyze` — requires source bytes, review draft, complete reference draft, exact frozen review SHA-256 and revision from prior validation; invokes T05 solver, T06 checker, T04 oracle via T06 receipt build. Produces qualified analysis only.
- `POST /api/receipt` — recomputes the same reviewed analysis and returns a complete T06 versioned receipt. Inconclusive results must not be called a proof or exported as verified receipt.
- `POST /api/verify` — independently replays a supplied receipt against freshly parsed source bytes and provided original policy, including the accepted T06 solver-replay gate.

All POSTs require `application/json` with a strict schema, maximum 750,000 JSON bytes per request, maximum 450,000 chars for each base64 source, and exact canonical base64 encoding. `json.loads` is configured to reject duplicate object keys and nonfinite constants. Inputs are not stored by the application; it has no database or file writes. User-supplied text is not sent to Meta; no web AI proxy route exists. No CORS middleware is enabled.

Stale review revision/digest causes 409; malformed requests and illegal baselines 422; body too large 413; wrong media type 415. Engine exceptions fail closed with a safe generic response; raw records, secrets or raw exception messages are not echoed in errors. Do not interpret an analysis using a human-supplied policy as independent proof of identity truth.

## Bounded operational limitations

- This API is **only for local demo and upcoming T09 frontend integration**. Run on `127.0.0.1`, never expose directly to the public Internet. T11 must add authentication/quotas, ingress limits, deployment configuration, secret management, and abuse protections before a public URL.
- No authenticated Meta call can be triggered by this API. T07C standalone operator proof remains separate until a securely authenticated, opt-in UI integration passes its own review.
- No long-lived server state or upload retention. Clients must hold draft, source and frozen digest state. Changes to any source/policy require another review-validation round.
- `/api/analyze` and `/api/receipt` each rerun the solver. They must not be mistaken for cacheable or identical-byte receipts; receipts include generation timestamps.
- `MINIMUM_PROVEN` is always conditional on the reviewed candidate universe. `STABLE_WITHIN_REVIEWED_POLICY` never means real-world identity stability.

## Windows acceptance

- Preserve exactly the five pre-existing T07C files and all T02–T07C code unchanged.
- Install `requirements-api.txt` into the existing Python venv (FastAPI + Uvicorn + HTTPX).
- Run cumulative `pytest -q`. Expected on Windows: original 260 plus **23** T08A tests = **283 total**, assuming the previously reported T07C suite is 260. This is a target, not a pre-verified result.
- Tests include real fixture source parse, deterministic shortlist, review/reference, flagship solved+verified reversal, stable policy, complete receipt/replay, manipulated digest/receipt, schema and size failures, no Meta live route and privacy headers.
- Start local Uvicorn on loopback only; check GET `/api/health` and POST `/api/parse` from a fresh terminal. No public deploy, no payment request.
- `git diff --check`, exact allowlist, and no secret or unexpected file committed. Source changes require owner test evidence and approval before commit/push.

## Deferred

User interface, interactive manual review, human action audit, live Meta UX/cost protection, end-to-end browser testing, production auth/rate controls, Modal deployment and T10 comparative evaluation remain under JW-RD-3.0 T09–T11. No T08A evidence should be used to claim they exist.
