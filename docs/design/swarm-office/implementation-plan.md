# Swarm Office — Implementation Plan (Phase 4)

> Pre-implementation plan for Issue #12. Read this document, design-system.md, and high-fidelity-designs.html. No production code changes until this plan is approved.

## Locked constraints (non-negotiable)

1. **Approval is a visual presentation state only.**
   - No new Runtime `agent.status` value such as `approval` may be introduced.
   - The visual "approval" cue is derived from:
     - `pendingApprovals.length > 0`, and
     - the agent's `currentRoomId` is `review` or `approval_delivery`, and
     - the agent is currently `waiting` / `reviewing` or assigned to a task awaiting approval.
   - Presentation state may never be treated as Runtime truth.

2. **Retry behavior must match real recovery capabilities.**
   - `degraded` session: show **Resynchronize**.
   - `failed` / `disconnected`: show **Retry** only if the Runtime Composition can be rebuilt (`createRuntime(config)` is available and the adapter is reconnectable).
   - Unrecoverable: show **Reload / Restart Runtime** and never an inactive Retry button.

3. **V1 asset scope is intentionally minimal.**
   - 3 roles: Orchestrator, Worker, Reviewer.
   - 3 agent states: idle, working, blocked.
   - 1 walk-cycle animation set.
   - 4 room floor tiles.
   - 4 props: shared desk, workbench, review table, approval counter.
   - 3 effects: service bell, sparkle, blocked marker.
   - Everything else (paused, failed sitting pose, more props, richer animations) is V1.5.

4. **1280×720 is a reference artboard, not the final layout.**
   - Development must be verified at 1366×768, 1440×900, and 1920×1080.
   - At 1366×768 the right panel shrinks to 360 px min; if the canvas cannot fit, fall back to List View.
   - At 1920×1080 the canvas must not be stretched; center or cap max width.

## Architectural principles

- Each stage must leave the app runnable and testable.
- The existing procedural renderer remains the fallback until the sprite renderer is stable.
- Prefer editing existing components over rewriting; introduce new files only when the old abstraction is clearly insufficient.
- No protocol/core changes for visual reasons.
- All new production code follows TDD: failing test first, minimal implementation, refactor.

## Stage 1 — Design tokens and App Shell

### Goal
Establish the global visual foundation: tokens, status strip, app header, and root layout grid.

### Files to modify
- `apps/demo-office/src/index.css` or new `apps/demo-office/src/theme.css`
- `apps/demo-office/src/App.tsx`
- `apps/demo-office/src/StatusStrip.tsx`
- `apps/demo-office/src/App.test.tsx` (if exists) or new tests

### Tasks
1. Add CSS custom properties for all design tokens (color, typography, spacing, radius).
2. Update `StatusStrip` to new visual style: connection pill left, error/diagnostics right.
3. Update `App` root layout to `status + header + body` grid with the new shell dimensions.
4. Add mode switcher UI (Command / Focus / Debrief) in the app header.
5. Wire `experienceMode` state from `App` down to child components.

### Acceptance criteria
- [ ] App compiles and all existing tests pass.
- [ ] Status strip renders connection state and last event correctly.
- [ ] Mode switcher is visible and toggles internal state.
- [ ] Layout matches high-fidelity Command mode artboard at 1920×1080 within 10 px.

### Tests
- StatusStrip shows healthy/disconnected/error states.
- Mode switcher calls `onModeChange` with correct value.

## Stage 2 — Refactor Right ControlPanel

### Goal
Rebuild the right panel using the new card-based, scanable design while preserving all command behavior.

### Files to modify
- `packages/control-ui/src/ControlPanel.tsx`
- `packages/control-ui/src/components/*` (new directory)
- `packages/control-ui/src/ControlPanel.test.tsx` (new or updated)

### Tasks
1. Create reusable panel primitives: `Card`, `Badge`, `SectionHeader`, `ApprovalDrawer`, `TaskForm`.
2. Re-implement agent list, task list, and event log as cards with status badges.
3. Pin pending approvals to the top in an `ApprovalDrawer` with Approve/Reject actions.
4. Apply design tokens: dark surfaces, new typography, focus outlines.
5. Add error banner component that appears when session has an error.

### Acceptance criteria
- [ ] All existing commands still work (create task, approve, reject, etc.).
- [ ] Panel visually matches high-fidelity Command mode.
- [ ] Badges use text labels; color is supplemental.
- [ ] Approval drawer only renders when `pendingApprovals.length > 0`.

### Tests
- ControlPanel renders agents, tasks, approvals, and events.
- Approving/rejecting emits the correct command via `CommandGateway`.
- Error banner visibility depends on session error state.

## Stage 3 — Command / Focus / Debrief Modes

