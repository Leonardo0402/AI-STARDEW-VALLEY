# Life-Sim Day Cycle Contract

This document defines the virtual clock and day boundary semantics for the server-side `LifeSimEngine` and the browser-side `LifeSimSession`. It does not define task execution, artifact production, or approval resolution — those remain in the Runtime contract.

For the canonical `LifeSimSnapshot` structure, see `docs/life-sim/client-session-contract.md`.
For the transport boundary between server and browser, see `docs/life-sim/client-session-contract.md`.

## State

### `WorldClockState`

```ts
interface WorldClockState {
  worldId: string;
  day: number;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  minuteOfDay: number; // 0..1439 while a day is running; configured start-of-day minute when not_started
  phase: "dawn" | "morning" | "afternoon" | "evening" | "night";
  status: "not_started" | "running" | "paused" | "ending";
  speed: number; // virtual minutes per real second, or 0 in manual mode
  fractionalMinute: number; // accumulated fractional minutes in real-time mode
  updatedAt: string; // ISO 8601
}
```

Field semantics:

- `worldId` — identifies the persistent world. One office/demo owns one world in V1.
- `day` — positive integer, starts at 1.
- `dayOfWeek` — 1..7, purely for display and future weekly-schedule support.
- `minuteOfDay` — 0 (00:00) to 1439 (23:59) while `status !== "not_started"`. After `world.day_ended` and before the next `world.start_day`, `minuteOfDay` is reset to the configured start-of-day minute (default 480 = 08:00).
- `phase` — derived from `minuteOfDay` using the table below. When `status === "not_started"`, phase is derived from the start-of-day minute.
- `status` — controls whether the clock may advance.
- `speed` — `0` means manual mode; a positive number means real-time compressed mode.
- `fractionalMinute` — accumulated fractional minutes when running in real-time mode. Saved on pause/shutdown so resume continues from the exact virtual time.
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
- `fractionalMinute` is always `0`.

### Real-time compressed mode

Used for interactive demos.

- `speed` is configurable as virtual minutes per real second (e.g., `10` means 10 virtual minutes elapse for each real second).
- The driver uses a single `setInterval` or animation-frame loop.
- Pause freezes the clock without losing accumulated `fractionalMinute`.
- Resume continues from the exact virtual minute where pause occurred.
- Monotonic progression: the driver never moves time backward.
- Bounded catch-up: if the event loop is delayed, the driver may emit a single coarser `world.time_advanced` event, but it still executes every schedule boundary exactly once.
- No duplicate boundary execution: each boundary is keyed by `(day, minute, boundaryId)` and guarded by the store's last-applied sequence.
- Process shutdown persists the last committed world time; offline catch-up while the process is stopped is out of scope for V1.

## Serial input queue

All inputs to `LifeSimEngine` are serialized through one FIFO queue:

1. Applied operational runtime events (`DomainEvent` with `result.code === "applied"`).
2. World commands (`world.*`).
3. Schedule commands (`schedule.*`).
4. Clock tick inputs (real-time compressed mode only).

The numbered list defines input **kinds**, not priorities. Within the queue, inputs are processed strictly in FIFO order. Concurrent inputs are never applied in parallel; the engine is single-threaded per world.

When an applied operational event is dequeued, the engine records the current `worldClock.minuteOfDay` as the event's binding minute. Commands and clock ticks are likewise stamped with the world minute at which they are processed.

A `world.advance_time` command is a single FIFO input. While it is being processed, no other input can be interleaved. Runtime events that were enqueued before the advance are processed before it; runtime events enqueued after it are processed after it.

## Commands

All commands are addressed to the server-side `LifeSimEngine`, not to the `RuntimeAdapter`.

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
| `world.start_day` | `{ day?: number }` | When `status === "not_started"`. `day` must be `1` for the first day, or `lastCompletedDay + 1` afterwards. |
| `world.pause` | `{}` | When `status === "running"`. |
| `world.resume` | `{}` | When `status === "paused"`. |
| `world.advance_time` | `{ minutes: number }` | Manual/dev mode only. Rejected in real-time mode. |
| `world.end_day` | `{}` | Only when `status === "running"` or `"paused"` **and** `minuteOfDay === configuredEndOfDayMinute`. |

Command rules:

- `commandId` is used for idempotency. Repeating a command with the same `commandId` returns the stored result without mutating state.
- Invalid day/time transitions are rejected structurally with `LifeSimCommandResult { status: "rejected", error: { code, message } }`.
- `world.start_day` is rejected unless `status === "not_started"`. If `day` is supplied, it must equal `1` when no day has been completed, otherwise `lastCompletedDay + 1`. If omitted, the engine uses the same computed next day. Jumping ahead or rewinding is not allowed in V1.
- `world.end_day` is rejected if the current virtual minute is not exactly the configured end-of-day minute. Forced early end is not supported in V1.
- `world.end_day` is guarded by a `dayEnded` flag per day; repeated invocations for the same day are idempotent no-ops.
- `world.advance_time` with `minutes <= 0` is rejected.
- `world.advance_time` that would reach the configured end-of-day minute stops at that boundary and does **not** emit `world.day_ending`; it only makes `world.end_day` available for the operator to call.
- `world.run_to_end_of_day` is available only in manual mode; it advances to the configured end-of-day minute and does **not** emit `world.day_ending`.
- A command returns `accepted` only after its effects have been durably persisted.

## Command result and capabilities

See `docs/life-sim/client-session-contract.md` for full definitions.

```ts
interface LifeSimCommandResult {
  commandId: string;
  status: "accepted" | "rejected";
  lifeSimSequence: number | null;
  events: LifeSimEvent[];
  error: {
    code: LifeSimCommandErrorCode;
    message: string;
  } | null;
}

interface LifeSimCapabilities {
  world: {
    startDay: boolean;
    pause: boolean;
    resume: boolean;
    endDay: boolean; // true only at configured end-of-day minute in V1
    advanceTime: boolean;
  };
  schedule: {
    override: boolean;
    clearOverride: boolean;
  };
  clock: {
    mode: "manual" | "realtime";
    maxSpeed: number;
  };
}
```

- `advanceTime` is `true` only when `clock.mode === "manual"`.
- `endDay` is advertised as `true` only when the current virtual minute equals the configured end-of-day minute.
- The UI hides or disables controls for capabilities that are `false`.

## Events

All life-sim events are stored in the server-side `LifeSimStore`, not in the `RuntimeAdapter` event stream.

