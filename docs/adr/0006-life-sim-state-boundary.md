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

Any integration shape must therefore answer three questions:

1. Where does the life-sim state live relative to `RuntimeSnapshot`?
2. How do life-sim events/commands travel without breaking existing adapters or validators?
3. How does the UI observe both operational and life-sim truth?

## Decision

Add a separate `LifeSimSnapshot` and `LifeSimStore` inside a new `packages/life-sim` package. The life-sim layer subscribes to `RuntimeSession.onAcceptedEvent` and consumes the same ordered runtime event stream as the office, but maintains its own reducer, checkpoint, and event log. It does not modify `RuntimeSnapshot`, `DomainEvent`, or any adapter. The UI composes `OfficeProjection` and `LifeSimProjection` at the application boundary.

This is **Option B (separate LifeSimSnapshot) composed with Option C (same event stream, separate reducer)**.

## Consequences

### Positive

- **Operational protocol remains stable.** `RuntimeSnapshot`, `DomainEvent`, `OfficeCommand`, and adapter validators are unchanged.
- **Adapters remain unchanged.** Mock, HTTP/SSE, and QClaw adapters do not need to know about world time or schedules.
- **Schedule engine is isolated and testable.** It can be unit-tested with a fixed runtime snapshot and a fixed command log, without spinning up a RuntimeSession.
- **Replay stays deterministic.** The life-sim reducer is a pure function of `(runtimeSnapshot, lifeSimSnapshot, lifeSimCommand)`. Replaying the same runtime events and the same life-sim command log produces the same state.
- **Future extensions stay local.** Memory, weather, relationships, and town locations can be added inside `packages/life-sim` without touching `packages/protocol` or `packages/core`.
- **Hard truth boundary is enforced by architecture.** Because the life-sim store has no path to emit `task.completed`, `artifact.created`, or `approval.resolved` events, it cannot fabricate operational progress.

### Negative

- **The UI must compose two projections.** A new hook or view model will merge `OfficeProjection` and `LifeSimProjection`. This is a small, explicit cost.
- **Two checkpoints must be kept consistent at restart.** On startup the app loads both the runtime checkpoint and the life-sim checkpoint. The life-sim store replays any runtime events that arrived after its own checkpoint before it is considered ready.
- **Life-sim events are local only.** They are not sent to the RuntimeAdapter, so a remote runtime cannot directly observe them. This is acceptable because schedules are an office-side concern.

## Alternatives considered

### Option A — extend RuntimeSnapshot

Rejected. Adding `world` and `schedule` fields to `RuntimeSnapshot` would force a schema version bump, require adapter updates, and expand the HTTP/SSE validator surface. It would also blur the truth boundary by making the runtime protocol responsible for office-side simulation state.

### Option B — separate LifeSimSnapshot with no shared event stream

Rejected as stated. If the life-sim layer did not consume the runtime event stream, it would have to poll `SnapshotStore.getSnapshot()` on every tick, making replay and causality harder to reason about. Consuming the same event stream preserves ordering and causality for free.

### Option C — dedicated world entities/events inside the same event stream

Partially rejected. Using the same `DomainEvent` transport for world events would keep `RuntimeSnapshot` unchanged only if the world reducer output lived outside the snapshot. That is exactly the shape selected here. What we rejected was emitting world events through the `RuntimeAdapter`, which would require adapters to forward events they do not own.

