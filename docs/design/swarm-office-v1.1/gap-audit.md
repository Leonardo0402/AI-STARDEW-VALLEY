# Swarm Office V1.1 — Gap Audit

> Evidence-based visual/UX gap analysis for `apps/demo-office`.
> Baseline screenshots: `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/`
> Annotated comparisons: `docs/design/swarm-office-v1.1/annotated-comparisons/`
> Reference: `docs/design/swarm-office/design-system.md` + `docs/design/swarm-office/high-fidelity-designs-preview.png`
> PR context: Task 3 of Issue #25; pre-PR #24 findings are now historical. Refs #14.

## Executive summary

PR #24 closed the first Swarm Office V1.1 visual pass. `apps/demo-office` now renders all eight runtime states with rooms, role-differentiated agent sprites, state postures, approval/blocked effects, and mode-specific panels. The remaining work tracked by Issue #25 is interaction and truth-boundary hardening rather than a wireframe-to-visual upgrade.

This audit therefore splits the evidence into two sections:

1. **Historical V1.0 → V1.1 delta** — gaps that existed before PR #24 and are now resolved.
2. **Current-state audit** — gaps that remain after PR #24 and are the focus of Issue #25.

## Historical V1.0 → V1.1 delta (resolved by PR #24)

| # | Pre-PR #24 gap | Resolution in PR #24 |
|---|---|---|
| 1 | Idle canvas was blank black. | Four rooms render in idle: Command (wood planks), Execution (concrete tiles), Review (rug), Approval/Delivery (polished wood), with wall lines and doorway signs. |
| 2 | Mode switcher was plain text. | Header uses a segmented control with `--base-700` track, `--base-600` active fill, and keyboard arrow navigation. |
| 3 | Rooms were flat color blocks. | `RoomRenderer` draws floor textures and patterns per room type; floor texture assets exist for all four rooms. |
| 4 | Agents were generic colored blocks. | `AgentRenderer` uses role-differentiated sprites/procedural silhouettes for Orchestrator, Worker, and Reviewer, with state posture offsets. |
| 5 | Panel cards lacked surface/border hierarchy. | `.panel-card` uses `--base-700` background, `--base-500` border, and `--radius-md`; ApprovalDrawer uses `--urgency` accent. |
| 6 | Approval moment lacked service bell and urgency styling. | Pending approval shows a service-bell marker with pulsing glow, a drawer with `--urgency` left border and bell icon, and primary/danger Approve/Reject buttons. |
| 7 | Blocked agent had no slumped posture or pulse. | `AgentRenderer` applies a `blocked` posture; `EffectRenderer` adds a red pulse glow and speech-bubble exclamation marker. |
| 8 | Revision / rework was visually indistinguishable from idle. | The revision-required path is reachable; reviewer/worker postures, artifact badge intent, and task status communicate rework. |
| 9 | Focus mode did not collapse the right panel. | Focus mode dims the canvas and replaces the full panel with a compact "Urgent Only" view. |
| 10 | Debrief showed a raw event log. | Debrief mode presents a curated "Session Summary" with metrics cards and a "Key timeline" of milestone events. |

## Current-state audit (post-PR #24)

### 1. Canvas / control-panel linked selection

- `App` and `useComposedOfficeState` have no selection state.
- `PixelOfficeScene` exposes no selection API; `AgentRenderer` and `RoomRenderer` do not render selected/hovered outlines.
- `ControlPanel` cards do not accept `onSelect` or highlight a selected entity.
- `ListView` rows are not selectable and do not sync with canvas selection.
- Keyboard selection path (Tab into cards, Enter/Space to select, Escape to clear) is absent.

### 2. Artifact state truth boundaries

