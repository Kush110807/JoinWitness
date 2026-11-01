# JoinWitness — JW-T09A Independent Frontend Audit

**Review date:** 30 October 2026. **Disposition:** HOLD. **Basis:** owner-uploaded `JoinWitness_T09A_Review.zip`, file-by-file source inspection and fixture SHA-256 checks; comparison with accepted GitHub backend at `e956eae91b8779b36520295cecfa34dbae6708b6`; stand-alone Node reproduction of payload logic. This is not a live browser acceptance test.

## Confirmed

- ZIP contains React/Vite/TypeScript frontend, two component/client test suites (9 tests authored), fixture sources and a T09A contract.
- SHA-256 hashes of bundled CSVs match the pinned fictional source bytes (registrations `98c829b8d06caaf39e68ffe12f437c734291ccd2ce13da8e66deedb28747c2bf`, attendance `c771e8ae9fd09b08f358ecf40678cf7ff53a448309fb927e1d2a3890be405ea3`).
- `/api/parse`, `/api/suggest`, `/api/review/validate`, `/api/analyze`, `/api/receipt`, and `/api/verify` request field names match current FastAPI source at a structural level.
- No automatic call to the paid Meta endpoint; no frontend API key found.
- Muse reports nine unit/component tests passing and a Vite build passing. Independent build/test and live browser execution **not verified**: dependency installation in this container failed because npm packages were unavailable in the local cache/registry. No assertion about pixel rendering or browser behavior is made.

## Blocking defects (fix in JW-T09A before acceptance)

### F1 — Wrong final verdict branch (critical)

- `frontend/src/App.tsx` lines 448–465 tests `analysis.verdict === "WITNESS_VALID"` and `=== "WITNESS_ONLY"`. These are not the versioned final receipt verdicts returned by `backend/api.py`.
- The accepted backend (`src/joinwitness/receipts.py`) returns `REVERSIBLE_MINIMUM_PROVEN`, `REVERSIBLE_WITNESS_ONLY`, `STABLE_WITHIN_REVIEWED_POLICY`, or `NOT_VERIFIED`. A successful flagship has `verdict=REVERSIBLE_MINIMUM_PROVEN`, `checker_status=WITNESS_VALID`, `oracle_status=ORACLE_REVERSIBLE`.
- The current UI drops into the **Inconclusive** branch despite a proven flagship reversal. Replace the mapping with the *exact* JW-RD-3.0 section 05 user copy; proof and coverage qualification must always be visible. Do not infer minimum from `checker_status` alone.

### F2 — Incorrect witness assignment type and changed-row computation (critical)

- `src/joinwitness/solver.py` declares `alternative_assignments: tuple[tuple[str, str | None], ...]` and `backend/api.py` returns it unchanged. HTTP JSON contains `[[attendance_id,registration_id], ...]`, not objects.
- `frontend/src/lib/api.ts` incorrectly types `witness_assignments` as an object array; `frontend/src/App.tsx` lines 40–49 access `.attendance_id` / `.registration_id` and therefore never detect changed rows in real responses.
- Independently reproduced with the actual flagship-shaped JSON: old comparator returned `[]`; correct comparator returned `["T-02"]`. Correctly model the wire tuple arrays, normalize to a typed UI object only in a clear adapter, and compute changed rows from original reference pairs versus witness pairs. Render exact old/new registration IDs (do not hardcode T-02 or R-A2/R-B2 in data-driven witness copy).

### F3 — Wrong offline replay module (functional defect)

- `frontend/src/App.tsx` line 521 displays `python -m joinwitness.replay` but the committed replay module is `src/joinwitness/verify.py` and its CLI is `python -m joinwitness.verify --receipt ... --registrations ... --attendance ... --policy ...`.
- Correct the copy and test the command on the owner's Windows workspace using the actual emitted receipt. The browser is not itself executing that command.

### F4 — Component mocks misrepresent real backend (test validity defect)

- `frontend/src/App.test.tsx` sets `verdict: "WITNESS_VALID"` and `oracle_status: "WITNESS_VALID"`, and constructs `witness_assignments` as objects. All three conflict with actual `backend/api.py` and `receipts.py` response schemas.
- Replace mocks with contract-faithful fixtures: `verdict: "REVERSIBLE_MINIMUM_PROVEN"`, `checker_status: "WITNESS_VALID"`, `oracle_status: "ORACLE_REVERSIBLE"`, `witness_assignments: [["T-01","R-A1"],["T-02","R-B2"],["T-03","R-B1"]]`; test the precise user-facing verdict, changed link T-02, proof source, and no inconclusive label. Add stable, witness-only and not-verified response tests.

## Other findings / bounded improvements

1. **Stale async state:** `loadDemo()` and `runChallenge()` can race with `clearDemo()` or another button click. Buttons disable only the individual action; completion of an earlier promise can repopulate cleared/stale data. Use an operation epoch/abort or global one-operation-at-a-time gate; ensure failed fresh analysis cannot leave an old visible verdict. Add an out-of-order response test.
2. **Receipt wording:** `downloadReceipt()` uses `JSON.stringify` on parsed response. This produces semantically the same receipt object but not necessarily byte-identical provider response bytes. Label it as a serialized API receipt rather than claiming 'exact API receipt bytes'. Replay must be checked against downloaded JSON.
3. **Product scope remains narrow by design:** no CSV upload, manual candidate addition, editable review, browser-triggered genuine Meta suggestion, robust navigation, or polished baseline/alternative comparison. This is acceptable only for clearly labeled T09A and must not be called a finished T09 product. Review controls are an explicitly adopted synthetic example.
4. **Presentation:** CSS is clean and readable but structurally a long text-first stack of cards, not yet the visually distinctive comparison-first product in JW-RD-3.0. Do not distract from the four correctness defects before visual refinement.

## Required corrective implementation ticket for Muse

**Ticket:** JW-T09A-FIX01. **Pinned base:** `e956eae91b8779b36520295cecfa34dbae6708b6`; isolated worktree `C:\JW-Muse-T09`; existing T09A uncommitted files. **Authorized files:** `frontend/src/App.tsx`, `frontend/src/lib/api.ts`, `frontend/src/App.test.tsx`, optionally `frontend/src/lib/api.test.ts` if needed, and the T09A contract document to record corrections. **Forbidden:** backend, solver, checker, oracle, receipts, original fixtures, package dependency upgrades, Meta metered calls, commit/push/deploy.

Implement F1–F4 first; cover async invalidation and receipt wording if small and safe. Run `npm.cmd run build`, `npm.cmd test`, then owner / independent integration checks against real FastAPI: parse 4 registrations / 3 attendance, shortlist Kim/Kym, explicit demo review adopt, flagship `REVERSIBLE_MINIMUM_PROVEN`, visually explicit **T-02: R-A2 → R-B2**, before counts A=2/B=1 versus after A=1/B=2, correct receipt JSON and `VERIFIED_REPLAY`. Validate no stale verdict after Clear, and 375px/mobile/keyboard smoke. Run `git status --short --untracked-files=all` in a normal owner terminal. No acceptance solely on mocked frontend tests.

**Stop conditions:** any difference between backend actual JSON and TS contract, failed build/test, incorrect verifier status, unresolved stale-state bug, or shell execution unavailable. Report exact traces rather than guessing.
