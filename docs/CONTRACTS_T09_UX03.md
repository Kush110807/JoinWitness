# CONTRACTS_T09_UX03 — Decision Canvas (visual / interaction decisions + actual evidence)

Authority: JW-RD-3.0 FINAL. Status: PROPOSED candidate, uncommitted.
Scope: product-experience correction only. The verified API, human permission
model, mathematical proofs, and the Import → Review → Challenge → Verify
architecture are unchanged. Only these files changed:

- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`
- `docs/CONTRACTS_T09_UX03.md` (this file)

No change to `frontend/src/lib/**`, fixtures, backend, engine, API,
dependencies, or Git settings. No installs, no Meta calls, no commits.

## Product thesis (fixed, from JW-T09-UX03)

Question: a report concludes Group A attended more than Group B. Can a
human-permitted different matching of ambiguous identities reverse that
conclusion? For the fictional flagship the reviewed universe gives original
A=2/B=1 and a permitted alternative A=1/B=2 (T-02: R-A2 → R-B2, minimum
distance 1, solver-proven and oracle cross-checked). Nothing here claims
anything about real human identity or unbounded data.

## Visual / interaction decisions

1. First screen: heading “Can one uncertain match change who came out
   ahead?”, one-sentence purpose (“A report says Group A attended more. …”),
   one prominent CTA “Explore the fictional event.”, and an always-visible
   “Fictional example · not yet analyzed” marker. No computed reversal is
   claimed before `/api/analyze` returns. The landing hero is compact so the
   CTA sits above the fold at 1440×900 and 375×812.
2. Compact contextual bar: once source is loaded, the multi-paragraph landing
   is replaced by a small bar (fictional marker, current-question summary per
   stage, and — only after analysis — a compact verdict pill, plain-language
   headline, counts, and one-line scope qualifier). Stage navigation stays
   gated; exactly one `.primary` action exists per stage-state; every stage
   has an easy Back action.
3. Skip link: the “Skip to main content” link is the first tabbable element in
   DOM order; `<main id="main" tabindex="-1">` is its focusable target; the
   link becomes visibly anchored top-left on focus. The stage-heading
   auto-focus now skips first mount (the cause of the desktop
   skip-link-first failure: initial programmatic focus on the `h2` moved
   sequential focus past the skip link).
4. Review: source→candidate diagram kept, with a four-meaning legend
   (suggested / allowed-by-fictional-policy / original-baseline /
   checked-alternative). Candidate cards read “unreviewed suggestion” until
   adoption, then “permitted under this example's reviewed policy”. The
   reported link carries an “Original baseline” badge after adoption; the
   rematched link carries a “Checked alternative” badge only after a checked
   reversible verdict. “Adopt fictional review rules” is the only
   authority-affecting control; viewing/tapping never mutates permissions.
   Editable-review/CSV-unavailable is stated once per relevant surface
   (Import: CSV; Review: editable review + Meta bridge), not on every screen.
5. Challenge (Decision Canvas): ORIGINAL vs PERMITTED ALTERNATIVE panels with
   the decisive `T-02: R-A2 → R-B2` change between them; the sentence “This
   one permitted change reverses which group leads” renders only for checked
   reversible verdicts with exactly one changed row. “Fewest changed
   assignments: N — proven minimum” renders only for
   `REVERSIBLE_MINIMUM_PROVEN`. Witness-only keeps honest witness-only copy
   with no minimum claim; stable shows the baseline alone; inconclusive stays
   inconclusive with no green state. Raw enum codes live only inside the
   “Technical evidence” disclosure. The baseline/alternative inspect toggle is
   view-only and never reruns analysis.
6. Verify (proof ladder): three plain-language checks, each rendered only when
   the actual replay response supports it — rules-following (only for checked
   reversible verdicts with `WITNESS_VALID`), outcome (changes / stable /
   inconclusive-neutral), and replay success. Minimum-proof language appears
   only for `REVERSIBLE_MINIMUM_PROVEN` with solver-vs-oracle attribution
   stated separately. A short scope qualifier stays always visible; hashes,
   enum codes, roles, CLI replay, and limitations sit in “Technical evidence”.
   Verdict/digest conflicts render the explicit evidence-mismatch alert and
   withhold all proof claims.
7. Style: same restrained system as UX02 (deep-teal accent, flat surfaces, no
   gradients/glows/decorative motion, `prefers-reduced-motion` respected).
   Full-width buttons and single-column canvas/fault rows at ≤34rem/≤56rem
   keep 375px/390px usable without horizontal overflow.

## Actual evidence

- Before: `git -c safe.directory=… status --short --untracked-files=all`
  showed no tracked modifications (HEAD `e956eae`, T08 acceptance); all T09
  frontend work is untracked in the isolated workspace. Baseline
  `npm.cmd test` in `frontend/`: 30/30 passed (2 files).
- After: `npm.cmd run build` and `npm.cmd test` in `frontend/` — see the
  handoff report for completed output. Test suite: 30 pre-existing tests
  (updated only for relocated copy) + 8 new `T09-UX03 decision canvas` tests
  covering ticket items (a)–(h).
- Temp-dir note: the sandbox user cannot write the default Windows Temp, so
  vitest must run with `TMP`/`TEMP` pointed at a workspace-local directory
  (e.g. `C:\JW-Muse-T09\.tmp-test`); without this, vitest fails before
  collecting tests (EPERM mkdir). This is environment-only, not a code change.

## Limitations (known unexecuted / unproven)

- BROWSER_UNRUN: no Edge automation is available in this sandbox (no Edge
  binary on PATH, no E2E harness in the repo), so the required 12
  screenshots (1440×900, 390×844, 375×812) and `browser_report.json` were
  not collected. Owner must run the actual Edge E2E against FastAPI+Vite,
  including the first-Tab skip-link check on desktop.
- Keyboard order beyond DOM order, above-the-fold placement at the three
  widths, and the 10-second comprehension bar are NOT proven by automated
  tests: (h) asserts DOM/focusability facts in jsdom only, and comprehension
  needs a human who has not read the specification. GO/HOLD per the ticket
  requires the owner browser pass plus that human read.
