# AI-像素 · Agent Office 项目指导文档

> 本文件是本项目的最高级认知与开发约束文档。
>
> 任何进入本仓库工作的 Agent、开发者或自动化工具，在阅读其他设计文档、代码和任务说明前，必须先阅读本文件。
>
> 若其他局部文档与本文件冲突，以本文件为准；若项目方向发生变化，应优先更新本文件，再继续后续开发。

---

## 1. 项目定位

本项目当前阶段的目标，是构建一个可嵌入其他 Agent 项目的 **Agent Office**。

Agent Office 不是传统游戏，也不是一个仅用于展示动画的像素页面，而是一个：

- 可执行的 Agent 作战室；
- 多 Agent Runtime 的空间化操作界面；
- Agent 状态、任务、工具、权限、工作流与产物的统一控制面；
- 面向 Human-in-the-loop 的观察、干预与治理系统；
- 可嵌入 OpenClaw、Hermes、QClaw、Swarm 或其他 Agent Runtime 的通用模块。

项目使用像素沙盒世界作为视觉语言与交互语言，但其本质仍然是 Agent 操作系统，而不是游戏。

本项目的核心目标是让复杂 Agent 系统变得：

- **空间化**：将抽象状态、任务、权限和协作关系映射为空间关系；
- **直觉化**：用户无需持续阅读大量日志，即可理解系统当前状态；
- **具象化**：Agent、任务、工具、房间、产物和异常都有明确可见的世界对象；
- **可治理**：用户可以直接干预、审批、暂停、分配、隔离和调整工作流。

项目核心公式：

```text
Agent Office
= Agent Runtime Control Plane
+ Spatial Operating Interface
+ Pixel Presentation Layer
```

---

## 2. 项目不是什么

本项目当前阶段明确不属于以下方向：

- 不是开放世界游戏；
- 不是像素 RPG；
- 不是模拟经营游戏；
- 不是《星露谷物语》《我的世界》或《泰拉瑞亚》的玩法复刻；
- 不是给 NPC 接入大模型聊天能力；
- 不是纯粹的 Agent 动画展示页面；
- 不是日志播放器；
- 不是仅用于展示 Agent 是否在线的状态面板；
- 不是绑定某一个 Agent 框架的专用前端；
- 不是允许 LLM 绕过规则直接修改世界状态的自由模拟系统。

像素、角色、房间和沙盒美术仅用于提升理解效率、空间表达能力和交互直觉。

任何功能若只增加“游戏感”，却没有提升 Agent 系统的可理解性、可操作性或可治理性，不应进入当前阶段。

---

## 3. 核心产品定义

Agent Office 是一个可嵌入式、事件驱动、空间化的 Agent Runtime 操作界面。

它将以下抽象对象转换为可观察、可操作的空间对象：

| Runtime 概念 | 空间化表达 |
|---|---|
| Agent 实例 | 像素角色 |
| Task | 任务卡、文件夹、公告板对象 |
| Tool / Skill | 工具台、设备、工具柜 |
| Memory / Context | 资料室、档案柜、知识架 |
| Artifact | 桌面文件、成果箱、交付物 |
| Approval | 审批台、指挥室确认点 |
| Workflow | 房间、通道、工作区之间的流转 |
| Permission | 房间准入、工具授权、门禁规则 |
| Error / Block | 告警、红灯、隔离区、阻塞状态 |
| Agent Collaboration | 会议室、协作桌、消息传递 |

空间对象必须尽可能对应真实 Runtime 状态，而不是任意编排的视觉表演。

---

## 4. 双重职责

Agent Office 必须同时承担以下两种职责。

### 4.1 状态展示

系统应准确展示：

