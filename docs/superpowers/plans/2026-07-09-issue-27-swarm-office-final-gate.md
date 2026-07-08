# Issue #27 — Swarm Office V1.1 final gate: truthful failure fixtures, accessibility pass, and #14 closure audit

## Goal

Finalize acceptance of #14 by producing **evidence**, not by adding open-ended UI chrome.

This issue focuses on four things:

1. Make mock/demo scenarios truthfully emit degraded / failed / artifact-unavailable / unsupported-open / failed-open states (no faking).
2. Extend visual QA only for states that can be truthfully produced; skip and document the rest.
3. Establish an accessibility baseline and a performance / lifecycle evidence document.
4. Audit #14 acceptance criteria line-by-line and render a verdict on whether #14 can be closed.

## Scope

### In scope

- `packages/adapters/mock/src/mock-adapter.ts` — extend scripted scenarios to truthfully emit failure/fixture states.
- `apps/demo-office/src/DemoControls.tsx` — add controls for new truthful scenarios.
- `apps/demo-office/src/App.tsx` / `theme.css` — only the minimal wiring needed to display the new truthful states.
- `scripts/capture-demo-office-screenshots.mjs` — capture truthful states, skip impossible ones with documented reasons.
- `docs/design/swarm-office-v1.1/gap-audit.md` — update with Issue #27 findings.
- `docs/design/swarm-office-v1.1/accessibility-notes.md` — new.
- `docs/design/swarm-office-v1.1/performance-lifecycle-notes.md` — new.
- `docs/design/swarm-office-v1.1/issue-14-closure-audit.md` — new.
- Tests for new mock scenarios and any UI changes.

### Out of scope

- New gameplay systems.
- Protocol / reducer / RuntimeSession / backend transport changes.
- New AI model training.
- Refactoring unrelated existing code.

## Global Constraints

- **Truthful states only.** If a state cannot be produced by real events flowing through the existing projection pipeline, it must be skipped and the reason documented. No synthetic state injection in the UI layer.
- **No protocol changes.** Use existing `EventType`, `CommandType`, and snapshot fields only.
- **Browser-side code never owns canonical state.** UI changes remain presentation-only.
- **No `Date.now` / `setTimeout` / `Math.random` in reducer/projection logic.** Demo-layer scripts may use them only for playback timing.
- **Minimum code.** Each change must trace directly to a task requirement or a failing test.

---

## Task 0: Truthful mock scenarios

### Objective

Extend `MockRuntimeAdapter` so that the demo can truthfully produce the following runtime and artifact states that are currently unreachable:

- `agent.status === "failed"` or `task.status === "failed"` (runtime failure path)
- `runtime/session` degraded or disconnected state visible in `StatusStrip`
- `artifact.uri === null` → `unavailable`
- `artifact` with unsupported MIME/type → `unsupported-open`
- `artifact.open` returning a failure → `failed-open`

### What to change

1. `packages/adapters/mock/src/mock-adapter.ts`
   - Add a new public method `playRuntimeFailureFlow()` that emits a sequence producing an agent with `status: "failed"` and a task with `status: "failed"` through existing event types (e.g., `ERROR_RAISED` + `AGENT_STATUS_CHANGED` + `TASK_FAILED` if the reducer supports it; otherwise use the event types that the reducer maps to `failed`).
   - Add a new public method `playRuntimeDegradedFlow()` or a deterministic path that causes `sessionState` / diagnostics to surface degraded connectivity (only if the existing `RuntimeSession` + adapter can truthfully emit a `degraded` stream state; if not, document skip).
   - Add a new public method `playArtifactUnavailableFlow()` that creates an artifact with `uri: null`.
   - Add a new public method `playArtifactUnsupportedOpenFlow()` that creates an artifact whose type is not in the current profile's `inputArtifactTypes`, so that `ARTIFACT_OPEN` returns a truthful `unsupported` rejection.
   - Add a new public method `playArtifactFailedOpenFlow()` that creates an artifact and, when `ARTIFACT_OPEN` is executed, returns a command rejection with a `failed-open` code.
   - Keep the existing `playNormalFlow`, `playErrorFlow`, `playRevisionFlow` unchanged.

