# JW-T09-UX02 — Decision-first guided experience, evidence-anchored

**Authority:** JW-RD-3.0 FINAL (Sections 1, 3, 5, 6, 9, 13, 16, 20).  
**Input evidence:** owner browser ZIP `JW_T09A_BROWSER_EVIDENCE.zip`; companion audit `JW_T09A_BROWSER_EVIDENCE_AUDIT_2026-10-30.md`.  
**Status:** Authorized for isolated local implementation/testing ONLY. Not accepted, not a public release, not permission to push, merge, deploy, use paid inference or alter the approved product scope.  
**Working directory:** `C:\JW-Muse-T09`, source at current UX01 + FIX01 state. Do not switch to the older main branch for implementation. **One writer: Muse Code.**

## Why this ticket is necessary

The three actual browser flows PASS but the interface makes the real product look like a manual name-difference check. The math is not the failure. The interface buries the decision stake, hides the causal ambiguous matching link in paragraphs/IDs, repeats a huge landing hero throughout the flow and presents a very long technical report. Source file `frontend/src/App.tsx` currently renders a `hero`, `journey`, `insight-banner`, and all four `section` stages on a single page; `currentStep` derives from backend responses but only highlights the stepper.

**Product promise that MUST become obvious in 10–20 seconds:** "Your analysis says one thing. Could any *permitted* different match change that decision? JoinWitness checks all modeled valid alternatives and, where proven, shows the fewest changed assignments and independently replayable evidence." It does NOT identify a real person.

## Authorized file edits (exhaustive)

- `frontend/src/App.tsx` — conditional guided journey, accessible decision-first presentation, data-driven visual relationship, plain-English copy.
- `frontend/src/App.css` — restrained distinctive visual system, mobile/tablet/desktop layouts, no horizontal scroll or overwhelming hero repetition, reduced motion.
- `frontend/src/App.test.tsx` — new/updated regression tests for stage gating, causal reveal, proof taxonomy, stale-state handling and layout semantics accessible by role/text.
- NEW `docs/CONTRACTS_T09_UX02.md` — exact UI state/authority boundaries, tested results, limitations, comparison with UX01.
- NEW `docs/tickets/JW-T09-UX02.md` — copy of this bounded task and implementation notes if desired.

**Forbidden:** `backend/**`, `src/joinwitness/**`, existing `fixtures/**`, `frontend/src/lib/api.ts`, `frontend/src/lib/demo.ts`, `frontend/src/lib/encoding.ts`, `frontend/package.json`, lockfile, test framework configuration, `.git` metadata, authentication, billing config, runtime dependencies. Do not create a new UI framework or change the fixed predicate. If an API contract makes a requested display impossible, report the exact missing field; do not fabricate values.

## Deliverable A — Decision lens, before any technical terms

1. Replace first-screen abstract slogans with a one-sentence consequential, clearly *illustrative* event-management scenario: "An event report says Group A attended more. One unresolved registration link might reverse that result." The business decision is illustrative, not a dataset fact.
2. Show **what the system will check** and a single primary action "Try the fictional event". Include a compact honest label: example / not analyzed / offline deterministic. Until `/api/analyze` returns, do not show certified comparison numbers or a verified badge as fact; any preview must be visually and textually identified as illustration.
3. After analysis, swap the abstract hero for the *real* returned verdict and baseline/alternative comparison. Do not leave the full landing billboard above every step. The user must understand whether the existing result is fragile, stable only within scope, a witness without certified minimum, or not verified.

## Deliverable B — A genuinely guided four-stage interaction

4. Keep original order Import → Review → Challenge → Verify, but show **only the active stage body** at a time. Use a compact persistent progress header with meaningful stage labels and a visible Back action; avoid anchor-link-only navigation into four stacked technical panels.
5. Do not allow the user to jump to dependent stages without required backend state (source parse, reviewed snapshot, analysis). Back navigation must not mutate authority or undo valid state. Clearing/reloading or failing an analysis must invalidate dependent stage results as before, and must bring navigation back to a legitimate stage.
6. Make the next action unmistakable, with functional focus management on stage changes, accessible disabled states, and inline error recovery. No blank/dead buttons or fake "AI review" controls.

## Deliverable C — The 'fault line' (signature differentiated interaction)

