# Issue #14 — Phase 3: Swarm Office V1.1 Evidence-Based UX/Visual Pass

## Goal

Make the current LifeSim + Runtime capability feel like an observable, clickable, spatial, characterful product experience.

This phase is **evidence-based**: we run `demo-office`, capture screenshots of all key runtime states, compare them against the approved high-fidelity design (`docs/design/swarm-office/high-fidelity-designs-preview.png`) and the design system (`docs/design/swarm-office/design-system.md`), document the gaps, then open a PR with targeted visual/interaction upgrades.

## Scope

### In scope

- Run `apps/demo-office` locally and capture baseline screenshots.
- States to capture:
  1. Idle office
  2. Active task execution
  3. Artifact under review
  4. Pending approval
  5. Blocked task / agent
  6. Failed / runtime error
  7. Focus mode
  8. Debrief mode
- Compare each baseline screenshot to the design system + high-fidelity design.
- Produce:
  - `docs/design/swarm-office-v1.1/gap-audit.md`
  - `docs/design/swarm-office-v1.1/baseline/` — raw screenshots
  - `docs/design/swarm-office-v1.1/annotated-comparisons/` — side-by-side or marked-up comparisons
- After audit is accepted, open PR(s) to implement the visual/interaction upgrades.

### Out of scope

- New gameplay systems (farming, memory, relationships, new town buildings).
- Backend runtime protocol changes.
- New AI model training.

## Global Constraints

- Manual mode remains deterministic.
- Browser-side code never owns canonical state.
- No `Date.now` / `setTimeout` / `Math.random` in reducer/projection logic.
- This is a visual/interaction pass, not an architecture rewrite.

## Tasks

### Task 1: Boot demo-office and capture baseline screenshots

1. Ensure dependencies are installed (`npm ci`).
2. Start `apps/demo-office` dev server in default mock mode.
3. Use browser automation to navigate to the app.
4. Capture each required state:
   - Idle office
   - Active task execution
   - Artifact under review
   - Pending approval
   - Blocked task / agent
   - Failed / runtime error
   - Focus mode
   - Debrief mode
5. Save screenshots to `docs/design/swarm-office-v1.1/baseline/` with descriptive file names.
6. Commit the baseline screenshots.

### Task 2: Produce annotated comparisons

1. Load the high-fidelity design reference image.
2. For each baseline screenshot, create an annotated comparison that highlights:
   - Missing components / layout differences
   - Color / typography / spacing deviations
   - Missing agent/room visuals
   - Missing state badges / glows / animations
   - Mode switcher differences
3. Save annotated images to `docs/design/swarm-office-v1.1/annotated-comparisons/`.
4. Commit.

### Task 3: Write gap-audit.md

1. Write a structured gap audit:
   - Executive summary
   - State-by-state gap table (current vs. target)
   - Design-system compliance checklist
   - Prioritized recommendations (P0 / P1 / P2)
   - Proposed implementation plan for follow-up PR
2. Save to `docs/design/swarm-office-v1.1/gap-audit.md`.
3. Commit.

### Task 4: Review and merge prep

1. Run `npm test` and `npm run build` to ensure docs/assets do not break the build.
2. Task review for completeness and accuracy.
3. Final whole-branch review.
4. Create PR, link `Refs #14` (do not close #14 yet — implementation PR will close it).

## Acceptance Criteria

- All 8 required states are captured as baseline screenshots.
- Each baseline has a corresponding annotated comparison.
- `gap-audit.md` contains a prioritized, actionable gap list.
- PR is created with design artifacts and a plan for implementation.
