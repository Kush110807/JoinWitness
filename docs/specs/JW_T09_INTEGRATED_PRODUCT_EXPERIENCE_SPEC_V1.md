# JOINWITNESS — T09 INTEGRATED PRODUCT EXPERIENCE
## Design, functionality, trust, implementation and acceptance specification

**Specification ID:** JW-T09-INT-1.0  
**Issued:** 31 October 2026 (IST)  
**Governing authority:** `JW-RD-3.0 FINAL — SINGLE SOURCE OF TRUTH`, 28 October 2026, especially §§01, 03–10, 14, 16, 19–20.  
**Status:** AUTHORITATIVE T09 EXECUTION PROPOSAL — ready for bounded implementation; **not a released implementation**.  
**Product:** JoinWitness, an AI-assisted *conclusion-robustness auditor*.  
**Primary delivery target:** one cohesive React/Vite/TypeScript + FastAPI application, not a new product or a separate demonstrator.  
**Product owner:** user. **Integration coordinator:** principal ChatGPT R&D conversation. **File-writing worker:** one Muse Code session at a time.  
**Change control:** Only JW-RD-3.0 can override technical or mathematical contracts; if this document conflicts with it, JW-RD-3.0 wins. No repo push, public deployment, or financial action is implied or authorised by this document.

---

## 0. Executive decision

**Replace the UX01–UX03 patch cycle with a single integrated T09 delivery programme, executed in bounded implementation slices against a frozen experience contract.** Keep the verified computational core intact. Do **not** claim the existing working synthetic walkthrough is the finished product.

**Product promise:** “Find out whether uncertain matches can change the answer — before you act on that answer.”

**10-second comprehension outcome:** A first-time visitor should be able to say: “I have two lists; some people might be mismatched; JoinWitness checks whether a different allowed matching could change my conclusion, and shows evidence I can inspect.” The visitor must not need to know CP-SAT, oracle, witness, hash, baseline, or ‘reviewed universe’ to begin.

**One distinctive experience:** A **Decision Canvas** connecting (a) records and human-permitted alternative links, (b) the affected A/B outcome, and (c) the exact kind of proof available. All three are connected in one visible interaction. Selecting a row **inspects**, never authorises; only an explicit reviewer action grants permission. No motion or result is invented before the relevant backend response.

**Product completeness:** The shipping T09 scope requires two real CSV inputs with default/mapped fields, editable human review and unmatched permissions, a valid frozen baseline, decision challenge, replayable verification, and a visible, explicitly initiated Meta assistance path where the authenticated/safe API boundary permits it. Those are original V1 obligations, not new features.

### What is already established versus not

| Evidence level | Existing status as of owner-provided 31 October evidence |
|---|---|
| Local Python core and FastAPI | Prior owner smoke confirmed actual Import→Review→Challenge→Verify API path, reversal, 1-change optimum and valid replay on fictional fixture. |
| Meta model | An earlier **one** owner-observed genuine synthetic Muse Spark 1.3 SDK request succeeded; T08B `/api/meta/suggest` remains a **restricted local-only, one-attempt, fixture-hash-pinned diagnostic route**, not a general production AI service. |
| Current React | UX03 code exists only in isolated `C:\JW-Muse-T09`, uncommitted; Muse reported 38 tests, owner browser flow passed but the Verify proof-card layout/served-css provenance gate remains unresolved. |
| Product omissions | Custom CSV upload, editable per-edge/unmatched review, general valid baseline construction and browser-driven safe Meta assistance have **not** been demonstrated. |
| Final UX acceptance | **HOLD**: technical browser success does not establish first-time comprehension or polished product quality. |

**Known accepted Git base:** `e956eae91b8779b36520295cecfa34dbae6708b6` (T08B integration). That commit is a **repository baseline**, not an assertion that uncommitted T09 files have been accepted. At execution start inventory all T09 source files and create an exact SHA-256 manifest/backup before edits. Never assume files were committed because tests passed.

---

## 1. Scope lock and essential user jobs

