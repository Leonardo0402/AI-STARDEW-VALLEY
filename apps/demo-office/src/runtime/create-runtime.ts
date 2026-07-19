import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import { HttpSseRuntimeAdapter } from "@agent-office/adapter-http-sse";
import { GitHubRuntimeAdapter } from "@agent-office/adapter-github";
import {
  SnapshotStore,
  CommandGateway,
  RuntimeSession,
  AgentReviewOrchestrator,
  RuleBasedReviewStrategy,
} from "@agent-office/core";
import type { RuntimeAdapter } from "@agent-office/protocol";
import type { DemoRuntimeConfig, RuntimeComposition } from "./types.js";

/**
 * Create the runtime composition: adapter + store + gateway + session.
 *
 * Constructs exactly one of each per call. The caller (main.tsx) holds the
 * result as a module-level singleton and calls dispose() on HMR/unmount.
 *
 * Does NOT call session.connect() — the caller is responsible for bootstrap,
 * so tests can construct without starting a server.
 */
export function createRuntime(config: DemoRuntimeConfig): RuntimeComposition {
  const adapter = createAdapter(config);
  const store = new SnapshotStore(config.runtimeId);
  const gateway = new CommandGateway(adapter);
  const session = new RuntimeSession(adapter, store, gateway);

  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    try {
      await session.disconnect();
    } catch {
      /* best-effort — already disconnected */
    }
  };

  return { adapter, store, gateway, session, dispose };
}

function createAdapter(config: DemoRuntimeConfig): RuntimeAdapter {
  switch (config.mode) {
    case "mock":
      return new MockRuntimeAdapter({ eventDelayMs: 250 });
    case "http-sse":
      return new HttpSseRuntimeAdapter({
        baseUrl: config.baseUrl!,
        runtimeId: config.runtimeId,
      });
    case "github": {
      const gh = new GitHubRuntimeAdapter({
        owner: config.githubOwner,
        repo: config.githubRepo,
        // apiClient is optional; omit means local commands only
      });
      return new AgentReviewOrchestrator(gh, { strategy: new RuleBasedReviewStrategy() });
    }
  }
}