- 哪些 Agent 在线；
- 每个 Agent 当前正在执行什么任务；
- Agent 当前处于规划、执行、等待、审查、阻塞或失败中的哪一种状态；
- Agent 正在使用哪些工具；
- Agent 当前持有哪些上下文、权限和工作区；
- 哪些任务正在等待依赖；
- 哪些任务正在等待人工审批；
- 哪些 Artifact 已经产生；
- 哪些 Agent 正在协作、等待或互相审查；
- 哪个位置出现异常、拥塞或资源争用。

### 4.2 真实控制

用户应能够通过 Agent Office 执行真实控制操作，包括但不限于：

- 创建任务；
- 分配任务；
- 调整任务优先级；
- 暂停、恢复或终止 Agent；
- 调整 Agent 所在工作区；
- 授予或撤销工具；
- 调整权限；
- 创建会议或协作任务；
- 批准或拒绝高风险操作；
- 打开、审查、接受或退回 Artifact；
- 将 Agent 或任务移动至隔离区；
- 修改工作流中的下一阶段。

任何控制操作都必须通过统一命令网关进入 Runtime，不允许前端直接修改 Runtime 真相状态。

---

## 5. Runtime 与 Office 的关系

Agent Runtime 是执行真相源。

Agent Office 不应替代 Runtime 的模型调用、工具执行、文件读写、任务执行和内部推理能力。

推荐关系：

```text
OpenClaw / Hermes / QClaw / Swarm / Other Runtime
                         ↓
                  Runtime Adapter
                         ↓
             Agent Office Control Core
                         ↓
               Pixel Spatial Interface
```

Runtime 负责：

- Agent 生命周期；
- 模型调用；
- 工具调用；
- 文件与工作区操作；
- 任务执行；
- 错误处理；
- 重试；
- Artifact 生成；
- 内部消息与执行记录。

Agent Office Control Core 负责：

- Runtime 统一抽象；
- Snapshot 管理；
- Event 归一化；
- Command 路由；
- 房间策略；
- 权限策略；
- 工具配置；
- Human-in-the-loop；
- 审批；
- 操作审计；
- 多项目适配。

Pixel Spatial Interface 负责：

- 显示 Agent 与世界对象；
- 显示状态变化；
- 播放动画；
- 接收用户交互；
- 将用户操作转换为 Command；
- 展示 Artifact、事件、告警与关系。

---

## 6. 真相状态与表现状态

系统必须严格区分以下三类状态。

### 6.1 Runtime State

真实执行状态，包括：

- Agent 状态；
- Task 状态；
- Tool 调用；
- Artifact；
- Approval；
- Permission；
- Runtime Error；
- 工作区与资源占用。

Runtime State 是唯一业务真相源。

### 6.2 Presentation State

仅用于界面表达，包括：

- 角色像素坐标；
- 路径动画；
- 当前动作动画；
- 镜头位置；
- UI 展开状态；
- 高亮；
- 气泡；
- 过渡效果。

Presentation State 不得被当作 Runtime State。

### 6.3 Ambient State

纯装饰状态，包括：

- 灯光；
- 天气；
- 风扇；
- 环境角色；
- 房间装饰；
- 非功能性动画。

Ambient State 不得影响真实执行。

---

## 7. 空间不能撒谎

这是本项目最重要的设计原则之一。

所有世界动作必须标记为以下三类之一：

### 7.1 真实动作

必须对应真实 Runtime 事件。

示例：

- Agent 调用终端；
- Agent 读取文件；
- Agent 等待审批；
- Agent 生成 Artifact；
- Agent 进入审查；
- Agent 遇到错误。

### 7.2 解释动作

用于帮助用户理解状态，但不表示真实执行动作。

示例：

- Agent 在规划时来回踱步；
- Agent 等待时坐下；
- Agent 阻塞时显示问号。

解释动作必须由明确的 Runtime 状态触发。

### 7.3 装饰动作

只用于视觉效果。

示例：

- 风扇旋转；
- 环境灯变化；
- 窗外下雨；
- 非功能性角色移动。

装饰动作不得制造“系统正在执行”的错误印象。

---

## 8. 房间语义

