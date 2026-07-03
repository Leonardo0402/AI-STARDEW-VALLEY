/**
 * Agent Office Protocol — 纯类型定义，零依赖。
 * 所有其他包依赖此包，此包不依赖任何其他包。
 */

// ─── 基础类型 ────────────────────────────────────────────────

export type Id = string;

export type AgentStatus =
  | "offline"
  | "idle"
  | "planning"
  | "working"
  | "waiting"
  | "reviewing"
  | "blocked"
  | "paused"
  | "failed";

export type TaskStatus =
  | "created"
  | "queued"
  | "assigned"
  | "planning"
  | "running"
  | "waiting_approval"
  | "reviewing"
  | "revision_required"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export type ArtifactStatus =
  | "draft"
  | "generated"
  | "under_review"
  | "revision_required"
  | "approved"
  | "rejected"
  | "delivered";

export type ApprovalStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export type AgentRole = "orchestrator" | "worker" | "reviewer";

export type RoomType =
  | "command"
  | "execution"
  | "review"
  | "approval_delivery";

export type Priority = "low" | "normal" | "high" | "urgent";

// ─── Snapshot 结构 ──────────────────────────────────────────

export interface CapabilityGrant {
  grantId: Id;
  principalId: Id;
  capability: string;
  effect: "allow" | "deny" | "require_approval";
  scope: Record<string, string>;
  expiresAt: string | null;
  issuedBy: Id;
  state: "requested" | "active" | "expired" | "revoked" | "denied";
}

export interface AgentSnapshot {
  agentId: Id;
  runtimeId: Id;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  currentTaskId: Id | null;
  currentRoomId: Id | null;
  capabilityGrants: CapabilityGrant[];
  lastEventAt: string;
  blockedReason: string | null;
}

export interface TaskSnapshot {
  taskId: Id;
  runtimeId: Id;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  parentTaskId: Id | null;
  assigneeId: Id | null;
  roomId: Id | null;
  dependencyIds: Id[];
  artifactIds: Id[];
  approvalId: Id | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
}

export interface ArtifactReviewResult {
  reviewerId: Id;
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
  reviewedAt: string;
}

export interface ArtifactSnapshot {
  artifactId: Id;
  runtimeId: Id;
  taskId: Id;
  producerAgentId: Id;
  type: string;
  title: string;
  status: ArtifactStatus;
  uri: string | null;
  version: number;
  createdAt: string;
  reviewResult: ArtifactReviewResult | null;
}

export interface ApprovalSnapshot {
  approvalId: Id;
  runtimeId: Id;
  taskId: Id;
  kind: "artifact_delivery" | "tool_use" | "data_writeback";
  status: ApprovalStatus;
  requestedBy: Id;
  resolvedBy: Id | null;
  payloadRef: string;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
}

export interface RoomBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomSnapshot {
  roomId: Id;
  runtimeId: Id;
  name: string;
  type: RoomType;
  bounds: RoomBounds;
  activeAgentIds: Id[];
  visualState: Record<string, unknown>;
}

export interface ExecutionProfile {
  profileId: Id;
  name: string;
  toolAllowlist: string[];
  toolDenylist: string[];
  permissionScopes: string[];
  contextScopes: string[];
  workspaceRef: string | null;
  tokenBudget: number | null;
  timeBudgetSec: number | null;
  networkPolicy: "none" | "limited" | "full";
  approvalPolicy: "none" | "on_write" | "on_external_effect" | "always";
  inputArtifactTypes: string[];
  outputArtifactTypes: string[];
  maxConcurrency: number;
}

export interface RoomBinding {
  bindingId: Id;
  roomId: Id;
  profileId: Id;
  overrides: Partial<ExecutionProfile>;
}

export interface RuntimeSnapshot {
  runtimeId: Id;
  snapshotId: Id;
  sequence: number;
  schemaVersion: string;
  createdAt: string;
  lastEventId: Id;
  agents: AgentSnapshot[];
  tasks: TaskSnapshot[];
  artifacts: ArtifactSnapshot[];
  approvals: ApprovalSnapshot[];
  rooms: RoomSnapshot[];
}

