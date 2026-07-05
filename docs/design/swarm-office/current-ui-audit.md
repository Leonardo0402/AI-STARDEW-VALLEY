# Swarm Office — Current UI Audit (Phase 0)

> Issue #12 Phase 0 deliverable.
> Captured against the merged remote demo (`npm run dev:remote-demo`) running the Reference Swarm runtime at `http://localhost:3456`.

## Audit scope

This document audits the current technical scaffold before any visual redesign begins. It covers the eight baseline states required by Issue #12, plus the underlying React/Pixi architecture that produces them.

Files audited:

- [`apps/demo-office/src/App.tsx`](../../apps/demo-office/src/App.tsx) — shell layout, mode switching, Pixi canvas mounting.
- [`apps/demo-office/src/StatusStrip.tsx`](../../apps/demo-office/src/StatusStrip.tsx) — runtime/session status bar.
- [`apps/demo-office/src/ListView.tsx`](../../apps/demo-office/src/ListView.tsx) — non-spatial dashboard view.
- [`packages/control-ui/src/ControlPanel.tsx`](../../packages/control-ui/src/ControlPanel.tsx) — command/approval/task surface.
- [`packages/pixel-office/src/office-scene.ts`](../../packages/pixel-office/src/office-scene.ts) — PixiJS spatial renderer.
- [`packages/adapters/qclaw-swarm/src/qclaw-runtime.ts`](../../packages/adapters/qclaw-swarm/src/qclaw-runtime.ts) — reference runtime behavior used for the captures.

Baseline screenshots are in [`./baseline-screenshots/`](./baseline-screenshots/).

## Capture method

- Server: `node scripts/dev-remote-demo.mjs` (Vite + Reference Swarm runtime, ports 5173/3456).
- Browser: Playwright Chromium headless with GPU disabled (`--disable-gpu`, `--disable-software-rasterizer`) to avoid Windows/RTX headless WebGPU hangs.
- Viewport: 1920×1080.
- Script: [`scripts/capture-baseline-screenshots.mjs`](../../scripts/capture-baseline-screenshots.mjs).

| # | Screenshot | Scenario |
|---|------------|----------|
| 01 | `01-idle-office.png` | Idle office, Command mode, pixel view, no tasks. |
| 02 | `02-list-view-idle.png` | Same idle state, list/dashboard view. |
| 03 | `03-active-task.png` | Task created and started via `task.create`; agent assigned, task `running`. |
| 04 | `04-artifact-review.png` | `trigger-artifact-review` endpoint emitted; artifact created/reviewed. |
| 05 | `05-pending-approval.png` | Same state as 04, captured after approval request appears. |
| 06 | `06-focus-mode.png` | Focus mode engaged while approval is pending. |
| 07 | `07-debrief-mode.png` | Debrief mode engaged while approval is pending. |
| 08 | `08-blocked-state.png` | `approval.reject` command issued; task blocked. |

## Per-screen observations

### 01 — Idle office (Command + pixel)

- **Layout:** vertical stack of status strip → top bar → two-column body (canvas left, control panel right).
- **Canvas:** four flat colored rectangles representing rooms (`command`, `execution`, `review`, `approval_delivery`). Room names render as monospace text labels.
- **Agents:** four 32×32 square markers (`Orchestrator`, `Worker-1`, `Worker-2`, `Reviewer`) with small name/status labels. All agents are `idle`.
- **Panel:** experience-mode switcher, task creation inputs, empty agent/task/event lists.
- **Immediate issues:**
  - Rooms are not visually distinguishable by purpose beyond color.
  - Agents in the command room overlap visually when several share a room.
  - Agent markers are abstract squares; role differences are only textual.
  - Canvas has no furniture, walls, or environmental context.

### 02 — List view idle

- **Layout:** same shell, but left stage shows a traditional HTML table dashboard.
- **Content:** summary counts (Agents, Tasks, Artifacts, 待审批, 阻塞) plus Agents/Tasks/Artifacts tables.
- **Strength:** proves the same `OfficeProjection` can be consumed two ways; good debug/operational fallback.
- **Issue:** visually unrelated to the pixel view; switching between the two feels like two different apps.

### 03 — Active task

- **Canvas:** one agent (`Worker-1`) is now in the `execution` room; task card shows `running`.
- **Panel:** task creation form, plus a new task card with status badge.
- **Spatial truth:** agent position maps to `currentRoomId`; task status maps to `task.status`. Both are truthful.
- **Issue:** the "activity" is only visible as a color-coded badge and a room change. There is no visual language for "this task is in progress here".

### 04 / 05 — Artifact review / pending approval

- **Canvas:** a pulsing yellow circle with "审批!" label appears above the task room.
- **Panel:** a new Artifact card and a "待审批 (1)" section with Approve/Reject buttons.
- **Strength:** approval is prominent in the panel and spatially flagged on canvas.
- **Issues:**
  - The pulsing overlay is the only canvas-level approval signal.
  - No relationship drawn between the artifact, the reviewer, and the approval request.
  - Pending approval count is visible, but urgency is conveyed only by color and motion.

### 06 — Focus mode

- **Canvas:** replaced by a minimal HTML indicator showing pending/block/artifact counts.
- **Panel:** unchanged; still shows full controls.
- **Issue:** Focus mode removes the workspace entirely rather than reducing its noise. The distinction between Focus and Command is currently "canvas on/off", not "information density".

