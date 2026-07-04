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
  subscribe(handler: DomainEventHandler, options?: SubscribeOptions): Unsubscribe;
  execute(command: OfficeCommand): Promise<CommandResult>;
  getCapabilities(): AdapterCapabilities;
}

type DomainEventHandler = (event: DomainEvent) => void;
type Unsubscribe = () => void;

interface SubscribeOptions {
  /**
   * 游标订阅：要求 adapter 重放所有 sequence > afterSequence 的事件，
   * 然后转入实时推送。未提供表示仅订阅实时流（由调用方保证无 gap）。
   */
  afterSequence?: number;
}
```

#### 4.1.1 游标订阅契约（Cursor-aware Subscription）

Adapter 必须保证 `subscribe(handler, { afterSequence: N })` 的语义：

1. **同步重放阶段**：在返回 `Unsubscribe` 之前，adapter 必须以调用线程同步方式，
   把内部 Event Log 中所有 `sequence > N` 的事件依次投递给 `handler`。
   重放顺序按 `sequence` 升序。
2. **实时推送阶段**：重放完成后，新产生的事件按到达顺序投递给 `handler`。
3. **重放失败不静默**：如果 adapter 内部 Event Log 已裁剪导致无法满足 `afterSequence`，
   adapter 应在 subscribe 调用阶段抛出 `EventLogTrimmedError`，
   由调用方决定是否拉取新 Snapshot 重启。
   （MockRuntimeAdapter 因为不裁剪，永远不会触发此错误。）
4. **重放期间不再二次投递**：重放阶段已投递的事件，进入实时阶段后不会被重复投递。

> 注意：调用方应当先调用 `getSnapshot()` 拿到 checkpoint，再以
> `snapshot.sequence` 作为 `afterSequence` 调用 `subscribe`。
> 顺序错误（先 subscribe 后 getSnapshot）会导致 gap 或重复。

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

### 5.1 Checkpoint 模型（baseSnapshot + post-checkpoint event log）

Office 端的 `SnapshotStore` 采用 **checkpoint-aware event sourcing**：

```text
┌─────────────────────────────────────────────────────────────────┐
│  SnapshotStore                                                  │
│                                                                 │
│  baseSnapshot  ──── 可信 checkpoint（由 setSnapshot 安装）       │
│       │                                                         │
│       ▼                                                         │
│  current snapshot = baseSnapshot + replay(post-checkpoint log)  │
│                                                                 │
│  eventLog[]    ──── 仅记录 checkpoint 之后被接受的事件           │
│  dedup         ──── 仅记录 checkpoint 之后被接受过的 eventId     │
│  lastSequence  ──── 已观察到的最大 sequence                     │
└─────────────────────────────────────────────────────────────────┘
```

**不变量**：

- `baseSnapshot.runtimeId === snapshot.runtimeId === current snapshot.runtimeId`
- `baseSnapshot.sequence ≤ lastSequence`
- `eventLog` 中所有事件的 `sequence > baseSnapshot.sequence`
- `dedup` 中所有 `eventId` 对应的 `sequence > baseSnapshot.sequence`
- 调用 `setSnapshot` 会**原子地**重置 `baseSnapshot`、`snapshot`、`eventLog`、`dedup`、`lastSequence`

### 5.2 初始化（Bootstrap Ordering）

Bootstrap 必须按 **snapshot-first** 顺序：

```text
1. adapter.connect()
2. snapshot = await adapter.getSnapshot()
3. store.setSnapshot(snapshot)                 // 安装 checkpoint
4. session.subscribe(handler, {
     afterSequence: snapshot.sequence          // 游标订阅
   })
```

> 顺序错误示例：先 `subscribe` 再 `getSnapshot` 会导致
> (a) 重放阶段拿不到任何事件（因为还没安装 checkpoint，store.lastSequence = 0）；
> (b) 进入实时阶段后，订阅期间产生的事件 sequence 与 store 期望的 sequence 不连续。

### 5.3 类型化事件应用结果（EventApplyResult）

`SnapshotStore.applyEvent(event)` 返回类型化结果，**调用方不得解析 `reason` 字符串**：

```ts
type EventApplyCode =
  | "applied"            // 事件被接受并应用，snapshot 已更新
  | "duplicate"          // eventId 已在 dedup 中（重复投递）
  | "runtime_mismatch"   // event.runtimeId !== store.runtimeId
  | "stale_sequence"     // event.sequence ≤ store.lastSequence
  | "sequence_gap"       // event.sequence > store.lastSequence + 1
  | "reducer_rejected";  // 通过 transport 校验但 reducer 拒绝（非法状态转换等）

