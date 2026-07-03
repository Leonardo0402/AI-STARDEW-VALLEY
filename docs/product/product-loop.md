# Agent Office 产品循环

> 本文档定义 Agent Office 第一版的用户核心循环、三模式切换逻辑、空间操作价值判断与完整用户旅程。
>
> 与项目指导文档 `AGENT-GPT.md` 冲突时，以本文档为准。

---

## 1. 用户核心循环

Agent Office 的用户并不"住在"像素办公室里。用户的真实工作是下达目标、审查产出、做出决策。像素办公室是用户感知和干预 Agent 系统的空间化界面。

核心循环如下：

```text
下达目标 → 观察执行 → 审查产物 → 做出决策 → 下达目标 → ...
```

每一次循环中，用户经历三个模式：

1. **Command Mode**：用户主动介入，观察全局态势，下达命令
2. **Focus Mode**：用户离开 Office 去做自己的真实工作，Office 退到背景
3. **Debrief Mode**：用户回到 Office，集中处理积压的审批、产物和异常

这不是一个"用户必须时刻盯着"的系统。用户离开时，Agent 继续工作；用户回来时，所有结果已有序等待。

---

## 2. 三模式详解

### 2.1 Command Mode（指挥模式）

**触发**：用户主动打开 Agent Office 或从 Focus Mode 切换回来。

**用户看到什么**：
- 完整的像素办公室，四个区域同时可见
- 每个 Agent 的当前位置、状态、当前任务
- 任务在区域之间的流转
- 审批请求的视觉标记（闪烁/高亮）
- 异常的视觉标记（红色/阻塞图标）
- 右侧控制面板，可展开任务列表、Agent 列表、事件日志

**用户做什么**：
- 创建新任务（通过指挥区或侧边面板）
- 分配任务给 Agent
- 暂停/恢复 Agent
- 查看 Artifact 内容
- 批准或拒绝审批请求
- 将异常任务或 Agent 移到隔离区（设计接口保留，MVP 不做完整隔离区）

**Agent 做什么**：
- 继续执行当前任务
- 在区域之间移动（对应状态变化）
- 显示当前状态动画（工作、等待、阻塞等）

**空间操作何时有价值**：
- 快速识别"谁在做什么、谁卡住了"——一眼看完，不需要翻列表
- 理解任务流转——任务从指挥区到执行区到审查区到审批交付区，路径可视化
- 发现阻塞——Agent 站在错误区域或显示阻塞动画，比日志中的 `status: blocked` 更直观

**哪些操作必须保留为普通面板**：
- 输入任务详细描述（文本框）
- 查看 Artifact 完整内容（代码、文档、报告）
- 查看事件日志详情
- 修改 Agent 配置参数
- 批量操作（如批量批准）

这些操作在空间中没有优势，强行空间化只会增加步骤。

### 2.2 Focus Mode（专注模式）

**触发**：用户通过切换按钮或快捷键进入 Focus Mode。

**用户看到什么**：
- 像素办公室退到后台或副屏，缩小为极简状态指示器
- 仅显示关键状态：是否有新审批、是否有异常、是否有完成的 Artifact
- 非紧急通知静默积压，不弹出、不闪烁、不发声

**用户做什么**：
- 用户离开 Office，做自己的真实工作（写代码、写文档、学习等）
- 不主动查看 Office，除非收到 Critical 级通知

**Agent 做什么**：
- 继续执行任务，不受影响
- 产生的事件正常写入 Event Log
- 产生的 Artifact 正常保存
- 审批请求进入等待队列，不打断用户

**通知分级**：
- **Critical**：系统异常、任务全部失败、审批超时——可突破 Focus Mode 通知用户
- **Actionable**：审批请求、Artifact 待审查——积压在 Debrief 队列
- **Informational**：任务完成、Agent 状态变化——仅在 Debrief Mode 中展示

**Focus Mode 的设计原则**：Agent Office 不应成为用户注意力的竞争者。用户离开 Office 去做真实工作，是系统的成功，不是失败。

