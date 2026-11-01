# JW-T09A — Implemented scope and evidence (browser vertical slice)

**Authority:** JW-RD-3.0 FINAL §§3–6, 8–11, 14–16. **Base intent:** pinned `e956eae91b8779b36520295cecfa34dbae6708b6` (git SHA not verifiable in this sandbox — see limitations).
**Backend contracts:** `docs/CONTRACTS_T08A.md` (7 routes, `jw.api.v1`), `docs/CONTRACTS_T08B.md` (Meta route excluded from browser).

## What was built (all new files, no backend/math edits)

- `frontend/` — React 19.2.0 + Vite 7.1.9 + TypeScript 5.9.3 vertical slice, `package-lock.json` pinned.
  - `vite.config.ts` — dev proxy `/api` → `http://127.0.0.1:8000`, `vitest` jsdom + globals.
  - `src/lib/api.ts` — exact-shape POST clients for `/api/parse`, `/api/suggest`, `/api/review/validate`,
    `/api/analyze`, `/api/receipt`, `/api/verify`. Backend `detail.code` values surface verbatim via `ApiError`.
  - `src/lib/demo.ts`, `src/lib/encoding.ts` — byte-exact Base64 of bundled fixtures, CSV previews.
  - `src/fixtures/{registrations,attendance}.csv`, `src/fixtures/{review_policy,reference}.json` —
    byte-identical copies of `fixtures/flagship_flip/*` (SHA-256 verified: registrations
    `98c829…47c2bf`, attendance `c771e8…405ea3`, matching the T08B pinned hashes).
  - `src/App.tsx` + `src/App.css` — four stages: Import → Review → Challenge → Verify.
  - `src/lib/api.test.ts` (4 tests), `src/App.test.tsx` (5 tests).
- `docs/CONTRACTS_T09A.md` — this file.

## Stage behavior (all figures rendered only from live API responses)

1. **Import** — “Try fictional demo” POSTs exact fixture bytes to `/api/parse`; shows `PARSED_UNREVIEWED`,
   real row counts, previews, raw SHA-256 vs bundled originals. Upload-control limitation stated; no upload built.
2. **Review** — “Fetch deterministic shortlist” calls `/api/suggest`; labeled `UNREVIEWED_SHORTLIST`, no
   permission inferred, Kim/Kym (T-02: R-A2/R-B2) partial-coverage caveat shown. Frozen
   `review_policy.json` + `reference.json` shown as labeled example drafts with per-pair status, unmatched
   rules, A/B groups, reference choices. Explicit adopt button POSTs exact `jw.review.v1` +
   `jw.reference.v1` to `/api/review/validate`; stores `review_sha256`/`review_revision`/`reference_sha256`/
   baseline counts. Analysis stays disabled on failure. No `/api/meta/suggest` call anywhere; honest
   pending-bridge AI status shown instead.
3. **Challenge** — fixed question only; reference A/B + true/false shown only after validation. “Run Challenge”
   POSTs source bytes + policy + reference + `expected_review_sha256`/`expected_revision` to `/api/analyze`;
   renders backend `ANALYSIS_VERIFIED`, baseline 2A/1B → alternative 1B/2B, minimum 1, changed row T-02 —
   all conditional on the response. Distinct copy for stable / witness-only / inconclusive / error / coverage.
4. **Verify** — “Issue receipt” POSTs the same frozen payload to `/api/receipt`; exact receipt bytes offered as
   `joinwitness-receipt-<12hex>.json` download. “Verify replay” POSTs receipt + source + policy to
   `/api/verify`; shows `VERIFIED_REPLAY`, checker/solver/oracle roles, “SHA-256 is not a signature”,
   and a local-only offline replay command template (never claims the browser ran the CLI).
   Any demo reload/clear resets review → analysis → receipt → verify state; no stale verdicts.

## Evidence (observed in-sandbox)

- `npm install` (workspace-local cache): 163 packages, React 19.2.0 / Vite 7.1.9 / TS 5.9.3 / Vitest 3.2.4.
  Node `v22.16.0`, npm `10.9.2`.
- `npm run build`: PASS (`tsc --noEmit` + `vite build`, 36 modules, `dist/` emitted).
- `npm test`: **9/9 PASS** (request shapes, invalidation, status labels, no auto-adopt, failure states).
- Fixture SHA-256 match: confirmed via `Get-FileHash` (see above).
- **Not run in sandbox:** Python `pytest` (no interpreter in sandbox PATH, no `.venv` in repo),
  Uvicorn + Vite live Import→Verify click-through with screenshots, keyboard-only/mobile-375px/reduced-motion
  manual passes, `git diff --check` / `git status` (git unusable — dubious-ownership, and adding a
  `safe.directory` exception would violate the no-Git-security-change constraint).

