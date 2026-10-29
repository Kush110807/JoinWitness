# JW-T07C — One-call Meta inference readiness and proof capture

**Authority:** JW-RD-3.0 FINAL.
**Pinned base:** `299147003f45aa8ab19c12df4b721093ed3b7d89`.
**Owner:** Single source integrator (R&D Head), Windows operator executes tests and authenticated smoke.
**Cash:** No spending beyond owner's confirmed Meta promotional credits is authorized.

## Exact objective

Create an optional authenticated, **one-request** CLI harness using existing T07B shortlisted IDs and the T07A validated JSON schema. Record observed model, request/response identifiers, duration, token usage, and failure. Default dry-run makes zero requests. Preserve unreviewed suggestion status and human authority. No deployment, public URL or policy mutation.

## Authorized files

New only: `src/joinwitness/meta_live.py`, `tests/test_meta_live.py`, `requirements-meta.txt`, `docs/CONTRACTS_T07C.md`, `docs/tickets/JW-T07C.md`.

**Forbidden edits:** T02–T06 files; existing `src/joinwitness/candidates.py`, `meta_suggestions.py`, `suggestions.py`; any `.env`, token, GitHub setting, deployment configuration, public upload, key or automatic push.

## Acceptance and failure cases

- Full owner-run Python/pytest environment: target 260 PASS / 0 SKIP.
- Offline preview shows `DRY_RUN_NO_NETWORK`, request count 0, four-candidate flagship shortlist.
- Fake transport tests show mock classification, exact one call, status parsing, supported provenance, no permission propagation, malformed and outside-shortlist rejection, nonstandard model rejection, timeout/truncation failure and missing usage marked absent.
- Genuine standard Meta call: observed real transport, model metadata, token usage if returned, time and independent dashboard delta; `AI_UNAVAILABLE` is an acceptable **honest failed outcome**, not full T07 PASS.
- Review security: keys only in process environment, never print secret; synthetic records only; project root status allowlisted.

## STOP / fallback

Missing key, refused schema, blocked authorization, non-Standard response model, SDK or network error, source change, test regression, attempted second request or unexpected provider spend: stop call. Preserve manual review and deterministic analysis, do not call repeatedly automatically.

**Release:** No commit/push until owner Windows test evidence is reviewed. Completing this ticket's source implementation is not equivalent to verifying a live provider call.
