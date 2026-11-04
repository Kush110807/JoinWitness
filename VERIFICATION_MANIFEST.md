# JoinWitness — Final release verification manifest

**Release code commit:** \`483fc95807df59528ccd4ea5e2541018b6f80966\`  
**Public branch:** \`main\` (may have newer documentation-only commits)  
**Selected UI lineage:** audited R2 \`d100eebc9151bba748b322b9f5b1d08f92cd711c\`, merged locally into stable G4 \`cefe055370807ce580593e101bf3e95463170aeb\`.  
**Report type:** retrospective record of Muse-run Windows tests/browser evidence and owner screenshots, **not** a new independent run, security certification or cloud deployment attestation.  
**Data:** fictional event and commerce fixtures.  
**Scope:** local loopback offline release.

## Evidence summary (reported for the final release)

| Gate | Reported observation | Qualification |
|---|---|---|
| Git release | local clean tree; source frozen at release commit | Public README/docs may add commits without changing runtime |
| Frontend | **146/146** Vitest tests passed; TypeScript \`--noEmit\` succeeded; Vite production build succeeded | Unit/integration assertions; not by themselves proof of visual quality |
| Backend | **452/452** pytest tests passed, with pinned OR-Tools 9.15.6755 | Local environment, not a hosted CI result |
| Real Chrome | **8/8** scripted browser journeys marked \`ok:true\`, both cases at **1440×900**, **1728×1080**, **390×844**, **375×812** | Recorded by local Muse runner; some text-match probes were separately investigated |
| Case B | \`REVERSED_EXHAUSTIVE\`; K=2; **2/3 → 1/3**; delivery **D2: O2 → O3**; minimum **1**; checker \`PASSED\`; replay \`VERIFIED_REPLAY\` | Exhaustive proof only within reviewed bounded choices |
| Case A | \`REVERSIBLE_MINIMUM_PROVEN\`; **32:28 → 30:30**; minimum **2**, including T-49/T-52; receipt/replay successful | Read the solver-attributed proof qualification; no universal claim |
| Viewports | No document horizontal overflow reported at all four tested sizes; evidence dialog also checked | Local browser measurements |
| Security review | Heuristic secret-pattern scan reported zero hits; no credential files deliberately included in clean release source archive | Not a full history/third-party penetration audit |
| Meta inference | \`OFFLINE_ONLY\`, \`live_meta_available: false\` | No successful external model call is claimed |

## Browser assertion reconciliation

Three text matchers in a release-test harness were reported false despite successful journeys. The QA report attributed two to mis-encoded Unicode arrow bytes in regular expressions and one to different legitimate wording for “12 ambiguous” versus “12 unresolved ambiguous matches”. The report included separate live text probes and screenshots.

These individual \`false\` fields must **not** be restated as having passed. They are recorded as investigated harness mismatches; the screenshots and independent result fields support the actual outcomes. Receipt replay can legitimately read “not verified” in an evidence drawer *before* the separate Verify-stage replay occurs.

## Source provenance

- [Final release integration commit](https://github.com/Kush110807/JoinWitness/commit/483fc95807df59528ccd4ea5e2541018b6f80966)
- [Frozen Commerce HQ approval record](docs/HQ_G1_FREEZE_2026-11-01.md) (path from repository root; see corrected link below)
- [G3 backend integration evidence](docs/G3/G3_INTEGRATION_EVIDENCE.md) (path from repository root)
- [Commerce contract](docs/COMMERCE_CONTRACT.md) and [API examples](docs/COMMERCE_API_EXAMPLES.json): frozen normative bytes, preserve exact identities.
- The owner has a local archive \`JW_G4_ATLAS_R2_RELEASE_EVIDENCE.zip\` containing **38 screenshots, eight browser reports, three probe texts and an index**, but that archive is **not** publicly committed here.
- The submission package also exists locally outside this repository; GitHub links do not automatically expose those files.

## Reproduce rather than assume

Run Python and frontend tests using [Windows setup](SETUP_AND_LAUNCH_WINDOWS.md). Start the server on loopback and compare actual Case A/B results. An observer should record date, environment, commit, command, exit code, test totals and raw browser artefacts.

Do **not** interpret a fixture-manifest digest as live AI evidence; the source and review digests are data-integrity/reproducibility controls, not signatures or assertions about real people.

## Known limitations

- Public deployment remains blocked by missing production authentication, isolation, rate limiting and security review.
- Meta local harness exists but the shipped demonstration did **not** demonstrate live model inference.
- This record does not replace official hackathon submission confirmation, which requires an externally reachable repository URL and a three-minute video.

**Contract hygiene:** The frozen \`docs/COMMERCE_CONTRACT.md\` still contains a historical “NOT FROZEN” draft header from its authoring phase. The separate HQ freeze record supersedes that status; changing the contract text would break its exact-byte identity. Do not rewrite the contract header.