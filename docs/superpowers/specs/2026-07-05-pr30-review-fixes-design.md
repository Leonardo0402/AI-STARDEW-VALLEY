# PR #30 Review Fixes — Design Spec

**Date:** 2026-07-05
**Worktree:** `.worktrees/issue-27/`
**PR:** #30 (Closes #27 / Closes #14)
**Head:** `8ed6a72` (CI green, mergeable)

## Context

PR #30 review surfaced 4 blockers. After verification against the codebase:

- **Blocker 1** (closure audit scope): The audit correctly maps #14's 4 evidence criteria as defined in the #14 plan. The 10 broader items (renderer, real states, accessibility, etc.) belong to #23/#25/#27 scope, not #14. Resolution: keep the 4-criteria closure, add a Scope clarification appendix.
- **Blocker 2** (screenshot state name mismatch): Verified — script state `14-artifact-unsupported-open` waits for `"Open failed."` text, which is the `failed-open` visual, not `unsupported-open`. The `unsupported-open` state only renders when the adapter's `capabilities.supportedCommands` excludes `ARTIFACT_OPEN`; the mock supports it but returns a rejection, so it falls into `failed-open`.
- **Blocker 3** (runtime failure misnomer): Verified — `playRuntimeFailureFlow()` emits `ERROR_RAISED` + `TASK_FAILED` + `AGENT_STATUS_CHANGED→failed`, which is a domain-level failure, not a session transport failure. State `11-runtime-failed` is misnamed.
- **Blocker 4** (accessibility gaps): Verified — `accessibility-notes.md` lists 6 gaps (2 High, 2 Medium, 2 Low). These are known follow-ups for the accessibility baseline, not blockers for #27 closure.

## Decisions (confirmed with user)

