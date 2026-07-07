# Issue #25: Swarm Office V1.1 follow-up — linked selection, artifact truth, and current-state visual QA

## Context

Issue #23 was implemented by PR #24, closing the first Swarm Office V1.1 visual pass (canvas foundation, role sprites, mode polish, revision/failed naming correction, and multi-resolution screenshot capture).

Issue #14 remains open as the parent V1.1 epic. This plan covers the remaining #14 work that PR #24 deliberately left out.

## Goal

Make the pixel canvas and control panel behave as one selectable surface, ensure artifact/task states are rendered truthfully without invented content, and turn visual QA into a current-state regression gate.

## Global constraints

- Scope is strictly:
  - `apps/demo-office`
  - `packages/pixel-office`
  - `scripts/`
  - `docs/design/swarm-office-v1.1/`
- Do not change protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport. If a feature truly needs protocol support, create a separate protocol-proposal issue first.
- Selection is presentation-only. It must never mutate Runtime Snapshot, LifeSim state, commands, reducers, or domain facts.
- `artifactId` is not a URI. Missing content reference must render metadata-only / unavailable / unsupported-open; never fabricate content.
- The final PR description must use `Closes #25` and `Refs #14`. Do not close #14 unless every #14 acceptance criterion is explicitly satisfied.

## Task 0: Current-state evidence cleanup

Before adding new UI behavior, clean up stale audit annotations so the team is working from the current product state rather than pre-PR #24 gaps.

Files: `docs/design/swarm-office-v1.1/gap-audit.md`, `scripts/generate-annotated-comparisons.mjs`

Requirements:

- Rewrite `gap-audit.md` so pre-PR #24 findings (e.g., "idle canvas is blank black", "mode switcher is plain text") are moved to a "Historical V1.0 → V1.1 delta" section.
- Add a "Current-state audit" section that lists remaining gaps after PR #24: linked selection, truthful artifact states, multi-resolution layout, selected/hovered state capture, runtime degraded/failed capture limitations.
- Update `generate-annotated-comparisons.mjs` annotation labels to describe current gaps, not already-fixed V1.0 gaps.
- Add an explicit "Accepted deviations" note documenting that the mock adapter cannot independently trigger a genuine runtime `failed` / runtime-error state, so screenshots for those states are only captured if the adapter truthfully supports them.
- Canonicalize paths so multi-resolution folders (`baseline/1366x768`, `baseline/1440x900`, `baseline/1920x1080`) are the source of truth and the old flat `baseline/` files stay deleted.

Verification:

- `npm test` still passes after documentation-only changes.
- `npm run build` passes.

## Task 1: Canvas / control-panel linked selection

Implement bidirectional, presentation-only selection between the pixel scene and the React control surface.

Files:

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

Requirements:

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

Verification:

- New/updated tests:
  - `apps/demo-office/src/App.test.tsx` — selection state survives mode/view switches and clears on Reset
  - `apps/demo-office/src/ControlPanel.test.tsx` — clicking a card calls onSelect; selected card has highlight attributes
  - `packages/pixel-office/src/__tests__/office-scene.test.ts` — calling scene.selectAgent / scene.selectRoom renders highlight outline
  - `apps/demo-office/src/ListView.test.tsx` — list selection highlights row and is reflected externally
- All existing tests still pass.

## Task 2: Truthful artifact and outcome states

Make artifact/task/review outcomes exact and non-invented.

Files:

- `apps/demo-office/src/ControlPanel.tsx` — artifact card state classification and rendering
- `apps/demo-office/src/components/intents.ts` — add `revision_required` / `rejected` distinct intents if missing
- `apps/demo-office/src/theme.css` — add rework / rejected / unavailable styles
- `packages/pixel-office/src/presentation-state.ts` and renderers — truthful agent posture mapping
- `packages/pixel-office/src/renderer/effect-renderer.ts` — add rework cue for revision_required artifacts

Requirements:

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

Verification:

- New/updated tests:
  - `apps/demo-office/src/ControlPanel.test.tsx` — revision_required artifact shows rework badge; rejected shows distinct rejected badge; unavailable shows unavailable message; unsupported disables View button with correct title
  - `packages/pixel-office/src/__tests__/agent-renderer.test.ts` — blocked agent renders blocked posture/speech bubble; failed agent only renders when status is failed
  - `packages/pixel-office/src/__tests__/effect-renderer.test.ts` — revision_required produces rework cue
- All existing tests still pass.

## Task 3: Visual QA hardening

Turn the screenshot pipeline into a current-state regression gate.

Files:

- `scripts/capture-demo-office-screenshots.mjs`
- `scripts/generate-annotated-comparisons.mjs`
- `docs/design/swarm-office-v1.1/gap-audit.md`
- `docs/design/swarm-office-v1.1/baseline/`
- `docs/design/swarm-office-v1.1/annotated-comparisons/`

Requirements:

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

Verification:

- Running `node scripts/capture-demo-office-screenshots.mjs` succeeds and asserts dimensions/overflow.
- Running `node scripts/generate-annotated-comparisons.mjs` succeeds.
- `npm test` and `npm run build` pass.

## Task 4: Tests and verification

Ensure all new behavior has failing-first tests and the full suite stays green.

Requirements:

- Every new function/method has a test.
- Each test was watched to fail for the expected reason before implementation.
- Full `npm test` passes (target: 58+ files, all green).
- `npm run build` passes.
- GitHub CI `build-test` passes.

## Task 5: Final review and PR

- Run final whole-branch review using the code-reviewer template.
- Fix any Critical/Important findings.
- Create PR with `Closes #25` and `Refs #14`.
- Wait for CI green, then merge.
- Delete the feature branch.

## Acceptance criteria (roll-up)

- [ ] PR starts with current-state evidence cleanup, not stale annotations.
- [ ] Linked selection works for agents, rooms, tasks, artifacts, and approvals when relationships exist.
- [ ] Selection is presentation-only and preserves Runtime/LifeSim truth boundaries.
- [ ] Selection survives mode/view switches and clears only on explicit clear, Reset, or entity disappearance.
- [ ] `revision_required`, `rejected`, `blocked`, and `failed` are visually distinct on canvas and panel.
- [ ] Artifact cards truthfully represent content available, metadata-only, unavailable, loading, failed-open, and unsupported-open states as supported by current data.
- [ ] Visual QA covers required resolutions and does not claim impossible states.
- [ ] Screenshot script includes dimension and overflow assertions.
- [ ] `gap-audit.md` reflects current post-PR #24 state and remaining gaps.
- [ ] `npm test`, `npm run build`, and GitHub CI pass.
- [ ] PR description uses `Closes #25` and `Refs #14`; #14 stays open unless all its acceptance criteria are satisfied.
