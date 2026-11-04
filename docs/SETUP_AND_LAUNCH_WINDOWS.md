# Reproducing JoinWitness on Windows

This guide reproduces the **local fictional-data prototype**, not a public service. The application code was accepted at [commit `483fc95`](https://github.com/Kush110807/JoinWitness/commit/483fc95807df59528ccd4ea5e2541018b6f80966). Later public commits may contain documentation changes.

**Expected arrangement:** FastAPI on `127.0.0.1:8001`; React/Vite on `127.0.0.1:5178`; frontend routes `/api` through a same-origin development proxy with `changeOrigin: false`.

## Prerequisites

- Windows with PowerShell, Git, Node.js 22.12 or newer, and npm.
- Python 3.12 with the `py -3.12` launcher (the Python package declares >=3.11; 3.12 is the recommended reproduction environment).
- A browser such as Chrome. No Meta API key, cloud service or commercial credit is required.

Use *separate terminals* for installation, backend and frontend. Do not bind a server to `0.0.0.0`.

## Install dependencies

From a directory of your choosing:

```powershell
git clone https://github.com/Kush110807/JoinWitness.git
Set-Location .\JoinWitness

git merge-base --is-ancestor 483fc95807df59528ccd4ea5e2541018b6f80966 HEAD
if ($LASTEXITCODE -ne 0) { throw "The tested release is not in this branch history." }

py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e . -r requirements-api.txt -r requirements-solver.txt
.\.venv\Scripts\python.exe -m pip install pytest==9.0.2

Set-Location .\frontend
npm ci
```

The optional `requirements-meta.txt` is **not required** for the offline release. Do not enable live inference or place credentials in repository files for this exercise.

## Run tests before starting the demo

In the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
Set-Location .\frontend
npm test
npm run build
```

Historical local release evidence reported **452 backend** and **146 frontend** passing tests. Treat new test output as a fresh observation; a failure on your machine should be reported, not overwritten by the historical numbers.

## Start the backend

Open a new PowerShell terminal in the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.api:app --host 127.0.0.1 --port 8001
```

Verify `http://127.0.0.1:8001/api/health`. The local health response should identify the API as `OFFLINE_ONLY` and not production-deployment ready.

## Start the frontend

The tracked `frontend/vite.config.ts` retains older development defaults (frontend 5173 and API 8000). The accepted R2 browser run used **5178 / 8001**. Rather than rewriting the tracked config, make a disposable copy.

In a second PowerShell terminal, change into `frontend`:

```powershell
Copy-Item .\vite.config.ts .\vite.submission.local.config.ts
$path = (Resolve-Path .\vite.submission.local.config.ts).Path
$config = Get-Content -LiteralPath $path -Raw

if ($config -notmatch 'http://127\.0\.0\.1:8000' -or $config -notmatch 'changeOrigin:\s*false') {
    throw "Unexpected Vite proxy settings; do not bypass the local request boundary."
}

$config = $config.Replace("http://127.0.0.1:8000", "http://127.0.0.1:8001")
[System.IO.File]::WriteAllText($path, $config, (New-Object System.Text.UTF8Encoding $false))

.\node_modules\.bin\vite.cmd --config vite.submission.local.config.ts --host 127.0.0.1 --port 5178 --strictPort
```

Open **http://127.0.0.1:5178/**. Confirm the backend terminal is still running. Stop Vite normally when finished and remove the temporary file only after it exits:

```powershell
Remove-Item .\vite.submission.local.config.ts
git status --short
```

The worktree should remain clean. The temporary config is not part of the checked release and must not be committed.

## Repeat the two demonstrations

**Commerce:** Select the fictional four-source example (or the four files in `fixtures/commerce_demo/`). Inspect the delivery alternatives. Set K=2, explicitly grant permissible links, baseline and attestations, and adopt the review before Challenge. The accepted policy produces `REVERSED_EXHAUSTIVE` with delivery **D2: O2 → O3**, **2/3 → 1/3**, minimum **1**, checker `PASSED`. Export a receipt and check its `VERIFIED_REPLAY` response.

**Event:** Open the bundled 60/90 synthetic example, adopt the prepared review policy, run Challenge, then issue and replay its receipt. The reported event change is **32:28 → 30:30** after two permitted identity changes; the minimum is **solver-attributed** and the alternative is a **tie**.

No action on either screen should automatically approve an AI suggestion. The unavailable Meta transport is presented as `AI_UNAVAILABLE`.

## Common failures and safeguards

| Symptom | Check |
| --- | --- |
| Browser reports 404 on port 5173 | Use the Vite-printed URL, normally **5178** in this guide |
| Commerce request returns 403 | Preserve `changeOrigin: false` and the expected loopback/origin request boundary |
| Another service owns a port | Inspect the owning process; **do not kill unrelated worktrees or services** |
| HTTP 409 `STALE_STATE` | The review epoch changed; re-import or restart rather than overriding the revision |
| No model suggestions | Expected offline behaviour; run deterministic review instead |
| Source digest mismatch | Compare exact file bytes and line endings; do not “fix” protected fixtures |

The API is **local-only**; this setup is not a deployment recipe. Receipts establish consistency of recorded inputs and policy, not a digital signature or factual validation of an ambiguous real-world link.

See [Methodology](METHODOLOGY.md), [Data](DATASETS.md) and the [short demo plan](DEMO_STORYBOARD.md).
