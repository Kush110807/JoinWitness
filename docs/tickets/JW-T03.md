# JW-T03 — Reviewed permissions, frozen policy and complete baseline

- **Authority:** JW-RD-3.0 FINAL; base `8734752dad361c3c6348138d763e54a76d829298`.
- **One writer:** local copy of isolated candidate only; no editing of existing T02 modules, no Muse API calls, no Codex, no push or deployment.
- **Allowed new paths:** `src/joinwitness/policy.py`, `src/joinwitness/baseline.py`, `tests/test_policy.py`, `tests/test_baseline.py`, `fixtures/flagship_flip/{review_policy,reference}.json`, `docs/{CONTRACTS_T03.md,tickets/JW-T03.md}`.
- **Forbidden:** T02 modules/fixtures/tests, README, .gitignore, financial credentials, all remote writes and payment actions.
- **Acceptance:** `python -m pytest -q` all tests pass, including T02 regression; `python -m joinwitness.baseline ...` reports A=2 B=1 TRUE and `NOT_RUN_T03_ONLY`, exact source hashes and policy/reference digests; negative tests for unknown IDs, duplicate review, conflicting confirmations, mandatory Hall collision, unmatched rules, incomplete/invalid references, source or policy revision staleness; `git diff --check`.
- **Stop:** mismatched base commit, nonempty worktree, failing tests, unanticipated files, payment prompt, misleading proof claim. Do not commit/push until reviewed by coordinating R&D Head.
- **Evidence:** exact full commit SHA, Python/pydantic/pytest versions, actual test output with total, CLI JSON, `git status --short`, `git diff --check`, untracked file inventory; known limitations.
