# G3 Local Integration Evidence (HQ)

Date: 2026-11-01/02. Branch `g3/integration`, base
`b8a34e1ba1fa583f958964782c580b5caad35606`. Local work only: no push,
no deploy, no Meta calls, no manifest changes, no B/C/D worktree edits,
no original-workspace edits.

## 1. Commits (all local)

| Commit | Full SHA | Content |
|---|---|---|
| B merge | `713aaaebcd6f7c9b887b6258c9da8b1402092ad1` | `--no-ff` merge of `g2/b-commerce` @ `18f74908658031a9a8ced781da265097dce91c01` |
| C merge | `500751607039ed8b9b68874700f17e3129a34c85` | `--no-ff` merge of `g2/c-atlas` @ `734a2607e03d3526f604b32c08fbaa204848b5ab` |
| Router | `51c5e54c608293bcf7d0260dace19d5b315a39cb` | HQ-owned `backend/api.py` +4 lines (below) |
| Evidence | (this commit) | this file + `scripts/g3_*.py` verification tools |

B/C tips re-verified unchanged after merging (no history rewrite).
`git diff b8a34e1..HEAD --name-only` = exactly 49 files (35 B + 14 C);
zero matches on frozen contracts, `backend/api.py`, manifests,
`fixtures/demo60_90`, engine, results, scripts, frontend configs.
Frozen blob ids at HEAD unchanged (`63fa35b…`, `417cf3d…`).

## 2. Preflight

- Branch tips B/C and base SHA: exact match to mission values.
- Tree clean on `g3/integration` before merging.
- Frozen B03 blobs (git-blob bytes): `COMMERCE_CONTRACT.md`
  139929 bytes `7fcfbed0…ba1af`; `COMMERCE_API_EXAMPLES.json`
  104527 bytes `5aac810f…518148` — both match `docs/HQ_G1_FREEZE_2026-11-01.md`.
  (Working-tree copies are CRLF-expanded by 1 byte/line; blobs are canonical.)
- Separation: original `C:\JW-Muse-T09` + backups untouched; B/C/D isolated
  worktrees untouched (read-only inspection only); G3 held no B/C files pre-merge.
- D acceptance reproduced from branch tip `0054498` (C02 PASS 110/110, G3 GO).

## 3. Router change (only shared-backend edit)

`backend/api.py` +4 lines, mirroring the existing meta-router pattern:

```python
# G3 HQ-owned integration: register the B-owned commerce.v1 router as-is.
from .commerce_api import commerce_router
app.include_router(commerce_router)
```

Uses B's actual `commerce_router` export. No Case A route, exception
handler, guard or behaviour touched. Prefix `/api/commerce/v1` is
collision-free against all 8 existing routes (verified in route table).

## 4. Verification results (all executed, loopback-only)

Environments: `C:\JW-G3-INTEGRATION\.venv` (new, pinned
`requirements-api/solver.txt` + pytest, OR-Tools 9.15.6755),
`frontend/node_modules` (fresh `npm ci`, 163 packages).
User's original-workspace servers own ports 8000/5173 (left untouched);
G3 served on 127.0.0.1:8001, Vite on 127.0.0.1:5174 with an equivalent
proxy target (temp config, removed after).

- Backend pytest: **452 passed, 0 failed** (19.72s), incl. the 5 Case A
  API tests and 13 solver-parity tests D had to skip/fail without OR-Tools.
  In a D-comparable no-OR-Tools env: 5 failed / 434 passed / 13 skipped,
  identical to D's `pre_b_fullsuite.txt` baseline (environmental, not a
  regression).
- Frontend vitest: **110 passed (8 files)**, 37.44s — reproduces C02.
  `tsc --noEmit` clean. `vite build` succeeds (2.21s).
- Live HTTP (`scripts/g3_commerce_http_verify.py`): **16/16 PASS** —
  Case A health + 8+6 route table + Case A parse smoke; commerce
  parse→suggest(AI_UNAVAILABLE)→review→challenge→receipt→replay;
  frozen K=2 `15204132…` → REVERSED_EXHAUSTIVE,
  frozen K=1 `0c298a4f…` → STABLE_WITHIN_SCOPE;
  repeated adoption rev (2,2) same sha; stale 409 STALE_STATE;
  dup-key 422, bool-K 422.
- Vite proxy (`scripts/g3_proxy_smoke.py`): **4/4 PASS** — index,
  Case A health + parse, Case B parse (bundle `e7a87bc2…`) via proxy.
- Case A 60/90 rerun (`scripts/g3_casea_60_90_rerun.py`): **PASS** —
  verdict/proof/changed(2) and full receipt core equal
  `results/demo60_90_receipt.json`; receipt+verify replay green.
  `receipt_sha256` covers wall-clock `generated_utc`, so it re-hashes
  every run by design (verified: only that field + sha differ).
- Browser acceptance: **UNRUN** — no browser runner in repo or PATH
  (no playwright/puppeteer/vitest-browser; no chrome/edge/firefox binary).

## 5. Known non-blocking exception (recorded, not changed)

Zero-order input (header-only `orders.csv`) returns HTTP 422
`INVALID_VALUE` (live-confirmed); frozen contract §1.1 requires
`LIMIT_EXCEEDED` for the row-count bound. Pre-release **B correction**:
1 line in `src/joinwitness/commerce/source_import.py` (`_check_row_caps`)
+ its pinning test `tests/test_commerce_parse.py:230-235`. Same HTTP
status, fail-closed, no interop impact. Frozen contract untouched.

## 6. Changed-file inventory (tracked, base → this commit)

- `backend/api.py` (+4, router include)
- 35 B files: `backend/commerce_api.py`, `fixtures/commerce_demo*/`,
  `src/joinwitness/commerce/`, `tests/test_commerce_*`
- 14 C files: `frontend/src/components/Commerce*`, `AtlasSwitcher.tsx`,
  `frontend/src/lib/commerce*`, `App.tsx` (+9), `ProductShell.tsx`
- HQ: `scripts/g3_commerce_http_verify.py`, `scripts/g3_proxy_smoke.py`,
  `scripts/g3_casea_60_90_rerun.py`, `docs/G3/G3_INTEGRATION_EVIDENCE.md`

Untracked repro envs (ignored, kept): `.venv/`, `frontend/node_modules/`.
No other tracked or untracked additions. All G3 servers stopped; user's
original-workspace processes untouched. No unresolved blockers.
