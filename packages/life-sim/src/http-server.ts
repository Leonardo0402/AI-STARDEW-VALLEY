import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import type { RuntimeSession } from "@agent-office/core";
import { createLifeSimEngine } from "./engine.js";
import { createLifeSimRouter } from "./http-router.js";
import { RuntimeLifeSimBridge } from "./runtime-bridge.js";
import { FileLifeSimStore, InMemoryLifeSimStore } from "./store.js";
import type { LifeSimEngineConfig, LifeSimStore } from "./types.js";

export interface LifeSimServerOptions {
  port: number;
  runtimeSession?: RuntimeSession;
  dataDir?: string;
}

export interface LifeSimServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  getBaseUrl(): string;
}

export interface CliOptions {
  port: number;
  dataDir?: string;
}

export function parseCliArgs(argv: string[]): CliOptions {
  let port = 3457;
  let dataDir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port") {
      const value = argv[++i];
      if (value === undefined) throw new Error("Missing value for --port");
      port = parsePort(value);
    } else if (arg === "--data-dir") {
      const value = argv[++i];
      if (value === undefined) throw new Error("Missing value for --data-dir");
      dataDir = value;
    } else if (arg.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length));
    } else if (arg.startsWith("--data-dir=")) {
      dataDir = arg.slice("--data-dir=".length);
    }
  }

  return { port, dataDir };
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

export async function createLifeSimServer(
  config: LifeSimEngineConfig,
  options: LifeSimServerOptions
): Promise<LifeSimServer> {
  const store: LifeSimStore = options.dataDir
    ? new FileLifeSimStore(config.worldId, options.dataDir)
    : new InMemoryLifeSimStore();
  const engine = await createLifeSimEngine(config, { store });
  const router = createLifeSimRouter(engine);
  const bridge = options.runtimeSession ? new RuntimeLifeSimBridge(options.runtimeSession, engine) : null;

  let server: Server | null = null;
  let baseUrl = "";

  const lifeSimServer: LifeSimServer = {
    start: () =>
      new Promise<void>((resolve) => {
        bridge?.connect();
        server = createServer((req, res) => {
          void router.handle(req, res);
        });
        server.listen(options.port, "127.0.0.1", () => {
          const address = server!.address();
          if (address !== null && typeof address !== "string") {
            baseUrl = `http://127.0.0.1:${address.port}`;
          }
          resolve();
        });
      }),
    stop: () =>
      new Promise<void>((resolve) => {
        bridge?.disconnect();
        router.destroy();
        if (server) {
          server.close(() => {
            server = null;
            resolve();
          });
          if ("closeAllConnections" in server && typeof server.closeAllConnections === "function") {
            server.closeAllConnections();
          }
        } else {
          resolve();
        }
      }),
    getBaseUrl: () => {
      if (!baseUrl) {
        throw new Error("Server not started");
      }
      return baseUrl;
    },
  };

  return lifeSimServer;
}

const defaultConfig: LifeSimEngineConfig = {
  worldId: "default",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
};

export async function startLifeSimServerFromCli(
  argv: string[],
  config: LifeSimEngineConfig = defaultConfig
): Promise<LifeSimServer> {
  const { port, dataDir } = parseCliArgs(argv);
  const server = await createLifeSimServer(config, { port, dataDir });
  await server.start();
  // eslint-disable-next-line no-console
  console.log(`LifeSim dev server running at ${server.getBaseUrl()}`);
  return server;
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  void startLifeSimServerFromCli(process.argv.slice(2));
}
