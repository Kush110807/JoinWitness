# Release status and evidence boundary

**Current accepted application:** [`483fc95807df59528ccd4ea5e2541018b6f80966`](https://github.com/Kush110807/JoinWitness/commit/483fc95807df59528ccd4ea5e2541018b6f80966) — R2 Decision Atlas integrated on stable G4.  
**Mode:** Local, loopback-only and fictional-data demonstration.  
**Public access:** Source code is public; **the running application is not deployed publicly**.  
**Model inference:** No successful live Meta Model API call is claimed in the accepted release.  
**Document date:** 5 November 2026.

Later `main` commits may change README and research documentation without modifying this verified application commit. If a future release changes executable code, it requires a fresh test and browser evidence record.

## Functionality observed in local release testing

| Investigation | Observed claim | Scope |
| --- | --- | --- |
| Commerce | `REVERSED_EXHAUSTIVE`; **2/3 → 1/3**; D2: O2→O3; minimum **1**, checker passed and receipt replayed | Exhaustive within the frozen, reviewed `commerce.v1` world set |
| Event 60/90 | `REVERSIBLE_MINIMUM_PROVEN`; **32:28 → 30:30**; minimum **2** under the solver proof qualification; replay completed | Frozen source, baseline, review universe and CP-SAT model |

The difference between the two proof bases matters. Neither result asserts the correctness of any one disputed identity or delivery linkage outside the scenario.

## Reported release checks

- **452/452** backend tests.
- **146/146** frontend Vitest tests, TypeScript check and production build.
- **8/8** scripted live-Chrome journeys marked successful, across desktop and mobile viewports.
- Local browser results reported no page-level or evidence-drawer horizontal overflow.
- A secret-pattern scan was reported clean for the prepared source package. That is not a full security or Git-history certification.

The underlying screenshot and browser-report archive is retained locally by the owner and is **not automatically part of the public repository**. Three reported text-matcher `false` fields were analysed as harness issues; they were **not silently relabelled as passing assertions**.

See [Verification manifest](VERIFICATION_MANIFEST.md) for evidence qualifications and [Windows setup](SETUP_AND_LAUNCH_WINDOWS.md) to attempt independent reproduction.

## Open limitations

1. No real-data linkage accuracy or reviewer comprehension study.
2. No successful in-product live Meta inference in the accepted demonstration; `AI_UNAVAILABLE` is the honest fallback.
3. No authenticated public service, persistent multi-user permissions or independently reviewed production security.
4. Bounded search: excluded candidate links are outside the mathematical guarantee.
5. The full four-stage interface is functional, but visual styling is not uniform across every screen.

## Interpreting older documents

- [`docs/STATUS.md`](STATUS.md) is an **October 29 snapshot**. Its “T07 current” and “UI not started” statements are historical.
- [`docs/DECISIONS.md`](DECISIONS.md) preserves earlier decisions, not a present-day task queue.
- [The frozen Commerce contract](COMMERCE_CONTRACT.md) retains the words “draft / NOT FROZEN” in its original authored header. The identical bytes were formally frozen by the [November 1 HQ ruling](HQ_G1_FREEZE_2026-11-01.md). Do not edit the normative contract to change that heading.
- `frontend/package.json` and `frontend/index.html` retain historical T09A identifiers. The final R2 components are in `frontend/src/`; the older metadata does not determine the runtime feature set.
- The tracked Vite configuration has older local port defaults. Reproduce the verified test arrangement using a temporary proxy config, as specified in the [setup guide](SETUP_AND_LAUNCH_WINDOWS.md).

For the full reading order, use the [documentation index](README.md).
