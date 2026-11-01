# JW-T09A — First real four-stage JoinWitness browser vertical slice

**Authority:** JW-RD-3.0 FINAL, especially Sections 3–6, 8–11, 14–16. It supersedes any conflicting suggestions in this ticket.
**Pinned Git base:** `e956eae91b8779b36520295cecfa34dbae6708b6`.
**Single writer:** Meta Muse Code `muse-spark-1.3`, Standard/non-Contributor mode. Do not use `--yolo`; retain approvals and sandbox. Owner alone commits/pushes.
**Objective:** Build the **smallest genuine, four-stage fictional-flagship browser vertical slice** in React/Vite/TypeScript, with all calculations and verification obtained from existing FastAPI endpoints. Do not implement general manual-review editing, public Meta access, or broad polish in T09A: those are separate bounded T09 follow-ups. This ticket is a vertical slice, not JW-T09 final acceptance.

## Preflight (STOP on failure)
1. Confirm `git rev-parse HEAD` is exactly the pinned SHA. `git status --porcelain` must be clean **except for the new, untracked `docs/tickets/JW-T09A.md` containing this ticket** (when supplied by the owner). Any other change: STOP.
2. Confirm `node --version`, `npm --version`, and existing `.venv` Python interpreter. Do not reinstall Python, change global execution policy, or edit accepted code.
3. Inspect `backend/api.py`, `backend/meta_api.py`, `src/joinwitness/policy.py`, `src/joinwitness/baseline.py`, `fixtures/flagship_flip/*`, `docs/CONTRACTS_T08A.md`, `docs/CONTRACTS_T08B.md` before choosing any API payloads. They are authority; do not invent response fields.
4. If untracked work appears or a package would overwrite files, STOP and report rather than reset, delete, or stash.

## Allowed writes
- NEW `frontend/**` (Vite React + TypeScript source, config, tests, locally copied fictional demo fixtures). Build output and `node_modules` must remain ignored via existing `.gitignore` or an explicitly proposed minimal ignore change after owner review; do not commit these directories.
- NEW `docs/tickets/JW-T09A.md`, NEW `docs/CONTRACTS_T09A.md` for exact implemented scope/evidence. You may reuse/replace this task file if installed under docs/tickets.
- **No edits** to `backend/**`, `src/joinwitness/**`, `tests/**` (Python), `fixtures/**` originals, `.env*`, `pyproject.toml`, `requirements-*.txt`, existing `docs/STATUS.md` or `docs/DECISIONS.md`, and no remote services. If backend limitations are found, stop and return a minimal concrete defect report rather than silently changing backend.

## Frontend scaffold
- Use React + Vite + TypeScript, locally, Node 22-compatible, with a pinned `package-lock.json`.
- Local Vite dev proxy `/api` to `http://127.0.0.1:8000`; all ordinary workflow HTTP requests use relative `/api/...` paths. No CORS alterations and no exposure outside 127.0.0.1.
- No UI libraries or icon packages requiring paid keys; choose a small maintainable dependency set. No backend/Meta API secrets in browser files or `VITE_*` environment variables.
- High craft: clear type hierarchy, calm neutral base + one purposeful accent, strong visible focus, mobile layout, reduced-motion support, accessible contrast. No fake analytics graphics, fabricated solver results, excessive motion, Apple logos or implied affiliation.
- Show the product insight immediately: “One uncertain identity link can change the answer.” Include provenance qualifier: permitted reviewed alternatives; no claim to real identity truth.

## Four-step requirements — real data, no canned computational outputs

### Import — What are we comparing?
- For T09A, provide a prominent **Try fictional demo** action that fetches byte-identical bundled copies of `fixtures/flagship_flip/registrations.csv` and `attendance.csv` and calls `POST /api/parse` with Base64 exact source bytes. Display real row counts and previews. Check that copied fixture hashes match originals.
- Display clear **CSV upload coming in a later T09 ticket** limitation rather than fake file upload behavior; do not build the general upload/mapping surface yet.
- Present group source, fictional-data statement and explanation that external Meta AI is separate/optional. Switching/reloading demo invalidates all review, analysis and receipt state.

