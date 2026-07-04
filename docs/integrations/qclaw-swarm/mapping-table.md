# QClaw/Swarm → Agent Office Mapping Table

## Entity Mapping

| QClaw Test Runtime Concept | Agent Office Protocol Type | Mapping Notes |
|---------------------------|---------------------------|---------------|
| Runtime | `RuntimeSnapshot` | Fixed `runtimeId: "qclaw-swarm-runtime-001"` |
| Agent | `AgentSnapshot` | 4 agents: orchestrator + 2 workers + reviewer |
| Task | `TaskSnapshot` | Auto-dispatched on creation |
| Artifact | `ArtifactSnapshot` | Produced by worker, reviewed by reviewer |
| Approval | `ApprovalSnapshot` | Gates task completion |
| Room | `RoomSnapshot` | 4 rooms: command, execution, review, delivery |

## Event Mapping

All QClaw test runtime events are already generic `DomainEvent`s. The
mapping documents the **trigger semantics**:

| Trigger | Emitted Events | Notes |
|---------|---------------|-------|
| `task.create` command | `task.created` + `task.assigned` + `task.started` | Auto-dispatch to available worker |
| `agent.pause` command | `agent.status_changed(paused)` | — |
| `agent.resume` command | `agent.status_changed(idle\|working)` | Restores pre-pause status |
| `approval.accept` command | `approval.resolved(approved)` + `task.completed` | Auto-complete on approval |
| `approval.reject` command | `approval.resolved(rejected)` + `task.blocked` | Auto-block on rejection |
| Internal: artifact reviewed (approved) | `artifact.reviewed` + `approval.requested` | Auto-request approval |
| Internal: artifact reviewed (revision) | `artifact.reviewed` + `task.assigned` (rework) | Auto-rework loop |

## Command Mapping

| Agent Office Command | QClaw Test Runtime Behavior |
|---------------------|----------------------------|
| `task.create` | Creates task, auto-assigns to available worker, auto-starts |
| `task.assign` | Assigns to specified agent (manual override) |
| `agent.pause` | Pauses agent |
| `agent.resume` | Resumes agent |
| `approval.accept` | Resolves approval, auto-completes task |
| `approval.reject` | Resolves approval, auto-blocks task |
| `artifact.open` | Local-only, no runtime side effect (returns accepted) |

## Capability Mapping

| Feature | Supported | Notes |
|---------|-----------|-------|
| snapshot | yes | GET /runtime/snapshot |
| sse | yes | GET /runtime/events with replay-complete |
| websocket | no | SSE only |
| commandExecution | yes | POST /runtime/commands |
| softMapping | yes | QClaw semantics mapped to generic events |
| hardOrchestration | no | Single runtime, no multi-runtime orchestration |
