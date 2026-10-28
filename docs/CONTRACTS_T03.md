# JoinWitness T03 — Human-reviewed candidate universe and frozen baseline

**Versions:** `jw.review.v1` and `jw.reference.v1`; input authority remains `jw.dataset.v1` (T02). No solver, AI, UI, or receipt claims.

## Review authorization
- Every edge must name existing attendance and registration IDs and be marked `CONFIRMED`, `POSSIBLE`, or `PROHIBITED` with explicit `EXPLICIT_REVIEW` operation. Omissions do **not** certify impossibility in the real world.
- Every attendance ID requires exactly one `ALLOWED`, `REQUIRED`, or `FORBIDDEN` unmatched rule; no inferred default.
- `CONFIRMED` forces exactly one edge for its attendance; other `POSSIBLE` edges and optional unmatched are rejected for that row. An explicitly `PROHIBITED` edge creates no admissible choice. `REQUIRED` unmatched requires that row to have no admitted `POSSIBLE` edge.
- One-to-one existence is checked via deterministic bipartite feasibility independent of baseline draft. This is **not** an independent exhaustive oracle, reversal optimizer, or mathematical minimum certificate.
- Fail closed on unknown IDs, duplicate review edges/rules, multiple or colliding confirmed matches, contradictory unmatched permissions, lack of admissible choices, and impossible one-to-one mandatory matches. At most 10 reviewed candidate edges per attendance row in this bounded T03 implementation.
- Coverage labels `UNREVIEWED`, `REVIEWED_PARTIAL`, and `REVIEWED_CLOSED_SCOPE` do not prove real-world candidate completeness. `REVIEWED_CLOSED_SCOPE` requires an explicit attestation and detailed scope note; it attests only the *synthetic or reviewed analysis scope*.

## Snapshot and canonicalization
- `freeze_review(bundle,draft)` verifies the parsed-record fingerprints against in-memory records and produces an immutable `ReviewSnapshot` retaining both original T02 source hashes (raw and parsed), explicit reviewed decisions, revision and analysis scope. Exact raw-byte freshness requires re-ingesting original files; without raw bytes, no in-memory API can reconstruct their raw hash.
- Review-edge tuples are sorted by `(attendance_id,registration_id)`; unmatched decisions by `attendance_id` when freezing. Source input row order **is never altered**. `canonical_json_bytes` is reused unchanged; snapshot SHA-256 excludes only its own hash field.
- `validate_snapshot(bundle,snapshot,expected_revision=..., expected_sha256=...)` refuses stale input bytes, changed policy digest or revision, and invalid hash. SHA-256 is integrity-only and is not a signature.
- `allowed_choices(bundle,snapshot)` validates the snapshot and the parsed bundle on every call, so an unchecked or stale snapshot cannot directly produce authorized choices.

## Complete frozen reference
- A `ReferenceDraft` contains exactly one attendance-ID-based assignment per input attendance, which may be null only when explicitly permitted.
- `freeze_reference(bundle,snapshot,draft)` refuses an incomplete assignment, unmatched violation, prohibited/unreviewed edge, forced-edge change or registration collision. It computes A, B and unmatched counts; a tie makes `A>B` false.
- `ReferenceMatching` includes the snapshot SHA-256 and its own canonical SHA-256. `validate_reference` rejects altered assignments, stale snapshot/reference digest or a changed source/policy. It does not find a reversal or a minimum.
- The fixture CLI reports `NOT_RUN_T03_ONLY`, never `REVERSIBLE_*` or `STABLE_*`.

## Deferred interfaces
- T04 independently enumerates exact small-instance solutions without calling the T03 bipartite feasibility algorithm.
- T05 uses CP-SAT to search for decision reversal and optimization; no result may rely on T03 baseline counts alone.
- T06 independently checks witness and receipt replay; it must not simply reuse optimizer internals.
- Privacy: synthetic fixture names only; strict local validation does not transmit any bytes to AI.
