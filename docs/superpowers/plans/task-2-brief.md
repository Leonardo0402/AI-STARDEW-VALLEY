# Task 2: Truthful artifact and outcome states

## Where this fits

This is Task 2 of Issue #25 (Swarm Office V1.1 follow-up). Task 1 added linked selection. This task ensures artifact, task, and review outcomes are rendered exactly as data says, without invented content.

## Requirements

Files to modify:

- `packages/control-ui/src/ControlPanel.tsx` — artifact card state classification and rendering
- `packages/control-ui/src/components/intents.ts` — add `revision_required` / `rejected` distinct intents if missing
- `packages/control-ui/src/theme.css` (or `apps/demo-office/src/theme.css`) — add rework / rejected / unavailable styles
- `packages/pixel-office/src/presentation-state.ts` and renderers — truthful agent posture mapping
- `packages/pixel-office/src/renderer/effect-renderer.ts` — add rework cue for revision_required artifacts

Behavior:

- `revision_required` renders a rework cue (red-flag clipboard, "rework" badge) distinct from `rejected`, `blocked`, and `failed`.
- `rejected` renders as a decision outcome, not a runtime failure.
- `blocked` agents keep slumped posture + red pulse + speech bubble; panel card shows blocker reason when available.
- `failed` agents/tasks render only when backed by real Runtime/session or domain failure state.
- Artifact cards explicitly represent these content states:
  - `content-available` — `content` or `uri` present and openable
  - `metadata-only` — no `content` and no `uri`
  - `unavailable` — `uri === null` (explicitly unavailable)
  - `loading` — open command in flight
  - `failed-open` — `ARTIFACT_OPEN` command returned an error
  - `unsupported-open` — adapter does not support `ARTIFACT_OPEN`
- Do not label `artifactId` as a URI.
- If an artifact lacks a content reference, show metadata-only/unavailable UI; do not invent content.

## Constraints

- Do not change protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport.
- Keep PR relationship: Issue #25 Refs #14.
- Follow TDD: write the failing test first, watch it fail, then implement.

## Verification

New/updated tests:

- `packages/control-ui/src/ControlPanel.test.tsx` — revision_required artifact shows rework badge; rejected shows distinct rejected badge; unavailable shows unavailable message; unsupported disables View button with correct title
- `packages/pixel-office/src/__tests__/agent-renderer.test.ts` — blocked agent renders blocked posture/speech bubble; failed agent only renders when status is failed
- `packages/pixel-office/src/__tests__/effect-renderer.test.ts` — revision_required produces rework cue

All existing tests must still pass. `npm run build` must pass.

## Report

Write a report to `docs/superpowers/plans/task-2-report.md` with status (DONE or BLOCKED), commits, test summary, and any concerns.