房间既是展示空间，也是执行策略。

一个 Room 应同时包含：

```text
Room
= Visual Area
+ Tool Set
+ Permission Set
+ Memory Scope
+ Execution Policy
+ Input Contract
+ Output Contract
+ Approval Policy
```

推荐接口：

```ts
interface RoomPolicy {
  roomId: string;
  allowedAgentRoles: string[];
  allowedTools: string[];
  deniedTools: string[];
  permissionScopes: string[];
  memoryScopes: string[];
  inputArtifactTypes: string[];
  outputArtifactTypes: string[];
  executionPolicy?: string;
  approvalPolicy?: string;
  concurrencyLimit?: number;
}
```

Agent 进入房间后，可以触发：

- 加载对应工具；
- 应用权限限制；
- 挂载特定知识范围；
- 切换工作模式；
- 规定输入和输出类型；
- 启用审批规则；
- 限制并发数量。

---

## 9. 两种房间进入方式

系统必须同时支持软映射与硬编排。

### 9.1 软进入

Runtime 已经发生状态变化，Office 仅将状态映射到房间。

```text
Runtime task.started
→ Office 将 Agent 映射到 development_room
→ Pixel UI 播放移动和工作动画
```

适用于：

- 已有项目接入；
- 只读观察；
- 兼容 OpenClaw、Hermes 或其他成熟 Runtime；
- 第一阶段原型。

### 9.2 硬进入

进入房间本身就是一个真实编排动作。

```text
Agent 被分配到 review_room
→ Control Core 应用 RoomPolicy
→ Runtime Adapter 授予只读权限
→ 加载 Review Skill
→ 启动审查任务
```

适用于：

- 新任务创建；
- 工具授权；
- 权限切换；
- 高风险流程；
- 多 Agent 协作；
- 人工控制。

长期目标是同时支持二者，但第一版应优先保证软映射稳定，再逐步加入硬编排。

---

## 10. 第一版核心对象

第一版仅围绕以下对象开发。

### 10.1 Agent

最低字段：

- id；
- name；
- role；
- status；
- currentTaskId；
- currentRoomId；
- activeToolIds；
- permissionScopes；
- runtimeId；
- workload；
- lastEventAt；
- blockedReason；
- approvalRequired。

### 10.2 Task

最低字段：

- id；
- title；
- description；
- status；
- priority；
- assigneeIds；
- dependencyIds；
- roomId；
- createdAt；
- startedAt；
- completedAt；
- artifactIds；
- approvalId；
- blockedReason。

### 10.3 Tool / Skill

最低字段：

- id；
- name；
- type；
- status；
- allowedAgentRoles；
- permissionRequirements；
- roomBindings；
- currentUserAgentId；
- approvalRequired。

### 10.4 Room

最低字段：

- id；
- name；
- type；
- bounds；
- policy；
- capacity；
- activeAgentIds；
- availableToolIds；
- visualState。

### 10.5 Artifact

最低字段：

- id；
- taskId；
- producerAgentId；
- type；
- title；
- status；
- uri 或 contentReference；
- version；
- createdAt；
- reviewResult；
- approvalState。

### 10.6 Event

所有真实变化必须通过事件表达。

### 10.7 Command

所有用户控制操作必须通过命令表达。

### 10.8 Approval

所有高风险操作必须具有明确审批对象、状态和审计记录。

---

## 11. 通用状态模型

### 11.1 Agent 状态

```text
offline
idle
planning
working
waiting
collaborating
reviewing
blocked
approval_required
paused
failed
completed
```

### 11.2 Task 状态

```text
created
queued
assigned
planning
running
waiting_dependency
waiting_approval
reviewing
revision_required
completed
failed
cancelled
```

### 11.3 Tool 状态

```text
available
in_use
restricted
approval_required
unavailable
failed
```

### 11.4 Artifact 状态

```text
draft
generated
under_review
revision_required
approved
rejected
delivered
```

