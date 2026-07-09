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

export interface ArtifactDraftedPayload {
  artifactId: Id;
  taskId: Id;
  producerAgentId: Id | null;   // GitHub 无 office agent，用 null + evidence
  type: string;                  // "github_pr"
  title: string;
  uri: string | null;            // PR url
  version: number;
}

export interface ArtifactReviewRequestedPayload {
  artifactId: Id;
  reviewerIds: Id[];             // GitHub login 列表（external actor refs）
}

export interface ArtifactDeliveredPayload {
  artifactId: Id;
  mergeCommitSha: string | null;
  mergedBy: Id;                   // GitHub login（external actor ref）
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
  ARTIFACT_DRAFTED: "artifact.drafted",
  ARTIFACT_REVIEW_REQUESTED: "artifact.review_requested",
  ARTIFACT_REVIEWED: "artifact.reviewed",
  ARTIFACT_DELIVERED: "artifact.delivered",
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

/**
 * @deprecated Plan 1 introduced `RuntimeStreamObserver` and
 * `RuntimeSubscription` as the canonical event-delivery API.
 * `DomainEventHandler` is retained only for backwards compatibility
 * and should not be used in new code.
 */
export type DomainEventHandler = (event: DomainEvent) => void;

/**
 * @deprecated Use `RuntimeSubscription.close()` instead.
 * `Unsubscribe` is retained only for backwards compatibility.
 */
export type Unsubscribe = () => void;

/** 订阅选项。afterSequence 用于请求重放 sequence > afterSequence 的事件。 */
export interface SubscribeOptions {
  afterSequence?: number;
}

// ─── Async Subscription Lifecycle (Issue #6) ───────────────

/**
 * 流订阅状态机。
 *
 * 注意：没有 "reconnecting" 状态 — RuntimeSession 拥有重连/resync 职责，
 * adapter 只负责一次 Stream 建立和一次 Stream 生命周期。
 * Session 通过 resynchronizing / degraded 状态表达重连。
 *
 * - opening: subscribe 已返回，流尚未 ready（正在建立连接 / 重放）
 * - ready: 流已开放，重放完成，正在投递实时事件
 * - reset_required: 重放历史已修剪，需要重新拉取 checkpoint
 * - error: 流错误（可恢复或致命）
 * - closed: 订阅已关闭（终态）
 */
export type RuntimeStreamState =
  | "opening"
  | "ready"
  | "reset_required"
  | "error"
  | "closed";

/**
 * 远程传输错误分类（Issue #6 P1 错误模型）。
 *
 * - aborted: close 发生在 ready 之前（订阅被取消）
 * - 其他 code: HTTP/SSE 传输层错误（Plan 2 使用）
 */
export type RuntimeErrorCode =
  | "http_error"
  | "authentication_failed"
  | "snapshot_invalid"
  | "capabilities_invalid"
  | "stream_open_failed"
  | "stream_protocol_error"
  | "event_invalid"
  | "event_log_trimmed"
  | "command_rejected"
  | "command_response_invalid"
  | "aborted";

/**
 * 结构化流错误。
 *
 * recoverable=true 时 session 可尝试 resync；false 时为致命错误。
 * status: HTTP status code（仅 HTTP/SSE adapter 使用）。
 */
export interface RuntimeStreamError {
  code: RuntimeErrorCode;
  message: string;
  recoverable: boolean;
  status?: number;
}

/**
 * 流观察者。onEvent 必需；onState/onError 可选。
 *
 * 调用顺序契约见 docs/protocol/runtime-contract.md §4.1.1。
 * 简要：
 *   - ready 之前失败：只 reject ready，不调用 onError。
 *   - ready 成功：replay → onState("ready") → ready.resolve()。
 *   - ready 之后失败：onError(error) → onState("error" | "reset_required")。
 *   - close 之前 ready 未 resolve：ready.reject({ code: "aborted" })。
 */
export interface RuntimeStreamObserver {
  onEvent(event: DomainEvent): void;
  onState?(state: RuntimeStreamState): void;
  onError?(error: RuntimeStreamError): void;
}

/**
 * 异步订阅句柄。
 *
 * ready: 流已开放且游标重放完成时 resolve；流建立失败或 close-before-ready 时 reject。
 * close: 关闭流，幂等。同步 adapter 返回 void；HTTP/SSE adapter 返回 Promise<void>（abort fetch）。
 *
 * 协议：subscribe() 返回 RuntimeSubscription 之前不得同步调用 observer。
 * Replay 必须至少延迟到一个 microtask 中执行，让调用方先保存 subscription 引用。
 */
export interface RuntimeSubscription {
  ready: Promise<void>;
  close(): Promise<void> | void;
}

// ─── Reconnect Policy (Issue #6 Plan 2) ─────────────────────

/**
 * Reconnect 退避策略。RuntimeSession 在 post-ready recoverable 错误时使用。
 *
 * - initialDelayMs: 首次重连等待时间（默认 500ms）
 * - maxDelayMs: 单次重连最大等待时间（默认 30000ms）
 * - maxAttempts: 最大重连次数（默认 10）；超过后转 failed
 * - jitterRatio: 抖动比例（默认 0.2，即 ±20%）
 *
 * 退避公式：delay = min(maxDelayMs, initialDelayMs * 2^attempt) * (1 ± jitterRatio)
 */
export interface ReconnectPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  jitterRatio: number;
}

export const defaultReconnectPolicy: ReconnectPolicy = {
  initialDelayMs: 500,
  maxDelayMs: 30000,
  maxAttempts: 10,
  jitterRatio: 0.2,
};

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

/**
 * Reducer 错误分类（Issue #4 结构化 diagnostics）。
 *
 * 调用方依据 code 判断错误类别，message 仅用于展示。
 */
export type ReducerErrorCode =
  | "entity_not_found" // entity 不存在（agent/task/artifact/approval not found）
  | "invalid_transition" // 状态机转换不允许（含 cascade failures）
  | "constraint_violation" // 业务规则违反（已存在、审批未通过等）
  | "validation_error"; // 未知事件类型或校验失败

export interface ReducerError {
  code: ReducerErrorCode;
  message: string;
  /** Entity path，格式 "entityType:entityId"，例如 "tasks:t-1" */
  entityPath?: string;
}

export interface EventApplyResult {
  applied: boolean;
  code: EventApplyCode;
  reason?: string;
  expectedSequence?: number;
  receivedSequence?: number;
  /** reducer_rejected 时的结构化诊断（所有 reducer errors） */
  reducerErrors?: ReducerError[];
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
    observer: RuntimeStreamObserver,
    options?: SubscribeOptions
  ): RuntimeSubscription;
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
  /** Real content payload when already loaded by the UI/preview layer. */
  content?: string | null;
  /** External URI when the artifact content is addressable; `null` means unavailable. */
  uri?: string | null;
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
