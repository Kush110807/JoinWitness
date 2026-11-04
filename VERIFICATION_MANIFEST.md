# Verification record — Decision Atlas R2

**Application release:** [`483fc95807df59528ccd4ea5e2541018b6f80966`](https://github.com/Kush110807/JoinWitness/commit/483fc95807df59528ccd4ea5e2541018b6f80966)  
**UI lineage:** audited R2 `d100eebc9151bba748b322b9f5b1d08f92cd711c`, integrated onto stable G4 `cefe055370807ce580593e101bf3e95463170aeb`.  
**Provenance:** Windows test outputs and live browser captures reported by Muse and reviewed during local release preparation. This is a historical evidence register, **not a fresh run in GitHub Actions or an external audit**.

## Test observations

| Gate | Recorded local result | Important qualification |
| --- | --- | --- |
| Backend | **452/452** pytest tests passed | Uses pinned local dependencies including OR-Tools; not tested by this document |
| Frontend | **146/146** Vitest tests passed | Component and transport tests include mocked responses |
| TypeScript/Vite | `tsc --noEmit` and production build passed | Build success alone does not prove a live server journey |
| Chrome | **8/8** scripted journeys marked successful across four viewports | Two scenarios × 1440×900, 1728×1080, 390×844, 375×812 |
| Responsive layout | No page-level horizontal overflow was reported; evidence dialog was also measured | Browser-level metrics, not exhaustive device coverage |
| Commerce | `REVERSED_EXHAUSTIVE`, **2/3 → 1/3**, delivery **D2: O2 → O3**, minimum **1**; checker `PASSED`; `VERIFIED_REPLAY` | Exhaustive within the explicitly authorised, bounded world set |
| Event | `REVERSIBLE_MINIMUM_PROVEN`, **32:28 → 30:30**, minimum **2**; receipt replay successful | CP-SAT solver-attributed optimum with separate witness checking |
| Meta | `OFFLINE_ONLY`, `AI_UNAVAILABLE` | **No live Model API call proven** |
| Security hygiene | A heuristic source/secret scan was reported clean | Not a penetration test or a comprehensive Git-history secret scan |

The owner retains a local `JW_G4_ATLAS_R2_RELEASE_EVIDENCE.zip` package (reported: **38 screenshots, eight machine reports, three probe texts and an index**). Those files are **not publicly downloadable** from this repository merely because this record mentions them.

## Three probe discrepancies

Three Boolean text-match probes were reported `false` even though the overall scripted journeys recorded `ok:true`.

- Two text matchers contained corrupted Unicode arrow bytes and did not match the rendered right arrow in otherwise observed witness strings.
- One phrase matcher expected a different wording for the twelve ambiguous attendance records.
- Separate live text probes and screenshots were used to investigate those mismatches.

The individual false results remain **false in the original reports**. They must not be retroactively called passing assertions. Likewise, a drawer may correctly show “receipt not yet verified” before the distinct Verify-stage replay has completed.

## Scope of the verification claim

A successful checker evaluation supports the **reported witness**. Minimum-distance claims require the separate stated search proof basis: Case B's exhaustive finite enumeration is not the same as Case A's solver-attributed optimum. Source and policy hashes support reproducibility; they do not authenticate who produced the source data.

The two frozen Commerce documents are:

- [`docs/COMMERCE_CONTRACT.md`](docs/COMMERCE_CONTRACT.md) — raw SHA-256: `7fcfbed0768cf789265394b9544df3bd41021ae7c1f05fee5262e05a57cba1af`.
- [`docs/COMMERCE_API_EXAMPLES.json`](docs/COMMERCE_API_EXAMPLES.json) — raw SHA-256: `5aac810f4dd72fd2ee9db69d922fcc16a6e9cfeb565ffb31b5eb1d61fc518148`.

These are **file-content SHA-256 values**, not Git blob object IDs. The normative bytes were frozen by the [HQ decision](docs/HQ_G1_FREEZE_2026-11-01.md). The Commerce contract's original “draft / NOT FROZEN” header is retained for exact-byte continuity and must be interpreted alongside the later ruling.

## Independent reproduction

Follow [Windows setup](SETUP_AND_LAUNCH_WINDOWS.md) with the published application source and local fictional fixtures. Record the current SHA, interpreter/Node versions, commands, exit codes, numerical results and browser artefacts. If outcomes differ, preserve the discrepancy rather than citing the historical test total as a fresh pass.

This record does not claim that production security, real-record accuracy, public hosting, human usability or real-time model inference have been independently validated.