### 2.3 Debrief Mode（复盘模式）

**触发**：用户从 Focus Mode 切换回来，或主动打开 Agent Office。

**用户看到什么**：
- 像素办公室恢复完整视图
- 积压的审批请求以视觉标记提示
- 完成的 Artifact 以视觉标记提示
- 按时间排序的 Debrief 摘要面板（发生了什么、需要做什么决定）

**用户做什么**：
- 逐项处理积压的审批请求（批准/拒绝）
- 查看完成的 Artifact
- 审查任务结果
- 决定返工或通过
- 查看异常和阻塞
- 下达新目标

**Agent 做什么**：
- 继续执行当前任务
- 等待审批的 Agent 保持等待状态
- 被阻塞的 Agent 保持阻塞状态

**Debrief 面板结构**（MVP 版本）：
1. **需要决策**：审批请求列表（按优先级排序）
2. **新产物**：完成的 Artifact 列表
3. **异常**：错误和阻塞列表
4. **状态摘要**：各 Agent 当前状态、各任务当前状态

---

## 3. 第一版完整用户旅程

### 主流程：从目标到交付

```
1. 用户打开 Agent Office，进入 Command Mode
2. 用户在指挥区输入目标："分析项目 X 的代码质量并生成报告"
3. Orchestrator 创建任务，拆分为三个子任务：
   - 子任务 A：扫描代码并收集指标（分配给 Worker-1）
   - 子任务 B：分析代码质量问题（分配给 Worker-2）
   - 子任务 C：审查并生成最终报告（分配给 Reviewer）
4. 用户看到任务出现在指挥区，Agent 开始移动
5. 用户切换到 Focus Mode，去做自己的事
6. Worker-1 进入执行区，开始执行子任务 A
   → 事件：task.started (Worker-1)
7. Worker-2 进入执行区，开始执行子任务 B
   → 事件：task.started (Worker-2)
8. Worker-1 完成子任务 A，产生 Artifact（代码指标数据）
   → 事件：artifact.created
9. Worker-2 分析过程中遇到问题（Mock 数据不足），任务阻塞
   → 事件：task.blocked
10. Worker-2 的阻塞状态在像素空间中显示
11. Worker-1 完成子任务 A 后，Orchestrator 将子任务 C 的一部分分配给 Reviewer
    → 事件：task.assigned
12. Reviewer 进入审查区，开始审查
    → 事件：task.started (Reviewer)
13. 用户从 Focus Mode 切换回来，进入 Debrief Mode
14. 用户看到：
    - Worker-2 阻塞（需关注）
    - Reviewer 正在审查（正常）
    - 有一个 Artifact 已完成（可查看）
15. 用户查看阻塞原因，手动解除阻塞（Mock 中为"提供更多数据"）
    → 命令：task.resume (隐含)
16. 用户查看 Artifact（代码指标数据）
    → 命令：artifact.open
17. Reviewer 完成审查，产生审查意见 Artifact
    → 事件：artifact.created
    → 事件：artifact.reviewed
18. Reviewer 请求用户审批最终报告
    → 事件：approval.requested
19. 审批标记在像素空间中闪烁
20. 用户打开审批面板，查看审查意见，决定批准
    → 命令：approval.accept
    → 事件：approval.resolved
21. 子任务 C 完成
    → 事件：task.completed
22. 整个父任务完成
    → 事件：task.completed
```

### 异常流程：Worker 执行失败

```
1. Worker-1 在执行子任务 A 时遇到错误
   → 事件：error.raised
2. Worker-1 状态变为 blocked
   → 事件：agent.status_changed (idle → blocked)
3. 像素空间中 Worker-1 显示错误标记
4. 用户在 Debrief Mode 中看到 Worker-1 异常
5. 用户查看错误原因
6. 用户决定：
   a. 重新分配子任务 A 给 Worker-2（如果 Worker-2 空闲）
   b. 或手动修复问题后恢复 Worker-1
   → 命令：task.assign
7. 任务恢复执行
```