### Review — Which links are legitimately possible?
- Call actual `POST /api/suggest`; distinguish deterministic `UNREVIEWED_SHORTLIST` from reviewed permissions, expose the partial-coverage caveat and Kim/Kym alternatives. Do not infer any permission from shortlist membership.
- Show the **actual frozen fictional `review_policy.json` and `reference.json` as labeled example drafts**, including each ID-pair status, unmatched rule, A/B group and the reference choices. User must explicitly click **Adopt these fictional demo review decisions and baseline** to proceed. This action is adoption of an already-authored synthetic policy, **not evidence the model or the user independently verified real identities**. No implicit auto-accept on page load.
- Send exactly the fixture's `jw.review.v1` and `jw.reference.v1` JSON via `POST /api/review/validate`, store returned `review_sha256`, `review_revision`, `reference_sha256`, and baseline counts. Display validation errors. General editable permissions, manual candidate additions, unmatched edits and baseline picker are **deferred to T09B** and must not be simulated here. Disable analysis if adoption/validation fails.

### Challenge — Could the conclusion reverse?
- Show the **fixed** question `Did Group A have more attendance records than Group B?`, actual reference A/B and true/false status only after backend review validation.
- Explicit Run Challenge button sends `POST /api/analyze` with original Base64 bytes, policy, complete reference, exact `expected_review_sha256` and `expected_revision`.
- Render verified structured results only. Flagship should display 2 A / 1 B → 1 A / 2 B, minimum changed assignments 1, only if returned by backend; highlight actual changed row T-02. Stable, witness-only, inconclusive, errors and coverage caveats must each have truthful distinct copy. No client-side invented minimum proof.

### Verify — Can anyone reproduce it?
- `POST /api/receipt` with same frozen analysis request and show returned verification fields. Offer JSON download of the actual API receipt (not fabricated receipt content).
- `POST /api/verify` with receipt, source and policy, show actual `VERIFIED_REPLAY` response and qualifications. Display checker, solver and oracle roles distinctly; SHA-256 is NOT a digital signature.
- Provide a helpful offline replay command template as a **command to run locally with saved original files**, never falsely imply the browser directly ran that CLI. Show the exact downloaded receipt file name and local source dependencies.
- Analysis/receipt state must clear on any changes to source, group, review, unmatched policy or baseline; no stale verdict presentation.

## Meta boundary — explicit non-goal for T09A
- **DO NOT call `/api/meta/suggest` from this browser ticket.** The current route has a secret and a synthetic-only, one-attempt developer gate. A browser-distributed token would be a security defect; do not store it in JS, localStorage, or `VITE_*`.
- Display an honest optional AI status in Review: genuine Meta inference has been proved separately, but the browser opt-in integration is pending a separately approved secure bridge (T09B/T11). The deterministic manual workflow MUST work without Meta.
- Do not change `backend/meta_api.py`, open CORS, or introduce a public credential proxy to make a button appear functional.

## Tests and actual evidence
1. `npm install` only in `frontend`; record exact Node/npm/React/Vite versions; lock dependencies. `npm run build` and `npm test` must succeed (add at least unit/component tests for source state invalidation, exact request shape, status labels, no implicit permission or acceptance, and failure states).
2. Run `..\.venv\Scripts\python.exe -m pytest -q` from project root (previously 300 passed). Do not suppress warnings, skip failed tests or modify Python fixtures.
3. Run Uvicorn on 127.0.0.1:8000 in one terminal and Vite on 127.0.0.1:5173 in another; open Chrome and execute real fictional flagship Import → Review → Challenge → Verify; capture screenshot/evidence of every stage. Verify that clearing/restarting demo removes old verdict; editable review and stable-case browser tests remain for T09B.
4. Report actual API statuses/fields including failed review adoption and receipt error; no fake data or hardcoded success values. Check keyboard-only tab flow, focus, mobile viewport (375px), and reduced motion; report anything unrun.
5. `git diff --check` and `git status --short --untracked-files=all`; report exact changed-file list. Confirm NO `.env`, keys, `node_modules`, build artifacts or generated receipts staged.

## Stop conditions and handoff
- Max one implementation attempt plus one bounded fix from real test evidence. If an API contract makes a stage impossible, return blocking exact location and failing command instead of changing backend.
- Do not commit, push, deploy, add public hosting, start Meta inference, create a simulated proof, or modify math/backend contracts.
- Return: file-by-file change summary, actual commands and test stdout, key screenshots/URLs, known defects or unfinished states, and explicit GO/HOLD recommendation for JW-T09A only. Do not call JW-T09 DONE until full browser/accessibility and genuine opt-in Meta UX gates are satisfied.
