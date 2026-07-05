import type { AgentView, OfficeProjection } from "@agent-office/protocol";

export type AgentPresentationState = "idle" | "working" | "blocked" | "walk" | "approval";

export function computeAgentPresentationState(
  agent: AgentView,
  projection: OfficeProjection
): AgentPresentationState {
  // 阻塞状态优先
  if (
    agent.blockedReason ||
    agent.status === "blocked" ||
    agent.status === "failed" ||
    agent.status === "paused"
  ) {
    return "blocked";
  }

  // 审批展示状态：全局存在待审批、位于审批/复核房间、且处于等待/复核或任务待审批
  if (projection.pendingApprovals.length > 0) {
    const roomId = agent.currentRoomId;
    if (roomId === "review" || roomId === "approval_delivery") {
      const isWaitingOrReviewing = agent.status === "waiting" || agent.status === "reviewing";
      const task = agent.currentTaskId
        ? projection.tasks.find((t) => t.taskId === agent.currentTaskId)
        : undefined;
      const isTaskAwaitingApproval =
        !!task &&
        (task.status === "waiting_approval" ||
          projection.pendingApprovals.some((a) => a.taskId === task.taskId));
      if (isWaitingOrReviewing || isTaskAwaitingApproval) {
        return "approval";
      }
    }
  }

  // 工作状态
  if (agent.status === "working" || agent.status === "planning") {
    return "working";
  }
  if (agent.currentTaskId) {
    const task = projection.tasks.find((t) => t.taskId === agent.currentTaskId);
    if (task && task.status === "running") {
      return "working";
    }
  }

  return "idle";
}