### In scope, unchanged from JW-RD-3.0
1. Import two CSVs (Registrations with `registration_id`,`name`,`group` and Attendance with `attendance_id`,`recorded_name`) or load the clearly labelled fictional demo. Explicit mapping for approved equivalents/validated defaults; show source/row counts and validation errors.
2. Deterministic candidate shortlist, manual candidate addition using **existing IDs only**, and AI suggestions presented as unreviewed/advisory.
3. Explicit human edge decisions: `CONFIRMED`, `POSSIBLE`, `PROHIBITED`; unmatched per attendance: `ALLOWED`, `REQUIRED`, `FORBIDDEN`; explicit coverage declaration and scope note.
4. Complete, reviewer-approved, one-to-one valid reference assignment; freeze its review revision and digest for analysis.
5. **Only** the question `count(Group A) > count(Group B)`; Group labels supplied by registrations, not revised by AI; a tie makes predicate **FALSE**.
6. OR-Tools CP-SAT optimal reversal, independent witness checker and small exhaustive oracle; typed truthful verdicts.
7. Side-by-side original/alternative outcome and actual changed IDs; versioned JSON receipt and independently checked replay.
8. Offline deterministic fallback, honest partial-coverage warning, privacy/security guards, responsive keyboard/touch interface.

### Out of scope — do not turn into a new backlog
Arbitrary Excel/SQL/questions, PDFs/OCR, general AI chatbot, open-ended data science, user accounts, enterprise multi-user collaboration, native iOS/macOS apps, Apple branding/integration, automatic real-identity verification, guaranteed stability in the real world, production AI proxy without authenticated security, gratuitous 3D/particle effects, fabricated accuracy scores.

### Users and jobs to be done
- **Event/operations analyst (first-time user):** “I need to know whether my claimed Group A lead depends on one unresolved check-in identity.”
- **Reviewer:** “Show me why a candidate was suggested. I decide what is allowed, and I can prohibit or add a possibility without being forced to trust AI.”
- **Auditor/judge:** “Show me the exact assignment change, mathematical status, scope limits and independently replayable receipt.”

Product must support all three without making the analyst read auditor-level information first.

---

## 2. Unified interaction model and information architecture

**Four authoritative stages remain**: Import → Review → Challenge → Verify. They are a *workflow/state machine*, not four long documentation pages. The Decision Canvas is a **persistent visual grammar** that grows in precision as evidence arrives.

### Entry: one clear question, two paths
- Primary headline: **“Can uncertain matches change your conclusion?”**
- One sentence: “Join a registration list to attendance, review the ambiguous links, then test whether a different permitted match changes which group leads.”
- Primary action **Try the fictional example** (safe, immediately usable), secondary **Use my CSVs** (actual upload workflow).
- A simple visual of an attendance row connecting to two candidate registrations may be shown as **illustration**, always labelled **Example — not analysed** until the real API returns a checked result. Never pre-paint a green proof, computed optimum, or irreversible conclusion.
- Persistent, non-promotional trust line: **“AI suggests · You decide · Mathematics checks.”**
- No dashboard full of KPIs, fake activity logs, or multi-paragraph hero.

### I. Import — “What are we comparing?”
**Primary content**: two large, visually differentiated file tiles (Registrations / Attendance) with drag/drop, native picker, sample-data action, file name, bytes, actual row count and data-preview affordance. No extra required buttons in the ideal flow.

**Behaviour**:
- File bytes read client-side (File API); preserve exact bytes when base64 encoding for existing `/api/parse`; no CSV row rewriting before hashing. Enforce configured size (initial target ≤3 MB per file) and server's row limits (initial ≤100 attendance / ≤150 registration).
- Header mapping UI if fields aren't mapped to known defaults; do not silently invent labels or edit registration groups. If current backend only supports exact columns, either implement a separately reviewed mapping adapter with explicit source/normalized provenance or clearly block unsupported headings. No pretending mapping is live if not implemented.
- Verify actual CSV and backend status; show duplicate ID/invalid group/oversize errors in plain language, retain input context, offer correction.
- On parse success, preview sample rows, counts, and privacy warning. Switching or editing a source clears all dependent permissions/baseline/analysis/receipt.
- If filenames contain PII, do not expose names in logs/telemetry. Default to synthetic and local deterministic analysis; cloud Meta upload requires separate meaningful consent and a safe route.

**Acceptance outcome:** user knows *which two sources* they loaded and their row counts before Review.

### II. Review — “Which connections are you willing to consider?”
This is the user's main working surface, **not a policy JSON form**.

