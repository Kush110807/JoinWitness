# JW-T06 — Independent checker, receipts and offline replay

**Pin:** `ec082d8e64e8c8a80db0a0eca88e450d863d9146` on `main`, **contract:** JW-RD-3.0. **Credit use:** $0.

## Exact authorized files (seven new files; no replacement of accepted sources)

- `src/joinwitness/checker.py`
- `src/joinwitness/receipts.py`
- `src/joinwitness/verify.py`
- `tests/test_checker.py`
- `tests/test_receipts.py`
- `docs/CONTRACTS_T06.md`
- `docs/tickets/JW-T06.md`

**Prohibited:** any edit to T02–T05 production code, existing tests/fixtures, dependencies, `.env`, lockfiles, README, status, GitHub settings; any cloud call, unattended agent, push or deployment. Oracle and solver are read-only imports for receipt orchestration. Checker must never import either one.

## Strict evidence and stop conditions

- Preflight full expected `git rev-parse HEAD`, `git status --porcelain` empty; reject an unexpected ZIP member or an existing target file. Archive SHA-256 must match handoff.
- Local `python -m pytest -q` on Windows after installing pinned `ortools==9.15.6755`. **Expected 196 passes, 0 skips**, but this is a target, not a claimed Windows result.
- Creation/replay CLIs for `flagship_flip`, `two_changes`, `stable` with generated receipts in `results/`; verify typed `verdict`, `proof_basis`, `checker_status`, oracle status, receipt digest.
- Tamper a *copy* of one receipt or source file, verify replay fails with nonzero status. Do not modify frozen source files.
- Capture `git status --short`, file inventory, `git diff --check`, test output and CLI output. No commit/push until coordinator approves.
- If CP-SAT re-run differs in status or objective, any false-stability, or any unverified witness is advertised as proven, STOP and return evidence, without changing accepted contracts to fit output.

## Explicit known limitation

The T06 checker is independent *of the optimizer* for witness validity, while authoritative T02/T03 validation and the T04 oracle are separate existing trust layers. Receipt hashing is an integrity fingerprint, not a signature. Oracle refusal on large cases is honest and leaves solver-attributed claims only. No external audit/CI and no paid Meta model inference are asserted.
