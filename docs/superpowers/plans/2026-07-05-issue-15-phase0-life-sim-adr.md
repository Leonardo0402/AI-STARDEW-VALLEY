# Issue #15 Phase 0 — AI Stardew foundation: ADR and contracts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the architecture decision record and two domain contracts required by Issue #15, and submit them for human review before any implementation code is written.

**Architecture:** Keep the operational `RuntimeSnapshot` unchanged, add a separate `LifeSimSnapshot`/`LifeSimStore` in a new `packages/life-sim` package, feed it from the same runtime event stream at the application boundary, and compose the two projections in the UI. The schedule engine is deterministic and never fabricates task/artifact/approval truth.

**Tech Stack:** TypeScript, Node 18+, existing `@agent-office/protocol`, `@agent-office/core`, `@agent-office/control-ui` patterns. No new runtime dependencies.

## Global Constraints

- **Hard truth boundary:** the schedule engine may compute virtual time, planned activity, current location, availability, interruption/resumption, and day transitions. It must **not** independently claim that a task completed, an artifact was produced, an approval was granted, a review succeeded, an Agent learned something, or a relationship changed.
- **Backward compatibility:** existing `RuntimeSnapshot`, `DomainEvent`, `OfficeCommand`, `RuntimeAdapter`, and all adapter tests must remain valid after Phase 0.
- **No code changes to protocol / reducer / store / adapters in Phase 0.** This phase delivers documents only.
- **PR #13 dependency:** do not create the implementation branch or touch runtime code until PR #13 is merged and Issue #12 is closed. Phase 0 documents may be drafted in parallel because they are pure design work.
- **Determinism:** all schedule and clock semantics must be reproducible without wall-clock races; real-time compressed mode is optional and isolated behind a driver abstraction.
- **Surgical scope:** out-of-scope items from Issue #15 (farming, crafting, building, inventory, shops, weather, relationships, memory, mood, LLM schedules, town map, visual polish) must not leak into contracts.

## Phase 0 Readiness Gate

Before Task 1 starts, confirm:

- [ ] PR #13 is merged and Issue #12 is closed, **or** the user explicitly authorizes drafting Phase 0 documents while those remain open.
- [ ] A feature branch `feat/issue-15-life-sim` can be created from an up-to-date `main`.

## Task 1: Survey existing integration points

**Files:**
- Read: `packages/protocol/src/index.ts`
- Read: `packages/core/src/reducer.ts`
- Read: `packages/core/src/store.ts`
- Read: `packages/core/src/session.ts`
- Read: `packages/core/src/projection.ts`
- Read: `docs/protocol/runtime-contract.md`
- Read: `docs/adr/0001-runtime-session-in-core.md`
- Read: `docs/adr/0002-transactional-reducer-commit-and-session-hardening.md`
- Read: `docs/adr/0005-qclaw-swarm-integration-shape.md`
- Read: `apps/demo-office/src/runtime/create-runtime.ts`
- Read: `apps/demo-office/src/main.tsx`

**Interfaces:**
- Consumes: existing runtime types and session bootstrap ordering.
- Produces: a short survey note at the top of the ADR explaining where the life-sim layer will attach.

- [ ] **Step 1: Read the listed files** and note the attachment points for a life-sim layer:
  - where runtime events enter the application (`RuntimeSession.onAcceptedEvent`);
  - where snapshots are checkpointed (`SnapshotStore.setSnapshot` / `getSnapshot`);
  - where UI projections are composed (`projectSnapshot`, `useOfficeState`);
  - where commands are dispatched (`CommandGateway`, `RuntimeAdapter.execute`).
- [ ] **Step 2: Identify constraints** that shape the ADR:
  - `RuntimeSnapshot` is validated deeply by HTTP/SSE validators;
  - adapters only know the generic protocol;
  - `SnapshotStore` is single-runtime and event-sourced;
  - UI consumes `OfficeProjection`, not the raw snapshot.
- [ ] **Step 3: Write a one-page survey summary** in the draft ADR under `## Context`.
- [ ] **Step 4: Commit the empty plan file and a scratch note if needed.**

```bash
git add docs/superpowers/plans/2026-07-05-issue-15-phase0-life-sim-adr.md
git commit -m "docs(plan): issue #15 phase 0 adr and contracts"
```

## Task 2: Draft ADR-0006 life-sim state boundary

**Files:**
- Create: `docs/adr/0006-life-sim-state-boundary.md`

**Interfaces:**
- Consumes: survey summary from Task 1.
- Produces: a selected integration shape and documented rationale.

- [ ] **Step 1: Write the ADR header**

