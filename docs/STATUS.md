# JoinWitness — Authoritative Engineering State

> **HISTORICAL SNAPSHOT — 29 October 2026.** This document records the engineering state at that time. It is **not** the current product status: the final audited Decision Atlas R2 release was subsequently integrated and published. See [Current Release Status](RELEASE_STATUS.md) and the [submission README](../README.md). Do not interpret the old "G5 not started" or "current program T07" statements below as describing November 2026. The historical content is retained for auditability.


**As of:** 2026-10-29 IST (reconciled from GitHub commits and owner-supplied Windows output)
**Governing specification:** `JW-RD-3.0 FINAL` (28 October 2026), superseding earlier proposals.
**Last integrated commit:** `7d1fecb4cd75f22ebe961194053e75c6846d87a2` (`main`, T07A).
**Current program:** T07 incomplete; complete remaining T07 obligations before T08.
**Owner authority:** user alone approves expenses, public deployment, repository publication and submission. GitHub pushes below were explicitly performed by the owner.
**Accuracy:** “integrated” means committed and pushed, not deployed or proved in every environment.

## Accepted, evidenced local engineering work

| Ticket | Integrated Git commit | Owner-supplied Windows evidence | Scope of acceptance |
|---|---|---|---|
| JW-T01 | `59cff91e60ab2faff00ab115f0ea4a41c6be9aec` | Git, Node, npm, Python 3.13 virtualenv, VS Code and Muse 1.4.14 working; GitHub push verified | **Local tooling/repository PASS only**. Organizer-specific rules and credit/no-overage verification **OPEN**. |
| JW-T02 | `8734752dad361c3c6348138d763e54a76d829298` | 53/53 tests; flagship CSV ingestion 4 registrations, 3 attendance, raw/parsed digests | Strict `jw.dataset.v1` ingestion; not matching/analysis. |
| JW-T03 | `6630f4d21bff9599e52ac37a5deb5abd949003f3` | 106/106 cumulative tests; reviewed frozen reference A=2, B=1 | `jw.review.v1` and reference contract; no reversal calculated. |
| JW-T04 | `2fa5ded45bd1fa30dbdd44a3b2427beac5410b81` | 133/133 cumulative tests; exhaustive flagship minimum 1, two-change minimum 2 | Small explicitly reviewed candidate universes, not real-world identity completeness. |
| JW-T05 | `ec082d8e64e8c8a80db0a0eca88e450d863d9146` | 148/148 cumulative tests; CP-SAT flagship OPTIMAL 1, two-change OPTIMAL 2, stable INFEASIBLE | Solver-attributed results only; independently unchecked at T05. |
| JW-T06 | `971cf17c4036e4fe34823aa62a95c89f7d121f1b` | 196/196 cumulative tests; flagship `WITNESS_VALID` / `VERIFIED_REPLAY`; modified receipt rejected with `RECEIPT_DIGEST_MISMATCH`, exit 2 | Independent checker, small-case oracle and replay for flagship. SHA-256 is not a signature. See open end-to-end demonstration gaps below. |
| JW-T07A (part of JW-T07) | `7d1fecb4cd75f22ebe961194053e75c6846d87a2` | 225/225 cumulative tests, 0 skipped reported; offline fixture yields four `UNREVIEWED_SUGGESTIONS`, no human permissions, `NOT_RUN` analysis | Strict offline suggestion parser and disabled-by-default Meta transport adapter **only**. **No authentic Meta call**. |

This table reflects owner-submitted screenshots and commit verification. It is not independent reproduction of the entire test suite in a clean Windows clone. The T04/T05/T06 results are mathematical claims **only within the explicit reviewed model**.

## Binding GO / HOLD gates (JW-RD-3.0 §20)

