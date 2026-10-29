# JW-T05 — Bounded CP-SAT optimizer and independent-oracle parity

**Authority:** JW-RD-3.0 FINAL. **Exact base:** `2fa5ded45bd1fa30dbdd44a3b2427beac5410b81`.

**Owner:** one operator applying exact reviewed candidate; separate local Git status; no concurrent writer.

**Authorized NEW files ONLY (five):**
- `src/joinwitness/solver.py`
- `tests/test_solver_parity.py`
- `requirements-solver.txt`
- `docs/CONTRACTS_T05.md`
- `docs/tickets/JW-T05.md`

**Forbidden:** edits to any T02/T03/T04 file, existing fixtures, oracle, `.env`, Meta credentials, AI providers, frontend, README, CI, Git branches, public repo visibility or deployment. No paid model requests, push, PR or commit before approval.

**What it implements:** one-to-one reviewed choice variables; fixed A>B reversal target; minimum Hamming changed assignment objective; pinned solver parameters; conservative typed statuses; no T06 checker or full receipt. No unreviewed identity matches and no LLM decision authority.

**Hard stop:** base SHA differs; Git working tree not clean; existing allowlisted target exists; unexpected ZIP path; OR-Tools install fails; any test failure or skipped test after installation; T05 disagrees with T04 oracle; invalid witness wrongly accepted; unexpected spending or unapproved file write.

**Local verification (Windows):**
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-solver.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m joinwitness.solver --registrations fixtures/flagship_flip/registrations.csv --attendance fixtures/flagship_flip/attendance.csv --policy fixtures/flagship_flip/review_policy.json --reference fixtures/flagship_flip/reference.json
.\.venv\Scripts\python.exe -m joinwitness.solver --registrations fixtures/two_changes/registrations.csv --attendance fixtures/two_changes/attendance.csv --policy fixtures/two_changes/review_policy.json --reference fixtures/two_changes/reference.json
.\.venv\Scripts\python.exe -m joinwitness.solver --registrations fixtures/stable/registrations.csv --attendance fixtures/stable/attendance.csv --policy fixtures/stable/review_policy.json --reference fixtures/stable/reference.json
.\.venv\Scripts\python.exe -m pip show ortools
git status --short
```
**Expected statuses:** flagship and two_changes `SOLVER_OPTIMAL_WITNESS_UNCHECKED` at distances 1 and 2; stable `SOLVER_INFEASIBLE_UNCHECKED`; `independent_checker_status=NOT_RUN_T06` in each. Solver test parity must agree with T04 exhaustive oracle in 120 seeded cases.

**Deliverables:** full test count (zero skips), 3 CLI JSON outputs, status, OR-Tools version, base SHA, file list and diff status. No false claim of verified final mathematical proof.
