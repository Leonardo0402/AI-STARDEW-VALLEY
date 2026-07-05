# Life-Sim Client / Session Contract

This document defines the transport boundary between the server-side `LifeSimEngine` and the browser-side `LifeSimSession`. The generic `RuntimeAdapter` protocol is unchanged; this is a dedicated, optional life-sim contract.

## Responsibilities

### Server-side `LifeSimEngine`

- Own the canonical `LifeSimSnapshot`, event log, and base schedules.
- Expose a read API for snapshots and events, and a write API for life-sim commands.
- Push applied runtime events from the runtime event journal into its ordered input queue via an internal `OperationalEventJournal` interface (see `docs/adr/0006-life-sim-state-boundary.md`).
- Persist atomically before returning an accepted command result.

### Browser-side `LifeSimSession`

- Connect to the life-sim API and obtain the latest snapshot.
- Apply the snapshot's `eventLogTail` in order.
- Subscribe to life-sim events starting from the last applied `lifeSimSequence`.
- Send life-sim commands and receive command results.
- Expose `onLifeSimEvent`, `getSnapshot()`, and `execute(command)` to the application.
- Never own canonical state; it is a projection cache and command forwarder.

## `LifeSimSnapshot`

The canonical server-side state is defined as:

```ts
interface LifeSimSnapshot {
  worldId: string;
  schemaVersion: string;

  checkpointLifeSimSequence: number;
  lastObservedRuntimeSequence: number;   // replay cursor; advances across every journal record
  lastAppliedRuntimeSequence: number;    // optional diagnostic; only applied events mutate LifeSim

  worldClock: WorldClockState;
  baseSchedules: AgentScheduleEntry[];
  activeActivities: ActiveAgentActivity[];
  activeOverlays: ScheduleOverlay[];
  completedDaySummaries: DaySummary[];

  truncatedHistory: {
    truncated: boolean;
    lostRuntimeRange: { from: number; to: number } | null;
  };
}
```

Field semantics:

- `worldId` — identifies the persistent world.
- `schemaVersion` — schema version of the snapshot; used for migration checks.
- `checkpointLifeSimSequence` — the sequence number of the last event included in the checkpoint. The next emitted event will be `checkpointLifeSimSequence + 1`.
- `lastObservedRuntimeSequence` — the runtime replay cursor. It advances across every runtime journal record, including `reducer_rejected` events, so that restart does not re-request the same range forever.
- `lastAppliedRuntimeSequence` — diagnostic; the runtime sequence of the most recent applied operational event that mutated LifeSim state.
- `worldClock` — current virtual clock state.
- `baseSchedules` — canonical base schedule entries for each agent.
- `activeActivities` — currently active schedule entries.
- `activeOverlays` — currently active overlays.
- `completedDaySummaries` — immutable summaries of ended days.
- `truncatedHistory` — marker for `history_truncated` recovery.

## Snapshot endpoint

```text
GET /life-sim/{worldId}/snapshot
```

Response body:

```ts
interface LifeSimSnapshotResponse {
  worldId: string;
  schemaVersion: string;
  checkpointLifeSimSequence: number;
  snapshot: LifeSimSnapshot;
  eventLogTail: LifeSimEvent[]; // events emitted after the snapshot checkpoint
}
```

The snapshot response tells the client the exact checkpoint sequence and the ordered tail of events that follow it. Clients must apply the tail in order before subscribing.

## Browser startup sequence

The browser must establish life-sim state in this exact order:

1. `GET /life-sim/{worldId}/snapshot`.
2. Install `snapshot` as the current local projection.
3. Apply every event in `eventLogTail` sequentially, in the order returned by the server.
4. Verify tail continuity:
   - the first tail event (if any) must have `lifeSimSequence === checkpointLifeSimSequence + 1`;
   - every subsequent event must have `lifeSimSequence === previous lifeSimSequence + 1`.
   If any event is missing or out of order, discard the local projection and repeat from step 1.
5. Record `lastAppliedLifeSimSequence` from the last tail event's `lifeSimSequence`, or from `checkpointLifeSimSequence` if the tail is empty.
6. Open the event stream with `afterLifeSimSequence = lastAppliedLifeSimSequence`.
7. On reconnection, repeat from step 1; do not reuse a stale local sequence without re-fetching the snapshot.

## Event stream endpoint

```text
GET /life-sim/{worldId}/events?afterLifeSimSequence={n}
```

Transport may be Server-Sent Events, WebSocket, or long-polling. The contract is:

- The server streams `LifeSimEvent` envelopes in `lifeSimSequence` order.
- Each event carries `runtimeEventId` and `runtimeSequence` when it is caused by an applied operational event.
- The client reconnects using the last received `lifeSimSequence`.
- If the server returns `truncated: true` in the snapshot response, the client resets any cached historical counters for the current day and displays a truncated-history indicator.

`afterRuntimeSequence` is intentionally omitted from the client event stream; it is an internal concern of the server-side `OperationalEventJournal`.

## Replay endpoint

```text
GET /life-sim/{worldId}/replay?fromRuntimeSequence={start}&toRuntimeSequence={end}
```

This endpoint is exposed for diagnostics, observability, or external tools. The server-side `LifeSimEngine` itself does **not** use its own public HTTP replay endpoint as a source of truth; it consumes an internal `OperationalEventJournal` implementation.