### Goal
Make the three modes functionally and visually distinct.

### Files to modify
- `apps/demo-office/src/App.tsx`
- `apps/demo-office/src/mode-*.tsx` or `packages/control-ui/src/ModeSwitch.tsx`
- New `packages/control-ui/src/FocusPanel.tsx`
- New `packages/control-ui/src/DebriefPanel.tsx`

### Tasks
1. Store `experienceMode` in `App` state ("command" | "focus" | "debrief").
2. In **Command**: render full canvas + full panel.
3. In **Focus**: dim canvas, show ambient metrics overlay, collapse panel to urgent-only approvals.
4. In **Debrief**: replace canvas with timeline view, panel shows session summary + artifacts + decisions.
5. Mode switcher highlights active mode.

### Acceptance criteria
- [ ] Switching modes updates both canvas and panel.
- [ ] Focus mode hides non-urgent controls.
- [ ] Debrief mode shows chronological event timeline derived from `OfficeProjection` history or recent events.
- [ ] List view remains available in all modes.

### Tests
- Mode switching updates UI.
- Focus panel only surfaces pending approvals and blocked states.
- Debrief panel displays artifacts and key decisions.

## Stage 4 — Refactor Pixi Rooms and Agent Renderers

### Goal
Introduce a structured, sprite-ready rendering pipeline without dropping the procedural fallback.

### Files to modify
- `packages/pixel-office/src/office-scene.ts`
- New `packages/pixel-office/src/renderer/*`
  - `room-renderer.ts`
  - `agent-renderer.ts`
  - `prop-renderer.ts`
  - `effect-renderer.ts`
- `packages/pixel-office/src/__tests__/*`

### Tasks
1. Split monolithic scene into layered renderers: rooms, props, agents, effects.
2. Define a `RoomLayout` data structure that maps `roomId` to position, floor type, and prop list.
3. Create `AgentSprite` abstraction that maps `agentId` + `role` + presentation state to visual treatment.
4. Keep procedural fallback renderer intact; add a feature flag to switch between procedural and sprite renderer.
5. Render rooms with distinct floor patterns and wooden sign labels.

### Acceptance criteria
- [ ] Existing tests for `office-scene` still pass with the procedural renderer.
- [ ] Rooms render with distinct visual treatments.
- [ ] Agents render at correct positions based on `currentRoomId`.
- [ ] No Runtime state is invented in the renderer.

### Tests
- Room renderer places four rooms correctly.
- Agent renderer positions agents by `currentRoomId`.
- Procedural fallback still works when sprite renderer is disabled.

## Stage 5 — Minimal Sprite and Prop Assets

### Goal
Add the V1 asset set and wire it into the renderer.

### Files to add
- `packages/pixel-office/assets/agents/*`
- `packages/pixel-office/assets/rooms/*`
- `packages/pixel-office/assets/props/*`
- `packages/pixel-office/assets/effects/*`
- `packages/pixel-office/src/asset-loader.ts`

### Asset list (V1)

| Category | Files |
|----------|-------|
| Agents | Per role (Orchestrator, Worker, Reviewer): `*-idle.png`, `*-walk.png`, `*-working.png`, `*-blocked.png` |
| Rooms | `floor-command.png`, `floor-execution.png`, `floor-review.png`, `floor-approval.png` |
| Props | `desk-shared.png`, `workbench.png`, `review-table.png`, `approval-counter.png` |
| Effects | `service-bell.png`, `sparkle.png`, `blocked-marker.png` |

### Tasks
1. Create 1:1 pixel-grid sprites for V1 assets.
2. Implement `AssetLoader` with progress tracking and fallback to procedural shapes if an asset fails.
3. Wire sprite textures into `AgentRenderer`, `RoomRenderer`, `PropRenderer`, and `EffectRenderer`.
4. Implement walk-cycle animation for moving agents.

### Acceptance criteria
- [ ] App loads assets and renders sprites in Command mode.
- [ ] Missing asset falls back to procedural shape without crashing.
- [ ] Walk animation plays when agent `currentRoomId` changes.
- [ ] Asset file sizes are reasonable (< 10 KB per sprite).

### Tests
- Asset loader resolves textures and reports failures.
- Agent renderer picks correct texture for role + state.
- Fallback renderer activates on load failure.

## Stage 6 — Approval, Blocked, and Error States

### Goal
Implement the key visual states derived from Runtime facts.

### Files to modify
- `packages/pixel-office/src/agent-renderer.ts`
- `packages/pixel-office/src/effect-renderer.ts`
- `packages/pixel-office/src/presentation-state.ts` (new)
- `apps/demo-office/src/StatusStrip.tsx`

