/**
 * Event Reducer — 纯函数，将 DomainEvent 应用到 RuntimeSnapshot。
 *
 * 核心规则：
 * - 不直接修改输入 snapshot，返回新 snapshot
 * - 非法状态转换不抛异常，写入 InvalidTransitionRejected 并保持原状态
 * - 返回 { snapshot, errors } 以便上层处理
 */
import type {
  RuntimeSnapshot,
  DomainEvent,
  AgentSnapshot,
  TaskSnapshot,
  ArtifactSnapshot,
  ApprovalSnapshot,
  RoomSnapshot,
  AgentStatusChangedPayload,
  TaskCreatedPayload,
  TaskAssignedPayload,
  TaskStartedPayload,
  TaskBlockedPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
  ArtifactCreatedPayload,
  ArtifactReviewedPayload,
  ApprovalRequestedPayload,
  ApprovalResolvedPayload,
  ErrorRaisedPayload,
  AgentSpawnedPayload,
} from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";
import {
  isValidAgentTransition,
  isValidTaskTransition,
  isValidArtifactTransition,
  isValidApprovalTransition,
} from "./state-machine.js";

export interface ReducerResult {
  snapshot: RuntimeSnapshot;
  /** 非法转换等错误信息，不中断处理 */
  errors: string[];
}

export function createEmptySnapshot(runtimeId: string): RuntimeSnapshot {
  return {
    runtimeId,
    snapshotId: `snap-${Date.now()}`,
    sequence: 0,
    schemaVersion: "1.0",
    createdAt: new Date().toISOString(),
    lastEventId: "",
    agents: [],
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [],
  };
}

