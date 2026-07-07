# Task 1 报告：Canvas / control-panel linked selection

## 状态

DONE

## 提交

本次改动已提交（未 push）：

- `feat(demo-office): bidirectional canvas/control-panel selection for Issue #25 Task 1`
  - 包含初始 Task 1 实现与两个缺口的修复：task/artifact/approval 选择映射到相关 agent/room 高亮，以及 Reset / adapter reset 显式清除选择。

## 修改文件

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
  - 新增 App selection 测试套件，覆盖：
    - ControlPanel 接收 `onSelect` 并将 agent 选择应用到场景。
    - 选择跨 Command/Focus/Debrief 模式保持。
    - 选择跨 Pixel/List 视图保持。
    - 选中实体从 projection 消失时清除选择。
    - `Escape` 清除选择。
    - 画布选择回调更新 ControlPanel 的 `selection`。
    - 选择 task 时高亮 assignee agent；无 assignee 时回退到 room。
    - 选择 artifact 时高亮 producer agent。
    - 选择 approval 时高亮 requestedBy agent。
    - 无关联 agent/room 时清空画布高亮。
    - 点击 DemoControls「重置」时清空选择。
  - 修复直接调用 `props.onSelect` / `scene.simulateAgentSelect` 时未包裹 `act()` 导致的异步状态未刷新问题。

- `packages/pixel-office/src/__tests__/office-scene.test.ts`
  - 补充 `selectAgent` / `selectRoom` 渲染高亮轮廓的断言。

- `packages/control-ui/src/ControlPanel.test.tsx`
  - 补充卡片点击、Enter/Space 键盘选择、选中高亮属性的测试。

## 验证结果

- `npm test -- --run`：59 个测试文件，630 个测试全部通过。
- `npm run build`：TypeScript 与 demo-office Vite 构建均通过（仅有大于 500kB chunk 的常规警告）。

## 注意事项

- 协议类型、reducer、LifeSimEngine、RuntimeSession 与后端传输均未改动。
- 选择状态为纯展示性质，不会发送任何命令或修改 Runtime Snapshot / LifeSim 状态。
- task / artifact / approval 的选择已按 projection 关系映射到相关 agent / room 高亮；无关联时清空画布高亮但保留面板选择。
- Reset / adapter reset 已通过 `DemoControls.onReset` 回调显式清空选择。
- 未执行 `git push`。
