# JoinWitness T02 immutable source contract (jw.dataset.v1)

## Authority boundary
`Registration` and `Attendance` are **source facts only**. Neither candidate matches,
review permissions, baseline reference, solver results nor identity truth are created here.
The frontend must not claim the baseline/reversal was calculated by this module.

## Fixed CSV default schemas
- Registration columns `registration_id,name,group` → `Registration(registration_id,display_name,group)`.
- Attendance columns `attendance_id,recorded_name` → `Attendance(attendance_id,recorded_name)`.
- Only those fields permitted. Headers may appear in any order, must be unique, exact, no extras.
- UTF-8 strictly decoded, optional leading UTF-8 BOM permitted. Blank data lines are rejected.
- IDs: 1–128 code points, nonblank, no leading/trailing whitespace, no control characters;
  case-sensitive uniqueness **within each file**. Duplicate names are intentionally accepted.
- Names: 1–200 code points, cannot be entirely whitespace or contain control characters;
  original name text is preserved. Groups are exactly uppercase `A` or `B`, never inferred.
- No new identity fields, alias normalization, automatic matches or extra CSV columns in T02.

## Size
A maximum of 3,000,000 raw bytes for each CSV, 150 registration rows,
100 attendance rows. Empty datasets are rejected. A strict field failure reports typed
`IngestCode` and source/line without echoing potentially personal CSV contents.

## Source and canonical record fingerprints
1. `raw_sha256`: lowercase SHA-256 hex over the **actual input bytes**, including BOM,
   line endings, original field ordering and source rows.
2. `parsed_sha256`: lowercase SHA-256 over `jw.dataset.v1` envelope:
   `{"schema_version":"jw.dataset.v1","source_kind":kind,"records":[record JSON...]}`.
   JSON is sorted by object key, compact separators, `ensure_ascii=True`, `allow_nan=False`,
   UTF-8 encoded. Record objects contain only the typed model fields. **Record array order
   is the original CSV row order.** No silent sorting of row IDs, no trim or case folding.
3. CSV header field order, CRLF vs LF, or BOM may change the **raw** hash without changing
   the **parsed** hash. A row reorder changes the parsed hash, even if IDs still match.
4. Any future canonicalization rule change requires a new schema version and tests.
5. SHA-256 digests are integrity fingerprints; they are not signatures or claims of identity truth.

## Validated default mapping and future extension
The CSV's `name` is explicitly mapped to `display_name`; this is the only renamed source
column in v1. Interactive arbitrary column mapping remains outside T02 and needs a
separate versioned review, never an undocumented parser heuristic.

## Deferred to future tickets
T03: reviewer policy, unmatched rules, complete baseline, policy digests, snapshot revision.
T04–T06: independent enumeration, CP-SAT, checker and replay receipts.
T07: candidate shortlist and real Meta model adapter with strict suggestion-only authority.
Stable, two-change and timeout fixture *analysis expectations* are not fabricated in T02.
