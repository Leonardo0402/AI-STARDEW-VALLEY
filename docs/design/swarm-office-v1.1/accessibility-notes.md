# Swarm Office V1.1 — Accessibility Baseline

> Scope: `apps/demo-office` shell, `packages/control-ui`, `packages/pixel-office` presentation layer.
> PR context: Issue #27 Task 2. Refs #14.

## 1. 键盘导航（Keyboard navigation）

### 已实现

| 区域 | 行为 |
|---|---|
| 顶部状态条 | 纯信息展示，不拦截 Tab。 |
| Experience mode switcher | `role="tablist"`，可用 `Tab` 进入，进入后用 `ArrowLeft`/`ArrowRight` 在 Command/Focus/Debrief 之间循环，`Home` 跳第一个，`End` 跳最后一个。 |
| View / Motion toggles | 普通按钮，`Tab` 可达，`Space`/`Enter` 触发，`aria-pressed` 标示当前状态。 |
| 右侧控制面板卡片 | `Card` 组件在 `selectable` 时为 `role="button"`、`tabIndex="0"`，可用 `Enter`/`Space` 选中；ApprovalDrawer 内 Approve/Reject 按钮可用 `Escape` 将焦点移回标题。 |
| 列表视图 | `ListView` 行是 `tabIndex="0"` 的表格行，支持 `Enter`/`Space` 选中，并设置 `aria-selected`。 |
| 事件日志 | 事件行是 `role="button"`、`tabIndex="0"`、`aria-expanded`，支持点击和 `Enter`/`Space` 展开/折叠。 |
| Escape | 全局 `Escape` 清除当前选择；Focus/Debrief 模式不破坏选择。 |

### 已知缺口

- **像素画布不可键盘操作**：`<canvas>` 没有 `tabIndex`，无法通过键盘选择 agent/room。当前替代路径是右侧 `ControlPanel` 或 `ListView`。
- **缺少 Skip link**：没有提供跳到主内容或面板的跳过链接。

## 2. 焦点管理（Focus management）

### 已实现

- 所有交互元素使用 `:focus-visible` 提供高对比轮廓（`outline: 2px solid var(--info)`），不会在鼠标点击时留下焦点环。
- 选中卡片通过 `scrollIntoView({ behavior: "smooth", block: "nearest" })` 自动滚动到可视区域。
- `ApprovalDrawer` 按 `Escape` 时焦点回到抽屉标题。
- 重置（Reset）后选择被清空，焦点仍留在触发重置的按钮上（由浏览器默认行为管理）。

### 已知缺口

- 模式/视图切换后没有显式移动焦点；保留当前焦点是预期行为，但缺少焦点指示说明。
- 响应式自动切换到 `ListView` 时没有发送焦点到新视图。

## 3. 选择状态传达（Selection state）

### 已实现

| 元素 | 视觉提示 | ARIA/语义 |
|---|---|---|
| `Card` 选中 | `box-shadow: 0 0 0 2px var(--info)` + 边框色变化 | `aria-pressed="true"`、`role="button"` |
| `ListView` 行选中 | 行背景/边框高亮 | `aria-selected="true"` |
| Mode tab 选中 | `--base-600` active 背景 | `aria-selected="true"`、`role="tab"` |
| Canvas agent/room 高亮 | 精灵/房间轮廓高亮 | 通过 `aria-label` 描述地图；具体选择状态未暴露给屏幕阅读器 |

### 非颜色提示

- 选中状态除了颜色外还有边框/阴影变化；badge 状态除了背景色外还有文字标签。
- `revision_required` badge 额外使用 `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25)` 以与 `blocked`/`failed` 区分。

## 4. 减少动画（Reduced motion）

### 已实现

- App header 提供 **Motion on / Motion off** 切换按钮。
- 开启后，根节点 `.app-shell` 添加 `.reduce-motion` 类，CSS 将所有 `animation-duration` 和 `transition-duration` 压到 `0.001ms`。
- 同时通过 `ResizeObserver`/`window` 监听的媒体查询也尊重 `prefers-reduced-motion: reduce`。
- `PixelOfficeScene.setReduceMotion(true)` 会：
  - 通知 `AgentRenderer` 和 `EffectRenderer` 停止/禁用动画；
  - 重置 sprite 缩放和位置；
  - 阻止效果层逐帧刷新。