// ─── DomainEvent ────────────────────────────────────────────

export interface DomainEvent<P = unknown> {
  eventId: Id;
  runtimeId: Id;
  sequence: number;
  schemaVersion: string;
  type: string;
  occurredAt: string;
  receivedAt: string;
  correlationId: Id;
  causationId: Id | null;
  traceId: Id;
  payload: P;
}

// ─── 事件 payload 类型 ──────────────────────────────────────

export interface AgentSpawnedPayload {
  agentId: Id;
  name: string;
  role: AgentRole;
}

export interface AgentStatusChangedPayload {
  agentId: Id;
  oldStatus: AgentStatus;
  newStatus: AgentStatus;
  reason?: string;
}

export interface TaskCreatedPayload {
  taskId: Id;
  title: string;
  description: string;
  priority: Priority;
  parentTaskId: Id | null;
}

export interface TaskAssignedPayload {
  taskId: Id;
  agentId: Id;
  roomId: Id;
}

export interface TaskStartedPayload {
  taskId: Id;
  agentId: Id;
}

export interface TaskBlockedPayload {
  taskId: Id;
  reason: string;
}

export interface TaskCompletedPayload {
  taskId: Id;
}

export interface TaskFailedPayload {
  taskId: Id;
  reason: string;
}

export interface ArtifactCreatedPayload {
  artifactId: Id;
  taskId: Id;
  producerAgentId: Id;
  type: string;
  title: string;
  uri: string | null;
  version: number;
}

export interface ArtifactReviewedPayload {
  artifactId: Id;
  reviewerId: Id;
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
}

export interface ApprovalRequestedPayload {
  approvalId: Id;
  taskId: Id;
  kind: "artifact_delivery" | "tool_use" | "data_writeback";
  requestedBy: Id;
  reason: string;
}

export interface ApprovalResolvedPayload {
  approvalId: Id;
  status: "approved" | "rejected" | "expired";
  resolvedBy: Id | null;
}

export interface ErrorRaisedPayload {
  taskId: Id | null;
  agentId: Id | null;
  message: string;
  severity: "warning" | "error" | "critical";
}

// ─── 事件类型常量 ────────────────────────────────────────────

export const EventType = {
  AGENT_SPAWNED: "agent.spawned",
  AGENT_STATUS_CHANGED: "agent.status_changed",
  TASK_CREATED: "task.created",
  TASK_ASSIGNED: "task.assigned",
  TASK_STARTED: "task.started",
  TASK_BLOCKED: "task.blocked",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  ARTIFACT_CREATED: "artifact.created",
  ARTIFACT_REVIEWED: "artifact.reviewed",
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_RESOLVED: "approval.resolved",
  ERROR_RAISED: "error.raised",
} as const;

export const ALL_EVENT_TYPES: string[] = Object.values(EventType);

// ─── OfficeCommand ──────────────────────────────────────────

export interface OfficeCommand<P = unknown> {
  commandId: Id;
  commandType: string;
  timestamp: string;
  source: "user" | "system";
  actorId: Id;
  runtimeId: Id;
  targetId: Id | null;
  payload: P;
}

export interface TaskCreatePayload {
  title: string;
  description: string;
  priority?: Priority;
  parentTaskId?: Id | null;
}

export interface TaskAssignPayload {
  taskId: Id;
  agentId: Id;
}

export interface AgentPausePayload {
  agentId: Id;
}

export interface AgentResumePayload {
  agentId: Id;
}

export interface ApprovalAcceptPayload {
  approvalId: Id;
}

export interface ApprovalRejectPayload {
  approvalId: Id;
  reason: string;
}

export interface ArtifactOpenPayload {
  artifactId: Id;
}

// ─── 命令类型常量 ────────────────────────────────────────────

export const CommandType = {
  TASK_CREATE: "task.create",
  TASK_ASSIGN: "task.assign",
  AGENT_PAUSE: "agent.pause",
  AGENT_RESUME: "agent.resume",
  APPROVAL_ACCEPT: "approval.accept",
  APPROVAL_REJECT: "approval.reject",
  ARTIFACT_OPEN: "artifact.open",
} as const;

