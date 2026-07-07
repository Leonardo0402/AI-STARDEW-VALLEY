# Swarm Office — Design System (Direction 1: Cozy Pixel Operations Room)

> Approved direction: Direction 1 — Cozy Pixel Operations Room. Panel absorbs Direction 2's density, scanability, and error-expression principles without becoming Tactical.

## Design tokens

### Color

| Token | Hex | Usage |
|-------|-----|-------|
| `--base-900` | `#131014` | Deepest background, status strip. |
| `--base-850` | `#161418` | Secondary deep background, canvas overlays. |
| `--base-800` | `#1a181c` | App canvas background. |
| `--base-700` | `#25222a` | Panel surface, floating cards. |
| `--base-600` | `#322e36` | Hover states, secondary surfaces. |
| `--base-500` | `#4a444e` | Borders, dividers. |
| `--base-400` | `#7d7682` | Muted text. |
| `--base-300` | `#b8b0bc` | Secondary text. |
| `--base-100` | `#f2f0eb` | Primary text. |
| `--warm-700` | `#3d3530` | Wood-dark props, panel borders. |
| `--warm-500` | `#6b5f56` | Wood mid-tones. |
| `--warm-300` | `#a89788` | Wood highlights. |
| `--info` | `#7ec0c8` | Active task, connection healthy, informational. |
| `--info-dim` | `#4a7c82` | Idle/dim info. |
| `--urgency` | `#e6a85c` | Approval waiting, warnings. |
| `--urgency-dim` | `#8f6232` | Dim urgency. |
| `--success` | `#7db68a` | Task done, approved, healthy. |
| `--failure` | `#c96a5b` | Blocked, failed, rejected. |
| `--failure-dim` | `#7a3d34` | Dim failure. |
| `--paused` | `#7a9cc6` | Paused, standby. |
| `--glow-info` | `rgba(126,192,200,0.35)` | Soft info glow. |
| `--glow-urgency` | `rgba(230,168,92,0.45)` | Approval bell glow. |
| `--glow-failure` | `rgba(201,106,91,0.45)` | Blocked pulse glow. |

### Typography

| Token | Font | Size | Usage |
|-------|------|------|-------|
| `--font-ui` | Inter, system-ui, sans-serif | 12–14 px | Panel text, buttons, labels. |
| `--font-mono` | "JetBrains Mono", "Courier New", monospace | 11–12 px | Runtime data, sequence numbers, error codes. |
| `--font-pixel` | "Press Start 2P", monospace | 8–10 px | Canvas room labels, small agent name tags. |
| `--h1` | Inter | 18 px / 600 | Panel section titles. |
| `--h2` | Inter | 14 px / 600 | Card titles. |
| `--body` | Inter | 12 px / 400 | Body text. |
| `--caption` | Inter | 10 px / 500 | Badges, status chips. |
| `--data` | JetBrains Mono | 11 px / 500 | Sequence, task IDs. |

### Spacing and layout

| Token | Value | Usage |
|-------|-------|-------|
| `--panel-width` | 420 px | Right control panel (min 360 px at 1366×768). |
| `--status-height` | 28 px | Top status strip. |
| `--header-height` | 44 px | Top app bar. |
| `--space-xs` | 4 px | Tight internal padding. |
| `--space-sm` | 8 px | Card internal padding. |
| `--space-md` | 16 px | Section gaps. |
| `--space-lg` | 24 px | Major section separation. |
| `--radius-sm` | 4 px | Small badges, tags. |
| `--radius-md` | 8 px | Cards, buttons, rooms. |
| `--radius-lg` | 12 px | Floating drawers, modals. |

## Asset system

### Sprite sizes

| Asset | Size | Notes |
|-------|------|-------|
| Agent base | 28×36 px | 1:1 pixel grid, 4-directional walk cycle optional. |
| Agent head | 12×12 px | Expressive state via 2–3 frames. |
| Room tile | 64×64 px | Seamless floor tiles. |
| Prop small | 16×16 px | Cups, books, tools. |
| Prop medium | 32×32 px | Chairs, lamps, monitors. |
| Prop large | 64×48 px | Desks, workbenches, shelves. |
| Status icon | 8×8 px | Dot or mini badge. |
| Approval bell | 20×20 px | Animated 2-frame ring. |

### Agent roles

| Role | Silhouette | Primary color | Idle pose | Activity indicator |
|------|------------|---------------|-----------|--------------------|
| Orchestrator | Tallest, headset, tablet | `--info` | Standing, looking at tablet | Tablet screen glow |
| Worker | Sturdy, tool belt, helmet | `--urgency` | Leaning on tool belt | Tool sparks when working |
| Reviewer | Slim, glasses, clipboard | `#b8a8d8` | Reading notes | Clipboard page flip |

### Agent states (non-color cues)

| State | Dot color | Head expression | Body posture | Extra cue |
|-------|-----------|-----------------|--------------|-----------|
| idle | dim gray | Neutral | Standing relaxed | Slow breathing bounce |
| working | `--success` | Focused | Leaning into work | Tool/screen sparkle |
| approval | `--urgency` | Looking toward approval | Turned toward bell | Small "?" thought bubble |
| blocked | `--failure` | Frustrated/sad | Slumped, hand on hip | Red exclamation speech bubble |
| failed | `--failure` | Downcast | Sitting/head down | Red pulse, error tag |
| paused | `--paused` | Eyes closed/zz | Frozen mid-pose | Pause icon overlay |

