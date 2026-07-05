# Direction 1 — Cozy Pixel Operations Room

## Concept

A warm, handcrafted, human-scale AI team workspace. The scene feels like a small, well-loved operations office at night: wood-toned desks, soft lamps, potted plants, and pixel agents who look like they belong there. The emotional tone is "capable and calm," not sterile or arcade-like.

## Full-app composition

- **Top bar:** low, warm dark slate bar with a small logo, runtime badge, and subtle mode switcher.
- **Left stage (≈65%):** the pixel office. Four rooms are visible as connected interior spaces with walls, floors, and furniture. A gentle top-down-ish oblique perspective gives depth without breaking the pixel grid.
- **Right panel (≈35%, 420 px min):** dark card stack with rounded corners, section headers, and clear separation. Cards feel like physical index cards or sticky notes.
- **Status strip:** thin strip at the very top showing connection, sequence, and last error; uses amber only when attention is needed.

## Room layout

| Room | Visual treatment |
|------|------------------|
| Command | Large shared desk with monitors, a small coffee cup, warm overhead lamp. Orchestrator stands here by default. |
| Execution | Workbench with tools, cables, a glowing task board on the wall. Workers move here when assigned. |
| Review | Comfortable reading nook with a large table, papers, and a magnifying lamp. Reviewer resides here. |
| Approval/Delivery | A small station with a sealed package slot and a stamp pad. Pending approvals light a soft bell/indicator. |

Rooms are connected by subtle floor transitions and small environmental props. Labels are small wooden signs above doorways.

## Agent character treatment

- **Size:** 28–32 px tall.
- **Orchestrator:** slightly taller, wears a headset, holds a small tablet.
- **Worker:** sturdy silhouette with a tool belt and glowing task-light on their helmet.
- **Reviewer:** slighter build, glasses, clipboard.
- **Status:** small 4 px dot above the head (green running, amber waiting, red blocked, blue paused). A tiny thought-bubble or tool icon shows current activity.
- **Movement:** small walk-cycle (2–4 frames) when changing rooms; idle breathing bounce.

## React control-surface treatment

- Cards use warm dark surfaces (`#25222a`) with soft borders (`#3d3530`).
- Section headers use a friendly sans-serif at 14 px in warm white.
- Buttons are pill-shaped or rounded rectangles with subtle shadows.
- Pending approvals appear as a top-of-panel "request card" with a soft amber glow.
- Errors use a small toast-like banner, not screaming red.

## Typography and color hierarchy

- **Primary type:** Inter or system sans for panel; pixel font only for room labels and small canvas annotations.
- **Base:** warm charcoal `#1a181c`.
- **Surface:** `#25222a` panels, `#2f292d` cards.
- **Accent info:** soft cyan `#7ec0c8`.
- **Accent urgency:** amber `#e6a85c`.
- **Success:** sage green `#7db68a`.
- **Failure:** terracotta red `#c96a5b`.

## Task / artifact / approval presentation

- **Task:** a small clipboard icon on the workbench; panel card shows title, status badge, assignee avatar, priority dot.
- **Artifact:** appears as a physical object (scroll, disk, package) on the review table; panel card shows title, version, review verdict.
- **Approval:** a ringing service bell above the approval station; panel shows request card with Approve/Reject buttons.

## Mode differences

- **Command:** full warm office, all controls visible, agents move freely.
- **Focus:** lights dim except for urgent stations; canvas reduced to a soft ambient view; panel collapses to a minimal ticker and approval alerts only.
- **Debrief:** the office is overlaid with a subtle timeline ribbon along the bottom; panel switches to a chronological event log and outcome cards.

## State matrix

| State | Visual cue |
|-------|------------|
| idle | Agent stands still, dim status dot. |
| running/working | Agent at workbench, green dot, small tool-sparkle animation. |
| waiting_approval | Agent looks toward approval station, amber bell rings. |
| blocked | Agent slumps slightly, red dot, red exclamation speech bubble with reason. |
| failed | Agent sits down, red pulse, error tag on panel. |
| paused | Agent grayed out with pause icon, blue dot. |

## Strengths

- Distinctive, memorable character.
- Reduces the "enterprise dashboard" feeling.
- Warm palette is less fatiguing for long sessions.

## Trade-offs

- Requires the most original pixel art (rooms, furniture, agent sprites).
- Warm palette can feel less "serious" to some operators.
- More animation frames for walk cycles.

## Implementation complexity

**High.** Needs custom sprite sheets for agents, room tiles, props, and furniture. Recommended if the project can invest in original art.
