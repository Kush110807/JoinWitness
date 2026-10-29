# JoinWitness — JW-T05 CP-SAT optimization contract (`jw.solver.v1`)

## Scope and authority

- **Authoritative source:** JW-RD-3.0 FINAL, existing T02/T03 source/review/reference contracts; base commit `2fa5ded45bd1fa30dbdd44a3b2427beac5410b81`.
- T05 implements a **separate OR-Tools CP-SAT search**, not the T04 exhaustive oracle. `solver.py` imports no `oracle.py` code. T06 must independently validate witness assignments and receipts before any combined public proof certificate is shown.
- Source/policy/reference validation is performed **before** model construction and before any attempt to solve. The model uses the complete, explicitly reviewed per-row choice sets from T03. Missing real-world candidates cannot be inferred impossible.
- All assignments are by existing attendance and registration IDs, never by display name or row position.
- Every row selects one reviewed choice (registration or allowed `None`), and no registration can be selected by two attendance rows. `CONFIRMED`, `POSSIBLE`, `PROHIBITED`, and explicit unmatched rules come from reviewed policy.

## Exact optimization

For `x[i,j]` Boolean choice variables (including unmatched `None` only when permitted):
- `sum(j in choices[i]) x[i,j] == 1` for every attendance row.
- `sum(i) x[i,j] <= 1` for every registration ID.
- `A = sum(x[i,j] where g(j)=='A')`; `B = sum(x[i,j] where g(j)=='B')`. Unmatched adds to neither.
- If the frozen reference has `A>B`, reverse target is `A<=B`, including ties. If the reference has `A<=B`, reverse target is `A>=B+1`.
- Minimize `D = sum_i (1 - x[i, reference[i]])`. The reference assignment was already validated as a permitted choice for every row.

## Solver bounds, pins and status

- Runtime dependency `ortools==9.15.6755` pinned in `requirements-solver.txt`, installed into the project's Python 3.13 virtual environment. This version provides CPython 3.13 Windows x64 wheels. T05 does not use Meta/Modal/Baseten.
- Default and hard maximum local interactive time limit: `10` seconds; one worker; seed `11`; explicit zero absolute/relative optimality-gap acceptance.
- Result `jw.solver.v1` is frozen Pydantic output with review/reference fingerprints, coverage, fixed question's baseline, exact solver status, witness (when found), and an explicit unchecked marker. `ortools_version`, seed, worker count and time limit are recorded.
- CP-SAT `OPTIMAL` with a locally sanity-checked flipping assignment: `SOLVER_OPTIMAL_WITNESS_UNCHECKED`, with **solver-attributed** optimization completion only, NOT the T06 independent witness check.
- CP-SAT `FEASIBLE`: `SOLVER_FEASIBLE_WITNESS_UNCHECKED`; its distance is an observed *upper bound*, NEVER certified minimum.
- CP-SAT `INFEASIBLE`: `SOLVER_INFEASIBLE_UNCHECKED`, conditional on the precise reviewed model. NOT blanket real-world stability and not yet a verified combined certificate.
- `UNKNOWN`, `MODEL_INVALID`, solver exception, missing OR-Tools or locally invalid witness become `NOT_VERIFIED`. No such state has an admitted public proof or a witness.
- `independent_checker_status` is always `NOT_RUN_T06`. T05 internal sanity checking is not independent verification.
- A solver finding must never appear in a user-facing page as a validated result until T06 checker and appropriate T04 cross-check gates are integrated.

## Tests and evidence gates

1. All original 133 T02–T04 tests must still pass.
2. New `tests/test_solver_parity.py`: five named fixtures, **120** deterministically generated small valid matching instances compared directly with T04's exhaustive oracle, 13-row case that T04 refuses but CP-SAT can still model, invalid solver controls, and deterministic simulated FEASIBLE/UNKNOWN/MODEL_INVALID/error/bad-witness status paths.
3. Windows Python 3.13 (or a compatible Python) must install `ortools==9.15.6755`, run the full suite with **zero skipped tests** and execute the flagship/two_changes/stable CLIs with expected typed statuses.
4. Supply actual complete test stdout, CLI JSON, `pip show ortools`, Git file inventory, `git diff --check`, current head, and limitations. No Git commit/push until coordinator review.

## Known limitations and next gate

- This implementation is an offline candidate; no T06 independent witness checker, JSON receipt replay or live Meta call exists yet.
- The T05 local runtime may produce a valid solver witness, but that witness is **unchecked** independently until T06.
- Objective proofs on the small fixtures are independently corroborated by T04 only when T05 parity tests actually execute and pass.
- OR-Tools's runtime dependencies are not yet fully locked with hashes; the exact top-level OR-Tools version is pinned. A reproducible complete environment lock belongs before deployment/release.
