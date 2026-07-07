# Swarm Office V1.1 — Gap Audit

> Evidence-based visual/UX gap analysis for `apps/demo-office`.
> Baseline screenshots: `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/`
> Annotated comparisons: `docs/design/swarm-office-v1.1/annotated-comparisons/`
> Reference: `docs/design/swarm-office/design-system.md` + `docs/design/swarm-office/high-fidelity-designs-preview.png`

## Executive summary

`demo-office` successfully renders all eight requested runtime states (idle, execution, review, approval, blocked, failed, focus, debrief) and the underlying Runtime → LifeSim integration is functional. However, the current UI is still a wireframe-level implementation: the pixel canvas lacks the approved "Cozy Pixel Operations Room" art direction, panels do not follow the design-system token hierarchy, and several high-impact product moments (approval, blocked, failed) rely on text rather than visual storytelling.

The single largest gap is the **idle/blank canvas**: in Command mode with no active task, the pixel office is entirely black, giving the impression the app is broken. The second largest is **role/state readability**: agents are colored blocks with only a name label and a small badge, missing the silhouette, posture, and glow cues defined in the design system.

This audit recommends a phased visual pass: first fix canvas props, room textures, and idle-agent presence (P0); then role-specific sprites, state animations, and approval/blocked/failed expression (P1); finally polish focus/debrief layouts and micro-interactions (P2).

## State-by-state gap table

| State | Baseline file (1440×900) | Annotated file | What works | Key gaps |
|-------|--------------------------|----------------|------------|----------|
| Idle office | `baseline/1440x900/01-idle-office.png` | `01-idle-office-annotated.png` | Header, status strip, control panel skeleton load | Canvas is black/empty; no room art, props, or ambient agents. Mode switcher is plain text. Panel cards lack `--base-700` surface / `--base-500` border. Agent list is flat. |
| Active task execution | `baseline/1440x900/02-active-task-execution.png` | `02-active-task-execution-annotated.png` | Four rooms render, task flows, status badge shows "working" | Rooms are flat color blocks without floor texture, walls, or doorway signs. Worker is a generic block; missing tool-belt/helmet silhouette and tool sparks. Props (workbench, task board, cable spool, task light) absent. |
| Artifact under review | `baseline/1440x900/03-artifact-under-review.png` | `03-artifact-under-review-annotated.png` | Reviewer moves to review room, status shows "reviewing" | Reviewer lacks glasses/clipboard. Review room has no rug, round table, magnifying lamp, or papers. No page-flip activity cue. |
| Pending approval | `baseline/1440x900/04-pending-approval.png` | `04-pending-approval-annotated.png` | Approval drawer appears with Approve/Reject | Approval/Delivery room missing counter, service bell, package slot, sconce. Drawer lacks `--urgency` 4px left border and bell icon. Buttons do not match primary/danger token styles. No pulsing bell glow on canvas. |
| Blocked task / agent | `baseline/1440x900/05-blocked-task-agent.png` | `05-blocked-task-agent-annotated.png` | Agent shows red exclamation, "blocked" badge appears | Blocked agent posture is upright/idle, not slumped/frustrated. Missing red pulse glow and speech-bubble cue. Badge lacks `--failure-dim` background and error code. |
| Revision / rework required | `baseline/1440x900/06-revision-required.png` | `06-revision-required-annotated.png` | Revision state is reachable | Revision state is visually indistinguishable from idle on canvas. No rework cue (clipboard with red flag). Agent list shows idle instead of reviewer/worker rework posture. |
| Focus mode | `baseline/1440x900/07-focus-mode.png` | `07-focus-mode-annotated.png` | Overlay appears, urgent counts render | Overlay dims canvas but does not show ambient activity or compact urgent cards. Right panel still shows full controls instead of collapsed "Urgent Only" view. Summary cards lack `--urgency` accents and count badges. |
| Debrief mode | `baseline/1440x900/08-debrief-mode.png` | `08-debrief-mode-annotated.png` | Event timeline renders, summary counts present | Debrief shows raw event log rather than curated "Session Summary" with metrics cards and Key timeline. Missing agent/room debrief visuals or heatmap. |

## Design-system compliance checklist

### Color tokens

| Token | Status | Notes |
|-------|--------|-------|
| `--base-900` / `--base-800` backgrounds | Partial | App background is dark but not using the exact token values. |
| `--base-700` panel cards | Missing | Panels use flatter surfaces without card borders. |
| `--base-500` borders | Missing | Dividers exist but are ad-hoc grays. |
| `--info` / `--urgency` / `--failure` intents | Partial | Badges use similar hues but not the exact tokens; glows missing. |
| `--glow-*` | Missing | No glow effects for approval, blocked, or working states. |

### Typography