**Desktop:** candidate queue on left, central selected attendance row with candidate registration links and evidence, right decision inspector. **Mobile:** one selected attendance row, its candidate choices and a collapsible bottom/details sheet; never squeeze three desktop columns onto 375px.

**For each attendance row:**
- Display immutable attendance ID, recorded name, available comparison fields; candidate ID, name and registration group; source-side evidence references if available.
- Tags convey distinct *origins* — deterministic shortlist, Meta suggestion, manually added, existing policy — and distinct *authority states* — unreviewed, possible, confirmed, prohibited. **Do not confuse origin with permission.**
- Explicit decisions: **Confirm this link / Allow as possibility / Prohibit**, with non-destructive confirmation when a prior confirmed edge or occupied registration would conflict. Prohibit and confirm cannot silently be inferred from click, hover, drag, or model output.
- Separate unmatched choice for the attendance row: **Allow unmatched / Require unmatched / Forbid unmatched**; show it clearly but not as a default assumption.
- **Add candidate** opens searchable list of existing registration IDs; no invented person, no unseen new identity, no hidden candidate omission interpreted as impossible.
- Coverage control: `UNREVIEWED` / `REVIEWED_PARTIAL` / `REVIEWED_CLOSED_SCOPE` with plain explanation and explicitly entered scope note. Closed scope is **reviewer-declared for this model only**, not global identity completeness.
- **Reference matching editor**: choose exactly one allowed registration or permitted unmatched for every attendance record; flag collisions/missing reference; show baseline A/B counts only after server validates. Demo may prepopulate the *identified fictional reference* but must require explicit user adoption.
- A view-only “Explore this possible link” previews its relationship in the canvas but does not approve it, run solver, create baseline, or write review state.
- Distinguish deterministic and Meta suggestions; absent/unavailable Meta still allows complete manual/deterministic flow.

**Single authority action:** **Validate my review & reference** invokes existing `/api/review/validate` and receives actual digest, revision, baseline counts. Do not enable Challenge until valid.

**Acceptance outcome:** user can explain which link is uncertain and what *they* permitted, without seeing a JSON policy file.

### III. Challenge — “Could your answer change?”
**The signature moment.**

**Before solver:** Display the fixed question verbatim: “Did Group A have more attendance records than Group B?” and **original A/B counts from the validated reference**, revision/scope concise. Large action **Challenge this conclusion**. Never claim a reversed result before `/api/analyze` returns.

**After solver:** A data-driven, interactive, accessible **Decision Canvas**:
- Two outcome surfaces side-by-side on desktop and vertically/swipe-comparable on mobile: **Original matching** and **Checked permitted alternative**. Show counts with consistent colour/labels (A and B always have textual labels) and a visible changed-link connector in between.
- Selecting a highlighted changed attendance row displays *from registration ID + name + group* and *to registration ID + name + group*, exactly derived from the response and current source data, not hard-coded `T-02`.
- Clicking/selecting the line is **inspection only**. The line never changes authoritative permissions or source data. Changing the review requires explicit **Edit reviewed matches** and invalidates the analysis.
- Animate the count/connection only after checked data arrives, with meaningful 180–300ms motion and reduced-motion alternative. No animated fictitious path or fake progress percentage.
- **Headline precedence**: verdict status → before/after comparison → changed IDs → review scope → technical proof on demand.
- Status-specific panels for reversible/proven, witness-only, stable-within-policy, inconclusive, inconsistent policy, invalid baseline and stale snapshot. Never render the alternative card for nonexistent witness; no “no reversal” assertion for timeout/UNKNOWN.
- Provide a clear **Verify evidence** action only after appropriate analysis; error/inconclusive states get **Review inputs / Retry bounded check** as applicable.

**Acceptance outcome:** before reading a paragraph, user sees *what changed*, *why it affects the decision*, and *what level of proof exists*.

### IV. Verify — “Can this finding be independently checked?”
**Public face**: short human-readable verification summary, e.g. “This alternative follows the reviewed rules”, “The outcome changes”, “The receipt replay matched the original inputs”, each independently attributed to the actual returned fields. Show a persistent scope qualifier.

