# Sample Day 1 — Orchestrator, Worker, Reviewer

This example walks through a deterministic Day 1 in manual mode. It demonstrates how runtime events interrupt and resume schedule entries without the schedule engine fabricating operational outcomes.

## Setup

- World ID: `world-demo-001`
- Day: 1
- Start minute: `480` (08:00)
- Agents:
  - `orchestrator-1` (role: Orchestrator)
  - `worker-1` (role: Worker)
  - `reviewer-1` (role: Reviewer)
- Clock mode: manual deterministic

## Command sequence and emitted events

### 08:00 — Start the day

**Operator command**

```json
{
  "commandId": "cmd-start-day-1",
  "commandType": "world.start_day",
  "payload": { "day": 1 }
}
```

**Life-sim events emitted**

```json
{
  "type": "world.day_started",
  "payload": { "day": 1, "dayOfWeek": 1, "startedAtWorldMinute": 480 }
}
```

For each agent, the schedule engine evaluates the base schedule at minute 480 and emits the matching arrive entry:

```json
{ "type": "schedule.activity_started", "payload": { "agentId": "orchestrator-1", "entryId": "orch-arrive-1", "activity": "arrive", "roomId": "command", "startedAtWorldMinute": 480 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "worker-arrive-1", "activity": "arrive", "roomId": "command", "startedAtWorldMinute": 480 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-arrive-1", "activity": "arrive", "roomId": "command", "startedAtWorldMinute": 480 } }
```

### 08:30 — Base work entries begin

At 08:30 the arrive entries end and work/review entries begin automatically as the clock advances. No operator command is required for base transitions.

**Life-sim events emitted**

```json
{ "type": "schedule.activity_completed", "payload": { "agentId": "orchestrator-1", "entryId": "orch-arrive-1", "completedAtWorldMinute": 510 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "orchestrator-1", "entryId": "orch-work-am", "activity": "work", "roomId": "command", "startedAtWorldMinute": 510 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "worker-1", "entryId": "worker-arrive-1", "completedAtWorldMinute": 510 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "worker-work-am", "activity": "work", "roomId": "execution", "startedAtWorldMinute": 510 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-arrive-1", "completedAtWorldMinute": 510 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-review-am", "activity": "review", "roomId": "review", "startedAtWorldMinute": 510 } }
```

### 09:00 — Runtime assigns a task to the Worker

**Runtime event (not a life-sim command)**

```json
{
  "type": "task.assigned",
  "payload": { "taskId": "t-1", "agentId": "worker-1", "roomId": "execution" }
}
```

The life-sim layer observes this event and creates a `task_override` for `worker-1` from 09:00 until end of day or task completion, whichever comes first.

**Life-sim events emitted**

```json
{ "type": "schedule.activity_interrupted", "payload": { "agentId": "worker-1", "entryId": "worker-work-am", "interruptedByTaskId": "t-1", "interruptedAtWorldMinute": 540 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "override-t-1", "activity": "work", "roomId": "execution", "startedAtWorldMinute": 540 } }
```

### 10:30 — Worker produces artifact and approval is requested

**Runtime events**

```json
{ "type": "artifact.created", "payload": { "artifactId": "a-1", "taskId": "t-1" } }
{ "type": "approval.requested", "payload": { "approvalId": "ap-1", "taskId": "t-1", "artifactId": "a-1" } }
```

The life-sim layer does not change the Worker's activity; the Worker remains in `override-t-1` because the task is still active. The Reviewer receives a task override to handle the pending approval.

**Life-sim events emitted**

```json
{ "type": "schedule.activity_interrupted", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-review-am", "interruptedByTaskId": "t-1", "interruptedAtWorldMinute": 630 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "override-ap-1", "activity": "review", "roomId": "review", "startedAtWorldMinute": 630 } }
```

### 11:00 — Approval approved, task completes

**Runtime events**

```json
{ "type": "approval.resolved", "payload": { "approvalId": "ap-1", "taskId": "t-1", "decision": "approved" } }
{ "type": "task.completed", "payload": { "taskId": "t-1" } }
```

The life-sim layer removes both task overrides and resumes the current base entries.

**Life-sim events emitted**

```json
{ "type": "schedule.activity_completed", "payload": { "agentId": "worker-1", "entryId": "override-t-1", "completedAtWorldMinute": 660 } }
{ "type": "schedule.activity_resumed", "payload": { "agentId": "worker-1", "entryId": "worker-work-am", "resumedAtWorldMinute": 660 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "reviewer-1", "entryId": "override-ap-1", "completedAtWorldMinute": 660 } }
{ "type": "schedule.activity_resumed", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-review-am", "resumedAtWorldMinute": 660 } }
```

Note: `worker-work-am` is resumed even though it originally ended at 12:00. Because the interruption happened inside the entry's time window, the schedule engine treats the remaining window as resumed.

