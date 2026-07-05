# Sample Day 1 — Orchestrator, Worker, Reviewer

This example walks through a deterministic Day 1 in manual mode. It demonstrates how runtime events interrupt and resume schedule entries without the schedule engine fabricating operational outcomes.

> Payloads below are the **minimum required fields** for the narrative. Runtime validators require additional fields; always consult `packages/protocol/src/index.ts` for full schema.

## Setup

- World ID: `world-demo-001`
- Day: 1
- Start minute: `480` (08:00)
- End-of-day minute: `1110` (18:30)
- Agents:
  - `orchestrator-1` (role: Orchestrator)
  - `worker-1` (role: Worker)
  - `reviewer-1` (role: Reviewer)
- Clock mode: manual deterministic
- Room entity IDs (examples):
  - `qclaw-room-command`
  - `qclaw-room-execution`
  - `qclaw-room-review`

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
{ "type": "schedule.activity_started", "payload": { "agentId": "orchestrator-1", "entryId": "orch-arrive-1", "activity": "arrive", "roomId": "qclaw-room-command", "startedAtWorldMinute": 480 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "worker-arrive-1", "activity": "arrive", "roomId": "qclaw-room-command", "startedAtWorldMinute": 480 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-arrive-1", "activity": "arrive", "roomId": "qclaw-room-command", "startedAtWorldMinute": 480 } }
```

### 08:30 — Base work entries begin

At 08:30 the arrive entries end and work/review entries begin automatically as the clock advances. No operator command is required for base transitions.

**Life-sim events emitted**

```json
{ "type": "schedule.activity_completed", "payload": { "agentId": "orchestrator-1", "entryId": "orch-arrive-1", "completedAtWorldMinute": 510 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "orchestrator-1", "entryId": "orch-work-am", "activity": "work", "roomId": "qclaw-room-command", "startedAtWorldMinute": 510 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "worker-1", "entryId": "worker-arrive-1", "completedAtWorldMinute": 510 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "worker-work-am", "activity": "work", "roomId": "qclaw-room-execution", "startedAtWorldMinute": 510 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-arrive-1", "completedAtWorldMinute": 510 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-review-am", "activity": "review", "roomId": "qclaw-room-review", "startedAtWorldMinute": 510 } }
```

### 09:00 — Runtime assigns a task to the Worker

**Runtime event (applied, not a life-sim command)**

```json
{
  "type": "task.assigned",
  "payload": { "taskId": "t-1", "agentId": "worker-1", "roomId": "qclaw-room-execution" }
}
```

The life-sim layer always creates a `task_overlay` for `worker-1` from 09:00 until the configured end-of-day minute. Because the overlay has the same activity (`work`) and room (`qclaw-room-execution`) as the currently active base entry, no `agent.location_changed` event is emitted.

**Life-sim events emitted**

```json
{ "type": "schedule.activity_interrupted", "payload": { "agentId": "worker-1", "entryId": "worker-work-am", "interruptedByTaskId": "t-1", "interruptedAtWorldMinute": 540 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "overlay-t-1", "activity": "work", "roomId": "qclaw-room-execution", "startedAtWorldMinute": 540 } }
```

### 10:30 — Worker produces artifact and approval is requested

**Runtime events (applied)**

```json
{
  "type": "artifact.created",
  "payload": {
    "artifactId": "a-1",
    "taskId": "t-1",
    "producerAgentId": "worker-1",
    "type": "deliverable",
    "title": "Day 1 deliverable",
    "uri": "artifact://a-1",
    "version": 1
  }
}
{
  "type": "approval.requested",
  "payload": {
    "approvalId": "ap-1",
    "taskId": "t-1",
    "kind": "artifact_delivery",
    "requestedBy": "worker-1",
    "reason": "Deliverable ready for review"
  }
}
```

The Worker keeps `overlay-t-1` because the task is still active. The deterministic reviewer policy selects `reviewer-1` (only reviewer, operational status). `reviewer-1` receives a `task_overlay` for the pending approval. Because the reviewer's current activity is already `review` in `qclaw-room-review`, no `agent.location_changed` event is emitted.

**Life-sim events emitted**

```json
{ "type": "schedule.activity_interrupted", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-review-am", "interruptedByTaskId": "t-1", "interruptedAtWorldMinute": 630 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "overlay-ap-1", "activity": "review", "roomId": "qclaw-room-review", "startedAtWorldMinute": 630 } }
```

### 11:00 — Approval approved, task completes

**Runtime events (applied)**

```json
{ "type": "approval.resolved", "payload": { "approvalId": "ap-1", "status": "approved", "resolvedBy": "reviewer-1" } }
{ "type": "task.completed", "payload": { "taskId": "t-1" } }
```

The life-sim layer ends both task overlays early and resumes the current base entries. Because the resumed base entries use the same rooms as the overlays, no `agent.location_changed` events are emitted.

**Life-sim events emitted**

```json
{ "type": "schedule.overlay_ended", "payload": { "agentId": "worker-1", "overlayId": "overlay-t-1", "reason": "task_completed", "endedAtWorldMinute": 660 } }
{ "type": "schedule.activity_resumed", "payload": { "agentId": "worker-1", "entryId": "worker-work-am", "resumedAtWorldMinute": 660 } }

{ "type": "schedule.overlay_ended", "payload": { "agentId": "reviewer-1", "overlayId": "overlay-ap-1", "reason": "task_completed", "endedAtWorldMinute": 660 } }
{ "type": "schedule.activity_resumed", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-review-am", "resumedAtWorldMinute": 660 } }
```

Note: `worker-work-am` and `reviewer-review-am` are resumed even though they originally ended at 12:00. Because the interruption happened inside each entry's time window, the schedule engine treats the remaining window as resumed.

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

At 13:00 the break entries end and afternoon entries begin. At 17:00 the default schedule transitions to evening wrap-up. These transitions emit `schedule.activity_completed` / `schedule.activity_started` pairs exactly as above, using the room entity IDs defined in the base schedules.

### 18:00 — Leave the office

At 18:00 each agent's leave entry starts.

```json
{ "type": "schedule.activity_completed", "payload": { "agentId": "orchestrator-1", "entryId": "orch-review-pm", "completedAtWorldMinute": 1080 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "orchestrator-1", "entryId": "orch-leave", "activity": "leave", "roomId": null, "startedAtWorldMinute": 1080 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "worker-1", "entryId": "worker-idle", "completedAtWorldMinute": 1080 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "worker-1", "entryId": "worker-leave", "activity": "leave", "roomId": null, "startedAtWorldMinute": 1080 } }

{ "type": "schedule.activity_completed", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-work-pm", "completedAtWorldMinute": 1080 } }
{ "type": "schedule.activity_started", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-leave", "activity": "leave", "roomId": null, "startedAtWorldMinute": 1080 } }
```

### 18:30 — Leave activities complete, then end of day

First, the leave entries reach their `endMinute`:

```json
{ "type": "schedule.activity_completed", "payload": { "agentId": "orchestrator-1", "entryId": "orch-leave", "completedAtWorldMinute": 1110 } }
{ "type": "schedule.activity_completed", "payload": { "agentId": "worker-1", "entryId": "worker-leave", "completedAtWorldMinute": 1110 } }
{ "type": "schedule.activity_completed", "payload": { "agentId": "reviewer-1", "entryId": "reviewer-leave", "completedAtWorldMinute": 1110 } }
```

Then the operator ends the day. `world.end_day` is allowed because the current virtual minute equals the configured end-of-day minute (1110).

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
{ "type": "day.summary_recorded", "payload": { "summaryId": "ds-1", "day": 1, "summary": { /* see below */ } } }
{ "type": "world.day_ended", "payload": { "day": 1, "summaryId": "ds-1" } }
```

After `world.day_ended`, the world status becomes `"not_started"` and `minuteOfDay` resets to the configured start-of-day minute (480). `day` does not increment until the next `world.start_day`.

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
    "speed": 0,
    "fractionalMinute": 0
  },
  "activeActivities": [
    { "agentId": "orchestrator-1", "scheduleEntryId": "orch-work-am", "activity": "work", "roomId": "qclaw-room-command", "startedAtWorldMinute": 510, "interruptedByTaskId": null },
    { "agentId": "worker-1", "scheduleEntryId": "overlay-t-1", "activity": "work", "roomId": "qclaw-room-execution", "startedAtWorldMinute": 540, "interruptedByTaskId": null },
    { "agentId": "reviewer-1", "scheduleEntryId": "reviewer-review-am", "activity": "review", "roomId": "qclaw-room-review", "startedAtWorldMinute": 510, "interruptedByTaskId": null }
  ],
  "activeOverlays": [
    {
      "overlayId": "overlay-t-1",
      "agentId": "worker-1",
      "entry": { /* task_overlay entry spanning 540..1110 */ },
      "createdBy": "task",
      "createdAtWorldMinute": 540,
      "createdByTaskId": "t-1",
      "createdByRuntimeSequence": 7,
      "originalStartMinute": 540
    }
  ],
  "lastAppliedRuntimeSequence": 7
}
```

## Expected Day 1 summary

```json
{
  "day": 1,
  "startedAtWorldMinute": 480,
  "endedAtWorldMinute": 1110,
  "truncated": false,
  "agentActivities": [
    {
      "agentId": "orchestrator-1",
      "activityMinutes": { "arrive": 30, "work": 450, "break": 60, "review": 60, "leave": 30 },
      "roomsVisited": ["qclaw-room-command", "qclaw-room-review"]
    },
    {
      "agentId": "worker-1",
      "activityMinutes": { "arrive": 30, "work": 450, "break": 60, "idle": 60, "leave": 30 },
      "roomsVisited": ["qclaw-room-command", "qclaw-room-execution"]
    },
    {
      "agentId": "reviewer-1",
      "activityMinutes": { "arrive": 30, "review": 450, "work": 60, "break": 60, "leave": 30 },
      "roomsVisited": ["qclaw-room-command", "qclaw-room-review"]
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
  "notableEventIds": ["evt-task-assigned-t-1", "evt-approval-requested-ap-1", "evt-approval-resolved-ap-1", "evt-task-completed-t-1"]
}
```

All counts are derived from committed runtime events, not from schedule activities. `truncated` is `false` because every applied runtime event was available for replay.

## Determinism check

Replaying the same command sequence with the same applied runtime events on a fresh world must produce:

- the same `lifeSimSequence` ordering;
- the same `WorldClockState` at every minute;
- the same active activities at every minute;
- the same `DaySummary`.

No wall-clock dependency or randomness is permitted in manual mode. Event IDs are deterministic for deterministic inputs.
