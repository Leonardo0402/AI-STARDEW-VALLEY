# Task 4: Tests and verification

## Where this fits

This is Task 4 of Issue #25 (Swarm Office V1.1 follow-up). Tasks 0–3 implemented the follow-up work. This task verifies that all new behavior has failing-first tests and the full suite stays green.

## Requirements

- Confirm every new function/method added in Tasks 1–3 has at least one test.
- Confirm each test was written before the implementation (per TDD) and observed to fail for the expected reason.
- Run the full test suite: `npm test -- --run`
- Run the production build: `npm run build`
- Run the visual QA pipeline: `node scripts/capture-demo-office-screenshots.mjs` and `node scripts/generate-annotated-comparisons.mjs`
- Verify GitHub CI `build-test` workflow passes (if you can trigger/check it locally; otherwise note the limitation).

## Constraints

- Do not change behavior just to make tests pass; only fix real regressions or missing coverage.
- Keep PR relationship: Issue #25 Refs #14.

## Verification

- `npm test -- --run` passes (target: 58+ test files, all green).
- `npm run build` passes.
- Screenshot and annotation scripts succeed.
- No uncommitted test-only or debug code remains.

## Report

Write a report to `docs/superpowers/plans/task-4-report.md` with status (DONE or BLOCKED), test counts, build result, script results, CI status, and any concerns.
