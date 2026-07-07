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

export function taskCreated(sequence: number, taskId: string): DomainEvent {
  return {
    eventId: `evt-task-created-${sequence}`,
    runtimeId: "runtime-1",
    sequence,
    schemaVersion: "1.0",
    type: "task.created",
    occurredAt: "2026-07-05T08:00:00Z",
    receivedAt: "2026-07-05T08:00:00Z",
    correlationId: "corr-1",
    causationId: null,
    traceId: "trace-1",
    payload: { taskId, title: "Test task", description: "", priority: "normal", parentTaskId: null },
  };
}

export function artifactCreated(
  sequence: number,
  artifactId: string,
  taskId: string,
  producerAgentId: string,
  title: string
): DomainEvent {
  return {
    eventId: `evt-artifact-created-${sequence}`,
    runtimeId: "runtime-1",
    sequence,
    schemaVersion: "1.0",
    type: "artifact.created",
    occurredAt: "2026-07-05T08:00:00Z",
    receivedAt: "2026-07-05T08:00:00Z",
    correlationId: "corr-1",
    causationId: null,
    traceId: "trace-1",
    payload: { artifactId, taskId, producerAgentId, type: "deliverable", title, uri: null, version: 1 },
  };
}

export function approvalRequested(
  sequence: number,
  approvalId: string,
  taskId: string,
  requestedBy: string,
  reason: string
): DomainEvent {
  return {
    eventId: `evt-approval-requested-${sequence}`,
    runtimeId: "runtime-1",
    sequence,
    schemaVersion: "1.0",
    type: "approval.requested",
    occurredAt: "2026-07-05T08:00:00Z",
    receivedAt: "2026-07-05T08:00:00Z",
    correlationId: "corr-1",
    causationId: null,
    traceId: "trace-1",
    payload: { approvalId, taskId, kind: "artifact_delivery", requestedBy, reason },
  };
}

export function approvalResolved(
  sequence: number,
  approvalId: string,
  taskId: string,
  status: "approved" | "rejected" | "expired",
  resolvedBy: string
): DomainEvent {
  return {
    eventId: `evt-approval-resolved-${sequence}`,
    runtimeId: "runtime-1",
    sequence,
    schemaVersion: "1.0",
    type: "approval.resolved",
    occurredAt: "2026-07-05T08:00:00Z",
    receivedAt: "2026-07-05T08:00:00Z",
    correlationId: "corr-1",
    causationId: null,
    traceId: "trace-1",
    payload: { approvalId, taskId, status, resolvedBy },
  };
}
