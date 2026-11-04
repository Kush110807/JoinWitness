# JoinWitness — Decision Atlas

**Can a decision survive uncertainty in the records behind it?**

JoinWitness is a human-authorised decision-robustness auditor. It makes uncertain relationships between records visible, lets reviewers explicitly define which alternatives are permissible, and tests whether those alternatives could overturn a conclusion.

**Submission release:** [`483fc95807df59528ccd4ea5e2541018b6f80966`](https://github.com/Kush110807/JoinWitness/commit/483fc95807df59528ccd4ea5e2541018b6f80966)  
**Status:** Locally verified prototype using fictional data. **Not** a production or public-hosted service. Live Meta Model API inference is **not** available in the demonstrated application.

## The problem

A delivery may be associated with the wrong order; an attendance record may correspond to more than one registration. A spreadsheet can report the resulting totals, but it rarely tells you whether those totals would hold under other defensible record relationships.

JoinWitness asks a more useful question: **What is the smallest permitted change in the data relationships that would make our conclusion fail?**

## How it works

1. **Import.** Load prepared fictional data or import the supported CSV files.
2. **Review.** Inspect ambiguous records, examine candidate relationships, and explicitly confirm, permit, or prohibit links. Suggestions are not permissions; adopting and freezing a review requires human action.
3. **Challenge.** Search the reviewer-authorised set of possible relationships for a decision-changing alternative. The interface distinguishes exhaustive bounded enumeration from solver-attributed proof claims.
4. **Verify.** Independently check a resulting witness, inspect proof and scope qualifications, and export a receipt that supports stateless verification/replay.

The **Decision Atlas** brings these stages into an interactive experience: a decision narrative, uncertainty constellation, record inspector, original-versus-alternative outcome lens, and evidence drawer. It supports desktop and mobile viewports.

## Working demonstrations

### Case B — Commerce decision

The fictional commerce example imports **four CSVs**: orders, payments, deliveries, and refunds. Under the explicitly adopted review policy and threshold **K = 2**, the accepted baseline has **2 of 3** cleanly fulfilled orders. The engine finds a *permitted alternative* assigning delivery **D2** to **O3** instead of **O2**. This changes the count to **1 of 3**, returning `REVERSED_EXHAUSTIVE`, with a minimum of **one** changed assignment in the bounded search. The independent checker reports `PASSED`; a saved receipt can return `VERIFIED_REPLAY`.

**Important:** The D2 → O3 relationship is a permitted counterexample in fictional data—not an assertion that O3 is the true real-world match.

### Case A — Event decision

The fictional event example uses **60 attendance records**, **90 registrations**, and **12 ambiguous records**. The reported result **32:28** can become **30:30** under two permitted identity reassignments, including **T-49** and **T-52**. The run reports `REVERSIBLE_MINIMUM_PROVEN` with a minimum of **two**, with its stated proof basis and independent witness-checker qualifications. This establishes the disappearance of the original lead, **not** a win for the other group.

All conclusions are conditional on the specific imported records, frozen baseline, reviewed candidate universe and authorised policy. They are **not** universal claims about which relationships are true.

## Architecture

```text
React / TypeScript Decision Atlas
             |
             | same-origin /api requests via local Vite proxy
             v
      FastAPI (loopback only)
             |
    +--------+-------------------------------+
    |                                        |
Case A event engine                  commerce.v1 engine
    |                                        |
OR-Tools CP-SAT search               bounded world enumeration
    |                                        |
    +---------------+------------------------+
                    |
       independent witness checker
                    |
      evidence receipt / stateless replay
```

- **Frontend:** `frontend/` — React, TypeScript, Vite and Vitest.
- **Backend:** `backend/` and `src/joinwitness/` — local API, contracts, search, independent checking, and receipts.
- **Examples:** `fixtures/` — fictional event and commerce datasets.
- **Tests:** `tests/` and frontend `*.test.*` files.
- **Frozen interfaces:** `docs/COMMERCE_CONTRACT.md` and `docs/COMMERCE_API_EXAMPLES.json`.

Case A and Case B use **different search and proof mechanisms**. In particular, a Case A `SOLVER_ATTRIBUTED_ONLY` optimum must not be described as independently exhaustively established. The Case B demo's `EXHAUSTIVE_ENUMERATION_AND_INDEPENDENT_RECOMPUTATION` claim applies only within its bounded, reviewed universe.

## Meta technology: actual usage and limitations

We used **Muse Code, powered by Muse Spark**, as a local development assistant for coding, integration, debugging, tests, and browser-driven verification. Work was divided across isolated Git worktrees and validated with explicit acceptance gates.

The repository also contains a **restricted local-development Meta suggestion harness** (`backend/meta_api.py`) and `requirements-meta.txt` for its SDK dependency. The architecture is designed so that a model may *propose* candidate record relationships, but may not approve, freeze, attest, or verify them.

**The submitted release was verified in `OFFLINE_ONLY` mode with `live_meta_available: false`. No successful live Meta Model API inference was demonstrated.** The UI reports `AI_UNAVAILABLE` when suggestions are unavailable and continues with deterministic review. Muse Code usage during development must not be mistaken for live inference inside JoinWitness.

## Human authority and evidence

- Selecting a candidate is inspection, **not** authorisation.
- Explicit human adoption, review permissions, threshold selection, and attestations are required before challenging a conclusion.
- Revision conflicts fail closed (for example HTTP `409 STALE_STATE`).
- Solver outputs are checked independently, with qualifications about completeness, scope, and proof basis.
- Receipt hashes support integrity and reproducible replay; they are **not cryptographic signatures or proof of real-world truth**.

## Verification summary

The frozen R2 local release was reported to pass:

| Gate | Result |
| --- | --- |
| Frontend unit/integration tests | 146/146 |
| Backend tests | 452/452 |
| TypeScript and production frontend build | Pass |
| Browser journeys | 8/8 across 1440×900, 1728×1080, 390×844, 375×812 |
| Case A / Case B replay | `VERIFIED_REPLAY` |
| Frontend overflow checks | No document horizontal overflow reported |

These are **local test and browser evidence**, not claims of publicly hosted availability or a third-party security certification.

## Run locally

The project requires a supported Python environment and Node.js. The verified application runs with its backend bound to **127.0.0.1:8001** and a Vite frontend bound to **127.0.0.1:5178**, using an API proxy with `changeOrigin: false` to preserve the loopback request security boundary.

The detailed pinned installation, launch, and reproduction instructions are in the accompanying **`SETUP_AND_LAUNCH_WINDOWS.md`** submission document, which must be published alongside this README. The demonstration walkthrough is in **`DEMO_STORYBOARD.md`**, and the test ledger in **`VERIFICATION_MANIFEST.md`**. Do not expose the local backend on a public interface or deploy it without separate authentication, abuse-prevention, and security work.

## Limitations

- The supplied scenarios are fictional. The current import and search bounds are deliberately limited.
- Model suggestions can be unavailable; the deterministic workflow works without them.
- Proof is always relative to an expressly reviewed finite candidate universe.
- The release uses local-development security controls, not production-ready authentication or multi-user isolation.
- The release has no public deployment URL and is intended to be demonstrated locally or through a recording.

## Licence

No open-source licence has been granted unless a licence file is subsequently added. Please review the repository contents and any third-party dependencies before reuse.
