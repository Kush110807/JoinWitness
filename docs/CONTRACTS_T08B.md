# JW-T08B — Restricted local Meta suggestions route

**Governing authority:** JW-RD-3.0 FINAL, sections 4, 6, 8–12, 14, 16.  
**Exact accepted base:** `a997cb67e30437301eb5d2a8263da189e82f789e`.  
**Classification:** LOCAL ONLY; not production-ready; offline test acceptance pending owner Windows run.

## Scope and mandatory authority separation

The new `POST /api/meta/suggest` calls the already-integrated T07C `run_one_meta_call()` only after explicit authorization. It reuses T08A's bounded JSON parser and T02 source loader. Return value remains **unreviewed suggestions**. It never edits T03 review snapshots, produces review permissions or baseline assignments, runs the solver, or issues verification receipts. The T08A deterministic `/api/suggest` remains entirely offline, and all original routes and tests remain unchanged.

## Multi-layer local metered-call gate

1. Only a real local loopback client (`127.0.0.1` / `::1`) reaching a local Host (`localhost`, `127.0.0.1`, `::1`); cross-origin browser attempts are rejected.
2. Required `X-JW-Local-Token` header matches an owner-generated, nonempty environment variable `JW_T08B_LOCAL_TOKEN` (at least 32 characters); never embed it in frontend code or commit it.
3. JSON requires literal-true `explicitly_initiated` and `synthetic_fixture_confirmed` fields, in addition to the exact T08A `SourceRequest` base64 fields. Unknown, repeated, overlarge or ill-typed JSON is rejected.
4. Exact original raw-file SHA-256 hashes must match the pinned fictional `flagship_flip` CSVs. This is a deliberately severe local demo restriction; arbitrary user files must not be sent to Meta in T08B.
5. `JW_META_LIVE_ENABLED=YES_EXPLICITLY_APPROVED` and `MODEL_API_KEY` must exist in the server process environment. Confirmed promotional credits are a project resource, not evidence of an account-level hard spending cap.
6. A process-local `threading.Lock` permits **one outbound attempt per server process**, consumed before the SDK starts and *not refunded on errors*. No retries are initiated by this endpoint. The existing T07C SDK adapter also disables SDK retries.
7. T07C must produce exactly `OBSERVED_LIVE_SDK_CALL`, `LIVE_META_SUGGESTIONS_VALIDATED`, matching shortlist hash, a single attempt, `NOT_RUN` analysis and `human_permissions_created=false`.

This is a single-process developer harness, **NOT durable, distributed authentication/rate limiting**. Restarts, multiple workers and multiple instances invalidate its one-attempt protection. Use `uvicorn ... --host 127.0.0.1 --port 8000` with default single worker only; never expose this to the Internet or Modal as is. JW-T11 must implement production auth, shared quotas, provider billing controls, CSRF/session protections and auditing before public deployment. T09 user interaction must explicitly request and disclose live inference; never invoke this route on page load.

## Failure semantics

Unauthorized requests never reach the provider. A reserved attempt that errors produces HTTP 503 `AI_UNAVAILABLE` with local deterministic shortlist fallback; no exception text, prompts, raw uploaded strings or credentials appear in the response. Second attempted calls get HTTP 429 until the owner restarts the local process. Mock transport cannot be labeled genuine. `Cache-Control: no-store` remains inherited from T08A.

**Evidence requirements:** Tests for no secret, wrong secret, loopback/Origin restrictions, disabled provider, forged source bytes, missing approval, duplicate JSON keys, one-attempt lock, safe error fallback, simulated transport refusal, and continuing offline routes. A controlled provider network call is not required to approve this local wiring, since the real T07C transport has previously passed the authenticated smoke. No API key should appear in screenshots or the Git patch.

## Authorized changed files

- `backend/api.py`: append exactly two route-registration lines; no other code changes.
- `backend/meta_api.py`: new local gate and router.
- `tests/test_meta_api.py`: new offline route tests.
- `docs/CONTRACTS_T08B.md`: this contract.
- `docs/tickets/JW-T08B.md`: acceptance ticket.

Do not change T02–T07C modules, historical fixtures, solver, oracle, checker or receipts. No CORS enabling, automatic Meta trigger, UI, or public deployment.
