/**
 * @agent-office/core — 核心运行时逻辑。
 *
 * 不依赖任何 UI 框架（React、PixiJS）。
 * 依赖 @agent-office/protocol。
 */
export { reduceEvent, replayEvents, createEmptySnapshot } from "./reducer.js";
export type { ReducerResult } from "./reducer.js";
export {
  isValidAgentTransition,
  isValidTaskTransition,
  isValidArtifactTransition,
  isValidApprovalTransition,
} from "./state-machine.js";
export { EventDeduplicator } from "./dedup.js";
export { SnapshotStore } from "./store.js";
export type { SnapshotStoreListener } from "./store.js";
export { CommandGateway } from "./gateway.js";
export { evaluateCommand, hasCapability, rejectedResult } from "./policy.js";
export type { PolicyDecision } from "./policy.js";
export { projectSnapshot } from "./projection.js";