### 异常流程：审批被拒绝

```
1. Reviewer 请求审批
   → 事件：approval.requested
2. 用户在 Debrief Mode 中查看审批内容
3. 用户认为审查结果不充分，选择拒绝
   → 命令：approval.reject
   → 事件：approval.resolved (rejected)
4. 任务回到审查状态
   → Review 任务重新进入执行区
5. Reviewer 收到返工通知，重新审查
```

### 异常流程：Agent 需要暂停

```
1. 用户发现 Worker-1 的行为不符合预期
2. 用户在 Command Mode 中点击 Worker-1，选择暂停
   → 命令：agent.pause
   → 事件：agent.status_changed (working → paused)
3. Worker-1 在像素空间中停止移动，显示暂停标记
4. 用户调查问题后，选择恢复
   → 命令：agent.resume
   → 事件：agent.status_changed (paused → working)
5. Worker-1 继续执行
```

---

## 4. 失败和返工流程

### 审查不通过 → 返工

```
1. Reviewer 审查 Worker-1 的产出
2. Reviewer 将 Artifact 标记为 revision_required
   → 事件：artifact.reviewed (status: revision_required)
3. 任务状态变为 revision_required
4. Worker-1 收到返工任务
   → 事件：task.assigned (返工)
5. Worker-1 进入执行区，重新执行
6. Worker-1 完成返工，产生新版本 Artifact
   → 事件：artifact.created (version: 2)
7. 新 Artifact 重新进入审查区
```

### 审批超时

```
1. 审批请求发出后，用户在指定时间内未响应
2. 系统将审批标记为超时
   → 事件：approval.resolved (expired)
3. 任务保持等待审批状态
4. 用户在下次 Debrief Mode 中可以看到超时的审批
5. 用户可以重新发起审批或直接拒绝
```

---

## 5. 空间操作价值判断

| 操作 | 空间化 | 面板 | 原因 |
|------|--------|------|------|
| 查看"谁在做什么" | 是 | 辅助 | 空间位置天然表达状态 |
| 查看"任务卡在哪里" | 是 | 辅助 | 区域流转可视化 |
| 发现阻塞 | 是 | 辅助 | 阻塞标记在空间中更显眼 |
| 输入任务描述 | 否 | 是 | 文本输入没有空间优势 |
| 查看 Artifact 内容 | 否 | 是 | 代码/文档不适合像素展示 |
| 批准/拒绝审批 | 是（触发）+ 否（决策） | 是 | 空间触发审批面板，面板做决策 |
| 分配任务 | 是 | 辅助 | 拖拽到 Agent 或区域比下拉框直观 |
| 查看事件日志 | 否 | 是 | 日志天然是列表 |
| 暂停/恢复 Agent | 是 | 辅助 | 点击 Agent 比在列表中找更快 |

---

## 6. Recovery Mode（设计接口保留）

Recovery Mode 不在第一版实现，但保留以下设计接口：

- 系统检测到用户连续 N 天未打开 Office
- 再次打开时，Debrief Mode 提供"历史摘要"而非"实时积压"
- 显示"自上次离开后发生的 X 个事件"
- 不惩罚、不显示负面指标

---

## 7. 模式切换状态机

```text
                    ┌─────────────┐
        ┌──────────→│  COMMAND    │←──────────┐
        │           │  MODE       │           │
        │           └──────┬──────┘           │
        │                  │                  │
        │        用户切换   │  用户切换        │
        │                  │                  │
        │           ┌──────▼──────┐           │
        │           │   FOCUS     │           │
        │           │   MODE      │           │
        │           └──────┬──────┘           │
        │                  │                  │
        │        用户切换   │  用户切换        │
        │                  │                  │
        │           ┌──────▼──────┐           │
        └───────────│  DEBRIEF    │───────────┘
                    │  MODE       │
                    └─────────────┘
```

- 任何模式之间可以互相切换
- Focus Mode 中，Critical 级通知可以提示用户切换到 Debrief Mode
- 系统启动时默认进入 Command Mode