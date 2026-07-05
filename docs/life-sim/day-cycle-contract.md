# Life-Sim Day Cycle Contract

This document defines the virtual clock and day boundary semantics for the life-sim layer. It does not define task execution, artifact production, or approval resolution — those remain in the Runtime contract.

## State

### `WorldClockState`

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

Field semantics:

- `worldId` — identifies the persistent world. One office/demo owns one world in V1.
- `day` — positive integer, starts at 1.
- `dayOfWeek` — 1..7, purely for display and future weekly-schedule support.
- `minuteOfDay` — 0 (00:00) to 1439 (23:59). 1440 is never stored; the day ends first.
- `phase` — derived from `minuteOfDay` using the table below.
- `status` — controls whether the clock may advance.
- `speed` — `0` means manual mode; a positive number means real-time compressed mode.
- `updatedAt` — wall-clock timestamp of the last state mutation, for diagnostics only; simulation logic does not depend on it.

### Phase mapping

| Phase | Minute range | Display |
|---|---|---|
| `dawn` | 0..359 | 00:00 – 05:59 |
| `morning` | 360..719 | 06:00 – 11:59 |
| `afternoon` | 720..1079 | 12:00 – 17:59 |
| `evening` | 1080..1259 | 18:00 – 20:59 |
| `night` | 1260..1439 | 21:00 – 23:59 |

The phase is computed deterministically from `minuteOfDay`. A `world.phase_changed` event is emitted only when the phase actually changes.

## Clock modes

### Manual deterministic mode

Used by tests and deterministic demos.

- The clock advances only in response to explicit commands:
  - `world.advance_time { minutes }` — advance by a fixed number of virtual minutes.
  - `world.advance_to_next_boundary` — advance to the next schedule entry boundary for any agent.
  - `world.run_to_end_of_day` — advance to the configured end-of-day minute.
- No `setTimeout`, `setInterval`, or real sleep is used.
- Every schedule boundary crossed during a large advance is executed exactly once.
- The resulting event log is deterministic and replayable.

### Real-time compressed mode

Used for interactive demos.

- `speed` is configurable as virtual minutes per real second (e.g., `10` means 10 virtual minutes elapse for each real second).
- The driver uses a single `setInterval` or animation-frame loop.
- Pause freezes the clock without losing accumulated fractional minutes.
- Resume continues from the exact virtual minute where pause occurred.
- Monotonic progression: the driver never moves time backward.
- Bounded catch-up: if the event loop is delayed, the driver may emit a single coarser `world.time_advanced` event, but it still executes every schedule boundary exactly once.
- No duplicate boundary execution: each boundary is keyed by `(day, minute, boundaryId)` and guarded by the store's last-applied sequence.
- Process shutdown persists the last committed world time; offline catch-up while the process is stopped is out of scope for V1.

## Commands

All commands are addressed to the life-sim controller, not to the RuntimeAdapter.

```ts
interface WorldCommand<P = unknown> {
  commandId: string;
  commandType: string;
  timestamp: string; // ISO 8601
  source: "user" | "system";
  actorId: string;
  worldId: string;
  payload: P;
}
```

| Command | Payload | Availability |
|---|---|---|
| `world.start_day` | `{ day?: number }` | Always when `status === "not_started"`. If `day` is omitted, use `currentDay + 1` after the first day. |
| `world.pause` | `{}` | When `status === "running"`. |
| `world.resume` | `{}` | When `status === "paused"`. |
| `world.advance_time` | `{ minutes: number }` | Manual/dev mode only. Rejected in real-time mode. |
| `world.end_day` | `{}` | Operator/test capability. Rejected unless `status === "running"` or `"paused"`. |

Command rules:

- `commandId` is used for idempotency. Repeating a `world.start_day` command with the same `commandId` returns the same result without creating a second day.
- Invalid day/time transitions are rejected structurally with `CommandResult { status: "rejected", error: { code, message } }`.
- `world.end_day` is guarded by a `dayEnded` flag per day; repeated invocations for the same day are idempotent no-ops.
- `world.advance_time` with `minutes <= 0` is rejected.
- `world.advance_time` that would cross the configured end-of-day minute stops at the end-of-day boundary and triggers `world.day_ending`.

## Events

All life-sim events have the same envelope as runtime events but are stored in the life-sim store, not in the RuntimeAdapter event stream.

```ts
interface LifeSimEvent<P = unknown> {
  eventId: string;
  worldId: string;
  lifeSimSequence: number;
  type: string;
  occurredAt: string; // ISO 8601, wall-clock
  worldMinute: number; // minuteOfDay when the event occurred
  day: number;
  causationId: string | null;
  payload: P;
}
```

Event types:

| Event | Payload | Emitted when |
|---|---|---|
| `world.day_started` | `{ day, dayOfWeek, startedAtWorldMinute }` | `world.start_day` accepted. |
| `world.time_advanced` | `{ oldMinute, newMinute, day }` | The clock moves from `oldMinute` to `newMinute`. Large advances are coalesced into one event but still execute every boundary. |
| `world.phase_changed` | `{ oldPhase, newPhase, minute }` | The phase derived from `minuteOfDay` changes. |
| `world.day_ending` | `{ day, endedAtWorldMinute }` | `world.end_day` accepted and ordinary activities stop starting. |
| `world.day_ended` | `{ day, summaryId }` | Day summary is persisted. |
| `day.summary_recorded` | `{ summaryId, day, summary: DaySummary }` | The factual summary is computed and stored. |

Event rules:

- `lifeSimSequence` is strictly monotonic per world.
- `worldMinute` and `day` are part of the event identity context; they do not replace `occurredAt`.
- A no-op clock advance (e.g., advancing by 0 minutes or advancing to the current minute) does not emit `world.time_advanced`.
- Transitions at the same virtual minute have a deterministic ordering defined by `schedule-semantics.md`.

## Day boundaries

### Start of day

- `status` moves from `"not_started"` to `"running"`.
- `minuteOfDay` is reset to the configured start-of-day minute (default 480 = 08:00).
- `dayOfWeek` is computed as `(day - 1) % 7 + 1`.
- The schedule engine evaluates each agent's base schedule and emits `schedule.activity_started` for entries matching the start minute.

### End of day

- `status` moves from `"running"` or `"paused"` to `"ending"`.
- No new ordinary base-schedule activities may start.
- Existing in-flight activities may continue only if a policy explicitly permits it (default: no carry-over in V1).
- A `DaySummary` is computed from committed runtime events and life-sim state.
- `world.day_ended` and `day.summary_recorded` are emitted.
- `status` becomes `"not_started"` for the next day.

### Day summary

```ts
interface DaySummary {
  day: number;
  startedAtWorldMinute: number;
  endedAtWorldMinute: number;
  agentActivities: Array<{
    agentId: string;
    activityMinutes: Record<string, number>;
    roomsVisited: string[];
  }>;
  taskCounts: {
    created: number;
    completed: number;
    blocked: number;
    failed: number;
  };
  approvalCounts: {
    requested: number;
    approved: number;
    rejected: number;
  };
  notableEventIds: string[];
}
```

Every number in the summary is derived from committed runtime events or life-sim activity records. The summary is not an LLM narrative in V1.

## Persistence contract

The life-sim persistence layer stores:

- `schemaVersion` — current schema version string.
- `worldClock` — the `WorldClockState` checkpoint.
- `baseSchedules` — per-agent base schedule entries.
- `activeActivities` — current `ActiveAgentActivity` records.
- `activeOverrides` — current task/operator overrides.
- `lifeSimEventLog` — events emitted since the checkpoint.
- `completedDaySummaries` — immutable `DaySummary` records.
- `lastRuntimeSequence` — the runtime `sequence` up to which the life-sim store has caught up.

Atomicity:

- Writes go to a temp file in the same directory, then `fs.rename` / `MoveFileEx` is used for atomic replacement.
- A corrupt or unsupported file causes startup to fail with a clear diagnostic; the app does not silently reset the world.
- Test storage paths are deterministic and isolated per test.
- No secrets, model prompts, or partial state may be written.

## UI projection

```ts
interface WorldClockView {
  day: number;
  dayOfWeek: number;
  minuteOfDay: number;
  phase: WorldClockState["phase"];
  status: WorldClockState["status"];
  speed: number;
}

interface LifeSimProjection {
  world: WorldClockView;
  agents: AgentLifeSimView[];
  nextTransition: { agentId: string; entryId: string; atMinute: number } | null;
  previousDaySummaries: DaySummary[];
}

interface AgentLifeSimView {
  agentId: string;
  currentActivity: string;
  currentRoomId: string | null;
  currentEntryId: string;
  nextEntryId: string | null;
  nextEntryAtMinute: number | null;
  isOverridden: boolean;
  overrideReason: "task" | "operator" | null;
}
```

The UI uses existing design tokens and components. It exposes, when capabilities permit:

- current day and virtual time;
- paused/running status;
- current activity per agent;
- next scheduled transition;
- Start / Pause / Resume / Advance controls in manual mode;
- the most recent `DaySummary`.

## Invariants

- `0 <= minuteOfDay <= 1439` while `status !== "not_started"`.
- `status === "not_started"` implies `minuteOfDay` is the configured start-of-day minute.
- `phase` is always the phase that corresponds to `minuteOfDay`.
- `speed >= 0`.
- `day > 0`.
- `world.time_advanced` never carries `newMinute < oldMinute`.
- `world.day_ended` is emitted at most once per `day`.
