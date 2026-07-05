import type { DomainEvent } from "@agent-office/protocol";

export function taskAssigned(
  sequence: number,
  taskId: string,
  agentId: string,
  roomId: string
): DomainEvent {
  return {
    eventId: `evt-task-assigned-${sequence}`,
    runtimeId: "runtime-1",
    sequence,
    schemaVersion: "1.0",
    type: "task.assigned",
    occurredAt: "2026-07-05T08:00:00Z",
    receivedAt: "2026-07-05T08:00:00Z",
    correlationId: "corr-1",
    causationId: null,
    traceId: "trace-1",
    payload: { taskId, agentId, roomId },
  };
}

export function taskCompleted(sequence: number, taskId: string): DomainEvent {
  return {
    eventId: `evt-task-completed-${sequence}`,
    runtimeId: "runtime-1",
    sequence,
    schemaVersion: "1.0",
    type: "task.completed",
    occurredAt: "2026-07-05T08:00:00Z",
    receivedAt: "2026-07-05T08:00:00Z",
    correlationId: "corr-1",
    causationId: null,
    traceId: "trace-1",
    payload: { taskId },
  };
}
