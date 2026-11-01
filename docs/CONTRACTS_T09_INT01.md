# CONTRACTS_T09_INT01 — Integrated Shell and Decision Canvas

Authority: JW-RD-3.0 FINAL > frozen T02–T08 contracts/evidence >
`JW_T09_INTEGRATED_PRODUCT_EXPERIENCE_SPEC_V1.md` > `JW-T09-INT-01.md`.
Status: PROPOSED candidate, uncommitted. INT-00 hash pins verified before
editing (App.tsx `1b95448e…`, App.css `aecda108…`, App.test.tsx `0bc472d8…`).
No backend, math, fixture, dependency, or config change.

## Changed and new files (allowlist only)

- `frontend/src/App.tsx` — state machine, data derivation, stage composition.
- `frontend/src/App.css` — tokens (`--tap-min`, spacing, queue/inspector
  columns) plus shell, entry, source-card, queue, canvas-row, and drawer styles.
- `frontend/src/App.test.tsx` — 38 prior tests kept current + 6 INT-01 tests.
- `frontend/src/lib/decisionView.ts` (new) — pure display derivation from
  accepted response types: verdict headline/pill, reversibility predicate,
  count leaders, canvas counts line, decisive-link text. No permission or math.
- `frontend/src/lib/decisionView.test.ts` (new) — 5 unit tests.
- `frontend/src/components/ProductShell.tsx` (new) — skip link, top bar,
  contextual bar, gated stage nav, footer.
- `frontend/src/components/RecordQueue.tsx` (new) — record queue, selected
  links, permission inspector. Selection is view-only (`aria-pressed`).
- `frontend/src/components/DecisionCanvas.tsx` (new) — original/alternative
  panels, decisive change, selectable changed rows, view-only toggle.
- `frontend/src/components/ProofDrawer.tsx` (new) — scope line, status block,
  actions, bounded Technical evidence disclosure.
- `docs/CONTRACTS_T09_INT01.md` — this file.

## UI contract

- Entry: H1 + one-sentence purpose + `Example — not analysed` SVG depiction
  (illustrative only, never a computed claim) + primary `Try the fictional
  example` + disabled `Use my CSVs` (`Coming in INT-02`) + trust line
  `AI suggests · You decide · Mathematics checks` with browser-Meta-off note.
- Import: two source cards (row counts, short digests, full-hash previews).
- Review: queue (Resolved/Unresolved) / center links / inspector disclosure;
  three-part grid at ≥1280px, stacked below. Adopt stays the only authority
  action; per-edge/unmatched/manual editing is INT-02 and never depicted as
  functional.
- Challenge: canvas from response data only; changed-row buttons inspect
  (`aria-pressed`, no fetch, no permission change); reversal sentence and
  proven minimum only for checked verdicts; enums stay in disclosure.
- Verify: ladder per actual replay; mismatch fail-closed; receipt/verify
  blocks inside a max-height scrolling disclosure — no 32px columns, no page
  horizontal scroll.
- Accessibility: skip link first in tab order targeting focusable `main`;
  stage-heading focus only after user-driven transitions; controls
  ≥44px (`--tap-min`); `prefers-reduced-motion` respected; no state hidden
  behind motion or hover.

## Status / display mapping

Verdict copy derives from `decisionView` predicates over the live
`verdict`/`proof_basis`/`checker_status` fields; minimum appears only for
`REVERSIBLE_MINIMUM_PROVEN`; witness-only/stable/inconclusive/mismatch keep
their distinct honest states. `witness_assignments` stays wire tuples via the
existing adapter; `minimum_changed_assignments` stays nullable. Zero
`/api/meta` requests from the browser (asserted in tests).

## Limitations

- JSDOM proves structure, copy gating, and fetch discipline — not 1440×900 /
  390×844 / 375×812 rendering, real Tab behavior, or 20-second outsider
  comprehension. Owner must run the live FastAPI+Vite pass, `pytest -q`, and
  the two-person comprehension check before acceptance.
- Custom CSV upload, editable review, and browser Meta remain INT-02/03.
