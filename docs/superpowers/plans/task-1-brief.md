# Task 1: Canvas / control-panel linked selection

## Where this fits

This is Task 1 of Issue #25 (Swarm Office V1.1 follow-up). Task 0 established the current-state audit. This task adds bidirectional, presentation-only selection between the pixel canvas and the React control surface.

## Requirements

Files to modify:

- `apps/demo-office/src/App.tsx` — add selection state and wire callbacks
- `apps/demo-office/src/useComposedOfficeState.ts` or a new local hook — keep selection out of Runtime state
- `apps/demo-office/src/ControlPanel.tsx` — accept selection props, highlight cards, support keyboard/list selection
- `packages/pixel-office/src/office-scene.ts` — expose selection API
- `packages/pixel-office/src/renderer/agent-renderer.ts` — render selected/highlight outline
- `packages/pixel-office/src/renderer/room-renderer.ts` — render selected/highlight outline
- `apps/demo-office/src/ListView.tsx` — support selecting entities from list view

Selection shape:

```ts
interface OfficeSelection {
  kind: "agent" | "task" | "artifact" | "approval" | "room";
  id: string;
}
```

Behavior:

- Selecting an agent on the pixel canvas highlights the matching agent card in the panel and scrolls it into view.
- Selecting a task/artifact/approval card in the panel highlights the related agent(s) and/or room on the canvas when the relation exists.
- Selecting a room highlights the room and relevant active agents.
- Selection is presentation-only; no commands are sent and no Runtime/LifeSim state changes.
- Selection survives Command ↔ Focus ↔ Debrief mode switches and Pixel ↔ List view switches as long as the selected entity exists.
- Selection clears only on:
  - explicit "Clear selection" action,
  - Reset / adapter reset,
  - entity disappearance from the projection.
- Provide a keyboard-accessible path: Tab into the panel cards, Enter/Space to select, Escape to clear.
- Highlight must not be color-only (add outline, ring, or label change).
- In List view, selecting an entity row highlights it and, when switched back to Pixel view, the canvas shows the same selection.

## Constraints

- Do not change protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport.
- Selection must never mutate Runtime Snapshot, LifeSim state, commands, reducers, or domain facts.
- Keep PR relationship: Issue #25 Refs #14.
- Follow TDD: write the failing test first, watch it fail, then implement.

## Verification

New/updated tests:

- `apps/demo-office/src/App.test.tsx` — selection state survives mode/view switches and clears on Reset
- `apps/demo-office/src/ControlPanel.test.tsx` — clicking a card calls onSelect; selected card has highlight attributes
- `packages/pixel-office/src/__tests__/office-scene.test.ts` — calling scene.selectAgent / scene.selectRoom renders highlight outline
- `apps/demo-office/src/ListView.test.tsx` — list selection highlights row and is reflected externally

All existing tests must still pass. `npm run build` must pass.

## Report

Write a report to `docs/superpowers/plans/task-1-report.md` with status (DONE or BLOCKED), commits, test summary, and any concerns.