**Technical evidence disclosure** (secondary): witness assignment table, checked constraints, solver and oracle attribution, exact review/reference/source digests, receipt SHA-256, downloadable versioned JSON, CLI replay command. Code stays legible in horizontal scroll when necessary, never inserted into 32px proof-card columns. Hash is an integrity fingerprint, **not a signature**.

**Receipt lifecycle:** issue from `/api/receipt`; replay via `/api/verify`; compare receipt + analysis + replay verdicts and digest identity. Conflicts show **Evidence does not agree — no proof claim** and no green certification. Successful reply `VERIFIED_REPLAY` is *replay status*, not automatic proof of global optimality.

**Acceptance outcome:** nontechnical user gets a trustworthy summary and a next action; auditor can expand and reproduce exact detail.

---

## 3. Product visual language — distinctive without theatrics

### Visual principle
**Clarity through causality.** The changing relationship, not decorative chrome, is the premium visual signature. Make one link and its effect the visual center of gravity.

- Use one stable wordmark **JoinWitness** and a restrained split-link motif; not Apple marks or copied iOS/macOS screens.
- **Palette proposal** (subject to contrast test): ink `#162329`, warm canvas `#F7F8F5`, subtle surface `#FFFFFF`, dividers `#DAE2DF`, primary deep teal `#08766D`; distinct A/B result colours with labels and accessible contrast (not colour alone). Treat green success carefully: only validated evidence gets such treatment.
- System font stack (`system-ui`, `-apple-system`, `Segoe UI`, sans-serif) with deliberate optical scale; no requirement to load fonts over network. Compact monospaced IDs in proof details only.
- Rhythm tokens: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px; main display 36–52px desktop and 30–38px mobile; body 15–17px with readable line length of ~55–70 characters.
- Subtle 1px borders, 12–20px radius and extremely restrained elevation. Avoid broad gradients, ubiquitous pills, thick borders and dashboard tile grids.
- One primary action per current stage-state. Secondary commands never visually compete with it.
- Live data graph: SVG or lightweight React/CSS rendering is acceptable initially; **no new graph or animation library until a proof-of-value benchmark justifies it**, then require a separate approved dependency decision. React/Vite/TS are sufficient for the experience.

### Layout
| Width | Contract |
|---|---|
| ≥1280px desktop | persistent workflow orientation; working area prioritises center Decision Canvas; contextual record inspector; proof drawer. No huge empty landing footer. |
| 768–1279px tablet | 2-panel adaption; inspector may be overlay/drawer with explicit close and focus return. |
| 375px / 390px phone | single primary canvas; one current record; controls and result vertically ordered; collapsible evidence; tap targets ≥44×44px; no horizontal page overflow. |

Motion must express actual *source → allowed link → decision outcome*; respect `prefers-reduced-motion`; do not make visual state dependent on motion or pointer hover.

### Proposed visual layout (structural only; NOT an approved screenshot)

```text
DESKTOP 1440
┌────────────────────────────────────────────────────────────────────────────────────┐
│ JoinWitness                        Import  Review  Challenge  Verify  [Scope]        │
├───────────────────┬───────────────────────────────────────────┬────────────────────┤
│ ATTENDANCE        │     THE DECISION CANVAS                   │ WHAT'S BEING CHECKED│
│ T-01  resolved    │                                           │ Question: A > B    │
│ T-02  unresolved  │  CURRENT                       ALTERNATE  │ Reviewer permits   │
│ T-03  resolved    │  A 2 / B 1       ──T-02──▶     A 1 / B 2  │ 2 links for T-02   │
│                   │  A leads                         B leads   │ Scope: reviewed    │
│ [+ add existing]  │                                           │ [evidence details] │
├───────────────────┴───────────────────────────────────────────┴────────────────────┤
│ [Contextual primary action: Challenge / Verify / Continue]                         │
└────────────────────────────────────────────────────────────────────────────────────┘

PHONE 390
┌─────────────────────────┐
│ JoinWitness   [Stage]   │
│ Can the result change?  │
│ [Current A2/B1]         │
│      T-02 link          │
│ [Allowed alternative]   │
│ [Checked A1/B2]         │
│ Scope / evidence ▾      │
│ [One primary action]    │
└─────────────────────────┘
```

Never render those counts as *real analyzed claims* before the solver and checker actually return them.

---

## 4. Non-negotiable API, data and trust contract

