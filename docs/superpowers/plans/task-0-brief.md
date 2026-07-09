# Task 0: Current-state evidence cleanup

## Where this fits

This is the pre-flight step for Issue #25 (Swarm Office V1.1 follow-up). Issue #23 was implemented by PR #24, closing the first visual pass. Issue #14 remains the parent epic. Before adding new UI behavior, we must stop working from the pre-PR #24 audit and establish a current-state baseline.

## Requirements

Files to modify:

- `docs/design/swarm-office-v1.1/gap-audit.md`
- `scripts/generate-annotated-comparisons.mjs`

Specific changes:

1. Rewrite `gap-audit.md`:
   - Move pre-PR #24 findings ("idle canvas is blank black", "mode switcher is plain text", "rooms are flat color blocks", "agent is a generic block", etc.) into a new "Historical V1.0 → V1.1 delta" section.
   - Add a "Current-state audit" section listing gaps that remain after PR #24:
     - canvas / control-panel linked selection missing
     - artifact state truth boundaries (revision_required vs rejected vs failed, metadata-only/unavailable content)
     - multi-resolution layout hardening (1366×768 legibility, 1920×1080 space usage)
     - selected / hovered state capture missing from visual QA
     - runtime degraded / failed state capture limited by mock adapter capability
   - Add an explicit "Accepted deviations" note: the mock adapter cannot independently trigger a genuine runtime `failed` / runtime-error state; screenshots for those states are only captured if the adapter truthfully supports them.
   - Canonicalize screenshot paths: multi-resolution folders (`baseline/1366x768`, `baseline/1440x900`, `baseline/1920x1080`) are the source of truth; old flat `baseline/` files must stay gone.
   - Keep the V1.1 verification section but make sure its claims match the current code.

2. Update `scripts/generate-annotated-comparisons.mjs`:
   - Replace stale annotation labels with current-gap labels.
   - Each of the 8 baseline states should be annotated with what is still missing or what needs hardening, not with what was already fixed in PR #24.
   - Keep the 1440×900 baseline as the source image.

## Constraints

- Do not change protocol, reducer, LifeSimEngine, RuntimeSession, or UI component logic in this task.
- Only documentation and annotation script changes.
- Keep PR relationship intact: this work is part of Issue #25, which Refs #14.

## Verification

- `npm test` passes.
- `npm run build` passes.
- `gap-audit.md` no longer describes already-fixed V1.0 gaps as current gaps.
- `generate-annotated-comparisons.mjs` produces HTML files with current-gap annotations.

## Report

Write a report to `docs/superpowers/plans/task-0-report.md` with:
- Status (DONE or BLOCKED)
- Commits
- Test summary
- Any concerns
