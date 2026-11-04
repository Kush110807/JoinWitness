# Release status and evidence boundary

**Current public application integration:** [`578003707b972289433c022ca893ecad88e58234`](https://github.com/Kush110807/JoinWitness/commit/578003707b972289433c022ca893ecad88e58234) — fully unified Decision Atlas frontend for both investigations. **Original verified engine baseline:** [`483fc95807df59528ccd4ea5e2541018b6f80966`](https://github.com/Kush110807/JoinWitness/commit/483fc95807df59528ccd4ea5e2541018b6f80966), preserved without engine, fixture, contract or API changes.  
**Mode:** Local, loopback-only and fictional-data demonstration.  
**Public access:** Source code is public; **the running application is not deployed publicly**.  
**Model inference:** No successful live Meta Model API call is claimed in the accepted release.  
**Document date:** 5 November 2026.

The unified frontend was developed in isolated branch `g4/atlas-unified-final` and locally committed at `d4522e35de0f0f4fc967b9383ca81f61b872e802`, before being merged through [PR #4](https://github.com/Kush110807/JoinWitness/pull/4). This is a frontend release after the initial R2 evidence. Additional `main` documentation commits do not imply further runtime validation. New executable changes require fresh tests and browser evidence.

## Functionality observed in local release testing

| Investigation | Observed claim | Scope |
| --- | --- | --- |
| Commerce | `REVERSED_EXHAUSTIVE`; **2/3 → 1/3**; D2: O2→O3; minimum **1**, checker passed and receipt replayed | Exhaustive within the frozen, reviewed `commerce.v1` world set |
| Event 60/90 | `REVERSIBLE_MINIMUM_PROVEN`; **32:28 → 30:30**; minimum **2** under the solver proof qualification; replay completed | Frozen source, baseline, review universe and CP-SAT model |

The difference between the two proof bases matters. Neither result asserts the correctness of any one disputed identity or delivery linkage outside the scenario.

## Reported release checks

- **452/452** backend tests.
- **152/152** frontend Vitest tests, TypeScript check and production build, reported locally for the unified UI (the earlier R2 checkpoint had 146).
- Browser captures cover **Case A and Case B × Import/Review/Challenge/Verify × four viewports** (1440×900, 1728×1080, 390×844, 375×812); 32 stage-level overflow checks were marked `ok` in the committed JSON report.
- Keyboard review: **13/13** targeted audit checks passed, and **23/23** checks passed across prepared Case A (12) and Case B (11) routes. **Two additional custom-draft automation assertions failed** (`custom-adopt-keyboard`, `commerce-adopt-keyboard`); the custom route's Challenge/Verify keyboard subtest was skipped. These results do not justify a universal keyboard-accessibility PASS.
- Local browser results reported no page-level or evidence-drawer horizontal overflow.
- A secret-pattern scan was reported clean for the prepared source package. That is not a full security or Git-history certification.

The unified release's **40 stage/evidence screenshots**, browser results and targeted keyboard-audit files are now publicly committed in [`results/atlas-unification/`](../results/atlas-unification/) and [`results/ux-keyboard/`](../results/ux-keyboard/). The earlier R2 archive was kept separately by the owner; three historical text-matcher `false` fields remain false in those earlier reports. The new keyboard failures described above are also not silently reclassified as passing.

See [Verification manifest](VERIFICATION_MANIFEST.md) for evidence qualifications and [Windows setup](SETUP_AND_LAUNCH_WINDOWS.md) to attempt independent reproduction.

## Open limitations

1. No real-data linkage accuracy or reviewer comprehension study.
2. No successful in-product live Meta inference in the accepted demonstration; `AI_UNAVAILABLE` is the honest fallback.
3. No authenticated public service, persistent multi-user permissions or independently reviewed production security.
4. Bounded search: excluded candidate links are outside the mathematical guarantee.
5. The UI now uses a shared dark four-stage Atlas, but user testing and independent accessibility certification remain open; custom-draft keyboard automation is not fully passing.

## Interpreting older documents

- [`docs/STATUS.md`](STATUS.md) is an **October 29 snapshot**. Its “T07 current” and “UI not started” statements are historical.
- [`docs/DECISIONS.md`](DECISIONS.md) preserves earlier decisions, not a present-day task queue.
- [The frozen Commerce contract](COMMERCE_CONTRACT.md) retains the words “draft / NOT FROZEN” in its original authored header. The identical bytes were formally frozen by the [November 1 HQ ruling](HQ_G1_FREEZE_2026-11-01.md). Do not edit the normative contract to change that heading.
- `frontend/package.json` and `frontend/index.html` retain historical T09A identifiers. The unified UI is in `frontend/src/`; the older metadata does not determine the runtime feature set.
- The tracked Vite configuration has older local port defaults. Reproduce the verified test arrangement using a temporary proxy config, as specified in the [setup guide](SETUP_AND_LAUNCH_WINDOWS.md).

For the full reading order, use the [documentation index](README.md).