Runtime 内部可以有更细状态，但接入 Agent Office 时必须映射到统一公共状态。

---

## 12. Event 协议

推荐统一事件包：

```ts
interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  timestamp: number;
  source: string;
  runtimeId: string;
  actorId?: string;
  taskId?: string;
  correlationId?: string;
  causationId?: string;
  payload: T;
}
```

第一版建议支持：

```text
runtime.connected
runtime.disconnected
agent.spawned
agent.status_changed
agent.room_changed
agent.paused
agent.resumed
agent.failed
agent.completed
task.created
task.assigned
task.started
task.blocked
task.waiting_approval
task.review_started
task.revision_required
task.completed
task.failed
tool.requested
tool.granted
tool.revoked
tool.invoked
tool.failed
artifact.created
artifact.updated
artifact.reviewed
artifact.approved
artifact.rejected
approval.requested
approval.granted
approval.rejected
message.sent
meeting.started
meeting.completed
error.raised
```

像素层不得自行推断业务事实。若没有对应事件，不得制造对应真实状态。

---

## 13. Command 协议

推荐统一命令包：

```ts
interface OfficeCommand<T = unknown> {
  commandId: string;
  commandType: string;
  timestamp: number;
  source: string;
  targetId?: string;
  actorId?: string;
  runtimeId: string;
  payload: T;
}
```

第一版建议支持：

```text
task.create
task.assign
task.pause
task.resume
task.cancel
task.change_priority
agent.pause
agent.resume
agent.terminate
agent.move
tool.grant
tool.revoke
approval.accept
approval.reject
meeting.create
message.send
artifact.open
artifact.accept
artifact.request_revision
```

所有 Command 必须经过：

```text
UI Action
→ Command Gateway
→ Policy Validation
→ Runtime Adapter
→ Runtime Execution
→ Runtime Event
→ Office Snapshot Update
```

前端操作不得直接修改 Runtime Snapshot。

---

## 14. Runtime Adapter

Agent Office 不得绑定某一个 Agent 框架。

推荐接口：

```ts
interface AgentRuntimeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  getSnapshot(): Promise<RuntimeSnapshot>;
  subscribe(handler: RuntimeEventHandler): Unsubscribe;
  execute(command: OfficeCommand): Promise<CommandResult>;
}
```

建议逐步实现：

```text
MockRuntimeAdapter
GenericSSEAdapter
GenericWebSocketAdapter
OpenClawAdapter
HermesAdapter
QClawAdapter
```

第一阶段不要求同时完成全部适配。

推荐顺序：

1. MockRuntimeAdapter；
2. GenericSSEAdapter 或 GenericWebSocketAdapter；
3. 一个真实项目 Adapter；
4. 再逐步扩展到 OpenClaw、Hermes 或其他 Runtime。

---

## 15. 第一版房间

第一版只需要一个小型完整办公室，不做大地图。

建议房间如下。

### 15.1 指挥室

职责：

- 创建任务；
- 查看全局状态；
- 高级审批；
- 调整任务优先级；
- 暂停、恢复和终止 Agent；
- 处理异常。

### 15.2 任务大厅

职责：

- 展示任务队列；
- 展示待分配、已分配、阻塞和失败任务；
- 允许拖拽或命令式分配；
- 调整优先级；
- 观察任务积压。

### 15.3 研究室

工具：

- Web Search；
- Browser；
- 文档读取；
- 知识库；
- 数据分析；
- Research Skill。

输出：

- ResearchArtifact；
- EvidenceBundle；
- SourceList；
- AnalysisDraft。

### 15.4 开发室

工具：

- Terminal；
- Code Editor；
- Git；
- Test Runner；
- Repository Search；
- Worktree。

约束：

- 推荐一个 Agent 一个独立工作区或 Worktree；
- 不允许默认直接修改受保护分支；
- 代码修改必须形成 Diff Artifact；
- 高风险写入需要审批。