7. In Review, render a **data-derived** identity-link visual from existing fictional record fields and the existing deterministic shortlist and preauthored policy. Present recorded attendance `T-02` (`Kim/Kym Rao`) connected to two registration candidates: `R-A2` (`Kim Rao`, Group A) and `R-B2` (`Kym Rao`, Group B). Confirmed T-01 and T-03 can be compact context rows. Keep names and groups primary; immutable IDs secondary.
8. Before explicit adoption, label the edges **unreviewed suggestions**; after adoption, label them **permitted under this example's reviewed policy**. NEVER make a click on a visual edge silently authorize it. The prepared policy remains a clearly identified *fictional sample*, not independent human verification of real people.
9. In Challenge, show a single result screen with two side-by-side outcome cards (stack mobile), reveal/change-focus on the **one changed attendance assignment** only if present in the checked result: original T-02→Kim Rao (Group A) → checked alternative T-02→Kym Rao (Group B). Link the causal change visually to the returned A/B counts. The interaction may toggle between the **already checked** baseline and witness for inspection; label it a *view*, not a new solver run or user approval. On mobile, both outcomes and the cause should be understandable without a multi-screen technical scroll.
10. Do not hardcode the numeric results or T-02's changed assignment as the source of proof. Render from response `analysis` and supported input rows. The synthetic labels/names may be looked up by supplied IDs; never infer true identities.
11. Make the hero verdict precise for `REVERSIBLE_MINIMUM_PROVEN`, `REVERSIBLE_WITNESS_ONLY`, `STABLE_WITHIN_REVIEWED_POLICY`, `NOT_VERIFIED`, and errors; never advertise optimality from `WITNESS_VALID` alone. Keep conditional universe/coverage qualification visible in concise human language, not buried in an expander.

## Deliverable D — Proof without a developer console

12. In Verify, lead with "We independently checked this alternative" *only when checker/receipt replay actually succeeded*. Then explain in two clear sentences: (a) the allowed alternative satisfies one-to-one matching and flips the fixed decision; (b) minimum distance was proven by completed solver and independently cross-checked by small oracle *when that proof basis is actually present*. If not proven, use narrower copy.
13. Keep full provenance, policy, hashes, JSON and terminal replay command available under "Technical evidence" or "For auditors". Do not delete them, invent cryptographic signature security or claim true-world identity completeness.
14. Preserve visible direct actions "Download verification receipt" and "Verify replay". Verification receipts remain based on the actual API; no simulated confirmation.

## Design quality constraints

- Distinctive information design: show the **causal path from one uncertain identity to a changed decision**. Do not substitute decorative gradients, glowing orbs, stock imagery, fake precision gauges or unnecessary animation. Use a controlled typography scale, disciplined spacing, one principal accent and restrained evidence colour.
- Desktop (1440×900): clear decision headline, active stage, strong causal visual without a long report scroll. Mobile 375×812 and 390×844: readable type, comfortable tap targets, no horizontal scrolling, no permanently repeated 3-screen hero. Keep accessibility/keyboard focus, semantic headings, status announcements and `prefers-reduced-motion`.
- Small animation is allowed only if derived from real checked state, with reduced-motion alternative. Never preanimate a fabricated certified reversal.
- Do not market as Apple software, use Apple assets or imply any endorsement.

## Acceptance tests — required evidence, no test-count theater

A. Run `npm.cmd run build` and `npm.cmd test` from `frontend/`; both PASS, and prior 18 tests remain meaningful (update tests that assumed all four cards rendered at once). Add tests for:
  - landing clearly communicates the consequence within a short headline, CTA loads the demo;
  - stage progression/back navigation and gating; hidden inactive panels are not present as active forms;
  - unreviewed vs adopted candidate permission words remain distinct;
  - `REVERSIBLE_MINIMUM_PROVEN`: A2/B1 → A1/B2 and one changed row explained by **name and group**;
  - witness-only, stable and unverified do not accidentally get green minimum-proven copy;
  - stale async response after clear cannot resurrect a verdict;
  - issuing and replaying a receipt uses actual API, never fabricated browser proof.
B. Run the existing `py -3.13 -m pytest -q` in a **normal owner's Windows Python venv** only if accessible; Muse sandbox limitations must be reported, not silently classified PASS.
C. Run a real browser journey against Vite and FastAPI at 1440×900, 390×844, 375×812, capture initial-stage and checked-result screenshots; test tab order, keyboard button activation and one viewport-level mobile workflow. If Muse cannot use a browser, state BROWSER UNRUN and leave release on HOLD. Existing owner script `JW_T09A_BROWSER_AUTOMATED_E2E.py` may need updating if selectors/step navigation change; do not falsely report a pass using outdated selectors.
D. Check repository diff is limited to the exact allowlist; no backend or core changes, no external Meta call, no new dependencies, no app billing, no commit/push/deploy.
E. Return changed file list, real test output summary, before/after desktop/mobile screenshots (where executed), exact known limitations and whether the result truly reduces the repeated full-page layout.

## Stop conditions

- If required source data for a visual element is missing, STOP and report the exact absent field. Do not invent identity facts, counts, reviewers or validation.
- If the fix requires editing forbidden backend/API files, STOP and request a separately scoped ticket.
- If local shell, npm or browser access fails repeatedly, STOP with the error; no sandbox bypass.
- No automatic Git commit, branch merge, push, external publish, paid Meta request or cloud deployment.

## Handoff to R&D head

**Return**: Files changed; output of `npm.cmd run build`, `npm.cmd test`, browser screenshots and tests if available; a plain 5-sentence first-time-user walkthrough; limitations. T09-UX02 remains a candidate until independent review of code and actual screenshot evidence.