```markdown
# ADR-0006: Life-Sim State Boundary

- **Status**: Proposed
- **Date**: 2026-07-05
- **Issue**: #15 — AI Stardew foundation: persistent day cycle and deterministic Agent schedules
```

- [ ] **Step 2: Write the Context section** (2-3 paragraphs) explaining:
  - Issue #15 adds persistent virtual time and deterministic Agent schedules to the existing office;
  - the operational Runtime already owns tasks, artifacts, and approvals;
  - the life-sim layer must observe the Runtime without conflating its own truth with operational truth.

- [ ] **Step 3: Compare Option A, B, and C from Issue #15** using a table:

| Criterion | Option A: extend RuntimeSnapshot | Option B: separate LifeSimSnapshot | Option C: same stream, separate reducer |
|---|---|---|---|
| Backward compatibility with adapters | requires schema change and adapter updates | RuntimeSnapshot unchanged; life-sim events optional | RuntimeSnapshot unchanged if reducer output is separate |
| Snapshot validation impact | deep validators must accept new world/schedule fields | no impact on runtime validators | no impact if world state is not inside RuntimeSnapshot |
| Replay determinism | deterministic within same snapshot | deterministic if inputs (runtime events + base schedules) are replayed | deterministic if both reducers replay same event stream |
| Persistence ownership | tied to runtime checkpoint | separate atomic JSON store | separate reducer, still needs separate persistence or derived state |
| UI projection boundary | single projection | composed projection | composed projection |
| QClaw/reference types leak | risk if world fields added to generic protocol | none | none if event namespace is generic |
| Migration path to memory/weather/town | harder; every extension touches protocol | easier; extensions stay in life-sim package | mixed; new events need transport support |

- [ ] **Step 4: State the recommended decision**

Recommended: **Option B composed with Option C's event stream**.

```markdown
## Decision

Add a separate `LifeSimSnapshot` and `LifeSimStore` inside a new `packages/life-sim` package.
The life-sim layer subscribes to `RuntimeSession.onAcceptedEvent` and consumes the same
ordered event stream as the office, but maintains its own reducer and checkpoint. It does
not modify `RuntimeSnapshot` or any adapter. The UI composes `OfficeProjection` and
`LifeSimProjection` at the application boundary.
```

- [ ] **Step 5: Document rationale** for the recommendation:
  - keeps operational protocol stable;
  - adapters (Mock, HTTP/SSE, QClaw) remain unchanged;
  - schedule engine is isolated and testable;
  - world/schedule events can still be transported and replayed because the life-sim store consumes the same ordered stream;
  - future extensions (memory, weather, town) stay inside `packages/life-sim`.

- [ ] **Step 6: Document consequences and alternatives** following ADR-0005 style.
- [ ] **Step 7: Commit the ADR draft**

```bash
git add docs/adr/0006-life-sim-state-boundary.md
git commit -m "docs(adr): propose life-sim state boundary"
```

## Task 3: Draft day-cycle contract

**Files:**
- Create: `docs/life-sim/day-cycle-contract.md`

**Interfaces:**
- Consumes: ADR-0006 selected boundary and Issue #15 clock model.
- Produces: a contract document that defines world clock states, modes, commands, events, persistence, and UI projection.

- [ ] **Step 1: Create the file and write an overview**

```markdown
# Life-Sim Day Cycle Contract

This document defines the virtual clock and day boundary semantics for the life-sim layer.
It does not define task execution, artifact production, or approval resolution — those remain
in the Runtime contract.
```

- [ ] **Step 2: Define `WorldClockState`**

```ts
interface WorldClockState {
  worldId: string;
  day: number;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  minuteOfDay: number; // 0..1439
  phase: "dawn" | "morning" | "afternoon" | "evening" | "night";
  status: "not_started" | "running" | "paused" | "ending";
  speed: number; // virtual minutes per real second, or 0 in manual mode
  updatedAt: string; // ISO 8601
}
```

- [ ] **Step 3: Define clock modes**
  - Manual deterministic mode: explicit `advance` operations, no `setTimeout`, used by tests and demos.
  - Real-time compressed mode: configurable `speed`, pause/resume, monotonic, bounded catch-up, no offline catch-up in V1.

- [ ] **Step 4: Define commands**

```text
world.start_day       // payload: { day?: number }
world.pause           // payload: {}
world.resume          // payload: {}
world.advance_time    // payload: { minutes: number }  // dev/test only
world.end_day         // payload: {}                  // operator/test only
```

- [ ] **Step 5: Define events**