### 12:00 — Lunch break

Base schedule entries end and break entries begin for all agents.

**Life-sim events emitted**

```json
{ "type": "schedule.activity_completed", "payload": { "agentId": "orchestrator-1", "entryId": "orch-work-am", "completedAtWorldMinute": 720 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "orchestrator-1", "entryId": "orch-break", "activity": "break", "roomId": null, "startedAtWorldMinute": 720 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "worker-1", "entryId": "worker-work-am", "completedAtWorldMinute": 720 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "worker-break", "activity": "break", "roomId": null, "startedAtWorldMinute": 720 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-review-am", "completedAtWorldMinute": 720 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-break", "activity": "break", "roomId": null, "startedAtWorldMinute": 720 } }
```

### 13:00 – 17:00 — Afternoon work

At 13:00 the break entries end and afternoon entries begin. At 17:00 the default schedule transitions to evening wrap-up. These transitions emit `schedule.activity_completed` / `schedule.activity_started` pairs exactly as above.

### 18:00 — Leave the office

At 18:00 each agent's leave entry starts.

```json
{ "type": "schedule.activity_started", "payload": { "agentId": "orchestrator-1", "entryId": "orch-leave", "activity": "leave", "roomId": null, "startedAtWorldMinute": 1080 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "worker-leave", "activity": "leave", "roomId": null, "startedAtWorldMinute": 1080 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-leave", "activity": "leave", "roomId": null, "startedAtWorldMinute": 1080 } }
```

### 18:30 — End of day

**Operator command**

```json
{
  "commandId": "cmd-end-day-1",
  "commandType": "world.end_day",
  "payload": {}
}
```

**Life-sim events emitted**

```json
{ "type": "world.day_ending", "payload": { "day": 1, "endedAtWorldMinute": 1110 } }
{ "type": "world.day_ended", "payload": { "day": 1, "summaryId": "ds-1" } }
{ "type": "day.summary_recorded", "payload": { "summaryId": "ds-1", "day": 1, "summary": { /* see below */ } } }
```

## Expected state after `world.advance_time(150)` from 08:00 to 10:30

At world minute 630, before the approval request:

```json
{
  "world": {
    "day": 1,
    "dayOfWeek": 1,
    "minuteOfDay": 630,
    "phase": "morning",
    "status": "running",
    "speed": 0
  },
  "activeActivities": [
    { "agentId": "orchestrator-1", "scheduleEntryId": "orch-work-am", "activity": "work", "roomId": "command", "startedAtWorldMinute": 510, "interruptedByTaskId": null },
    { "agentId": "worker-1", "scheduleEntryId": "override-t-1", "activity": "work", "roomId": "execution", "startedAtWorldMinute": 540, "interruptedByTaskId": null },
    { "agentId": "reviewer-1", "scheduleEntryId": "reviewer-review-am", "activity": "review", "roomId": "review", "startedAtWorldMinute": 510, "interruptedByTaskId": null }
  ],
  "activeOverrides": [
    { "overrideId": "ov-t-1", "agentId": "worker-1", "entry": { /* task_override entry */ }, "createdBy": "task", "createdAtWorldMinute": 540, "createdByTaskId": "t-1" }
  ]
}
```

## Expected Day 1 summary

```json
{
  "day": 1,
  "startedAtWorldMinute": 480,
  "endedAtWorldMinute": 1110,
  "agentActivities": [
    {
      "agentId": "orchestrator-1",
      "activityMinutes": { "arrive": 30, "work": 450, "break": 60, "review": 60, "leave": 30 },
      "roomsVisited": ["command", "review"]
    },
    {
      "agentId": "worker-1",
      "activityMinutes": { "arrive": 30, "work": 450, "break": 60, "idle": 60, "leave": 30 },
      "roomsVisited": ["command", "execution"]
    },
    {
      "agentId": "reviewer-1",
      "activityMinutes": { "arrive": 30, "review": 450, "work": 60, "break": 60, "leave": 30 },
      "roomsVisited": ["command", "review"]
    }
  ],
  "taskCounts": {
    "created": 1,
    "completed": 1,
    "blocked": 0,
    "failed": 0
  },
  "approvalCounts": {
    "requested": 1,
    "approved": 1,
    "rejected": 0
  },
  "notableEventIds": ["evt-t-1-assigned", "evt-t-1-completed"]
}
```

All counts are derived from committed runtime events, not from schedule activities.

## Determinism check

Replaying the same command sequence with the same runtime events on a fresh world must produce:

- the same `lifeSimSequence` ordering;
- the same `WorldClockState` at every minute;
- the same active activities at every minute;
- the same `DaySummary`.

No wall-clock dependency or randomness is permitted in manual mode.
