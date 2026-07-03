# Agent Office MVP 范围定义

> 本文档定义 Agent Office 第一版的最小可行产品范围。
>
> 任何超出此范围的提议，除非有明确的用户验证数据支撑，否则不应进入第一版。
>
> 与项目指导文档 `AGENT-GPT.md` 冲突时，以本文档为准。

---

## 1. MVP 做什么

### 1.1 核心链路验证

一条完整链路：用户下达目标 → Orchestrator 创建任务 → Worker 领取并执行 → 产生 Artifact → Reviewer 审查 → 请求用户审批 → 用户批准或拒绝 → 任务完成或返工。

### 1.2 角色

| 角色 | 数量 | 职责 |
|------|------|------|
| Orchestrator | 1 | 接收用户目标，创建和拆分任务，协调 Worker 和 Reviewer |
| Worker | 2 | 领取任务，执行工作，产生 Artifact |
| Reviewer | 1 | 审查 Worker 的产出，请求用户审批 |

### 1.3 空间

| 区域 | 类型 | 职责 |
|------|------|------|
| 指挥区 | command | 用户下达目标，查看全局状态，Orchestrator 工作区 |
| 执行区 | execution | Worker 领取和执行任务，产生 Artifact |
| 审查区 | review | Reviewer 审查产出，标记通过或需返工 |
| 审批与交付区 | approval_delivery | 用户审批请求，查看最终交付物 |

### 1.4 事件

MVP 必须实现以下全部事件：

```text
agent.spawned
agent.status_changed

task.created
task.assigned
task.started
task.blocked
task.completed

artifact.created
artifact.reviewed

approval.requested
approval.resolved

error.raised
```

### 1.5 命令

MVP 必须实现以下全部命令：

```text
task.create
task.assign
agent.pause
agent.resume
approval.accept
approval.reject
artifact.open
```

### 1.6 体验模式

| 模式 | MVP 实现 |
|------|----------|
| Command Mode | 完整实现：像素办公室全视图 + 右侧控制面板 |
| Focus Mode | 完整实现：极简状态指示器 + 通知静默积压 |
| Debrief Mode | 完整实现：积压审批/产物/异常集中处理 |
| Recovery Mode | 仅保留接口定义，不实现 |

### 1.7 技术实现

- TypeScript
- React + PixiJS（像素渲染层）
- React DOM（侧边控制面板）
- HTTP Snapshot 初始化
- SSE 增量事件推送
- REST Command API
- MockRuntimeAdapter（脚本化事件，不接真实 LLM）
- Append-only 本地事件日志（JSONL）
- Materialized Snapshot

### 1.8 权限模型

仅使用 CapabilityGrant：

- `allow`：允许执行
- `deny`：禁止执行
- `require_approval`：需要用户审批

不实现 RBAC、ABAC、OPA、Cedar 或任何外部策略引擎。

---

## 2. MVP 不做什么

### 2.1 不做的功能

- 不接真实 LLM
- 不接 OpenClaw、Hermes、QClaw、Swarm 或任何真实 Runtime
- 不实现完整多 Runtime 支持
- 不实现 Recovery Mode
- 不实现隔离区（Isolation Zone）
- 不实现会议室（Meeting Room）
- 不实现任务大厅（Task Hall）
- 不实现 RBAC 或 ABAC
- 不引入 OPA / Cedar / Temporal / Kubernetes
- 不实现 CRDT
- 不实现完整微服务架构
- 不实现多租户
- 不实现完整 OpenTelemetry 平台
- 不实现数据库集群
- 不做像素美术设计（使用占位方块/简单几何形状）
- 不实现考研自习室场景（那是未来的 Study Experience Profile）
- 不实现任何游戏机制（经验值、金币、收集、成就）

### 2.2 不做但保留扩展点的功能

- Recovery Mode（接口定义保留）
- 隔离区（Room 类型保留）
- 会议室（Room 类型保留）
- 多 Runtime Adapter（Adapter 接口支持多实现）
- 复杂权限策略（CapabilityGrant 接口可扩展）

