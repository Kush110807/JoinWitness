# JW-T09-INT-00 — Frozen Baseline, Functional Gap & Design Contract Audit

**Execution authority:** `JW-RD-3.0 FINAL` and `JW_T09_INTEGRATED_PRODUCT_EXPERIENCE_SPEC_V1.md`. **Task type:** READ-ONLY, bounded, one Muse Code session. This is the first slice of one integrated programme, not another open-ended redesign.

## Objective
Before modifying UX03, establish exactly what exists, what is missing against the integrated four-stage experience contract, and which front/back-end contracts need a separately approved ticket. Avoid overwriting untracked T09 work or accidentally pointing the browser at stale Vite output.

## Repository / pinned authority
- Worktree: `C:\JW-Muse-T09` (isolated clone; do not edit `$HOME\Projects\JoinWitness`).
- Accepted integrated Git base expected: `e956eae91b8779b36520295cecfa34dbae6708b6`.
- Current UX03 source is uncommitted and **not** an accepted Git revision. Obtain an immutable SHA-256 manifest of relevant local files and copy/backup them **outside the repository** to a new dated local folder. Preserve original byte contents.
- Authoritative product source is `JW-RD-3.0 FINAL`; do not override mathematically scoped verdicts with agent-generated copy.

## Authorized operations
1. Read `docs/tickets/JW-T09-INT-00.md`, `docs/specs/JoinWitness_JW_RD_3_0_FINAL_REFERENCE.md` (the full original owner directive), and `docs/specs/JW_T09_INTEGRATED_PRODUCT_EXPERIENCE_SPEC_V1.md` completely. Where they conflict, the original owner directive prevails.
2. Read `frontend/src/App.tsx`, `.css`, frontend tests, `frontend/src/lib/api.ts`, `backend/api.py`, `backend/meta_api.py`, contracts T08A/T08B/T09 and existing user-supplied UX03 browser evidence if available.
3. Run local read-only `git rev-parse HEAD`, `git status --short --untracked-files=all`, `git diff --stat`; if Muse sandbox Git fails, report UNVERIFIED without global `safe.directory` edits and use Python/PowerShell read-only file inventory.
4. Compute SHA-256 manifest for all tracked/added T09 sources, fixtures and docs; include latest served CSS status if the Vite server is running. If the server is absent, record `NOT_TESTED` rather than starting public services.
5. Produce *in the Muse response* a concise traceability table for Import, Review, Challenge, Verify and Meta showing: required user action, current UI component, actual API route, current coverage, blocker, proposed permitted files, and a positive/negative test.
6. Produce a compact **one-page product wireframe** in Markdown/text and a design-token map according to the integrated specification, not a new competing style exploration.
7. Produce the **exact proposed INT-01 allowlist and tests**, with no source edits.

## Strictly forbidden
- No modifications to tracked or untracked repository source, configuration, test code, fixture bytes or backend.
- No package installs, dependency upgrades, Muse-generated fake screenshots, backend refactors, Meta API requests, Modal/Baseten calls, Git commit/push, deploy or deletion.
- No treating clicking an illustrative link as human review approval; no fake proof or backend result.
- No claim that the browser AI is safe for arbitrary uploaded data; current T08B Meta route is loopback-only and fixture-hash-pinned.

## Expected output and gate
Return: exact HEAD or `UNVERIFIED`; manifest location and hash; old/new worktree inventory; existing UX03 CSS served-versus-on-disk diagnosis if actually tested; functionality gap matrix; precise INT-01 file allowlist; test commands; unresolved blocker list (≤3). All statuses grounded in read operations.

**STOP after producing the inventory and implementation map.** Do not proceed with code just because the audit appears easy. The coordinator will approve the scoped INT-01 ticket after reconciling the evidence.

## Suggested copy/paste owner prompt
> Execute JW-T09-INT-00 only. Read `docs/tickets/JW-T09-INT-00.md`, the full original JW-RD-3.0 directive under `docs/specs/`, and the integrated T09 spec. Inventory and SHA-pin the isolated UX03 source, map exact implemented/missing functionality against existing FastAPI contracts, and return the precise INT-01 allowlist and acceptance tests. No edits, installs, Meta calls, commits, pushes or deployment. Stop after the evidence report.