```ts
interface LifeSimEvent<P = unknown> {
  eventId: string;
  worldId: string;
  lifeSimSequence: number;
  type: string;
  occurredAt: string; // ISO 8601, wall-clock
  worldMinute: number;
  day: number;
  causationId: string | null;
  runtimeEventId: string | null;
  runtimeSequence: number | null;
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
| `world.day_ended` | `{ day, summaryId }` | Day summary is persisted and all end-of-day processing is complete. |
| `day.summary_recorded` | `{ summaryId, day, summary: DaySummary }` | The factual summary is computed and stored. |
| `world.history_truncated` | `{ lostRuntimeRange: { from: number; to: number } }` | Runtime event log is trimmed beyond the life-sim checkpoint. |
| `schedule.overlay_reconstructed` | `{ overlayId, agentId, reconstructionSource, originalStartMinute }` | An overlay is rebuilt from a runtime snapshot after history truncation. |

Event rules:

- `lifeSimSequence` is strictly monotonic per world.
- `worldMinute` and `day` are part of the event identity context; they do not replace `occurredAt`.
- A no-op clock advance does not emit `world.time_advanced`.
- `runtimeEventId` and `runtimeSequence` are present when the event is a reaction to a committed operational event.
- Event IDs are deterministic for deterministic inputs. Manual mode with the same command sequence produces the same `eventId` values.

## Complete event ordering for a large time advance

A `world.advance_time` command is processed atomically. Within that command, the engine advances from `oldMinute` to `newMinute` and evaluates schedule boundaries for each crossed minute `m` (from `oldMinute + 1` to `newMinute`):

1. Runtime events that were enqueued before the advance have already been applied. No runtime event is applied mid-advance.
2. Existing overlays that end early at minute `m` (`schedule.overlay_ended`).
3. Activity completions for entries ending at minute `m`.
4. Phase changes if minute `m` crosses a phase boundary.
5. Activity starts for entries beginning at minute `m`.
6. Location changes implied by the above, but only when `oldRoomId !== newRoomId`.
7. After all crossed minutes are processed, `world.time_advanced` coalesces the entire advance.

For deterministic replay, the ordering must depend only on `(day, minute, entryId, overlayId, runtimeSequence)`, not on wall-clock timing.

## Day boundaries

### Start of day

- `status` moves from `"not_started"` to `"running"`.
- `minuteOfDay` is reset to the configured start-of-day minute (default 480 = 08:00).
- `dayOfWeek` is computed as `(day - 1) % 7 + 1`.
- `fractionalMinute` is reset to `0`.
- The schedule engine evaluates each agent's base schedule and emits `schedule.activity_started` for entries matching the start minute.

### End of day

End-of-day processing follows this exact order:

1. `world.end_day` accepted; `status` moves to `"ending"`. This is allowed only when `minuteOfDay` equals the configured end-of-day minute.
2. No new ordinary base-schedule activities may start.
3. Existing in-flight activities continue until their configured `endMinute`, but they are not allowed to extend beyond the configured end-of-day minute (default: no carry-over in V1).
4. All leave activities complete.
5. Any remaining active overlays are ended with reason `day_ending`.
6. Necessary `agent.location_changed` events are emitted (only when the room actually changes).
7. `world.day_ending` is emitted.
8. `DaySummary` is computed.
9. `day.summary_recorded` is emitted.
10. `world.day_ended` is emitted.
11. `status` becomes `"not_started"` and `minuteOfDay` resets to the configured start-of-day minute for the next day. `day` does not increment until the next `world.start_day`.

There is no implicit day rollover at 00:00.

### Day summary

```ts
interface DaySummary {
  day: number;
  startedAtWorldMinute: number;
  endedAtWorldMinute: number;
  truncated: boolean;
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

- `truncated` is `true` if the summary is based on a `world.history_truncated` recovery.
- Every number is derived from committed runtime events or life-sim activity records.
- `notableEventIds` is a deterministic selection of up to 10 runtime event IDs that shaped the day: first task assignment, first approval request, first approval resolution, first task completion, first task failure/block. If no such events occurred, the array is empty.
- The summary is not an LLM narrative in V1.

## Persistence contract

The server-side life-sim persistence layer stores:

- `schemaVersion` — current schema version string.
- `worldClock` — the `WorldClockState` checkpoint.
- `baseSchedules` — per-agent base schedule entries.
- `activeActivities` — current `ActiveAgentActivity` records.
- `activeOverlays` — current schedule overlays.
- `lifeSimEventLog` — events emitted since the checkpoint.
- `completedDaySummaries` — immutable `DaySummary` records.
- `lastObservedRuntimeSequence` — the runtime replay cursor up to which every journal record has been observed, including `reducer_rejected` events.
- `truncatedHistory` — marker for `history_truncated` recovery.
- `idempotencyResults` — map from `commandId` to `LifeSimCommandResult` for accepted commands within the retention window.

Durability rule:

- A command returns `accepted` only after the resulting events, the updated snapshot, and the idempotency result have been durably written.
- Two strategies are acceptable:
  1. **Simple immediate atomic write** — every accepted command triggers a single atomic JSON write of the full snapshot + event log tail + idempotency map.
  2. **WAL + periodic snapshot** — commands are appended to a durable write-ahead log; a background process checkpoints the snapshot.
- Atomicity is achieved by write-to-temp + atomic rename (`fs.rename` / `MoveFileEx`).
- A corrupt or unsupported file causes startup to fail with a clear diagnostic; the app does not silently reset the world.
- Test storage paths are deterministic and isolated per test.
- No secrets, model prompts, or partial state may be written.

### Idempotency retention

- Idempotency results are retained for at least the most recent 10,000 accepted commands or 7 days, whichever is larger.
- After the retention window, a repeated `commandId` is treated as a new command.
- The retention policy is per-world and configurable at deployment time.

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
- the most recent `DaySummary`;
- a truncated-history indicator when `DaySummary.truncated` is `true`.

## Invariants

- `0 <= minuteOfDay <= 1439` while `status !== "not_started"`.
- When `status === "not_started"`, `minuteOfDay` equals the configured start-of-day minute and `fractionalMinute === 0`.
- `phase` is always the phase that corresponds to `minuteOfDay`.
- `speed >= 0`.
- `day > 0`.
- `world.time_advanced` never carries `newMinute < oldMinute`.
- `world.day_ending` is emitted at most once per `day`.
- `world.day_ended` is emitted at most once per `day`.
- `day.summary_recorded` is emitted exactly once between `world.day_ending` and `world.day_ended`.
- `world.history_truncated` is emitted at most once per recovery.
- `fractionalMinute` is persisted on every pause and shutdown in real-time mode.
- No active overlay may reference a non-existent task after truncated reconciliation.