### Existing client wire shapes (observed from uploaded T09 source)
- `/api/parse` accepts `registrations_b64` and `attendance_b64` and returns source rows/digests.
- `/api/suggest` deterministic fallback; `shortlist.candidates` are **unreviewed**.
- `/api/review/validate` accepts source bytes, `policy: ReviewDraft`, `reference: ReferenceDraft`.
- `/api/analyze` and `/api/receipt` require `expected_review_sha256` + `expected_revision`, binding policy/reference to frozen state.
- `/api/verify` accepts source, policy and receipt and returns replay status, verdict, proof basis and digest.
- Current `witness_assignments` are array pairs `[[attendance_id, registration_id|null], ...]`, not objects. UI must adapt them and compute changed assignments against the actual reference.
- `ReviewDraft` fields and enums in `frontend/src/lib/api.ts` are the accepted T08A wire types. Keep server responses authoritative; do not mutate API types merely for convenient rendering.

### Meta model route is a **known exception**, not a normal upload API
Current T08B `/api/meta/suggest` is explicitly local-loopback, one-call-per-process, synthetic fixture hash-pinned, requires `JW_T08B_LOCAL_TOKEN` protected on the server and literal explicit initiation. **It is not safe to call from arbitrary browser JavaScript with an embedded token, nor to expose publicly or to send arbitrary uploaded CSVs to Meta.**

T09 must therefore: (i) show a deterministic **Use without AI** path that always works; (ii) provide an explicit **Request AI suggestions** control only if a server-side, owner-approved protected invocation mechanism exists; (iii) label local-only fixture mode clearly; (iv) keep secrets exclusively server-side; (v) present `AI_UNAVAILABLE` as a *suggestion-layer* state, not an analytic verdict; and (vi) defer general uploaded-data cloud inference/public security to a separately reviewed backend hardening contract, coordinated with T11. An end-user control without a safe route **must be disabled with honest wording**, not simulated as a live Meta integration. A previous real Meta SDK call does not prove the browser flow.

### Source, policy and snapshot lifecycle
```
INPUT_CHANGED → revoke review + baseline + result + receipt
REVIEW_PERMISSION_CHANGED → revoke frozen review + baseline validation + result + receipt
REFERENCE_CHANGED → revoke validation + result + receipt
VALIDATE_SUCCESS → freeze {source hashes, policy revision/hash, reference hash, scope}
ANALYZE_SUCCESS → bind result to frozen snapshot and exact client operation epoch
ISSUE_RECEIPT → bind to frozen source/policy/ref/result
VERIFY_SUCCESS → compare cross-field digests and statuses, then show correctly attributed evidence
```

Implement request-epoch cancellation/ignore-late-response protection; never let an old response restore stale proof after edit/clear/reload. No persistent approval by default; reload returns to unproven import state unless a separately approved secure persistence design exists.

### Exact mathematical and language invariants
- One-to-one registration uniqueness; every attendance exactly one permitted registration or expressly allowed unmatched. Confirmed edges immutable within the solver model.
- `A > B` fixed; ties **FALSE**, unmatched contributes to neither.
- `REVERSIBLE_MINIMUM_PROVEN` only after solver completed optimality and independent witness validity; tiny fixture oracle may additionally cross-check. **One checked witness alone does not certify minimum**.
- `REVERSIBLE_WITNESS_ONLY`: alternative changes conclusion, minimum unproven.
- `STABLE_WITHIN_REVIEWED_POLICY`: no reversing alternative **inside reviewed model** after complete infeasibility evidence; never universal stability.
- `NOT_VERIFIED`, timeout, model failure, stale policy, invalid baseline/policy never get a green stable state.
- `VERIFIED_REPLAY` checks evidence consistency, not an assertion of true identity or full candidate discovery.
- Inconsistent verdict/digest/proof information: fail closed, prominently say **Evidence mismatch — result not certified**.
- Copy must expose `REVIEWED_PARTIAL` / coverage truncation. Never use ‘99% accuracy’ without measured evidence.

---

## 5. State and UX contract by completion status

