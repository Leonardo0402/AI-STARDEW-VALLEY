# AI-像素 Agent Office 深度研究报告

## 结论先行

这类产品最值得做的方向，不是“把 Agent 做成一群会走路的像素小人”，而是把 **真实 Runtime 的状态、约束、审批、权限、产物与协作关系** 投影成一个可操作的空间，并让空间本身反过来约束执行。公开资料显示，当前市场上最成熟的是 **文本/面板式 Agent 控制面**，例如 Claude Code 的 subagents、Agent View 与 Agent Teams，Codex 的 sandbox、approvals、cloud environments 与 app-server 事件流，OpenClaw 的 workspace、session、routing、hooks 与 MCP/ACP 桥接；而像素办公室项目大多还停留在 **状态可视化** 或 **轻量任务交互**，距离“空间真实参与执行”仍有明显差距。Claude Code 已支持以独立上下文、独立权限运行子智能体，并能在 Agent View 中调度后台会话；Codex 能在容器化环境中根据 sandbox 与 approval policy 执行任务，并通过 app-server 输出流式 agent events；OpenClaw 则提供会话路由、workspace、hooks、MCP/ACP 桥接和插件式 runtime 扩展。相反，Pixel Agents、Star-Office-UI、Agent Town 等像素项目，虽然证明了“空间化表达”很有吸引力，但公开证据也表明它们多数尚未把 **房间策略、权限租约、Artifact 合同、审批状态机** 绑定为 Runtime 的硬约束。citeturn16view1turn22view0turn22view1turn16view0turn16view2turn23search20turn32search5turn16view5turn16view7turn16view8turn22view3turn22view4turn26search3turn26search1turn26search2

因此，本项目的正确产品定义应当是：

**一个可嵌入其他 Agent 项目的、事件驱动的、空间化 Agent Runtime 操作系统前台。**

它不是游戏壳，不是可爱 UI，也不是单纯看板。它应当把以下几类对象统一成一个 **空间控制面**：Agent、Task、Tool、Memory、Artifact、Approval、Budget、Permission、Workflow、Exception。其关键创新点不是“角色会动”，而是 **RoomPolicy + Capability Lease + Append-only Event Log + Snapshot Projection**：房间决定能做什么，权限租约决定可以做多久，事件流决定事实是什么，空间只是对这些事实做高信息密度投影。Temporal 的 “Command → Event History” 模型、LangGraph/Dify/n8n 的 durable HITL、Dagster 的 artifact/materialization 视角，都说明“可恢复、可审计、可暂停、可回放”的控制逻辑必须先成立，空间 UI 才真正有价值。citeturn17search0turn17search4turn17search8turn17search13turn17search16turn24search1turn24search4turn24search7turn24search0turn24search9turn17search1turn17search5turn17search14

我给出的最终建议是：

- **推荐产品形态**：嵌入式“可执行作战室”，而不是独立开放世界。
- **推荐交互模型**：空间优先观察 + 面板精确控制 的“双层交互”。
- **推荐 RoomPolicy 模型**：房间绑定工具、上下文、工区、预算、网络、审批与 Artifact 合同。
- **推荐权限模型**：人类侧 RBAC，Agent 侧 capability lease，环境侧 ABAC 风险判定，统一交给 policy engine。
- **推荐前端技术栈**：React + PixiJS + React Aria + TanStack Table。
- **推荐实时通信方案**：HTTP Snapshot 拉起 + SSE 增量事件流 + REST/Command Gateway。
- **推荐后端架构**：TypeScript 模块化控制平面，append-only event log + materialized snapshot。
- **推荐首个真实 Runtime**：OpenClaw Adapter。
- **推荐首个 MVP**：一个 Orchestrator、三个 Worker、八个语义房间、一个 MockRuntimeAdapter、一个 OpenClaw Adapter。citeturn27search1turn27search6turn27search15turn29search1turn29search13turn29search12turn15search0turn15search1turn15search2turn27search2turn27search3turn16view5turn16view7turn16view8turn22view3turn22view4

## 项目定义与成熟度模型

### 研究边界

根据你给出的项目上下文，这个系统首先是 **Agent Runtime 的空间控制面**，不是游戏，也不是只给 Agent 套一层“办公室皮肤”。为了避免跑偏，本报告把研究边界锁定为四件事：一是 Agent 如何被空间外化；二是空间如何反向参与真实执行；三是如何以最小协议接入异构 Runtime；四是如何证明这种空间化控制面比传统 Dashboard 更好。出于当前可访问上下文限制，我没有在可访问文件中得到项目 `AGENT.md` 正文，因此以下结论严格以内文提示的产品定义为最高边界，并把 `AGENT.md` 的具体约束列入最后的未决项。  

### Agent 外化成熟度模型

为了避免把所有产品混成一张“功能勾选表”，我建议把“Agent 外化成熟度”定义为六级：

| 级别 | 定义 | 是否有真实控制 | 典型代表 |
|---|---|---:|---|
| 日志终端层 | 只能看到对话、终端、工具调用或日志 | 弱 | Claude Code、Codex CLI、Hermes |
| 面板控制层 | 有任务/会话/审批/权限面板，但没有空间语义 | 强 | Claude Code Agent View、Codex Web、腾讯 ADP、阿里 AgentRun |
| 空间状态层 | Agent 被投影为角色/房间/站位，主要表达状态 | 弱到中 | Pixel Agents、Star-Office-UI |
| 空间操作层 | 可以在空间里派发任务、组织协作或处理审批 | 中 | Agent Town |
| 空间策略层 | 房间真实绑定权限、工具、上下文、预算与 I/O 合同 | 强 | 公开产品中几乎未见成熟实现 |
| 可嵌入 Agent OS 层 | 有统一协议、Adapter、事件历史、审计、资源治理、多 Runtime 接入 | 很强 | 公开产品中仍属空白带 |