### Tasks
1. Create `computeAgentPresentationState(agent, projection)`:
   - `blocked` if agent/task `blockedReason` exists.
   - `working` if agent has a running task.
   - `approval` if `pendingApprovals.length > 0`, `currentRoomId` is `review` or `approval_delivery`, and the agent is waiting/reviewing or assigned to a task awaiting approval (presentation only).
   - `idle` otherwise.
2. Render blocked marker (red exclamation + pulse) for blocked agents.
3. Render service bell pulse above Approval/Delivery room when `pendingApprovals.length > 0`.
4. Render sparkle effect on working agents.
5. Update `StatusStrip` to show session errors with the correct recovery action:
   - `degraded` → **Resynchronize**;
   - `failed` / `disconnected` with rebuildable composition → **Retry**;
   - unrecoverable → **Reload / Restart Runtime**;
   - never render an inactive Retry button or a fake countdown.

### Acceptance criteria
- [ ] Blocked state shows marker + reason tag.
- [ ] Approval bell pulses when pending approval exists.
- [ ] Working sparkle appears only when agent has a running task.
- [ ] Retry button visibility matches session recovery capability.
- [ ] No new Runtime state is created.

### Tests
- Presentation state computation matches the derivation rules.
- Blocked marker renders when `blockedReason` is set.
- Approval bell renders only when `pendingApprovals.length > 0`.
- Retry/Resynchronize/Reload shown in correct session states.

## Stage 7 — Responsive Layout, Reduced Motion, and Keyboard Accessibility

### Goal
Make the UI usable across target resolutions and accessible.

### Files to modify
- `apps/demo-office/src/App.tsx`
- `apps/demo-office/src/index.css`
- `packages/control-ui/src/ControlPanel.tsx`
- `packages/pixel-office/src/office-scene.ts`

### Tasks
1. Implement responsive layout:
   - default panel 420 px,
   - at < 1440 px panel 380 px,
   - at < 1280 px panel 360 px and scale canvas,
   - at < 1024 px auto-switch to List View.
2. Add `prefers-reduced-motion` media query support; disable continuous animations.
3. Add explicit reduced-motion toggle in header.
4. Add visible `:focus` styles to all buttons and inputs.
5. Add `aria-label` to canvas interactive elements.
6. Implement keyboard navigation for mode switcher and approval actions.

### Acceptance criteria
- [ ] UI is verified at 1366×768, 1440×900, 1920×1080.
- [ ] No overlapping agent labels at 1366×768.
- [ ] Canvas is not stretched at 1920×1080.
- [ ] Reduced motion disables all continuous animations.
- [ ] All interactive elements are keyboard focusable.

### Tests
- Responsive breakpoints switch layout correctly.
- Reduced-motion class disables CSS animations and Pixi ticker effects.
- Keyboard navigation triggers approval actions.

## Stage 8 — Visual QA and Screenshot Regression

### Goal
Compare implementation against high-fidelity designs using automated screenshots.

### Files to modify
- `scripts/capture-baseline-screenshots.mjs` (update scenarios)
- New `scripts/visual-qa.mjs`

### Tasks
1. Update screenshot script to capture the new design states:
   - 01-command-mode.png
   - 02-focus-mode.png
   - 03-debrief-mode.png
   - 04-idle-state.png
   - 05-working-state.png
   - 06-approval-state.png
   - 07-blocked-state.png
   - 08-error-state.png
2. Run screenshots at all three target resolutions.
3. Manually compare screenshots to high-fidelity-designs-preview.png.
4. Fix visual discrepancies.

### Acceptance criteria
- [ ] All 8 new screenshots generated.
- [ ] Screenshots visually match the approved high-fidelity designs.
- [ ] No regressions in existing tests.
- [ ] All 291+ tests pass.

### Tests
- Screenshot script runs successfully at 1920×1080.
- Existing remote golden-flow tests still pass.

## V1.5 backlog (not in this plan)

- Additional agent states: paused, failed sitting pose.
- More props: lamps, monitors, coffee cup, books, wall clock.
- Richer animations: agent head expression changes, clipboard page flip, tool rack details.
- More room wall variants.
- Sound effects for approvals and errors.

## Risk control

| Risk | Mitigation |
|------|------------|
| Sprite work takes too long | Procedural fallback stays active; sprites can be added incrementally. |
| Responsive layout breaks Pixi scaling | Cap canvas max width; use CSS containment; test at each breakpoint. |
| Mode switching causes state loss | Lift mode state to `App`; panel and canvas are pure projections. |
| Accessibility audit fails | Build focus/reduced-motion in from Stage 1, not as an afterthought. |
| Runtime state confusion | All presentation state computed in a single pure function with tests. |

## Approval

Approve this plan to begin Stage 1. Each stage will be implemented, tested, and reported before moving to the next.