### 15.5 会议室

职责：

- 多 Agent 讨论；
- 任务拆分；
- 方案对比；
- 冲突处理；
- 审计会诊；
- 形成行动项。

会议必须产生真实 Artifact，而不是仅播放围桌动画。

### 15.6 审查室

职责：

- 代码 Review；
- 文档 Review；
- 测试；
- 风险审查；
- 事实核验；
- 安全检查。

约束：

- 默认只读；
- 不允许静默修改原始产物；
- 修改要求必须生成 revision task；
- 输出应为 ReviewResult。

### 15.7 审批区

适用于：

- 正式写入；
- 代码合并；
- 删除资源；
- 发送邮件；
- 发布内容；
- 访问敏感目录；
- 使用高成本模型；
- 调用真实世界工具。

建议流程：

```text
Draft
→ Pending Approval
→ Confirmed
→ Executed
```

### 15.8 交付区

职责：

- 集中展示最终 Artifact；
- 版本对比；
- 接受；
- 退回；
- 导出；
- 传递给下游项目。

### 15.9 隔离区

职责：

- 放置异常 Agent；
- 阻断高风险工具；
- 暂停不受控任务；
- 等待人工接管；
- 保存错误现场与审计证据。

---

## 16. 操作系统属性

Agent Office 必须体现真实 Agent OS 能力。

至少包括：

- **进程管理**：Agent 启动、暂停、恢复、终止；
- **任务调度**：优先级、队列、依赖、分配；
- **资源管理**：模型额度、Token、工具、工作区、并发槽位；
- **权限控制**：文件、工具、外部系统、房间准入；
- **进程通信**：Agent 消息、会议、任务委托；
- **产物管理**：Artifact 生命周期、版本、审查与交付；
- **可观测性**：状态、事件、错误、日志、阻塞；
- **故障处理**：重试、降级、替换 Agent、人工接管；
- **隔离机制**：沙箱、Worktree、只读区、高风险区；
- **调度策略**：选择 Agent、模型、工具和工作区。

像素办公室必须服务于这些能力，而不能替代这些能力。

---

## 17. 第一版 MVP 范围

第一版采用小样本启动。

推荐范围：

- 3 个 Worker Agent；
- 1 个 Orchestrator；
- 6 至 8 个语义房间；
- 1 套通用 Event 协议；
- 1 套通用 Command 协议；
- 1 个 MockRuntimeAdapter；
- 1 个真实项目 Adapter；
- 支持 Snapshot 初始化；
- 支持 SSE 或 WebSocket 实时事件；
- 支持任务分配；
- 支持 Agent 状态显示；
- 支持 Tool 授权；
- 支持会议；
- 支持审查；
- 支持审批；
- 支持 Artifact 展示；
- 支持基础暂停、恢复和终止操作。

第一版的目标不是内容丰富，而是验证核心假设。

---

## 18. MVP 验证假设

### 18.1 状态理解

空间化界面能否比日志更快地让用户理解多 Agent 状态？

### 18.2 阻塞识别

用户能否通过空间位置、告警和关系快速发现阻塞？

### 18.3 权限理解

用户能否理解 Agent 当前拥有或缺少哪些工具与权限？

### 18.4 工作流理解

用户能否通过房间和任务流转理解工作流程？

### 18.5 中间产物发现

Artifact 是否比传统日志中的中间结果更容易被发现、打开和审查？

### 18.6 空间操作价值

空间操作是否真的降低认知负担，而不是增加额外步骤？

### 18.7 可嵌入性

Agent Office 是否能通过 Adapter 接入一个现有项目，而不要求重写 Runtime？

---

## 19. 第一版明确不做

第一版禁止扩展至以下内容：