| System observation | Main user-facing message | Visible action | Proof/caveat |
|---|---|---|---|
| No input | “Bring two lists to test a conclusion.” | Try example / Upload CSVs | Not analysed |
| CSV parse error | “We couldn't read [file]: [safe actionable problem].” | Fix file/mapping | Never claim zero matches |
| Unreviewed candidates | “These are suggestions, not approved links.” | Review each / Add existing ID | Coverage unreviewed |
| Policy inconsistent | “Two review rules conflict.” | Resolve highlighted conflict | Block analysis |
| Reference incomplete | “Choose one valid reference link for every attendance row.” | Complete baseline | Block analysis |
| Valid frozen reference | “Your reference says A=[N], B=[N].” | Challenge conclusion | Scope shown |
| `REVERSIBLE_MINIMUM_PROVEN` | “A permitted alternative changes the answer. The fewest changed assignments proven is [N].” | Inspect changed links / Verify | Solver-optimal, independently checked witness; tiny oracle when available |
| `REVERSIBLE_WITNESS_ONLY` | “We found a permitted change to the answer, but not the smallest possible one.” | Inspect/Verify | No minimum proof |
| `STABLE_WITHIN_REVIEWED_POLICY` | “No permitted reversal exists under these reviewed rules.” | Inspect coverage / Verify | Not identity truth |
| `NOT_VERIFIED` | “Analysis couldn't finish; no stability conclusion.” | Retry / Review | No proof claim |
| `AI_UNAVAILABLE` | “AI suggestions unavailable. Manual review still works.” | Continue offline | AI state, not solver result |
| Replay disagreement | “Evidence doesn't agree. We can't certify this result.” | Inspect technical evidence | Withhold all proof claims |
| Verified replay | “This receipt matches these inputs and reviewed rules.” | Download/check | State exactly what is solver- versus checker-proven |

At all times a jargon-free sentence precedes any enum; raw enums only in advanced details and downloads.

---

## 6. T09 work packages — one integrated specification, bounded implementation

**Do not hand an agent all phases as one uncontrolled mega-prompt.** Keep a single experience contract (this file), a single writer, and four bounded slices. Avoid a fourth aesthetic concept exploration.

### INT-00 — Baseline and contract audit (read-only + snapshots)
**Deliver:** inventory of actual `C:\JW-Muse-T09` source, current hashes and Git statuses; copy/backup of all uncommitted T09 work; map each requested UI behaviour to existing API and state; record gaps and exact authorized files; capture current screenshots. Do not fix styling by guessing which server is running. Record current Vite CSS-served SHA/origin when feasible.
**Gate:** named source base + no accidental loss of untracked work; exact functional gaps known. This gate cannot itself claim product acceptance.

### INT-01 — Integrated shell and Decision Canvas
**Deliver:** unified responsive design tokens/components; new entry view; coherent navigation; Import/Review/Challenge/Verify shell; record-link exploration and A/B comparison from *real returned data*; proof/details disclosure; semantic roles/accessibility; load/error states; fix 32px proof column in actual rendered app. Keep demo fully operational; do not change backend or dependencies. Prefer small pure presentation components instead of monolithic `App.tsx`.
**Gate:** Build/test PASS + actual browser screenshots at 1440×900, 390×844, 375×812; keyboard first-Tab skip; no overflow/one-word proof ladders; flagship real API end-to-end PASS; no unsupported numerical claims. At least one independent first-time user can explain the value after seeing the opening canvas without being coached.

### INT-02 — Real CSVs, manual review, valid reference
**Deliver:** CSV pickers, source mapping/validation interface, data previews, candidate queue, per-edge decisions, unmatched controls, manual existing-ID additions, coverage scope, full baseline builder, revision invalidation. Use existing server review models. Where a proposed mapping or custom source action cannot be represented by API, document the precise narrow compatibility change and obtain separate approval before backend edit.
**Gate:** fresh valid custom synthetic CSV works; duplicate primary IDs and invalid groups error; policy conflict and reference collision blocked; user can add a candidate omitted by shortlist; all confirmed/possible/prohibited/unmatched controls persist **only in current review state**; edit invalidates prior proof; no Meta call on upload; known coverage caveat visible.