这个分级的关键是：**不是看产品功能多少，而是看“空间是否拥有运行时权能”**。如果空间只是看板，再炫也只是“空间状态层”；如果空间能改变工具挂载、上下文域、审批要求与预算上限，它才开始进入“空间策略层”。Temporal 把 Command 明确映射为 Event History；LangGraph、Dify、n8n 都把暂停、审批、恢复建成 durable 执行语义；这些成熟系统提醒我们，真正的高成熟度不是动画，而是 **可恢复的控制语义**。citeturn17search4turn17search8turn17search13turn24search1turn24search4turn24search7turn24search0turn24search9

### 样本放入模型后的判断

从公开证据看，**Claude Code、Codex、Hermes、Kimi Agent、腾讯 ADP、阿里百炼、AgentRun、AgentBay 这些系统，大多停留在“日志终端层”或“面板控制层”；Pixel Agents、Star-Office-UI 进入了“空间状态层”；Agent Town 进入了“空间操作层”；几乎没有公开产品真正做到“空间策略层”，更没有稳定走到“可嵌入 Agent OS 层”。** 这恰恰说明本项目的战略空间真实存在。citeturn16view1turn22view0turn16view0turn16view2turn22view2turn8view1turn13search6turn8view6turn8view7turn8view8turn10view1turn26search3turn26search1turn26search2

## 市场、平台与开源项目调研

### Agent Runtime 与控制系统

**OpenClaw** 的价值不在“像素办公室”，而在它已经有相当完整的运行底座：workspace 是默认工作目录，session 有明确路由语义，routing bindings 可以把外部流量绑定到特定 agent，hooks 可以拦截网关生命周期与命令事件，MCP/ACP 桥可以把会话暴露给外部客户端，Codex harness 还能把 OpenAI 的 app-server 接入 OpenClaw。公开文档同时说明一个现实问题：OpenClaw 的默认 workspace 不是硬沙箱，真正隔离需要显式开启 sandbox；另外，现有 hooks 的公开能力更多是 lifecycle/command 侧，社区 issue 里还在请求更细粒度的 `tool:before` / `tool:after` 事件，这意味着它很适合作为 **首个可真实接入的 Runtime**，但还不该被直接当成最终的多 Agent OS。citeturn16view5turn16view6turn16view7turn16view8turn22view3turn22view4turn12search15turn21search3turn32search9

**Claude Code** 在“控制语义”上已经很成熟。官方文档明确说明：subagents 拥有独立上下文窗口、独立工具访问与独立权限；Agent View 可以从一个界面调度和监控多个后台会话；Agent Teams 允许 lead session 协调多个 teammate，并通过共享任务与消息协作；权限系统支持 deny/ask/allow，且 deny 优先于 ask，ask 优先于 allow。这些机制说明 Claude Code 不是空间化产品，但它已经接近一个可编程的 agent control plane。对本项目最重要的启发，不是复制它的终端 UI，而是复用它证明过的 **并发会话 + 权限分层 + 子智能体隔离** 模式。citeturn16view1turn22view0turn22view1turn16view0turn22view5turn20search10

**Codex** 的 strengths 很清楚：sandbox 与 approval policy 明确区分技术边界和审批边界；cloud tasks 在容器里 checkout repo、跑 setup script、再按联网策略执行 agent loop；如果 repo 里有 `AGENTS.md`，Codex 会据此寻找项目特定命令；app-server 则能输出 `turn/started`、`item/started`、`item/completed`、tool progress 等流式事件。这种事件化控制面非常适合做 Adapter，因为它天然给出了 “thread / turn / item / approval / tool result” 这类结构化信号。它的不足在于：产品强绑定编码场景，适合做高质量参考实现，但不应成为本项目的唯一世界观。citeturn16view2turn16view3turn22view2turn23search0turn32search5turn12search0turn23search20

**Hermes Agent** 的公开定位是“带内建学习循环的自我改进 Agent”，能从经验中创建 skill、改进 skill、持久化知识，并且在 MCP 接入上支持运行时过滤工具。它非常适合给本项目提供 “Memory / Skill / Self-improvement” 的研究样本，但从公开材料看，它当前的外化形态仍以 CLI/文档为主，不是空间式控制面。对 Agent Office 来说，Hermes 更像将来可接入的“自成长型 Runtime”，而不是 MVP 的首选基座。citeturn8view1turn11search3turn11search15

**Kimi Agent / Agent Swarm** 的公开表述已经把“动态分解任务、并发执行异构子任务、自创建领域子 Agent”写得很明确，Kimi API 也把 agent tasks 作为正式能力来讲，Kimi CLI 与 Kimi Agent SDK 则表明 Moonshot 在把模型能力外溢到 Agent 运行时。可问题是：公开官方文档里，真正面向第三方产品集成的“控制协议、审批状态、工具权限、事件流”仍不如 Codex/Claude/OpenClaw 清晰。因此 Kimi 更适合做 **模型/Agent 引擎接入目标**，不适合成为 Agent Office 的第一条主适配路径。citeturn13search2turn13search6turn13search14turn13search15turn13search12turn13search13

**腾讯云 ADP、阿里云百炼、AgentRun、AgentBay** 都提供了明显更“平台化”的能力。腾讯 ADP 明确提供 LLM+RAG、Workflow、Multi-agent 和“智能工作台”；阿里百炼的 workflow 文档已经公开“智能体群组”节点，由决策模型自动规划任务并调度子智能体；AgentRun 则把自己定义为“Agentic AI 的云原生运行底座 + 沙箱平台 + 模型治理与工具生态 + 安全与可观测能力”；AgentBay 则提供 browser / code space / cloud computer / mobile 四种隔离执行环境，并强调 VPC 隔离、network policy、allowlist/blocklist、session isolation。这些产品给本项目最大的启发，是 **房间＝执行环境类型** 完全可以做成现实：浏览器房、代码房、桌面房、移动房，不只是美术设定，而是不同执行底座的空间映射。citeturn8view6turn11search7turn8view7turn8view8turn10view1turn10view2

### 像素办公室与空间外化项目