- `revision_required`, `rejected`, `blocked`, and `failed` must remain visually distinct on both canvas and panel.
- `ControlPanel` already classifies artifact content by `content`, `uri`, and `uri === null`, but does not render explicit `metadata-only`, `unavailable`, `loading`, `failed-open`, or `unsupported-open` UI states.
- `artifactStatusIntent` maps `rejected` to the `failed` badge intent, which can blur the difference between a decision outcome and a runtime failure.
- `artifactId` is never treated as a URI; missing content references must render as metadata-only/unavailable rather than invented content.

### 3. Multi-resolution layout hardening

- Baselines were re-captured at `1366x768`, `1440x900`, and `1920x1080` with dimension and overflow assertions.
- No horizontal overflow was detected at any target resolution.
- `1366x768` panel density, mode-switcher labels, and card text remain legible.
- `1920x1080` uses the extra stage width for the centered, scaled canvas; the `420px` panel feels proportional.
- The responsive auto-switch to list view below `1024px` is implemented but not baselined.

### 4. Selected / hovered state capture

- The screenshot pipeline now captures:
  - selected agent on canvas + highlighted panel card (`09-selected-agent`),
  - selected task card + highlighted assignee on canvas (`10-selected-task-card`).
- Linked selection for agent and task is therefore baselined.
- Not yet captured: hover-only states, selected room and related active agents, selected approval/artifact cross-highlight, and selected/hovered rows in Debrief mode.

### 5. Runtime degraded / failed state capture limited by mock adapter

- The mock adapter can produce `blocked` agents/tasks and `revision_required` artifacts through its scripted scenarios.
- It cannot independently trigger a genuine runtime `failed` / runtime-error state, nor a runtime-degraded/session-degraded state.
- Visual QA for these states must be skipped rather than fabricated; screenshots are only captured if the adapter truthfully supports the state.

## Accepted deviations

The mock adapter used by `apps/demo-office` cannot independently trigger a genuine runtime `failed` / runtime-error state or a runtime-degraded state. The V1.1 demo therefore honestly labels state 05 as **blocked task / agent** and state 06 as **revision / rework required**, rather than claiming true runtime failures. Screenshots for runtime failed/degraded states will only be added if the underlying adapter or Runtime session can truthfully produce them.

## Screenshot path canonicalization

The multi-resolution folders are the source of truth:

- `docs/design/swarm-office-v1.1/baseline/1366x768/`
- `docs/design/swarm-office-v1.1/baseline/1440x900/`
- `docs/design/swarm-office-v1.1/baseline/1920x1080/`

Old flat files directly under `baseline/` have been removed and must stay gone. The 1440×900 set remains the source image for `scripts/generate-annotated-comparisons.mjs`.

## V1.1 verification

This section records the visual QA evidence after PR #24 and Task 3. All ten baseline screenshots and annotated comparisons were re-captured on 2026-07-08 across the three canonical resolutions.

### Re-captured states

| # | State | Baseline (1440×900) | Annotated |
|---|-------|---------------------|-----------|
| 01 | Idle office | `baseline/1440x900/01-idle-office.png` | `01-idle-office-annotated.png` |
| 02 | Active task execution | `baseline/1440x900/02-active-task-execution.png` | `02-active-task-execution-annotated.png` |
| 03 | Artifact under review | `baseline/1440x900/03-artifact-under-review.png` | `03-artifact-under-review-annotated.png` |
| 04 | Pending approval | `baseline/1440x900/04-pending-approval.png` | `04-pending-approval-annotated.png` |
| 05 | Blocked task / agent | `baseline/1440x900/05-blocked-task-agent.png` | `05-blocked-task-agent-annotated.png` |
| 06 | Revision / rework required | `baseline/1440x900/06-revision-required.png` | `06-revision-required-annotated.png` |
| 07 | Focus mode | `baseline/1440x900/07-focus-mode.png` | `07-focus-mode-annotated.png` |
| 08 | Debrief mode | `baseline/1440x900/08-debrief-mode.png` | `08-debrief-mode-annotated.png` |
| 09 | Selected agent | `baseline/1440x900/09-selected-agent.png` | `09-selected-agent-annotated.png` |
| 10 | Selected task card | `baseline/1440x900/10-selected-task-card.png` | `10-selected-task-card-annotated.png` |

