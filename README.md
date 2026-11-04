# JoinWitness

**Can a conclusion survive uncertainty in the records used to reach it?**

JoinWitness is an experimental decision-robustness auditor for uncertain record linkage. It asks a narrower, more testable question than whether a dataset is simply “clean”: *within an explicitly reviewed set of possible links, could a different admissible assignment change the decision?*

The project was developed for the **Meta Global AI Developer Hackathon 2026**. It is a local research prototype using fictional data, not a hosted service or a general-purpose entity-resolution product.

**Maintainer:** Kushaagra Gupta · **Verified application release:** [`483fc95`](https://github.com/Kush110807/JoinWitness/commit/483fc95807df59528ccd4ea5e2541018b6f80966) · **Current status:** [Release notes](docs/RELEASE_STATUS.md)

## The question

An order can have a delivery recorded against the wrong reference. One attendance entry can plausibly refer to two registrations. In either case, the reported total can be correct **for the chosen links** while remaining fragile to an alternative permitted interpretation.

JoinWitness retains that uncertainty instead of quietly resolving it. A reviewer defines the candidate relationships and an original reference assignment. The system then searches for the smallest admissible change that would overturn the decision, and checks the resulting counterexample separately.

This is **conditional robustness**, not a claim to determine which ambiguous relationship is true.

## What can be examined

| Investigation | Decision under test | Observed result in the fictional demo |
| --- | --- | --- |
| **Commerce** — orders, payments, deliveries, refunds | Are at least **K = 2** of three orders cleanly fulfilled? | A permitted reassignment of delivery **D2: O2 → O3** changes **2/3 → 1/3**. `REVERSED_EXHAUSTIVE`; minimum **1** change; independent checker `PASSED`. |
| **Event** — 60 attendance records, 90 registrations | Does the original Group A lead survive the reviewed identity alternatives? | **32:28 → 30:30** under two permitted changes, including **T-49** and **T-52**. `REVERSIBLE_MINIMUM_PROVEN`, with a **solver-attributed** minimum of 2. |

Both outcomes depend on a specific frozen reference, policy and bounded candidate set. The event result is a **tie**, not a win for Group B. The commerce alternative is a **counterexample**, not an assertion that its reassignment is the correct real-world match.

## Method in brief

1. **Preserve the source.** Validate bounded CSV inputs; fingerprint source bytes and parsed records.
2. **Make permissions explicit.** Distinguish raw reference hints and candidate suggestions from links a reviewer actually permits. Human adoption, baseline selection, policy freeze and attestations are separate actions.
3. **Challenge the decision.** Explore admissible assignments under the frozen policy. Commerce uses bounded exhaustive enumeration; the event investigation uses an OR-Tools CP-SAT model with separate small-case oracle tests.
4. **Check the witness.** Recompute the proposed decision-changing assignment independently of the search routine. Do not infer a proof of global optimality merely from a valid witness.
5. **Preserve evidence.** Record proof basis, scope, source and review digests, and a receipt that supports stateless replay. A SHA-256 receipt is an integrity check, **not a digital signature**.

The formal statement, scope bounds, and proof qualifications are in [Methodology](docs/METHODOLOGY.md).

## Decision Atlas

The interface follows four stages: **Import → Review → Challenge → Verify**.

The central uncertainty field connects source records to reviewed possibilities. A selected-record inspector provides context, an outcome lens compares the reference decision with an admissible counterexample, and an evidence drawer exposes the checker and proof qualifications. An inspected possibility never becomes authorised merely because somebody clicked it.

The two investigations intentionally share a visual language **without pretending to share the same proof algorithm**. Some Import, Verify and Event Review surfaces retain earlier interface styling; the verified release prioritises the inspectable Challenge and Commerce Review scenes.

## Repository map

| Where | What it contains |
| --- | --- |
| [`frontend/`](frontend/) | React, TypeScript, Vite, Decision Atlas components and frontend tests |
| [`backend/`](backend/) | Local FastAPI HTTP boundary, event routes, commerce router and restricted Meta suggestion harness |
| [`src/joinwitness/`](src/joinwitness/) | Validation, policy, search, independent checking and receipts |
| [`fixtures/`](fixtures/) | Fictional examples, boundary cases and adversarial test inputs |
| [`tests/`](tests/) | Python tests, including solver/oracle parity and commerce contract checks |
| [`docs/`](docs/) | [Methodology](docs/METHODOLOGY.md), [design decisions](docs/DESIGN_NOTES.md), frozen contracts and dated engineering record |
| [`scripts/`](scripts/) | Local verification and synthetic-data generation helpers |

The [documentation index](docs/README.md) separates the **current reading path** from historical implementation tickets and original contracts. Those earlier files are retained for provenance, not presented as the current status of the application.

## Reproduce the local demonstration

The verified configuration runs the backend on **127.0.0.1:8001** and the frontend on **127.0.0.1:5178**, with a same-origin development proxy and no public ingress.

Start with [Windows setup and launch](docs/SETUP_AND_LAUNCH_WINDOWS.md). The [demo storyboard](docs/DEMO_STORYBOARD.md) follows the two investigations in under three minutes. A public URL to the running application is **not** provided.

**Reported release evidence:** 452/452 backend tests, 146/146 frontend tests, a successful TypeScript/Vite build and eight real-Chrome journeys across four desktop/mobile viewports. These were locally executed and reported during release preparation; they have **not** been independently reproduced in public CI. The [verification record](docs/VERIFICATION_MANIFEST.md) documents the source, interpretation and known probe limitations.

## AI use and authorship

I led the problem framing, product decisions, permitted-authority model, visual reviews and final acceptance process. I used development assistants—including **Meta Muse Code** and **ChatGPT**—for implementation and review support. The repository retains the engineering history and the tests used to check the result; it should not be read as a claim that every line was written manually or that all outputs received an independent external audit.

The released application is **offline-first**. Its Meta suggestion boundary is present in the code, but **live Meta Model API inference was not demonstrated in the verified release**. When unavailable, the interface reports `AI_UNAVAILABLE` and the deterministic investigation continues. Model suggestions, when present, are not permissions.

## Limits of the claim

- All data in the examples are fictional. Real identification or reconciliation accuracy has not been established.
- A negative robustness finding applies only to the reviewed finite candidate universe; excluded possibilities can change the result.
- The event solver's attributed minimum and the commerce exhaustive minimum carry **different** proof qualifications.
- The local API is not hardened for public deployment: authentication, multi-user isolation and durable abuse controls require additional work.
- No production service, live-model inference or third-party security certification is claimed.

See the [research and design notes](docs/DESIGN_NOTES.md) for the decisions behind those boundaries.

**Licence:** No open-source licence has been selected. Public source visibility is not permission to redistribute or reuse it. Third-party packages retain their own licences.