export const ALL_COMMAND_TYPES: string[] = Object.values(CommandType);

// ─── CommandResult ──────────────────────────────────────────

export interface CommandResult {
  commandId: Id;
  status: "accepted" | "rejected" | "error";
  error?: {
    code: string;
    message: string;
  };
  affectedEventIds: Id[];
}

// ─── RuntimeAdapter ─────────────────────────────────────────

export type DomainEventHandler = (event: DomainEvent) => void;
export type Unsubscribe = () => void;

/** 订阅选项。afterSequence 用于请求重放 sequence > afterSequence 的事件。 */
export interface SubscribeOptions {
  afterSequence?: number;
}

// ─── EventApplyResult ───────────────────────────────────────

/**
 * 事件应用到 SnapshotStore 的结构化结果。
 *
 * 调用方不得解析 reason 字符串，必须依据 code 判断。
 *
 * 语义：
 * - applied=true, code="applied"：事件已应用，snapshot 状态可能变更，sequence 推进，事件入 log。
 * - applied=false, code="reducer_rejected"：事件通过 transport 校验（runtime/dedup/sequence），
 *   但 reducer 拒绝了状态转换。**sequence 仍推进、事件仍入 log、dedup 仍标记**，
 *   以保持与 Runtime 的单调一致性；snapshot 状态未变，listeners 仍被通知（以便 UI 展示错误）。
 * - applied=false, 其余 code：事件被完全拒绝，store 状态、sequence、log、dedup 均不变。
 */
export type EventApplyCode =
  | "applied"
  | "duplicate"
  | "runtime_mismatch"
  | "stale_sequence"
  | "sequence_gap"
  | "reducer_rejected";

export interface EventApplyResult {
  applied: boolean;
  code: EventApplyCode;
  reason?: string;
  expectedSequence?: number;
  receivedSequence?: number;
  /** reducer_rejected 时的结构化诊断（所有 reducer errors） */
  reducerErrors?: string[];
}

export interface AdapterCapabilities {
  supportedEvents: string[];
  supportedCommands: string[];
  features: {
    snapshot: boolean;
    sse: boolean;
    websocket: boolean;
    commandExecution: boolean;
    softMapping: boolean;
    hardOrchestration: boolean;
  };
}

export interface RuntimeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): Promise<RuntimeSnapshot>;
  subscribe(
    handler: DomainEventHandler,
    options?: SubscribeOptions
  ): Unsubscribe;
  execute(command: OfficeCommand): Promise<CommandResult>;
  getCapabilities(): AdapterCapabilities;
}

// ─── Office Projection ──────────────────────────────────────

/**
 * OfficeProjection 是从 RuntimeSnapshot 投影出的、UI 消费的视图模型。
 * 它剥离了内部状态，只保留 UI 需要的展示信息。
 */
export interface AgentView {
  agentId: Id;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  currentTaskId: Id | null;
  currentRoomId: Id | null;
  blockedReason: string | null;
}

export interface TaskView {
  taskId: Id;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: Id | null;
  roomId: Id | null;
  artifactIds: Id[];
  approvalId: Id | null;
  blockedReason: string | null;
}

export interface ArtifactView {
  artifactId: Id;
  taskId: Id;
  producerAgentId: Id;
  type: string;
  title: string;
  status: ArtifactStatus;
  version: number;
  reviewResult: ArtifactReviewResult | null;
}

export interface ApprovalView {
  approvalId: Id;
  taskId: Id;
  kind: "artifact_delivery" | "tool_use" | "data_writeback";
  status: ApprovalStatus;
  requestedBy: Id;
  reason: string;
}

export interface RoomView {
  roomId: Id;
  name: string;
  type: RoomType;
  bounds: RoomBounds;
  activeAgentIds: Id[];
}

export interface OfficeProjection {
  agents: AgentView[];
  tasks: TaskView[];
  artifacts: ArtifactView[];
  approvals: ApprovalView[];
  rooms: RoomView[];
  pendingApprovals: ApprovalView[];
  blockedTasks: TaskView[];
  errors: { taskId: Id | null; agentId: Id | null; message: string; severity: string }[];
}
