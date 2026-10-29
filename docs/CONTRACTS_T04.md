# JoinWitness JW-T04 — bounded independent exhaustive oracle

**Authority:** JW-RD-3.0 FINAL. **Base:** `6630f4d21bff9599e52ac37a5deb5abd949003f3`. Version: `jw.oracle.v1`.

## What has been implemented

`enumerate_oracle(InputBundle, ReviewSnapshot, ReferenceMatching)` first calls T03 source/snapshot/reference authority validators. After validation, it **independently interprets the reviewed edge statuses and unmatched rules** and enumerates all legal one-to-one assignments for the bounded reviewed universe. It independently computes A and B counts, the strict `A>B` predicate and changed-assignment distance from the frozen reference. It never imports T03's `allowed_choices`/baseline count helper or T05 solver implementation.

- Assignment identity is based on attendance and registration IDs, not names or row positions.
- `CONFIRMED` stays fixed; `PROHIBITED` and unreviewed edges are absent; unmatched is permitted only according to explicit rules. Multiple rows cannot consume the same registration.
- `None` (unmatched) contributes to neither group. `A==B` is **false** for the `A>B` predicate.
- Reverse target is automatically the negation of the validated frozen reference predicate, including when reference predicate is initially false.
- The exhaustive oracle traverses **all valid assignments** if it starts. It chooses the smallest changed-assignment witness, with deterministic row ordering. No heuristic prune can remove lower-distance solutions.
- `ORACLE_REVERSIBLE` and `ORACLE_STABLE` mean *complete enumerated evidence inside the reviewed policy universe*. The complete enumeration itself is a small-case minimum/nonexistence proof within those assumptions.
- **Important:** the independent T06 standalone *witness checker* and T05 *CP-SAT* have **not** run. Output fields say `NOT_RUN_T06` and `NOT_RUN_T05`, respectively. Do not map T04 results to a combined checker+solver public certificate.

## Hard refusal, not partial "stability"

The small-instance bound is 12 attendance rows **and** 250,000 unpruned Cartesian candidate combinations, whichever is exceeded first. The conservative Cartesian bound is the product of candidate-choice counts *before* one-to-one exclusions. On exceeding either bound, return `NOT_VERIFIED` with `ROW_LIMIT` or `COMBINATION_LIMIT`, zero enumerated assignments, no witness, no minimum and no false stability claim. No truncated oracle is reported as complete. A non-verified CLI result exits with code 3. Invalid, stale, or contradictory source/policy/reference input fails closed via T02/T03 validators and CLI code 2.

If a caller supplies custom bounds, they can **only lower** them below the fixed maximum. Booleans are not accepted as integers for these parameters.

## Canonical source and policy boundaries

`ReviewSnapshot` and `ReferenceMatching` digest validation is inherited from T03; raw-byte freshness requires re-ingesting original source files. The oracle does **not** independently authenticate the human reviewer's real-world authority or exhaust the true universe of identities. `REVIEWED_CLOSED_SCOPE` attests only the explicit synthetic/reviewed analysis universe. Raw hashes are integrity fingerprints, not cryptographic signatures.

No AI inference, Meta Model API, API server, arbitrary CSV mapping, optimizer, public deployment, private personal data, paid services, or Git push occurs in T04.

## Result contract

`OracleResult` is immutable, strict, JSON-serializable, `schema_version=jw.oracle.v1`:

- `status`: `ORACLE_REVERSIBLE | ORACLE_STABLE | NOT_VERIFIED`
- `reason`: `COMPLETE_ENUMERATION | ROW_LIMIT | COMBINATION_LIMIT`
- `review_sha256`, `reference_sha256`, `coverage`, `baseline_counts`
- `combination_upper_bound`, `enumerated_feasible_assignments`
- `minimum_changed_assignments`: integer >=1 **only** on complete reversal, else null
- `alternative_counts`, `alternative_assignments`: complete ID-based witness only on complete reversal, otherwise null
- `independent_checker_status=NOT_RUN_T06`, `solver_status=NOT_RUN_T05`
- mandatory `scope_caveat`

## Bundled positive, negative, and boundary fixtures

- `flagship_flip`: baseline 2/1, alternative 1/2, minimum 1, two feasible choices.
- `stable`: baseline 2/1, exactly one feasible assignment, no reversal **under this reviewed policy**.
- `two_changes`: baseline 4/1, possible flip 2/3, minimum 2, four feasible assignments.
- `tie`: baseline 2/1, a permitted unmatched row yields 1/1, false; minimum 1.
- `false_reference`: baseline 1/2 (false), permitted alternative 2/1 (true), minimum 1.

Test suite adds 27 tests including 100 reproducible random small problems cross-checked against a **separately written `itertools.product` enumerator** in tests, one-to-one collisions, required/allowed unmatched, stale reference, tampering, bounded refusal, typed-result immutability, CLI and exact flagship assignment. All 53 T02 and 53 T03 tests must continue to pass.

## Example CLI invocation

```powershell
.\.venv\Scripts\python.exe -m joinwitness.oracle --registrations fixtures/flagship_flip/registrations.csv --attendance fixtures/flagship_flip/attendance.csv --policy fixtures/flagship_flip/review_policy.json --reference fixtures/flagship_flip/reference.json
```

Expected principal output: `ORACLE_REVERSIBLE`, `COMPLETE_ENUMERATION`, `minimum_changed_assignments: 1`, `baseline_counts: {a:2,b:1}`, `alternative_counts: {a:1,b:2}`, `independent_checker_status: NOT_RUN_T06`, `solver_status: NOT_RUN_T05`.

## Completion gate

Sandbox tests are supporting evidence only. Owner must run full Windows `pytest -q`, flagship and two_changes CLI, inspect full file list, stage only the allowlist, use `git diff --cached --check`, and return exact outputs before integration/commit. Do **not** push, deploy or change any earlier file without approval.