### INT-03 — Meta assistance made useful, with hard trust boundary
**Deliver:** client-visible origin tags, concise model-supported alias reasons, prioritized reviewed candidates, explicit manual approval; design safe explicit-invocation UI for the existing synthetic-only route. The local T08B route is not production-safe; **no client-side token, no general uploaded-real-name Meta requests, no public deployment of this local route.** For a genuinely working browser-triggered live call, require a separate, reviewed server-side protected proxy/session design that passes the T08B security gates; otherwise label the feature UNAVAILABLE and demonstrate prior independently captured live Meta evidence transparently as *historical evidence* (not a current call). Preserve deterministic fallback.
**Gate:** actual live-versus-mock provenance clearly distinguished, no auto-call/retry, invalid model IDs rejected, no AI authority escalation, predictable 429/503 states, zero leaked keys. New server functionality requires its own reviewed ticket and security tests.

### INT-04 — Acceptance & integration
**Deliver:** independent automated E2E scripts, browser screens/video, test logs, final source manifest, a separate plain-language UX verdict, resolved safety bugs, and reviewed one-commit integration proposal. No commit/push until owner explicitly authorises.
**Gate:** G5 contract in §7 below. If time is scarce: preserve correct core and honest fixture demo; reduce decoration before trust or submission deliverables. Record incomplete features honestly rather than pretending T09 shipped.

**Execution budget:** Timebox the above against the November 4 internal freeze in JW-RD-3.0. The source contract has a final 6-hour submission/reproducibility reserve; do not consume it on visual exploration. This plan does not reset the hackathon clock or authorize unlimited refinements.

---

## 7. Measurable acceptance gates (G5 plus adjacent dependencies)

### A. First-time product comprehension (qualitative, **not** unit tests)
Show first screen + first Decision Canvas to at least **two people not involved in development** without explanation. Ask: (1) “What problem does this solve?” (2) “What does the AI do versus you versus the mathematical checker?” (3) “What conclusion can it legitimately make?” Record verbatim responses, confusion and time to first correct explanation. **Target:** basic purpose understood in ≤20 seconds by both; if unmet, correct wording/interaction before changing colours.

### B. Browser/UX
- Actual Edge/Chrome at **1440×900**, **390×844**, **375×812** and a keyboard-only traversal. At 375px: no horizontal document overflow; all touch controls ≥44px; no truncated critical verdict; no proof explanation in 32px marker columns; readable input/invalid/error states.
- First Tab activates a visible skip-to-main link; focus moves coherently after stage transition and modal close; all affordances are labelled and pointer independent; contrast WCAG AA in normal text; reduced-motion supported.
- Header/primary decision and next action visible without requiring long scrolling through legal copy; technical proof expands on demand.
- No fake loading statuses, percentages, model provenance, or stale value after reset/reload/failed request.

### C. Functional + mathematical
- Owner's existing baseline 38/38 frontend tests remain green; extra tests for new interactions. Python `pytest -q` from accepted core still passes; original source fixtures byte-identical.
- Live local API flagship: reference A2/B1, reviewed allowed alternative A1/B2, `T-02: R-A2→R-B2`, minimum 1, checked witness, verified replay. Stable, two-change, tie, unknown/timeout, coverage-partial, bad review, invalid reference, 409 stale and 422 tampering are appropriately displayed and must not get contradictory proof copy.
- For custom CSV: fully valid synthetic upload, bad-headers/mapping, duplicate IDs, row/size bounds, candidate truncation, manual edge add, competing registration conflict, invalid/unmatched scenarios, permission change and stale invalidation.
- Requests: only documented API paths; no Meta call without explicit action and legitimate server gate; no external credential or private CSV leakage.

### D. Trust and proof
- Compare analyze/receipt/verify statuses and hashes; on mismatch **fail closed**.
- Distinguish `REVERSIBLE_MINIMUM_PROVEN`, `REVERSIBLE_WITNESS_ONLY`, `STABLE_WITHIN_REVIEWED_POLICY`, `NOT_VERIFIED`, `AI_UNAVAILABLE`, `VERIFIED_REPLAY`; explain separately what solver, checker and small oracle establish.
- No unsupported identity, completeness, “safe”, formal security or first-ever claims. Explicitly preserve condition “within reviewed candidates/rules”.

### E. Performance and evidence
- No new large dependency without written value/size trade-off and owner approval. Avoid network fonts and unnecessary trackers; one accessible React app for iPhone and desktop.
- Evidence folder includes unedited viewport screenshots, network request statuses, screenshot of technical disclosure, console errors, focus & overflow metrics, source SHA manifest, test commands/output, and a 90-second judge narration storyboard.
- Release decision MUST be one of: **GO**, **HOLD (named defects)**, **NO-GO (trust/math failure)**. A build PASS or simulated screenshot cannot substitute for a live browser plus real API result.

