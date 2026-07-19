/**
 * @agent-office/control-ui — React DOM 控制面板。
 *
 * 核心规则：
 * - 通过 Command Gateway 发命令，不直接修改 Snapshot
 * - 消费 OfficeProjection 做展示
 * - 不在 React 组件内模拟业务事实
 */
export { ControlPanel } from "./ControlPanel.js";
export type { ExperienceMode } from "./ControlPanel.js";
export { EventLogViewer } from "./EventLogViewer.js";
export { useOfficeState } from "./useOfficeState.js";
export type { OfficeState } from "./useOfficeState.js";

// Panel primitives for reuse across views.
export { Card } from "./components/Card.js";
export { Badge } from "./components/Badge.js";
export type { BadgeIntent } from "./components/Badge.js";
export { SectionHeader } from "./components/SectionHeader.js";
export { ApprovalDrawer } from "./components/ApprovalDrawer.js";
export { TaskForm } from "./components/TaskForm.js";
export { ErrorBanner } from "./components/ErrorBanner.js";
export { formatTime } from "./components/format-time.js";

export * from "./integration/index.js";