**Pixel Agents** 已经证明“像素办公室 + Claude Code”能形成很强的直觉反馈：角色会走动、打字、等待授权、坐在不同座位；它也支持 VS Code 扩展和独立 CLI，两者共用一套 typed `HookProvider` 集成边界，并且已有“权限提示更醒目”“跳过权限模式”等 issue / release 证据。但它的核心仍是 **行为映射**，不是 **治理控制**。它甚至支持通过 `--dangerously-skip-permissions` 绕过所有工具审批，这恰好说明：如果没有独立的 policy plane，空间 UI 很容易沦为“更好看的危险开关”。citeturn26search3turn18search11turn26search0turn26search5

**Star-Office-UI** 的优势在于极低门槛和很强的“读房间”能力：它既能配合 OpenClaw 自动同步状态，也能在没有 OpenClaw 时用 `set_state.py` 或 API 手工推状态，说明它本质上更像 **状态仪表盘**。这类设计很适合作为软映射原型，但公开资料同样表明它的主状态源是 `state.json` 和类似磁盘文件，这意味着它距离 RoomPolicy、Artifact contract、Approval state machine 还有明显距离。对本项目而言，Star-Office-UI 最有价值的不是功能，而是它证明：**用户确实愿意用空间方式读 Runtime**。citeturn26search1turn35search0turn26search6turn35search20

**Agent Town** 比前两者更接近本项目目标，因为它把空间从“看状态”推进到了“做交互”：用户可以走到 worker 面前做 RPG 式任务分配，任务走过 `queued > returning > sending > running > done/failed` 生命周期，聊天面板还能折叠工具调用。这已经进入“空间操作层”。但它的公开目标仍然包括共享在线世界、技能市场、任务经济，这些方向在当前阶段会把本项目带偏。对你来说，应该借鉴它的 **面对面任务派发、空间中断点明显可见、生命周期可读**，而不是借鉴它的“世界化野心”。citeturn26search2

### 编排、审批与可观测性参照物

LangGraph 把 durable execution、streaming、human-in-the-loop 写在核心定位里；其 HITL middleware 会在需要人工审查的工具调用前发出 interrupt，暂停执行并等待决定。Dify 的 Human Input 节点已经支持暂停、人工编辑、Approve/Reject/Escalate 分支。n8n 也公开了“在 AI Agent 执行某个工具前要求人工审批”的模式。Temporal 更进一步，把 worker 发出的 Command 变成持久化 Event History，并依靠历史重放支撑可恢复执行。Dagster 则把 artifact/asset materialization 作为一等对象。对 Agent Office 来说，这些产品不是要照抄，而是告诉我们：**审批必须是暂停点，Artifact 必须是对象，恢复必须基于事件历史，而不是 based on UI memo**。citeturn24search1turn24search4turn24search7turn24search0turn24search9turn17search0turn17search4turn17search12turn17search13turn17search1turn17search5

## 值得借鉴的设计与反面案例

### 真正值得借鉴的设计

第一类值得借鉴的是 **独立上下文与独立权限**。Claude Code 明确把 subagents 设计成独立 context window、独立 tool access、独立 permissions；Agent Teams 又允许 team lead 与 teammate 分离协作。这个设计非常适合映射为办公室里的“研究室 agent”“开发室 agent”“审查室 agent”：房间不是角色皮肤，而是不同权限与上下文域的载体。citeturn16view1turn22view1

第二类值得借鉴的是 **环境边界先于审批边界**。Codex 官方文档明确强调 sandbox 定义技术边界，approval policy 定义何时必须停下来请求人类介入；在 cloud tasks 中，repo checkout、setup script、联网策略、agent internet access 也都是环境级控制。AgentBay 的 browser / code space / cloud computer / mobile use 则更直白地把环境类别做成产品面。对 Agent Office 来说，这直接对应“房间策略”：浏览器房默认只能 web automation，代码房默认能编译测试，审批房不能联网，隔离房只能读不能写。citeturn16view2turn23search20turn22view2turn10view1

第三类值得借鉴的是 **结构化事件历史**。Temporal 的 Command→Event History、Codex app-server 的 turn/item stream、OpenClaw 的 session/hook/MCP live queue，都证明了控制面如果拿不到结构化事件，就只能读日志拼图，空间一定会失步。Agent Office 必须站在 adapter 之上，只接受标准化 DomainEvent，而不是直接解析终端文本。citeturn17search4turn17search8turn17search16turn32search5turn22view3turn16view8

第四类值得借鉴的是 **Artifact 一等公民**。Dagster 的 asset materialization、Dify/n8n/LangGraph 的 pause-resume 机制，都说明系统不该只关心“Agent 说了什么”，还要关心“产出了什么”“状态是什么”“是否可交付”“需要谁批准”。这正是办公室里文件柜、审查台、交付台存在的理由。citeturn17search1turn17search14turn24search0turn24search9turn24search7

### 必须明确避开的反面案例

第一种反面案例是 **仅把状态翻译成动画**。Star-Office-UI 与 Pixel Agents 很好看，也能显著降低“AI 在黑盒里干什么”的不透明感，但如果状态源只是 `state.json` 或 HookProvider 自报的轻量行为，再多家具也只是“会动的监控器”。这类设计可作为灵感，不可作为终局。citeturn26search1turn35search0turn26search3

第二种反面案例是 **把高风险权限藏进便捷开关**。Pixel Agents 已出现“绕过所有权限提示”的 bypass mode；这类设计在 demo 场景里看似提效，实际会击穿最重要的治理边界。本项目必须反过来做：任何高风险能力都应该在空间中变得更显眼，而不是更隐蔽。citeturn26search5turn26search0

第三种反面案例是 **把空间交互当成表单替代品而非认知压缩器**。如果用户拖拽一个 Agent 到开发室，背后只是发了一串和普通下拉框完全一样的参数，这个拖拽就是多余步骤。空间交互只有在表达“位置＝约束＝关系＝状态变化”时才值得保留。Agent Town 的“走过去交谈式派单”在少量 worker 时很有价值；但对于批量参数修改、预算上调、策略 debug，表单和侧边面板仍然应该保留。citeturn26search2turn29search1turn29search13turn29search4

## Agent Office 核心交互模型

### 推荐的空间交互模型

我建议采用 **空间观察层 + 侧边控制层 + 审批抽屉层** 的三层模型。