| Blocker | Decision |
|---------|----------|
| 1 | Keep 4-criteria closure. Add Scope clarification + Supporting evidence appendix. Do not expand #14 closure criteria. |
| 2 | Plan B: rename `14-artifact-unsupported-open` → `14-artifact-open-rejected` across script, docs, and all image files. No ControlPanel logic change. |
| 3 | Rename: `11-runtime-failed` → `11-domain-task-agent-failed` across script, docs, and all image files. Update DemoControls button text `异常: 运行失败` → `异常: 任务失败`. Add clarifying doc comments. `playRuntimeFailureFlow()` function name preserved. |
| 4 | Add `#27 acceptance criteria mapping` table to `accessibility-notes.md`. Status values: `done` / `accepted deviation` / `documented follow-up`. Do NOT use `follow-up required` (would imply #27 can't close). |

## Scope

### In scope
- Rename state 11 and state 14 across: capture script, gap-audit.md, issue-14-closure-audit.md, DemoControls button text, playRuntimeFailureFlow JSDoc, all baseline image files (3 resolutions), all annotated comparison files (PNG + HTML), all `.issue-28-evidence` screenshot files (3 resolutions).
- Add Scope clarification appendix to issue-14-closure-audit.md.
- Add #27 acceptance criteria mapping table to accessibility-notes.md.
- Update gap-audit.md state 11 description to clarify domain failure vs session transport failure.
- Run screenshot capture script to regenerate renamed images (or git mv if regeneration not needed).
- Run tests + build to verify no regressions.
- Commit + push to update PR #30.

### Out of scope
- Do NOT modify #14 plan itself.
- Do NOT modify ControlPanel.tsx `classifyArtifactContentState` logic.
- Do NOT rename `playRuntimeFailureFlow()` function.
- Do NOT add a session transport failure fixture.
- Do NOT start Issue #12 or any visual redesign.
- Do NOT change PR #30's `Closes #27 / Closes #14` closure intent.

## Blocker-by-Blocker Design

### Blocker 1: issue-14-closure-audit.md — Scope clarification

**File:** `docs/design/swarm-office-v1.1/issue-14-closure-audit.md`

**Change:** After the existing 4-criteria evidence mapping, append two new sections:

**Section: "Scope clarification"**
- State that #14 closure criteria are the 4 evidence items defined in `docs/superpowers/plans/2026-07-07-issue-14-phase3-swarm-office-v1.1.md` (lines 92-97).
- State that #23 (implementation), #25 (follow-up hardening), and #27 (final gate) are derivative issues providing supporting hardening around #14's evidence scope.
- Explicitly declare: these derivative issues' requirements are NOT retroactively promoted to #14 closure criteria.

**Section: "Supporting evidence appendix"**
- One-line-per-issue summary:
  - #23 (Swarm Office V1.1 implementation): canvas foundation, role sprites, approval/blocked/failed moments, focus/debrief refinement, micro-animation/reduced-motion, visual QA gate — delivered.
  - #25 (follow-up hardening): reference if applicable.
  - #27 (final gate): truthful artifact experience, accessibility baseline, renderer lifecycle/performance evidence, #14 closure audit — delivered via PR #30.

### Blocker 2: State 14 rename — artifact-unsupported-open → artifact-open-rejected

**Files to change:**

1. `scripts/capture-demo-office-screenshots.mjs`
   - Line 341: `await captureHere("14-artifact-unsupported-open");` → `await captureHere("14-artifact-open-rejected");`

2. `docs/design/swarm-office-v1.1/gap-audit.md`
   - All references to `14-artifact-unsupported-open` → `14-artifact-open-rejected`
   - State 14 description: clarify this is `failed-open` (command supported, returned error), not `unsupported-open` (command not in capabilities)

3. `docs/design/swarm-office-v1.1/issue-14-closure-audit.md`
   - Any reference to state 14 name → `14-artifact-open-rejected`

4. **Image files** (rename via `git mv` or regenerate):
   - `docs/design/swarm-office-v1.1/baseline/1366x768/14-artifact-unsupported-open.png` → `14-artifact-open-rejected.png`
   - `docs/design/swarm-office-v1.1/baseline/1440x900/14-artifact-unsupported-open.png` → `14-artifact-open-rejected.png`
   - `docs/design/swarm-office-v1.1/baseline/1920x1080/14-artifact-unsupported-open.png` → `14-artifact-open-rejected.png`
   - `docs/design/swarm-office-v1.1/annotated-comparisons/14-artifact-unsupported-open-annotated.png` → `14-artifact-open-rejected-annotated.png`
   - `docs/design/swarm-office-v1.1/annotated-comparisons/14-artifact-unsupported-open.html` → `14-artifact-open-rejected.html`
   - `.issue-28-evidence/screenshots/1366x768/14-artifact-unsupported-open.png` → `14-artifact-open-rejected.png`
   - `.issue-28-evidence/screenshots/1440x900/14-artifact-unsupported-open.png` → `14-artifact-open-rejected.png`
   - `.issue-28-evidence/screenshots/1920x1080/14-artifact-unsupported-open.png` → `14-artifact-open-rejected.png`

**Not changed:** `ControlPanel.tsx` `classifyArtifactContentState` logic. The `unsupported-open` state class still exists in code (triggered when adapter doesn't support `ARTIFACT_OPEN`); the mock adapter supports it but returns an error, so the visual is `failed-open`. The renamed state name now matches what the screenshot proves.

### Blocker 3: State 11 rename — runtime-failed → domain-task-agent-failed

**Files to change:**

1. `scripts/capture-demo-office-screenshots.mjs`
   - Line 313: `await captureHere("11-runtime-failed");` → `await captureHere("11-domain-task-agent-failed");`

2. `apps/demo-office/src/DemoControls.tsx`
   - Line 53: Button text `异常: 运行失败` → `异常: 任务失败`

3. `packages/adapters/mock/src/mock-adapter.ts`
   - Lines 879-882: Update `playRuntimeFailureFlow()` JSDoc to clarify: "Produces domain-level task/agent failure via ERROR_RAISED + TASK_FAILED + AGENT_STATUS_CHANGED. This is NOT a session/transport failure — session transport failures are surfaced via StatusStrip's failed/disconnected states."
   - Function name `playRuntimeFailureFlow` preserved.

4. `docs/design/swarm-office-v1.1/gap-audit.md`
   - Line 69: `11-runtime-failed` → `11-domain-task-agent-failed`
   - Line 74: `11-runtime-failed` → `11-domain-task-agent-failed`
   - Line 104: State name and description updated
   - Line 133: State name and description updated; add clarifying note about domain failure vs session transport failure

5. `docs/design/swarm-office-v1.1/issue-14-closure-audit.md`
   - Line 35: `11 Runtime failed` → `11 Domain task / agent failed`; path `11-runtime-failed.png` → `11-domain-task-agent-failed.png`

6. **Image files** (rename via `git mv` or regenerate):
   - `docs/design/swarm-office-v1.1/baseline/1366x768/11-runtime-failed.png` → `11-domain-task-agent-failed.png`
   - `docs/design/swarm-office-v1.1/baseline/1440x900/11-runtime-failed.png` → `11-domain-task-agent-failed.png`
   - `docs/design/swarm-office-v1.1/baseline/1920x1080/11-runtime-failed.png` → `11-domain-task-agent-failed.png`
   - `docs/design/swarm-office-v1.1/annotated-comparisons/11-runtime-failed-annotated.png` → `11-domain-task-agent-failed-annotated.png`
   - `docs/design/swarm-office-v1.1/annotated-comparisons/11-runtime-failed.html` → `11-domain-task-agent-failed.html`
   - `.issue-28-evidence/screenshots/1366x768/11-runtime-failed.png` → `11-domain-task-agent-failed.png`
   - `.issue-28-evidence/screenshots/1440x900/11-runtime-failed.png` → `11-domain-task-agent-failed.png`
   - `.issue-28-evidence/screenshots/1920x1080/11-runtime-failed.png` → `11-domain-task-agent-failed.png`

**Image approach:** Use `git mv` for all 16 image/html files (8 for state 11 + 8 for state 14). This preserves git history and avoids re-running the screenshot script (which requires a browser environment). The image content is unchanged — only filenames change. If `git mv` is impractical for tracked files in the worktree, fall back to regular rename + `git add`.

### Blocker 4: accessibility-notes.md — #27 mapping table

**File:** `docs/design/swarm-office-v1.1/accessibility-notes.md`

**Change:** After the existing "Known gaps & roadmap" section, append a new section:

**Section: "#27 acceptance criteria mapping"**

Map #27's acceptance criteria (from `2026-07-09-issue-27-swarm-office-final-gate.md` lines 258-268) to status values. Allowed status values: `done`, `accepted deviation`, `documented follow-up`. Do NOT use `follow-up required`.

Mapping (9 criteria from #27):

| # | #27 Criterion | Status | Notes |
|---|---|---|---|
| 1 | Mock adapter truthfully produces runtime-failed agent/task, artifact-unavailable, artifact-failed-open | done | Via playRuntimeFailureFlow, playArtifactUnavailableFlow, playArtifactFailedOpenFlow |
| 2 | Visual QA captures all truthful states across 1366×768, 1440×900, 1920×1080 | done | Baseline screenshots in 3 resolutions |
| 3 | Impossible states skipped with documented reasons | done | gap-audit.md "Accepted deviations" section |
| 4 | accessibility-notes.md covers keyboard, focus, selection, reduced-motion, non-color cues | done | Submitted with this PR |
| 5 | performance-lifecycle-notes.md covers Pixi lifecycle, motion toggle, asset fallback, representative loads | done | Submitted with this PR |
| 6 | issue-14-closure-audit.md with line-by-line mapping and final verdict | done | Submitted with this PR |
| 7 | All tests pass | done | `npm test -- --run` passes |
| 8 | Build passes | done | `npm run build` passes |
| 9 | Screenshot and annotation scripts pass | done | Scripts run successfully |

**Accessibility gap mapping** (the 6 known gaps, mapped to status):

| Gap | Priority | Status | Notes |
|---|---|---|---|
| Canvas not keyboard operable | High | accepted deviation | Canvas is inherently non-keyboard-navigable; ARIA overlay approach documented as follow-up |
| Missing aria-live region | High | accepted deviation | Follow-up to add aria-live for state transitions |
| Missing skip link | Medium | documented follow-up | Low-impact for single-page demo; add in future iteration |
| FocusPanel cards not selectable | Medium | documented follow-up | Add keyboard selection in future iteration |
| Event log filter input missing label | Low | documented follow-up | Minor a11y polish |
| Canvas agent missing ARIA name | Low | documented follow-up | Minor a11y polish |

## Implementation Notes

### Execution order
1. Blocker 1 (audit doc edits) — no dependencies
2. Blocker 2 (state 14 rename: script + docs + git mv images)
3. Blocker 3 (state 11 rename: script + DemoControls + JSDoc + docs + git mv images)
4. Blocker 4 (accessibility mapping table)
5. Run `npm test -- --run` and `npm run build` in the worktree
6. Commit + push to update PR #30

### Verification
- `npm test -- --run` passes (291+ tests)
- `npm run build` passes
- `git status` shows no `11-runtime-failed` or `14-artifact-unsupported-open` files remaining
- `grep -r "11-runtime-failed" .` returns no matches (excluding `.git/`)
- `grep -r "14-artifact-unsupported-open" .` returns no matches (excluding `.git/`)

### Risks
- **`.issue-28-evidence/` directory**: This is issue-28 evidence, not part of the #27 deliverables. Renaming its files keeps consistency but may affect issue-28 traceability. Mitigation: issue-28 is closed; these are historical evidence only.
- **`git mv` on tracked files in worktree**: Should work normally. If not, fall back to delete + add.
- **HTML files in annotated-comparisons**: May contain internal references to the old state name (e.g., `<title>` or `<img src>`). Need to check and update internal references during rename.
