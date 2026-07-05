# Phase 0 Self-Review Notes

## Review input

Third-round PR #16 review identified these required P0/P1 fixes:

1. `LifeSimSnapshot` was referenced throughout the documents but never formally defined. The snapshot API response also lacked `checkpointLifeSimSequence`, making browser startup instructions unimplementable.
2. `LifeSimEngine` was described as consuming its own public HTTP replay endpoint for runtime event replay. This is circular; the engine needs an internal `OperationalEventJournal` interface implemented by the Reference Swarm / companion server.
3. `history_truncated` recovery only marked the summary as truncated. It must also reconcile active overlays against the latest `RuntimeSnapshot` so stale overlays do not live forever.
4. The persistence contract mixed "every commit is atomic" with "real-time batch window", creating an ambiguity where an `accepted` command could be lost on crash. The durability boundary must state that `accepted` is returned only after events, snapshot/WAL, and idempotency result are durable.
5. Protocol payload examples were still wrong:
   - `approval.requested` uses `requestedBy` and `reason`, not `artifactId` or `artifactIds`.
   - `artifact.created` requires `producerAgentId`, `type`, `title`, `uri`, and `version`.
   - Reviewer availability must list precise `AgentStatus` values.
6. Task overlay lifecycle rules were contradictory. The unified rule is: always create an overlay on `task.assigned`; end it on terminal/waiting states, reassignment, or day ending. No `agent.location_changed` when the room does not actually change.
7. Day-end ordering was inconsistent. The correct order is `day_ending → end activities → day.summary_recorded → day_ended`. `world.end_day` must be allowed only at the configured end-of-day minute. After `day_ended`, `status` becomes `not_started` and `minuteOfDay` resets to the start-of-day minute.
8. Large `world.advance_time` was described as processing runtime events inside the advance, which conflicts with the serial FIFO queue. The advance is an atomic command; runtime events enqueued before it run first, runtime events enqueued after it run after.

P1 items:

- `operationalRoomId` null fallback to overlay `scheduledRoomId`.
- Reviewer recovery does not retroactively assign pending approvals.
- Accepted idempotent no-op returns `events: []`.
- `LifeSimCommandResult.error.code` is a closed union.
- Queue ordering is FIFO, not priority-based.

## Changes applied

- `docs/life-sim/client-session-contract.md` rewritten with:
  - formal `LifeSimSnapshot` interface;
  - `checkpointLifeSimSequence` in snapshot response;
  - exact browser startup sequence;
  - removal of `afterRuntimeSequence` from client event stream;
  - closed `LifeSimCommandErrorCode` union;
  - idempotent no-op returning `events: []`;
  - FIFO queue semantics.
- `docs/adr/0006-life-sim-state-boundary.md` updated with:
  - internal `OperationalEventJournal` interface;
  - explicit statement that the public replay endpoint is diagnostic-only;
  - full truncated-reconciliation rules;
  - durability boundary and idempotency retention policy;
  - browser startup sequence reference.
- `docs/life-sim/day-cycle-contract.md` updated with:
  - `LifeSimSnapshot` reference;
  - durability rule that `accepted` implies persistence;
  - atomic `world.advance_time` semantics;
  - `world.end_day` allowed only at configured end-of-day minute;
  - corrected day-end event order (`day_ending → summary_recorded → day_ended`);
  - `not_started` minute reset;
  - `schedule.overlay_reconstructed` event.
- `docs/life-sim/schedule-semantics.md` updated with:
  - unified task overlay lifecycle;
  - `agent.location_changed` only on actual room change;
  - precise reviewer availability statuses;
  - `operationalRoomId ?? scheduledRoomId` fallback;
  - no retroactive reviewer assignment on recovery;
  - `schedule.overlay_reconstructed` event;
  - FIFO note in event ordering.
- `docs/life-sim/examples/sample-day.md` updated with:
  - correct `approval.requested` payload (`requestedBy`, no `artifactIds`);
  - full `artifact.created` payload;
  - always-create-overlay semantics;
  - removed fake `agent.location_changed` events;
  - corrected day-end event order;
  - `world.end_day` allowed at minute 1110 only.

## Spec coverage scan

| Issue #15 requirement | Where addressed |
|---|---|
| Persistent day cycle with start/end boundaries | `day-cycle-contract.md` |
| Deterministic Agent schedules | `schedule-semantics.md` |
| Server-side state host | `adr/0006-life-sim-state-boundary.md`, `client-session-contract.md` |
| Persistent event catch-up / trimmed reconciliation | `adr/0006-life-sim-state-boundary.md`, `client-session-contract.md` |
| Consume applied operational events only | `adr/0006-life-sim-state-boundary.md`, `client-session-contract.md`, `day-cycle-contract.md` |
| Operational/scheduled/display room precedence | `schedule-semantics.md` Room precedence |
| Reviewer selection and availability | `schedule-semantics.md` Reviewer selection |
| Serial input queue / FIFO | `client-session-contract.md`, `day-cycle-contract.md` |
| Non-destructive overlay | `schedule-semantics.md` Effective schedule and non-destructive overlay |
| `LifeSimCommandResult` / `LifeSimCapabilities` | `client-session-contract.md` |
| Three roles with role-default schedules | `schedule-semantics.md` Base schedules |
| Task-driven and operator-driven overlays | `schedule-semantics.md` Task-driven overlays, Operator overlays |
| Interruption and resumption | `schedule-semantics.md` Interruption and Resumption |
| Pending approval handling | `schedule-semantics.md` Pending approval and review activities |
| Day summary derived from runtime events | `day-cycle-contract.md` Day summary |
| Persistence without secrets/prompts | `day-cycle-contract.md`, `adr/0006-life-sim-state-boundary.md` |
| Hard truth boundary | `adr/0006-life-sim-state-boundary.md`, `schedule-semantics.md` Truth boundary |

## Placeholder scan

No placeholders such as "TBD", "TODO", "implement later", or "fill in details" remain. Concrete examples, command payloads, event payloads, and validation rules are specified. Sample payloads are explicitly labeled as minimum narrative fields, with a pointer to the full runtime schema in `packages/protocol/src/index.ts`.

## Open design questions for human review

1. Should the server-side replay endpoint be a separate HTTP endpoint or a gRPC/IPC channel in the Reference Swarm integration? The contract defines an HTTP shape but allows transport alternatives.
2. Should `world.end_day` be permitted before the configured end-of-day minute if all agents are already idle? Current V1 contract rejects it; a future forced-early-end command could be added without breaking this contract.
3. Should `LifeSimCapabilities` be dynamic per user session in future versions? V1 keeps them static per deployment.