2. `packages/adapters/mock/src/mock-adapter.test.ts`
   - Add TDD tests for each new scenario:
     - After `playRuntimeFailureFlow`, at least one agent has `status === "failed"` or a task has `status === "failed"`.
     - After `playArtifactUnavailableFlow`, the created artifact has `uri === null`.
     - `ARTIFACT_OPEN` on an unsupported artifact returns `status === "rejected"` with an appropriate error code.
     - `ARTIFACT_OPEN` on a failed-open artifact returns `status === "rejected"` / error.
   - Watch each test fail first, then implement the minimal mock change.

3. `apps/demo-office/src/DemoControls.tsx`
   - Add buttons for the new truthful scenarios:
     - "异常: 运行失败"
     - "异常: 工件不可用"
     - "异常: 打开失败"
   - (Only add "异常: 运行降级" if Task 0 confirms the adapter can truthfully produce it; otherwise omit.)

4. `apps/demo-office/src/App.tsx` / `StatusStrip.tsx`
   - Verify that `StatusStrip` already correctly surfaces session degraded / failed states (from #25). If a gap is found, fix with TDD.
   - Verify that failed agents/tasks render correctly in canvas and panel (already implemented in #25). If a gap is found, fix with TDD.

### Verification

- `npm test -- packages/adapters/mock/src/mock-adapter.test.ts` passes with new tests.
- New scenario buttons can be clicked in the running demo and produce the expected projection state.
- No synthetic state is injected outside the adapter's event pipeline.

---

## Task 1: Extend visual QA

### Objective

Add screenshots and annotations for the truthful states produced in Task 0. Skip states that remain impossible and state the reason.

### What to change

1. `scripts/capture-demo-office-screenshots.mjs`
   - Add capture steps for each new truthful scenario button added in Task 0.
   - Name new screenshots consistently:
     - `11-domain-task-agent-failed`
     - `12-artifact-unavailable`
     - `13-artifact-failed-open`
     - `14-artifact-open-rejected` (if reachable)
   - Keep the existing 01–10 states.
   - Keep dimension / overflow assertions for every captured state.
   - Update the `skippedStates` list at the bottom:
     - Remove any state that is now truthfully produced.
     - Keep skip entries for states that are still impossible, with explicit reasons.

2. `docs/design/swarm-office-v1.1/gap-audit.md`
   - Add an "Issue #27 truthful-state pass" section.
   - List which new states are now baselined.
   - List which states remain skipped and why.
   - Update the "Accepted deviations" paragraph if needed.

3. `scripts/generate-annotated-comparisons.mjs`
   - Regenerate annotated comparisons for all captured states (existing 01–10 + new 11–14) using the 1440×900 source set.
   - Ensure annotations call out truthful failure / unavailable / unsupported cues.

### Verification

- `node scripts/capture-demo-office-screenshots.mjs` passes (all reachable states × 3 resolutions).
- `node scripts/generate-annotated-comparisons.mjs` passes.
- Every new PNG has a corresponding HTML annotated comparison.
- Skipped states are explicitly listed with reasons in both the script output and `gap-audit.md`.

---

## Task 2: Accessibility baseline

### Objective

Submit `accessibility-notes.md` documenting the current accessibility posture of `apps/demo-office`, with concrete evidence and gaps.

### What to produce

`docs/design/swarm-office-v1.1/accessibility-notes.md` covering:

1. **Keyboard navigation**
   - Mode switcher arrow / Home / End behavior.
   - Control-panel card Tab / Enter / Space selection.
   - Escape to clear selection.
   - Any gaps (e.g., canvas cannot be keyboard-navigated to select agents).

2. **Focus management**
   - Focus indicators on mode buttons, view toggles, motion toggle, cards.
   - Focus retention across mode / view switches.

3. **Selection communication**
   - `aria-selected` / `aria-pressed` usage.
   - Non-color selection cues (outlines, badges, labels).

4. **Reduced motion**
   - `prefers-reduced-motion` media query support.
   - Motion on/off toggle behavior and what it suppresses.

5. **Non-color state cues**
   - Blocked / failed / revision_required / unavailable states use icons, labels, or shapes in addition to color.

6. **Screen-reader labels**
   - Canvas `aria-label`.
   - Status strip live region behavior.
   - Any missing labels.

7. **Gaps and next steps**
   - List anything not yet implemented (e.g., agent role announcements, canvas keyboard access).

### Verification

- Document is present and complete.
- Claims are backed by code references or test evidence.
- No false claims of accessibility that are not implemented.

---

## Task 3: Performance / lifecycle evidence

### Objective

Submit `performance-lifecycle-notes.md` documenting Pixi lifecycle, motion toggle, asset fallback, and representative agent loads.

### What to produce

`docs/design/swarm-office-v1.1/performance-lifecycle-notes.md` covering:

1. **PixiJS application lifecycle**
   - How `PixelOfficeScene` initializes, updates, and destroys.
   - Cleanup on view switch (pixel ↔ list) and mode switch.
   - Evidence that multiple `init`/`destroy` cycles do not leak.

2. **Motion toggle lifecycle**
   - What happens when the user toggles "Motion on/off".
   - How `setReduceMotion` propagates to renderers.
   - Reduced-motion media query override.

3. **Asset fallback**
   - What happens when textures / sprites fail to load.
   - Procedural fallback (e.g., colored rectangles) and its limits.

4. **Representative loads**
   - Behavior at 4, 12, and 30 agents.
   - How the renderer handles larger counts (culling, batching, or limits).
   - Note: actual 30-agent simulation may not exist; document the renderer's capacity with a synthetic projection or note the limitation honestly.

5. **Memory / CPU observations**
   - If available, include browser DevTools notes.
   - Otherwise document the methodology and any blockers.

### Verification

- Document is present and complete.
- Claims are backed by code references or reproducible steps.
- No fabricated benchmark numbers.

---

## Task 4: #14 closure audit

### Objective

Submit `issue-14-closure-audit.md` mapping each #14 acceptance criterion to evidence and rendering a final verdict.

### What to produce

`docs/design/swarm-office-v1.1/issue-14-closure-audit.md` with:

1. **#14 acceptance criteria** (copied from `docs/superpowers/plans/2026-07-07-issue-14-phase3-swarm-office-v1.1.md`):
   - All 8 required states are captured as baseline screenshots.
   - Each baseline has a corresponding annotated comparison.
   - `gap-audit.md` contains a prioritized, actionable gap list.
   - PR is created with design artifacts and a plan for implementation.

2. **Evidence mapping**
   - For each criterion, list the files / screenshots / PRs that satisfy it.
   - Note any reinterpretation required (e.g., state 06 became "revision / rework required" because true runtime failure was not truthfully reachable until Task 0).

3. **Verdict per criterion**
   - Satisfied / Partially satisfied / Not satisfied.
   - Brief justification.

4. **Overall verdict**
   - **Close #14** or **Keep #14 open**.
   - If open, list the exact remaining blockers.

### Verification

- Document is present and complete.
- All claims reference concrete artifacts.
- Verdict is consistent with the evidence in Tasks 0–3.

---

## Acceptance Criteria for Issue #27

- [ ] Mock adapter truthfully produces at least: runtime-failed agent/task, artifact-unavailable, artifact-failed-open.
- [ ] Visual QA captures all newly reachable truthful states across 1366×768, 1440×900, and 1920×1080.
- [ ] Impossible states are skipped with documented reasons.
- [ ] `accessibility-notes.md` is submitted and covers keyboard, focus, selection, reduced-motion, and non-color cues.
- [ ] `performance-lifecycle-notes.md` is submitted and covers Pixi lifecycle, motion toggle, asset fallback, and representative loads.
- [ ] `issue-14-closure-audit.md` is submitted with a line-by-line mapping and a final verdict.
- [ ] All tests pass (`npm test -- --run`).
- [ ] Build passes (`npm run build`).
- [ ] Screenshot and annotation scripts pass.

## PR Relationship

- This PR should use `Closes #27` and `Refs #14`.
- It must **not** close #14 unless the closure audit verdict is "Close #14" and all criteria are satisfied.

## Cleanup

Before opening the PR, remove the stale SDD process files from the workspace (untracked `.superpowers/` scratch files and old task review packages under `docs/superpowers/plans/` that are not part of the deliverables). Do not delete the new plan file or the three evidence `.md` files.