空间层负责回答四个高频问题：谁在干活、在哪个阶段、卡在哪里、谁和谁在协作。这里显示的是角色、房间、连线、任务卡、Artifact 流向、审批闪点、预算热度、资源争用。  
侧边控制层负责精确修改结构化对象：Task 字段、预算、优先级、RoomPolicy、工具授权、上下文集、审批规则。  
审批抽屉层只在高风险动作或交付动作时出现，展示拟执行命令、风险说明、所需权限、受影响 Artifact、审计记录链接。  
这样的分层能利用空间的“快速读态势”优势，又避免把所有复杂参数挤进像素世界里。Claude Code 的 Agent View 与 GitHub agent sessions 证明“集中看多个后台会话的状态”是高频需求；而 GitHub 也已经把 agent sessions、tokens、logs、status 直接带入 issues 和 projects 里，进一步证明人类首先要的是 **少滚日志，快定位**。citeturn22view0turn33search1turn33search5turn33search3turn33search13

### RoomPolicy 的落地设计

RoomPolicy 不能只是前端配置，它必须同时作用于 **UI 表达** 和 **Runtime 执行**。建议至少包含这些字段：

- allowedAgentRoles  
- requiredCapabilities  
- toolAllowlist / toolDenylist  
- dataScopes / memoryScopes  
- workspaceMode / worktreeId  
- inputArtifactTypes / outputArtifactTypes  
- maxConcurrency  
- tokenBudget / timeBudget / costBudget  
- networkPolicy  
- approvalPolicy  
- exitConditions  
- failurePolicy  
- auditPolicy  

其中，**视觉映射** 包括：角色进入房间后外观变化、房间高亮、路径动线、任务卡栈、连线颜色。  
**真实影响 Runtime** 的字段包括：工具挂载、目录/worktree 切换、上下文裁剪、网络开关、预算上限、审批触发阈值、并发限制、允许输出的 Artifact 类型。  
如果进入研究室只是在画面上站到书架旁边，那是假进入；如果进入研究室后只剩检索工具、只能读取课程资料、不能写回外部系统，并且输出只能是“ResearchNote / EvidencePack”，那才是真进入。Codex 的 sandbox、approval policy 与 cloud environment，AgentBay 的 isolated environment / network policy / allowlist，OpenClaw 的 workspace/sandbox 分离，都为这种设计提供了现实参照。citeturn16view2turn23search20turn22view2turn10view1turn16view5turn16view4

### 软映射与硬编排

这两种进入方式必须并存。

**软进入**：Runtime 已经在外部系统里启动并执行，Agent Office 只把现有 Agent/Task 空间化映射到房间中。它适合兼容既有项目，也适合接入那些无法立即被你控制 sandbox/permission 的 Runtime。Pixel Agents 和 Star-Office-UI 本质上都更偏这种模式。citeturn26search3turn26search1

**硬进入**：任务必须先被分配房间、验证 RoomPolicy、挂载能力与工区，才能真正开始执行。它适合高风险写操作、外部系统写回、代码修改、提交 Artifact、联网工具调用等场景。Codex 的 sandbox/approval、Claude Code 的独立 tool access / independent permissions、n8n / LangGraph / Dify 的 pause-resume 审批模式，都说明这种“先过控制面，再放执行”是可行且必要的。citeturn16view1turn16view0turn16view2turn24search4turn24search7turn24search0turn24search9

共存方式很简单：  
对既有项目，默认 **软进入**，只做观察和弱控制。  
对 Office 原生发起的任务，以及任何涉及高风险能力的任务，必须 **硬进入**。  
空间动画不能阻塞真实任务，因此 UI 只消费事件，不驱动真实执行时钟；如果 UI 掉帧或断连，Runtime 继续跑，恢复后依靠 snapshot + incremental events 重建。SSE 的 `id` / `Last-Event-ID` 机制天然适合这种断线续接；真正需要双向长连接的场景只保留给本地 harness 或特殊远控。citeturn15search0turn15search2turn27search2turn27search3turn14search6turn27search9

### 权限模型的最终推荐

单一 RBAC 不够，单一 ABAC 也太重，纯 capability model 又不好做人工治理。MVP 最适合的是：

**人类采用 RBAC，Agent 执行采用 capability lease，风险判断采用 ABAC，上层由 policy engine 统一决策。**

- RBAC 用来区分人类身份：owner、operator、reviewer、viewer。NIST 对 RBAC 的定义正是“把权限绑到角色而不是个体”。citeturn37search2turn37search11turn37search23
- Capability lease 用来发放 Agent 的临时可执行权，例如 `use_tool:web.search`、`write_artifact:study_plan`、`workspace:math-plan-wt2`，带上 ttl、scope、issuer、budget。这样最符合 Agent 运行时“短期、任务态、可撤销”的特征。
- ABAC 用来加入上下文条件：时间、风险等级、是否在校园网、是否处于审批后状态、目标房间是否允许联网、当前预算是否超阈值。
- Policy engine 用 OPA 或 Cedar 一类引擎实现，前者擅长通用策略即代码，后者专注授权策略，都能把应用逻辑和授权逻辑解耦。citeturn37search0turn37search9turn37search24turn37search1turn37search7turn37search13

MVP 不建议一上来做全量 OPA 集群治理；但至少要把 **决策接口** 独立出来，让 RoomPolicy 校验、tool allow/deny、approval trigger、budget check 都走同一个决策面。这样后续才能从内嵌判断迁移到正式策略引擎，而不会重写整套系统。  

## 推荐技术架构

### 前端主技术栈

我只推荐一套 MVP 主栈：

**React + PixiJS + pixi-react + React Aria + TanStack Table。**

