# JW-T09-UX03 — Decision Canvas (Product-experience recovery)

**Authority:** JW-RD-3.0 FINAL. **Status:** PROPOSED; no source execution or approval claimed. **Owner:** Meta Muse Code (`muse-spark-1.3`); R&D HQ reviews. **Starting point:** the owner's isolated `C:\JW-Muse-T09` workspace after JW-T09-UX02-FIX01 (30/30 Muse-reported tests). The accepted `main` repository is unchanged. Confirm local files before edits; never presume this workspace matches an accepted Git commit merely because `HEAD` does.

## Why this ticket exists (grounded evidence, 31 Oct 2026 IST)

`JW_T09_UX02_BROWSER_EVIDENCE.zip` contains actual Edge screenshots and `browser_report.json`: the guided flow passed 390px and 375px with real `/api/parse`, `/api/suggest`, `/api/review/validate`, `/api/analyze`, `/api/receipt`, `/api/verify`; verdict `REVERSIBLE_MINIMUM_PROVEN`, minimum 1, successful `VERIFIED_REPLAY`, no JS errors, no external calls/overflow. Desktop stopped at keyboard skip-link-first failure. These results do **not** establish comprehension, perceived originality, or a production-ready experience.

On 390px mobile the Review screenshot spans ~2732 CSS pixels (>3 screen heights), the Challenge result ~2445 (~2.9), Verify ~2257 (~2.7). The same heavy introduction occupies the top of Review; status jargon, disclaimers, receipt hashes and commands obscure user-facing value. User explicitly rejected both clarity and visual quality.

## Product thesis — fixed

**Question:** A report concludes Group A attended more than Group B. Can a **human-permitted** different matching of ambiguous identities reverse that conclusion?

**Result:** Within the reviewed candidate universe for the fictional flagship, original A=2/B=1; permissible alternative A=1/B=2, changing T-02 from R-A2 to R-B2, with minimum distance 1 verified by completed solver, independent checker, and small-case oracle. This is **not** a claim about actual human identity, all possible real-world candidates, or unbounded data. AI suggestions cannot create review permissions or proof.

Do not change the original four-stage Import → Review → Challenge → Verify architecture, fixed A>B predicate, data IDs, solver, checker, oracle, receipts, or Meta mode/security boundaries.

## Exact authorised files

- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`
- `docs/CONTRACTS_T09_UX03.md` (new; document visual/interaction decisions and actual evidence)

Do not edit `frontend/src/lib/**`, fixtures, dependency files, backend, engine, API, Git settings, or any other files. If that becomes necessary, STOP and request separate approval. No installs, network font/CDN/assets, paid Meta calls, commit, push or deploy.

## Implementation requirements

1. **First screen, 10-second clarity:** Use a concise human-language heading: “Can one uncertain match change who came out ahead?” followed by a one-sentence purpose and a single prominent CTA “Explore the fictional event.” The CTA must appear above the fold at desktop 1440×900 and mobile 375×812, without requiring technical knowledge. Do not claim a *computed* reversal until `/api/analyze` has actually returned a verified result. Clearly mark the example fictional.
2. **Replace repeated giant hero with compact contextual header:** Once a stage begins, show a compact product bar and small current-question summary; avoid repeating the multi-paragraph landing on each screen. Active stage navigation remains accessible and correctly gated. One primary action per stage, easy Back action; ensure actual first keyboard Tab focuses a working “Skip to main content” link, which visibly appears on focus.
3. **Review — visual uncertainty, not a policy form:** Render a source-to-candidate connection diagram/list from returned IDs and permission state, with `T-02` at centre and distinct links to `R-A2` (Kim Rao, A) and `R-B2` (Kym Rao, B). Distinguish `suggested`, `allowed by pre-authored fictional policy`, `original baseline`, and `checked alternative`. Do not invent names or relationships and do not imply that viewing/tapping changes human authority. Keep explicit “Adopt fictional review rules” as the only authority-affecting action in this fixed example. Show that independent editable review and general CSV uploads are not yet shipped, without repeating these notes across every surface. Optional technical details in collapsed disclosure.
4. **Challenge — the Decision Canvas:** Above the fold show side-by-side (desktop) or vertically paired (mobile) ORIGINAL vs PERMITTED ALTERNATIVE counts with a clear visual transition; put the decisive changed link `T-02: R-A2 → R-B2` between them, and state “This one permitted change reverses which group leads” **only** when a checked reversibility verdict supports it. A view-only baseline/alternative toggle may inspect assignments; it must not change review permissions or rerun analysis. Preserve distinct stable, solver-proven, witness-only, incomplete, and mismatched-evidence states; no green proof state for unchecked results. Avoid raw enum strings in prominent user-facing text.
5. **Verify — proof ladder with progressive disclosure:** Show three plain-language checks **only when supported by the actual response**: “The assignment follows the approved matching rules”; “The conclusion changes (or is stable within scope)”; “Independent verification replay succeeded”. Show proved minimum only for actual `REVERSIBLE_MINIMUM_PROVEN`, and attribute solver proof vs oracle cross-check correctly. Keep receipt issuance/replay actions clear. Move hashes, enum codes, JSON, CLI command and detailed limitations into a clearly labelled “Technical evidence” disclosure; keep a short always-visible scope qualifier that this applies only to the reviewed candidate set, not real-world identity truth. Conflicting verdicts/digests must show an explicit error withhold proof.
6. **Style:** Develop one coherent high-quality editorial/analytical visual language; prioritize strong hierarchy, meaningful spatial relationships, quiet whitespace, precise typography and accessible contrast. No fake real-time AI scanning, gratuitous gradients/glows, generic KPI cards, giant walls of copy or decorative motion. No external design dependencies. Respect `prefers-reduced-motion`. At 375px and 390px all controls must remain usable without horizontal overflow; avoid excessively long vertical scroll in normal states.
7. **One real CTA per stage:** No dead/duplicated CTA; labels describe what happens. First-time user sees source files → reviewed possible links → impact on conclusion → verifiable proof. Clear/reload invalidates stages as before; stale async responses cannot repopulate old results. Preserve the existing API/client contracts.

## Tests and evidence required

**Before:** record `git status --short --untracked-files=all` and the current T09 frontend test count. Be mindful the UX workspace contains untracked files and `HEAD` points to earlier T08 acceptance; do not enforce a falsely clean tree.

**After:** run in `frontend/`:

```powershell
npm.cmd run build
npm.cmd test
```

Both must pass. Add tests asserting: (a) first-screen main CTA/short purpose; (b) baseline does not claim verified reversal before analysis; (c) reviewed candidate choices are correctly distinguished from adopted permissions; (d) exact T-02 / group counts and minimum shown on verified flagship; (e) stable and solver-only receipts have honest distinct copy; (f) mismatch/failed replay withholds proof; (g) no stale render after clear/reload; (h) first keyboard Tab skip link followed by sensible focus order, or disclose browser-only confirmation needed.

Run existing **actual** Edge E2E (or updated selectors bounded to this ticket) against FastAPI+Vite on owner Windows workstation. Required widths 1440×900, 390×844, 375×812; collect landing, review, challenge result and verified receipt screenshots (12 images), report JSON, failures and console logs. If sandbox blocks browser, mark `BROWSER_UNRUN` and ask owner to execute, rather than fake screenshots. Do not claim 10-second comprehension is tested by automated assertions; this requires a human who has not read the specification.

### Release standard / stop conditions

**GO for UX03 candidate only** if source tests pass, genuine browser flow succeeds on three widths including skip-link, and screenshot review shows the purpose and minimum-change causal relationship without scrolling through documentation. **HOLD** if any proof status is misleading, if permissions mutate through suggestion viewing, if keyboard access fails, or if mobile blocks actions. One bounded implementation and one corrective pass; avoid repeated undirected redesigns.

**Return:** exact changed-file list and diff summary, executed commands with results, screenshots paths/report, any known unexecuted tests, actual limitations. No source commit/push/deploy or additional Meta calls.