```text
world.day_started         // payload: { day, dayOfWeek, startedAtWorldMinute }
world.time_advanced       // payload: { oldMinute, newMinute, day }
world.phase_changed       // payload: { oldPhase, newPhase, minute }
world.day_ending          // payload: { day, endedAtWorldMinute }
world.day_ended           // payload: { day, summaryId }
day.summary_recorded      // payload: { summaryId, day, summary: DaySummary }
```

Requirement: a large `advance_time` must emit **coalesced** `world.time_advanced` events while still executing every schedule boundary exactly once.

- [ ] **Step 6: Define persistence contract**
  - atomic JSON store with schema version;
  - write-to-temp + atomic rename;
  - startup validation and corrupt-file diagnostic;
  - deterministic test storage paths;
  - no secrets or prompts;
  - no partial state after failed write.

- [ ] **Step 7: Define UI projection fields**

```ts
interface WorldClockView {
  day: number;
  dayOfWeek: number;
  minuteOfDay: number;
  phase: WorldClockState["phase"];
  status: WorldClockState["status"];
  speed: number;
}
```

- [ ] **Step 8: Commit the contract**

```bash
git add docs/life-sim/day-cycle-contract.md
git commit -m "docs(life-sim): day cycle contract"
```

## Task 4: Draft schedule semantics contract

**Files:**
- Create: `docs/life-sim/schedule-semantics.md`

**Interfaces:**
- Consumes: day-cycle contract and Issue #15 schedule model.
- Produces: a contract document defining schedules, activities, interruption/resumption, and conflict resolution.

- [ ] **Step 1: Create the file and write an overview**

```markdown
# Life-Sim Schedule Semantics

This document defines how Agent daily schedules are expressed, validated, interrupted,
and resumed. It explicitly does not grant the schedule engine authority to modify task,
artifact, or approval truth.
```

- [ ] **Step 2: Define core types**

```ts
interface AgentScheduleEntry {
  entryId: string;
  agentId: string;
  startMinute: number;
  endMinute: number;
  activity: "arrive" | "work" | "review" | "break" | "social" | "idle" | "leave";
  roomId: string | null;
  priority: number;
  source: "base" | "task_override" | "operator_override" | "system";
}

interface ActiveAgentActivity {
  agentId: string;
  scheduleEntryId: string;
  activity: string;
  roomId: string | null;
  startedAtWorldMinute: number;
  interruptedByTaskId: string | null;
}
```

- [ ] **Step 3: Define schedule validation rules**
  - `0 <= startMinute < endMinute <= 1440`;
  - entries for the same agent must not overlap;
  - entries must not cross day boundaries;
  - `roomId` must refer to an existing `RoomSnapshot.roomId` by entity ID;
  - deterministic conflict resolution by `(startMinute, priority, entryId)` ordering.

- [ ] **Step 4: Define base schedules for the three roles**

Provide an example, explicitly labeled as default/example rather than mandatory:

```text
08:00-08:30 arrive / Command
08:30-12:00 work / role-specific room
12:00-13:00 break
13:00-17:00 work or review
17:00-18:00 daily wrap-up / Command
18:00 leave
```

- [ ] **Step 5: Define interruption and resumption**
  - a task assignment creates a `task_override` entry that interrupts the current base entry;
  - the override records `interruptedByTaskId`;
  - when the task reaches a terminal or waiting state, the Agent returns to the **current** base entry for the current world minute, not the old entry;
  - pending approval may keep relevant Agents in Review/Approval-Delivery per documented rules;
  - blocked/paused/offline/failed Agents do not advance ordinary activities.

- [ ] **Step 6: Define schedule commands and overrides**

```text
schedule.override      // payload: { agentId, entry: Partial<AgentScheduleEntry> }
schedule.clear_override // payload: { agentId, entryId }
```

- [ ] **Step 7: Define schedule events**

```text
schedule.activity_started     // payload: { agentId, entryId, activity, roomId, startedAtWorldMinute }
schedule.activity_interrupted // payload: { agentId, entryId, interruptedByTaskId, interruptedAtWorldMinute }
schedule.activity_resumed     // payload: { agentId, entryId, resumedAtWorldMinute }
schedule.activity_completed   // payload: { agentId, entryId, completedAtWorldMinute }
agent.location_changed        // payload: { agentId, oldRoomId, newRoomId, reason }
```

- [ ] **Step 8: Define truth-boundary examples**

Add a section with two explicit examples:

1. **Allowed:** the schedule engine moves Agent `worker-1` to room `room-execution` at 09:00 because the base schedule says so.
2. **Not allowed:** the schedule engine marks task `t-1` as completed because the Agent is in the "work" activity.

