# ADR-0006: Life-Sim State Boundary

- **Status**: Accepted
- **Date**: 2026-07-05
- **Issue**: #15 — AI Stardew foundation: persistent day cycle and deterministic Agent schedules

## Context

Issue #15 adds a persistent virtual clock and deterministic Agent schedules to the existing office. The operational Runtime already owns the authoritative truth for tasks, artifacts, approvals, and agent status. The new life-sim layer must observe that truth without conflating its own concepts (planned activity, virtual time, room location) with operational outcomes.

Survey of the current integration surface:

- `RuntimeSession` (in `packages/core`) owns the bootstrap order `connect → getSnapshot → setSnapshot → subscribe` and exposes `onAcceptedEvent` for every event that has been accepted by `SnapshotStore`.
- `SnapshotStore` is checkpoint-aware and event-sourced: it holds a `baseSnapshot` plus an ordered `eventLog` of post-checkpoint events. All state mutations are reconstructible from a checkpoint plus the log.
- `reduceEvent` (in `packages/core/src/reducer.ts`) is a pure function that applies a `DomainEvent` to a `RuntimeSnapshot`. It knows nothing about UI or wall-clock time.
- `OfficeProjection` (in `packages/core/src/projection.ts`) is a read-only view derived from `RuntimeSnapshot`; the UI consumes only this projection.
- Adapters (`packages/adapters/mock`, `packages/adapters/http-sse`, `packages/adapters/qclaw-swarm`) implement the generic `RuntimeAdapter` protocol. The HTTP/SSE adapter performs deep structural validation of `RuntimeSnapshot` at the wire boundary.
- The UI command path is `UI → CommandGateway → RuntimeAdapter.execute → Runtime → DomainEvent → SnapshotStore`.

The initial draft of this ADR placed `LifeSimStore` inside the browser. Review showed that a browser Vite client cannot own atomic filesystem persistence or process-restart durability, and browser-local events cannot be shared across clients. The architecture must therefore choose an explicit server-side host for the life-sim engine and store, with a dedicated browser client/session.

## Decision

Run `LifeSimEngine` and `LifeSimStore` on the server side (co-located with the Reference Swarm or a companion server). Expose a dedicated life-sim API for snapshots, events, and commands. The browser holds both `RuntimeSession` (for operational state) and `LifeSimSession` (for life-sim state), and composes the two projections at the application boundary.

`LifeSimStore` maintains a separate `LifeSimSnapshot` and its own event log. It consumes only **applied** operational events (`result.code === "applied"`) from the runtime event stream through an internal `OperationalEventJournal` interface. It does not modify `RuntimeSnapshot`, `DomainEvent`, or any `RuntimeAdapter`. The generic runtime protocol remains unchanged.

This is **Option B (separate `LifeSimSnapshot`) composed with Option C's separate reducer/event stream**, now hosted on a server with a dedicated browser client.

## Consequences

### Positive

- **Operational protocol remains stable.** `RuntimeSnapshot`, `DomainEvent`, `OfficeCommand`, and adapter validators are unchanged.
- **Adapters remain unchanged.** Mock, HTTP/SSE, and QClaw adapters do not need to know about world time or schedules.
- **Persistence matches the host.** Atomic JSON writes and process-restart durability are natural on the server, impossible in a Vite browser.
- **Schedule engine is isolated and testable.** It can be unit-tested with a fixed runtime snapshot and a fixed command log, without spinning up a RuntimeSession.
- **Replay stays deterministic.** The life-sim reducer is a pure function of `(runtimeSnapshot, lifeSimSnapshot, lifeSimCommand)`. Replaying the same applied runtime events and the same life-sim command log produces the same state.
- **Future extensions stay local.** Memory, weather, relationships, and town locations can be added inside `packages/life-sim` without touching `packages/protocol` or `packages/core`.
- **Hard truth boundary is enforced by architecture.** Because the life-sim store has no path to emit `task.completed`, `artifact.created`, or `approval.resolved` events, it cannot fabricate operational progress.

### Negative

- **The UI must compose two sessions/projections.** A new hook or view model merges `OfficeProjection` and `LifeSimProjection`.
- **Two server-side checkpoints must be kept consistent at restart.** On startup the life-sim engine must replay applied runtime events from after its own last-known runtime sequence.
- **A separate transport contract is required.** The browser needs a `LifeSimClient` with its own subscribe/replay/cursor semantics (see `docs/life-sim/client-session-contract.md`).
- **Event-log trimming requires a fallback.** If the runtime event log is trimmed beyond the life-sim checkpoint, exact historical minute-level counts cannot be reconstructed from the latest runtime snapshot alone. However, the latest snapshot can still be used to reconcile current overlays and tasks.

