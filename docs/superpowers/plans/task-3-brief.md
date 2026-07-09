# Task 3: Visual QA hardening

## Where this fits

This is Task 3 of Issue #25 (Swarm Office V1.1 follow-up). Tasks 1 and 2 added linked selection and truthful artifact states. This task turns the screenshot pipeline into a current-state regression gate.

## Requirements

Files to modify:

- `scripts/capture-demo-office-screenshots.mjs`
- `scripts/generate-annotated-comparisons.mjs`
- `docs/design/swarm-office-v1.1/gap-audit.md`
- `docs/design/swarm-office-v1.1/baseline/`
- `docs/design/swarm-office-v1.1/annotated-comparisons/`

Behavior:

- Capture baseline sets for 1366×768, 1440×900, and 1920×1080.
- Include existing 8 states plus:
  - selected agent on canvas + highlighted panel card
  - hovered/selected task or artifact card
  - artifact metadata-only / unavailable / unsupported-open state
  - runtime degraded state if the adapter can truthfully produce it
  - runtime failed state only if the adapter can truthfully produce it; otherwise document the limitation
- Add script-level assertions:
  - each PNG width equals the viewport width for the resolution
  - each PNG height equals the viewport height (or fullPage height if fullPage remains enabled)
  - page `scrollWidth <= clientWidth` for the target viewport (no horizontal overflow)
- If a state cannot be truthfully produced by the mock adapter, skip it with a logged reason rather than fabricating it.
- Regenerate annotated comparisons from the 1440×900 baseline with current-gap labels.
- Update `gap-audit.md` with a "Resolution pass" section and any newly discovered per-resolution gaps.

## Constraints

- Do not change protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport.
- Do not fabricate states the mock adapter cannot truthfully produce.
- Keep PR relationship: Issue #25 Refs #14.

## Verification

- Running `node scripts/capture-demo-office-screenshots.mjs` succeeds and asserts dimensions/overflow.
- Running `node scripts/generate-annotated-comparisons.mjs` succeeds.
- `npm test` and `npm run build` pass.

## Report

Write a report to `docs/superpowers/plans/task-3-report.md` with status (DONE or BLOCKED), commits, test summary, and any concerns.
