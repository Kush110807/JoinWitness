# JoinWitness JW-T07 — Model suggestion boundary, first bounded candidate

**Version:** `jw.suggestions.v1` · **Expected base commit:** `971cf17c4036e4fe34823aa62a95c89f7d121f1b` · **Current state:** offline candidate only. This is the first half of JW-T07; the genuine Meta account call is a separate, explicitly approved T07 live gate.

## Trust boundary

- The model receives only existing attendance/registration **IDs and names**. Its output is strictly `suggestions:[{attendance_id,registration_id,reason}]`; no confidence field, approval status, group override, inferred IDs or authorizations may be present.
- Pydantic strict parsing rejects unknown IDs, extra fields, duplicate pairs, overlong/malformed JSON, control characters and too many suggestions. At most 12 proposed pairs.
- All accepted results have `UNREVIEWED_SUGGESTIONS`, `human_permissions_created=false`, `analytical_verification=NOT_RUN`. The T03 human-reviewed policy, T03 baseline, T04 oracle, T05 solver and T06 receipts are **not changed or invoked**.
- `OFFLINE_FIXTURE` must never be displayed as live Meta output. A forged source digest is refused before calling any model.
- Empty candidate lists are *not evidence of non-matching identities*. This candidate returns typed `NO_SUGGESTIONS`; later UX may represent that as an unreviewed no-results state.
- No assignment authorization or question-specific analytical conclusion can come from AI.

## Meta adapter (disabled by default)

- Current official Meta documentation: `https://api.meta.ai/v1` with Chat Completions, model `muse-spark-1.3`, `response_format` JSON Schema, `strict=true` and `additionalProperties=false`.
- A real call requires **all three**: `owner_approved=True`, `synthetic_data_confirmed=True`, AND `JW_META_LIVE_ENABLED=YES_EXPLICITLY_APPROVED` set by operator, plus `MODEL_API_KEY` when the client is instantiated.
- Default CLI is **offline only** (`python -m joinwitness.suggestions --mock-response ...`). No flag to make a live call exists in that CLI. The adapter is importable but never implicitly executed.
- SDK (when authorized) is OpenAI-compatible and requires the optional `openai` Python package; tests use a fake client and do not import the SDK.
- A live call uses one non-streaming request, `max_retries=0`, timeout 15 seconds, `store=False`, `max_completion_tokens=1200`, and rejects non-`stop` completion status. A rate-limit or timeout does not auto-retry.
- The adapter DOES NOT prove that Meta promotional credits apply, does not prevent upstream monetary charges, and does not establish real authenticated connectivity until an explicitly authorized actual request succeeds and usage is reconciled.
- **Data-use:** Meta credit screen says content may be used for product improvement. The live adapter permits only explicitly attested *synthetic data*. Real names from users or confidential datasets are outside this candidate.
- This is not an external identity-verification service. Name resemblance alone is not proof.

## Windows offline acceptance

1. Exact base commit and clean worktree verified; six **new** files only. No modifications to existing T01–T06 production or test files.
2. Python 3.13 project venv; `python -m pytest -q` passes **225 tests with zero skips** on Windows where OR-Tools is installed (local sandbox: 212 passed, 13 existing OR-Tools skips).
3. Run `python -m joinwitness.suggestions` with synthetic CSV and `fixtures/ai_mock/flagship_suggestions.json`. Observe `origin=OFFLINE_FIXTURE`, `status=UNREVIEWED_SUGGESTIONS`, four proposed pairs, `human_permissions_created=false` and `analytical_verification=NOT_RUN`.
4. `git diff --check` and `git status --short --untracked-files=all` allowlisted. No accidental credentials, `.env` changes or backend purchases.
5. All live paid API requests remain HOLD. No commit/push until R&D Head reviews Windows evidence.

## Known limitations

This phase has no authenticated Meta call, real model output-quality evaluation, human review UI, permission patch, FastAPI API, deployment, spend protection or product design. Those are explicit future gates. The mock transport tests do not count as real inference.
