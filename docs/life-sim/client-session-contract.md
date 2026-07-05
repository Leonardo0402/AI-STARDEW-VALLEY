# Life-Sim Client / Session Contract

This document defines the transport boundary between the server-side `LifeSimEngine` and the browser-side `LifeSimSession`. The generic `RuntimeAdapter` protocol is unchanged; this is a dedicated, optional life-sim contract.

## Responsibilities

### Server-side `LifeSimEngine`

- Own the canonical `LifeSimSnapshot`, event log, and base schedules.
- Expose a read API for snapshots and events, and a write API for life-sim commands.
- Push applied runtime events from the runtime event journal into its ordered input queue.
- Persist atomically on every committed state change (configurable batch window allowed in real-time mode, bounded by durability requirements).

### Browser-side `LifeSimSession`

- Connect to the life-sim API and obtain the latest snapshot.
- Subscribe to life-sim events.
- Send life-sim commands and receive command results.
- Expose `onLifeSimEvent`, `getSnapshot()`, and `execute(command)` to the application.
- Never own canonical state; it is a projection cache and command forwarder.

## API surface

### Snapshot endpoint

```text
GET /life-sim/{worldId}/snapshot
```

Response body:

```ts
interface LifeSimSnapshotResponse {
  worldId: string;
  schemaVersion: string;
  snapshot: LifeSimSnapshot;
  eventLogTail: LifeSimEvent[]; // events emitted after the snapshot checkpoint
  lastAppliedRuntimeSequence: number;
  truncated: boolean;
  truncatedSinceRuntimeSequence: number | null;
}
```

The snapshot endpoint returns the latest checkpoint plus any events emitted since that checkpoint. Clients that want every event can start from `lastAppliedRuntimeSequence` and request replay, or use the live event stream.

### Event stream endpoint

```text
GET /life-sim/{worldId}/events?afterLifeSimSequence={n}&afterRuntimeSequence={m}
```

Transport may be Server-Sent Events, WebSocket, or long-polling. The contract is:

- The server streams `LifeSimEvent` envelopes in `lifeSimSequence` order.
- Each event carries `runtimeSequence` when it is caused by an operational event.
- The server may send a `world.history_truncated` event when the runtime event journal has been trimmed and the client should not expect minute-level accuracy for the current day.
- The client reconnects using the last received `lifeSimSequence` and `runtimeSequence`.

### Replay endpoint

```text
GET /life-sim/{worldId}/replay?fromRuntimeSequence={start}&toRuntimeSequence={end}
```

Response body:

```ts
interface LifeSimReplayResponse {
  range: { from: number; to: number };
  events: Array<{ runtimeEvent: DomainEvent; lifeSimEvents: LifeSimEvent[] }>;
  truncated: boolean;
  nextAvailableRuntimeSequence: number | null;
}
```

The replay endpoint is intended for server-side `LifeSimEngine` restart catch-up. Browser clients normally use the live event stream and snapshot endpoint.

### Command endpoint

```text
POST /life-sim/{worldId}/command
```

Request body: `LifeSimCommand`

Response body: `LifeSimCommandResult`

## Serial input queue

The server-side `LifeSimEngine` processes all inputs through one ordered queue:

1. Committed operational runtime events (`DomainEvent` with `result.code === "applied"`).
2. World commands (`world.*`).
3. Schedule commands (`schedule.*`).
4. Clock tick inputs (in real-time compressed mode).

Ordering rule:

- Inputs are dequeued in the order they are received by the engine.
- Operational events from the runtime journal already have a total order by `runtimeSequence`.
- World/schedule commands and clock ticks are timestamped by wall-clock arrival but sequenced by the engine's own monotonic `lifeSimSequence`.
- Concurrent inputs are never applied in parallel; the engine is single-threaded per world.

## Event envelope

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
interface LifeSimCommandResult {
  commandId: string;
  status: "accepted" | "rejected";
  lifeSimSequence: number | null;
  events: LifeSimEvent[] | null;
  error: {
    code: string;
    message: string;
  } | null;
}
```

- `status === "accepted"` means the command passed validation and was enqueued, processed, and produced events.
- `status === "rejected"` means the command failed validation before entering the queue.
- `lifeSimSequence` is the sequence of the first event produced by the command, or `null` if rejected.
- Repeating an accepted command by `commandId` returns the same `lifeSimSequence` and events.

## Capabilities

```ts
interface LifeSimCapabilities {
  world: {
    startDay: boolean;
    pause: boolean;
    resume: boolean;
    endDay: boolean;
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

- `advanceTime` is disabled in real-time mode.
- Capabilities are static per deployment in V1; per-user capability grants are out of scope.
- The UI hides or disables controls for capabilities that are `false`.

## Reconnection and catch-up

On reconnection the browser client:

1. Calls `GET /life-sim/{worldId}/snapshot`.
2. Compares its last known `lifeSimSequence` with the snapshot's checkpoint sequence.
3. Opens the event stream from `afterLifeSimSequence = lastKnownLifeSimSequence`.
4. If `truncated: true` is returned, the client resets any cached historical counters for the current day and displays a truncated-history indicator.

## Error handling

- Network errors: the client retries with exponential backoff up to a configured maximum.
- Snapshot parse errors: the client treats the life-sim state as unavailable and shows a diagnostic; it does not silently reset.
- Command rejection: the client surfaces the structured `error.code` and `error.message` next to the originating control.
- Out-of-order events: the client drops or buffers events until the expected `lifeSimSequence` is received; gaps trigger a snapshot refresh.