---

## 3. 主流程

### 3.1 端到端主流程

```
1. 用户在 Command Mode 中，通过指挥区创建任务
   → 命令：task.create
   → 事件：task.created

2. Orchestrator 将任务分配给 Worker-1
   → 事件：task.assigned (Worker-1)

3. Worker-1 进入执行区，开始执行
   → 事件：agent.status_changed (idle → working)
   → 事件：task.started

4. Worker-1 执行完成，产生 Artifact
   → 事件：artifact.created

5. Orchestrator 将审查任务分配给 Reviewer
   → 事件：task.assigned (Reviewer)

6. Reviewer 进入审查区，开始审查
   → 事件：agent.status_changed (idle → reviewing)
   → 事件：task.started (Reviewer)

7. Reviewer 完成审查
   → 事件：artifact.reviewed (verdict: approved)

8. Reviewer 请求用户审批
   → 事件：approval.requested

9. 用户在 Debrief Mode 中查看审批请求
   → 命令：artifact.open（查看 Artifact）

10. 用户批准
    → 命令：approval.accept
    → 事件：approval.resolved (approved)

11. 任务完成
    → 事件：task.completed
```

### 3.2 Mock 脚本化场景

MockRuntimeAdapter 将预置以下脚本化场景：

1. **正常完成**：主流程完整跑通
2. **Worker 阻塞**：Worker 执行中触发 task.blocked
3. **审批拒绝**：用户拒绝审批，触发返工

---

## 4. 三条异常流程

### 4.1 异常流程一：Worker 执行阻塞

```
1. Worker-1 正在执行区执行任务
2. Mock 触发 task.blocked 事件（原因：依赖数据不足）
3. Worker-1 状态变为 blocked
   → 事件：agent.status_changed (working → blocked)
4. 像素空间中 Worker-1 显示阻塞标记
5. 用户在 Debrief Mode 中看到阻塞
6. 用户查看阻塞原因
7. 用户手动解除阻塞（Mock 中自动恢复）
8. Worker-1 恢复执行
   → 事件：agent.status_changed (blocked → working)
```

### 4.2 异常流程二：审查不通过 → 返工

```
1. Reviewer 审查 Worker-1 的产出
2. Reviewer 标记为 revision_required
   → 事件：artifact.reviewed (verdict: revision_required)
3. Artifact 状态变为 revision_required
4. Worker-1 收到返工任务
   → 事件：task.assigned (Worker-1, 返工)
5. Worker-1 重新进入执行区
   → 事件：task.started
6. Worker-1 完成返工，产生新版本 Artifact
   → 事件：artifact.created (version: 2)
7. 新 Artifact 重新进入审查区
8. Reviewer 重新审查，通过
   → 事件：artifact.reviewed (verdict: approved)
```

### 4.3 异常流程三：用户拒绝审批

```
1. Reviewer 请求审批
   → 事件：approval.requested
2. 用户在 Debrief Mode 中查看审批内容
3. 用户选择拒绝
   → 命令：approval.reject
   → 事件：approval.resolved (rejected)
4. 任务状态回到 revision_required
5. Reviewer 收到返工通知
6. Reviewer 重新审查或修改
7. 再次请求审批
   → 事件：approval.requested
8. 用户批准
   → 命令：approval.accept
   → 事件：approval.resolved (approved)
```

---

## 5. 验收条件

### 5.1 功能验收

- [ ] 用户能创建任务（task.create 命令）
- [ ] 用户能将任务分配给 Agent（task.assign 命令）
- [ ] 用户能暂停和恢复 Agent（agent.pause / agent.resume 命令）
- [ ] 用户能打开 Artifact 查看内容（artifact.open 命令）
- [ ] 用户能批准审批请求（approval.accept 命令）
- [ ] 用户能拒绝审批请求（approval.reject 命令）
- [ ] 所有 12 个事件类型均能正确产生和处理
- [ ] 主流程（创建→执行→审查→审批→完成）完整可走通
- [ ] 三条异常流程各可走通

