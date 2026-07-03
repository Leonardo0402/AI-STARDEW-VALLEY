/**
 * 状态机校验 — 定义合法状态转换。
 * 不依赖任何 UI 或 Runtime 实现。
 */
import type {
  AgentStatus,
  TaskStatus,
  ArtifactStatus,
  ApprovalStatus,
} from "@agent-office/protocol";

const agentTransitions: Record<AgentStatus, AgentStatus[]> = {
  offline: ["idle", "paused"],
  idle: ["planning", "working", "reviewing", "waiting", "blocked", "failed", "paused"],
  planning: ["working", "idle", "paused", "blocked"],
  working: ["idle", "waiting", "reviewing", "blocked", "failed", "paused"],
  waiting: ["idle", "working", "reviewing", "paused"],
  reviewing: ["idle", "working", "blocked", "paused"],
  blocked: ["idle", "working", "failed", "paused"],
  paused: ["idle", "working", "reviewing", "blocked", "offline"],
  failed: ["idle", "offline", "paused"],
};

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
  created: ["queued", "assigned", "cancelled"],
  queued: ["assigned", "cancelled"],
  assigned: ["planning", "running", "cancelled"],
  planning: ["running", "blocked", "cancelled"],
  running: ["reviewing", "waiting_approval", "blocked", "failed", "completed", "cancelled", "assigned", "revision_required"],
  blocked: ["running", "failed", "cancelled"],
  waiting_approval: ["reviewing", "completed", "cancelled", "revision_required"],
  reviewing: ["revision_required", "completed", "cancelled"],
  revision_required: ["running", "assigned", "cancelled", "blocked"],
  completed: [],
  failed: ["running", "assigned", "cancelled"],
  cancelled: [],
};

const artifactTransitions: Record<ArtifactStatus, ArtifactStatus[]> = {
  draft: ["generated"],
  generated: ["under_review", "approved", "revision_required", "rejected"],
  under_review: ["approved", "revision_required", "rejected"],
  revision_required: ["generated"],
  approved: ["delivered"],
  rejected: [],
  delivered: [],
};

const approvalTransitions: Record<ApprovalStatus, ApprovalStatus[]> = {
  requested: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export function isValidAgentTransition(from: AgentStatus, to: AgentStatus): boolean {
  if (from === to) return true;
  return agentTransitions[from]?.includes(to) ?? false;
}

export function isValidTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return taskTransitions[from]?.includes(to) ?? false;
}

export function isValidArtifactTransition(from: ArtifactStatus, to: ArtifactStatus): boolean {
  if (from === to) return true;
  return artifactTransitions[from]?.includes(to) ?? false;
}

export function isValidApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  if (from === to) return true;
  return approvalTransitions[from]?.includes(to) ?? false;
}
