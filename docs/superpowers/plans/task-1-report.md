# Task 1 报告：Canvas / control-panel linked selection

## 状态

DONE

## 提交

本次改动已提交（未 push）：

- `feat(demo-office): bidirectional canvas/control-panel selection for Issue #25 Task 1`
  - 初始 Task 1 实现：task/artifact/approval 选择映射到相关 agent/room 高亮，Reset / adapter reset 显式清除选择。

- `fix(demo-office): address Task 1 review findings for Issue #25`
  - 修复评审发现的 Important / Minor 问题：renderer 单选语义、房间选择高亮活跃 agent、面板卡片滚动到视图、approval 卡片可选中、清理死代码，并补充对应测试。

## 初始实现修改文件

- `packages/pixel-office/src/selection.ts`（新增）
  - 定义共享 `OfficeSelection` 类型：`kind: "agent" | "task" | "artifact" | "approval" | "room"`，`id: string`。
  - 从 `packages/pixel-office/src/index.ts` 导出。

- `packages/pixel-office/src/office-scene.ts`
  - 暴露 `selectAgent(agentId)`、`selectRoom(roomId)`、`clearSelection()`、`setOnSelect(callback)` API。

- `packages/pixel-office/src/renderer/agent-renderer.ts`
  - 新增 `selectedIds` 集合与高亮描边渲染。
  - 实现 `selectAgent` / `clearSelection`，高亮使用轮廓+半透明填充，非仅颜色。

- `packages/pixel-office/src/renderer/room-renderer.ts`
  - 新增 `selectedIds` 集合，绘制房间高亮外框。

- `packages/control-ui/src/components/Card.tsx`
  - 增加 `selected`、`selectable`、`ariaLabel`、`onKeyDown` 支持。
  - 可被选中的卡片具备 `role="button"`、`aria-pressed`、Tab 聚焦能力。

- `packages/control-ui/src/ControlPanel.tsx`
  - 接收 `selection` 与 `onSelect` props。
  - Agent / Task / Artifact 卡片支持点击与 Enter/Space 键盘选择。
  - 选中卡片显示 `card--selected` 样式与 `aria-pressed`。

- `packages/control-ui/src/control-panel.css`
  - 新增选中态样式（outline + ring），满足非颜色唯一提示的要求。

- `apps/demo-office/src/ListView.tsx`
  - 接收 `selection` 与 `onSelect` props。
  - Agent / Task / Artifact / Approval / Room 行支持点击、Enter/Space 键盘选择、`aria-selected`。

- `apps/demo-office/src/ListView.test.tsx`（新增）
  - 覆盖列表渲染、行选择、键盘选择、`aria-selected` 状态。

- `apps/demo-office/src/App.tsx`
  - 使用 `useState` 管理 `OfficeSelection | null`，不侵入 Runtime/LifeSim 状态。
  - 将 `selection` / `onSelect` 传给 `ControlPanel` 与 `ListView`。
  - 注册场景 `setOnSelect` 回调，实现画布到面板的单向同步。
  - 新增 `resolveCanvasSelection`：将 task / artifact / approval 选择按 projection 关系解析为相关 agent / room，优先 agent（assignee / producer / requestedBy），其次 room（task.roomId），无关联时返回 `null`。
  - `useEffect` 将当前选择同步到 `PixelOfficeScene`（agent / room / clear）。
  - 新建场景时立即应用当前选择，保证 Pixel ↔ List 视图切换后高亮不丢失。
  - 选择实体从 projection 中消失时自动清除选择。
  - `Escape` 全局监听清除选择。
  - 通过 `React.cloneElement` 为 `demoControls` 注入 `onReset` 回调，在 adapter / store reset 后显式清空选择。

- `apps/demo-office/src/DemoControls.tsx`
  - 新增可选 `onReset` prop；在 `handleReset` 中 adapter.reset() 与 store.reset() 之后调用 `onReset?.()`。

- `apps/demo-office/src/App.test.tsx`
  - 新增 App selection 测试套件，覆盖模式/视图切换、实体消失清除、Escape 清除、画布回调、task/artifact/approval 关系映射、Reset 清除。

