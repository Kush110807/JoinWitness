# CONTRACTS_T09_DEMO01 — Verified flagship demonstration integration

Authority: JW-RD-3.0 FINAL > integrated T09 spec > INT-01-FIX01 > INT-02 >
owner-verified T10-EVAL01 evidence. Status: PROPOSED candidate, uncommitted.
No engine, solver, checker, oracle, source-fixture, cap, Meta, dependency, or
config change. No Meta call, commit, push, or deploy.

## Changed and new files

- `frontend/src/fixtures/demo60_90/` (new): byte-identical copies of the four
  engine inputs only (`registrations.csv`, `attendance.csv`,
  `review_policy.json`, `reference.json`), hashes re-verified against the
  generation manifest. `ground_truth.json` and `MANIFEST.json` are NOT copied,
  never imported, never fetched, never displayed.
- `frontend/src/lib/demo.ts` — `demo60*` loaders, texts, and manifest pins
  (`EXPECTED60_*`), with schema-version guards.
- `frontend/src/App.tsx` — `demo60` source kind: primary CTA, manifest-pinned
  source cards, prepared-policy adoption, 60-row overview + ambiguous roster,
  three-way effective policy/reference switch.
- `frontend/src/components/RecordQueue.tsx` — optional controlled selection
  (uncontrolled default preserved).
- `frontend/src/App.css` — overview/roster styles.
- `frontend/src/App.test.tsx` — 3 DEMO01 tests (load/overview/roster,
  adopt + engine counts, replay + switch-back).
- `docs/CONTRACTS_T09_DEMO01.md` — this file.

## UI contract

- First-time visitors meet `Explore the verified event` (primary); the
  3-attendee `Try the fictional example` tutorial and custom CSVs remain.
- The 60/90 review shows live parse counts (60/90), manifest-pin labels, a
  12-record ambiguous roster driving queue selection, and the full record
  list — never a 60-row dump without orientation.
- Adoption is explicit (`Adopt the verified 60/90 review rules`); viewing or
  selecting never approves. Challenge/Verify render only live engine values;
  expected numbers (32/28 → 30/30, minimum 2) appear solely as mock data in
  tests and owner-side observations, never as UI constants.
- Trust boundaries unchanged: human authority, fail-closed verification,
  stale-state invalidation, solver-attributed optimality, zero Meta requests.

## Limitations

- Engine execution is owner-side (no Python in this sandbox): the UI renders
  engine responses faithfully, but the live 60/90 backend run, browser matrix
  (1440×900 / 390×844 / 375×812), `pytest -q`, and outsider comprehension
  remain open acceptance gates.