原因很直接。PixiJS 的强项是高性能 2D sprite/rendering，并且官方强调其是轻量的 2D 图形库；pixi-react 已经把 PixiJS 和 React 的协作做成成熟路线。相比之下，Phaser 虽然 tilemap 和“游戏场景”更强，官方也有 React template，但 Phaser 的心智模型仍然是 game loop + scene，做嵌入式业务控制面时，往往需要绕回 React/DOM 再实现大量表单、表格、对话框与权限面板。Godot 和 Unity 的 Web 导出当然可行，但包体、调试链路、前端集成、SDK 化与无障碍协同都会更重。另一方面，MDN 明确提醒 `<canvas>` 本身缺乏语义，不能替代可访问 DOM，因此空间渲染必须和 React/ARIA 面板共存，而不是整站 all-canvas。citeturn27search15turn27search1turn27search6turn27search5turn27search10turn14search0turn14search2turn14search3turn14search4turn29search5turn29search1turn29search13turn29search12

所以，正确拆法是：

- **PixiJS 层**：办公室场景、角色、房间热区、连线、动线、告警闪点。
- **React DOM 层**：任务侧栏、Artifact 预览、审批抽屉、策略表单、日志回放、无障碍替代表达。
- **React Aria / 语义 DOM**：键盘导航、对话框焦点管理、屏幕阅读器可达性。
- **TanStack Table**：任务/事件/Artifact 的高密度表格视图。citeturn29search1turn29search10turn29search12turn29search4

### 数据同步与事件模型

推荐方案是：

**HTTP 获取 Snapshot，SSE 订阅增量 DomainEvent，REST/Command Gateway 下发命令，后端保存 append-only event log，并为 UI 维护 materialized snapshots。**

为什么不是默认 WebSocket？因为 Agent Office 的高频场景是 **服务端持续推送状态，客户端偶尔发命令**。SSE 是单向、浏览器原生、协议简单，支持事件 `id` 与重连时的 `Last-Event-ID`，很适合“控制台订阅运行态”；WebSocket 仍然保留给本地 harness、IDE bridge 或需要双向流式输入的场景。轮询只作为降级。CRDT 对 MVP 没必要，因为这里不是多人共同编辑 office 世界，而是中心化 runtime facts 的投影。citeturn15search1turn15search2turn15search0turn27search2turn27search3turn27search7turn14search6turn27search9

建议的重建规则是：

- 首次连接：`GET /snapshot`
- 实时订阅：`GET /events?after=<snapshot.lastEventId>`
- 断线重连：浏览器自动带 `Last-Event-ID`，服务端从 event log 重放后续事件
- 去重：按 `eventId`
- 顺序：按单 runtime 的单调游标；多 runtime 只保证各自单调，不假装给出全球严格时序
- 丢失事件：若游标过旧或事件已裁剪，服务端返回需重新拉完整 snapshot
- 历史回放：从 event log 重放到某个时刻，再投影为 replay snapshot
- 审计：审计日志与运行事件共享 tracing id / task id / approval id / artifact id

用 Temporal 的 event history 作为思想参照，用 OpenTelemetry 统一 traces / metrics / logs，是一条相对稳妥的路线。OTel 官方文档明确把 traces、metrics、logs 视为统一可关联信号，并支持通用 collector/pipeline。citeturn17search0turn17search4turn17search16turn28search0turn28search1turn28search2turn28search4

### 核心模块、协议与状态机

推荐核心模块如下：

- **Runtime Adapter**：把 OpenClaw、Codex app-server、Claude Agent SDK、未来 Kimi/ADP/百炼的原生事件转成统一协议。
- **Event Normalizer**：清洗 runtime-specific 事件，生成标准 DomainEvent。
- **Runtime Store**：保存 snapshots 与 event log。
- **Command Gateway**：接收 UI 命令，做鉴权、幂等和排队。
- **Policy Engine**：检查 RoomPolicy、tool grant、budget、approval requirement。
- **Approval Service**：挂起、批准、拒绝、补充信息、超时处理。
- **Artifact Registry**：管理草稿、待审、已批准、已交付的产物元数据和内容地址。
- **Workspace Manager**：负责 worktree / sandbox / working directory / memory scope。
- **Resource Manager**：预算、token、时间、并发、模型额度。
- **Office Projection**：把 snapshots 投影成空间对象。
- **Pixel Renderer**：PixiJS 渲染层。
- **Control Panel**：精确控制 UI。
- **Replay / Debugger**：基于事件历史回放。  

下面给出一套最小可用 TypeScript 协议示例，重点是 **结构与边界**，不是完整代码库：

