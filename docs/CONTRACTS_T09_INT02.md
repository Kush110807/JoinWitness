# CONTRACTS_T09_INT02 — Real CSV Import and Human Review

Authority: JW-RD-3.0 FINAL > frozen T02–T08 contracts > integrated T09 spec >
INT-01-FIX01. Status: PROPOSED candidate, uncommitted. No backend, engine,
fixture, cap, dependency, or config change. No Meta call, commit, push, deploy.

## Changed and new files (allowlist)

- `frontend/src/App.tsx` — upload handlers, human draft state, effective
  policy/reference switch, custom queue/editor composition.
- `frontend/src/App.css` — upload grid + review-editor styles, tokens reused.
- `frontend/src/App.test.tsx` — prior suites kept current + 9 INT-02 tests.
- `frontend/src/lib/reviewDraft.ts` (new) — pure draft model: empty draft,
  shortlist seeding, single-confirmed enforcement, greedy baseline mirroring
  backend choice order, frozen wire serialization (`EXPLICIT_REVIEW` only).
- `frontend/src/lib/reviewDraft.test.ts` (new) — 6 unit tests.
- `frontend/src/components/ReviewEditor.tsx` (new) — per-edge selects,
  unmatched selects, candidate add, scope controls, baseline preview, adopt.
- `docs/CONTRACTS_T09_INT02.md` — this file.

## UI contract

- Import: bundled demo CTA plus two-file CSV upload (FileReader → base64 →
  `/api/parse`; both files required; UTF-8 enforced client-side; all content
  rules enforced by the backend with verbatim error codes).
- Review (custom): shortlist seeding is advisory-only; every edge status,
  unmatched rule, added candidate, coverage level, scope note, and closed
  attestation is a human decision; greedy baseline preview warns on conflicts
  instead of hiding them; adoption sends the frozen draft + derived reference
  to `/api/review/validate`, whose verdict alone unlocks Challenge.
- Draft edits after adoption invalidate downstream state via the proven
  `invalidateFrom("validation")` path with an explicit re-adopt notice.
- Demo path, Challenge/Verify copy, verdict mapping, mismatch fail-close,
  epoch guards, and zero-Meta-request behavior are unchanged. Ground truth
  (`ground_truth.json`) is never read by the UI; no 60/90 result is hardcoded
  — every analytical claim renders from live responses.

## Backend contract (unchanged, verified by reading)

- `operation` accepts only `EXPLICIT_REVIEW` (`policy.py:39,46`); human
  authority is the explicit adoption act, recorded in the receipt chain.
- Baseline mirrors `allowed_choices` (`policy.py:211`); no schema change was
  needed, so none was made.

## Limitations

- JSDOM proves structure, fetch discipline, and error surfacing — not real
  file-picker behavior, 100-row editing ergonomics, viewport rendering, or
  outsider comprehension. Owner must run the live FastAPI+Vite pass (demo +
  custom CSVs incl. a 60/90 set), `pytest -q`, and the browser matrix.
- Greedy baseline is a proposal aid; one-to-one conflicts surface as backend
  `BASELINE_INVALID`, never silent repair.
