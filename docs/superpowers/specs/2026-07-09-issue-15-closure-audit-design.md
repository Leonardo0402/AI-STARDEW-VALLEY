# Issue #15 LifeSim Foundation Closure Audit — Design Spec

## 1. Background and Goal

After PR #30 merges (once #14 and #27 are closed), the most important open issue remaining is #15 LifeSim foundation. Issue #31 is the closure audit for #15.

**Goal of #31:** Close out #15 — do not extend functionality.

The audit will:

1. Review #15's original acceptance criteria
2. Map implementation evidence from #16 / #17 / #19 / #21
3. Run LifeSim tests / build
4. Fix small closure-blocking documentation / test gaps
5. Produce `docs/life-sim/issue-15-closure-audit.md`
6. Decide whether #15 can be closed

**PR relationship:**

- If the audit proves #15 is complete: `Closes #31 / Closes #15`
- If gaps remain: `Closes #31 / Refs #15`, and create focused follow-up issue(s)

## 2. Audit Scope

**Closure standard:** the 10 acceptance criteria defined in #15 (treated as the closure standard, verbatim). Detailed spec sections in #15 serve as supporting evidence, not as additional closure criteria. This is consistent with the #14 closure audit approach.

**Fix scope constraint (Category 1 / Category 2 split):**

- **Allowed fixes (Category 1):** documentation gaps, missing tests or incomplete assertions for already-implemented behavior, stale docs fixes, audit evidence mapping fixes.
- **Not allowed fixes (Category 2):** modifying `engine` / `reducer` / `store` / `session` business logic, adding LifeSim features, changing Runtime protocol / core, changing UI behavior.
- If the audit discovers that real code behavior does not match #15 acceptance criteria, record it as a Category 2 closure blocker and create a focused follow-up issue. Do not fix it inline in #31.

**Category 1 hard limits:**

- At most 3 new or modified test files.
- Do not modify `engine` / `reducer` / `store` / `session` business logic.
- Do not modify Runtime protocol / core.
- Do not add LifeSim features.
- If more than 3 test files are needed, or implementation logic must change, or `store` / `session` / `engine` behavior actually fails to satisfy a criterion → stop, mark as Category 2, create follow-up issue.

## 3. Audit Approach (Approach C: Criteria-first + Evidence appendix)

**Main body:** 10 criterion sections, 1:1 aligned with the closure standard. Each criterion gets a clear verdict.

