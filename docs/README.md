# Reading the JoinWitness repository

This directory contains both the **current release record** and the **development archive**. They serve different purposes. A 28–30 October ticket should not be interpreted as the final November release status.

## Recommended reading path

1. [Project overview](../README.md) — research question, examples, authorship and principal limitations.
2. [Methodology](METHODOLOGY.md) — formal problem, admissible worlds, search procedures, checker and validity boundaries.
3. [Data provenance](DATASETS.md) and [design notes](DESIGN_NOTES.md) — why review authority, uncertainty inspection and proof qualification were designed as they were.
4. [Current release status](RELEASE_STATUS.md) — accepted R2 application lineage and reported local evidence.
5. [Reproduction guide](SETUP_AND_LAUNCH_WINDOWS.md) and [verification manifest](VERIFICATION_MANIFEST.md) — how to rerun the local prototype and how to interpret historical tests.
6. [Demo storyboard](DEMO_STORYBOARD.md) — a short, honest walkthrough.

## Technical record

| Area | Primary record | How to read it |
| --- | --- | --- |
| Event ingestion, review, search and receipt | [T02](CONTRACTS_T02.md), [T03](CONTRACTS_T03.md), [T04](CONTRACTS_T04.md), [T05](CONTRACTS_T05.md), [T06](CONTRACTS_T06.md) | Versioned contracts and provenance for the original event engine |
| Suggestion boundary and local Meta harness | [T07](CONTRACTS_T07.md), [T07B](CONTRACTS_T07B.md), [T07C](CONTRACTS_T07C.md), [T08B](CONTRACTS_T08B.md) | Designed boundaries and development harnesses; not evidence of a live production model |
| Event API | [T08A](CONTRACTS_T08A.md) | Local FastAPI shape, not a public deployment specification |
| Commerce API and mathematics | [Commerce contract](COMMERCE_CONTRACT.md), [API examples](COMMERCE_API_EXAMPLES.json), [subsequent HQ freeze](HQ_G1_FREEZE_2026-11-01.md) | The original contract header reads “draft” because it is historical. **The unchanged bytes were frozen later.** Read the approval alongside the contract; never rewrite its body to update its status. |
| Integration observations | [G3 evidence](G3/G3_INTEGRATION_EVIDENCE.md) | Dated integration checkpoint. Later R2 acceptance is recorded separately. |

## Historical archive

The original [research specification](specs/JoinWitness_JW_RD_3_0_FINAL_REFERENCE.md), [T09 product experience specification](specs/JW_T09_INTEGRATED_PRODUCT_EXPERIENCE_SPEC_V1.md) and [visual/story directive](specs/JW_T09_DEMO_STORY_AND_BRAND_DIRECTIVE_V1.md) document the design progression.

The dated [ticket series](tickets/) and the many `CONTRACTS_T09*` files preserve the route from an initial four-stage slice to the final Atlas experience. Proposals marked `PROPOSED`, `HOLD` or `UNRUN` may have been overtaken by subsequent verification; they are not to be silently re-labelled after the fact.

- [October 29 engineering snapshot](STATUS.md): explicitly historical.
- [October decision register](DECISIONS.md): contemporaneous decisions, retained in sequence.
- [November release status](RELEASE_STATUS.md): the correct starting point for the released build.

## What has *not* been edited for presentation

Frozen contract/API-example bytes, source fixtures, mathematical routines, UI behaviour, tests, and the original ticket/specification narrative remain unchanged by the research-editorial revision. A polished README does not make an unverified experiment verified.

## Evidence interpretation

Distinguish **(a)** source and contract hashes, **(b)** a valid counterexample, **(c)** proof of the smallest counterexample within the bounded model, and **(d)** truth about external records. These are not interchangeable claims. Local test reports support (a–c) in stated scenarios but do not establish (d). See [Methodology](METHODOLOGY.md) and [Verification](VERIFICATION_MANIFEST.md).
