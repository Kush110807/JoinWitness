# JW-T09-INT-01 — Integrated Product Shell and Decision Canvas

**Issued:** 31 October 2026 (IST)  
**Status:** PROPOSED FOR EXECUTION after backup prerequisite; **not** a release, deploy, or repository integration.  
**Priority of authority:** `JW-RD-3.0 FINAL` > frozen T02–T08 contracts/evidence > `docs/specs/JW_T09_INTEGRATED_PRODUCT_EXPERIENCE_SPEC_V1.md` > this ticket.  
**Writer:** One Muse Code session. **Worktree:** `C:\JW-Muse-T09` only. **Original repo:** `$HOME\Projects\JoinWitness` is read-only.  
**Accepted Git base (not a UX03 commit):** `e956eae91b8779b36520295cecfa34dbae6708b6`.  
**Current source:** UX03 is untracked and must be treated as real work. INT-00 reported 28 untracked paths and no tracked changes; those are reported observations, not permission to delete or overwrite files without inspecting them.

## 0. Preconditions — STOP if not met

1. Owner runs `JW_T09_INT01_BACKUP.ps1` outside the Muse sandbox. It must return `BACKUP_VERIFIED: PASS` with a destination **outside** `C:\JW-Muse-T09`, a full source-file manifest and matching hashes. Do not proceed on a failed or partial backup.
2. Read the original `docs/specs/JoinWitness_JW_RD_3_0_FINAL_REFERENCE.md`, integrated spec, INT-00 source inventory, existing UX03 contracts, `frontend/src/App.tsx`, `App.css`, `App.test.tsx`, `frontend/src/lib/api.ts`, `frontend/src/lib/demo.ts`, and existing FastAPI route/response contracts. Verify exact current files before editing.
3. Compare actual critical files against INT-00 hash prefixes (App.tsx `1b95448e…72d12a`; App.css `aecda108…74f90`; App.test.tsx `0bc472d8…18ed33`). If they differ, STOP and report, do not overwrite new work.
4. Do **not** use `git reset --hard`, `git clean`, re-clone over existing source, change global `safe.directory`, create an independent competing UI, or apply the old UX03 CSS scripts. No running development servers are required for the initial Muse-side code edit; the owner will perform live browser integration.

## 1. Product objective (build this, not another text-heavy dashboard)

A first-time visitor should understand in 10–20 seconds: **two imperfect lists contain uncertain identity links; those allowed alternatives may reverse an A/B decision; JoinWitness checks the smallest reversal and explains what was independently verified.** The application should be elegant and genuinely interactive, not a guided wall of text.

**Core visual gesture:** A Decision Canvas makes *attendance record → permitted candidate relationship → current versus alternate group counts → verification strength* visually connected. A user selecting a record or comparing a link **inspects** only. No interaction silently grants permission, changes a group label, manufactures a match or simulates solver proof.

Deliver a responsive, single-origin React/Vite/TypeScript UI consuming the current FastAPI `/api` surface. Keep the four actual stages: Import, Review, Challenge, Verify. The new shell must not replace their backend operations with mocked or prefilled browser-only decisions.

## 2. Exact authorized source changes

