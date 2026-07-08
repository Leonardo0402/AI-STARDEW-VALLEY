# Swarm Office V1.1 — Gap Audit

> Evidence-based visual/UX gap analysis for `apps/demo-office`.
> Baseline screenshots: `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/`
> Annotated comparisons: `docs/design/swarm-office-v1.1/annotated-comparisons/`
> Reference: `docs/design/swarm-office/design-system.md` + `docs/design/swarm-office/high-fidelity-designs-preview.png`
> PR context: Task 3 of Issue #25; Issue #27 Task 1 extended the truthful-state baseline. Refs #14.

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

- Agent/task bidirectional linked selection is implemented and baselined (`09-selected-agent`, `10-selected-task-card`).
- `PixelOfficeScene` exposes `selectAgent`, `selectRoom`, `selectAgents`, `clearSelection`, and `setOnSelect`; `AgentRenderer` and `RoomRenderer` render selected/highlight outlines.
- `ControlPanel` cards accept `selection`/`onSelect`, show `aria-pressed`, and support Tab/Enter/Space keyboard selection.
- `ListView` rows are selectable with `aria-selected` and sync with canvas selection.
- Remaining unbaselined gaps: room/approval/artifact cross-highlight and selected/hovered rows in Debrief mode.

### 2. Artifact state truth boundaries

- `revision_required`, `rejected`, `blocked`, and `failed` are now visually distinct on both canvas and panel (`revision_required` shows a rework cue, `rejected` uses a dedicated decision intent).
- `ControlPanel` explicitly renders artifact content states: `content-available`, `metadata-only`, `unavailable`, `loading`, `failed-open`, and `unsupported-open`.
- `artifactId` is never treated as a URI; missing content references render as metadata-only/unavailable rather than invented content.
- Issue #27 Task 1 baselined the truthful artifact failure states: `unavailable` (12), `failed-open` (13), and `unsupported-open` (14). `metadata-only` remains unbaselined because the mock adapter always creates artifacts with a URI or content reference.

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

### 5. Runtime degraded / failed state capture

- The mock adapter can produce `blocked` agents/tasks and `revision_required` artifacts through its scripted scenarios.
- Issue #27 Task 0 added `playRuntimeFailureFlow()`, which truthfully produces `failed` agent/task states using existing `ERROR_RAISED`, `TASK_FAILED`, and `AGENT_STATUS_CHANGED` events; state `11-runtime-failed` is now baselined.
- A persistent `runtime-degraded` / `session-degraded` state is still not truthfully reachable; `playRuntimeDegradedFlow()` emits a recoverable stream error but the degraded state is transient and would require protocol/session changes to persist.

## Accepted deviations

The mock adapter used by `apps/demo-office` can now truthfully produce a runtime `failed` state via `playRuntimeFailureFlow()`, so state `11-runtime-failed` is baselined. It still cannot produce a persistent `runtime-degraded` state (the stream error is recoverable and transient) nor a `metadata-only` artifact (all created artifacts carry a URI or content reference). The V1.1 demo keeps state 05 as **blocked task / agent** and state 06 as **revision / rework required**, and only claims screenshots for states that the adapter can truthfully reach.

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
| 11 | Runtime failed | `baseline/1440x900/11-runtime-failed.png` | `11-runtime-failed-annotated.png` |
| 12 | Artifact unavailable | `baseline/1440x900/12-artifact-unavailable.png` | `12-artifact-unavailable-annotated.png` |
| 13 | Artifact failed open | `baseline/1440x900/13-artifact-failed-open.png` | `13-artifact-failed-open-annotated.png` |
| 14 | Artifact unsupported open | `baseline/1440x900/14-artifact-unsupported-open.png` | `14-artifact-unsupported-open-annotated.png` |

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

## Issue #27 truthful-state pass

Issue #27 Task 0 extended the mock adapter with scripted scenarios for runtime failure, runtime degradation, artifact unavailability, artifact failed-open, and artifact unsupported-open. Task 1 captured the states that can be truthfully produced and documented the ones that cannot.

### Baselined states

| # | State | How it is truthfully produced |
|---|-------|------------------------------|
| 11 | Runtime failed | `MockRuntimeAdapter.playRuntimeFailureFlow()` emits `ERROR_RAISED`, `TASK_FAILED`, and `AGENT_STATUS_CHANGED` with `failed` status. Status strip and agent/task cards render the failure. |
| 12 | Artifact unavailable | `MockRuntimeAdapter.playArtifactUnavailableFlow()` creates an artifact with `uri: null`; `ControlPanel` renders `Content unavailable`. |
| 13 | Artifact failed open | `MockRuntimeAdapter.playArtifactFailedOpenFlow()` marks the artifact as failed-open; clicking View produces the `failed-open` error and preview. |
| 14 | Artifact unsupported open | `MockRuntimeAdapter.playArtifactUnsupportedOpenFlow()` creates a `legacy_binary` artifact in the execution room, whose Profile does not accept that type; clicking View produces an `unsupported-open` command rejection. `ControlPanel` renders the `failed-open` preview ('Open failed.') and the action-error banner with the profile-mismatch message. |

State 14 has no demo button; the screenshot script drives it through the dev-only `window.__mockAdapter` hook added in `apps/demo-office/src/main.tsx`.

### Skipped states

| State | Reason |
|-------|--------|
| `metadata-only` artifact | `MockRuntimeAdapter` always creates artifacts with a URI or content reference; there is no truthful path to an artifact that has neither. |
| `runtime-degraded` (persistent) | `playRuntimeDegradedFlow()` emits a recoverable stream error, but the degraded state is transient. A persistent degraded state requires protocol/session changes not implemented in Task 0. |

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
- Gaps not resolved by this pass: `metadata-only` artifact (mock adapter always gives artifacts a URI/content reference) and persistent `runtime-degraded` (the stream error is recoverable and transient).

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
