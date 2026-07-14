/**
 * Runtime composition types for demo-office.
 *
 * The app can run against either a Mock adapter (deterministic local),
 * an HTTP/SSE adapter (remote runtime speaking the generic wire protocol),
 * or a GitHub adapter (read-only projection backed by issues/PRs).
 */

export type RuntimeMode = "mock" | "http-sse" | "github";

export interface DemoRuntimeConfig {
  mode: RuntimeMode;
  runtimeId: string;
  /** Required when mode === "http-sse". */
  baseUrl?: string;
  /** Base URL for the LifeSim HTTP client. Defaults to `/life-sim` so the Vite dev proxy can handle it. */
  lifeSimBaseUrl: string;
  /** Required only when mode === "github" for network write commands. */
  githubOwner?: string;
  /** Required only when mode === "github" for network write commands. */
  githubRepo?: string;
  /** Optional GitHub token for network write commands. */
  githubToken?: string;
}

/**
 * Result of createRuntime(): the four runtime objects + a dispose function.
 * All four are constructed exactly once per app lifecycle.
 */
export interface RuntimeComposition {
  adapter: import("@agent-office/protocol").RuntimeAdapter;
  store: import("@agent-office/core").SnapshotStore;
  gateway: import("@agent-office/core").CommandGateway;
  session: import("@agent-office/core").RuntimeSession;
  /** Disconnect the session exactly once. Idempotent. */
  dispose: () => Promise<void>;
}
