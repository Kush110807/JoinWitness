# JW-T09-INT-01-FIX01 — Verdict-copy and provenance correction

**Authority:** JW-RD-3.0 FINAL > frozen T02–T08 math/API contracts > integrated T09 spec > INT-01. **Scope:** isolated `C:\JW-Muse-T09` only. **No commit, push, deploy or Meta call.** Owner's previously verified external backup is a prerequisite; recheck before writing.

## Purpose

The independent INT-01 source review found two false-certainty cases and one review-label/provenance defect. Correct these without starting INT-02 or modifying the proof engine.

## File allowlist

- `frontend/src/App.tsx` and `frontend/src/App.test.tsx`
- `frontend/src/lib/decisionView.ts` and `frontend/src/lib/decisionView.test.ts`
- `frontend/src/components/ProductShell.tsx`, `RecordQueue.tsx`, `DecisionCanvas.tsx`
- Optionally `frontend/src/App.css` **only** if the final labels require a modest spacing correction.
- New `docs/CONTRACTS_T09_INT01_FIX01.md` containing exact status mapping and test evidence.

**Forbidden:** `frontend/src/lib/api.ts`, demo fixtures, Vite/package/dependency files, `backend/**`, `src/joinwitness/**`, existing tests/fixtures under Python backend, credential files, Git configs, main original repository; also no broad visual redesign, no new packages or browser Meta path.

## Required changes

1. Make the top contextual verdict headline **count-aware**. The number of changes is rendered only for `REVERSIBLE_MINIMUM_PROVEN` with a valid server-reported `minimum_changed_assignments`. For a 2-change minimum the banner must say **two**, not one; for null or inconsistent minimum be conservative and suppress the numerical proof claim. Never calculate minimum from changed-row count.
2. Make all null-alternative UI **verdict-aware**. `STABLE_WITHIN_REVIEWED_POLICY` may say no reversal exists **within the reviewed set**; `NOT_VERIFIED` must say `Inconclusive — no reversal or stability established`. Apply consistently to `ProductShell`, `formatCanvasCounts`, `DecisionCanvas` descriptions/aria labels and any shared banners. `NOT_VERIFIED` is never synonymous with stability. Retain distinct witness-only and failed-verification text.
3. In Review, do not label candidates sourced from `policy.edges` as model-generated `suggestions`. Show specific edge status (`CONFIRMED` or `POSSIBLE`) and a truthful origin (`prepared fictional policy`) separately. A deterministic shortlist returned by `/api/suggest` can be shown separately as unreviewed suggestions. Do not invent per-link origin metadata if backend does not supply it. Keep inspection strictly view-only and prepared-policy adoption the sole authority action.
4. Keep the 4-stage API workflow, stale epoch guards, proof-basis distinctions, digest mismatch fail-close behavior, mobile breakpoints, first-Tab skip link and zero `/api/meta` calls unchanged.

## Required regression tests

- **Two-change:** mocked `REVERSIBLE_MINIMUM_PROVEN` with `minimum_changed_assignments: 2` must show two changed assignments in the banner, not one.
- **One-change:** canonical flagship still shows the minimum of 1.
- **Stable:** only the stable verdict can say there is no permitted reversal, always qualified to reviewed model.
- **Not verified:** `NOT_VERIFIED` with `alternative_counts: null` contains *no* `no permitted alternative reverses` / `no reversing alternative` anywhere in visible context, canvas, or ARIA.
- **Review labels:** Confirmed and possible prepared-policy links have distinct accurate labels; selecting them creates no permission and triggers no network calls.
- **Adverse:** no change to receipt mismatch fail-close, no claims on failed replay, no browser Meta request.

## Execute & report

Run `npm.cmd run build` and `npm.cmd test` from `frontend/`. Return full command results, exact changed-file inventory, tests added, observed errors/warnings and remaining unrun gates. If a trusted API shape makes a task impossible without changing a forbidden file, STOP and report the conflict. **Do not mark browser acceptance PASS from JSDOM tests.**
