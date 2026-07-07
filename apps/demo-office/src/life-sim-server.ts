import type { Plugin } from "vite";
import { loadEnv } from "vite";
import type { RuntimeAdapter } from "@agent-office/protocol";
import type { RuntimeSession } from "@agent-office/core";
import type {
  LifeSimEngine,
  LifeSimEngineConfig,
  RuntimeLifeSimBridge,
} from "@agent-office/life-sim";

interface BridgeHandles {
  bridge: RuntimeLifeSimBridge;
  session: RuntimeSession;
  adapter: RuntimeAdapter;
}

/**
 * Create a Vite dev-server plugin that hosts an in-process LifeSimEngine
 * under `/life-sim/{worldId}/*`.
 *
 * All workspace package imports are deferred to `configureServer` so that
 * Vite's config loader (which cannot resolve `.js` extension remapping for
 * source-direct workspace packages) does not try to load them while parsing
 * `vite.config.ts`.
 *
 * In `http-sse` mode the engine is bridged to the remote office runtime so
 * that runtime events feed into the life-sim schedule overlay logic. In
 * `mock` mode there is no shared runtime process; the dev plugin still hosts
 * the LifeSimEngine router, but the engine runs manual-only.
 */
export function createLifeSimDevPlugin(worldId: string): Plugin {
  return {
    name: "life-sim-dev-server",
    async configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "VITE_");
      const rawMode = env.VITE_RUNTIME_MODE ?? "mock";
      const baseUrl = env.VITE_RUNTIME_BASE_URL;
      const runtimeId = env.VITE_RUNTIME_ID ?? worldId;

      if (rawMode !== "mock" && rawMode !== "http-sse") {
        throw new Error(
          `VITE_RUNTIME_MODE must be "mock" or "http-sse", got: "${rawMode}"`
        );
      }
      const mode = rawMode;

      const config: LifeSimEngineConfig = {
        worldId,
        startOfDayMinute: 480,
        endOfDayMinute: 1110,
      };

      const engine = await createEngine(config);
      const router = await createRouter(engine);

      let handles: BridgeHandles | null = null;
      if (mode === "http-sse") {
        if (!baseUrl) {
          throw new Error(
            "VITE_RUNTIME_BASE_URL is required when VITE_RUNTIME_MODE=http-sse"
          );
        }
        handles = await createRuntimeBridge(runtimeId, baseUrl, engine);
      }
      // Mock mode has no shared runtime process; the LifeSimEngine router is
      // still hosted by the dev plugin, but the engine runs manual-only.

      server.middlewares.use(`/life-sim/${worldId}`, (req, res, next) => {
        if (!req.url) {
          return next();
        }
        // Restore the full path so the LifeSim router can parse worldId and action.
        req.url = `/life-sim/${worldId}${req.url}`;
        void router.handle(req, res);
      });

      server.httpServer?.on("close", () => {
        handles?.bridge.disconnect();
        void handles?.session.disconnect();
        void handles?.adapter.disconnect();
        router.destroy();
      });
    },
  };
}

async function createEngine(config: LifeSimEngineConfig) {
  const { createLifeSimEngine, InMemoryLifeSimStore } = await import(
    "@agent-office/life-sim"
  );
  return createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });
}

async function createRouter(engine: LifeSimEngine) {
  const { createLifeSimRouter } = await import("@agent-office/life-sim");
  return createLifeSimRouter(engine);
}

async function createRuntimeBridge(
  runtimeId: string,
  baseUrl: string,
  engine: LifeSimEngine
): Promise<BridgeHandles> {
  const [{ HttpSseRuntimeAdapter }, { RuntimeSession, SnapshotStore, CommandGateway }, { RuntimeLifeSimBridge }] =
    await Promise.all([
      import("@agent-office/adapter-http-sse"),
      import("@agent-office/core"),
      import("@agent-office/life-sim"),
    ]);

  const adapter = new HttpSseRuntimeAdapter({ baseUrl, runtimeId });
  const store = new SnapshotStore(runtimeId);
  const gateway = new CommandGateway(adapter);
  const session = new RuntimeSession(adapter, store, gateway);
  await session.connect();
  const bridge = new RuntimeLifeSimBridge(session, engine);
  bridge.connect();
  return { bridge, session, adapter };
}
