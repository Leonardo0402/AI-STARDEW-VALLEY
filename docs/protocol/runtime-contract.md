# Agent Office Runtime Contract

> 本文档定义 Agent Office 与 Runtime Adapter 之间的协议契约。
>
> 所有 Runtime Adapter（包括 MockRuntimeAdapter）必须实现此契约。
>
> 与项目指导文档 `AGENT-GPT.md` 冲突时，以本文档为准。

---

## 1. 核心数据结构

### 1.1 RuntimeSnapshot

```ts
interface RuntimeSnapshot {
  runtimeId: string;
  snapshotId: string;
  sequence: number;
  schemaVersion: string;          // "1.0"
  createdAt: string;              // ISO 8601
  lastEventId: string;
  agents: AgentSnapshot[];
  tasks: TaskSnapshot[];
  artifacts: ArtifactSnapshot[];
  approvals: ApprovalSnapshot[];
  rooms: RoomSnapshot[];
}
```

### 1.2 AgentSnapshot

```ts
interface AgentSnapshot {
  agentId: string;
  runtimeId: string;
  name: string;
  role: "orchestrator" | "worker" | "reviewer";
  status: AgentStatus;
  currentTaskId: string | null;
  currentRoomId: string | null;
  capabilityGrants: CapabilityGrant[];
  lastEventAt: string;            // ISO 8601
  blockedReason: string | null;
}

type AgentStatus =
  | "offline"
  | "idle"
  | "planning"
  | "working"
  | "waiting"
  | "reviewing"
  | "blocked"
  | "paused"
  | "failed";
```

### 1.3 TaskSnapshot

```ts
interface TaskSnapshot {
  taskId: string;
  runtimeId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high" | "urgent";
  parentTaskId: string | null;
  assigneeId: string | null;
  roomId: string | null;
  dependencyIds: string[];
  artifactIds: string[];
  approvalId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
}

type TaskStatus =
  | "created"
  | "queued"
  | "assigned"
  | "planning"
  | "running"
  | "waiting_approval"
  | "reviewing"
  | "revision_required"
  | "completed"
  | "failed"
  | "cancelled";
```

### 1.4 ArtifactSnapshot

```ts
interface ArtifactSnapshot {
  artifactId: string;
  runtimeId: string;
  taskId: string;
  producerAgentId: string;
  type: string;                   // e.g. "report", "code_patch", "review_comment"
  title: string;
  status: ArtifactStatus;
  uri: string | null;             // 内容引用
  version: number;
  createdAt: string;
  reviewResult: {
    reviewerId: string;
    verdict: "approved" | "revision_required" | "rejected";
    comment: string;
    reviewedAt: string;
  } | null;
}

type ArtifactStatus =
  | "draft"
  | "generated"
  | "under_review"
  | "revision_required"
  | "approved"
  | "rejected"
  | "delivered";
```

### 1.5 ApprovalSnapshot

```ts
interface ApprovalSnapshot {
  approvalId: string;
  runtimeId: string;
  taskId: string;
  kind: "artifact_delivery" | "tool_use" | "data_writeback";
  status: "requested" | "approved" | "rejected" | "expired" | "cancelled";
  requestedBy: string;            // agentId
  resolvedBy: string | null;      // userId
  payloadRef: string;             // 审批内容引用
  reason: string;                 // 审批原因
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
}
```

### 1.6 RoomSnapshot

> 注意：Room 是视觉容器，不包含工具、权限、预算等执行策略。执行策略见 ExecutionProfile。

```ts
interface RoomSnapshot {
  roomId: string;
  runtimeId: string;
  name: string;
  type: "command" | "execution" | "review" | "approval_delivery";
  bounds: { x: number; y: number; width: number; height: number };
  activeAgentIds: string[];
  visualState: Record<string, unknown>;
}
```

### 1.7 ExecutionProfile

> 执行策略与 Room 分离。Room 是视觉容器，ExecutionProfile 是执行约束。

```ts
interface ExecutionProfile {
  profileId: string;
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
```

### 1.8 RoomBinding

> RoomBinding 将 Room 与 ExecutionProfile 绑定，并允许局部覆盖。

```ts
interface RoomBinding {
  bindingId: string;
  roomId: string;
  profileId: string;
  overrides: Partial<ExecutionProfile>;
}
```

### 1.9 CapabilityGrant

