# Swarm Office — Design Brief (Phase 1)

> Issue #12 Phase 1 deliverable. This brief must be approved before visual directions (Phase 2) are generated or any production UI code is changed.

## Product purpose and primary user

**Purpose:** Turn live Runtime state into a trustworthy, spatial, operational workspace for managing a small team of AI agents.

**Primary user:** A technical operator or team lead who needs to:
- see what agents are doing and where;
- create, assign, and track tasks;
- approve or reject agent outputs and delivery requests;
- switch between active command, low-noise focus, and retrospective debrief modes;
- trust that the UI never invents Runtime facts.

The product should feel like a **living AI team workspace**, not a generic dashboard and not a decorative game scene.

## Desired visual character

- **Desktop-first, pixel-informed, operational.** Clean pixel styling is used to reinforce the "agent team" metaphor, but readability and operational clarity come first.
- **Restrained warmth.** Avoid sterile enterprise-gray and avoid toy-like primary colors. Use a dark, focused canvas with purposeful accent colors.
- **Spatial truth over decoration.** Every visual element must map to Runtime state: agent location, task status, approval state, artifacts, failures.
- **Motion with meaning.** Animation shows state transitions and spatial movement; it does not invent activity. Provide a reduced-motion mode.

## Visual references

**Deliberate absence of direct clones:** Do not copy Stardew Valley, Habbo, Gather, or another existing product asset-for-asset.

**Reference territories (inspirational, not literal):**
- Tactical command centers — clear hierarchy, density where needed, glanceable status.
- Cozy pixel RPG interiors — environmental storytelling through room furniture and lighting.
- Creative-studio dashboards — artifact and collaboration emphasis without clutter.

All final assets must be original or properly licensed; licenses documented in the asset manifest.

## Desktop target resolutions

Primary targets:

| Resolution | Usage |
|------------|-------|
| 1920×1080 | Default development and QA target. |
| 1440×900 | Common laptop target. |
| 1366×768 | Minimum supported desktop target. |

Layout must remain usable at 1366×768 with graceful degradation to list view when the pixel workspace cannot fit.

Mobile is out of scope.

## Required interaction depth

- **Canvas:** hover agent/room/task for details; click agent or task to focus the panel; no fake drag-and-drop that would rewrite Runtime state.
- **Panel:** create tasks, assign, pause/resume agents, approve/reject approvals, open artifacts. Commands flow through `CommandGateway`; unsupported commands are hidden or disabled.
- **Modes:** Command (full controls), Focus (low-noise ambient), Debrief (chronology and outcomes). Each mode must be visually and behaviorally distinct.
- **Fallback:** list view remains a first-class projection of the same Snapshot.

## Accessibility constraints

- Keyboard-operable controls with visible `:focus` indicators.
- Status meaning never conveyed by color alone (icons, patterns, text labels).
- Readable text outside the pixel canvas (minimum 12 px for operational text, larger for headings).
- Reduced-motion mode respected for all canvas animations and pulsing indicators.
- Contrast review required for operational text and status badges.
- Screen-reader friendly labels for canvas entities (aria-labels on interactive markers).

## Game-like versus operational

| Aspect | Game-like feel | Operational requirement |
|--------|----------------|-------------------------|
| Agent appearance | Distinct silhouettes/roles | Status and role readable instantly |
| Rooms | Environmental furniture, lighting | Purpose clear at a glance |
| Movement | Smooth interpolation | Must reflect `currentRoomId`, not cause it |
| Approval pulse | Urgent visual interruption | Must be stoppable/reduced-motion friendly |
| Failure/blocked | Dramatic but clear marker | Must explain reason and next action |

## What must never be visually simulated

The UI must never show:
- an agent "working" when no task is assigned;
- an artifact being "created" unless the Runtime emitted `artifact.created`;
- a fake approval request for dramatic effect;
- movement that implies an agent moved before `currentRoomId` changed;
- completed/successful state when the Runtime has not emitted the corresponding event.

## Open decisions for Phase 2

Before generating the three visual directions, confirm or override the following defaults:

1. **Asset strategy:** procedural shapes + sprite-sheet hybrid (fallback always procedural).
2. **Color system:** dark navy/slate base with cyan/teal information, amber urgency, red failure, green success.
3. **Agent treatment:** 24–32 px sprites with role-specific silhouettes (orchestrator = taller/desk, worker = tool-belt, reviewer = clipboard/glasses).
4. **Room treatment:** four distinct functional interiors (command desk, execution bench, review table, approval station) instead of flat colored rectangles.
5. **Control surface:** dark panel cards with strong section hierarchy and floating approval drawer when pending.
6. **Mode differentiation:**
   - Command: full canvas + full panel.
   - Focus: dimmed canvas, ambient ticker, only urgent interruptions.
   - Debrief: timeline-first layout with event chronology and outcome summary.

## Approval checkpoint

Approve this brief to proceed to Phase 2 (three visual directions).
