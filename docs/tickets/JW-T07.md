# JW-T07 — Offline model-suggestion adapter and deterministic verification

**Authority:** JW-RD-3.0 FINAL. **Expected base:** `971cf17c4036e4fe34823aa62a95c89f7d121f1b`. **Cost authority:** zero network calls; zero additional cash.

## Allowed files (new only)
- `src/joinwitness/suggestions.py`
- `src/joinwitness/meta_suggestions.py`
- `tests/test_suggestions.py`
- `fixtures/ai_mock/flagship_suggestions.json`
- `docs/CONTRACTS_T07.md`
- `docs/tickets/JW-T07.md`

No other repository file may be changed. No changes to T02–T06, `.env`, `README.md`, `docs/STATUS.md`, GitHub settings, cloud or billing. No commit/push until review.

## Tasks
- Versioned strict suggestion result as **unreviewed** and source bound. Separate mocked responses from genuine Meta responses.
- Construct official Muse Spark 1.3 JSON-schema Chat Completions request with existing IDs, names and developer prompt, no automatic model-created permissions.
- Explicit triple metered-call gate and optional SDK import. Default CLI has no network path.
- Tests for fabricated IDs, duplicate matches, data corruption, forbidden extra fields, empty/oversize output, API truncation/error, consent gates and frozen results.

## Acceptance
- 196 original tests still pass, plus 29 new tests; on Windows 225/225, no skips.
- Local CLI returns synthetic suggestions, not baseline calculations or matched/confirmed decisions.
- Record actual output, Git inventory, exact HEAD, `git diff --check`, Python package versions.
- No live API call performed or falsely claimed.

## STOP
Any source overwrite, Git divergence, package SHA mismatch, failing/skipped Windows tests, unintended external usage, credential exposure, or requirement to incur payment.