### 07 — Debrief mode

- **Canvas:** same minimal indicator as Focus mode.
- **Panel:** unchanged.
- **Issue:** Debrief has no chronological or outcome-oriented presentation. It is functionally identical to Focus mode except for the label.

### 08 — Blocked state

- **Canvas:** red "⚠" blocked reason text overlay appears in the room.
- **Panel:** task card now shows `blocked` badge and blocked reason; approval section is gone because the approval was resolved.
- **Strength:** blocked state is visually distinct from idle/working.
- **Issue:** red text alone may fail color-only accessibility; the spatial marker is text-based and can overlap.

## Findings by dimension

### Visual hierarchy

| Element | Current treatment | Assessment |
|---------|-------------------|------------|
| Runtime health | Status strip at top; small monochrome text | Functional but easy to ignore. Errors use red but are not summarized. |
| Workspace | Large canvas on left, receives most screen real estate | Correct priority, but currently under-utilized artistically. |
| Controls | Panel on right, 420 px fixed | Good width; sections are stacked without strong grouping. |
| Agent status | 8 px monospace label under square | Too small; status meaning is color-only in canvas. |
| Task/approval | Cards in panel with colored badges | Readable, but card density grows quickly. |
| Mode switch | Three small buttons | Equal visual weight; no indication of mode consequences. |

### Information density

- The pixel canvas is information-sparse: four rooms and four agents on an 800×600 surface.
- The control panel is information-dense and grows linearly with agents/tasks/approvals.
- Event log is at the bottom and can become very tall.
- No filtering, search, or collapse in the panel.

### Interaction flow

1. Create task → task appears in panel, agent moves to execution room.
2. Trigger review → artifact appears, approval request appears, pulsing canvas marker.
3. Approve/reject → approval resolved, task completed or blocked.

This flow is truthful and discoverable, but:
- There is no indication that "创建任务" also auto-assigns and auto-starts.
- Approval actions are panel-only; there is no canvas-level interaction.
- Mode switch gives no feedback about what changed or why.

### Accessibility

- **Color-only cues:** agent status, task status, approval urgency all rely on color.
- **Text size:** agent status labels (8 px) and room labels (14 px) are small.
- **Keyboard:** buttons are native, so focusable, but there are no visible `:focus` styles in the inline styles.
- **Reduced motion:** the pulsing approval overlay and agent interpolation run unconditionally.
- **Contrast:** dark theme generally readable, but `#888` hint text on `#1e1e2e` may be marginal.

### Spatial truthfulness

- Agent `currentRoomId` drives position: truthful.
- Movement is interpolated presentation state; it does not rewrite runtime state: truthful.
- Task `roomId` is shown only in list view; in pixel view the relationship is inferred from agent location.
- Approval overlay is tied to task → room: truthful, but visually crude.
- No fabricated state: the UI only renders what `OfficeProjection` provides.

## What must remain functionally unchanged

The following architectural guarantees from Issue #12 must survive the redesign:

1. **Runtime truth is source of truth.** UI consumes `OfficeProjection` and session diagnostics; no runtime facts are invented in React or Pixi state.
2. **Command path is preserved.** All user actions continue through `CommandGateway`; capabilities determine available commands.
3. **Dual views stay consistent.** List view and pixel view are projections of the same snapshot; entity counts and statuses must match.
4. **Modes are behavioral, not decorative.** Command, Focus, and Debrief must have distinct visual and functional consequences.
5. **Pixi lifecycle is safe.** Mount/unmount under React StrictMode must not leak Applications or tickers.
6. **Fallback renderer remains.** The current procedural renderer should stay available as a debug/fallback mode until the visual renderer is stable.
7. **No protocol/core changes for decoration.** Design must not modify `@agent-office/protocol` or `@agent-office/core` merely for visual reasons.

## Input for Phase 1 design brief

Based on this audit, the design brief should explicitly decide:

- How rooms communicate purpose beyond color (furniture, lighting, signage, shape).
- How agents communicate role and status through silhouette, badge, and animation.
- How task activity is shown spatially (progress indicators, tool effects, room occupancy).
- How Focus mode reduces noise without removing the workspace.
- How Debrief mode surfaces chronology, outcomes, and failures.
- How approvals interrupt the user without relying solely on color/motion.
- The minimum desktop width and how the layout degrades to list view.
- Reduced-motion rules and non-color status cues.
- Whether the final asset system will be procedural, sprite-based, or hybrid.

## Appendix: baseline screenshot manifest

| File | Dimensions | Description |
|------|------------|-------------|
| `baseline-screenshots/01-idle-office.png` | 1920×1080 | Idle office, Command mode, pixel view. |
| `baseline-screenshots/02-list-view-idle.png` | 1920×1080 | Idle office, list/dashboard view. |
| `baseline-screenshots/03-active-task.png` | 1920×1080 | Task created and running. |
| `baseline-screenshots/04-artifact-review.png` | 1920×1080 | Artifact created and reviewed. |
| `baseline-screenshots/05-pending-approval.png` | 1920×1080 | Approval request pending. |
| `baseline-screenshots/06-focus-mode.png` | 1920×1080 | Focus mode with pending approval. |
| `baseline-screenshots/07-debrief-mode.png` | 1920×1080 | Debrief mode with pending approval. |
| `baseline-screenshots/08-blocked-state.png` | 1920×1080 | Task blocked after approval rejection. |