**Appendices:** 4 per-PR evidence appendices (#16 Phase 0 / #17 Phase 1 / #19 Phase 2 / #21 Phase 2 fixes), each summarizing what that PR delivered and which criteria it supports (reverse references to Section 2 sub-sections).

**Gap classification:** every gap is classified as Category 1 or Category 2.

**Rationale for Approach C:**

1. **Closure standard alignment:** criteria-first gives every criterion a clear verdict, making the closure decision traceable.
2. **Consistency with #14 closure audit:** main body (evidence mapping) + appendix (supporting evidence) is the same structure used for the #14 closure audit.
3. **Appendix preserves per-PR traceability:** compensates for evidence that spans multiple criteria (e.g., ADR-0006 supports criteria 2 and 8); main sections reference commit hash + short note, appendices carry the detail.
4. **Clear gap classification:** the Category 1 / Category 2 split maps directly to "fix vs. do not fix" decisions, preventing scope creep.

## 4. Audit Document Structure

Target file: `docs/life-sim/issue-15-closure-audit.md`

```
# Issue #15 LifeSim Foundation — Closure Audit

## 1. Audit Scope and Method
   1.1 Closure standard (#15 acceptance criteria)
   1.2 Audit method (criteria-first + evidence appendix)
   1.3 Fix scope constraint (docs/tests only; implementation gaps → follow-up)

## 2. Acceptance Criteria Verdicts
   2.1 Criterion 1 — PR #13 merged first
   2.2 Criterion 2 — ADR selects state boundary before implementation
   2.3 Criterion 3 — Four agents complete one deterministic virtual day
   2.4 Criterion 4 — Schedule transitions and task overrides are factual and replay-safe
   2.5 Criterion 5 — Restart restores exact mid-day state
   2.6 Criterion 6 — End-of-day summary is structured and persisted
   2.7 Criterion 7 — Day 2 starts without losing Day 1 history
   2.8 Criterion 8 — No task/artifact/approval truth fabricated by schedule engine
   2.9 Criterion 9 — Existing RuntimeAdapter and UI modes remain compatible
   2.10 Criterion 10 — Tests and build pass

## 3. Gap Findings and Fixes

Category 1 gaps are documentation/test gaps fixed in #31.
Category 2 gaps are implementation gaps and must become focused follow-up issues.
If any Category 2 gap remains unresolved, the PR must use `Refs #15`, not `Closes #15`.

### 3.1 Category 1 gaps (docs/test — fixed in #31)
### 3.2 Category 2 gaps (implementation — closure blockers, follow-up issue)

## 4. Closure Decision

Final verdict:
- Close #15 / Keep #15 open

PR body:
- `Closes #31 / Closes #15`
- or `Closes #31 / Refs #15`

Rationale:
...

## Appendix A — Phase 0 (#16) Evidence
## Appendix B — Phase 1 (#17) Evidence
## Appendix C — Phase 2 (#19) Evidence
## Appendix D — Phase 2 Fixes (#21) Evidence
```

**Per-criterion section fields** (applies to 2.1 – 2.10):

- **Criterion text:** #15 original text, verbatim.
- **Mapped evidence:** table with columns `Source PR | Commit | File:line | Test | Note`.
- **Verification status:** `satisfied` / `partial` / `blocker`.
- **Gap (if any):** description + classification (Category 1 / Category 2).

**Per-appendix fields** (applies to Appendix A – D):

- PR metadata (number, title, merge commit, files changed).
- Deliverables list (ADR / contracts / engine / store / client / UI / tests / docs).
- Criteria covered (reverse references to Section 2 sub-section numbers).

## 5. Per-Criterion Verification Standards

### Criterion 1 — PR #13 merged first

- **Evidence:** GitHub PR #13 metadata.
- **Verification:** `gh pr view 13 --json merged,mergedAt`.
- **Status:** satisfied iff PR #13 `merged == true` / `mergedAt` exists. (Do not rely on `state == "MERGED"` alone — some tooling returns `state: CLOSED` + `merged: true`.)

### Criterion 2 — ADR selects state boundary before implementation

- **Evidence:** `docs/adr/0006-life-sim-state-boundary.md`; PR #16 / #17 merge order.
- **Verification:**
  - ADR 0006 exists.
  - ADR status = Accepted.
  - PR #16 merged before PR #17 implementation.
  - PR #17 implementation follows the ADR boundary.
- **Status:** satisfied iff ADR 0006 exists, status = Accepted, and PR #16 was merged before PR #17 implementation. (Do not rely on frontmatter date — PR link order is the stronger signal.)

### Criterion 3 — Four agents complete one deterministic virtual day

- **Evidence:**
  - `packages/life-sim/src/schedule.ts` — schedule definitions for 4 agents.
  - `packages/life-sim/src/__tests__/day1-golden-flow.test.ts` — golden flow test.
  - `packages/life-sim/src/__tests__/engine-schedule.test.ts` — schedule engine tests.
- **Verification:** run golden flow test; confirm it covers all 4 agents, completes Day 1, and produces a deterministic event sequence / summary.
- **Status:** satisfied iff golden flow covers all 4 agents, completes Day 1 deterministically, and verifies resulting day state / summary.

### Criterion 4 — Schedule transitions and task overrides are replay-safe

- **Evidence:**
  - `engine-schedule.test.ts` — deterministic schedule transitions.
  - `engine-runtime.test.ts` — task / approval overrides.
  - `engine-truncation.test.ts` or session / client continuity tests — replay / tail safety.
- **Verification:**
  - Run `engine-schedule.test.ts` for deterministic schedule transitions.
  - Run `engine-runtime.test.ts` for task / approval overrides.
  - Run `engine-truncation.test.ts` or session / client continuity tests for replay / tail safety.
  - Confirm tests include same-input / same-output or replay-to-same-snapshot assertions.
- **Status:** satisfied iff schedule transitions are deterministic, Runtime task / approval overrides are derived from applied Runtime events, and event journal / tail replay reconstructs equivalent state.
  - If only determinism is present (no journal replay) → partial / Category 1 test gap.
  - If replay logic actually does not support reconstruction → Category 2.

### Criterion 5 — Restart restores exact mid-day state

- **Evidence:**
  - `packages/life-sim/src/store.ts` — atomic JSON persistence.
  - `packages/life-sim/src/__tests__/store.test.ts` — store tests.
  - Check for: `FileLifeSimStore` / JSON store reload test, engine init from persisted snapshot test, `eventLogTail` persistence test, `lastObservedRuntimeSequence` / `lastAppliedRuntimeSequence` restore test, `nextLifeSimSequence` restore test.
- **Verification:**
  - Run `store.test.ts`.
  - Confirm a persistent-store reload test exists and proves mid-day snapshot, event tail, command results, runtime cursors, and LifeSim sequence cursor survive engine / store recreation.
- **Status:** satisfied iff a persistent-store reload test proves exact mid-day LifeSim state, including snapshot, event tail, command results, runtime cursors, and sequence cursor, survives engine / store recreation.
  - If only snapshot restore is present (missing sequence cursor / tail / commandResults) → partial / Category 1 test gap.
  - If the store actually does not persist these fields → Category 2.

### Criterion 6 — End-of-day summary is structured and persisted

- **Evidence:**
  - `packages/life-sim/src/summary.ts` — summary structure.
  - `packages/life-sim/src/__tests__/engine-summary.test.ts` — day-end generation test.
  - `packages/life-sim/src/__tests__/summary.test.ts` — summary unit test.
  - `docs/life-sim/day-cycle-contract.md` — summary schema contract.
- **Verification:**
  - Confirm `summary.ts` defines a typed structure (not free text / LLM narrative).
  - Run `engine-summary.test.ts` to confirm day-end command generates summary.
  - Confirm a persistence test proves summary survives reload.
- **Status:** satisfied iff:
  1. `DaySummary` is a typed structure (not LLM narrative / free text).
  2. `world.end_day` or equivalent day-end command generates summary.
  3. Summary is written to `LifeSimSnapshot` / store / durable event log.
  4. Engine / store reload can still read Day 1 summary.
  - If only `summary.ts` + unit test exist (no reload-readable test) → partial / Category 1 test gap.
  - If the implementation does not persist summary → Category 2.

### Criterion 7 — Day 2 starts without losing Day 1 history

- **Evidence:**
  - `packages/life-sim/src/engine.ts` — day transition logic.
  - `packages/life-sim/src/__tests__/day1-golden-flow.test.ts` — Day 1 complete flow.
  - Check for Day 1 → Day 2 transition + history retention test.
- **Verification:**
  - Run golden flow to confirm Day 1 completes.
  - Confirm a cross-day history retention assertion exists (Day 1 summary / events / scheduled activity facts remain accessible after Day 2 begins).
  - "History" is split into three classes: (1) Day 1 summary, (2) Day 1 LifeSim events / event tail or persisted history, (3) Day 1 scheduled activity facts (agent activity records within the schedule domain — NOT agent memory / relationship / skill state, which belongs to Runtime truth).
- **Status:** satisfied iff Day 2 can start while Day 1's committed summary and required historical facts remain accessible, or truncation is explicitly represented and documented.
  - If no dedicated Day 1 → Day 2 test exists → partial / Category 1 test gap.
  - If Day 2 actually overwrites / loses Day 1 summary → Category 2.

### Criterion 8 — No task/artifact/approval truth fabricated by schedule engine

- **Evidence:**
  - `docs/adr/0006-life-sim-state-boundary.md` — Option B+C selection (schedule engine does not touch Runtime truth).
  - `packages/life-sim/src/engine.ts` — schedule engine output type inspection.
  - `packages/life-sim/src/overlay.ts` — runtime overrides derived from applied runtime events.
  - `packages/life-sim/src/types.ts` — LifeSim event type definitions.
- **Verification:**
  - Confirm ADR-0006 defines the truth boundary.
  - Read `engine.ts` to confirm schedule engine output only contains time / location / activity / availability / interruption — not task completion, artifact production, approval grant, review success, agent learning, or relationship change.
  - Read `overlay.ts` to confirm runtime overrides derive from applied runtime events (not fabricated by the schedule engine).
  - Check for negative assertion tests: schedule / time / day commands must not emit `task.completed`, `task.failed`, `artifact.created`, `artifact.reviewed`, `approval.resolved`, `review.succeeded`, `agent.memory_changed`, `agent.relationship_changed`, `agent.skill_changed`.
  - Note: the event names above are illustrative. If the repo's actual `DomainEvent` / Runtime event type names differ, use the real event names. The test intent is to assert that schedule / time / day commands do not produce or modify Runtime business-truth events.
  - More precisely: `LifeSimEngine` schedule reducers may emit only LifeSim / world / schedule / activity / overlay summary events. Runtime business facts must only enter through applied Runtime events.
- **Status:** satisfied iff ADR defines the truth boundary, implementation follows it, runtime overrides are derived from applied runtime events, and negative tests assert schedule commands do not fabricate Runtime business facts.
  - Missing negative test → partial / Category 1 test gap (fix in #31 by adding the negative assertion).
  - Actual fabrication of task / artifact / approval truth → Category 2 blocker.

### Criterion 9 — Existing RuntimeAdapter and UI modes remain compatible

- **Evidence:**
  - `docs/adr/0006-life-sim-state-boundary.md` — RuntimeSnapshot / DomainEvent / RuntimeAdapter untouched.
  - `packages/adapters/` — existing adapter interfaces unchanged.
  - `packages/control-ui/src/life-sim/` — LifeSim UI integration.
  - `apps/demo-office/` — existing office demo still works.
- **Verification:**
  - Confirm ADR-0006 preserves RuntimeAdapter / RuntimeSnapshot / DomainEvent as the runtime truth boundary.
  - Confirm LifeSim integrates through bridge / session / projection, not by changing adapter semantics.
  - Run existing demo-office / control-ui / core / adapter tests and global build.
  - Optional: inspect `git diff <pre-life-sim-base>..HEAD -- packages/protocol/src packages/core/src packages/adapters` if evidence is ambiguous.
- **Status:** satisfied iff Runtime core / API compatibility is preserved by docs + build + existing tests.
  - Lacks explicit documentation / test evidence but implementation is compatible → partial / Category 1.
  - protocol / core / adapter compatibility actually broken → Category 2.
  - A full pre-#16 git diff is NOT required unless evidence is ambiguous.

### Criterion 10 — Tests and build pass

- **Evidence:**
  - LifeSim package tests (`packages/life-sim/`).
  - control-ui LifeSim tests (`packages/control-ui/src/life-sim/`).
  - Global build.
- **Verification:** run actual repo-supported commands:
  - Targeted LifeSim tests if supported (e.g. `npm test -- packages/life-sim`).
  - Otherwise `npm test` with LifeSim test files included.
  - `npm test`.
  - `npm run build`.
- **Status:** satisfied iff targeted or full tests pass and build passes on the final PR head.
- **Record format:**

  | Command | Result | Notes |
  |---|---|---|
  | `npm test -- packages/life-sim` | supported / unsupported | actual result |
  | `npm test` | passed | N/N |
  | `npm run build` | passed | build time |

## 6. Execution Flow

### Step 1: Context gathering

- Read #15, #16, #17, #19, #21 full content.
- Read ADR-0006 and all `docs/life-sim/*`.
- Read key files in `packages/life-sim/src/*`.
- Read key files in `packages/control-ui/src/life-sim/*`.
- `gh pr view 13/16/17/19/21 --json merged,mergedAt,mergedCommit`.
- Output: raw evidence material list.

### Step 2: Evidence mapping (write audit doc Section 2 + Appendix)

- Map evidence to each of the 10 criteria in order.
- Each appendix summarizes one PR's deliverables + reverse references to criteria.
- Mark each criterion's verification status.
- Output: audit doc main body + 4 appendices.

### Step 3: Verification run

- `npm test` (LifeSim + control-ui + global).
- `npm run build`.
- Record command, result, test count, build time.
- Output: Section 2.10 + Section 4 verification table.

### Step 4: Gap classification

- Collect all partial / unsatisfied items.
- Classify as Category 1 (docs/test) vs. Category 2 (implementation).
- Output: audit doc Section 3.

### Step 5: Category 1 fixes (in #31)

**Allowed fixes:**

- Add `docs/life-sim` notes.
- Fix stale docs.
- Fix audit evidence mapping.
- Add small test assertions.
- Add negative assertion test (Criterion 8).
- Strengthen existing test coverage.

**Scope limit:**

- At most 3 new or modified test files.
- Do not modify `engine` / `reducer` / `store` / `session` business logic.
- Do not modify Runtime protocol / core.
- Do not add LifeSim features.

**Stop condition:**

- If more than 3 test files are needed.
- If implementation logic must change.
- If `store` / `session` / `engine` behavior actually fails to satisfy a criterion.
- → stop, mark as Category 2, create follow-up issue.

### Step 6: Category 2 follow-up (if any)

- For each Category 2 gap, create a focused follow-up issue.
- Issue body references audit doc Section 3.2.
- Output: Section 3.2 records each blocker + follow-up issue link.

### Step 7: Closure decision + PR

The audit doc gives a **provisional verdict**.

- IF no Category 2 gaps remain AND all Category 1 gaps are fixed:
  - provisional verdict = Close #15
  - PR body recommendation = `Closes #31 / Closes #15`
- IF any Category 2 gap remains:
  - provisional verdict = Keep #15 open
  - PR body recommendation = `Closes #31 / Refs #15`
  - Create focused follow-up issue(s).

**Reviewer gate:**

- A PR that closes #15 requires final review approval before merge.

## 7. Gap Classification Rules

| Situation | Classification | Handling |
|---|---|---|
| Documentation missing / stale | Category 1 | Fix docs in #31 |
| Test missing (behavior correct, no assertion) | Category 1 | Add test in #31 |
| Assertion incomplete (insufficient coverage) | Category 1 | Strengthen assertion in #31 |
| Audit evidence mapping wrong | Category 1 | Fix audit doc in #31 |
| `engine` / `reducer` / `store` actually fails criterion | Category 2 | Record blocker + follow-up issue |
| protocol / core / adapter compatibility actually broken | Category 2 | Record blocker + follow-up issue |
| Schedule engine actually fabricates truth | Category 2 | Record blocker + follow-up issue |
| Store does not persist required fields | Category 2 | Record blocker + follow-up issue |

## 8. Closure Decision Rules

```
IF any Category 2 gap remains unresolved:
  verdict = Keep #15 open
  PR body = "Closes #31 / Refs #15"
  Each Category 2 gap must have a corresponding follow-up issue.

ELSE IF Category 1 gaps exist:
  IF all Category 1 gaps are fixed in #31 and tests pass:
    verdict = Close #15 (provisional)
    PR body = "Closes #31 / Closes #15"
  ELSE:
    verdict = Keep #15 open
    PR body = "Closes #31 / Refs #15"

ELSE (all 10 criteria satisfied, no gap):
  verdict = Close #15 (provisional)
  PR body = "Closes #31 / Closes #15"
```

**Reviewer gate:** A PR that closes #15 requires final review approval before merge. The audit doc's verdict is provisional; the human reviewer makes the final call.

## 9. Out of Scope

- Do not extend LifeSim functionality.
- Do not modify `engine` / `reducer` / `store` / `session` business logic.
- Do not modify Runtime protocol / core.
- Do not change UI behavior.
- Do not rewrite the test framework.
- Do not add features beyond #15's acceptance criteria.

## 10. Deliverables

- `docs/superpowers/specs/2026-07-09-issue-15-closure-audit-design.md` (this spec file).
- `docs/life-sim/issue-15-closure-audit.md` (main audit doc).
- Category 1 fixes (≤3 test files + docs).
- Category 2 follow-up issues (if any).
- PR with closure decision.
