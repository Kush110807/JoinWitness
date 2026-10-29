# JW-T08B — Local Meta suggestion API integration

- **Pinned base:** `a997cb67e30437301eb5d2a8263da189e82f789e`
- **Authority:** JW-RD-3.0 FINAL; no product or algorithm pivot
- **Files:** append two lines to `backend/api.py`; add `backend/meta_api.py`, `tests/test_meta_api.py`, `docs/CONTRACTS_T08B.md`, `docs/tickets/JW-T08B.md` only
- **Forbidden:** changes to previous contracts, all math/AI core, GitHub settings, payment settings, public server, production secrets, UI implementation
- **No live inference as part of acceptance:** use monkeypatched transport to test route. Previous T07C authenticated smoke remains the Meta connectivity proof.

## Acceptance

1. Confirm exact Git HEAD, clean tree and expected original backend blob hash; apply bounded package with backup.
2. `python -m pytest -q` on Windows with OR-Tools available: expect **283 existing tests + 17 new tests = 300 PASS**, zero skips. This is a target, not completed evidence.
3. Confirm GET `/api/health` and original `/api/suggest` remain offline and do not spend credits.
4. New `POST /api/meta/suggest` rejects missing/mismatched local token, remote IP, foreign origin, missing approval, malformed JSON, altered synthetic bytes, missing live env, exhausted one-shot attempt. Provider simulation must not masquerade as authenticated evidence.
5. Show `git diff --check`, exact five-file status (four added, one modified), no secrets or unexpected code changed. Commit only after independent Windows review.

## Stop on

Dirty/unexpected base, archive mismatch, failing/skipped tests, any paid call during testing, altered T02–T07C contracts, handler accepting non-pinned user data or allowing repeated calls in same process, or any plan to expose this developer endpoint publicly.

## After acceptance

Proceed under original JW-RD-3.0 to T09 React/Vite Import → Review → Challenge → Verify, with explicit local user-triggered AI suggestions and clear fallback. Later T11 requires proper deployment-grade controls; this local-only route must not be shipped directly to public Modal deployment.
