# CONTRACTS_T09_INT01_FIX01 — Verdict-copy and provenance correction

Authority: JW-RD-3.0 FINAL > frozen T02–T08 math/API contracts > integrated
T09 spec > INT-01. Scope: isolated `C:\JW-Muse-T09` only. No backend, fixture,
dependency, or config change. No Meta call, commit, push, or deploy.

## Defects corrected

1. **Count-blind banner.** The contextual headline hardcoded "One … change".
   It is now count-aware: the number renders only for
   `REVERSIBLE_MINIMUM_PROVEN` with a valid server-reported positive-integer
   `minimum_changed_assignments` (1 → "One …", 2 → "Two …", N → "N …").
   Null/non-integer/non-positive minimums suppress the number entirely
   ("A permitted alternative reverses the result."). The UI never derives a
   minimum from the changed-row count (`isValidMinimum` gate in
   `decisionView.ts`, applied in `ProductShell` and the Challenge minimum
   block).
2. **Stability-implying null-alternative copy.** `formatCanvasCounts`,
   the contextual-bar suffix (`nullAlternativeSuffix`), and the single-panel
   canvas label (`singleCanvasLabel`, passed as a prop) are now verdict-aware:
   only `STABLE_WITHIN_REVIEWED_POLICY` may say no permitted reversal exists,
   always qualified to the reviewed set; `NOT_VERIFIED` says
   "Inconclusive — no reversal or stability established" in visible copy and
   ARIA alike.
3. **Model-suggestion mislabel.** Candidates sourced from `policy.edges` are
   no longer called suggestions. Each shows its exact edge status
   ("Confirmed link" / "Possible link", carried from the policy edge through
   `queueRecords` into `RecordQueue`) plus a truthful origin line
   ("Origin: prepared fictional policy") and a permission line that is
   "not yet permitted — adoption required" until adoption. The deterministic
   `/api/suggest` shortlist is shown separately as unreviewed suggestions.
   Inspection stays view-only; prepared-policy adoption stays the sole
   authority action.

## Status mapping (exact)

- `REVERSIBLE_MINIMUM_PROVEN` + valid N → "N … changes …" + "Fewest changed
  assignments: N — proven minimum" (+ solver/oracle attribution).
- Same verdict + invalid minimum → numberless reversal sentence, no
  minimum line.
- `REVERSIBLE_WITNESS_ONLY` → checked-witness copy, minimality explicitly
  unproven. `STABLE_WITHIN_REVIEWED_POLICY` → scoped-stability copy only.
- `NOT_VERIFIED` → "Inconclusive …" everywhere; mismatch/failed replay →
  proof withheld, error surfaced. Zero `/api/meta` requests (tested).

## Test evidence

- `decisionView.test.ts`: count words (1/2/3), invalid-minimum suppression,
  verdict-aware null-alternative copy. `App.test.tsx` FIX01 block: two-change
  banner, one-change banner, null-minimum suppression, stable-only stability
  claim, NOT_VERIFIED innerHTML/ARIA sweep, Confirmed/Possible label +
  no-fetch selection test. Prior suites updated only where copy moved.
- `npm.cmd run build` / `npm.cmd test` outcomes in the handoff report.
- Unrun: live FastAPI+Vite browser matrix, `pytest -q`, outsider
  comprehension — owner-side gates, unchanged from INT-01.
