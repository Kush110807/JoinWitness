# JW-T07B — Bounded implementation instruction and acceptance

**Authority:** JW-RD-3.0 FINAL, original T07 deterministic-shortlist requirement.
**Base:** `5f7446a31d7fc205be3c1fb0a49f05a7cc12b0a3`, clean worktree.
**Writer:** one offline patch, owner applies and tests in Windows; one-writer offline exception recorded in JW-D-004. Muse not required while metered billing HOLD.

## Allowed files

- New `src/joinwitness/candidates.py`.
- New `tests/test_candidates.py`.
- **Replace with reviewed candidate bytes** `src/joinwitness/meta_suggestions.py` (bounded shortlist consumption and response pair admission only).
- New `docs/CONTRACTS_T07B.md`.
- New `docs/tickets/JW-T07B.md`.

## Forbidden modifications

T02–T06 code, all existing fixtures, `src/joinwitness/suggestions.py`, existing T07A tests, `docs/STATUS.md`, `docs/DECISIONS.md`, repo history, credentials, environment, billing or cloud services. **No `muse` call, no Meta inference, no push/deploy** in this candidate.

## Positive, adverse and failure coverage

1. Flagship exactly four candidates; Kim/Kym ambiguity preserved.
2. Repeated names remain separate ID pairs; stable deterministic ranking and digest.
3. No matches and capped candidates visibly report incomplete scope.
4. Unicode casefold and source digest checks; frozen input, input-size limits unaffected.
5. Hostile CSV values remain inert data; no implicit reviewer permission.
6. Mock transport accepts supplied pairs, rejects known-but-unsupplied IDs; original live spend gate still blocks all unauthorized calls.

## STOP

Failing or skipped Windows tests, unexpected base commit/status, any file beyond allowlist changed, existing file checksum mismatch, ambiguous package bytes, unexpected paid request, leaked secret, false completeness or approval claim.

## Required return

`python -m pytest -q`, flagship `joinwitness.candidates` CLI output, `--per-row-limit 1` CLI output, `git diff --check`, `git status --short --untracked-files=all`, and SHA-256 of modified adapter. **No commit until owner and coordinator approve.**