export function reduceEvent(
  snapshot: RuntimeSnapshot,
  event: DomainEvent
): ReducerResult {
  const errors: string[] = [];
  // 深拷贝以保持不可变性
  let s: RuntimeSnapshot = structuredClone(snapshot);

  switch (event.type) {
    case EventType.AGENT_SPAWNED: {
      const p = event.payload as AgentSpawnedPayload;
      const existing = s.agents.find((a) => a.agentId === p.agentId);
      if (existing) {
        errors.push(`Agent ${p.agentId} already exists`);
        break;
      }
      const agent: AgentSnapshot = {
        agentId: p.agentId,
        runtimeId: s.runtimeId,
        name: p.name,
        role: p.role,
        status: "idle",
        currentTaskId: null,
        currentRoomId: null,
        capabilityGrants: [],
        lastEventAt: event.occurredAt,
        blockedReason: null,
      };
      s.agents.push(agent);
      break;
    }

    case EventType.AGENT_STATUS_CHANGED: {
      const p = event.payload as AgentStatusChangedPayload;
      const agent = s.agents.find((a) => a.agentId === p.agentId);
      if (!agent) {
        errors.push(`Agent ${p.agentId} not found for status change`);
        break;
      }
      if (!isValidAgentTransition(agent.status, p.newStatus)) {
        errors.push(
          `Invalid agent transition: ${agent.status} → ${p.newStatus} for ${p.agentId}`
        );
        break;
      }
      agent.status = p.newStatus;
      agent.lastEventAt = event.occurredAt;
      if (p.newStatus === "blocked" && p.reason) {
        agent.blockedReason = p.reason;
      } else if (p.newStatus !== "blocked") {
        agent.blockedReason = null;
      }
      break;
    }

    case EventType.TASK_CREATED: {
      const p = event.payload as TaskCreatedPayload;
      const task: TaskSnapshot = {
        taskId: p.taskId,
        runtimeId: s.runtimeId,
        title: p.title,
        description: p.description,
        status: "created",
        priority: p.priority,
        parentTaskId: p.parentTaskId ?? null,
        assigneeId: null,
        roomId: null,
        dependencyIds: [],
        artifactIds: [],
        approvalId: null,
        createdAt: event.occurredAt,
        startedAt: null,
        completedAt: null,
        blockedReason: null,
      };
      s.tasks.push(task);
      break;
    }

    case EventType.TASK_ASSIGNED: {
      const p = event.payload as TaskAssignedPayload;
      const task = s.tasks.find((t) => t.taskId === p.taskId);
      if (!task) {
        errors.push(`Task ${p.taskId} not found for assignment`);
        break;
      }
      if (!isValidTaskTransition(task.status, "assigned")) {
        errors.push(`Invalid task transition: ${task.status} → assigned for ${p.taskId}`);
        break;
      }
      task.status = "assigned";
      task.assigneeId = p.agentId;
      task.roomId = p.roomId;
      // 更新 Agent 的 currentTaskId 和 currentRoomId
      const agent = s.agents.find((a) => a.agentId === p.agentId);
      if (agent) {
        agent.currentTaskId = p.taskId;
        agent.currentRoomId = p.roomId;
      }
      // 更新 Room activeAgentIds
      const room = s.rooms.find((r) => r.roomId === p.roomId);
      if (room && !room.activeAgentIds.includes(p.agentId)) {
        room.activeAgentIds.push(p.agentId);
      }
      break;
    }

    case EventType.TASK_STARTED: {
      const p = event.payload as TaskStartedPayload;
      const task = s.tasks.find((t) => t.taskId === p.taskId);
      if (!task) {
        errors.push(`Task ${p.taskId} not found for start`);
        break;
      }
      if (!isValidTaskTransition(task.status, "running")) {
        errors.push(`Invalid task transition: ${task.status} → running for ${p.taskId}`);
        break;
      }
      task.status = "running";
      task.startedAt = event.occurredAt;
      const agent = s.agents.find((a) => a.agentId === p.agentId);
      if (agent) {
        agent.currentTaskId = p.taskId;
        agent.lastEventAt = event.occurredAt;
      }
      break;
    }

    case EventType.TASK_BLOCKED: {
      const p = event.payload as TaskBlockedPayload;
      const task = s.tasks.find((t) => t.taskId === p.taskId);
      if (!task) {
        errors.push(`Task ${p.taskId} not found for block`);
        break;
      }
      if (!isValidTaskTransition(task.status, "blocked")) {
        errors.push(`Invalid task transition: ${task.status} → blocked for ${p.taskId}`);
        break;
      }
      task.status = "blocked";
      task.blockedReason = p.reason;
      break;
    }

    case EventType.TASK_COMPLETED: {
      const p = event.payload as TaskCompletedPayload;
      const task = s.tasks.find((t) => t.taskId === p.taskId);
      if (!task) {
        errors.push(`Task ${p.taskId} not found for completion`);
        break;
      }
      // 审批未通过时不能完成
      if (task.approvalId) {
        const approval = s.approvals.find((a) => a.approvalId === task.approvalId);
        if (approval && approval.status !== "approved") {
          errors.push(
            `Task ${p.taskId} cannot complete: approval ${task.approvalId} is ${approval.status}`
          );
          break;
        }
      }
      if (!isValidTaskTransition(task.status, "completed")) {
        errors.push(`Invalid task transition: ${task.status} → completed for ${p.taskId}`);
        break;
      }
      task.status = "completed";
      task.completedAt = event.occurredAt;
      // Agent 回到 idle
      if (task.assigneeId) {
        const agent = s.agents.find((a) => a.agentId === task.assigneeId);
        if (agent) {
          agent.currentTaskId = null;
          agent.lastEventAt = event.occurredAt;
        }
      }
      break;
    }

    case EventType.TASK_FAILED: {
      const p = event.payload as TaskFailedPayload;
      const task = s.tasks.find((t) => t.taskId === p.taskId);
      if (!task) {
        errors.push(`Task ${p.taskId} not found for failure`);
        break;
      }
      if (!isValidTaskTransition(task.status, "failed")) {
        errors.push(`Invalid task transition: ${task.status} → failed for ${p.taskId}`);
        break;
      }
      task.status = "failed";
      task.blockedReason = p.reason;
      break;
    }

    case EventType.ARTIFACT_CREATED: {
      const p = event.payload as ArtifactCreatedPayload;
      const artifact: ArtifactSnapshot = {
        artifactId: p.artifactId,
        runtimeId: s.runtimeId,
        taskId: p.taskId,
        producerAgentId: p.producerAgentId,
        type: p.type,
        title: p.title,
        status: "generated",
        uri: p.uri,
        version: p.version,
        createdAt: event.occurredAt,
        reviewResult: null,
      };
      s.artifacts.push(artifact);
      // 关联到 Task
      const task = s.tasks.find((t) => t.taskId === p.taskId);
      if (task && !task.artifactIds.includes(p.artifactId)) {
        task.artifactIds.push(p.artifactId);
      }
      break;
    }

    case EventType.ARTIFACT_REVIEWED: {
      const p = event.payload as ArtifactReviewedPayload;
      const artifact = s.artifacts.find((a) => a.artifactId === p.artifactId);
      if (!artifact) {
        errors.push(`Artifact ${p.artifactId} not found for review`);
        break;
      }
      const newStatus =
        p.verdict === "approved"
          ? "approved"
          : p.verdict === "revision_required"
            ? "revision_required"
            : "rejected";
      if (!isValidArtifactTransition(artifact.status, newStatus)) {
        errors.push(
          `Invalid artifact transition: ${artifact.status} → ${newStatus} for ${p.artifactId}`
        );
        break;
      }
      artifact.status = newStatus;
      artifact.reviewResult = {
        reviewerId: p.reviewerId,
        verdict: p.verdict,
        comment: p.comment,
        reviewedAt: event.occurredAt,
      };
      break;
    }

    case EventType.APPROVAL_REQUESTED: {
      const p = event.payload as ApprovalRequestedPayload;
      const approval: ApprovalSnapshot = {
        approvalId: p.approvalId,
        runtimeId: s.runtimeId,
        taskId: p.taskId,
        kind: p.kind,
        status: "requested",
        requestedBy: p.requestedBy,
        resolvedBy: null,
        payloadRef: "",
        reason: p.reason,
        createdAt: event.occurredAt,
        resolvedAt: null,
        expiresAt: null,
      };
      s.approvals.push(approval);
      // 关联到 Task
      const task = s.tasks.find((t) => t.taskId === p.taskId);
      if (task) {
        task.approvalId = p.approvalId;
        if (isValidTaskTransition(task.status, "waiting_approval")) {
          task.status = "waiting_approval";
        } else {
          errors.push(
            `Invalid task transition: ${task.status} → waiting_approval for ${p.taskId} (approval ${p.approvalId} created but task state unchanged)`
          );
        }
      }
      break;
    }

    case EventType.APPROVAL_RESOLVED: {
      const p = event.payload as ApprovalResolvedPayload;
      const approval = s.approvals.find((a) => a.approvalId === p.approvalId);
      if (!approval) {
        errors.push(`Approval ${p.approvalId} not found for resolution`);
        break;
      }
      if (!isValidApprovalTransition(approval.status, p.status)) {
        errors.push(
          `Invalid approval transition: ${approval.status} → ${p.status} for ${p.approvalId}`
        );
        break;
      }
      approval.status = p.status;
      approval.resolvedBy = p.resolvedBy ?? null;
      approval.resolvedAt = event.occurredAt;

      // 审批被拒绝时，任务进入 revision_required
      if (p.status === "rejected") {
        const task = s.tasks.find((t) => t.taskId === approval.taskId);
        if (task) {
          if (isValidTaskTransition(task.status, "revision_required")) {
            task.status = "revision_required";
          } else {
            errors.push(
              `Invalid task transition: ${task.status} → revision_required for ${task.taskId} (approval ${p.approvalId} rejected but task state unchanged)`
            );
          }
        }
      }
      break;
    }

    case EventType.ERROR_RAISED: {
      // error.raised 不改变 Snapshot 状态，仅记录
      // 实际的错误状态变化由 agent.status_changed 或 task.blocked 体现
      const p = event.payload as ErrorRaisedPayload;
      if (p.agentId) {
        const agent = s.agents.find((a) => a.agentId === p.agentId);
        if (agent) {
          agent.lastEventAt = event.occurredAt;
        }
      }
      break;
    }

    default:
      errors.push(`Unknown event type: ${event.type}`);
  }

  s.lastEventId = event.eventId;
  s.sequence = event.sequence;
  return { snapshot: s, errors };
}

/**
 * 从空 snapshot 开始重放所有事件，返回最终 snapshot。
 * 用于 replay 测试和断线恢复。
 */
export function replayEvents(
  events: DomainEvent[],
  runtimeId: string
): ReducerResult {
  let snapshot = createEmptySnapshot(runtimeId);
  const allErrors: string[] = [];

  for (const event of events) {
    const result = reduceEvent(snapshot, event);
    snapshot = result.snapshot;
    allErrors.push(...result.errors);
  }

  return { snapshot, errors: allErrors };
}
