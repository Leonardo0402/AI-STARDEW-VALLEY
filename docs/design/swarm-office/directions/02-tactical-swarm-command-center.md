# Direction 2 — Tactical Swarm Command Center

## Concept

A dense, operational command center for managing agent swarms. The aesthetic is inspired by mission control and tactical displays: dark background, high-contrast status colors, grid lines, and compact information panels. The emotional tone is "precise, serious, in control."

## Full-app composition

- **Top bar:** minimal black bar with monochrome runtime status, sequence counter, and compact mode tabs.
- **Left stage (≈70%):** the pixel office rendered as a tactical map. Four rooms are outlined zones on a dark grid. Furniture is reduced to functional silhouettes.
- **Right panel (≈30%, 380 px min):** dense dark panel with tight spacing, monospace data, and color-coded badges. Information is prioritized over whitespace.
- **Status strip:** integrated into the top bar; connection health as a small LED dot.

## Room layout

| Room | Visual treatment |
|------|------------------|
| Command | Central command island with multiple screens and a holographic task board. |
| Execution | Tool bay with work pods, cable conduits, and active-task indicators. |
| Review | Inspection bench with scanner arms and artifact display stands. |
| Approval/Delivery | Sealed airlock-style gate with a status light and release lever. |

Rooms are separated by glowing grid lines and labeled with compact uppercase placards.

## Agent character treatment

- **Size:** 24–28 px tall.
- **Orchestrator:** sleek figure with a visor and command chevron.
- **Worker:** blocky utility silhouette with shoulder lights.
- **Reviewer:** thinner figure with sensor goggles.
- **Status:** a colored halo/ring around the agent; no face details.
- **Movement:** glide along grid paths with a short motion trail; minimal frames.

## React control-surface treatment

- Panels use near-black `#13131a` with `#252532` card backgrounds and thin `#3a3a4a` borders.
- Monospace typography for data; sans-serif only for headings.
- Buttons are sharp rectangles with high-contrast borders.
- Pending approvals appear as a red-bordered alert card pinned to the top.
- Errors are displayed in a dedicated alert strip with error code.

## Typography and color hierarchy

- **Primary type:** JetBrains Mono / monospace for operational data; Inter for headings.
- **Base:** near-black `#0d0d12`.
- **Surface:** `#13131a` panels, `#1e1e2a` cards.
- **Accent info:** electric cyan `#4ecdc4`.
- **Accent urgency:** warning amber `#ffb347`.
- **Success:** tactical green `#6eeb83`.
- **Failure:** alert red `#ff5e5e`.

## Task / artifact / approval presentation

- **Task:** a blinking target reticle on the execution pod; panel card shows task ID, status, assignee, priority bar.
- **Artifact:** a scanned object on the review bench with a data overlay; panel shows artifact metadata and review verdict.
- **Approval:** the airlock gate flashes amber with a "REQUEST" sign; panel shows approval ID, kind, and Accept/Reject toggles.

## Mode differences

- **Command:** full tactical map, all controls, live data streams.
- **Focus:** map dims to a passive radar view; panel becomes a compact alert list; only blocked/approval items surface.
- **Debrief:** map shows ghosted trails of agent movement; panel displays a mission-timeline with event codes and outcomes.

## State matrix

| State | Visual cue |
|-------|------------|
| idle | Agent stationary, dim ring. |
| running/working | Agent in execution pod, green ring, small sparks. |
| waiting_approval | Agent at airlock, amber flashing ring. |
| blocked | Agent frozen, red ring, error code above head. |
| failed | Agent gray with red X, alert tone visualized. |
| paused | Agent darkened with blue pause ring. |

## Strengths

- Matches the "operator" mental model.
- High information density without feeling playful.
- Strong contrast and scanability.

## Trade-offs

- Can feel cold or intimidating.
- Less differentiation from generic devops dashboards.
- Reduced-motion mode is critical because of flashing alerts.

## Implementation complexity

**Medium.** Mostly geometric shapes, grid lines, and glow effects. Agent sprites can be simple silhouettes. Good fit for procedural rendering with a few sprite accents.
