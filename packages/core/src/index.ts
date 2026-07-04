/**
 * @agent-office/core — 核心运行时逻辑。
 *
 * 不依赖任何 UI 框架（React、PixiJS）。
 * 依赖 @agent-office/protocol。
 */
export { reduceEvent, replayEvents, createEmptySnapshot } from "./reducer.js";
export type { ReducerResult } from "./reducer.js";
export type { ReducerError, ReducerErrorCode } from "@agent-office/protocol";
export type {
  RuntimeStreamState,
  RuntimeErrorCode,
  RuntimeStreamError,
  RuntimeStreamObserver,
  RuntimeSubscription,
} from "@agent-office/protocol";
export {
  isValidAgentTransition,
  isValidTaskTransition,
  isValidArtifactTransition,
  isValidApprovalTransition,
} from "./state-machine.js";
export { EventDeduplicator } from "./dedup.js";
export { SnapshotStore } from "./store.js";
export type { SnapshotStoreListener, InstallCheckpointResult } from "./store.js";
export { RuntimeSession } from "./session.js";
export type {
  SessionState,
  SessionStateListener,
  SessionDiagnostics,
  GapDiagnostic,
  RuntimeSessionOptions,
  AcceptedEventListener,
  SessionErrorCode,
  SessionError,
} from "./session.js";
export { CommandGateway } from "./gateway.js";
export { evaluateCommand, hasCapability, rejectedResult } from "./policy.js";
export type { PolicyDecision } from "./policy.js";
export { projectSnapshot } from "./projection.js";
