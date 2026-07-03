# ADR-0001: RuntimeSession 放在 packages/core

- **状态**: Accepted
- **日期**: 2026-07-03
- **关联 Issue**: #3 — Checkpoint-aware RuntimeSession and automatic resynchronization

## 背景

Issue #3 要求引入一个会话生命周期所有者，负责：

- `connect → getSnapshot → setSnapshot → subscribe(afterSequence)` 的 bootstrap 顺序
- 收到事件后按 `EventApplyResult.code` 分发
- 检测到 `sequence_gap` 时自动 `resynchronize`
- 对外暴露 `onStateChange / onAcceptedEvent`

候选位置有三个：

1. `packages/control-ui`（React 专用）
2. `packages/adapters/*`（每个 adapter 各自实现）
3. `packages/core`（框架无关）

## 决策

**放在 `packages/core`，命名为 `RuntimeSession`。**

## 理由

### 1. 框架无关

bootstrap ordering、gap recovery、cursor-aware subscribe 这些逻辑与 UI 框架无关。
若放在 `control-ui`，则未来 CLI / 测试 / 后台 worker 想复用同一套会话管理需要重写一遍。

### 2. 不属于 adapter

adapter 的职责是"翻译协议"（HTTP/SSE → DomainEvent），不应当承载会话状态机。
若放在 adapter 内：

- 每个 adapter（Mock / SSE / QClaw / Swarm）都要重复实现同一套 bootstrap + gap recovery
- adapter 之间行为可能漂移，导致同一个 UI 在不同 adapter 下表现不一致
- adapter 测试要重复覆盖会话语义

### 3. 与 store / gateway 同层

`RuntimeSession` 持有 `SnapshotStore` 和 `CommandGateway` 引用，
并对它们调用 `setSnapshot / applyEvent / notifyListeners`。
它本质上是 core 内的协调者（orchestrator），与 store / gateway / reducer 同层。

### 4. React 集成通过依赖注入

`useOfficeState(session, store, gateway, runtimeId)` 接受 session 引用，
而不是自己创建 session。这样：

- React StrictMode 双重挂载不会创建重复 session
- session 可以在 `main.tsx` 模块作用域创建（singleton）
- 测试可以注入 mock session

## 后果

### 正面

- 会话语义集中在一处，方便审计与测试
- adapter 只需要关心协议翻译，接口更窄
- 未来非 React 入口（CLI、headless 测试）可直接复用 RuntimeSession

### 负面

- core 包从"纯函数 + 数据结构"扩展到"包含有状态协调者"
  - 缓解：session 显式注入 store / gateway，core 仍可单独测试
- session 需要暴露 `onStateChange / onAcceptedEvent` 这样的 listener API
  - 缓解：API 极简，且与 store 的 `subscribe` 风格一致

## 备选方案

### A. 放在 control-ui

否决：未来 CLI / 后台 worker 想用同一套会话管理时需要重写。

### B. 每个 adapter 自己实现

否决：会话语义漂移、重复实现、测试覆盖成本高。

### C. 新建 `packages/session` 包

否决：当前只有一种会话实现，过早拆分会增加跨包依赖管理成本。
若未来出现多种 session 策略（如离线优先、弱网优先），可再拆分。

## 引用

- `docs/protocol/runtime-contract.md` §5、§8
- `packages/core/src/session.ts`
- GitHub Issue #3