## Integration sketch

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Application (demo-office)                   │
│                                                                     │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────┐ │
│  │  Office UI      │      │  Life-Sim UI    │      │  Composed   │ │
│  │  (ControlPanel) │      │  (clock/schedule│      │  projection │ │
│  │                 │      │   controls)     │      │             │ │
│  └────────┬────────┘      └────────┬────────┘      └──────┬──────┘ │
│           │                        │                       │        │
│           ▼                        ▼                       ▼        │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────┐ │
│  │ useOfficeState  │      │ useLifeSimState │      │ useOffice   │ │
│  │                 │      │                 │      │ +LifeSim    │ │
│  └────────┬────────┘      └────────┬────────┘      └──────┬──────┘ │
│           │                        │                       │        │
│           ▼                        ▼                       │        │
│  ┌─────────────────┐      ┌─────────────────┐              │        │
│  │ SnapshotStore   │      │ LifeSimStore    │              │        │
│  │  (operational)  │      │  (life-sim)     │              │        │
│  └────────┬────────┘      └────────┬────────┘              │        │
│           │                        │                       │        │
│           │  onAcceptedEvent       │                       │        │
│           │──────────────────────>│                       │        │
│           │                        │                       │        │
│           ▼                        ▼                       │        │
│  ┌─────────────────┐      ┌─────────────────┐              │        │
│  │ RuntimeSession  │      │ LifeSimController│             │        │
│  │                 │      │  (world.* cmds) │              │        │
│  └────────┬────────┘      └────────┬────────┘              │        │
│           │                        │                       │        │
│           │                        │                       │        │
│           ▼                        │                       │        │
│  ┌─────────────────┐               │                       │        │
│  │ RuntimeAdapter  │<──────────────┘ (operational cmds)    │        │
│  │                 │                                       │        │
│  └─────────────────┘                                       │        │
└─────────────────────────────────────────────────────────────────────┘
```

Key points:

- `LifeSimStore` subscribes to `RuntimeSession.onAcceptedEvent` and applies operational events to its own reducer. Operational events do not mutate life-sim entities directly, but they provide the factual context (agent statuses, task assignments, approvals) the schedule engine needs.
- `LifeSimController` receives `world.*` and `schedule.*` commands, validates them, and emits life-sim events into `LifeSimStore`. It does not call `RuntimeAdapter.execute` for life-sim commands.
- Operational commands (`task.create`, `approval.accept`, etc.) continue to flow through `CommandGateway → RuntimeAdapter.execute → Runtime → SnapshotStore → RuntimeSession.onAcceptedEvent → LifeSimStore`.
- The UI uses a composed projection that merges `OfficeProjection` and `LifeSimProjection`. The pixel-office renderer can read the composed view to decide agent sprites, room occupancy, and clock display.

## Persistence and restart

`LifeSimStore` persists:

- `lifeSimSnapshot` — a checkpoint of world clock, active activities, base schedules, and active overrides;
- `lifeSimEventLog` — life-sim events emitted since the checkpoint;
- `baseSchedules` — the deterministic base schedules for each agent;
- `completedDaySummaries` — immutable summaries of ended days.

The persistence store is an atomic JSON file:

- schema version field;
- write to a temp file + atomic rename;
- startup validation with a clear diagnostic on corrupt or unsupported files;
- deterministic paths for tests;
- no secrets or model prompts.

Restart procedure:

1. Load runtime checkpoint via `RuntimeSession` bootstrap.
2. Load life-sim checkpoint from disk.
3. Replay any runtime events with `sequence > lifeSimCheckpoint.runtimeSequence` through the life-sim reducer so the life-sim layer catches up to the runtime checkpoint.
4. Replay the life-sim event log from the checkpoint forward.
5. The UI is rendered only after both stores are consistent.

## Migration path

Later issues (memory, weather, relationships, town map) add new fields and reducers inside `packages/life-sim`. They do not change `RuntimeSnapshot` or `DomainEvent`. If a future design truly requires the remote runtime to observe life-sim state, we can add an optional, adapter-specific extension at that time without retrofitting the generic protocol.

## References

- `docs/protocol/runtime-contract.md`
- `docs/adr/0001-runtime-session-in-core.md`
- `docs/adr/0002-transactional-reducer-commit-and-session-hardening.md`
- `docs/adr/0005-qclaw-swarm-integration-shape.md`
- `packages/core/src/session.ts`
- `packages/core/src/store.ts`
- `packages/core/src/reducer.ts`
- `packages/core/src/projection.ts`