- 开放世界；
- 世界探索；
- 战斗；
- 种植；
- 采矿；
- 经济系统；
- 角色成长；
- 好感度；
- 剧情系统；
- NPC 社交；
- 季节系统；
- 昼夜系统；
- 自动生成地图；
- 大规模城市模拟；
- 复杂路径规划；
- LLM 直接控制角色坐标；
- LLM 绕过规则引擎修改世界；
- 无法映射真实 Runtime 的装饰性复杂功能。

若某项功能不服务于 Agent 状态理解、权限、工具、工作流、Artifact 或治理，不应进入 MVP。

---

## 20. 架构建议

建议项目按以下模块组织：

```text
agent-office/
├── AGENT.md
├── README.md
├── docs/
│   ├── architecture/
│   ├── protocols/
│   ├── research/
│   ├── product/
│   └── decisions/
├── packages/
│   ├── agent-office-core/
│   ├── agent-office-protocol/
│   ├── agent-office-ui/
│   ├── agent-office-pixel/
│   ├── agent-office-adapter/
│   └── agent-office-sdk/
├── adapters/
│   ├── mock/
│   ├── generic-sse/
│   ├── generic-websocket/
│   ├── openclaw/
│   └── hermes/
├── apps/
│   ├── demo-office/
│   └── adapter-playground/
├── tests/
├── assets/
└── examples/
```

目录可根据实际技术栈调整，但必须保持以下逻辑边界：

- Protocol 独立；
- Core 独立；
- Adapter 独立；
- Pixel 表现层不得侵入 Runtime；
- UI 不得直接依赖某一个 Runtime；
- 真实业务状态不得存放在动画组件中。

---

## 21. 技术原则

### 21.1 Event-driven

所有真实状态变化应通过 Event 驱动。

### 21.2 Snapshot + Incremental Events

推荐采用：

```text
Initial Snapshot
+ Incremental Events
= Current Office State
```

### 21.3 Deterministic Core

核心状态更新必须可预测、可重放、可测试。

### 21.4 Adapter Isolation

每个 Runtime 差异必须限制在 Adapter 内，不得污染公共协议。

### 21.5 Policy before Execution

命令执行前必须经过权限、房间和审批策略校验。

### 21.6 Auditability

关键控制操作必须保留审计记录。

### 21.7 No Hidden Mutation

任何 Task、Agent、Tool、Artifact、Approval 状态变化都不得静默发生。

### 21.8 Embeddability First

所有设计必须优先考虑作为组件接入其他项目，而不是只在 Demo 中运行。

---

## 22. 开发约束

进入项目工作的 Agent 必须遵守以下约束。

### 22.1 开始开发前

必须先确认：

- 当前任务属于哪一个模块；
- 是否修改公共协议；
- 是否影响 Adapter；
- 是否影响 Runtime 真相状态；
- 是否需要新增 Event；
- 是否需要新增 Command；
- 是否涉及权限或审批；
- 是否影响可嵌入性。

### 22.2 修改协议时

必须同时检查：

- 向后兼容性；
- Snapshot；
- Event；
- Command；
- Mock Adapter；
- 测试；
- 文档。

### 22.3 修改 UI 时

必须说明该视觉元素映射的 Runtime 概念。

若无法说明，则该元素只能属于 Ambient State，不得影响用户对真实状态的判断。

### 22.4 修改房间时

必须同时定义：

- 视觉语义；
- 工具集合；
- 权限集合；
- 输入类型；
- 输出类型；
- 审批规则；
- 并发限制；
- 软映射规则；
- 硬编排规则。

### 22.5 修改控制操作时

必须经过：

```text
Command
→ Policy Validation
→ Adapter
→ Runtime
→ Event
→ Snapshot
```

禁止跳过链路。

---

## 23. 安全与治理原则

- 高风险操作必须显式审批；
- 运行时权限不得由像素前端自行决定；
- 房间只能表达和申请权限，最终授权由 Control Core 与 Runtime Adapter 执行；
- 所有审批必须有目标、原因、范围、过期时间和审计记录；
- Agent 不得因为进入某个视觉区域而自动获得未校验权限；
- 隔离区必须能阻断外部工具和写入权限；
- 删除、发布、发送、合并、正式写入等操作默认视为高风险；
- 任何异常恢复操作都必须保留现场信息。

