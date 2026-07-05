# Phase 0 Self-Review Notes

## Spec coverage scan

| Issue #15 requirement | Where addressed |
|---|---|
| Persistent day cycle with start/end boundaries | `day-cycle-contract.md` — State, Commands, Day boundaries |
| Deterministic Agent schedules | `schedule-semantics.md` — Core types, Validation, Conflict resolution, Deterministic ordering |
| Three roles with role-default schedules | `schedule-semantics.md` — Base schedules (Orchestrator, Worker, Reviewer) |
| Task-driven and operator-driven overrides | `schedule-semantics.md` — Task-driven overrides, Operator overrides |
| Interruption and resumption | `schedule-semantics.md` — Interruption and Resumption |
| Pending approval handling | `schedule-semantics.md` — Pending approval and review activities |
| Day summary derived from runtime events | `day-cycle-contract.md` — Day summary; `schedule-semantics.md` — Truth boundary |
| Persistence without secrets/prompts | `day-cycle-contract.md` — Persistence contract |
| Hard truth boundary | `adr/0006-life-sim-state-boundary.md`, `schedule-semantics.md` — Truth boundary |
| ADR comparing integration options | `adr/0006-life-sim-state-boundary.md` — Decision and Alternatives considered |
| Manual deterministic mode and real-time compressed mode | `day-cycle-contract.md` — Clock modes |

Out-of-scope items (farming, crafting, building, inventory, shops, weather, relationships, memory, mood, LLM schedules, town map, visual polish) are not present in the contracts.

## Placeholder scan

No placeholders such as "TBD", "TODO", "implement later", or "fill in details" were found. Concrete examples, command payloads, event payloads, and validation rules are specified.

## Type consistency scan

| Type / concept | day-cycle-contract | schedule-semantics | sample-day | Notes |
|---|---|---|---|---|
| `WorldClockState` | defined | referenced | used | consistent |
| `AgentScheduleEntry` | referenced | defined | implied | consistent |
| `ActiveAgentActivity` | referenced | defined | used | consistent |
| `ScheduleOverride` | referenced | defined | used | `createdBy` values align with `source` values |
| `DaySummary` | defined | referenced | used | corrected activity-minute totals during review |
| `LifeSimEvent` envelope | defined | referenced | used | consistent |
| Event ordering | day-cycle references schedule-semantics | defined | follows rules | consistent |

## Finding: sample day activity-minute totals

During review the original sample `DaySummary` activity-minute totals did not sum to the day length (630 minutes) for the Worker and Reviewer, and the Orchestrator work total was inconsistent with the narrative.

Correction applied in `docs/life-sim/examples/sample-day.md`:

- Orchestrator: work 450, review 60.
- Worker: work 450, idle 60.
- Reviewer: review 450, work 60.

Each row now sums to 630 minutes.

## Open design questions for human review

1. Should `world.advance_time` support crossing the end-of-day boundary in one command, or should it always stop at the configured end-of-day minute? Current contract chooses stop-and-trigger-day-ending.
2. Should operator overrides persist across days? Current contract says overrides are scoped to the current day and removed at `world.day_ended`.
3. Should the life-sim store keep its own event log file or store events inline inside the snapshot file? The contract says a single atomic JSON file with an inline event log for V1.