### 5.2 技术验收

- [ ] MockRuntimeAdapter 实现完整 RuntimeAdapter 接口
- [ ] SSE 事件流能正确推送增量事件
- [ ] HTTP Snapshot 能正确返回完整状态
- [ ] Command Gateway 能正确校验和路由命令
- [ ] 事件日志 append-only，每行一个 JSON DomainEvent
- [ ] Snapshot 能从事件日志重建
- [ ] 事件去重（同一 eventId 不重复处理）
- [ ] 断线重连后能恢复事件流（SSE Last-Event-ID）

### 5.3 交互验收

- [ ] 像素空间中能显示 4 个区域和 4 个 Agent
- [ ] Agent 状态变化能在像素空间中反映（位置、动画）
- [ ] 任务流转能在像素空间中反映（区域之间的移动）
- [ ] 审批请求能在像素空间中显示视觉标记
- [ ] 阻塞状态能在像素空间中显示视觉标记
- [ ] 右侧控制面板能操作所有 7 个命令
- [ ] Command Mode / Focus Mode / Debrief Mode 三模式可切换
- [ ] Focus Mode 中事件静默积压，不打断用户
- [ ] Debrief Mode 中能集中处理积压的审批和产物

### 5.4 架构验收

- [ ] Room 与 ExecutionProfile 分离
- [ ] RoomBinding 正确关联 Room 和 ExecutionProfile
- [ ] 权限仅使用 CapabilityGrant（allow/deny/require_approval）
- [ ] 前端不直接修改 Snapshot
- [ ] Pixel 层不自行推断业务事实
- [ ] 命令执行走完整链路：UI → Gateway → Policy → Adapter → Runtime → Event → Snapshot

---

## 6. 扩展点

### 6.1 后续接入 QClaw / Swarm 的扩展点

- `RuntimeAdapter` 接口：新增 `QClawAdapter` / `SwarmAdapter` 实现
- `DomainEvent` 的 `payload` 字段：扩展为 QClaw / Swarm 特有字段
- `ExecutionProfile`：按 QClaw / Swarm 的能力扩展 profile 字段
- 不需要修改：Room、RoomBinding、Command Gateway、Snapshot 投影

### 6.2 后续接入 OpenClaw 的扩展点

- `RuntimeAdapter` 接口：新增 `OpenClawAdapter` 实现
- SSE 事件流：对接 OpenClaw 的 hook 事件
- `ExecutionProfile`：对接 OpenClaw 的 workspace / sandbox 能力
- `CapabilityGrant`：对接 OpenClaw 的 MCP 工具权限
- 不需要修改：Room、RoomBinding、Command Gateway、Snapshot 投影

### 6.3 后续接入 Recovery Mode 的扩展点

- `product-loop.md` 中已定义 Recovery Mode 接口
- 新增 `RecoveryService` 模块
- 新增 `SESSION_GAP_DETECTED` 事件类型
- 扩展 Debrief Mode 面板，增加"历史摘要"视图

---

## 7. 不做但需要记录的设计决策

1. **为什么不做隔离区**：MVP 只有 4 个 Agent，异常处理通过阻塞和暂停机制即可覆盖，隔离区在 Agent 数量 > 10 时才有实际价值。

2. **为什么不做会议室**：会议室需要多 Agent 协作语义，MVP 只有一个 Orchestrator 做协调，不需要独立会议室。

3. **为什么权限只用 CapabilityGrant**：MVP 的权限场景简单（工具使用、产物写入），完整的 RBAC/ABAC 在用户量和 Agent 数量上来后才需要。

4. **为什么不做像素美术**：MVP 验证的是交互模型和架构，不是美术风格。使用占位几何形状即可。

5. **为什么 Recovery Mode 只保留接口**：Recovery Mode 的价值在于长期使用场景（用户离开数天后回归），MVP 的测试周期短，无法验证其有效性。