Response body:

```ts
interface LifeSimReplayResponse {
  range: { from: number; to: number };
  events: Array<{ runtimeEvent: DomainEvent; lifeSimEvents: LifeSimEvent[] }>;
  truncated: boolean;
  nextAvailableRuntimeSequence: number | null;
}
```

## Command endpoint

```text
POST /life-sim/{worldId}/command
```

Request body: `LifeSimCommand`

Response body: `LifeSimCommandResult`

## Serial input queue

The server-side `LifeSimEngine` processes all inputs through one FIFO queue:

1. Applied operational runtime events (`DomainEvent` with `result.code === "applied"`).
2. World commands (`world.*`).
3. Schedule commands (`schedule.*`).
4. Clock tick inputs (in real-time compressed mode).

The numbered list above defines input **kinds**, not priorities. Within the queue, inputs are processed strictly in FIFO order. Concurrent inputs are never applied in parallel; the engine is single-threaded per world.

When an applied operational event is dequeued, the engine records the current `worldClock.minuteOfDay` as the event's binding minute. Commands and clock ticks are likewise stamped with the world minute at which they are processed.

Every dequeued input is a persistence transaction: the engine binds it to the current world minute, applies the life-sim reducer, appends any emitted events to the life-sim event log, advances `lastObservedRuntimeSequence` when the input is a runtime event, and durably writes the snapshot, log tail, and idempotency record before the next input is dequeued or before the command result is returned.

## Command envelope

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

- `eventId` is deterministic for events caused by deterministic inputs (manual mode), and a UUID-like value for clock ticks or operator commands in real-time mode.
- `runtimeEventId` and `runtimeSequence` are present when the life-sim event is a reaction to a committed operational event.
- `causationId` references the triggering command or operational event for traceability.

## Command envelope

```ts
interface LifeSimCommand<P = unknown> {
  commandId: string;
  commandType: string;
  timestamp: string; // ISO 8601
  source: "user" | "system";
  actorId: string;
  worldId: string;
  payload: P;
}
```

`commandId` is used for idempotency. Repeating a command with the same `commandId` returns the stored result without mutating state.

## Command result

```ts
type LifeSimCommandErrorCode =
  | "invalid_command"
  | "invalid_day"
  | "invalid_time"
  | "day_not_started"
  | "day_already_started"
  | "day_already_ended"
  | "end_of_day_not_reached"
  | "advance_not_allowed_in_realtime"
  | "invalid_schedule"
  | "overlay_not_found"
  | "history_truncated"
  | "not_implemented"
  | "internal_error";

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
```

- `status === "accepted"` means the command passed validation, was enqueued, processed, persisted, and produced zero or more events.
- `status === "rejected"` means the command failed validation before entering the queue.
- `lifeSimSequence` is the sequence of the first event produced by the command. It is `null` if the command was rejected, or if the command was accepted but produced zero events (a true no-op).
- Repeating an accepted command by `commandId` returns the stored `lifeSimSequence` and `events` without re-mutating state.
- A true accepted no-op has `lifeSimSequence === null` and `events === []`.
- An idempotent replay of a previously accepted command returns the original `lifeSimSequence` and original `events` (which may be empty); it does not consume a new life-sim sequence.
- The `error.code` is a closed union, not an arbitrary string. Clients may switch on it.

## Capabilities

```ts
interface LifeSimCapabilities {
  world: {
    startDay: boolean;
    pause: boolean;
    resume: boolean;
    endDay: boolean; // true only at configured end-of-day minute in V1
    advanceTime: boolean; // manual/dev mode only
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
- `endDay` is advertised as `true` only when the current virtual minute equals the configured end-of-day minute. Forced early end is not a capability in V1.
- World capabilities (`startDay`, `pause`, `resume`, `endDay`, `advanceTime`) are recomputed after every accepted input because they depend on `WorldClockState`.
- Schedule capabilities (`override`, `clearOverride`) and per-user grants are static per deployment in V1; per-user capability grants are out of scope.
- The UI hides or disables controls for capabilities that are `false`.

## Reconnection and catch-up

On reconnection the browser client:

1. Calls `GET /life-sim/{worldId}/snapshot`.
2. Compares the returned `checkpointLifeSimSequence` with its last known sequence.
3. Applies `eventLogTail` in order and updates `lastAppliedLifeSimSequence` from the last tail event (or `checkpointLifeSimSequence` if empty).
4. Verifies full tail continuity as described in the startup sequence; re-fetches the snapshot if any event is missing or out of order.
5. Opens the event stream from `afterLifeSimSequence = lastAppliedLifeSimSequence`.
6. If `truncatedHistory.truncated` is `true`, the client resets any cached historical counters for the current day and displays a truncated-history indicator.

## Error handling

- Network errors: the client retries with exponential backoff up to a configured maximum.
- Snapshot parse errors: the client treats the life-sim state as unavailable and shows a diagnostic; it does not silently reset.
- Command rejection: the client surfaces the structured `error.code` and `error.message` next to the originating control.
- Out-of-order events: the client drops or buffers events until the expected `lifeSimSequence` is received; gaps trigger a snapshot refresh.
