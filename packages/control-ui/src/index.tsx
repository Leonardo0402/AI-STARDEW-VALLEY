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