```ts
interface CapabilityGrant {
  grantId: string;
  principalId: string;            // agentId
  capability: string;             // e.g. "tool:web.search", "write:artifact"
  effect: "allow" | "deny" | "require_approval";
  scope: Record<string, string>;  // e.g. { roomId: "xxx" }
  expiresAt: string | null;
  issuedBy: string;
  state: "requested" | "active" | "expired" | "revoked" | "denied";
}
```

---

## 2. DomainEvent

### 2.1 事件结构

```ts
interface DomainEvent<P = unknown> {
  eventId: string;                // UUID v7，唯一标识
  runtimeId: string;              // 来源 Runtime
  sequence: number;               // 单调递增序号，单 Runtime 内唯一
  schemaVersion: string;          // "1.0"
  type: string;                   // 事件类型，如 "task.created"
  occurredAt: string;             // 事件发生时间，ISO 8601
  receivedAt: string;             // Office 收到时间，ISO 8601
  correlationId: string;          // 关联 ID，同一业务流程共享
  causationId: string | null;     // 因果 ID，指向直接触发此事件的事件
  traceId: string;                // 分布式追踪 ID
  payload: P;
}
```

### 2.2 第一版事件类型

```text
runtime.connected
runtime.disconnected

agent.spawned
agent.status_changed        // payload: { agentId, oldStatus, newStatus, reason? }

task.created                // payload: { taskId, title, description, parentTaskId? }
task.assigned               // payload: { taskId, agentId }
task.started                // payload: { taskId, agentId }
task.blocked                // payload: { taskId, reason }
task.completed              // payload: { taskId }
task.failed                 // payload: { taskId, reason }

artifact.created            // payload: { artifactId, taskId, producerAgentId, type, title, uri? }
artifact.reviewed           // payload: { artifactId, reviewerId, verdict, comment }

approval.requested          // payload: { approvalId, taskId, kind, requestedBy, reason }
approval.resolved           // payload: { approvalId, status: "approved"|"rejected"|"expired", resolvedBy? }

error.raised                // payload: { taskId?, agentId?, message, severity }
```

### 2.3 事件顺序

- 单 Runtime 内，`sequence` 严格单调递增
- 同一 `correlationId` 的事件按 `sequence` 排序后构成因果链
- `causationId` 指向直接前驱事件，形成 DAG（有向无环图）
- 多 Runtime 之间不保证全局有序

### 2.4 幂等

- 消费方按 `eventId` 去重
- 重复投递的同一 `eventId` 事件必须被忽略
- 去重窗口至少保留最近 10000 个 `eventId`

### 2.5 去重

- Office 端维护已处理 `eventId` 集合
- 内存中保留最近 N 个 `eventId`（Bloom Filter + LRU）
- 超过窗口的重复事件：如果 `sequence` 已经小于当前 Snapshot 的 `lastEventId`，可直接忽略

---

## 3. OfficeCommand

### 3.1 命令结构

```ts
interface OfficeCommand<P = unknown> {
  commandId: string;              // UUID v7，唯一标识
  commandType: string;            // 命令类型
  timestamp: string;              // 发送时间，ISO 8601
  source: "user" | "system";      // 来源
  actorId: string;                // 用户 ID 或系统 ID
  runtimeId: string;              // 目标 Runtime
  targetId: string | null;        // 目标对象 ID
  payload: P;
}
```

### 3.2 第一版命令类型

```text
task.create          // payload: { title, description, priority?, parentTaskId? }
task.assign          // payload: { taskId, agentId }
agent.pause          // payload: { agentId }
agent.resume         // payload: { agentId }
approval.accept      // payload: { approvalId }
approval.reject      // payload: { approvalId, reason }
artifact.open        // payload: { artifactId }
```

### 3.3 CommandResult

```ts
interface CommandResult {
  commandId: string;
  status: "accepted" | "rejected" | "error";
  error?: {
    code: string;
    message: string;
  };
  affectedEventIds: string[];     // 由此命令触发的事件 ID
}
```

### 3.4 命令执行链路

```text
UI Action
  → Command Gateway（校验 commandId 幂等）
  → Policy Validation（校验 CapabilityGrant）
  → Runtime Adapter.execute(command)
  → Runtime 执行
  → Runtime 产生 DomainEvent
  → Office Snapshot Update
```

前端操作不得直接修改 Snapshot。

---

## 4. RuntimeAdapter

### 4.1 接口定义

```ts
interface RuntimeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): Promise<RuntimeSnapshot>;
  subscribe(handler: DomainEventHandler): Unsubscribe;
  execute(command: OfficeCommand): Promise<CommandResult>;
  getCapabilities(): AdapterCapabilities;
}

type DomainEventHandler = (event: DomainEvent) => void;
type Unsubscribe = () => void;
```

