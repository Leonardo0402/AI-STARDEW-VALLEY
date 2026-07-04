# QClaw/Swarm Contract Gap Analysis

## Generic Wire Protocol (runtime-contract.md §4.3)

The generic protocol defines:
- 4 HTTP endpoints: snapshot, capabilities, events (SSE), commands
- `RuntimeSnapshot` structure with agents/tasks/artifacts/approvals/rooms
- `DomainEvent` envelope with sequence, eventId, correlationId, traceId
- `OfficeCommand` with commandId (idempotency key), commandType, payload
- `replay-complete` SSE control frame for replay boundary

## QClaw/Swarm Gaps (from available evidence)

Since no real QClaw/Swarm contract is available, the gaps are defined
as the **execution semantics** the test runtime will implement to
differentiate it from a trivial identity mapping:

| Gap | Generic Protocol | QClaw Test Runtime Semantics |
|-----|------------------|------------------------------|
| Task dispatch | `task.assign` is a separate command | `task.create` auto-dispatches to an available worker |
| Task start | `task.started` is a separate event | `task.assigned` auto-triggers `task.started` |
| Review→Approval | Manual orchestration | `artifact.reviewed(approved)` auto-triggers `approval.requested` |
| Approval→Complete | Manual orchestration | `approval.accept` auto-triggers `task.completed` |
| Approval→Block | Manual orchestration | `approval.reject` auto-triggers `task.blocked` |
| Capabilities | Full feature set | SSE + snapshot + commands only (no websocket, no hard orchestration) |

## Unsupported / Out of Scope

- WebSocket transport (use SSE only)
- Multi-runtime orchestration (single runtime only)
- Real LLM execution (scripted agent behavior)
- Authentication (local dev only, no tokens)
- Persistent storage (in-memory, reset on restart)
- Event log trimming (full history retained for replay)
