# Issue #23 — Swarm Office V1.1 implementation: canvas foundation, role sprites, and mode polish

## Goal

Implement the visual/interaction upgrades identified in `docs/design/swarm-office-v1.1/gap-audit.md`, while keeping the change scoped to presentation layers only.

## Scope

### In scope

- `apps/demo-office` — shell, mode switcher, panel cards, focus/debrief layouts.
- `packages/pixel-office` — canvas scene, room/prop/agent renderers, effects, animations.
- `scripts/` — screenshot automation and visual-QA regeneration.
- `docs/design/swarm-office-v1.1/` — updated baseline, annotated comparisons, and gap-audit corrections.

### Out of scope

- Protocol changes.
- Reducer / LifeSimEngine / RuntimeSession changes.
- `packages/adapters/mock` changes (we will not add a new failed scenario; instead we honestly relabel the existing revision state).

## Global Constraints

- No canonical-state changes.
- No `Date.now` / `setTimeout` / `Math.random` in reducer/projection logic.
- All continuous animations must respect the `reduceMotion` toggle.
- Follow the design tokens in `docs/design/swarm-office/design-system.md`.

## Tasks

### Task 0: Audit caveat correction

1. Rename screenshot state 06 from `failed/runtime error` to `revision/rework` because `playRevisionFlow` produces `revision_required`, not a true failed state.
2. Update `scripts/capture-demo-office-screenshots.mjs` to capture:
   - 01 idle office
   - 02 active task execution
   - 03 artifact under review
   - 04 pending approval
   - 05 blocked task/agent
   - 06 revision/rework
   - 07 focus mode
   - 08 debrief mode
3. Regenerate `baseline/` and `annotated-comparisons/`.
4. Update `gap-audit.md` to reflect the honest state names and note the absence of an independently triggerable failed/runtime-error state in the current mock adapter.

### Task 1: Canvas scene foundation

1. Render four rooms even when idle: command, execution, review, approval_delivery.
2. Add floor texture / tile pattern per room type (wood planks, concrete, rug, polished wood).
3. Add simple wall lines and wooden doorway signs with pixel-font labels.
4. Keep agents visible in idle state.
5. Update `packages/pixel-office/src/renderer/room-renderer.ts` and related tests.

### Task 2: Mode switcher + panel cards

1. Convert Command/Focus/Debrief text buttons into a segmented control (`--base-600` active fill, `--base-100` active text).
2. Apply `--base-700` panel card surfaces, `--base-500` borders, `--radius-md`, and `--space-sm` padding to right-hand panels.
3. Update `apps/demo-office/src/App.tsx` and CSS; ensure keyboard navigation still works.

### Task 3: Role sprites + postures

1. Implement role-differentiated procedural sprites: Orchestrator (tall + headset + tablet), Worker (sturdy + tool belt + helmet), Reviewer (slim + glasses + clipboard).
2. Add state postures: working lean, blocked slump, failed downcast, approval turn-toward-bell.
3. Update `packages/pixel-office/src/renderer/agent-renderer.ts`; add/adjust tests.

### Task 4: Approval / blocked / failed moments

1. Approval/Delivery room: service bell prop, counter, package slot, wall sconce.
2. Pending approval: pulsing `--glow-urgency` bell on canvas, urgency border-left in drawer, bell icon, primary/danger buttons.
3. Blocked: red pulse glow, speech-bubble exclamation, slumped posture.
4. Failed: error banner in status strip, `--failure-dim` badge background, error code display. (Since true failed state cannot be triggered without adapter changes, implement the visuals so they render whenever an agent/task reaches `failed` status.)
5. Update `packages/pixel-office/src/renderer/effect-renderer.ts`, `apps/demo-office/src/StatusStrip.tsx`, and relevant panels.

### Task 5: Focus / Debrief mode refinement

1. Focus mode: collapse right panel to an "Urgent Only" compact view with `--urgency`-accented count cards; keep canvas dimmed but show ambient agent silhouettes.
2. Debrief mode: replace raw event timeline with curated "Session Summary" — Tasks completed, Approvals resolved, Artifacts delivered, Events count, plus a Key timeline of milestones.
3. Update `apps/demo-office/src/App.tsx`, `FocusModeIndicator`, and `DebriefTimeline.tsx`; adjust tests.

### Task 6: Micro-animation + reduced-motion

1. Idle breathe loop (1.5s).
2. Walk transitions (200–300ms per tile, instant when reduceMotion).
3. Task sparkle / tool sparks when working.
4. Approval bell pulse (1.2s loop).
5. Blocked pulse (1s loop).
6. Gate all continuous animations behind `reduceMotion`.
7. Update `packages/pixel-office` renderers and `apps/demo-office/src/App.tsx`.

### Task 7: Visual QA evidence regeneration

1. Run `scripts/capture-demo-office-screenshots.mjs` to regenerate all 8 baseline screenshots.
2. Run `scripts/generate-annotated-comparisons.mjs` to regenerate annotated comparisons.
3. Update `gap-audit.md` with a "V1.1 verification" section showing what changed.
4. Run `npm test` and `npm run build`.

## Acceptance Criteria

- All 8 states are re-captured with honest labels.
- Idle canvas shows four rooms with props.
- Mode switcher matches design-system segmented control.
- Agents show role silhouettes and state postures.
- Approval, blocked, and failed visuals are explicit.
- Focus mode shows compact urgent-only panel.
- Debrief mode shows Session Summary + Key timeline.
- Continuous animations respect reduce-motion.
- `npm test` and `npm run build` pass.
- PR links `Issue #23` and `Refs #14`; closes #14 only if all #14 acceptance criteria are met.