```ts
type Id = string;

interface RuntimeSnapshot {
  runtimeId: Id;
  version: number;
  lastEventId: Id;
  agents: AgentSnapshot[];
  tasks: TaskSnapshot[];
  artifacts: ArtifactSnapshot[];
  approvals: ApprovalSnapshot[];
  rooms: RoomSnapshot[];
  budgets: BudgetSnapshot[];
}

interface AgentSnapshot {
  agentId: Id;
  role: "orchestrator" | "researcher" | "builder" | "reviewer" | "analyst";
  state: "idle" | "assigned" | "moving" | "running" | "waiting_approval" | "blocked" | "failed" | "paused" | "isolated" | "done";
  roomId?: Id;
  currentTaskId?: Id;
  capabilityLeases: ToolGrant[];
  contextScopes: string[];
  workspaceRef?: string;
}

interface TaskSnapshot {
  taskId: Id;
  parentTaskId?: Id;
  kind: "research" | "analysis" | "build" | "review" | "approval" | "delivery";
  state: "created" | "ready" | "dispatched" | "running" | "blocked" | "waiting_approval" | "rework" | "completed" | "failed" | "cancelled";
  assignedAgentId?: Id;
  roomId?: Id;
  inputArtifacts: Id[];
  outputArtifacts: Id[];
  priority: "low" | "normal" | "high" | "urgent";
}

interface RoomPolicy {
  roomId: Id;
  allowedRoles: string[];
  requiredCapabilities?: string[];
  toolAllowlist: string[];
  toolDenylist: string[];
  memoryScopes: string[];
  workspaceMode: "shared" | "isolated" | "worktree";
  inputArtifactTypes: string[];
  outputArtifactTypes: string[];
  maxConcurrency: number;
  tokenBudget?: number;
  timeBudgetSec?: number;
  costBudgetUsd?: number;
  network: "none" | "limited" | "full";
  approval: "none" | "on_write" | "on_external_effect" | "always";
  exitConditions: string[];
  failurePolicy: "retry" | "rollback" | "handoff" | "isolate";
  auditLevel: "basic" | "full";
}

interface ToolGrant {
  grantId: Id;
  principalId: Id;
  capability: string;
  scope: Record<string, string>;
  expiresAt: string;
  issuedBy: Id;
  state: "requested" | "active" | "expired" | "revoked" | "denied";
}

interface ArtifactSnapshot {
  artifactId: Id;
  type: "plan" | "research_note" | "code_patch" | "risk_report" | "review_comment" | "delivery_pack";
  state: "draft" | "ready_for_review" | "approved" | "rejected" | "delivered" | "archived";
  ownerTaskId: Id;
  uri?: string;
}

interface ApprovalSnapshot {
  approvalId: Id;
  kind: "tool_use" | "artifact_delivery" | "data_writeback" | "budget_raise";
  state: "requested" | "approved" | "rejected" | "expired" | "cancelled";
  taskId: Id;
  requestedBy: Id;
  payloadRef: string;
}

type DomainEvent =
  | { type: "TaskCreated"; eventId: Id; taskId: Id; occurredAt: string }
  | { type: "AgentMoved"; eventId: Id; agentId: Id; from?: Id; to: Id; occurredAt: string }
  | { type: "ToolIntentDeclared"; eventId: Id; agentId: Id; taskId: Id; capability: string; occurredAt: string }
  | { type: "ToolExecutionStarted"; eventId: Id; taskId: Id; capability: string; occurredAt: string }
  | { type: "ApprovalRequested"; eventId: Id; approvalId: Id; taskId: Id; occurredAt: string }
  | { type: "ArtifactStateChanged"; eventId: Id; artifactId: Id; state: string; occurredAt: string }
  | { type: "TaskStateChanged"; eventId: Id; taskId: Id; state: string; occurredAt: string }
  | { type: "AgentIsolated"; eventId: Id; agentId: Id; reason: string; occurredAt: string };

type OfficeCommand =
  | { type: "CreateTask"; commandId: Id; goal: string }
  | { type: "AssignTask"; commandId: Id; taskId: Id; agentId: Id; roomId: Id }
  | { type: "GrantCapabilityLease"; commandId: Id; agentId: Id; capability: string; ttlSec: number }
  | { type: "Approve"; commandId: Id; approvalId: Id }
  | { type: "Reject"; commandId: Id; approvalId: Id; reason: string }
  | { type: "PauseTask"; commandId: Id; taskId: Id }
  | { type: "ResumeTask"; commandId: Id; taskId: Id }
  | { type: "TerminateTask"; commandId: Id; taskId: Id }
  | { type: "MoveToIsolation"; commandId: Id; taskId?: Id; agentId?: Id; reason: string };
```

状态机上，建议至少遵循以下规则：

- **Agent**：`idle → assigned → moving → running → waiting_approval / blocked / failed / paused / isolated / done`
- **Task**：`created → ready → dispatched → running → waiting_approval / blocked / rework / completed / failed / cancelled`
- **Artifact**：`draft → ready_for_review → approved / rejected → delivered / archived`
- **Approval**：`requested → approved / rejected / expired / cancelled`
- **ToolGrant**：`requested → active → expired / revoked / denied`

非法转换统一按两步处理：先写 `InvalidTransitionRejected` 审计事件，再保持原状态不变。这样能把 bug、并发冲突和 UI 假设错误都留在历史里，而不是静默吞掉。Temporal 之所以值得借鉴，就在于它把 workflow 事实做成 history，而不是做成“当前状态一张表”而已。citeturn17search0turn17search4turn17search12turn17search16

## MVP 空间布局、完整流程与场景演示

### MVP 边界与办公室布局

MVP 只做这些能力：

- 任务创建、拆分、分配
- Agent 状态展示
- 房间进入与 RoomPolicy 校验
- 临时工具授权
- Artifact 展示
- 会议
- Review / Approval
- 暂停、恢复、终止
- 异常与隔离
- 一个 MockRuntimeAdapter
- 一个 OpenClawAdapter

MVP 明确不做：

- 开放世界漫游
- 跨组织多租户共享世界
- 经济系统、技能市场、社交化 town
- CRDT 协同编辑世界状态
- 全自动长期记住所有历史
- 多云/多地域复杂调度
- 高保真 3D 或重演出风格 UI

推荐平面布局是八房间：

- **指挥室**：输入目标、查看总态势、主控面板
- **任务墙**：任务卡、依赖关系、优先级
- **研究室**：检索、证据包、只读外部数据
- **开发室**：代码/文档生产、可写 workspace
- **审查室**：Review、测试、比对、回归
- **会议室**：多 Agent 会诊
- **审批台**：人工批准、加预算、写回外部系统
- **隔离区**：异常 agent / 失控任务 / 高风险工件

### MVP 主流程与异常流程

**主流程**：用户在指挥室输入“为某项目完成调研并输出交付稿”后，Orchestrator 创建总任务并拆成研究、产出、审查三个子任务；研究 Agent 被分配到研究室，应用只读检索工具与证据上下文；Builder 进入开发室写出初稿 Artifact；Reviewer 进入审查室校验引用、结构和风险；若需对外写回，由审批台发起人工批准；批准后 Artifact 进入交付态，并从指挥室导出给外部项目。这个流程里，空间真正降低的是 **任务态势理解成本**：用户一眼就能看见“研究没结束所以开发没开始”，而不是在节点图里慢慢点。citeturn24search1turn24search4turn24search7turn17search1turn17search14

**异常流程一**：Agent 在研究室提出联网工具调用，但 RoomPolicy.network=`none`。系统生成 `ToolIntentDeclared` 后，Policy Engine 直接拒绝，任务转 `blocked`，办公室里研究室门口出现红色阻塞标记，用户可把任务拖到允许联网的研究室变体，或临时发放受限 capability lease。  
**异常流程二**：Builder 在开发室生成了不符合输出合同的 Artifact，例如输出了“原始 log dump”而不是“code_patch”。Artifact Registry 将其置为 `rejected`，任务变 `rework`，工件直接回到开发室工位而不是流入审查室。  
**异常流程三**：任务执行中连续超预算或超时。Resource Manager 触发 `ApprovalRequested(kind=budget_raise)`，任务进入 `waiting_approval`，若超时无人处理则自动转隔离区。  
这三条异常都必须留下审计事件，并能在 replay 中重放。citeturn24search0turn24search9turn17search0turn17search16turn28search2

