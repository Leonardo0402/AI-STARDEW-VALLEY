# Phase 0 Self-Review Notes

## Review input

PR #16 Phase 0 review identified these required changes:

1. Move the life-sim state host from browser to server: `LifeSimEngine` + `LifeSimStore` on server, `LifeSimSession` as a dedicated browser client.
2. Define persistent event catch-up and event-log-trimmed recovery instead of relying on `RuntimeSession.onAcceptedEvent`.
3. Consume only applied operational events (`result.code === "applied"`); ignore `reducer_rejected` and transport-rejected events.
4. Define `operationalRoomId`, `scheduledRoomId`, `displayRoomId` precedence.
5. Align examples with real protocol fields:
   - task status `waiting_approval`;
   - `ApprovalRequestedPayload` has `kind`, `artifactIds`, `reason`, no `artifactId`;
   - `ApprovalResolvedPayload` uses `status` and `resolvedBy`;
   - room IDs are entity IDs such as `qclaw-room-review`.
6. Define deterministic reviewer selection policy.
7. Serialize all inputs through one ordered queue and define complete event ordering.
8. Use runtime sequence (not wall-clock) for multiple assignments.
9. Replace destructive override conflict handling with a non-destructive overlay model.
10. Define exact day-ending order, event ID determinism, `LifeSimCommandResult`, `LifeSimCapabilities`, `notableEventIds`, fractional-minute persistence, no-schedule fallback, and early overlay termination.
11. In Sample Day, complete the 18:00–18:30 leave activities before `world.day_ending`.

## Changes applied

- `docs/adr/0006-life-sim-state-boundary.md` rewritten around a server-side `LifeSimEngine`/`LifeSimStore` and browser `LifeSimSession`.
- New `docs/life-sim/client-session-contract.md` added to define the transport API, serial input queue, command result, capabilities, and reconnection semantics.
- `docs/life-sim/day-cycle-contract.md` updated with:
  - server-side scope;
  - `fractionalMinute` persistence;
  - serial input queue reference;
  - `LifeSimCommandResult` / `LifeSimCapabilities`;
  - complete event ordering for large advances;
  - exact end-of-day order;
  - `world.history_truncated` event;
  - `DaySummary.truncated` and `notableEventIds` semantics.
- `docs/life-sim/schedule-semantics.md` updated with:
  - `ScheduleOverlay` type and non-destructive overlay semantics;
  - real protocol fields and entity room IDs;
  - deterministic reviewer selection;
  - runtime sequence ordering for multiple assignments;
  - `operationalRoomId` / `scheduledRoomId` / `displayRoomId` precedence;
  - no-schedule fallback;
  - early overlay termination semantics.
- `docs/life-sim/examples/sample-day.md` updated with:
  - entity room IDs;
  - correct `approval.requested` and `approval.resolved` payloads;
  - reviewer selection note;
  - `schedule.overlay_ended` events for early termination;
  - leave activities completing before `world.day_ending`;
  - `truncated: false` in `DaySummary`;
  - `activeOverlays` state shape.

## Spec coverage scan

| Issue #15 requirement | Where addressed |
|---|---|
| Persistent day cycle with start/end boundaries | `day-cycle-contract.md` |
| Deterministic Agent schedules | `schedule-semantics.md` |
| Server-side state host | `adr/0006-life-sim-state-boundary.md`, `client-session-contract.md` |
| Persistent event catch-up / trimmed recovery | `adr/0006-life-sim-state-boundary.md`, `client-session-contract.md` |
| Consume applied operational events only | `adr/0006-life-sim-state-boundary.md`, `client-session-contract.md`, `day-cycle-contract.md` |
| Operational/scheduled/display room precedence | `schedule-semantics.md` Room precedence |
| Reviewer selection | `schedule-semantics.md` Reviewer selection |
| Serial input queue | `client-session-contract.md`, `day-cycle-contract.md` |
| Non-destructive overlay | `schedule-semantics.md` Effective schedule and non-destructive overlay |
| `LifeSimCommandResult` / `LifeSimCapabilities` | `client-session-contract.md` |
| Three roles with role-default schedules | `schedule-semantics.md` Base schedules |
| Task-driven and operator-driven overlays | `schedule-semantics.md` Task-driven overlays, Operator overlays |
| Interruption and resumption | `schedule-semantics.md` Interruption and Resumption |
| Pending approval handling | `schedule-semantics.md` Pending approval and review activities |
| Day summary derived from runtime events | `day-cycle-contract.md` Day summary |
| Persistence without secrets/prompts | `day-cycle-contract.md` Persistence contract |
| Hard truth boundary | `adr/0006-life-sim-state-boundary.md`, `schedule-semantics.md` Truth boundary |

## Placeholder scan

No placeholders such as "TBD", "TODO", "implement later", or "fill in details" remain. Concrete examples, command payloads, event payloads, and validation rules are specified.

## Open design questions for human review

1. Should the server-side replay endpoint be a separate HTTP endpoint or a gRPC/IPC channel in the Reference Swarm integration? The contract defines an HTTP shape but allows transport alternatives.
2. Should `world.end_day` be permitted before the configured end-of-day minute if all agents are already idle? Current contract allows it only when `status === "running"` or `"paused"`.
3. Should `LifeSimCapabilities` be dynamic per user session in future versions? V1 keeps them static per deployment.
