import http from "node:http";
import type { RuntimeSnapshot, AdapterCapabilities } from "@agent-office/protocol";
import { CommandType, ALL_EVENT_TYPES } from "@agent-office/protocol";

const RUNTIME_ID = "qclaw-swarm-runtime-001";

export interface QclawRuntimeOptions {
  port?: number;
}

/**
 * QClaw/Swarm-style test runtime. Exposes the generic HTTP/SSE wire protocol
 * (runtime-contract.md §4.3) with QClaw-style execution semantics.
 *
 * Endpoints:
 *   GET  /runtime/snapshot
 *   GET  /runtime/capabilities
 *   GET  /runtime/events?afterSequence=N
 *   POST /runtime/commands
 */
export class QclawTestRuntime {
  private server: http.Server;
  private port: number;
  private snapshot: RuntimeSnapshot;
  private capabilities: AdapterCapabilities;

  constructor(opts: QclawRuntimeOptions = {}) {
    this.port = opts.port ?? 0;
    const emptySnap: RuntimeSnapshot = {
      runtimeId: RUNTIME_ID,
      snapshotId: "snap-init",
      sequence: 0,
      schemaVersion: "1.0",
      createdAt: new Date().toISOString(),
      lastEventId: "",
      agents: [],
      tasks: [],
      artifacts: [],
      approvals: [],
      rooms: [],
    };
    this.snapshot = emptySnap;
    this.capabilities = {
      supportedEvents: [...ALL_EVENT_TYPES],
      supportedCommands: Object.values(CommandType),
      features: {
        snapshot: true,
        sse: true,
        websocket: false,
        commandExecution: true,
        softMapping: true,
        hardOrchestration: false,
      },
    };
    this.server = http.createServer((req, res) => this.handle(req, res));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        const addr = this.server.address();
        if (addr && typeof addr === "object") this.port = addr.port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? "";

    if (req.method === "GET" && url.endsWith("/runtime/snapshot")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.snapshot));
      return;
    }

    if (req.method === "GET" && url.endsWith("/runtime/capabilities")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.capabilities));
      return;
    }

    // Stub: /runtime/events and /runtime/commands will be implemented in later tasks.
    if (req.method === "GET" && url.includes("/runtime/events")) {
      res.writeHead(501);
      res.end('{"error":"not implemented yet"}');
      return;
    }

    if (req.method === "POST" && url.endsWith("/runtime/commands")) {
      res.writeHead(501);
      res.end('{"error":"not implemented yet"}');
      return;
    }

    res.writeHead(404);
    res.end("not found");
  }
}