- `packages/pixel-office/src/__tests__/office-scene.test.ts`
  - 补充 `selectAgent` / `selectRoom` 渲染高亮轮廓的断言。

- `packages/control-ui/src/ControlPanel.test.tsx`
  - 补充卡片点击、Enter/Space 键盘选择、选中高亮属性的测试。

## 评审修复修改文件

- `packages/pixel-office/src/renderer/agent-renderer.ts`
  - `selectAgent` 现在先 `clearSelection()`，确保切换 agent 时不会残留多个高亮。
  - 新增 `selectAgents(agentIds)`，支持一次性高亮多个 agent（用于房间选择时高亮全部活跃 agent）。

- `packages/pixel-office/src/renderer/room-renderer.ts`
  - `selectRoom` 现在先 `clearSelection()`，确保切换房间时不会残留多个高亮。

- `packages/pixel-office/src/office-scene.ts`
  - 暴露 `selectAgents(agentIds)` API，转发给 `AgentRenderer`。

- `apps/demo-office/src/App.tsx`
  - 提取 `applyCanvasSelection` 回调，统一在场景初始化和同步 effect 中应用选择。
  - 应用新选择前始终调用 `scene.clearSelection()`，避免旧高亮残留。
  - 当 canvas 选择为 room 时，先 `selectRoom(roomId)`，再 `selectAgents(room.activeAgentIds)` 高亮房间内所有活跃 agent。
  - 删除未使用的 `prevSelectionRef`。

- `packages/control-ui/src/components/Card.tsx`
  - 使用 `React.forwardRef` 支持外部 ref，用于滚动定位。

- `packages/control-ui/src/ControlPanel.tsx`
  - 为 Agent / Task / Artifact / Approval 卡片维护 `cardRefs` 映射。
  - `useEffect` 在 `selection` 变化时，将匹配卡片 `scrollIntoView({ behavior: "smooth", block: "nearest" })`。
  - 向 `ApprovalDrawer` 传递 `selection`、`onSelect` 以及每张 approval 卡片的 ref 回调。

- `packages/control-ui/src/components/ApprovalDrawer.tsx`
  - 新增 `selection`、`onSelect`、`cardRef` props。
  - approval `Card` 支持选中态（`aria-pressed`、TabIndex、Enter/Space 键盘选择）。
  - Approve / Reject 按钮阻止事件冒泡，避免触发卡片选择。

- `packages/pixel-office/src/__tests__/office-scene.test.ts`
  - 新增测试：renderer 在选中新 agent / room 时会清除之前的高亮。

- `apps/demo-office/src/App.test.tsx`
  - 新增测试：选择 room 时调用 `selectRoom` 和 `selectAgents` 高亮活跃 agent。
  - 更新 `PixelOfficeScene` mock，加入 `selectAgents`。

- `packages/control-ui/src/ControlPanel.test.tsx`
  - 新增测试：选中卡片变化时调用 `scrollIntoView`。

- `packages/control-ui/src/components/ApprovalDrawer.test.tsx`
  - 新增测试：approval 卡片点击 / Enter 键盘触发 `onSelect`，选中态具备 `aria-pressed` 与 `card--selected`。

## 验证结果

- `npm test -- --run`：59 个测试文件，637 个测试全部通过。
- `npm run build`：TypeScript 与 demo-office Vite 构建均通过（仅有大于 500kB chunk 的常规警告）。

## 注意事项

- 协议类型、reducer、LifeSimEngine、RuntimeSession 与后端传输均未改动。
- 选择状态为纯展示性质，不会发送任何命令或修改 Runtime Snapshot / LifeSim 状态。
- task / artifact / approval 的选择已按 projection 关系映射到相关 agent / room 高亮；无关联时清空画布高亮但保留面板选择。
- room 选择现在会同时高亮房间及其全部活跃 agent（通过 `selectAgents`）。
- Reset / adapter reset 已通过 `DemoControls.onReset` 回调显式清空选择。
- 未执行 `git push`。
