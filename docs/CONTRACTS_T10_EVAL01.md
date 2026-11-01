# CONTRACTS_T10_EVAL01 — Bounded synthetic dataset generator

Authority: JW-RD-3.0 FINAL > frozen T02–T09 contracts. Scope: generator only.
No engine, API, UI, fixture-original, cap, or dependency change. No Meta call.

## Deliverable

- `scripts/gen_synthetic_demo.py` (stdlib only: argparse/hashlib/json/random/sys/pathlib).
- Intended outputs under `fixtures/demo60_90/`: `registrations.csv` (90),
  `attendance.csv` (60), `review_policy.json` (`jw.review.v1`, rev 1,
  `REVIEWED_CLOSED_SCOPE` + attested scope note), `reference.json`
  (`jw.reference.v1`, complete one-to-one baseline), `ground_truth.json`
  (truth map, NEVER an engine input, no Meta provenance), `MANIFEST.json`
  (seed, SHA-256, counts, construction report, owner commands, disclaimers).

## Design (targets, not measurements)

- 48 settled exact-match rows (CONFIRMED + FORBIDDEN-unmatched) + 12 alias
  families (T-49..T-60): slash-alias, typo-neighbor, and one exact-shared
  cross-group name; 2–3 POSSIBLE alternatives each, all from baseline-unused
  registrations; unmatched ALLOWED on T-55/T-60 only.
- Baseline designed at A=32/B=28 (margin 4); ≥8 A-truth rows hold free B
  alternatives, so a tie-or-better reversal needs 2 flips arithmetically.
  Feasibility and minimum are engine-determined and UNRUN.
- Ground truth, reviewer-authorised possibilities, and deterministic-shortlist
  suggestions are kept in separate artifacts; provenance is never fabricated.

## Self-validation (runs inside the generator)

Structural asserts (counts, unique IDs, field bounds, ≤10 candidates/row,
complete unmatched coverage, baseline permitted/one-to-one/A>B),
a bipartite feasibility check mirroring the policy gates, a challenge-shape
check (flippable rows ≥ flips needed), plus `freeze_review`/`freeze_reference`
through the real T02/T03 code when importable (else clearly SKIPPED).
Failures exit 2 and leave no partial output; a pre-existing non-empty `--out`
is refused, never wiped.

## Status in this session

Generator authored but NOT executed (no Python interpreter in this sandbox):
no fixture files produced, no validation run, no engine benchmark run.
Owner command (repo root, accepted venv):
`python scripts/gen_synthetic_demo.py --seed 20261031 --out fixtures/demo60_90`
followed by the solver/verify/pytest/API commands in `MANIFEST.json`.
Intended measurements: ingest/freeze/solver/checker/receipt/replay wall
times + statuses at 60/90, shortlist coverage vs policy, peak memory if
available. Expected: small-case oracle refuses (ROW_LIMIT) → solver-attributed
proof only; any timeout is an honest `NOT_VERIFIED`, never stability.