| Gate | Disposition | Remaining evidence/condition |
|---|---|---|
| G0 — accounts, event rules, expenses | **PARTIAL / METERED HOLD** | Authenticated organizer details still unverified; Meta dashboard showed $150 active credits, a linked payment card and ₹0.12 recorded spend; there is no verified zero-overage cap or confirmed Muse/Standard credit deduction. Baseten $100 award notice and Modal $101 dashboard do not prove a live paid capability. |
| G1 — frozen valid problem | **TESTED LOCAL** | Accepted T02–T03 input/review/reference validators. |
| G2 — deterministic mathematical truth | **TESTED LOCAL; RELEASE EVIDENCE INCOMPLETE** | Oracle/solver parity demonstrated and tested. End-to-end stable and explicit timeout/inconclusive operator demonstrations should be recorded before calling the entire offline demo gate GREEN. |
| G3 — replayable evidence | **TESTED LOCAL; RELEASE EVIDENCE INCOMPLETE** | Flagship replay plus negative checksum tamper observed; also record stable-case replay and a modified source/policy replay rejection. |
| G4 — genuine Meta model inference | **HOLD** | T07A is an offline fixture. Deterministic shortlist, approved real `muse-spark-1.3` Standard request, captured usage/latency/request metadata, schema/failure evidence and owner-approved billing gate remain. |
| G5 — four-stage browser UX | **NOT STARTED** | React/Vite Import → Review → Challenge → Verify, responsive/accessibility/browser smoke and truthful state labels. |
| G6 — runtime/deployment | **NOT STARTED** | FastAPI single-origin/modal CPU, secrets/limits/fresh-session URL, or recorded offline fallback. |
| G7 — submission | **NOT STARTED** | Authorized participant requirements, reproducibility, video, actual submission and confirmation. |

## Next controlled execution sequence (unchanged from JW-RD-3.0 §16)

1. **JW-LEDGER-01:** reconcile only this file and `docs/DECISIONS.md` against Git evidence; no production code/network. Owner checks resulting diff and commits.
2. **JW-T07B (offline):** implement the missing deterministic candidate shortlist and source-bound prioritization/provenance; explicitly preserve T02–T07A authority boundaries. Add hostile CSV-cell, ranking, cap/truncation and fail-closed tests. One writer, bounded allowlist. No Meta call.
3. **JW-T07 live gate:** only after the owner authorizes a bounded synthetic Standard-mode Meta request and confirms acceptable financial/privacy exposure. Capture real response, model/usage/latency/request ID when available, actual credit spend delta and no automatic retries. If unsafe: record `BLOCKED`, never fake a success.
4. **JW-T08 → T09 → T10 → T11 → T12:** FastAPI orchestration, React/Vite UX, measured evaluation, Modal CPU deployment or honest fallback, and submission. No replacement architecture unless owner approves a documented exception.

**Mandatory offline demonstration gap:** T06 contract additionally requires flagship, two-change and stable receipts to create/replay, and the original handoff requires a stable state and error/timeout state. The code may cover these in tests; end-to-end owner evidence remains incomplete. Do not rewrite this gap as PASS on test count alone.

## Scope/budget/deadline controls

- **Authority:** JW-RD-3.0 FINAL > typed input/review/solver invariants and observed test evidence > implementation > product copy > generated prose.
- **Source of truth:** Git + this status + append-only decision history + raw owner outputs; never an unverified chat claim.
- **One writer:** Muse Code preferred after financial approval. Prior local ZIP generation was a documented temporary offline implementation exception, not a change of architecture.
- **No spend:** ₹0 extra cash authorized. No live Meta, Baseten or Modal call/deployment by default. No key, secret or personal CSV in logs/commits.
- **Deadline baseline:** public working assumption November 5, 2026, 07:30 IST; authenticated participant terms may supersede. **Internal freeze target:** November 4, 2026, 18:00 IST.
- **Remaining focused hours:** UNKNOWN — no supported current tally; avoid inventing one. Preserve a final six-hour submission reserve.
- **Current repository:** no website, no complete UI, no authenticated Meta inference and no live Modal deployment demonstrated.
