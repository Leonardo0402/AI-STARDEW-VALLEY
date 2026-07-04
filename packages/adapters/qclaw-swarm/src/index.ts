/**
 * @agent-office/qclaw-swarm — QClaw/Swarm-style test runtime.
 *
 * Exposes the generic HTTP/SSE wire protocol (runtime-contract.md §4.3)
 * with QClaw-style execution semantics. Connect via
 * `@agent-office/adapter-http-sse`.
 */
export { QclawTestRuntime } from "./qclaw-runtime.js";
export type { QclawRuntimeOptions } from "./qclaw-runtime.js";
