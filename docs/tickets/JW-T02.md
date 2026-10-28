# JW-T02 — Versioned CSV and immutable source data contracts

**Authority:** JW-RD-3.0 FINAL · **base:** `59cff91e60ab2faff00ab115f0ea4a41c6be9aec` (expected) · **scope:** local, zero Meta requests.

## Allowed files
- `pyproject.toml`, `.gitattributes`, `.gitignore` (existing rules preserved; append Python build/test exclusions)
- `src/joinwitness/{__init__,contracts,canonical,ingest}.py`
- `fixtures/flagship_flip/*.csv`, `fixtures/invalid/*.csv`
- `tests/test_{contracts,ingest,canonical}.py`
- `docs/tickets/JW-T02.md`, `docs/CONTRACTS_T02.md`, `docs/DECISIONS.md`

No touching `README.md`, `.env.example`, `docs/STATUS.md`, source credentials, or other branches. No deploy or push.

## Contract and refusal gates
- Immutable strict Pydantic registration and attendance records, no extra properties.
- Exact UTF-8 bytes SHA-256 and an independently documented parsed-record SHA-256.
- Preserve CSV row order and row identities. No automatic AI or inferred joins.
- Validated default CSV columns only; no arbitrary mapping in T02.
- Reject invalid encoding, malformed CSV, invalid/duplicate primary IDs, bad groups, overlarge files and rows.
- Limit: 3 MB per file, 150 registrations, 100 attendance rows.
- CLI `python -m joinwitness.ingest --registrations fixtures/flagship_flip/registrations.csv --attendance fixtures/flagship_flip/attendance.csv` only validates and prints digests; it must output `NOT_RUN_T02_ONLY`.

## Acceptance and evidence
- `python -m pip install -e ".[dev]"` succeeds in the isolated venv.
- `python -m pytest -q` passes every deterministic T02 test; no skips or warnings hiding failure.
- The CLI validates 4 registrations and 3 attendances on the original flagship synthetic fixture.
- `git diff --check`, `git status --short`, and a reviewed diff are captured.
- Actual local commit ID, Python/Pydantic/pytest versions, test output, known limitations returned to R&D Head.
- Never claim the A=2/B=1 conclusion is *proved* by this ticket: policy, baseline, solver, checker, oracle are T03–T06.

## Stop conditions
- Any file outside the allowlist would be overwritten; any existing source code or divergent branch.
- Any pressure to use Meta tokens or a billable service; no such service is necessary.
- Failed installation or failing tests. Do not commit a known failing implementation.
