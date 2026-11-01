# JW-T09-UX02 — Decision-first guided experience (contracts and evidence)

**Authority:** JW-RD-3.0 FINAL (Sections 1, 3, 5, 6, 9, 13, 16, 20).
**Working state:** UX01 + FIX01. **One writer:** Muse Code.
**Status:** Candidate for independent review. Not accepted, not a public release.
No commit, push, deploy, paid inference, or new dependency was used.

## Allowlist compliance

Changed only:

- `frontend/src/App.tsx` — conditional guided journey, decision-first copy, data-driven visuals.
- `frontend/src/App.css` — restrained visual system, responsive layouts, reduced motion.
- `frontend/src/App.test.tsx` — updated + new regression tests (role/text accessible).
- NEW `docs/CONTRACTS_T09_UX02.md` — this file.
- `docs/tickets/JW-T09-UX02.md` — task copy (already present, unmodified).

No edits to `backend/**`, `src/joinwitness/**`, `fixtures/**`, `frontend/src/lib/*`,
`frontend/package.json`, lockfile, test config, auth, billing, or dependencies.

## UI state and authority boundaries

- Only the **active stage body** renders. Inactive stages are unmounted, never hidden forms.
- Navigation unlocks strictly from backend state: parse → Review, validated review →
  Challenge, analysis → Verify. Locked journey steps are disabled with an explanatory title.
- Back navigation only changes the visible stage. It never clears state, revalidates, or
  re-runs analysis. Clear/reload or a failed analysis invalidates dependent results exactly
  as in FIX01 (operation epoch), and the stage clamp returns navigation to a legitimate stage.
- Fault-line edges are non-interactive `<div>` elements. Clicking a visual link can never
  authorize it. Only the explicit adoption button POSTs the review to `/api/review/validate`.
- The prepared policy/reference remain labeled a **fictional sample**, never independent
  human verification of real people. Names and groups are primary; immutable IDs secondary.
  Names are looked up from the bundled fictional CSVs by supplied IDs; true identity is
  never inferred.
- All counts, verdicts, changed assignments, proof basis, checker/oracle statuses, coverage,
  receipts, and replay results render **only from live API responses**. Numeric results and
  the T-02 changed assignment are computed, not hardcoded (`changedWitnessRows` over
  reference pairs vs wire witness tuples).
- Optimality is never claimed from `WITNESS_VALID` alone. The minimum-verified pill and
  minimum copy appear only for `REVERSIBLE_MINIMUM_PROVEN`; witness-only, stable, and
  unverified branches keep narrower copy and never show the green minimum pill.
- Verify leads with "We independently checked this alternative" **only after** the backend
  returns `VERIFIED_REPLAY`. Receipt download and replay POST to the real `/api/receipt`
  and `/api/verify` routes; no browser-simulated confirmation exists.
- The Challenge view toggle (baseline / alternative) only re-highlights the already-checked
  result. It is labeled a view, never a new solver run or user approval.

## Tested results

- `npm.cmd run build` — must PASS (`tsc --noEmit` + `vite build`).
- `npm.cmd test` — component suite covers: landing consequence + single CTA + no premature
  proof; stage gating and Back preservation; unreviewed vs permitted edge wording;
  flagship `T-02: R-A2 → R-B2` by IDs plus name/group explanation
  (Kim Rao of Group A → Kym Rao of Group B); witness-only/stable/unverified never showing
  minimum-verified copy; stale-async discard; failed-analysis invalidation; real-API receipt
  issue/replay with the independent-check copy gated on `VERIFIED_REPLAY`.
- Python `pytest` — owner-side; not runnable from this sandbox (no interpreter in PATH).
- Browser journey — owner-side or sandbox-if-available; see evidence section below.

## Known limitations

- Fictional flagship fixtures only; CSV upload still arrives in a later T09 ticket.
- No Meta/AI browser control; the pending secure bridge note is unchanged.
- Coverage qualification is one concise line in the verdict hero plus the full caveat under
  "Read the verification scope and limitations" — conditional on the reviewed universe only.
- The fault line derives ambiguous links from the reviewed policy's non-prohibited edges
  (flagship: T-02 → R-A2, R-B2) and annotates shortlist membership only after the shortlist
  is fetched; the visual never blocks adoption.

## Comparison with UX01

| Aspect | UX01 + FIX01 | UX02 |
|---|---|---|
| First screen | Abstract slogan hero, full billboard on every step | Illustrative scenario + what-will-check + honest example label; hero swaps to the real verdict after analysis |
| Stages | All four panels stacked, stepper highlights only | One active stage body, compact progress header with Back, gated navigation |
| Causal link | T-02 change buried in paragraphs/IDs | Data-derived fault-line visual: T-02 → R-A2 / R-B2, names/groups primary, permission-labeled edges |
| Challenge result | Long technical report | Two outcome cards + one causal change + view-only toggle |
| Verify | Technical receipt dump first | Independent-check claim only after `VERIFIED_REPLAY`, then two-sentence proof, technical evidence retained under disclosure |
| Styling | Decorative gradient hero illustration | Flat restrained system, one accent, responsive 1440/390/375, reduced motion |