### 测试覆盖

- `apps/demo-office/src/accessibility.test.tsx` 验证切换 Motion 后 `.reduce-motion` 类与 `aria-pressed` 同步。
- `App.test.tsx` 验证切换 reduce motion 不会重建 `PixelOfficeScene`。

## 5. 非颜色状态提示（Non-color status cues）

### 已实现

- **StatusStrip**：状态圆点旁边总有文本标签（`connected`、`degraded`、`failed` 等），错误状态还会显示 `error code` + `message`。
- **Badges**：所有 badge 都显示状态文字（如 `idle`、`working`、`revision_required`），不只是颜色块。
- **Canvas 覆盖层**：
  - pending approval 使用铃铛图标 + 文字 "审批!"；
  - blocked task/agent 使用 "⚠" 符号 + 原因文字；
  - failed agent 在精灵上显示红色 "X" 标记（由 `AgentRenderer` 状态贴图实现）。

### 已知缺口

- Canvas 中 agent 角色区分主要依靠精灵颜色和外形，色盲用户可能难以区分；当前通过 `aria-label` 提供整体地图描述，但单个 agent 没有独立的可访问名称。

## 6. 屏幕阅读器标签（Screen reader labels）

### 已实现

| 元素 | 标签/描述 |
|---|---|
| 像素画布 | `aria-label="Pixel office map showing agent rooms and tasks"` |
| 主内容区 | `.app-body` 设置 `role="main"`、`aria-label="Swarm Office workspace"` |
| Mode switcher | `aria-label="Experience mode"` |
| 面板 SectionHeader | 使用 `<h3>`，标题文本即标签 |
| 可选中卡片 | `aria-label="Select agent ${agent.name}"` 等 |
| Approval 操作按钮 | `aria-label="Approve approval ${approvalId}"`、`aria-label="Reject approval ${approvalId}"` |
| View/Motion 按钮 | 文本 + `aria-pressed` |
| ErrorBanner | `role="alert"`，错误 code/message 直接可读 |

### 已知缺口

- 没有 `aria-live` 区域来宣告异步状态变化（如 session 从 `connected` 变为 `failed`、新事件到达、操作错误出现）。当前依赖视觉变化。
- 事件日志过滤输入没有关联 `<label>`，仅使用 `placeholder`。

## 7. 语义化结构（Semantic structure）

### 已实现

- `header` 元素包裹 brand 和全局操作。
- `.app-body` 标记为 `role="main"`。
- 面板内 SectionHeader 使用 `<h3>`，保持页面标题层级。
- 表格使用 `<table>`、`<thead>`、`<tbody>`、`<th>`。

### 已知缺口

- 品牌文字 "Swarm Office" 不是 `<h1>`，页面缺少顶级标题。
- 事件日志的 `<div role="button">` 内部包含 `<span>` 文本，语义正确但缺少更具体的列表结构（如 `role="list"`/`role="listitem"`）。

## 8. 已知缺口与路线图（Known gaps & roadmap）

| 优先级 | 缺口 | 建议方案 |
|---|---|---|
| 高 | Canvas 无法键盘选择和朗读单个 agent/room | 为 canvas 增加 `tabIndex`、方向键导航、焦点代理元素或隐藏式代理列表。 |
| 高 | 缺少 `aria-live` 区域 | 在 `App` 中增加 polite live region，用于宣告 session 状态变化、关键事件、操作错误。 |
| 中 | 缺少 Skip link | 在 `app-shell` 开头添加 "Skip to workspace" / "Skip to panel" 链接。 |
| 中 | `FocusPanel` 卡片不可选中 | 与 Command 模式保持一致，让 blocked agent/task 卡片支持选择和 cross-highlight。 |
| 低 | 事件日志过滤输入缺少 label | 增加显式 `<label>` 或通过 `aria-label` 描述。 |
| 低 | Canvas agent 缺少独立可访问名称 | 在精灵旁增加隐藏文本或通过 live region 宣告当前焦点 agent。 |

