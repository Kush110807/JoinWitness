# JW-T07C — Genuine Meta request operator harness, provenance and safe fallback

**Authority:** JW-RD-3.0 FINAL, sections 6, 8, 9, 11, 12, 14, 16.
**Pinned previous accepted commit:** `299147003f45aa8ab19c12df4b721093ed3b7d89`.
**Classification:** implementation candidate; full T07 still needs one real authenticated request and observed usage reconciliation.

## Boundaries and invariants

- The program remains a human-authorized decision-robustness auditor; this harness **never** approves edges, writes policies, edits group labels, creates a reference, runs solver/checker, or issues verification receipts.
- The existing T07B `request_live_meta()` and T07A strict response schema are reused *without modifications*. T07B limits model proposals to supplied shortlisted record IDs. Candidates that are absent remain unknown, not disproven.
- Normal CLI behavior is `DRY_RUN_NO_NETWORK`. One real API request requires the combination of `--live-once`, `--i-approve-credit-use`, `--synthetic-data-only`, `JW_META_LIVE_ENABLED=YES_EXPLICITLY_APPROVED`, and `MODEL_API_KEY` in the process environment.
- `muse-spark-1.3` requests **Standard mode**, not Contributor. Only the bundled **synthetic** CSVs may be used in this ticket. Never transmit uploaded private data using this harness.
- The existing adapter uses one nonstreaming Chat Completions attempt, max 1200 completion tokens, SDK `max_retries=0`, 15-second timeout, `store=False`; the T07C capture client adds a second explicit defense against multiple calls.
- Only safe structured response metadata and existing IDs are printed. A failure emits an `AI_UNAVAILABLE` record and exit code 2, with manual/deterministic fallback. It is *never* reported as validated inference.
- A real SDK transport is marked `OBSERVED_LIVE_SDK_CALL`; injected fake clients in tests are separately marked `INJECTED_TEST_CLIENT` and `SIMULATED_TRANSPORT_VALIDATED`, **never** labeled as genuine inference.
- Outputs disclose: model and Standard-mode request, UTC time, model response ID, HTTP request ID if surfaced by SDK, token usage if surfaced, duration, shortlist digest and truncation, and exact sanitized model suggestions. Missing usage fields remain `null`; cost is **not estimated or assumed debited**. Real credit consumption is separately verified from Meta account usage dashboard.
- Validated model output remains `UNREVIEWED_SUGGESTIONS`, `human_permissions_created=false`, `analytical_verification=NOT_RUN`.
- `response_model` must match `muse-spark-1.3` when the provider supplies a model name, avoiding accidental Contributor mislabeling. Missing metadata is explicitly `null`, not fabricated.
- Error messages and raw provider exceptions are not printed, and API keys are never written to a repository file. A JSON report is **evidence of an observed SDK response** but is not a provider-signed attestation.

## Five authorized new files only

- `src/joinwitness/meta_live.py`
- `tests/test_meta_live.py`
- `requirements-meta.txt`
- `docs/CONTRACTS_T07C.md`
- `docs/tickets/JW-T07C.md`

Existing T01–T07B math and AI modules are read-only.

## Operator acceptance

1. At exactly the pinned base SHA, working tree clean, apply the five-file package after SHA-256 check; do not run extraction commands if a guard fails.
2. Install `openai==3.41.0` into the existing Python 3.13 project virtualenv. The install is local package installation, not a metered inference request.
3. Run `python -m pytest -q` on Windows with OR-Tools. **Target: 260 passed and 0 skipped.** Includes 19 new offline tests and 241 previously accepted tests.
4. Run `python -m joinwitness.meta_live --registrations fixtures/flagship_flip/registrations.csv --attendance fixtures/flagship_flip/attendance.csv` with no live flags. Observe `DRY_RUN_NO_NETWORK`, shortlist count 4, request count 0.
5. Explicitly run **at most one** live request with a user-supplied API key set only in the current PowerShell process, the three CLI flags and environment switch, and exact synthetic fixture paths. Preserve redacted JSON and real Meta usage delta. Don't commit, paste, or log the key.
6. Show actual output with status `LIVE_META_SUGGESTIONS_VALIDATED` and `provider_evidence_type=OBSERVED_LIVE_SDK_CALL`, report fields or `AI_UNAVAILABLE` with precise safe reason if call did not complete. If the model returns no suggestions or schema error, do not fake a pass.
7. Show `git diff --check`, `git status --short --untracked-files=all`, full tests, and usage evidence. No commit/push until review.

## Unfinished full-T07 requirements

- One independently observed **real** authenticated Standard-mode response and its credit usage delta, with model request ID if exposed.
- Real schema-valid response quality, error fallback and prompt-injection tests; later T10 seeded ablation vs deterministic shortlisting.
- Runtime privacy consent, human review UI and manual-add candidate path in T08/T09.
- If the real API fails, T07 remains `BLOCKED` or `INCOMPLETE`, while the offline product path remains functional.

## Source references, checked 2026-10-29

- https://dev.meta.ai/docs/cookbook/quickstart-chat-completions
- https://dev.meta.ai/docs/cookbook/structured-output
- https://dev.meta.ai/docs/models
- https://pypi.org/project/openai/
