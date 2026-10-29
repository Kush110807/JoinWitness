# JW-T07B — Deterministic candidate shortlist (jw.shortlist.v1)

**Authority:** JW-RD-3.0 FINAL §§4, 6, 8–11, 14, 16. **Pinned base:** `5f7446a31d7fc205be3c1fb0a49f05a7cc12b0a3`.
**Status:** Implementation candidate; requires owner-run Windows verification before acceptance.

## Trust boundaries

- Deterministic **lexical** shortlist from existing source IDs and names only; no enrollment group modification, automatic edge permissions, baseline edit, solver run, AI identity assertion, or model call.
- Comparison uses NFKC Unicode normalization, casefolding and lexical punctuation normalization. Explicit `Kim/Kym` slash aliases are only split into supplied alternatives. Text closeness is a rank heuristic **not a probability or calibrated confidence score**.
- `jw.shortlist.v1` records the source raw and ordered-parsed SHA-256 from T02, an independently reproducible canonical shortlist SHA-256, rank and signal, candidate cap configuration, rows with no candidates and every row truncated by per-row/global cap.
- Input source digests are verified against the parsed typed records. The digest field for original bytes is carried from the trusted T02 ingest; this function cannot independently rehash original bytes without receiving them.
- Candidate order is deterministic by attendance ID, signal tier, similarity and registration ID. Rankings do not imply permissions. Result is always `UNREVIEWED_SHORTLIST` and `PARTIAL_UNREVIEWED`, even when no cap triggers. A missed match is not disproven, and manual candidate addition remains a future T08/T09 UI requirement.
- Bounds: 1–10 candidates per attendance row; local global maximum 1000. For the *future, separately authorized* Meta request, use up to 4 per row and 24 in total; omissions and capped rows are included in the model payload. Zero candidates means no model call.

## T07A adapter interoperability

- `make_messages()` now sends the exact shortlisted pairs, field-based names, rank, signal and explicit partial/truncated declarations, not the entire cross product of identities. No A/B group field, reviewer action, solver result or proof is transmitted.
- The `request_live_meta()` gate remains explicit: human approval + synthetic attestation + environment switch. No CLI live path is added. No paid requests are made by T07B.
- If a model returns a known-ID pair outside the actual supplied shortlist, reject `PAIR_OUTSIDE_SUPPLIED_SHORTLIST`. This is not a claim that the missing edge cannot exist; the human reviewer may add permitted candidates separately in later UI.
- The T07A public `jw.suggestions.v1` result schema is unchanged. A T07 live gate still needs request-id/usage/latency/provenance capture, privacy/credit authorization, schema errors and an independently observed authentic network call.

## Acceptance / exact evidence

- New `python -m joinwitness.candidates` CLI returns four flagship pairs (T-01→R-A1; T-02→R-A2 and R-B2; T-03→R-B1), no truncation, valid raw+parsed digests, unreviewed coverage.
- All original 225 Windows tests continue to pass; 16 new T07B tests, **target 241 passed, 0 skipped**. This is an expected target, not a claimed owner result.
- Two negative runs using `--per-row-limit 1` (explicit `truncated_attendance_ids`) and fabricated `R-FAKE` response rejection in tests.
- `git diff --check`, inventory of only five allowed files, and no unstaged unrelated changes. No commit, push, deployment or live API call before coordinator accepts actual evidence.

## Known limitations

No semantic entity resolution guarantee, no measured alias recall, no complete coverage certification, no Meta production call, no validated billing controls, no UI/manual review flow, no full evaluation. All these remain under existing JW-RD-3.0 tickets, not optional enhancements.