### 考研个人效率场景演示

以“根据近期学习记录，为第二天生成数学一与 408 学习计划，并检查当前进度风险”为例。

用户在**指挥室**输入目标。Orchestrator 创建五个子角色：计划 Agent、学情分析 Agent、风险审查 Agent、资料检索 Agent、最终 Review Agent。  
学情分析 Agent 进入**研究室**，可读工具包括最近学习记录、错题本摘要、番茄钟统计、课程大纲；禁止任何写回。它输出 `progress_snapshot` Artifact。  
资料检索 Agent 也在研究室，但它的 memory scope 只包含资料库与历年真题标签，输出 `evidence_pack`。  
计划 Agent 进入**开发室**，输入是 `progress_snapshot + evidence_pack`，输出 `draft_study_plan`。它可自动获得“写计划草稿”的 capability，但不能直接写入外部学习系统。  
风险审查 Agent 进入**审查室**，比对计划与进度，检查是否出现“总量虚高”“408 挤占数学复盘时间”“忽略错题闭环”等风险，输出 `risk_report`。  
如风险过高，Orchestrator 把计划 Agent、风险审查 Agent 与学情分析 Agent 拉入**会议室**，形成一次会诊，会议结果作为 `meeting_note` Artifact 回流开发室。  
最终 Review Agent 在审查室整合 `draft_study_plan + risk_report + meeting_note`，形成 `candidate_plan`。  
当用户点击审批台上的“批准并写回”，系统才发起 `ApprovalRequested(kind=data_writeback)`。获批后，Command Gateway 调用外部学习系统 Adapter，把最终计划写回日历、任务列表或学习软件。  

这套流程证明 Agent Office 不是动画，因为：

- 不同房间决定了不同工具、上下文与写权限；
- 写回外部系统前必须走审批；
- 风险报告是独立 Artifact，不是聊天里的随口一句；
- 会议室是一个真正的协调节点，而不是摆设；
- 用户的批准会改变 Runtime 命令结果，而不是只改变界面。citeturn24search4turn24search7turn24search0turn24search9turn19search2

### 建议目录结构与实施顺序

建议目录结构如下：

```text
apps/
  office-web/
  office-control-api/
packages/
  protocol/
  runtime-adapter-openclaw/
  runtime-adapter-mock/
  policy-engine/
  office-projection/
  room-policy/
  artifact-registry/
  audit/
  ui-kit/
infra/
  migrations/
  otel/
docs/
  product/
  architecture/
  room-policies/
  adapters/
```

实施顺序不按“工期天数”排，而按依赖与验收条件：

- **阶段一**：先落协议、MockRuntimeAdapter、Snapshot + SSE 事件流。验收标准是：不用像素 UI，也能跑通任务、审批、Artifact。
- **阶段二**：接入 PixiJS 投影层。验收标准是：空间能稳定映射 Snapshot；断线重连后无明显错位。
- **阶段三**：接入 RoomPolicy、ToolGrant、Approval Service。验收标准是：至少两类高风险操作被真正拦截。
- **阶段四**：做 OpenClaw Adapter。验收标准是：能从真实 runtime 拉到 session/task/tool/approval 基本信号，并发起 pause/resume/assign 一类命令。
- **阶段五**：做考研学习系统 Adapter。验收标准是：在审批通过后，系统能把最终计划写回外部日程或任务系统。  

## 安全、权限、审计与验证方案

### 安全与审计基线

Agent Office 的核心风险不是“模型会不会胡说”，而是 **错误的工具调用、过度权限、上下文串台、无审计写回**。因此必须把五条边界做硬：

- **工作边界**：workspace / worktree / sandbox 必须显式隔离。OpenClaw 明确提醒默认 workspace 不是硬沙箱；Codex 明确把 spawned commands 也放进 sandbox；AgentBay 则把 code/browser/desktop/mobile 环境做成隔离执行面。citeturn16view5turn16view2turn10view1
- **网络边界**：RoomPolicy 中必须有 network policy。
- **工具边界**：所有工具调用先过 policy engine，再到 Tool Gateway。
- **审批边界**：任何外部副作用前必须有 durable approval。
- **审计边界**：所有命令、决定、产物状态变化、批准拒绝、预算变化，都写 append-only audit log，并打 OTel trace/span 关联。OpenTelemetry 官方把 logs / metrics / traces 的统一关联视为核心能力，这很适合做 Office 的“事实骨架”。citeturn28search0turn28search1turn28search2

### 对照实验与继续投入门槛

建议做 **被试内对照实验**：同一批用户分别使用传统 Dashboard 与 Agent Office 完成相同任务。样本建议 16–24 人，分为熟悉 Agent 工具的开发者与熟悉任务管理但不熟悉 Agent 的普通知识工作者两组。任务集至少包括：

- 找出当前异常 Agent
- 找出任务阻塞原因
- 判断某 Agent 是否拥有特定工具权限
- 打开关键 Artifact
- 完成人工审批
- 把异常任务移入隔离区
- 识别多 Agent 协作关系

测量指标包括：异常发现时间、阻塞成因识别时间、Agent—Task 关系识别正确率、Tool/Permission 识别正确率、打开关键 Artifact 的步骤数、审批耗时、Runtime 状态误判率、空间操作与表单操作完成时长、NASA-TLX 或同类认知负荷、主观信任、主观控制感、长时间使用疲劳度。  

MVP 是否继续投入，建议设三道 Gate：

- 关键任务耗时相对传统 Dashboard 至少下降 20%
- 状态误判率至少下降 30%
- 高风险审批耗时不劣于 Dashboard，且主观控制感显著提升