- [ ] **Step 9: Commit the contract**

```bash
git add docs/life-sim/schedule-semantics.md
git commit -m "docs(life-sim): schedule semantics contract"
```

## Task 5: Validate contracts with executable examples

**Files:**
- Create: `docs/life-sim/examples/sample-day.md`
- Read: `packages/protocol/src/index.ts` (for existing types)

**Interfaces:**
- Consumes: day-cycle and schedule contracts.
- Produces: a concrete sample day that exposes edge cases and demonstrates determinism.

- [ ] **Step 1: Write a sample Day 1 narrative**

```text
08:00 world.day_started
08:00 schedule.activity_started (orchestrator, arrive, command)
08:00 schedule.activity_started (worker, arrive, command)
08:00 schedule.activity_started (reviewer, arrive, command)
08:30 schedule.activity_started (worker, work, execution)
09:00 operator creates task t-1 and assigns to worker
09:00 schedule.activity_interrupted (worker, work entry, by t-1)
09:00 schedule.activity_started (worker, work, execution) [task_override]
10:30 task t-1 produces artifact a-1 and requests approval
10:30 schedule.activity_started (reviewer, review, review)
11:00 approval resolved approved
11:00 task t-1 completed
11:00 schedule.activity_resumed (worker, current base entry)
12:00 schedule.activity_started (worker, break, null)
...
18:00 world.day_ended
```

- [ ] **Step 2: Write the expected mid-day persistence state** after an `advance_time(150)` from 08:00 to 10:30, including active task override.
- [ ] **Step 3: Write the expected Day 1 summary shape** showing counts derived only from committed runtime events.
- [ ] **Step 4: Run a TypeScript syntax check on any code blocks** in the contracts (optional: paste snippets into a temporary `scratch.ts` and run `npx tsc --noEmit`).
- [ ] **Step 5: Commit the examples**

```bash
git add docs/life-sim/examples/sample-day.md
git commit -m "docs(life-sim): sample day example"
```

## Task 6: Self-review of Phase 0 deliverables

**Files:**
- Read: `docs/adr/0006-life-sim-state-boundary.md`
- Read: `docs/life-sim/day-cycle-contract.md`
- Read: `docs/life-sim/schedule-semantics.md`
- Read: `docs/life-sim/examples/sample-day.md`

**Interfaces:**
- Consumes: all Phase 0 documents.
- Produces: a short review note in the plan file or a new `phase0-review-notes.md`.

- [ ] **Step 1: Spec coverage scan** — for each requirement in Issue #15, point to the section that addresses it. List any gaps.
- [ ] **Step 2: Placeholder scan** — search the documents for:
  - "TBD", "TODO", "implement later", "fill in details";
  - vague phrases like "appropriate error handling" without specifics;
  - references to functions/types not defined anywhere.
  Fix any findings inline.
- [ ] **Step 3: Type consistency scan** — verify that `WorldClockState`, `AgentScheduleEntry`, `ActiveAgentActivity`, `DaySummary`, and event payloads use the same names and shapes across all three documents.
- [ ] **Step 4: Truth-boundary scan** — verify the ADR and schedule-semantics explicitly state what the schedule engine may and may not claim.
- [ ] **Step 5: Commit review notes**

```bash
git add docs/life-sim/phase0-review-notes.md  # if created
git commit -m "docs(life-sim): phase 0 self-review notes"
```

## Task 7: Submit for human review

**Files:**
- `docs/adr/0006-life-sim-state-boundary.md`
- `docs/life-sim/day-cycle-contract.md`
- `docs/life-sim/schedule-semantics.md`
- `docs/life-sim/examples/sample-day.md`

**Interfaces:**
- Consumes: final Phase 0 documents.
- Produces: human review request and decision on which option to select.

- [ ] **Step 1: Run a final check that no protocol/core/adapter/UI source files were modified**

```bash
git diff --stat HEAD
```

Expected output: only new/updated files under `docs/`.

- [ ] **Step 2: Open a PR or present the documents to the user** with a summary of:
  - the recommended integration shape (Option B/C);
  - the three documents delivered;
  - the sample day narrative;
  - explicit readiness gate before implementation begins.
- [ ] **Step 3: Mark Phase 0 complete only after the user approves the ADR selection.**

## Execution options

Plan complete and saved to `docs/superpowers/plans/2026-07-05-issue-15-phase0-life-sim-adr.md`.

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — I execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

Which approach do you want? Also confirm whether to proceed while PR #13 is still open, or wait until it is merged.