## Alternatives considered

### Option A — extend RuntimeSnapshot

Rejected. Adding `world` and `schedule` fields to `RuntimeSnapshot` would force a schema version bump, require adapter updates, and expand the HTTP/SSE validator surface. It would also blur the truth boundary by making the runtime protocol responsible for office-side simulation state.

### Option B — separate LifeSimSnapshot in the browser

Rejected. A Vite browser cannot own atomic filesystem persistence or process-restart durability, and browser-local events cannot be shared across clients.

### Option C — dedicated world entities/events inside the same runtime event stream

Partially rejected. Using the same `DomainEvent` transport for world events would keep `RuntimeSnapshot` unchanged only if the world reducer output lived outside the snapshot. That is the shape selected here, but we rejected emitting world events through the `RuntimeAdapter`, which would require adapters to forward events they do not own.

## Architecture

```text
Reference Swarm / companion server
├─ operational runtime
│  ├─ RuntimeSession / SnapshotStore
│  └─ RuntimeAdapter (Mock / HTTP-SSE / QClaw)
└─ LifeSimEngine
   ├─ LifeSimStore  (persistent)
   ├─ LifeSimReducer
   ├─ OperationalEventJournal  (internal dependency)
   └─ life-sim API (snapshot, event stream, commands)

Browser / demo-office
├─ RuntimeSession  (operational)
├─ LifeSimSession  (dedicated client)
└─ composed projection → UI
```

Server-side responsibilities:

- Own the canonical `LifeSimSnapshot` and life-sim event log.
- Receive applied operational events from the runtime event journal via `OperationalEventJournal`.
- Process world commands, clock ticks, and committed runtime events through one ordered input queue.
- Persist atomically and recover from restarts, including event-log-trimmed reconciliation.
- Expose snapshots and events to browser clients.

Browser responsibilities:

- Maintain `RuntimeSession` for operational commands and snapshots.
- Maintain `LifeSimSession` for life-sim commands, snapshots, and event streams.
- Compose `OfficeProjection` and `LifeSimProjection` for the UI.
- Never own canonical life-sim state or persistence.

## `LifeSimSnapshot`

The canonical server-side state is defined in `docs/life-sim/client-session-contract.md` as:

```ts
interface LifeSimSnapshot {
  worldId: string;
  schemaVersion: string;
  checkpointLifeSimSequence: number;
  lastObservedRuntimeSequence: number;   // replay cursor; advances across every journal record
  lastAppliedRuntimeSequence: number;    // diagnostic; only applied events mutate LifeSim
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

This structure is separate from `RuntimeSnapshot` and is not visible to adapters.

## Internal dependency: `OperationalEventJournal`

The `LifeSimEngine` depends on the runtime's applied event journal through an internal interface, not through its own public HTTP API.

```ts
interface OperationalEventJournal {
  replayApplied(
    fromRuntimeSequence: number
  ): Promise<OperationalReplayResult>;

  getCurrentSnapshot(): Promise<RuntimeSnapshot>;
}

