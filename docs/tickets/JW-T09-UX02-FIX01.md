# JW-T09-UX02-FIX01 — Verdict-faithful verification copy

**Authority:** JW-RD-3.0 FINAL; UX02 independent audit. **Location:** isolated local `C:\JW-Muse-T09`. **Base:** current uncommitted T09A-FIX01 + UX01 + UX02 working tree. **Writer:** Meta Muse Code only.

## Objective

Correct the two demonstrated UI proof-language defects without reworking the product, changing the solver, or introducing new dependencies.

## Authorized files

- `frontend/src/App.tsx`
- `frontend/src/App.test.tsx`
- Optional new/update `docs/CONTRACTS_T09_UX02_FIX01.md` to record actual changes and evidence.

**Forbidden:** all backend, math, fixtures, API lib, CSS, Vite/dependency config, environment/secrets, README, commits/pushes/deployments and live model calls. No browser-generated or test-generated files should be staged for Git.

## Required corrections

1. Stable replay: `VERIFIED_REPLAY` with `STABLE_WITHIN_REVIEWED_POLICY` must say no permitted reversal exists **within the reviewed model**. It must **not** claim that an alternative flips the fixed question; must not display a changed assignment or minimum-reversal proof.
2. Proven minimum: `REVERSIBLE_MINIMUM_PROVEN` with a completed solver-only proof basis may accurately say the optimum is solver-proven, **without** claiming a separate small-oracle cross-check. Keep the independent checker evidence attributed accurately. `REVERSIBLE_WITNESS_ONLY` never says minimum proven.
3. Cross-check `verify.verdict`, `receipt.receipt.verdict`, `analysis.verdict`, `verify.receipt_sha256`, and `receipt.receipt.receipt_sha256` before success language. If inconsistent, show a distinct evidence-mismatch state and withhold proof claims. Do not invent API fields or authority.
4. `NOT_VERIFIED`, timeout, failure, and partial-coverage branches retain scoped/uncertain copy, without assertions of an established reversal or proved stability.
5. Preserve existing flagship flow, keyboard focus, response-epoch protections and visible honest synthetic caveats.

## Mandatory tests

- Stable receipt replay returns `VERIFIED_REPLAY`; text says reviewed-policy stability, not reversal.
- Reversal with `SOLVER_AND_SMALL_ORACLE` retains minimum-proof + oracle attribution.
- Reversal with completed solver-only proof retains minimum-proof **without** oracle claim.
- Witness-only replay never upgrades to minimum-proven.
- Verify digest or verdict mismatch suppresses proof-language and displays mismatch.
- Existing 24 tests remain green; build passes. Add tests using actual contract-shaped mocks rather than assumed fields.

## Evidence and stops

Run from `frontend/`: `npm.cmd run build`, `npm.cmd test`; report exact outputs and changed paths. Stop on failed tests, changing API contracts, or unavailable dependencies. If the actual backend cannot produce a solver-only receipt, do not fabricate it as live evidence; it may be used as a specifically described mock contract-state test.

**Do not commit, push, deploy, alter security settings or call Meta.** Return results for independent source review and owner-side real browser tests.
