# JW-T09-UX02-FIX01 — Verdict-faithful verification copy (changes and evidence)

**Authority:** JW-RD-3.0 FINAL; UX02 independent audit. **Base:** uncommitted
T09A-FIX01 + UX01 + UX02 working tree. **Writer:** Meta Muse Code only.
**Status:** Candidate for independent review. No commit, push, deploy, paid
inference, or new dependency.

## Allowlist compliance

Changed only `frontend/src/App.tsx`, `frontend/src/App.test.tsx`, and this new
document. No backend, math, fixture, API-lib, CSS, config, or dependency edits.
No browser- or test-generated files staged. `frontend/dist/` and scratch dirs
removed after verification (both ignored/untracked).

## Defects corrected (both verified against real backend code)

Proof-basis vocabulary comes from `src/joinwitness/receipts.py` (`_classify`):
`SOLVER_AND_SMALL_ORACLE`, `SOLVER_ATTRIBUTED_ONLY`, `CHECKED_WITNESS_ONLY`,
`INCOMPLETE`. A completed solver optimum without oracle agreement yields
`REVERSIBLE_MINIMUM_PROVEN` + `SOLVER_ATTRIBUTED_ONLY`; stable + oracle-stable
yields `STABLE_WITHIN_REVIEWED_POLICY` + `SOLVER_AND_SMALL_ORACLE`. Verify route
`backend/api.py` returns exactly `{status, verdict, proof_basis,
receipt_sha256, scope_caveat}` — no UI field was invented.

1. **Stable replay** (`VERIFIED_REPLAY` + `STABLE_WITHIN_REVIEWED_POLICY`): Verify
   stage now says "The replay confirms the stability result" and "No permitted
   reversal exists within the reviewed model". It no longer renders the
   reversal lead ("We independently checked this alternative"), the flips-the-
   question claim, any changed assignment, or any minimum proof. Oracle
   attribution: `SOLVER_AND_SMALL_ORACLE` → oracle independently confirmed
   stability; otherwise solver-attributed infeasibility without oracle claim.
2. **Proven minimum, solver-only** (`REVERSIBLE_MINIMUM_PROVEN` +
   `SOLVER_ATTRIBUTED_ONLY`): Verify stage now states the optimum is
   solver-proven with no separate small-oracle cross-check, keeping the
   independent checker recomputation attributed (`checker_status` from the
   checked analysis). `SOLVER_AND_SMALL_ORACLE` keeps the oracle cross-check
   sentence. `REVERSIBLE_WITNESS_ONLY` never claims minimum-proven.
3. **Evidence cross-check:** before any success language the UI compares
   `verify.verdict` vs `receipt.receipt.verdict` vs `analysis.verdict` and
   `verify.receipt_sha256` vs `receipt.receipt.receipt_sha256`. Any disagreement
   renders a distinct "Evidence mismatch" alert and withholds all proof claims.
4. `NOT_VERIFIED` replay, timeouts, failures, and pre-replay states keep
   scoped/uncertain copy. Flagship flow, keyboard focus, epoch protections, and
   synthetic-data caveats unchanged.

## Tests (all contract-shaped mocks, real field shapes)

New `T09-UX02-FIX01` block in `frontend/src/App.test.tsx` (6 tests): stable
replay states stability without reversal language; solver+oracle keeps
oracle-attributed minimum proof; solver-only states solver-proven optimum
without oracle claim (mock uses the contract-faithful `OPTIMAL` /
`WITNESS_VALID` / oracle `NOT_VERIFIED` combination that `_classify` maps to
`SOLVER_ATTRIBUTED_ONLY`); witness-only never upgrades; verdict mismatch and
digest mismatch each show the mismatch state with proof language suppressed.
Pre-fix run observed 4 justified failures (stable, solver-only, both
mismatches); the 2 guard tests passed before and after.

## Evidence (observed in-sandbox)

- `npm.cmd run build` — PASS (`tsc --noEmit` + `vite build`, 36 modules,
  built in ~2s).
- `npm.cmd test` — **30/30 PASS** (24 pre-existing + 6 new), 2 files.
  Workspace-local TEMP/TMP required (sandbox denies system temp); scratch
  removed afterwards.
- Python `pytest`: not runnable here (no interpreter in sandbox PATH).
- Browser journey: BROWSER UNRUN (no runner in sandbox); owner-side real
  browser tests still required before acceptance.

## Remaining limitations

- Mismatch check covers the five ticket-named fields; `analysis.receipt_sha256`
  is displayed but not part of the gating comparison.
- `App.tsx` line endings normalized to CRLF by the file surgery; content
  verified byte-clean (zero U+FFFD, non-ASCII inventory intact).
- Owner must still run `pytest -q`, the live four-stage browser pass with
  screenshots, and confirm the working-tree file list.
