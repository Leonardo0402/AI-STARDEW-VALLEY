import type { Plugin } from "vite";
import { loadEnv } from "vite";
import type { RuntimeAdapter } from "@agent-office/protocol";
import type {
  LifeSimEngine,
  LifeSimEngineConfig,
  RuntimeLifeSimBridge,
} from "@agent-office/life-sim";

/**
 * Create a Vite dev-server plugin that hosts an in-process LifeSimEngine
 * under `/life-sim/{worldId}/*`.
 *
 * The engine is bridged to the office runtime so that runtime events
 * (task assignments, agent status changes, etc.) feed into the life-sim
 * schedule overlay logic.
 *
 * All workspace package imports are deferred to `configureServer` so that
 * Vite's config loader (which cannot resolve `.js` extension remapping for
 * source-direct workspace packages) does not try to load them while parsing
 * `vite.config.ts`.
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
      const bridge = await createRuntimeBridge(mode, runtimeId, baseUrl, engine);

      server.middlewares.use(`/life-sim/${worldId}`, (req, res, next) => {
        if (!req.url) {
          return next();
        }
        // Restore the full path so the LifeSim router can parse worldId and action.
        req.url = `/life-sim/${worldId}${req.url}`;
        void router.handle(req, res);
      });

      server.httpServer?.on("close", () => {
        bridge?.disconnect();
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
  mode: "mock" | "http-sse",
  runtimeId: string,
  baseUrl: string | undefined,
  engine: LifeSimEngine
): Promise<RuntimeLifeSimBridge | null> {
  const [{ MockRuntimeAdapter }, { HttpSseRuntimeAdapter }, { RuntimeSession, SnapshotStore, CommandGateway }, { RuntimeLifeSimBridge, createLifeSimRouter }] =
    await Promise.all([
      import("@agent-office/adapter-mock"),
      import("@agent-office/adapter-http-sse"),
      import("@agent-office/core"),
      import("@agent-office/life-sim"),
    ]);

  if (mode === "mock") {
    const adapter = new MockRuntimeAdapter({ eventDelayMs: 250 });
    return startBridge(
      adapter,
      runtimeId,
      engine,
      RuntimeSession,
      SnapshotStore,
      CommandGateway,
      RuntimeLifeSimBridge
    );
  }

  if (mode === "http-sse") {
    if (!baseUrl) {
      throw new Error(
        "VITE_RUNTIME_BASE_URL is required when VITE_RUNTIME_MODE=http-sse"
      );
    }
    const adapter = new HttpSseRuntimeAdapter({ baseUrl, runtimeId });
    return startBridge(
      adapter,
      runtimeId,
      engine,
      RuntimeSession,
      SnapshotStore,
      CommandGateway,
      RuntimeLifeSimBridge
    );
  }

  return null;
}

async function startBridge(
  adapter: RuntimeAdapter,
  runtimeId: string,
  engine: LifeSimEngine,
  RuntimeSessionCtor: typeof import("@agent-office/core").RuntimeSession,
  SnapshotStoreCtor: typeof import("@agent-office/core").SnapshotStore,
  CommandGatewayCtor: typeof import("@agent-office/core").CommandGateway,
  RuntimeLifeSimBridgeCtor: typeof RuntimeLifeSimBridge
): Promise<RuntimeLifeSimBridge> {
  const store = new SnapshotStoreCtor(runtimeId);
  const gateway = new CommandGatewayCtor(adapter);
  const session = new RuntimeSessionCtor(adapter, store, gateway);
  await session.connect();
  const bridge = new RuntimeLifeSimBridgeCtor(session, engine);
  bridge.connect();
  return bridge;
}