| Token | Status | Notes |
|-------|--------|-------|
| `--font-ui` Inter 12–14px | Partial | Font stack not explicit; sizes roughly match. |
| `--font-mono` JetBrains Mono | Missing | Runtime IDs/sequence use default monospace. |
| `--font-pixel` Press Start 2P | Missing | Room labels are sans-serif, not pixel font. |
| Headings (`--h1`, `--h2`) | Partial | Section titles lack consistent weight/scale. |

### Layout

| Token | Status | Notes |
|-------|--------|-------|
| `--panel-width` 420px | Partial | Right panel width is close but not fixed/tokenized. |
| `--status-height` 28px | Partial | Status strip exists; height not explicit. |
| `--header-height` 44px | Partial | Header exists; height not explicit. |
| Spacing tokens | Missing | Values are hard-coded in inline styles. |

### Components

| Component | Status | Notes |
|-----------|--------|-------|
| Status strip | Partial | Shows connection + runtime ID + seq; missing error state / timestamp. |
| App header | Partial | Wordmark present; mode switcher is not a segmented control. |
| Mode switcher | Missing | Plain text buttons, no active fill. |
| Panel cards | Missing | No `--base-700` surface / `--base-500` border. |
| Status badges | Partial | Colors roughly match but sizing/typography inconsistent. |
| Approval drawer | Missing | No urgency border-left or bell icon. |
| Error banner | Missing | Failed state has no banner. |

### Assets / animation

| Area | Status | Notes |
|------|--------|-------|
| Agent sprites (28×36, role silhouettes) | Missing | Agents are solid-color rectangles. |
| Room floor tiles (64×64) | Missing | Flat fills instead of textured tiles. |
| Props (desk, workbench, lamp, bell) | Missing | Only simple desks present; no lamps/bells/signs. |
| State animations (breathe, walk, sparkle, pulse) | Missing | Agents are static. |
| Reduced-motion toggle | Present | "Motion on" toggle exists in header. |

## Prioritized recommendations

### P0 — Must have before V1.1 feels complete

1. **Idle canvas must not be blank.** Render the four rooms even when no task is active: wood-plank Command floor, concrete Execution floor, rug Review floor, polished-wood Approval floor, plus wall lines and doorway signs.
2. **Fix the mode switcher.** Convert Command/Focus/Debrief text buttons into a segmented control per the design system (`--base-600` active fill, `--base-100` active text).
3. **Panel card surfaces.** Apply `--base-700` background, `--base-500` 1px border, `--radius-md`, and `--space-sm` padding to World, Actions, Create Task, Agents, Pending Approval, and Summary cards.

### P1 — High impact on observability and character

4. **Role-differentiated agent sprites.** Implement Orchestrator (tall, headset, tablet), Worker (sturdy, tool belt, helmet), and Reviewer (slim, glasses, clipboard) silhouettes.
5. **State-specific posture and glows.** Add working lean + tool sparkle, blocked slumped posture + red pulse + speech bubble, approval turn-toward-bell + "?" thought bubble, failed downcast + error tag.
6. **Approval moment.** Add service bell prop, pulsing `--glow-urgency`, `--urgency` left-border drawer, bell icon, and primary/danger Approve/Reject buttons.
7. **Blocked/failed expression.** Add `--failure-dim` badge background, error code in status strip / agent card, and canvas-side red pulse marker.

### P2 — Polish and mode-specific layouts

8. **Focus mode redesign.** Collapse right panel to an "Urgent Only" compact view with `--urgency`-accented count cards; keep canvas dimmed but show ambient agent silhouettes.
9. **Debrief mode redesign.** Replace raw event timeline with curated Session Summary: Tasks completed, Approvals resolved, Artifacts delivered, Events count, plus a Key timeline of meaningful milestones.
10. **Micro-animations.** Agent idle breathe, walk transitions, approval bell pulse, blocked pulse, panel card expand; all gated by reduced-motion toggle.
11. **Typography hardening.** Enforce Inter / JetBrains Mono / Press Start 2P stacks and tokenized sizes across app and canvas.

## Proposed implementation plan for follow-up PR

### PR scope

A single visual/interaction PR targeting `apps/demo-office` and `packages/pixel-office` only. No protocol or reducer changes.

### Task breakdown

1. **Canvas scene foundation**
   - Draw four rooms with floor tiles, wall lines, doorway signs.
   - Keep agents visible in idle state.
   - Files: `packages/pixel-office/src/scene/*`

2. **Mode switcher + panel card styling**
   - Implement segmented control in app header.
   - Apply panel card tokens to right-hand components.
   - Files: `apps/demo-office/src/App.tsx`, `apps/demo-office/src/components/*`

3. **Agent sprites and state postures**
   - Add role-specific sprites and state postures.
   - Wire Runtime state to sprite selection.
   - Files: `packages/pixel-office/src/agents/*`, `packages/pixel-office/src/render/*`

4. **Approval, blocked, failed moments**
   - Service bell prop + glow.
   - Approval drawer styling.
   - Blocked/failed badges and error banner.
   - Files: `packages/pixel-office/src/rooms/approval.ts`, `apps/demo-office/src/panels/*`