如果这三条做不到，就说明空间设计还停留在“好看”，没有形成真实产品价值。GitHub、Claude Code Agent View 之所以有价值，正是因为它们减少了滚日志和上下文切换；你的作战室必须证明自己至少也能做到这一点。citeturn22view0turn33search1turn33search5turn33search13

### 风险、未知项与最终实施路线

当前最大的未知项有四个。第一，`AGENT.md` 正文未在当前可访问上下文中验证，可能还包含更具体的项目边界。第二，OpenClaw 作为首个真实 Runtime 很合适，但其公开事件粒度还不如理想中的 L5 Agent OS，某些信号可能需要插件或桥接补足。第三，Kimi、腾讯、阿里这类平台公开了强平台能力，但用于第三方可嵌入控制面的标准协议与实时事件颗粒度仍不统一。第四，像素空间确有吸引力，但能否在高压力任务里稳定优于传统 Dashboard，必须靠实验而不是直觉证明。citeturn12search15turn21search3turn8view6turn8view7turn8view8turn10view1

最终实施路线应当是：

先把 **控制语义** 做对，再把 **空间投影** 做好，最后才做 **广泛适配**。  
也就是说，先完成“可执行作战室”的骨架：Event、Command、RoomPolicy、Approval、Artifact、Audit。  
其次完成像素办公室的空间表达与高频操作。  
再接 OpenClaw，证明真实 Runtime 能被这个空间控制面治理。  
最后才扩展到 Claude/Codex/Kimi/企业平台与个人效率系统。  

### 最终决策

**推荐产品形态**：嵌入式 Agent 作战室，而不是独立游戏世界。  
**推荐交互模型**：空间观察层 + 侧边控制层 + 审批抽屉层。  
**推荐 RoomPolicy 模型**：房间绑定工具、上下文、worktree、I/O 合同、预算、网络、审批与审计要求。  
**推荐权限模型**：RBAC for human + capability lease for agent + ABAC risk context + policy engine。  
**推荐前端技术栈**：React + PixiJS + pixi-react + React Aria + TanStack Table。  
**推荐实时通信方案**：Snapshot over HTTP + SSE incremental events + REST commands。  
**推荐后端架构**：TypeScript 模块化 monolith，append-only event log + materialized snapshots + OTel。  
**推荐最小 Event / Command 协议**：`RuntimeSnapshot / DomainEvent / OfficeCommand / CommandResult / RoomPolicy / ToolGrant / Artifact / Approval`。  
**推荐 MVP 平面布局**：指挥室、任务墙、研究室、开发室、审查室、会议室、审批台、隔离区。  
**推荐 MVP 主流程**：指挥室收目标 → Orchestrator 拆分 → 研究室取证 → 开发室产出 → 审查室校验 → 审批台放行 → 外部系统交付。  
**推荐最先接入的真实 Runtime**：OpenClaw。  
**推荐 MVP 验收指标**：关键任务耗时下降 ≥20%，状态误判率下降 ≥30%，审批耗时不劣化，空间/控制一致性错误率接近 0。  
**十条不可违反的设计原则**：  
一是空间必须映射真实 Runtime 事实。  
二是任何高风险动作都必须可审计。  
三是房间必须先有策略，再有美术。  
四是 LLM 只能提出意图，不能直接改世界状态。  
五是审批必须是 durable pause point。  
六是 Artifact 必须是一等对象。  
七是 UI 掉线不得影响 Runtime 继续执行。  
八是任何权限都应可撤销、可过期、可追踪。  
九是空间交互只保留能压缩认知的部分。  
十是适配 Runtime 依赖统一协议，而不是解析日志文本。  

**一句话回答核心假设：AI-像素 Agent Office 最应该先证明的核心假设，是“把真实 Runtime 的任务、权限、审批、Artifact 和异常映射到可执行空间后，用户会比使用传统 Dashboard 更快、更准、更有控制感地管理多 Agent 系统”。**

## 来源与证据附录

本报告检索日期为 **2026-07-03**。证据等级按“官方文档 / 官方 GitHub / 官方产品页 > 官方博客 / 官方 changelog > 社区 issue / 讨论 > 二手报道”排序。核心来源包括：

- **官方 Runtime 文档**：Claude Code subagents、permissions、Agent View、Agent Teams、Agent SDK；OpenAI Codex sandbox、approvals、cloud、app-server、AGENTS.md；OpenClaw workspace、session、hooks、agents、MCP、security、codex harness；Hermes Agent 官方仓库与 MCP 文档；Kimi 官方网站、Kimi API Docs 与 K2.6/K2.7 官方博客；腾讯云 ADP 产品页；阿里百炼 workflow 文档、AgentRun 文档、AgentBay 文档。citeturn16view1turn16view0turn22view0turn22view1turn22view5turn16view2turn16view3turn22view2turn23search0turn12search0turn16view5turn16view6turn16view7turn16view8turn22view3turn22view4turn16view4turn32search9turn8view1turn11search3turn13search2turn13search6turn13search12turn13search13turn8view6turn8view7turn8view8turn10view1
- **像素办公室与空间化项目**：Pixel Agents、Star-Office-UI、Agent Town 官方仓库、release、issue。citeturn26search3turn18search11turn26search0turn26search5turn26search1turn35search0turn26search6turn26search2
- **编排与可观测性参照**：Temporal workflow event history、Dagster asset materialization、LangGraph HITL、Dify Human Input、n8n HITL、AutoGen Core、OpenTelemetry。citeturn17search0turn17search4turn17search8turn17search13turn17search16turn17search1turn17search5turn17search14turn24search1turn24search4turn24search7turn24search0turn24search9turn24search2turn24search5turn28search0turn28search1turn28search2turn28search4
- **权限与策略引擎**：NIST RBAC、OPA、Cedar。citeturn37search2turn37search11turn37search23turn37search0turn37search9turn37search1turn37search7turn37search13
- **前端与实时通信依据**：PixiJS、pixi-react、Phaser React template、MDN canvas / EventSource / WebSocket、WHATWG SSE 规范。citeturn27search15turn27search1turn27search6turn27search5turn27search10turn14search4turn29search5turn15search0turn15search1turn15search2turn27search2turn27search3turn14search6turn27search9