---

## 24. 参考系统

本项目可以参考 OpenClaw、Hermes 及其他成熟 Agent Runtime 的：

- Agent 生命周期；
- Task 生命周期；
- Tool 调用；
- Runtime Event；
- 人工审批；
- 多 Agent 协作；
- Artifact 输出；
- 错误与重试；
- 长期任务执行；
- Runtime Store；
- SSE / WebSocket 推送。

但不得直接将 Agent Office 绑定到其中任何一个系统。

参考目标是抽象成熟流程，而不是复制具体内部实现。

---

## 25. 研究方向

后续 Deep Research 应重点回答：

### 25.1 玩法与交互

- 如何将 Agent Runtime 状态映射为空间对象；
- 如何表达依赖、阻塞、协作和审查；
- 哪些空间操作真正降低认知负担；
- 哪些游戏化设计会干扰效率；
- 如何设计多 Agent 密集状态下的视觉层级；
- 如何表达 Artifact、权限和 Tool；
- 如何避免像素世界退化为日志动画。

### 25.2 技术实现

- Agent Runtime Adapter 的最佳抽象；
- Snapshot 与 Event Store 的关系；
- SSE、WebSocket 与 Event Sourcing 的选择；
- RoomPolicy 如何映射真实权限；
- 如何实现可重放、可审计和可恢复；
- 如何设计前端状态机；
- 如何支持嵌入式 SDK；
- 如何兼容 OpenClaw 与 Hermes；
- Godot、Unity、PixiJS、Phaser 或 Web Canvas 的技术取舍；
- 多项目、多 Runtime、多房间的扩展边界。

### 25.3 可用性验证

- 空间化是否比日志更高效；
- 用户能否快速发现阻塞；
- 用户能否理解权限和工具状态；
- 空间控制是否比表单更直观；
- 如何设计对照实验与可量化指标。

---

## 26. 重大设计判断标准

任何重大功能在进入开发前，必须回答以下问题：

1. 它映射了哪个真实 Agent Runtime 概念？
2. 它提升了空间化、直觉化、具象化或可治理性中的哪一项？
3. 它是显示层能力，还是控制层能力？
4. 它是否改变真实权限、工具或工作流？
5. 它是否需要新增 Event 或 Command？
6. 它是否破坏可嵌入性？
7. 它是否要求绑定某一个 Runtime？
8. 它是否会误导用户对真实执行状态的判断？
9. 它是否应该进入 MVP？
10. 去掉像素美术后，该能力是否仍然具有操作系统价值？

若第 10 个问题的答案是否定的，该功能原则上不应成为核心能力。

---

## 27. 当前阶段结论

当前阶段已锁定以下方向：

1. 项目不是游戏；
2. 项目是可执行 Agent 作战室；
3. 像素沙盒是视觉与交互语言；
4. 系统同时展示状态并参与权限、工具和工作流编排；
5. Runtime 是执行真相源；
6. Agent Office 是统一控制面；
7. 房间具有视觉语义和执行语义；
8. 系统同时支持软映射和硬编排；
9. 通过 Adapter 接入不同 Runtime；
10. 第一版采用小样本启动；
11. 第一版只做一个完整小型办公室；
12. 第一版优先验证状态理解、阻塞识别、权限理解、Artifact 可见性和真实控制；
13. 完成 MVP 后，再进行 OpenClaw、Hermes 与其他项目的适配。

---

## 28. 一句话定义

> Agent Office 是一个可嵌入的、事件驱动的、空间化 Agent Runtime 操作界面。它使用像素沙盒世界作为视觉与交互语言，将 Agent、任务、工具、权限、Artifact、审批与协作关系转化为可观察、可理解、可干预和可治理的执行作战室。