## Known defects / unfinished

- No live end-to-end evidence yet (backend never started here; loopback `listen()` returns EACCES in sandbox,
  so even Vite dev serve could not bind). Owner must run Uvicorn on 127.0.0.1:8000 + `npm run dev`
  (127.0.0.1:5173) and execute the real four-stage pass before acceptance.
- `frontend/dist/` and `frontend/.tmp-npm-cache/` are local-only (removed before handoff where applicable);
  `node_modules/` stays ignored per existing `.gitignore` (no ignore change needed).
- Reachability claim: **not currently serving** (sandbox denies binds). Start commands below are the
  addresses to use after starting, not live URLs.

## Start (after owner starts both servers locally)

- Backend: `uvicorn backend.api:app --host 127.0.0.1 --port 8000` (from repo root, existing venv).
- Frontend: `npm run dev` (from `frontend/`).
- Open `http://127.0.0.1:5173` in a browser.

## JW-T09A-FIX01 corrections (30 October 2026, frontend only)

Authorized files only: `frontend/src/lib/api.ts`, `frontend/src/App.tsx`,
`frontend/src/App.test.tsx`, `frontend/src/lib/api.test.ts`, and this document.
No backend, solver, checker, oracle, receipt, fixture-original, or dependency change.

- **F1 — verdict mapping:** Challenge now branches on the four versioned receipt
  verdicts (`REVERSIBLE_MINIMUM_PROVEN`, `REVERSIBLE_WITNESS_ONLY`,
  `STABLE_WITHIN_REVIEWED_POLICY`, `NOT_VERIFIED`) with distinct copy per branch.
  Proof basis (`proof_basis`), checker/oracle statuses, coverage, and the backend
  `scope_caveat` render on every analysis. Minimum is never inferred from
  `checker_status` alone. Note: JW-RD-3.0 §05 text is not present in this
  workspace, so the wording is derived from the `jw.receipt.v1` taxonomy and
  `docs/CONTRACTS_T06.md` / `docs/CONTRACTS_T08A.md` vocabulary, not quoted
  verbatim from the RD.
- **F2 — witness tuples:** `AnalyzeResponse.witness_assignments` is now the wire
  tuple-array type `Array<[string, string | null]>`; `minimum_changed_assignments`
  is `number | null` (stable responses send `null`). `adaptWitnessAssignments()`
  normalizes tuples to typed UI objects and `changedWitnessRows()` computes
  changed rows from reference pairs versus witness pairs; the UI renders exact
  data-driven `attendance: old → new` pairs (flagship: `T-02: R-A2 → R-B2`).
- **F3 — replay module:** offline replay copy now reads
  `python -m joinwitness.verify --receipt … --registrations … --attendance … --policy …`,
  matching committed `src/joinwitness/verify.py` (verified against its argparse flags).
- **F4 — faithful tests:** `App.test.tsx` mocks use the real wire shapes
  (`verdict: REVERSIBLE_MINIMUM_PROVEN`, `checker_status: WITNESS_VALID`,
  `oracle_status: ORACLE_REVERSIBLE`, tuple `witness_assignments`) and cover the
  exact verdict copy, the T-02 old→new link, proof source, absence of the
  inconclusive label, plus stable / witness-only / not-verified branches.
  `api.test.ts` adds adapter unit tests (tuple normalization, flagship
  changed-row detection, null witness).
- **Stale async (bounded):** an operation epoch invalidates out-of-order
  completions; Clear bumps the epoch so late responses are discarded; a failed
  fresh analysis clears the previous verdict instead of leaving it visible.
  Covered by two new component tests.
- **Receipt wording (bounded):** the download is labeled a serialized JSON copy
  of the API receipt object, not byte-identical provider response bytes.

Evidence (this sandbox): `npm run build` PASS (`tsc --noEmit` + `vite build`,
36 modules, `dist/` emitted); `npm test` **16/16 PASS** (6 request/adapter unit
+ 10 component). Vitest required workspace-local `TEMP`/`TMP` because the
sandbox denies the system temp dir; the scratch dir was removed afterwards.
`git status` could not run here (dubious-ownership guard); owner must run it in
a normal terminal. Live Uvicorn + browser four-stage pass, mobile/keyboard
smoke, and pytest remain owner-side (not run here).

## Recommendation

**HOLD for JW-T09A acceptance** pending the owner-run live four-stage pass (real API statuses per stage,
screenshots, keyboard/mobile/reduced-motion notes, `pytest -q`, `git status` file list). Code, contracts,
build, and unit/component evidence are complete; no backend, math, fixture-original, or committed doc was
modified; no commit/push/deploy or Meta call was made.