5. **Focus and Debrief layouts**
   - Compact urgent-only panel for Focus.
   - Session Summary + Key timeline for Debrief.
   - Files: `apps/demo-office/src/modes/*`

6. **Animation pass**
   - Idle breathe, walk, sparkle, pulse, bell glow.
   - Reduced-motion gating.
   - Files: `packages/pixel-office/src/animations/*`

### Acceptance criteria

- [x] All eight baseline states are re-captured and show clear visual improvement against this audit.
- [x] Mode switcher matches design-system segmented control.
- [x] Idle canvas shows all four rooms with props.
- [x] Agents show role silhouettes and state postures.
- [x] Approval, blocked, and failed states have explicit visual cues.
- [x] Focus mode shows compact urgent-only panel.
- [x] Debrief mode shows Session Summary + Key timeline.
- [x] `npm test` and `npm run build` pass.
- [x] PR description links `Issue #23` and `Refs #14`.

## V1.1 verification

This section records the visual QA evidence regenerated after Tasks 1–6 were completed. All eight baseline screenshots and annotated comparisons were re-captured on 2026-07-07.

### Re-captured states

| # | State | Baseline | Annotated |
|---|-------|----------|-----------|
| 01 | Idle office | `baseline/1440x900/01-idle-office.png` | `01-idle-office-annotated.png` |
| 02 | Active task execution | `baseline/1440x900/02-active-task-execution.png` | `02-active-task-execution-annotated.png` |
| 03 | Artifact under review | `baseline/1440x900/03-artifact-under-review.png` | `03-artifact-under-review-annotated.png` |
| 04 | Pending approval | `baseline/1440x900/04-pending-approval.png` | `04-pending-approval-annotated.png` |
| 05 | Blocked task / agent | `baseline/1440x900/05-blocked-task-agent.png` | `05-blocked-task-agent-annotated.png` |
| 06 | Revision / rework required | `baseline/1440x900/06-revision-required.png` | `06-revision-required-annotated.png` |
| 07 | Focus mode | `baseline/1440x900/07-focus-mode.png` | `07-focus-mode-annotated.png` |
| 08 | Debrief mode | `baseline/1440x900/08-debrief-mode.png` | `08-debrief-mode-annotated.png` |

### Visual upgrades verified

The regenerated evidence shows the following V1.1 improvements over the original wireframe baseline:

- **Four rooms and floor textures**: Idle canvas now renders Command, Execution, Review, and Approval/Delivery rooms with distinct floor patterns (wood planks, concrete tiles, woven rug, polished wood), wall lines, and wooden doorway signs. Previously the idle canvas was blank black.
- **Role sprites and posture**: Agents display role-differentiated sprites (Orchestrator, Worker, Reviewer) with state-specific posture cues for idle, working, reviewing, blocked, and approval.
- **Approval moment**: Pending-approval state shows the service-bell prop, pulsing urgency glow on the canvas, and an approval drawer with `--urgency` left-border accent, bell icon, and primary/danger Approve/Reject buttons.
- **Blocked / failed expression**: Blocked agents show a red exclamation speech-bubble marker, red pulse glow, slumped posture, and a `--failure` badge with the blocked reason in the agent card.
- **Focus panel**: Focus mode dims the canvas and collapses the right panel to a compact "Urgent Only" view with urgency-accented count cards for pending approvals, blocked tasks, and failed items.
- **Debrief panel**: Debrief mode presents a curated "Session Summary" with Tasks completed, Approvals resolved, Artifacts delivered, and Events metrics, plus a Key timeline of milestone events.
- **Micro-animations and reduced motion**: Agent idle breathe, working tool sparkle, approval bell pulse, and blocked pulse are implemented and gated by the "Motion on / Motion off" toggle in the header.

### Audit caveat

The mock adapter used by `apps/demo-office` cannot independently trigger a genuine runtime `failed` / runtime-error state. The V1.1 demo therefore honestly labels state 06 as **revision / rework required** (triggered by the "异常：返工" scenario) rather than as a true runtime failure. The canvas and panel still communicate rework through the Reviewer posture, review-room props, and related task cues.

## Appendix: artifact inventory

| Artifact | Path |
|----------|------|
| Plan | `docs/superpowers/plans/2026-07-07-issue-23-swarm-office-v1.1-implementation.md` |
| Design system | `docs/design/swarm-office/design-system.md` |
| High-fidelity reference | `docs/design/swarm-office/high-fidelity-designs-preview.png` |
| Baseline screenshots | `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/` |
| Annotated comparisons | `docs/design/swarm-office-v1.1/annotated-comparisons/` |
| Screenshot script | `scripts/capture-demo-office-screenshots.mjs` |
| Annotation script | `scripts/generate-annotated-comparisons.mjs` |