### Visual upgrades verified

The regenerated evidence shows the following V1.1 improvements over the original wireframe baseline:

- **Four rooms and floor textures**: Idle canvas renders Command, Execution, Review, and Approval/Delivery rooms with distinct floor patterns, wall lines, and wooden doorway signs. Previously the idle canvas was blank black.
- **Role sprites and posture**: Agents display role-differentiated sprites/procedural silhouettes (Orchestrator, Worker, Reviewer) with state-specific posture cues for idle, working, reviewing, blocked, and approval.
- **Approval moment**: Pending-approval state shows the service-bell marker, pulsing urgency glow on the canvas, and an approval drawer with `--urgency` left-border accent, bell icon, and primary/danger Approve/Reject buttons.
- **Blocked / failed expression**: Blocked agents show a red exclamation speech-bubble marker, red pulse glow, slumped posture, and a `--failure` badge with the blocked reason in the agent card. Agents whose `status` is `failed` receive a distinct failed marker.
- **Focus panel**: Focus mode dims the canvas and collapses the right panel to a compact "Urgent Only" view with urgency-accented count cards for pending approvals, blocked tasks, and failed items.
- **Debrief panel**: Debrief mode presents a curated "Session Summary" with Tasks completed, Approvals resolved, Artifacts delivered, and Events metrics, plus a Key timeline of milestone events.
- **Micro-animations and reduced motion**: Agent idle breathe, working tool sparkle, approval bell pulse, and blocked pulse are implemented and gated by the "Motion on / Motion off" toggle and by the `prefers-reduced-motion` media query.

### Audit caveat

The mock adapter cannot independently trigger a genuine runtime `failed` / runtime-error state. The V1.1 demo therefore honestly labels state 06 as **revision / rework required** (triggered by the "异常：返工" scenario) rather than as a true runtime failure. The canvas and panel still communicate rework through the reviewer posture, review-room props, and related task cues.

## Resolution pass

A dedicated per-resolution pass was run on 2026-07-08 across `1366x768`, `1440x900`, and `1920x1080` using the updated `capture-demo-office-screenshots.mjs`. The script asserts that every PNG matches the target viewport width, matches the full-page height, and that `document.documentElement.scrollWidth <= clientWidth`.

| Resolution | Panel width | Approx. stage width | Observations |
|---|---|---|---|
| `1366x768` | `360px` | `1006px` | No horizontal overflow; panel density, mode-switcher labels, and card text remain legible. |
| `1440x900` | `380px` | `1060px` | Reference resolution used for annotated comparisons; no overflow. |
| `1920x1080` | `420px` | `1500px` | No horizontal overflow; extra stage width is used by the centered, scaled canvas without excessive letterboxing. |

Findings:

- All three resolutions pass the dimension and overflow assertions.
- Full-page screenshots scale correctly with the device pixel ratio.
- The responsive panel shrink (`360px` / `380px` / `420px`) keeps the layout balanced.
- Gaps not resolved by this pass: artifact truth states that the mock adapter cannot produce (`metadata-only`, `unavailable`, `unsupported-open`), and runtime `degraded` / `failed` states.

## Appendix: artifact inventory

| Artifact | Path |
|----------|------|
| Plan | `docs/superpowers/plans/2026-07-08-issue-25-swarm-office-follow-up.md` |
| Task brief | `docs/superpowers/plans/task-3-brief.md` |
| Design system | `docs/design/swarm-office/design-system.md` |
| High-fidelity reference | `docs/design/swarm-office/high-fidelity-designs-preview.png` |
| Baseline screenshots | `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/` |
| Annotated comparisons | `docs/design/swarm-office-v1.1/annotated-comparisons/` |
| Screenshot script | `scripts/capture-demo-office-screenshots.mjs` |
| Annotation script | `scripts/generate-annotated-comparisons.mjs` |
