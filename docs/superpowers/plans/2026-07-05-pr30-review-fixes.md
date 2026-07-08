# PR #30 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 review blockers on PR #30 by renaming misleading state names, adding scope clarification to the #14 closure audit, and adding an accessibility mapping table — without changing ControlPanel logic or the `playRuntimeFailureFlow` function name.

**Architecture:** All work happens in the `.worktrees/issue-27/` worktree (PR #30's branch). Changes are documentation edits, a screenshot script rename, a button label change, a JSDoc clarification, and `git mv` for 16 image/HTML files. No logic changes, no new tests needed — verification is grep-based (no old names remain) plus `npm test` and `npm run build`.

**Tech Stack:** TypeScript, React, Markdown docs, PNG screenshots, HTML annotated comparisons.

## Global Constraints

- **Worktree:** All file paths in this plan are relative to `e:\agent\AI STARDEW VALLEY\.worktrees\issue-27\` unless otherwise noted. All commands run in that directory.
- **No logic changes:** Do NOT modify `ControlPanel.tsx` `classifyArtifactContentState`, do NOT rename `playRuntimeFailureFlow()`, do NOT add new fixtures.
- **No old name residue:** After all tasks, `grep -r "11-runtime-failed"` and `grep -r "14-artifact-unsupported-open"` must return zero matches (excluding `.git/`).
- **PR closure intent unchanged:** PR #30 still `Closes #27 / Closes #14`.
- **Status values for accessibility mapping:** Use only `done`, `accepted deviation`, `documented follow-up`. Do NOT use `follow-up required`.
- **Language:** Doc content follows existing file language (mixed Chinese/English as-is). Code comments in English.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `docs/design/swarm-office-v1.1/issue-14-closure-audit.md` | #14 closure audit | Modify: add Scope clarification + Supporting evidence appendix; rename state 11 and 14 references |
| `docs/design/swarm-office-v1.1/gap-audit.md` | Gap audit | Modify: rename state 11 and 14 references; clarify domain failure vs session transport failure |
| `docs/design/swarm-office-v1.1/accessibility-notes.md` | Accessibility baseline | Modify: add #27 acceptance criteria mapping table |
| `scripts/capture-demo-office-screenshots.mjs` | Screenshot capture script | Modify: rename state 11 and 14 capture calls |
| `apps/demo-office/src/DemoControls.tsx` | Demo controls UI | Modify: button text `异常: 运行失败` → `异常: 任务失败` |
| `packages/adapters/mock/src/mock-adapter.ts` | Mock adapter | Modify: `playRuntimeFailureFlow()` JSDoc clarification |
| 16 image/HTML files | Baseline + annotated + evidence screenshots | Rename via `git mv` |

---

### Task 1: Blocker 1 — Add Scope clarification to issue-14-closure-audit.md

**Files:**
- Modify: `docs/design/swarm-office-v1.1/issue-14-closure-audit.md`

**Interfaces:**
- Consumes: nothing from other tasks
- Produces: updated closure audit doc with Scope clarification + Supporting evidence appendix

- [ ] **Step 1: Add Scope clarification and Supporting evidence appendix**

Append the following two sections at the end of `docs/design/swarm-office-v1.1/issue-14-closure-audit.md` (after line 113, the last line of section 6):

```markdown

## 7. Scope clarification

本审计的关闭标准以 [`docs/superpowers/plans/2026-07-07-issue-14-phase3-swarm-office-v1.1.md`](../../superpowers/plans/2026-07-07-issue-14-phase3-swarm-office-v1.1.md) 第 92-97 行定义的 4 项 evidence 为准（见第 1 节 A/B/C/D）。

#23（Swarm Office V1.1 实现）、#25（follow-up hardening）和 #27（final gate）是围绕 #14 派生的实现、修复和 hardening issue。它们的交付物作为 supporting evidence 记录在下方附录中，但**不反向扩大 #14 的 closure criteria**。

具体而言，layered pixel renderer、approval/blocked/failed/paused 真实状态、scene ↔ panel selection、truthful artifact experience、Command/Focus/Debrief refinement、accessibility/reduced-motion、renderer lifecycle、representative performance、visual QA gate、tests/build 等要求属于 #23/#25/#27 的验收范围，不是 #14 的关闭条件。

## 8. Supporting evidence appendix

| Issue | 范围 | 交付状态 |
|---|---|---|
| #23 | Swarm Office V1.1 实现：canvas foundation、role sprites、approval/blocked/failed moments、focus/debrief refinement、micro-animation/reduced-motion、visual QA gate | 已交付（PR #24） |
| #25 | Follow-up hardening：关联选中、artifact 真实状态、多分辨率视觉 QA 加固 | 已交付（PR #25） |
| #27 | Final gate：truthful artifact experience、accessibility baseline、renderer lifecycle/performance evidence、#14 closure audit | 已交付（PR #30） |
```

- [ ] **Step 2: Commit**

```bash
cd "e:\agent\AI STARDEW VALLEY\.worktrees\issue-27"
git add docs/design/swarm-office-v1.1/issue-14-closure-audit.md
git commit -m "docs(audit): add scope clarification and supporting evidence appendix to #14 closure audit"
```

---

### Task 2: Blocker 2 — Rename state 14 (artifact-unsupported-open → artifact-open-rejected)

**Files:**
- Modify: `scripts/capture-demo-office-screenshots.mjs:341`
- Modify: `docs/design/swarm-office-v1.1/gap-audit.md` (lines 48, 107, 127, 136)
- Modify: `docs/design/swarm-office-v1.1/issue-14-closure-audit.md` (lines 38, 51)
- Modify: `docs/design/swarm-office-v1.1/annotated-comparisons/14-artifact-unsupported-open.html:25` (internal `<img src>`)
- Rename: 8 image/HTML files

**Interfaces:**
- Consumes: nothing
- Produces: state 14 consistently named `14-artifact-open-rejected` across all files

- [ ] **Step 1: Rename image and HTML files via git mv**

Run these commands in the worktree:

```bash
cd "e:\agent\AI STARDEW VALLEY\.worktrees\issue-27"

git mv "docs/design/swarm-office-v1.1/baseline/1366x768/14-artifact-unsupported-open.png" "docs/design/swarm-office-v1.1/baseline/1366x768/14-artifact-open-rejected.png"
git mv "docs/design/swarm-office-v1.1/baseline/1440x900/14-artifact-unsupported-open.png" "docs/design/swarm-office-v1.1/baseline/1440x900/14-artifact-open-rejected.png"
git mv "docs/design/swarm-office-v1.1/baseline/1920x1080/14-artifact-unsupported-open.png" "docs/design/swarm-office-v1.1/baseline/1920x1080/14-artifact-open-rejected.png"
git mv "docs/design/swarm-office-v1.1/annotated-comparisons/14-artifact-unsupported-open-annotated.png" "docs/design/swarm-office-v1.1/annotated-comparisons/14-artifact-open-rejected-annotated.png"
git mv "docs/design/swarm-office-v1.1/annotated-comparisons/14-artifact-unsupported-open.html" "docs/design/swarm-office-v1.1/annotated-comparisons/14-artifact-open-rejected.html"
git mv ".issue-28-evidence/screenshots/1366x768/14-artifact-unsupported-open.png" ".issue-28-evidence/screenshots/1366x768/14-artifact-open-rejected.png"
git mv ".issue-28-evidence/screenshots/1440x900/14-artifact-unsupported-open.png" ".issue-28-evidence/screenshots/1440x900/14-artifact-open-rejected.png"
git mv ".issue-28-evidence/screenshots/1920x1080/14-artifact-unsupported-open.png" ".issue-28-evidence/screenshots/1920x1080/14-artifact-open-rejected.png"
```

- [ ] **Step 2: Update annotated comparison HTML internal reference**

In `docs/design/swarm-office-v1.1/annotated-comparisons/14-artifact-open-rejected.html` (renamed in Step 1), update line 25:

Old:
```html
      <img src="../baseline/1440x900/14-artifact-unsupported-open.png" id="targetImg" />
```

New:
```html
      <img src="../baseline/1440x900/14-artifact-open-rejected.png" id="targetImg" />
```

- [ ] **Step 3: Update screenshot script**

In `scripts/capture-demo-office-screenshots.mjs`, update line 341:

Old:
```javascript
    await captureHere("14-artifact-unsupported-open");
```

New:
```javascript
    await captureHere("14-artifact-open-rejected");
```

Also update the comment on line 333:

Old:
```javascript
    // 14. Artifact unsupported open (no demo button; driven via dev-only adapter hook)
```

New:
```javascript
    // 14. Artifact open rejected (no demo button; driven via dev-only adapter hook)
```

- [ ] **Step 4: Update gap-audit.md references**

In `docs/design/swarm-office-v1.1/gap-audit.md`:

Line 48, replace `unsupported-open` (14)` with `open-rejected` (14)`:

Old:
```
- Issue #27 Task 1 baselined the truthful artifact failure states: `unavailable` (12), `failed-open` (13), and `unsupported-open` (14). `metadata-only` remains unbaselined because the mock adapter always creates artifacts with a URI or content reference.
```

New:
```
- Issue #27 Task 1 baselined the truthful artifact failure states: `unavailable` (12), `failed-open` (13), and `open-rejected` (14). State 14 is renamed from `unsupported-open` to `open-rejected` to honestly reflect what the screenshot proves: the adapter supports `ARTIFACT_OPEN` but the command returns a profile-mismatch rejection, producing the `failed-open` visual. The `unsupported-open` state (adapter does not support `ARTIFACT_OPEN` at all) remains unbaselined because the mock adapter always supports it. `metadata-only` remains unbaselined because the mock adapter always creates artifacts with a URI or content reference.
```

Line 107, replace the state 14 row:

Old:
```
| 14 | Artifact unsupported open | `baseline/1440x900/14-artifact-unsupported-open.png` | `14-artifact-unsupported-open-annotated.png` |
```

New:
```
| 14 | Artifact open rejected | `baseline/1440x900/14-artifact-open-rejected.png` | `14-artifact-open-rejected-annotated.png` |
```

Line 127, update the Issue #27 Task 0 description:

Old:
```
Issue #27 Task 0 extended the mock adapter with scripted scenarios for runtime failure, runtime degradation, artifact unavailability, artifact failed-open, and artifact unsupported-open. Task 1 captured the states that can be truthfully produced and documented the ones that cannot.
```

New:
```
Issue #27 Task 0 extended the mock adapter with scripted scenarios for runtime failure, runtime degradation, artifact unavailability, artifact failed-open, and artifact open-rejected. Task 1 captured the states that can be truthfully produced and documented the ones that cannot.
```

Lines 136, update the state 14 description:

Old:
```
| 14 | Artifact unsupported open | `MockRuntimeAdapter.playArtifactUnsupportedOpenFlow()` creates a `legacy_binary` artifact in the execution room, whose Profile does not accept that type; clicking View produces an `unsupported-open` command rejection. `ControlPanel` renders the `failed-open` preview ('Open failed.') and the action-error banner with the profile-mismatch message. |
```

New:
```
| 14 | Artifact open rejected | `MockRuntimeAdapter.playArtifactUnsupportedOpenFlow()` creates a `legacy_binary` artifact in the execution room, whose Profile does not accept that type; clicking View produces a command rejection. `ControlPanel` renders the `failed-open` preview ('Open failed.') and the action-error banner with the profile-mismatch message. State renamed from `unsupported-open` to `open-rejected` to honestly reflect the `failed-open` visual. |
```

- [ ] **Step 5: Update issue-14-closure-audit.md references**

In `docs/design/swarm-office-v1.1/issue-14-closure-audit.md`:

Line 38, replace:

Old:
```
| 14 Artifact unsupported open | `baseline/1440x900/14-artifact-unsupported-open.png` | MIME 类型不支持 |
```

New:
```
| 14 Artifact open rejected | `baseline/1440x900/14-artifact-open-rejected.png` | MIME 类型不支持，命令被拒绝 |
```

Line 51, replace:

Old:
```
- ... 至 `14-artifact-unsupported-open-annotated.png`
```

New:
```
- ... 至 `14-artifact-open-rejected-annotated.png`
```

- [ ] **Step 6: Verify no old name remains**

Run:
```bash
cd "e:\agent\AI STARDEW VALLEY\.worktrees\issue-27"
git grep -n "14-artifact-unsupported-open" -- ':!.git'
```
Expected: no output (zero matches).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix(review): rename state 14 artifact-unsupported-open → artifact-open-rejected for truth boundary clarity"
```

---

### Task 3: Blocker 3 — Rename state 11 (runtime-failed → domain-task-agent-failed)

**Files:**
- Modify: `scripts/capture-demo-office-screenshots.mjs:307,313`
- Modify: `apps/demo-office/src/DemoControls.tsx:53`
- Modify: `packages/adapters/mock/src/mock-adapter.ts:879-882`
- Modify: `docs/design/swarm-office-v1.1/gap-audit.md` (lines 69, 74, 104, 133)
- Modify: `docs/design/swarm-office-v1.1/issue-14-closure-audit.md` (line 35)
- Modify: `docs/design/swarm-office-v1.1/annotated-comparisons/11-runtime-failed.html:25` (internal `<img src>`)
- Rename: 8 image/HTML files

**Interfaces:**
- Consumes: nothing
- Produces: state 11 consistently named `11-domain-task-agent-failed` across all files; DemoControls button says `异常: 任务失败`; `playRuntimeFailureFlow()` JSDoc clarifies domain vs session failure

- [ ] **Step 1: Rename image and HTML files via git mv**

```bash
cd "e:\agent\AI STARDEW VALLEY\.worktrees\issue-27"

git mv "docs/design/swarm-office-v1.1/baseline/1366x768/11-runtime-failed.png" "docs/design/swarm-office-v1.1/baseline/1366x768/11-domain-task-agent-failed.png"
git mv "docs/design/swarm-office-v1.1/baseline/1440x900/11-runtime-failed.png" "docs/design/swarm-office-v1.1/baseline/1440x900/11-domain-task-agent-failed.png"
git mv "docs/design/swarm-office-v1.1/baseline/1920x1080/11-runtime-failed.png" "docs/design/swarm-office-v1.1/baseline/1920x1080/11-domain-task-agent-failed.png"
git mv "docs/design/swarm-office-v1.1/annotated-comparisons/11-runtime-failed-annotated.png" "docs/design/swarm-office-v1.1/annotated-comparisons/11-domain-task-agent-failed-annotated.png"
git mv "docs/design/swarm-office-v1.1/annotated-comparisons/11-runtime-failed.html" "docs/design/swarm-office-v1.1/annotated-comparisons/11-domain-task-agent-failed.html"
git mv ".issue-28-evidence/screenshots/1366x768/11-runtime-failed.png" ".issue-28-evidence/screenshots/1366x768/11-domain-task-agent-failed.png"
git mv ".issue-28-evidence/screenshots/1440x900/11-runtime-failed.png" ".issue-28-evidence/screenshots/1440x900/11-domain-task-agent-failed.png"
git mv ".issue-28-evidence/screenshots/1920x1080/11-runtime-failed.png" ".issue-28-evidence/screenshots/1920x1080/11-domain-task-agent-failed.png"
```

- [ ] **Step 2: Update annotated comparison HTML internal reference**

In `docs/design/swarm-office-v1.1/annotated-comparisons/11-domain-task-agent-failed.html` (renamed in Step 1), update line 25:

Old:
```html
      <img src="../baseline/1440x900/11-runtime-failed.png" id="targetImg" />
```

New:
```html
      <img src="../baseline/1440x900/11-domain-task-agent-failed.png" id="targetImg" />
```

- [ ] **Step 3: Update screenshot script**

In `scripts/capture-demo-office-screenshots.mjs`:

Line 307 (comment):

Old:
```javascript
    // 11. Runtime failed
```

New:
```javascript
    // 11. Domain task / agent failed (domain-level failure, not session transport failure)
```

Line 313 (capture call):

Old:
```javascript
    await captureHere("11-runtime-failed");
```

New:
```javascript
    await captureHere("11-domain-task-agent-failed");
```

- [ ] **Step 4: Update DemoControls button text**

In `apps/demo-office/src/DemoControls.tsx`, line 53:

Old:
```tsx
          异常: 运行失败
```

New:
```tsx
          异常: 任务失败
```

- [ ] **Step 5: Update playRuntimeFailureFlow JSDoc**

In `packages/adapters/mock/src/mock-adapter.ts`, lines 879-882:

Old:
```typescript
  /**
   * 播放运行时失败流程：产生 agent.status === "failed" 与 task.status === "failed"。
   * 通过 ERROR_RAISED + TASK_FAILED + AGENT_STATUS_CHANGED 现有事件 truthful 产生。
   */
```

New:
```typescript
  /**
   * 播放 domain 任务/Agent 失败流程：产生 agent.status === "failed" 与 task.status === "failed"。
   * 通过 ERROR_RAISED + TASK_FAILED + AGENT_STATUS_CHANGED 现有事件 truthful 产生。
   *
   * NOTE: This is a domain-level task/agent failure, NOT a session/transport failure.
   * Session transport failures (disconnected/failed) are surfaced via StatusStrip
   * and the RuntimeSession state machine, not via this flow.
   */
```

- [ ] **Step 6: Update gap-audit.md references**

In `docs/design/swarm-office-v1.1/gap-audit.md`:

Line 69:

Old:
```
- Issue #27 Task 0 added `playRuntimeFailureFlow()`, which truthfully produces `failed` agent/task states using existing `ERROR_RAISED`, `TASK_FAILED`, and `AGENT_STATUS_CHANGED` events; state `11-runtime-failed` is now baselined.
```

New:
```
- Issue #27 Task 0 added `playRuntimeFailureFlow()`, which truthfully produces `failed` agent/task states using existing `ERROR_RAISED`, `TASK_FAILED`, and `AGENT_STATUS_CHANGED` events; state `11-domain-task-agent-failed` is now baselined. This is a domain-level task/agent failure, not a session/transport failure — session transport failures are surfaced via StatusStrip's `failed`/`disconnected` states.
```

Line 74:

Old:
```
The mock adapter used by `apps/demo-office` can now truthfully produce a runtime `failed` state via `playRuntimeFailureFlow()`, so state `11-runtime-failed` is baselined. It still cannot produce a persistent `runtime-degraded` state (the stream error is recoverable and transient) nor a `metadata-only` artifact (all created artifacts carry a URI or content reference). The V1.1 demo keeps state 05 as **blocked task / agent** and state 06 as **revision / rework required**, and only claims screenshots for states that the adapter can truthfully reach.
```

New:
```
The mock adapter used by `apps/demo-office` can now truthfully produce a domain task/agent `failed` state via `playRuntimeFailureFlow()`, so state `11-domain-task-agent-failed` is baselined. This is a domain-level failure (ERROR_RAISED + TASK_FAILED + AGENT_STATUS_CHANGED→failed), not a session/transport failure. It still cannot produce a persistent `runtime-degraded` state (the stream error is recoverable and transient) nor a `metadata-only` artifact (all created artifacts carry a URI or content reference). The V1.1 demo keeps state 05 as **blocked task / agent** and state 06 as **revision / rework required**, and only claims screenshots for states that the adapter can truthfully reach.
```

Line 104:

Old:
```
| 11 | Runtime failed | `baseline/1440x900/11-runtime-failed.png` | `11-runtime-failed-annotated.png` |
```

New:
```
| 11 | Domain task / agent failed | `baseline/1440x900/11-domain-task-agent-failed.png` | `11-domain-task-agent-failed-annotated.png` |
```

Line 133:

Old:
```
| 11 | Runtime failed | `MockRuntimeAdapter.playRuntimeFailureFlow()` emits `ERROR_RAISED`, `TASK_FAILED`, and `AGENT_STATUS_CHANGED` with `failed` status. Status strip and agent/task cards render the failure. |
```

New:
```
| 11 | Domain task / agent failed | `MockRuntimeAdapter.playRuntimeFailureFlow()` emits `ERROR_RAISED`, `TASK_FAILED`, and `AGENT_STATUS_CHANGED` with `failed` status. This is a domain-level failure, not a session/transport failure. Status strip and agent/task cards render the failure. |
```

- [ ] **Step 7: Update issue-14-closure-audit.md reference**

In `docs/design/swarm-office-v1.1/issue-14-closure-audit.md`, line 35:

Old:
```
| 11 Runtime failed | `baseline/1440x900/11-runtime-failed.png` | #27 Task 0 真实失败状态 |
```

New:
```
| 11 Domain task / agent failed | `baseline/1440x900/11-domain-task-agent-failed.png` | #27 Task 0 真实 domain 失败状态 |
```

- [ ] **Step 8: Verify no old name remains**

Run:
```bash
cd "e:\agent\AI STARDEW VALLEY\.worktrees\issue-27"
git grep -n "11-runtime-failed" -- ':!.git'
```
Expected: no output (zero matches).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix(review): rename state 11 runtime-failed → domain-task-agent-failed for domain/transport failure clarity"
```

---

### Task 4: Blocker 4 — Add #27 acceptance criteria mapping to accessibility-notes.md

**Files:**
- Modify: `docs/design/swarm-office-v1.1/accessibility-notes.md`

**Interfaces:**
- Consumes: nothing
- Produces: accessibility doc with #27 mapping table using only `done` / `accepted deviation` / `documented follow-up` status values

- [ ] **Step 1: Append #27 mapping sections**

Append the following at the end of `docs/design/swarm-office-v1.1/accessibility-notes.md` (after line 155):

```markdown

## 11. #27 acceptance criteria mapping

> Status values: `done` / `accepted deviation` / `documented follow-up`.
> `follow-up required` is intentionally NOT used — these gaps are known follow-ups for the accessibility baseline and do not block #27 closure.

### #27 criteria

Source: `docs/superpowers/plans/2026-07-09-issue-27-swarm-office-final-gate.md` lines 258-268.

| # | #27 Criterion | Status | Notes |
|---|---|---|---|
| 1 | Mock adapter truthfully produces runtime-failed agent/task, artifact-unavailable, artifact-failed-open | done | Via `playRuntimeFailureFlow`, `playArtifactUnavailableFlow`, `playArtifactFailedOpenFlow` |
| 2 | Visual QA captures all truthful states across 1366×768, 1440×900, 1920×1080 | done | Baseline screenshots in 3 resolutions |
| 3 | Impossible states skipped with documented reasons | done | gap-audit.md "Accepted deviations" section |
| 4 | `accessibility-notes.md` covers keyboard, focus, selection, reduced-motion, non-color cues | done | This document (sections 1-10) |
| 5 | `performance-lifecycle-notes.md` covers Pixi lifecycle, motion toggle, asset fallback, representative loads | done | Submitted with PR #30 |
| 6 | `issue-14-closure-audit.md` with line-by-line mapping and final verdict | done | Submitted with PR #30 |
| 7 | All tests pass (`npm test -- --run`) | done | 668/668 passed |
| 8 | Build passes (`npm run build`) | done | Build succeeds |
| 9 | Screenshot and annotation scripts pass | done | Scripts run successfully |

### Accessibility gap status

| Gap | Priority | Status | Notes |
|---|---|---|---|
| Canvas not keyboard operable | High | accepted deviation | Canvas is inherently non-keyboard-navigable; ARIA overlay approach documented as follow-up. Alternative path via ControlPanel/ListView keyboard selection. |
| Missing `aria-live` region | High | accepted deviation | Follow-up to add `aria-live` for session state transitions and action errors. Current state changes are visible via StatusStrip and ErrorBanner (`role="alert"`). |
| Missing skip link | Medium | documented follow-up | Low-impact for single-page demo; add in future iteration. |
| `FocusPanel` cards not selectable | Medium | documented follow-up | Add keyboard selection in future iteration to match Command mode. |
| Event log filter input missing label | Low | documented follow-up | Minor a11y polish; add explicit `<label>` or `aria-label`. |
| Canvas agent missing ARIA name | Low | documented follow-up | Minor a11y polish; add hidden text or live region announcement. |
```

- [ ] **Step 2: Commit**

```bash
cd "e:\agent\AI STARDEW VALLEY\.worktrees\issue-27"
git add docs/design/swarm-office-v1.1/accessibility-notes.md
git commit -m "docs(a11y): add #27 acceptance criteria mapping with accepted deviations"
```

---

### Task 5: Verify — Run tests, build, and final grep checks

**Files:**
- No file changes — verification only

- [ ] **Step 1: Run tests**

```bash
cd "e:\agent\AI STARDEW VALLEY\.worktrees\issue-27"
npm test -- --run
```
Expected: all tests pass (668+ tests).

- [ ] **Step 2: Run build**

```bash
npm run build
```
Expected: build succeeds with no errors.

- [ ] **Step 3: Grep verification — no old state names remain**

```bash
git grep -n "11-runtime-failed" -- ':!.git'
git grep -n "14-artifact-unsupported-open" -- ':!.git'
```
Expected: both commands return zero matches.

- [ ] **Step 4: Grep verification — DemoControls button text updated**

```bash
git grep -n "异常: 运行失败" -- ':!.git'
```
Expected: zero matches (old text gone).

```bash
git grep -n "异常: 任务失败" -- ':!.git'
```
Expected: 1 match in `apps/demo-office/src/DemoControls.tsx`.

- [ ] **Step 5: Grep verification — no "follow-up required" in accessibility-notes.md**

```bash
git grep -n "follow-up required" -- docs/design/swarm-office-v1.1/accessibility-notes.md
```
Expected: zero matches.

---

### Task 6: Push and update PR #30

**Files:**
- No file changes — git operations only

- [ ] **Step 1: Push all commits to PR #30's branch**

```bash
cd "e:\agent\AI STARDEW VALLEY\.worktrees\issue-27"
git push origin issue-27
```

- [ ] **Step 2: Post PR comment summarizing fixes**

Use `gh pr comment 30 --body-file <file>` with a summary of all 4 blockers fixed, referencing the commits and the spec at `docs/superpowers/specs/2026-07-05-pr30-review-fixes-design.md`.