### Rooms

| Room | Floor tile | Key props | Ambient light |
|------|------------|-----------|---------------|
| Command | Dark wood planks | Large shared desk, monitors, coffee cup, wall clock | Warm overhead lamp |
| Execution | Concrete/scuffed tiles | Workbench, tools, cable spool, task board | Cool task light |
| Review | Woven rug | Round table, magnifying lamp, papers, books | Soft reading lamp |
| Approval/Delivery | Polished wood | Counter, package slot, service bell, stamp | Small wall sconce |

### Environmental rules

- Props must not block agent readability.
- Lighting is static decoration unless tied to Runtime state (e.g., approval bell glow).
- Room labels use `--font-pixel` on wooden signs above doorways.
- Floor tiles repeat; walls use simple 2–3 color vertical/horizontal lines.

## Component system

### Status strip

- Height: `--status-height`.
- Background: `--base-900`.
- Left: connection pill, runtime ID, sequence number.
- Right: last error code (if any), timestamp.
- Healthy connection: `--success` dot + "connected".
- Error: `--failure` background flash + error code, dismissible.

### App header

- Height: `--header-height`.
- Background: `--base-800`.
- Left: wordmark + "Swarm Office".
- Center: mode switcher (Command / Focus / Debrief) as segmented control.
- Right: view toggle (Pixel / List), reduced-motion toggle.

### Mode switcher

- Active mode: filled `--base-600` background, `--base-100` text.
- Inactive: transparent, `--base-400` text.
- Hover: `--base-700` background.

### Panel cards

- Background: `--base-700`.
- Border: 1 px solid `--base-500`.
- Radius: `--radius-md`.
- Padding: `--space-sm`.
- Header: 12 px semibold title + optional count badge.
- Body: 11 px regular text, 4 px row gap.

### Count badges

- 16×16 px circle.
- Background matches status intent.
- Text 9 px bold, dark-on-light or light-on-dark for contrast.

### Status badges

| Status | Background | Text | Example |
|--------|------------|------|---------|
| running | `--success` | `#131014` | running |
| waiting_approval | `--urgency` | `#131014` | waiting |
| blocked | `--failure` | `#f2f0eb` | blocked |
| failed | `--failure` | `#f2f0eb` | failed |
| paused | `--paused` | `#f2f0eb` | paused |
| idle | `--base-600` | `--base-300` | idle |

### Buttons

- Primary: `--info` background, `#131014` text, `--radius-md`.
- Secondary: `--base-600` background, `--base-100` text.
- Danger: `--failure` background, `#f2f0eb` text.
- Hover: 8% lighter background.
- Focus: 2 px `--info` outline offset 2 px.
- Disabled: `--base-600` background, `--base-400` text, no hover.

### Approval drawer

- Pinned to top of panel when `pendingApprovals.length > 0`.
- Background: `--base-700` with 1 px `--urgency` border-left (4 px).
- Shows approval kind, artifact/task reference, Approve/Reject buttons.
- Canvas counterpart: pulsing service bell above Approval/Delivery room.

### Task creation form

- Compact inline form at top of Tasks card.
- Inputs: `--base-800` background, `--base-500` border, `--radius-sm`.
- Placeholder text in `--base-400`.
- Submit button: Primary.

### Error banner

- Background: `--failure-dim`.
- Left border: 3 px `--failure`.
- Monospace error code + human-readable message.
- Dismiss button on right.
- Auto-expands status strip if critical.

### List view (fallback)

- Same color system.
- Tables use `--base-700` header, `--base-800` rows.
- Status badges identical to panel badges.
- No pixel canvas; information density is higher by design.

## Animation

| Animation | Duration | Easing | Reduced motion |
|-----------|----------|--------|----------------|
| Agent walk | 200–300 ms per tile | linear | Instant jump |
| Agent idle breathe | 1.5 s loop | ease-in-out | None or slower |
| Approval bell pulse | 1.2 s loop | ease-in-out | Static glow |
| Blocked pulse | 1 s loop | ease-in-out | Static red marker |
| Panel card expand | 150 ms | ease-out | Instant |
| Mode switch | 120 ms | ease-out | Instant |
| Task sparkle | 0.8 s loop | steps(4) | None |

## Accessibility

- Every interactive canvas element has `aria-label` describing role + status.
- Status badges always include text; color is supplemental.
- Reduced-motion class disables all continuous animations.
- Focus indicators visible on all buttons and inputs.
- Minimum panel text size 12 px; canvas labels may use 8 px but are decorative only.
- No flashing faster than 1 Hz.

## File structure for assets

```
packages/pixel-office/assets/
  agents/
    orchestrator-idle.png
    orchestrator-walk.png
    orchestrator-working.png
    worker-idle.png
    worker-walk.png
    worker-working.png
    reviewer-idle.png
    reviewer-walk.png
    reviewer-working.png
  rooms/
    floor-command.png
    floor-execution.png
    floor-review.png
    floor-approval.png
    wall-command.png
    ...
  props/
    desk-shared.png
    workbench.png
    review-table.png
    approval-counter.png
    lamp-overhead.png
    lamp-task.png
    service-bell.png
  effects/
    sparkle.png
    blocked-pulse.png
    approval-glow.png
```

All sprites use a consistent 1:1 pixel grid and a shared 16-color palette derived from the design tokens.