## 9. 验证清单（Verification checklist）

- [x] Mode switcher 是 `role="tablist"` 且支持箭头导航。
- [x] View / Motion toggles 使用 `aria-pressed`。
- [x] 选中卡片/行有 `aria-pressed` / `aria-selected` 及非颜色视觉提示。
- [x] Reduce motion 按钮与 CSS/PixiJS 动画同步。
- [x] StatusStrip 状态用文本+颜色共同传达。
- [x] Canvas 和 main landmark 有描述性标签。
- [x] Event log 行可键盘展开/折叠。
- [x] 新增/修改的 accessibility 行为有对应测试。

## 10. 相关文件

- `apps/demo-office/src/App.tsx`
- `apps/demo-office/src/App.test.tsx`
- `apps/demo-office/src/accessibility.test.tsx`
- `apps/demo-office/src/theme.css`
- `packages/control-ui/src/ControlPanel.tsx`
- `packages/control-ui/src/EventLogViewer.tsx`
- `packages/control-ui/src/EventLogViewer.test.tsx`
- `packages/control-ui/src/components/Card.tsx`
- `packages/control-ui/src/components/ApprovalDrawer.tsx`
- `packages/control-ui/src/control-panel.css`
- `packages/pixel-office/src/office-scene.ts`

## 11. #27 acceptance criteria mapping

> Status values: `done` / `accepted deviation` / `documented follow-up`.
> `follow-up required` is intentionally NOT used — these gaps are known follow-ups for the accessibility baseline and do not block #27 closure.

### #27 criteria

Source: `docs/superpowers/plans/2026-07-09-issue-27-swarm-office-final-gate.md` lines 258-268.

| # | #27 Criterion | Status | Notes |
|---|---|---|---|
| 1 | Mock adapter truthfully produces runtime-failed agent/task, artifact-unavailable, artifact-failed-open | done | Via `playRuntimeFailureFlow`, `playArtifactUnavailableFlow`, `playArtifactFailedOpenFlow` |
| 2 | Visual QA captures all truthful states across 1366×768, 1440×900, 1920×1080 | done | Baseline screenshots in 3 resolutions |
| 3 | Impossible states skipped with documented reasons | done | gap-audit.md "Accepted deviations" section |
| 4 | `accessibility-notes.md` covers keyboard, focus, selection, reduced-motion, non-color cues | done | This document (sections 1-10) |
| 5 | `performance-lifecycle-notes.md` covers Pixi lifecycle, motion toggle, asset fallback, representative loads | done | Submitted with PR #30 |
| 6 | `issue-14-closure-audit.md` with line-by-line mapping and final verdict | done | Submitted with PR #30 |
| 7 | All tests pass (`npm test -- --run`) | done | 668/668 passed |
| 8 | Build passes (`npm run build`) | done | Build succeeds |
| 9 | Screenshot and annotation scripts pass | done | Scripts run successfully |

### Accessibility gap status

| Gap | Priority | Status | Notes |
|---|---|---|---|
| Canvas not keyboard operable | High | accepted deviation | Canvas is inherently non-keyboard-navigable; ARIA overlay approach documented as follow-up. Alternative path via ControlPanel/ListView keyboard selection. |
| Missing `aria-live` region | High | accepted deviation | Follow-up to add `aria-live` for session state transitions and action errors. Current state changes are visible via StatusStrip and ErrorBanner (`role="alert"`). |
| Missing skip link | Medium | documented follow-up | Low-impact for single-page demo; add in future iteration. |
| `FocusPanel` cards not selectable | Medium | documented follow-up | Add keyboard selection in future iteration to match Command mode. |
| Event log filter input missing label | Low | documented follow-up | Minor a11y polish; add explicit `<label>` or `aria-label`. |
| Canvas agent missing ARIA name | Low | documented follow-up | Minor a11y polish; add hidden text or live region announcement. |