---

## 8. Demonstration contract — one coherent story, plus negative cases

**90-second primary demo** (timings are targets, not proven timings):
1. **0–10 s:** “An attendance report says Group A led. Would one uncertain record change that decision?” Show current claim and two source lists.
2. **10–25 s:** deterministic candidates + *genuine Meta suggestion if safely enabled and actual provenance available*. If not, show honest fallback and prior genuine Meta evidence labelled clearly; do not fake real-time call.
3. **25–38 s:** reviewer explicitly permits Kim/Kym alternatives, validates reference, scope displayed.
4. **38–58 s:** Challenge reveals T-02's allowed change and A2/B1→A1/B2, minimum 1 **only after checked response**.
5. **58–74 s:** Verify shows independent checker/replay, tiny-oracle evidence, typed caveat.
6. **74–90 s:** “Unlike a best-guess join, JoinWitness tells you whether matching uncertainty can reverse the decision, and why.”

**Secondary selectable cases:** stable within reviewed policy; two changes; timeout/unknown; partial coverage. Prefer documented fixture picker without embellishment, only after core import/review works. Do not allow a three-record toy example to masquerade as proof of scaling; T10 will provide measured synthetic evaluations.

---

## 9. Engineering constraints and handoff contract

**Do not alter without separate owner-approved contract:** `src/joinwitness/solver.py`, `checker.py`, `oracle.py`, `receipts.py`, model provenance semantics, frozen source fixtures, T08 validation and versioned schema meaning. The current T09 design should consume existing backend results; modify backend only under a separately reviewed compatibility/security ticket where UI cannot be implemented truthfully otherwise.

**Permitted initial target files:** `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/App.test.tsx`; new small components under `frontend/src/components/`, new UI-only helpers under `frontend/src/lib/`, additional UI tests and the matching docs. Changes to `frontend/package.json`, lockfile, Vite config, `backend/`, T02–T08 core, `fixtures/` are **proposed only** until explicit file allowlist per bounded task.

**No untracked overwrite:** Because `C:\JW-Muse-T09` is an isolated clone with an accepted T08 base plus uncommitted T09 source, `git status` will show many `??` files; **do not interpret this as a clean tree**. Back up and SHA-pin the exact UX03 candidate before implementation. Original repo at `$HOME\Projects\JoinWitness` must not be mutated until integration approval.

**Repo integration method:** after independent G5 acceptance, present full changed-file inventory, diff from accepted T08 base, lockfile/secret audit, real browser evidence and proposed commit title. Owner decides commit/push. No automated self-push/deploy.

**MCP/tooling boundaries:** build/test commands are normal Windows PowerShell in project directory; Muse sandbox restrictions do not justify disabling global Windows/Git security. No paid Meta inference simply to compile a frontend. Avoid asking owner to prove the already reported credit amounts repeatedly. All actual spend is governed by separate financial approval.

---

## 10. Final release board and change-control rule

- **Current T09:** engineering vertical slice tested, product experience **HOLD**; custom real-data and review controls unfinished; browser Meta control unproven; evidence CSS/source mismatch still needs reconciliation.
- **Integrated design direction:** GO to build *against this specification*, not GO to deploy or claim completion.
- **No more serial aesthetic ticket loops:** a single functional visual direction, tested after each bounded integration slice. Correct factual/semantic/accessibility defects; cosmetic direction changes require a demonstrated user-comprehension failure.
- **Source hierarchy:** JW-RD-3.0 FINAL > frozen review/maths/contracts > actual independently observed test evidence > T09 integration spec > tickets > agent prose.
- **First executable work:** `JW-T09-INT-00` in the paired ticket file. It is read-only and produces a manifest plus exact implementation mapping. **Do not begin INT-01 code edits until its state report and allowlist are reviewed.**

**Acceptance statement to be earned, not presumed:** “A first-time user can import two imperfect lists, authorise plausible connections, see whether an allowed difference overturns the A/B conclusion, and independently inspect the proof—on desktop or phone—without reading backend documentation.”
