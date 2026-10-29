# JW-T08A — Local stateless API around T02–T06

**Pinned commit:** `f81eba8f8221d4afee6bd69a1024214491a03cfd`.
**Authority:** JW-RD-3.0 FINAL; no architecture pivot.
**Writer:** one local owner-controlled application of candidate package; no autonomous push.
**Allowed files (all new):** `backend/__init__.py`, `backend/api.py`, `requirements-api.txt`, `tests/test_api.py`, `docs/CONTRACTS_T08A.md`, `docs/tickets/JW-T08A.md`.
**Forbidden:** modifying `src/joinwitness/*`, `pyproject.toml`, accepted previous tests, policy/reference fixtures, credential files, GitHub settings or cloud services.

### Implement
- Local `GET /api/health` and six bounded POST APIs as in the contract.
- Explicit review SHA/revision freshness; fail closed on stale, incomplete or tampered input.
- Solver→checker→oracle→receipt remains real imported functions, never synthetic simulated results.
- Offline deterministic suggestions only; do not create review edges from AI.
- No persistent state, public network exposure, Meta/Modal/Baseten calls, or unexpected expenses.

### Required evidence
- Clean pinned repository, package allowlist, all original and new Windows tests, no skips.
- At least flagship `REVERSIBLE_MINIMUM_PROVEN` and stable `STABLE_WITHIN_REVIEWED_POLICY` through the API, receipt/replay of original source bytes, tamper and stale negative controls.
- A local loopback HTTP health response using Uvicorn; no live/public deployment claim.

### Stop
Incorrect HEAD, dirty worktree, archive checksum mismatch, unexpected overwrite, changed math files, skipped/failing Windows tests, any HTTP response claiming identity truth from heuristic suggestions, any exposed public/remote listener, or any metered API call.
