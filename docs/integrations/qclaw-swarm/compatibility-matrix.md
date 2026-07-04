# QClaw/Swarm Compatibility Matrix

## Supported Events

| Event Type | Supported | Notes |
|-----------|-----------|-------|
| agent.spawned | yes | Initial agents spawned at construction |
| agent.status_changed | yes | Via pause/resume commands |
| task.created | yes | Via task.create command (auto-dispatch) |
| task.assigned | yes | Auto-dispatched with task.create |
| task.started | yes | Auto-started with task.assigned |
| task.blocked | yes | Via approval.reject (auto-block) |
| task.completed | yes | Via approval.accept (auto-complete) |
| task.failed | no | Not implemented in test runtime |
| artifact.created | yes | Via demo trigger |
| artifact.reviewed | yes | Via demo trigger |
| approval.requested | yes | Auto-triggered after artifact.reviewed(approved) |
| approval.resolved | yes | Via approval.accept/reject |
| error.raised | no | Not implemented in test runtime |

## Supported Commands

| Command | Supported | Notes |
|---------|-----------|-------|
| task.create | yes | Auto-dispatches to available worker |
| task.assign | yes | Manual override, auto-starts |
| agent.pause | yes | — |
| agent.resume | yes | — |
| approval.accept | yes | Auto-completes task |
| approval.reject | yes | Auto-blocks task |
| artifact.open | yes | Local-only, no side effect |

## Unsupported Capabilities

| Capability | Reason |
|-----------|--------|
| WebSocket transport | SSE only (by design) |
| task.failed event | No failure simulation in test runtime |
| error.raised event | No error simulation in test runtime |
| Event log trimming | Full history retained (test runtime) |
| Authentication | Local dev only (no tokens) |
| Persistent storage | In-memory, reset on restart |
| Multi-runtime | Single runtime only |
| Hard orchestration | Not applicable |