**Existing files (only):**
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`

**May create, not overwrite:**
- `frontend/src/components/` small React presentational components, their local CSS modules/styles and colocated tests as needed; examples: `ProductShell`, `RecordQueue`, `DecisionCanvas`, `ProofDrawer`, `StageProgress`. Choose smallest reasonable set.
- `frontend/src/lib/decisionView.ts` and its tests (or similarly named **new** pure UI view-model helper) for *formatting/deriving display* from accepted response types. No permission or mathematical computation ownership in UI.
- `docs/CONTRACTS_T09_INT01.md` for actual UI contract, accessibility behaviours, status/display mapping and limitations.

**Explicitly forbidden without an independent approval:**
- All `backend/**`, `src/joinwitness/**`, Python/solver/checker/oracle/receipt code, `fixtures/**`, original CSV/JSON fixture bytes, `frontend/src/lib/api.ts`, `frontend/src/lib/demo.ts`, `frontend/src/lib/encoding.ts`, `frontend/package.json`, lockfile, Vite/TS configuration, dependency versions, `.env` files, credentials, Git configuration and all files in the original repository.
- Meta calls, Modal/Baseten calls, new libraries including XYFlow/Framer Motion, commits, pushes, deployments, destructive cleanup.

If an essential requirement cannot be implemented within this list, return a scoped compatibility proposal rather than silently editing the forbidden path. Do not create a fake working control to conceal an unsupported backend capability.

## 3. Required screens and interactions

### Entry — one explanation, two honest paths
- One concise headline and a single meaningful depiction of a record with alternative links. Use **'Example — not analysed'** before a live result. Show why a decision could depend on an uncertain record without inventing certified counts before the API responds.
- Main action: **Try the fictional example** (currently supported). Secondary **Use my CSVs** must be clearly designated `Coming in INT-02` / not yet available, never a dead button. Do not claim arbitrary CSV upload works in INT-01.
- Trust text: **AI suggests · You decide · Mathematics checks**. Clarify that browser Meta is **not yet enabled**; a prior live SDK success must not appear as a current browser provider response.

### Import — concise comprehension of the sources
- Retain the real fixture parse call, actual two-source row counts and state. Visually show two readable source cards and only a small sample preview. No demo-only values presented as uploaded user data.
- Loading, invalid input, HTTP failure and reset are meaningful. Preserve original source bytes and digest binding; *do not* change API encoding.

### Review — visual uncertainty, no invented authority
- Desktop (>=1280): record queue / center selection visualization / contextual right inspector. Phone: one record and a bottom/detail disclosure, no three squashed columns.
- Display data-derived attendance ID, candidate IDs, names, groups and origin/permission labels distinctly (deterministic/Meta/manual **origin** is different from possible/confirmed/prohibited **permission**).
- Selecting T-02 or switching candidate focus is view-only. Existing **adopt fictional review rules** stays the only authorization operation in INT-01; explain that per-edge editing, unmatched controls and manual candidate addition are scheduled for INT-02, not silently implemented or depicted as functional.
- A failed review/adoption must block Challenge. Continue to preserve the current validated revision and scope caveat.

### Challenge — signature Decision Canvas
- Show the immutable *fixed question*: `Did Group A have more attendance records than Group B?`
- Post-analysis, show **original and checked alternative** from actual API data. For the canonical synthetic fixture, expected A2/B1 → A1/B2 with T-02 R-A2 → R-B2 and changed distance 1, but never hardcode these as general analytical results.
- Connect a selected changed record visually to the before/after group outcome. Use static SVG/CSS if useful; controls work without motion or hover. A **view-only** baseline/alternative switch is permissible only with transparent labeling and no implication of review approval.
- When stable, witness-only, timeout/not-verified, invalid reference, inconsistent policy or partial coverage occurs, display accurate distinct UI. Do not show reversed counts or minimum proof where absent. Ties make `A>B` FALSE; unmatched is neither A nor B.
- Proof status copy and minimum number come exclusively from actual checked solver/receipt semantics. Do not derive optimality from a single checked witness or from an LLM response.

### Verify — human summary first, technical evidence second
- A short plain-language result and scope note; receipts issued/replayed through existing backend. Preserve cross-digest/status mismatch **fail-closed** gate from UX02-FIX01.
- `VERIFIED_REPLAY` proves replay consistency, not identity truth, candidate completeness or global minimum by itself. Correctly distinguish solver-only optimum from small-oracle cross-check and stable-in-policy outcomes.
- Details drawer: accessible exact assignments, allowed-edge reasons where supplied, full proof attribution, hashes and replay/download commands. **No text in a 32px marker column.** Technical information can scroll inside a bounded details panel, but not force a horizontal page scrollbar.
- Do not promise client-side receipt signature or cryptographic tamper proof.

## 4. Visual system and interaction quality

- Preserve the approved integrated-spec art direction: warm off-white canvas, readable deep ink, restrained deep-teal accent, subtle borders, generous whitespace **in service of information hierarchy**. No unrelated theme, dashboard cards everywhere, gradients/particles, Apple marks or stock visuals.
- Establish responsive design tokens and reusable components. For >=1280px use a true three-part **working** area (queue/canvas/inspector), not an empty three-column wireframe; on 375/390px stack meaningfully, prioritize primary canvas and single reachable next action.
- Keep first-screen orientation compact and reduce repeated copy. A contextual stage bar replaces the giant hero after starting. One visual primary action per stage-state; compact plain-language outcome before enum. Stage focus restoration and keyboard operation are required.
- Tap targets >=44px, no document overflow at 375px, keyboard-visible skip-to-main **first in tab order**, focus return from disclosures, semantic landmarks/headings, WCAG-AA target, reduced-motion support. No body text restricted to 32px widths and no clipping/truncating verified conclusions.
- Use data-driven motion only as a minor enhancement after functional DOM is available; `prefers-reduced-motion` never hides state changes. Don't add heavy frontend libraries for decoration.

## 5. Preservation and trust tests (mandatory)

1. Current 38 frontend tests must continue to pass; add tests for shell navigation, stage transitions, keyboard skip link, responsive verdict text and no proof claims before real results.
2. Positive fixture: parse -> adopt reviewed policy -> analyze -> receipt -> verify; exactly A2/B1 to A1/B2, T-02 R-A2 -> R-B2, distance 1 **when the appropriate proof says so**, `VERIFIED_REPLAY`.
3. Negative fixture contracts: stable scoped to reviewed policy, witness-only with no minimum assertion, `NOT_VERIFIED` on timeout, malformed/invalid policy or baseline, failed request, 409 stale and 422 tampered receipt, proof mismatch hides every success claim.
4. No authority from selecting, hovering or previewing links; unknown candidate IDs do not get invented; no arbitrary real-name cloud upload and no `/api/meta/suggest` without explicitly approved secure browser mechanism. On current INT-01 UI assert **zero browser Meta requests**.
5. Original `api.ts` response contracts remain unchanged, especially `witness_assignments` as pair tuples and `minimum_changed_assignments` nullable. Use existing view-only adapters; never calculate a matching solution client-side.
6. Build and tests `npm.cmd run build` and `npm.cmd test` in `frontend/`. Preserve all observed stdout/stderr and any blockers as `UNRUN`, not PASS.
7. Owner-side acceptance after Muse: actually start FastAPI + Vite in separate terminals; browse 1440×900, 390×844, 375×812; check API calls and screenshots; first Tab skip; reduced-motion, overflow, focus and proof layout. Also run Python `pytest -q` in original accepted venv. A JSDOM pass is not a browser pass.
8. Two uncoached outsiders should identify the core value within 20 seconds on first screen + canvas. Record evidence; do not invent user-test results.

## 6. Deliverables and STOP condition

Return all of:
- Changed-file inventory relative to the INT-00 pin, any new files, exact diff; no edits to forbidden paths.
- Design-system summary, two viewport wireframes/screens **actually implemented**; four stage interactions tied to real endpoints; explicit demo-only omissions (custom upload, editable review and browser Meta remain for INT-02/03).
- Actual build/test commands and outcomes, failing cases/warnings, feature coverage map, known a11y limitations.
- Before/after evidence screenshots only if the environment **actually rendered the UI**. Otherwise `BROWSER_UNRUN` and a precise owner-side test command. Avoid tool/environment reset loops.
- No commit, push, deployment, Meta paid call or dependency installation.

**STOP after INT-01 implementation and local tests.** Do not self-authorize INT-02 or modify the original repository. The coordinator will independently review delivered source and real browser evidence before opening INT-02.

## Suggested single Muse instruction

> Implement `JW-T09-INT-01` only after the owner verifies `BACKUP_VERIFIED: PASS`. Read the full original JW-RD-3.0 and the integrated T09 spec. Preserve the existing T08 contracts and UX03 data paths. Build the integrated responsive Decision Canvas/one-product shell with the specified user-comprehension, no-fake-proof and accessibility requirements. Touch only the exact allowlist, keep current tests green and add adverse-state tests. Do not make Meta calls, change backend/fixtures/dependencies, commit, push or deploy. Return real diffs/test outputs and all unrun browser gates. Stop at INT-01.
