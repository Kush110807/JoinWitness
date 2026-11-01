# JW-T09-DEMO00 — Bounded realistic-example feasibility audit

**Status:** read-only proposal task for Muse; only execute once the owner directs you.  
**Authority:** `JW-RD-3.0 FINAL` > frozen T02–T08 contracts > T09 integrated spec > `JW_T09_DEMO_STORY_AND_BRAND_DIRECTIVE_V1.md`.

## Objective
Determine the **largest honest, practical V1-sized** fictional attendance/registrations demonstration we can support without changing the existing solver or overclaiming scale. Do not implement visual/UI redesign, logo, stress dataset, or benchmarking in this task.

## Workspace and safeguards
- Work in isolated `C:\JW-Muse-T09` only. Check expected T08B base commit `e956eae91b8779b36520295cecfa34dbae6708b6` and report the HEAD; never assume tree clean because 28+ paths are intentionally untracked.
- Verify external T09 backup exists. Do not modify application code or any files during audit. No installs, network requests, Meta calls, commits, pushes, deployments or config edits.
- Read original RD §§03–05, 16, 19, current backend request limits, T09 source, INT-01 FIX01 ticket, and integrated T09 spec.

## Required output (directly in Muse response; no file writes)
1. Exact current parser/API size/row/candidate/time limits and code locations; whether standard-mode supports 60/90 or 100/150 inputs **without modification**.
2. Original 3/4 fixture, stable/two-change/inconclusive fixtures and actual available input-generation/evaluation tooling; note what can/cannot be reused.
3. Practical synthetic demo design under the observed limits: deterministic seed, count range, policy/candidate shape, one-to-one conflicts, valid baseline, fixed A>B predicate, candidate coverage qualification. Proposed numbers are targets, not executed measurements.
4. Verification plan: independent checked witness, solver optimality attribution, small-case oracle where valid, receipt replay, how to handle timeout/inconclusive; exact evidence and expected T10 metric schema.
5. Risks: complexity explosion, memory, input size, incomplete candidate coverage, human review burden, performance/timeout, visualization ambiguity. Mark anything not tested as UNRUN.
6. Proposed **separate**, allowlisted T10-EVAL01 implementation ticket and safe owner execution plan. Do not authorise running it yourself.
7. INT-01 FIX01 status and whether T09 UX source is still pending release acceptance. Do not continue into another feature.

## Stop conditions
STOP on source disagreement, a need to change caps/security restrictions, missing necessary files, or unverifiable runtime assumptions. Never claim 48k/50k processing. No changes to original proof fixture or mathematical engine. Final status must be `AUDIT_ONLY`, not `BENCHMARK_PASS`.
