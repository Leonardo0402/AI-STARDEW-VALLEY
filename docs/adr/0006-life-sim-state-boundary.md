# ADR-0006: Life-Sim State Boundary

- **Status**: Proposed
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

`LifeSimStore` maintains a separate `LifeSimSnapshot` and its own event log. It consumes only **applied** operational events (`result.code === "applied"`) from the runtime event stream. It does not modify `RuntimeSnapshot`, `DomainEvent`, or any `RuntimeAdapter`. The generic runtime protocol remains unchanged.

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
- **Event-log trimming requires a fallback.** If the runtime event log is trimmed beyond the life-sim checkpoint, exact historical minute-level counts cannot be reconstructed from the latest runtime snapshot alone.

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
   └─ life-sim API (snapshot, event stream, commands)

Browser / demo-office
├─ RuntimeSession  (operational)
├─ LifeSimSession  (dedicated client)
└─ composed projection → UI
```

Server-side responsibilities:

- Own the canonical `LifeSimSnapshot` and life-sim event log.
- Receive applied operational events from the runtime event journal.
- Process world commands, clock ticks, and committed runtime events through one ordered input queue.
- Persist atomically and recover from restarts, including event-log-trimmed fallback.
- Expose snapshots and events to browser clients.

Browser responsibilities:

- Maintain `RuntimeSession` for operational commands and snapshots.
- Maintain `LifeSimSession` for life-sim commands, snapshots, and event streams.
- Compose `OfficeProjection` and `LifeSimProjection` for the UI.
- Never own canonical life-sim state or persistence.

## Operational event consumption

`LifeSimEngine` consumes operational events only when they are committed by `SnapshotStore` with `result.code === "applied"`.

- `reducer_rejected` events advance runtime sequence but do not change `RuntimeSnapshot`; they must not drive schedules.
- Transport-rejected events (`duplicate`, `runtime_mismatch`, `sequence_gap`, etc.) are invisible to the life-sim engine.
- Each consumed operational event carries `eventId` and `runtimeSequence`. Life-sim events that are caused by an operational event retain those identifiers in `runtimeEventId` and `runtimeSequence`.

## Persistent event catch-up and event-log-trimmed recovery

The life-sim store records `lastAppliedRuntimeSequence` in its checkpoint. On restart it requests runtime event replay from `lastAppliedRuntimeSequence + 1` using a cursor-based API (see `docs/life-sim/client-session-contract.md`).

Three cases:

1. **Full replay available.** The engine replays all missing applied events in order and reaches consistency.
2. **Partial replay available.** The engine replays available events. If a gap remains, it enters `history_truncated` mode.
3. **Event log trimmed / snapshot ahead.** If the runtime snapshot is already beyond `lastAppliedRuntimeSequence + 1` and the intervening events are unavailable, the engine emits `world.history_truncated` with the lost runtime sequence range, marks the current day summary as `truncated: true`, and continues from the next available applied event.

A latest runtime snapshot cannot reconstruct exact historical approval counts or interruption times. The contract makes this explicit: minute-level historical accuracy is only guaranteed when every applied event is replayed.

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
│              │ applied events     │  │ Ordered input queue     │  │  │
│              │ (cursor replay)    │  │ (commands, ticks, ops)  │  │  │
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

- Operational commands (`task.create`, `approval.accept`, etc.) flow through `CommandGateway → RuntimeAdapter.execute → Runtime → SnapshotStore → runtime event journal → LifeSimEngine`.
- Life-sim commands (`world.*`, `schedule.*`) flow through `LifeSimSession → LifeSimEngine`.
- The UI uses a composed projection that merges `OfficeProjection` and `LifeSimProjection`.

## Persistence and restart

`LifeSimStore` persists on the server:

- `lifeSimSnapshot` — a checkpoint of world clock, active activities, base schedules, active overlays, and `lastAppliedRuntimeSequence`;
- `lifeSimEventLog` — life-sim events emitted since the checkpoint;
- `baseSchedules` — the deterministic base schedules for each agent;
- `completedDaySummaries` — immutable summaries of ended days;
- `truncatedHistory` — marker for `history_truncated` recovery.

The persistence store is an atomic JSON file:

- schema version field;
- write to a temp file + atomic rename;
- startup validation with a clear diagnostic on corrupt or unsupported files;
- deterministic paths for tests;
- no secrets or model prompts.

Restart procedure:

1. Load the life-sim checkpoint from disk.
2. Request runtime event replay from `lastAppliedRuntimeSequence + 1`.
3. Apply all available applied events through the life-sim reducer.
4. If the runtime event log is trimmed, emit `world.history_truncated` and mark the current day summary as truncated.
5. Replay the life-sim event log from the checkpoint forward.
6. The life-sim API becomes available only after the store is consistent or has entered a defined truncated state.

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
- `packages/core/src/session.ts`
- `packages/core/src/store.ts`
- `packages/core/src/reducer.ts`
- `packages/core/src/projection.ts`