interface OperationalReplayResult {
  events: Array<{ runtimeEvent: DomainEvent; runtimeSequence: number }>;
  nextRuntimeSequence: number; // watermark to advance the replay cursor; may equal fromSequence if the range had no applied events
  truncated: boolean;
  lostRuntimeRange: { from: number; to: number } | null;
}
```

Responsibilities:

- `replayApplied` returns only applied operational events from the requested runtime sequence onward. It never returns `reducer_rejected` or transport-rejected events.
- `nextRuntimeSequence` is a watermark that advances across every runtime journal record in the requested range, including `reducer_rejected` entries. The engine must persist this as `lastObservedRuntimeSequence` even when `events` is empty, otherwise restart will repeatedly request the same range.
- `getCurrentSnapshot` returns the latest runtime snapshot for reconciliation when the event log is trimmed.
- The Reference Swarm runtime or a companion server implements this interface. The HTTP/SSE `RuntimeAdapter` itself is not involved.
- The public `GET /life-sim/{worldId}/replay` endpoint is for diagnostics and external tools only; the engine does not call it.

## Operational event consumption

`LifeSimEngine` consumes operational events only when they are committed by `SnapshotStore` with `result.code === "applied"`.

- `reducer_rejected` events advance runtime sequence but do not change `RuntimeSnapshot`; they must not drive schedules.
- Transport-rejected events (`duplicate`, `runtime_mismatch`, `sequence_gap`, etc.) are invisible to the life-sim engine.
- Each consumed operational event carries `eventId` and `runtimeSequence`. Life-sim events that are caused by an operational event retain those identifiers in `runtimeEventId` and `runtimeSequence`.
- When an applied operational event is dequeued by the engine, it is bound to the current `worldClock.minuteOfDay`. This binding is deterministic and replayable because inputs are processed in FIFO order.

## Persistent event catch-up and event-log-trimmed reconciliation

The life-sim store records `lastObservedRuntimeSequence` in its checkpoint. On restart it calls `OperationalEventJournal.replayApplied(lastObservedRuntimeSequence + 1)`.

For each replay result:

- The engine applies every returned applied event in order, emitting any resulting life-sim events.
- It atomically persists `lastObservedRuntimeSequence = nextRuntimeSequence`, even when `events` is empty. This prevents restart from re-requesting the same range.
- It updates `lastAppliedRuntimeSequence` to the most recent applied event that actually mutated LifeSim state.

Three cases:

1. **Full replay available.** The engine replays all missing applied events in order, advances the cursor to the current journal head, and reaches consistency.
2. **Partial replay available.** The engine replays available events and advances the cursor to the end of the available range. If a gap remains, it enters `history_truncated` reconciliation.
3. **Event log trimmed / snapshot ahead.** If `replayApplied` returns `truncated: true` and the latest runtime snapshot is already beyond the missing range, the engine:
   - emits `world.history_truncated` with the lost runtime sequence range;
   - reconciles active overlays against `getCurrentSnapshot()`;
   - marks the current day summary as `truncated: true`;
   - persists the new replay cursor;
   - continues from the next available applied event.

### Truncated reconciliation rules

A latest runtime snapshot cannot reconstruct exact historical approval counts or interruption times, but it can repair the current state so that stale overlays do not live forever.

For each `RuntimeSnapshot.task` after a truncated gap:

- **Terminal-for-overlay states:** `completed`, `failed`, `blocked`, `cancelled`. Any overlay referencing a task in one of these states is closed.
- **Active Worker overlay states:** `assigned`, `planning`, `running`, `reviewing`, `revision_required`. If the task is in one of these states and assigned to an operational Agent, a provisional `task_overlay` is created for that Agent from the current world minute to the configured end-of-day minute. Its `createdByRuntimeSequence` is set to the runtime sequence of the snapshot, and a `schedule.overlay_reconstructed` event is emitted with `reconstructionSource: "runtime_snapshot"`.
- **`waiting_approval`:** the Worker overlay is retained or reconstructed, and a Reviewer overlay is created if a reviewer is currently assigned by the runtime or selected by the deterministic reviewer policy. If no reviewer is deterministically selectable, the approval is left unassigned but the Worker overlay remains.
- Any overlay whose referenced task cannot be found is closed; no orphaned overlays are allowed.
- Reconstructed overlays record `originalStartMinute: null` to indicate that the exact start time is unknown.
- Activity duration and day-summary counters for the truncated day are marked `truncated: true`. They are valid from the reconciliation point forward, not for the entire day.

This reconciliation table must match the live task-overlay lifecycle in `docs/life-sim/schedule-semantics.md`.

For each `RuntimeSnapshot.agent`:

- If the agent is non-operational (`offline`, `failed`, `paused`), its current activity is interrupted.
- The agent's `operationalRoomId` is read from `AgentSnapshot.currentRoomId` and fed into the room-precedence rules in `docs/life-sim/schedule-semantics.md`.

## Persistence and durability boundary

`LifeSimStore` persists on the server. A command returns `accepted` only after the resulting events, the updated snapshot, and the idempotency result have all been durably written.

The same durability rule applies to every dequeued input, not only to commands. When an applied operational runtime event or a clock tick is dequeued, the engine binds it to the current world minute, runs the life-sim reducer, appends any emitted events to the life-sim event log, advances `lastObservedRuntimeSequence` when applicable, and durably writes the snapshot, log tail, and idempotency record before the next input is dequeued.

Two acceptable persistence strategies:

1. **Simple immediate atomic write.** Every accepted command triggers a single atomic JSON write of the full snapshot + event log tail + idempotency map. Suitable for demo and small-scale deployments.
2. **WAL + periodic snapshot.** Accepted commands are first appended to a durable write-ahead log; a background process periodically checkpoints the snapshot. Recovery replays the WAL from the last snapshot. This is the preferred path for higher throughput in later phases.

Regardless of strategy, the contract is:

- `LifeSimCommandResult.status === "accepted"` implies that the command's effects are durable before the result is returned.
- Idempotency results are persisted alongside the state so that replayed commands return the original `events` and `lifeSimSequence` without re-mutating state.
- Atomicity is achieved by write-to-temp + atomic rename (`fs.rename` / `MoveFileEx`).
- Corrupt or unsupported files cause startup to fail with a clear diagnostic.

### Idempotency retention

- Idempotency results are retained for at least the most recent 10,000 accepted commands or 7 days, whichever is larger.
- After the retention window, a repeated `commandId` is treated as a new command and may be rejected if it conflicts with current state (e.g., `world.start_day` when a day is already running).
- The retention policy is per-world and configurable at deployment time.

## Browser startup and subscription

The browser must establish life-sim state in this exact order:

1. `GET /life-sim/{worldId}/snapshot`.
2. Install `snapshot` as the current local projection.
3. Apply `eventLogTail` in order.
4. Subscribe from `afterLifeSimSequence = checkpointLifeSimSequence + eventLogTail.length`.

See `docs/life-sim/client-session-contract.md` for the full client contract.

## Integration sketch

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Server                                        │
│                                                                       │
│  ┌─────────────────────────┐      ┌───────────────────────────────┐  │
│  │  Runtime                │      │  LifeSimEngine                │  │
│  │  (RuntimeSession +      │      │  ┌─────────────────────────┐  │  │
│  │   SnapshotStore)        │      │  │ LifeSimStore            │  │  │
│  │                         │      │  │  (snapshot + event log) │  │  │
│  │  event journal          │      │  └─────────────────────────┘  │  │
│  └───────────┬─────────────┘      │  ┌─────────────────────────┐  │  │
│              │ applied events     │  │ OperationalEventJournal │  │  │
│              │ (internal)         │  │  (internal interface)   │  │  │
│              └──────────────────>│  └─────────────────────────┘  │  │
│                                  └───────────┬───────────────────┘  │
│                                              │ snapshot / events   │
└──────────────────────────────────────────────┼───────────────────────┘
                                               │
                                               │ SSE / WebSocket / polling
                                               │
┌──────────────────────────────────────────────┼───────────────────────┐
│                         Browser              │                       │
│                                              ▼                       │
│  ┌─────────────────┐      ┌─────────────────────────┐              │
│  │  RuntimeSession │      │  LifeSimSession         │              │
│  │  (operational)  │      │  (dedicated client)     │              │
│  └────────┬────────┘      └───────────┬─────────────┘              │
│           │                            │                            │
│           ▼                            ▼                            │
│  ┌─────────────────┐      ┌─────────────────────────┐              │
│  │  Office UI      │      │  Life-Sim UI            │              │
│  │                 │      │                         │              │
│  └────────┬────────┘      └───────────┬─────────────┘              │
│           │                            │                            │
│           ▼                            ▼                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │  composed projection (Office + LifeSim)          │              │
│  └──────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

Key points:

- Operational commands (`task.create`, `approval.accept`, etc.) flow through `CommandGateway → RuntimeAdapter.execute → Runtime → SnapshotStore → OperationalEventJournal → LifeSimEngine`.
- Life-sim commands (`world.*`, `schedule.*`) flow through `LifeSimSession → LifeSimEngine`.
- The UI uses a composed projection that merges `OfficeProjection` and `LifeSimProjection`.

## Migration path

Later issues (memory, weather, relationships, town map) add new fields and reducers inside `packages/life-sim`. They do not change `RuntimeSnapshot` or `DomainEvent`. If a future design truly requires the remote runtime to observe life-sim state, we can add an optional, adapter-specific extension at that time without retrofitting the generic protocol.

## References

- `docs/protocol/runtime-contract.md`
- `docs/adr/0001-runtime-session-in-core.md`
- `docs/adr/0002-transactional-reducer-commit-and-session-hardening.md`
- `docs/adr/0005-qclaw-swarm-integration-shape.md`
- `docs/life-sim/client-session-contract.md`
- `docs/life-sim/day-cycle-contract.md`
- `docs/life-sim/schedule-semantics.md`
