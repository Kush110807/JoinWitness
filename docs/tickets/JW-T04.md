# JW-T04 — Bounded exhaustive oracle before solver

**Authority:** JW-RD-3.0 FINAL · **Pinned parent commit:** `6630f4d21bff9599e52ac37a5deb5abd949003f3` · **writer:** controlled offline candidate, user verifies and commits only after coordinator acceptance.

## Objective

Establish a separate, deterministic and complete small-case truth reference for the fixed `A_COUNT_GREATER_THAN_B_COUNT` predicate. Prove the flagship minimum changed-assignment distance is 1 and the two-change fixture minimum is 2, without using OR-Tools or asking an LLM for the numerical truth.

## Authorized new files, no existing-file rewrites

- `src/joinwitness/oracle.py`
- `tests/test_oracle.py`
- `docs/CONTRACTS_T04.md`, `docs/tickets/JW-T04.md`
- exactly four files (`registrations.csv`, `attendance.csv`, `review_policy.json`, `reference.json`) inside each of: `fixtures/stable/`, `fixtures/two_changes/`, `fixtures/tie/`, `fixtures/false_reference/`.

Existing T02/T03 files, `.env`, credentials, `README`, `docs/STATUS.md`, dependencies, Git history and public/cloud resources are explicitly forbidden changes.

## Acceptance commands

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m joinwitness.oracle --registrations fixtures/flagship_flip/registrations.csv --attendance fixtures/flagship_flip/attendance.csv --policy fixtures/flagship_flip/review_policy.json --reference fixtures/flagship_flip/reference.json
.\.venv\Scripts\python.exe -m joinwitness.oracle --registrations fixtures/two_changes/registrations.csv --attendance fixtures/two_changes/attendance.csv --policy fixtures/two_changes/review_policy.json --reference fixtures/two_changes/reference.json
git status --short
```

**Expected in controlled candidate:** 133/133 tests PASS, 0 skips (106 preserved, 27 added). Flagship `minimum_changed_assignments=1`, baseline A2/B1, alternative A1/B2. Two-changes `minimum_changed_assignments=2`, baseline A4/B1, alternative A2/B3. No T05 solver or T06 checker claimed.

## Negative tests and refusal

- Stable within reviewed set, tie is false, initially false baseline reverses to true.
- Forbidden/confirmed edge semantics, one-to-one collision excluded, unmatched required and allowed correctly handled.
- 13-row forced-unmatched valid input returns `NOT_VERIFIED/ROW_LIMIT` rather than false stability.
- Combination cap returns `NOT_VERIFIED/COMBINATION_LIMIT` with no claimed minimum.
- Stale reference, tampered policy and tampered frozen assignment rejected before enumeration.
- 100 independently seeded small-policy comparisons use a separate Cartesian test oracle.

## Stop conditions

Unexpected existing file, wrong base SHA, dirty worktree, failed tests, unexpected missing dependency, source or file change outside list, attempt to access cloud/Meta API, paid operation, or effort to weaken a test to force PASS. Report a bounded failure with evidence. No autopush/merge/deploy.

## Evidence required to accept and commit

Actual test stdout, both CLI outputs, `git status --short`, reviewed staged filenames, `git diff --cached --check` (checks **new** files), full commit SHA after approval, and observed Python/Pydantic/pytest versions. The local sandbox result is not proof of the owner's Windows run.
