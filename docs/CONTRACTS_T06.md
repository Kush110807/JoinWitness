# JW-T06 — Independent witness checker & replay receipt (`jw.checker.v1`, `jw.receipt.v1`)

**Authority:** JW-RD-3.0 FINAL. Pinned base `ec082d8e64e8c8a80db0a0eca88e450d863d9146`.

## Independence and exact limitations

- `checker.py` **does not import** CP-SAT, `solver.py`, `oracle.py`, T03's `allowed_choices`, or T03's count helper. It accepts the frozen typed T02/T03 inputs and treats the alleged `jw.solver.v1` result as **untrusted data**. It reinterprets recorded review edges, confirms and unmatched rules; checks full ID coverage, one-to-one uniqueness, permission, A/B/unmatched counts, fixed `A>B` reversal, and Hamming distance. It also validates the frozen T03 snapshot/reference as an input authority gate. These shared input-authority checks are necessary; they are not a shared search or witness-validation algorithm.
- `WITNESS_VALID` establishes that a supplied alternative is *a legal reversal with independently recomputed distance*, not its global optimality. CP-SAT `OPTIMAL` attributes minimum distance to a completed optimizer run. On at-most-12-row, at-most-250,000-Cartesian-choice small cases, the independent T04 complete enumeration additionally verifies minimum/nonexistence. No general-purpose formal proof of optimizer internal correctness is implied.
- A solver `INFEASIBLE` status has **no witness to check**; the checker labels it `SCOPED_INFEASIBILITY_SOLVER_ATTRIBUTED` and never pretends to independently prove nonexistence. The independent oracle checks small negative cases. Large negative cases remain solver-attributed even after replay.
- `UNKNOWN`, `MODEL_INVALID`, unverified dependency, or an inconsistent/failing witness stay `NOT_VERIFIED`, never stable.
- The result taxonomy is `REVERSIBLE_MINIMUM_PROVEN`, `REVERSIBLE_WITNESS_ONLY`, `STABLE_WITHIN_REVIEWED_POLICY`, `NOT_VERIFIED`, with separate `proof_basis` (`SOLVER_AND_SMALL_ORACLE`, `SOLVER_ATTRIBUTED_ONLY`, `CHECKED_WITNESS_ONLY`, `INCOMPLETE`). The words **minimum proven** mean mathematical optimization completion under the modeled universe, with explicit proof-source attribution; for large cases this is not separately independently enumerated.

## Receipt fields and source/authority binding

Receipt `jw.receipt.v1` is strict, immutable structured JSON with source-bound full `ReviewSnapshot` (raw and parsed SHA-256 digests, revision, reviewed edges, unmatched choices), full `ReferenceMatching`, original unchecked `SolverResult`, independent `WitnessCheck`, bounded `OracleResult`, explicit verdict, proof basis, UTC timestamp, scope caveat and a canonical SHA-256 over every field except the checksum itself. The existing T02 canonicalization is reused; the stored file is consistent UTF-8 canonical JSON with `\n` terminator.

**Integrity caveat:** SHA-256 alone cannot authenticate the original author or defeat an attacker able to rewrite the receipt **and** its digest. No adversary-proof, signed or tamper-proof claim is authorized. The verifier checks **original files and reviewed policy** supplied separately; a rewritten receipt cannot silently replace the local files at replay. For complete CP-SAT claims, replay also reruns CP-SAT with the stored seed/time limit and compares solver status and optimum distance, not necessarily identical tie-choice witnesses. The verifier re-enumerates the small oracle when within scope. Cross-machine solver completion can vary with performance; a nonmatching or unfinished re-run fails closed and must be investigated rather than being called reproducible proof.

## CLI and exit behavior

Create, using fictional reviewed sample inputs only:

```powershell
.\.venv\Scripts\python.exe -m joinwitness.receipts --registrations fixtures/flagship_flip/registrations.csv --attendance fixtures/flagship_flip/attendance.csv --policy fixtures/flagship_flip/review_policy.json --reference fixtures/flagship_flip/reference.json --output results/demo_receipt.json
```

Replay from the **same original bytes** and reviewed policy:

```powershell
.\.venv\Scripts\python.exe -m joinwitness.verify --receipt results/demo_receipt.json --registrations fixtures/flagship_flip/registrations.csv --attendance fixtures/flagship_flip/attendance.csv --policy fixtures/flagship_flip/review_policy.json
```

- Receipt creation requires a completed, consistent solver result; refuses `NOT_VERIFIED` and checker/oracle disagreement. Output creation is exclusive; it never overwrites an existing file. Non-success exits 2.
- Replay requires exact checksum and typed schema, actual source byte matching, reviewed-policy reconstruction, valid reference, independent checker recomputation, fresh independent oracle, and **fresh CP-SAT completion for OPTIMAL/INFEASIBLE**. If any mismatch occurs it exits 2, without falsely certifying proof.
- These commands do not access Meta, Baseten, Modal, internet, credentials, or private uploads.
- The `results/` path is generated evidence and is not part of the seven-file T06 source candidate. Review content before sharing publicly.

## JW-T06 acceptance gates

1. T02–T05 regression suite still passes; no skipped tests on the owner's Python 3.13 Windows environment with OR-Tools available.
2. New checker/receipt tests reject changes to permissions, group/counts, incomplete witnesses, registration collisions, wrong Hamming distances, misleading solver flags, checksum/source/policy/oracle forgery, and false stability.
3. Flagship, two-change and stable receipts all **create and replay successfully** on Windows from original fixture bytes.
4. Flip receipt statuses say `WITNESS_VALID`; stable receipt says `SCOPED_INFEASIBILITY_SOLVER_ATTRIBUTED`, accompanied by `ORACLE_STABLE` where independently enumerated.
5. Fail-closed tampered receipt and tampered CSV CLI cases are actually executed. Raw outputs and `git diff --check` are supplied.
6. No commit, push, live Meta call, deployment, or change to accepted older files until the coordinator accepts the actual evidence.

## Deferred

Signed artifacts/cryptographic provenance, cross-repo independent executor, formal proof of CP-SAT library internals, production API/UI, real Meta suggestions, rate limiting, secure public upload handling and cloud deployment are not claimed by T06.