/**
 * Reducer 错误分类（Issue #4 结构化 diagnostics）。
 *
 * 调用方依据 code 判断错误类别，message 仅用于展示。
 */
type ReducerErrorCode =
  | "entity_not_found"      // entity 不存在（agent/task/artifact/approval not found）
  | "invalid_transition"    // 状态机转换不允许（含 cascade failures）
  | "constraint_violation"  // 业务规则违反（已存在、审批未通过等）
  | "validation_error";     // 未知事件类型或校验失败

interface ReducerError {
  code: ReducerErrorCode;
  message: string;
  /** Entity path，格式 "entityType:entityId"，例如 "tasks:t-1" */
  entityPath?: string;
}

interface EventApplyResult {
  applied: boolean;       // 是否真正修改了 snapshot
  code: EventApplyCode;   // 类型化结果码
  reason?: string;        // 仅用于诊断日志（首个 reducer error 的 message），不参与控制流
  expectedSequence?: number;
  receivedSequence?: number;
  /**
   * reducer_rejected 时的结构化诊断（所有 reducer errors）。
   * 仅在 code === "reducer_rejected" 时存在。
   * Issue #4 引入：让上层（session / UI）能展示完整的 reducer 拒绝原因列表，
   * 并通过 onAcceptedEvent 透传给 UI。
   */
  reducerErrors?: ReducerError[];
}
```

**关键决策：事务性 reducer 提交（Issue #4 硬化）**

`applyEvent` 把 **transport 接受** 与 **domain 提交** 分离：

- **transport 接受**：sequence 推进 + 入 log + 标记 dedup（与 Runtime 单调一致）
- **domain 提交**：仅当 reducer errors 为空时才采用 `result.snapshot`；errors 非空时 **snapshot 保持原状态不变**

| Code              | applied | 推进 lastSequence | 进入 eventLog | 标记 dedup | snapshot 替换 |
| ----------------- | ------- | ----------------- | ------------- | ---------- | ------------- |
| `applied`         | true    | yes               | yes           | yes        | **yes**       |
| `reducer_rejected`| false   | **yes**           | **yes**       | **yes**    | **no（事务性）** |
| `duplicate`       | false   | no                | no            | no         | no            |
| `stale_sequence`  | false   | no                | no            | no         | no            |
| `runtime_mismatch`| false   | no                | no            | no         | no            |
| `sequence_gap`    | false   | no                | no            | no         | no            |

**为什么 reducer_rejected 仍推进 sequence？**

Runtime 已经把该事件计入了自己的 sequence 序列。如果 Office 跳过它，
后续事件的 `sequence` 会与 `lastSequence + 1` 不对齐，从而被误判为 `sequence_gap`。
因此 Office 必须把 reducer_rejected 事件作为"已发生但未改变业务状态"的事实接受下来，
维持与 Runtime 的单调一致性。`applied=false` 仅表示 snapshot 状态未变，
**不代表**事件被丢弃。

**为什么 reducer 出错时不采用候选 snapshot（事务性）？**

reducer 在非法转换时仍会返回一个"best-effort"的候选 snapshot（可能仅部分字段被修改）。
若采用这种部分修改的 snapshot，会导致状态不一致：transport 层面已接受事件，
但 domain 层面状态可能损坏。事务性提交保证 **要么全部应用，要么完全不动**，
reducer errors 通过 `reducerErrors` 字段透传给 UI 展示。`rebuildFromLog` 也遵循同一逻辑，
保证重放幂等一致。

### 5.4 增量更新

```text
Current State = baseSnapshot + replay(eventLog)
```

- 每次收到 DomainEvent，调用 `store.applyEvent(event)`
- 根据 `EventApplyResult.code` 走不同分支（见 §5.5）
- UI 历史只展示 `applied` 和 `reducer_rejected` 事件（二者都已进入 eventLog）
- transport 拒绝的 `duplicate / stale / gap / mismatch` 不进入 UI 事件历史

### 5.5 Gap 自动恢复

当 `applyEvent` 返回 `code === "sequence_gap"` 时，由 `RuntimeSession` 触发恢复：

```text
1. session 进入 "resynchronizing" 状态
2. 立即 removeSubscription（拆除当前订阅 + 清空 activeSubscriptionCursor）
3. snapshot' = await adapter.getSnapshot()              // 拉取最新 checkpoint
4. store.setSnapshot(snapshot')                          // 原子重置
5. session.installSubscription(snapshot'.sequence)       // 重新游标订阅
6. session 进入 "connected" 状态
```

**Issue #4 硬化约束**：

- **共享 in-flight Promise**：并发的 `resynchronize()` 调用复用同一个 `resyncPromise`，真正单飞。
  旧版用 `resyncing` boolean 标志只能阻止并发，无法让调用方 await 同一个 Promise。
- **先拆旧订阅**：进入 resynchronizing 后**立即** removeSubscription，
  避免在等待 snapshot 期间旧订阅继续推送事件造成混乱。
- **epoch race safety**：doResynchronize 在每个 `await` 后校验 `this.epoch`；
  若期间发生了 disconnect（epoch 递增），resync 立即 bail out，
  不安装 snapshot、不重建订阅。
- **resync 失败不留活跃订阅**：resync 失败时状态转 `failed`，
  `lastError.code = "resync_failed"`，`hasActiveSubscription = false`。
- 恢复期间收到的 transport 事件被 `handleEvent` 守卫丢弃（`state === "resynchronizing"` 时直接 return）
- 调用方也可主动调用 `session.resynchronize()` 强制恢复

### 5.6 Snapshot 替换语义

`store.setSnapshot(snapshot)` 是**原子的 checkpoint 安装**：

- 校验 `snapshot.runtimeId === baseSnapshot.runtimeId`，不匹配返回 `{ ok: false, code: "runtime_mismatch" }`
- 通过校验后：
  - `baseSnapshot = deepClone(snapshot)`
  - `snapshot = deepClone(snapshot)`
  - `lastSequence = snapshot.sequence`
  - `eventLog = []`
  - `dedup.clear()`
  - `reducerErrors = []`
  - 通知所有 listeners
- 调用方拿到结果后，必须重新 `subscribe(handler, { afterSequence: snapshot.sequence })`

### 5.7 rebuildFromLog 语义

`store.rebuildFromLog()` 用于断点重放：

- 从 `baseSnapshot` 的 deep clone 开始（不是从空 snapshot）
- 清空 `eventLog`、`dedup`
- 重置 `lastSequence = baseSnapshot.sequence`
- 按原顺序重新应用所有曾经被接受的事件
- 失败的 reducer_rejected 事件再次应用时仍会被记录为 reducer_rejected
- 完成后 `snapshot` 与重放前应当等价（除非 reducer 逻辑发生变化）

### 5.8 Snapshot 重建（服务端）

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

## 8. RuntimeSession 生命周期

### 8.1 角色定位

`RuntimeSession` 是 **框架无关的会话生命周期所有者**，位于 `packages/core`：

- 不依赖 React / Vue / 任何 UI 框架
- 不持有 UI 状态，只持有：adapter 引用、store 引用、gateway 引用、订阅句柄、内部状态机
- 对外暴露：`connect / disconnect / resynchronize / onStateChange / onAcceptedEvent`
- 内部封装：bootstrap ordering、cursor-aware subscribe、gap recovery、状态转换

### 8.2 状态机

```text
       ┌──────────────┐  connect()    ┌──────────────┐
       │ disconnected │ ────────────→ │  connecting  │
       └──────────────┘               └──────┬───────┘
                                          │ adapter.connect OK
                                          ▼
                                   ┌──────────────┐
                                   │ synchronizing│  (getSnapshot + setSnapshot + subscribe)
                                   └──────┬───────┘
                                          │ subscribe OK
                                          ▼
                                   ┌──────────────┐
                ┌──────────────────│   connected  │
                │                  └──────┬───────┘
                │ sequence_gap            │ disconnect()
                ▼                         ▼
        ┌──────────────┐           ┌──────────────┐
        │ resynchronizing│          │ disconnected │
        └──────┬───────┘           └──────────────┘
               │ resync OK
               ▼
        ┌──────────────┐
        │   connected  │
        └──────────────┘

  任意状态遇到 runtime_mismatch / 不可恢复错误 → "degraded" 或 "failed"
  任意状态遇到 disconnect() → "disconnected"
```

### 8.3 接口

```ts
type SessionState =
  | "disconnected"
  | "connecting"
  | "synchronizing"
  | "connected"
  | "resynchronizing"
  | "degraded"
  | "failed";

/**
 * 结构化会话错误分类（Issue #4）。
 * 取代旧版的 runtimeMismatchError: string | null。
 */
type SessionErrorCode =
  | "runtime_mismatch"     // event.runtimeId 与 store 不匹配（不可恢复）
  | "connect_failed"       // adapter.connect() 抛错
  | "snapshot_failed"      // adapter.getSnapshot() 抛错或 checkpoint 安装被拒
  | "subscribe_failed"     // adapter.subscribe() 抛错
  | "resync_failed"        // resync 阶段 getSnapshot / setSnapshot 失败
  | "disconnect_failed";   // adapter.disconnect() 抛错（状态仍转 disconnected）

interface SessionError {
  code: SessionErrorCode;
  message: string;
  at: string;  // ISO 8601
}

interface SessionDiagnostics {
  state: SessionState;
  lastSequence: number;
  /** 结构化错误：按错误类型分类，null 表示无错误 */
  lastError: SessionError | null;
  /** 最近一次 gap 诊断 */
  lastGap: GapDiagnostic | null;
  /** 已发起的 resync 次数 */
  resyncCount: number;
  /** 当前是否持有活跃订阅 */
  hasActiveSubscription: boolean;
  /** 当前活跃订阅的 afterSequence 游标；无订阅时为 null */
  activeSubscriptionCursor: number | null;
}

class RuntimeSession {
  constructor(adapter, store, gateway, options?);
  connect(): Promise<void>;           // disconnected → connecting → synchronizing → connected
  disconnect(): Promise<void>;        // any → disconnected（递增 epoch）
  resynchronize(): Promise<void>;     // 主动触发 gap 恢复流程（共享 in-flight Promise）
  onStateChange(listener): Unsubscribe;
  onAcceptedEvent(listener): Unsubscribe;  // 仅 applied / reducer_rejected 事件
  getState(): SessionState;
  getDiagnostics(): SessionDiagnostics;     // 状态、lastError、gap 计数、订阅状态等
}
```

### 8.4 事件分发规则

`session.handleEvent(event)` 内部分发依据 `EventApplyResult.code`：

| Code              | 行为                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `applied`         | gateway 接受事件 → 通知 onAcceptedEvent listener                   |
| `reducer_rejected`| gateway 接受事件（标记 reducer error）→ 通知 onAcceptedEvent listener |
| `duplicate`       | 静默丢弃（已处理过）                                                |
| `stale_sequence`  | 静默丢弃（旧序号）                                                  |
| `runtime_mismatch`| session 进入 `degraded`，`lastError.code = "runtime_mismatch"`     |
| `sequence_gap`    | 触发 `resynchronize()`（共享 in-flight Promise）                    |

**resynchronizing 守卫**：当 `session.state === "resynchronizing"` 时，`handleEvent` 直接 return，
避免旧订阅在拆旧订阅与安装新 checkpoint 之间混入事件。

### 8.5 React 集成约定

- `useOfficeState(session, store, gateway, runtimeId)` 接受 `RuntimeSession` 而非 `RuntimeAdapter`
- React hook 只订阅 `store`、`session.onStateChange`、`session.onAcceptedEvent`
- UI 事件历史只追加 `onAcceptedEvent` 推送的事件（即 applied / reducer_rejected）
- transport 拒绝事件不进入 UI 历史
- **StrictMode 安全**：session 应在模块作用域创建（如 `main.tsx` 顶层），避免 React StrictMode 双重挂载导致重复订阅

### 8.6 幂等 connect 与共享 in-flight Promise（Issue #4 硬化）

- `connect()` 在非 `disconnected` / `failed` 状态调用是 no-op，直接 resolve
- **共享 in-flight Promise**：并发的 `connect()` 调用复用同一个 `connectPromise`，真正单飞。
  两个调用方 await 同一个 Promise；Promise 落定后 `connectPromise` 被清空。
- `resynchronize()` 同样使用共享 `resyncPromise` 实现单飞。
- **epoch race safety**：`disconnect()` 递增 `epoch` token；延迟的 `doConnect` / `doResynchronize`
  在每个 `await` 后校验自己的 epoch 是否仍为当前值，不一致即静默 bail out（不抛错、不写 lastError），
  避免在 disconnect 之后安装 snapshot 或重建订阅。

---

## 9. 协议版本

- `schemaVersion` 字段标识协议版本
- MVP 使用 `"1.0"`
- 版本升级时，Adapter 需同时支持旧版本 Snapshot 的读取
- 新版本字段必须向后兼容（新增可选字段，不删除已有字段）