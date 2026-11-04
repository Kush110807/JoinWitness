# JoinWitness — Windows local setup and launch

**Submission source:** [JoinWitness](https://github.com/Kush110807/JoinWitness)  
**Application release:** `483fc95807df59528ccd4ea5e2541018b6f80966` (the current public `main` also includes documentation-only updates).  
**Scope:** local fictional-data demonstration. **Not a public deployment guide.**  
**Provenance:** prepared for repository publication from the versioned source and reported local verification. This is a newly authored reproduction guide, not a copy of the original Windows submission packet.

## Prerequisites

- Windows PowerShell and Git.
- Python **3.12** recommended (project requires Python ≥3.11); `py -3.12` should work.
- Node.js **22.12+** and npm.
- An available loopback interface. Use separate PowerShell terminals for backend and frontend.

The application has **no mandatory live Meta call**. Do not enable `JW_META_LIVE_ENABLED`, supply a paid API key, or expose development routes to the public Internet for this demo.

## 1. Clone and install

In PowerShell:

```powershell
git clone https://github.com/Kush110807/JoinWitness.git
Set-Location .\JoinWitness

# Confirm the verified release is in your public branch's history.
git merge-base --is-ancestor 483fc95807df59528ccd4ea5e2541018b6f80966 HEAD
if ($LASTEXITCODE -ne 0) { throw "Verified release is not an ancestor. STOP." }

py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e . -r requirements-api.txt -r requirements-solver.txt
.\.venv\Scripts\python.exe -m pip install pytest==9.0.2

Set-Location .\frontend
npm ci
```

No `requirements-meta.txt` installation, credentials or cloud account is required for the offline demo.

## 2. Verify the local installation

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
Set-Location .\frontend
npm test
npm run build
```

Previously reported release checks: **452 backend tests**, **146 frontend tests**, and successful TypeScript/Vite build. These are historical local verification results, not a guarantee that a fresh machine will return the same results; record actual output.

## 3. Start the backend

Open a **new** PowerShell terminal in the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.api:app --host 127.0.0.1 --port 8001
```

Open `http://127.0.0.1:8001/api/health`. The expected health payload identifies the local, offline API; the API is intentionally **not** public-hosted.

## 4. Start the frontend with the correct loopback-only proxy

The tracked historical `frontend/vite.config.ts` defaults to backend **8000** and frontend **5173**. The verified R2 demonstration used backend **8001** and frontend **5178**, with `changeOrigin: false`. **Do not edit the tracked config** or change the backend guard.

Open another PowerShell terminal in `frontend` and create a disposable config:

```powershell
Copy-Item .\vite.config.ts .\vite.submission.local.config.ts
$path = (Resolve-Path .\vite.submission.local.config.ts).Path
$cfg = Get-Content -LiteralPath $path -Raw

if ($cfg -notmatch 'http://127\.0\.0\.1:8000' -or $cfg -notmatch 'changeOrigin:\s*false') {
    throw "Unexpected proxy configuration. STOP."
}

$cfg = $cfg.Replace("http://127.0.0.1:8000", "http://127.0.0.1:8001")
[System.IO.File]::WriteAllText(
    $path, $cfg, (New-Object System.Text.UTF8Encoding $false)
)

.\node_modules\.bin\vite.cmd --config vite.submission.local.config.ts --host 127.0.0.1 --port 5178 --strictPort
```

Open **http://127.0.0.1:5178/** in Chrome. Keep both terminal processes running during the demo. If a port is occupied, **investigate before stopping processes**; do not terminate unrelated worktrees.

After stopping Vite, delete only the disposable file:

```powershell
Remove-Item .\vite.submission.local.config.ts
```

Ensure the repository is clean with `git status --short`. Do not commit the temporary config.

## 5. Reproduce the two fictional investigations

**Case B — Commerce:** Open the fictional four-CSV example (or import `fixtures/commerce_demo/orders.csv`, `payments.csv`, `deliveries.csv`, `refunds.csv`). Inspect candidate links. Explicitly review and adopt permitted links, set **K=2**, complete required attestations, and run Challenge. For the approved example policy, the reported result is `REVERSED_EXHAUSTIVE`: a permitted delivery D2 reassignment **O2 → O3** changes **2/3 → 1/3**, with independently checked minimum **1**. Export and replay the receipt.

**Case A — Event:** Open the fictional **60/90** investigation. Adopt the prepared review rules, run Challenge and inspect the reported `REVERSIBLE_MINIMUM_PROVEN` with minimum **2**, **32:28 → 30:30**. Issue and replay the receipt. The witness is conditional on the human-authorised model; it does not establish real-world identity truth.

Both paths intentionally show an `AI_UNAVAILABLE` fallback when no live Meta suggestion service is available. **Nothing is automatically authorised by AI.**

## 6. Security, interpretation and troubleshooting

- **Only** bind backend and frontend to `127.0.0.1`; the Commerce routes enforce a local same-origin/request-header development boundary.
- Do **not** modify `changeOrigin: false`: an origin rewrite can trigger the intended 403 guard.
- Do not place secrets in `.env.example`, Git commits, logs, screenshots or public demos.
- A 404 at `5173` or `5175` does not mean the R2 site is down: use the actual Vite-printed local URL.
- A 409 `STALE_STATE` is an intentional state-safety rejection. Restart/re-import rather than bypassing CAS.
- Receipts provide verifiable consistency/replay, **not digital signatures**.
- No production authentication, durable multi-user quota or public security review is claimed.

See [the demo storyboard](DEMO_STORYBOARD.md) and [verification manifest](VERIFICATION_MANIFEST.md).