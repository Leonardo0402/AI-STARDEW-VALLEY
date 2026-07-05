/**
 * Office Projection — 从 RuntimeSnapshot 投影出 UI 消费的视图模型。
 *
 * 核心规则：
 * - 投影是只读的，UI 不能通过投影修改 Runtime 状态
 * - 投影剥离内部字段，只保留 UI 需要的信息
 * - UI 只消费 OfficeProjection，不直接访问 RuntimeSnapshot
 */
import type {
  RuntimeSnapshot,
  OfficeProjection,
  AgentView,
  TaskView,
  ArtifactView,
  ApprovalView,
  RoomView,
} from "@agent-office/protocol";

export function projectSnapshot(
  snapshot: RuntimeSnapshot,
  errors: OfficeProjection["errors"] = []
): OfficeProjection {
  const agents: AgentView[] = snapshot.agents.map((a) => ({
    agentId: a.agentId,
    name: a.name,
    role: a.role,
    status: a.status,
    currentTaskId: a.currentTaskId,
    currentRoomId: a.currentRoomId,
    blockedReason: a.blockedReason,
  }));

  const tasks: TaskView[] = snapshot.tasks.map((t) => ({
    taskId: t.taskId,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId,
    roomId: t.roomId,
    artifactIds: [...t.artifactIds],
    approvalId: t.approvalId,
    blockedReason: t.blockedReason,
  }));

  const artifacts: ArtifactView[] = snapshot.artifacts.map((a) => ({
    artifactId: a.artifactId,
    taskId: a.taskId,
    producerAgentId: a.producerAgentId,
    type: a.type,
    title: a.title,
    status: a.status,
    version: a.version,
    reviewResult: a.reviewResult ? { ...a.reviewResult } : null,
    uri: a.uri,
  }));

  const approvals: ApprovalView[] = snapshot.approvals.map((a) => ({
    approvalId: a.approvalId,
    taskId: a.taskId,
    kind: a.kind,
    status: a.status,
    requestedBy: a.requestedBy,
    reason: a.reason,
  }));

  const rooms: RoomView[] = snapshot.rooms.map((r) => ({
    roomId: r.roomId,
    name: r.name,
    type: r.type,
    bounds: { ...r.bounds },
    activeAgentIds: [...r.activeAgentIds],
  }));

  const pendingApprovals = approvals.filter((a) => a.status === "requested");
  const blockedTasks = tasks.filter(
    (t) => t.status === "blocked" || t.status === "failed"
  );

  return {
    agents,
    tasks,
    artifacts,
    approvals,
    rooms,
    pendingApprovals,
    blockedTasks,
    errors,
  };
}