### 4.2 AdapterCapabilities

```ts
interface AdapterCapabilities {
  supportedEvents: string[];      // 支持的 DomainEvent 类型
  supportedCommands: string[];    // 支持的 OfficeCommand 类型
  features: {
    snapshot: boolean;            // 是否支持 getSnapshot
    sse: boolean;                 // 是否支持 SSE 推送
    websocket: boolean;           // 是否支持 WebSocket
    commandExecution: boolean;    // 是否支持 execute 命令
    softMapping: boolean;         // 是否支持软映射
    hardOrchestration: boolean;   // 是否支持硬编排
  };
}
```

### 4.3 Adapter 不支持某项 Command 时

当 Adapter 不支持某个 Command（不在 `supportedCommands` 中）时：

1. `execute()` 返回 `CommandResult { status: "rejected", error: { code: "UNSUPPORTED_COMMAND", message: "..." } }`
2. 不产生任何 DomainEvent
3. 前端应检查 `AdapterCapabilities`，在调用前禁用不支持的 Command 按钮
4. 不允许假装执行成功（如返回 fake 成功但 Runtime 没有变化）

### 4.4 MockRuntimeAdapter 约定

MockRuntimeAdapter 必须：
- 维护内存中的状态（Agent、Task、Artifact、Approval）
- 支持 ScriptedEvent 注入，用于模拟预定义场景
- 所有 Command 执行是同步的（或极快异步）
- 事件按脚本化时序产生，不依赖真实 LLM 或外部系统

---

## 5. Snapshot 与事件重建

### 5.1 初始化

```text
Client                          Server/Adapter
  │                                  │
  │──── GET /snapshot ──────────────→│
  │←─── RuntimeSnapshot ─────────────│
  │                                  │
  │──── GET /events?after=lastEventId│
  │←─── SSE stream: DomainEvent[] ───│
  │                                  │
```

### 5.2 增量更新

```text
Current State = Snapshot + Events(after snapshot.lastEventId)
```

- 每次收到 DomainEvent，应用事件到本地状态
- 本地状态 = 上一次 Snapshot 投影 + 增量事件投影

### 5.3 断线恢复

1. SSE 连接断开
2. 浏览器自动重连，携带 `Last-Event-ID`
3. 服务端从 Event Log 中找到 `lastEventId` 之后的事件
4. 推送增量事件
5. 如果事件已裁剪（Event Log 中不存在），服务端返回 `410 Gone`，客户端重新拉取完整 Snapshot

### 5.4 Snapshot 重建

- 服务端定期从 Event Log 重建 materialized Snapshot
- 重建频率：每 N 个事件或每 T 秒
- 重建时，从上一个 Snapshot 开始，重放事件直到当前

---

## 6. 非法状态转换

### 6.1 处理规则

当收到的事件导致非法状态转换时：

1. 写入 `InvalidTransitionRejected` 审计事件
2. 保持原状态不变
3. 前端展示"状态异常"标记，但不阻塞系统

### 6.2 合法状态转换

**Agent**：
```text
offline → idle
idle → planning → working → idle
working → waiting → idle
working → reviewing → idle
working → blocked → idle
working → failed → idle
any → paused → (恢复原状态)
```

**Task**：
```text
created → queued → assigned → planning → running → reviewing
running → waiting_approval → reviewing
running → blocked → running
reviewing → revision_required → running
reviewing → completed
running → failed
any → cancelled
```

**Artifact**：
```text
draft → generated → under_review → approved → delivered
under_review → revision_required → generated
under_review → rejected
```

**Approval**：
```text
requested → approved
requested → rejected
requested → expired
requested → cancelled
```

---

## 7. 事件日志

### 7.1 格式

- Append-only JSONL 文件
- 每行一个 DomainEvent
- 按 `sequence` 排序

### 7.2 保留策略

- MVP 阶段：保留全部事件（数据量小）
- 后续：按时间或数量裁剪，保留最近 N 天或最近 M 个事件

### 7.3 审计

- 所有 Command 和 DomainEvent 自动记录
- 审计日志与事件日志共享 `traceId` / `correlationId`
- 关键操作（审批、权限变更）额外标记

---

## 8. 协议版本

- `schemaVersion` 字段标识协议版本
- MVP 使用 `"1.0"`
- 版本升级时，Adapter 需同时支持旧版本 Snapshot 的读取
- 新版本字段必须向后兼容（新增可选字段，不删除已有字段）