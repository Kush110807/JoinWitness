# JoinWitness — Current Public Release Status

**Last verified application release:** [`483fc95807df59528ccd4ea5e2541018b6f80966`](https://github.com/Kush110807/JoinWitness/commit/483fc95807df59528ccd4ea5e2541018b6f80966)  
**Decision Atlas:** audited R2 (`d100eebc9151bba748b322b9f5b1d08f92cd711c`), merged into G4 without changing the protected engines.  
**Public branch:** `main` (later commits contain submission documentation).  
**Status as of 5 November 2026:** Local, fictional-data prototype. Public GitHub source exists. No production deployment; no demonstrated live Meta Model API inference. Hackathon video and submission confirmation are separate owner actions.

## Demonstrated local functionality

- **Case A:** 60 attendance / 90 registration synthetic event; 12 ambiguities; source-defined 32:28 baseline can become 30:30 with two authorised identity changes (`REVERSIBLE_MINIMUM_PROVEN`). Case A proof claims retain their solver-attributed qualification.
- **Case B:** four fictional commerce CSVs; at reviewed K=2, permitted delivery D2 reassignment O2→O3 changes clean fulfilment 2/3→1/3 (`REVERSED_EXHAUSTIVE`) with minimum one change, independently checked.
- **Experience:** React/TypeScript four-stage workflow (Import → Review → Challenge → Verify), Decision Atlas uncertainty constellation, source-linked record inspector, outcome lens, evidence drawer, receipt export/replay. Some Import/Verify and Event Review presentation remains earlier-style rather than fully unified.
- **Human authority:** inspected and suggested candidates cannot silently become permitted relationships; explicit adoption/attestation/revision control remains in place.
- **Offline Meta boundary:** Muse Code was genuinely used during development, but the final local application reports `AI_UNAVAILABLE` / `OFFLINE_ONLY`. Meta live suggestion harness is not evidence of a successful inference call.

## Local validation reported with release

| Area | Outcome |
|---|---|
| Backend | 452/452 tests passed |
| Frontend | 146/146 tests passed, TypeScript and Vite build successful |
| Real Chrome | 8/8 scripted journeys marked successful across desktop and mobile |
| Receipt | `VERIFIED_REPLAY` reproduced for both cases |
| Safety | loopback-only development release, no production authentication/public hardening |
| Evidence | screenshots, browser reports and probes retained in owner-held local release evidence archive; not necessarily committed publicly |

These are owner/Muse-reported local results and are **not an independently reproduced CI run or a security certification**. Three brittle text probes were reported false, investigated separately; see [verification manifest](../VERIFICATION_MANIFEST.md).

## Public documentation

- [README](../README.md)
- [Windows setup and launch](../SETUP_AND_LAUNCH_WINDOWS.md)
- [Three-minute demo storyboard](../DEMO_STORYBOARD.md)
- [Verification manifest](../VERIFICATION_MANIFEST.md)
- [G3 integration evidence](G3/G3_INTEGRATION_EVIDENCE.md)
- [G1 HQ frozen contract approval](HQ_G1_FREEZE_2026-11-01.md)

## Historical file interpretation

- [`docs/STATUS.md`](STATUS.md) is **an October 29 historical snapshot**, not a current project-status or authoritative release statement.
- [`docs/DECISIONS.md`](DECISIONS.md) is an append-only historical decision register; its T07 next-step language reflects October 2026.
- [`docs/COMMERCE_CONTRACT.md`](COMMERCE_CONTRACT.md) contains an original draft header. Its bytes were later formally **frozen** via [HQ approval](HQ_G1_FREEZE_2026-11-01.md); **do not edit the frozen contract header** to make its historical prose look current.
- `frontend/index.html` and `frontend/package.json` retain T09A identifiers from the initial product iteration, but `frontend/src/` contains the latest R2 implementation.
- `frontend/vite.config.ts` retains the historical 8000/5173 local defaults. Reproduce the verified release using the **disposable 8001/5178 proxy config** described in the Windows setup guide.

**No source-code change is required to establish the application lineage.** Public documentation may be maintained after the verified runtime release while preserving the exact 483fc95 application identity.
