# Direction 3 — Living Agent Studio

## Concept

A bright, creative-lab environment where agents collaborate on artifacts. The scene feels like a modern design studio or maker space: whiteboards, sticky notes, soft daylight, and worktables covered in papers and prototypes. The emotional tone is "creative, transparent, collaborative."

## Full-app composition

- **Top bar:** light gray bar with a clean wordmark, runtime pill, and understated mode switcher.
- **Left stage (≈60%):** the pixel studio. Four rooms are open-plan areas separated by low dividers and furniture. Large windows suggest daylight.
- **Right panel (≈40%, 440 px min):** light card panel with airy spacing, clean sans-serif, and colorful status chips.
- **Status strip:** a subtle footer or top pill showing connection state; healthy state is unobtrusive.

## Room layout

| Room | Visual treatment |
|------|------------------|
| Command | Standing desk with a large monitor wall and a Kanban board. Orchestrator coordinates here. |
| Execution | Maker bench with 3D printer, tools, and half-built prototypes. Workers craft here. |
| Review | Couch corner with a low table, sketches pinned to a board. Reviewer examines work. |
| Approval/Delivery | A clean hand-off counter with a "ready to ship" tray and a stamp. |

Rooms feel open and connected; agents can see each other across dividers.

## Agent character treatment

- **Size:** 26–30 px tall.
- **Orchestrator:** carries a tablet, stands upright, wears a lanyard.
- **Worker:** wears an apron, holds a tool or prototype.
- **Reviewer:** glasses, notepad, slightly thoughtful pose.
- **Status:** a small sticky-note icon or badge floating beside the agent.
- **Movement:** brisk walk with a subtle bounce; idle fidgeting (looking at notes, stretching).

## React control-surface treatment

- Panels use light surfaces (`#f7f6f3`) with white cards and soft shadows.
- Section headers in dark gray sans-serif at 14 px.
- Buttons are rounded with clear labels and color-coded accents.
- Pending approvals appear as a warm amber banner card at the top of the panel.
- Errors use a red banner with an icon and concise message.

## Typography and color hierarchy

- **Primary type:** Inter or SF Pro for everything; pixel font reserved for tiny canvas annotations.
- **Base:** warm off-white `#f7f6f3`.
- **Surface:** white `#ffffff` cards, `#eeeeea` panel background.
- **Accent info:** teal `#2a9d8f`.
- **Accent urgency:** goldenrod `#e9c46a`.
- **Success:** green `#52b788`.
- **Failure:** rose `#e76f51`.

## Task / artifact / approval presentation

- **Task:** a sticky note on the Kanban board; panel card shows title, colored status chip, and assignee.
- **Artifact:** a physical prototype or document on the review table; panel card shows preview thumbnail, version, and reviewer comment.
- **Approval:** a lit "ready to ship" tray on the hand-off counter; panel shows approval card with Approve/Reject buttons.

## Mode differences

- **Command:** bright studio, all controls, agents actively moving and working.
- **Focus:** lights soften, canvas becomes a calm overview, panel reduces to a "do not disturb" summary and urgent approvals only.
- **Debrief:** the studio is shown at dusk with a retrospective overlay; panel highlights shipped artifacts, decisions, and lessons learned.

## State matrix

| State | Visual cue |
|-------|------------|
| idle | Agent stands relaxed, neutral sticky note. |
| running/working | Agent at maker bench, green sticky, tool animation. |
| waiting_approval | Agent near hand-off counter, amber sticky, tray lit. |
| blocked | Agent sits down with hand on chin, red sticky, reason note. |
| failed | Agent steps back from broken prototype, red pulse, error tag. |
| paused | Agent grayed with pause sticky, blue note. |

## Strengths

- Communicates creativity and collaboration.
- Light theme is unusual for ops tools and can feel refreshing.
- Strong artifact/storytelling potential.

## Trade-offs

- Light theme can be fatiguing in low-light environments.
- Requires careful contrast management for accessibility.
- May feel less "serious" for high-stakes operational use.

## Implementation complexity

**Medium–High.** Needs custom room props and agent sprites, but the open-plan layout allows asset reuse. Good fit if the team wants a strong brand identity.
