import http from "node:http";
import type { RuntimeSnapshot, DomainEvent, OfficeCommand, CommandResult, AdapterCapabilities } from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";

export interface FakeServerOptions {
  port?: number;
  runtimeId: string;
}

/**
 * Test-only in-memory HTTP server. Implements the Plan 2 wire protocol:
 *   GET  /runtime/snapshot       — returns snapshot JSON
 *   GET  /runtime/capabilities   — returns capabilities JSON
 *   GET  /runtime/events?afterSequence=N — opens SSE stream, replays events
 *                                          with seq > N, sends replay-complete,
 *                                          then registers as live client
 *   POST /runtime/commands       — dispatches to commandHandler
 *
 * Sends `event: replay-complete` after replay (Architecture Decision H).
 * Exposes counters and delay/error hooks for integration tests.
 */
export class FakeServer {
  private server: http.Server;
  private port: number;
  private snapshot: RuntimeSnapshot;
  private events: DomainEvent[] = [];
  private capabilities: AdapterCapabilities;
  private commandHandler: (cmd: OfficeCommand) => Promise<CommandResult>;
  private liveClients: Array<{ res: http.ServerResponse; afterSequence: number }> = [];

  // ─── Request counters (for no-cache and single-flight assertions) ───
  public snapshotRequestCount = 0;
  public capabilitiesRequestCount = 0;
  public commandRequestCount = 0;
  public streamOpenRequestCount = 0;
  public lastEventRequestHeaders: Record<string, string> = {};

  // ─── Delay controls (for disconnect-during-X tests) ───
  public snapshotDelayMs = 0;
  public commandDelayMs = 0;
  public streamOpenDelayMs = 0;

  // ─── Error injection hooks ───
  public snapshotErrorStatus: number | null = null;
  public capabilitiesErrorStatus: number | null = null;
  /** If true, do NOT send replay-complete (protocol violation test). */
  public omitReplayComplete = false;
  /** If set, send replay-complete with this lastSequence (for id/data mismatch test). */
  public replayCompleteLastSequenceOverride: number | null = null;
  /** If set, send a malformed event frame during replay (for event_invalid test). */
  public malformedReplayFrame: string | null = null;

  constructor(opts: FakeServerOptions) {
    this.port = opts.port ?? 0; // 0 = ephemeral
    const emptySnap: RuntimeSnapshot = {
      runtimeId: opts.runtimeId, snapshotId: "snap-init", sequence: 0, schemaVersion: "1.0",
      createdAt: new Date().toISOString(), lastEventId: "",
      agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
    };
    this.snapshot = emptySnap;
    this.capabilities = {
      supportedEvents: [], supportedCommands: Object.values(CommandType),
      features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false },
    };
    this.commandHandler = async (cmd) => ({
      commandId: cmd.commandId, status: "accepted" as const, affectedEventIds: [],
    });
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
    for (const c of this.liveClients) {
      try { c.res.end(); } catch { /* best-effort */ }
    }
    this.liveClients = [];
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  getBaseUrl(): string { return `http://localhost:${this.port}`; }

  // ─── State setters ───
  setSnapshot(snap: RuntimeSnapshot): void { this.snapshot = snap; }
  setEvents(events: DomainEvent[]): void { this.events = events; }
  setCapabilities(caps: AdapterCapabilities): void { this.capabilities = caps; }
  setCommandHandler(fn: (cmd: OfficeCommand) => Promise<CommandResult>): void { this.commandHandler = fn; }

  // ─── Live client controls ───

  /** Push a live event to all live clients (after replay-complete). */
  pushEvent(event: DomainEvent): void {
    for (const c of this.liveClients) {
      if (event.sequence > c.afterSequence) {
        try {
          c.res.write(`event: domain-event\nid: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);
        } catch { /* best-effort */ }
      }
    }
  }

  /** Push a raw SSE frame string to all live clients (for malformed event injection). */
  pushRawFrame(frame: string): void {
    for (const c of this.liveClients) {
      try { c.res.write(frame); } catch { /* best-effort */ }
    }
  }

  /** Destroy all live SSE connections (simulates server-side network drop). */
  async disconnectAllLiveClients(): Promise<void> {
    for (const c of this.liveClients) {
      try {
        c.res.destroy();
        // Also destroy the underlying socket — res.destroy() alone may not
        // propagate to the client's reader in Node 22 SSE streams.
        c.res.socket?.destroy();
      } catch { /* best-effort */ }
    }
    this.liveClients = [];
  }

  getLiveClientCount(): number { return this.liveClients.length; }
  getLastEventRequestHeader(name: string): string | undefined {
    return this.lastEventRequestHeaders[name.toLowerCase()];
  }

  // ─── Request handler ───

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? "";

    // GET /runtime/snapshot
    if (req.method === "GET" && url.endsWith("/runtime/snapshot")) {
      this.snapshotRequestCount += 1;
      if (this.snapshotDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.snapshotDelayMs));
      }
      if (this.snapshotErrorStatus !== null) {
        res.writeHead(this.snapshotErrorStatus);
        res.end(`{"error":"snapshot ${this.snapshotErrorStatus}"}`);
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.snapshot));
      return;
    }

    // GET /runtime/capabilities
    if (req.method === "GET" && url.endsWith("/runtime/capabilities")) {
      this.capabilitiesRequestCount += 1;
      if (this.capabilitiesErrorStatus !== null) {
        res.writeHead(this.capabilitiesErrorStatus);
        res.end(`{"error":"capabilities ${this.capabilitiesErrorStatus}"}`);
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.capabilities));
      return;
    }

    // GET /runtime/events?afterSequence=N
    if (req.method === "GET" && url.includes("/runtime/events")) {
      this.streamOpenRequestCount += 1;
      // Capture request headers (for auth-refresh assertions)
      this.lastEventRequestHeaders = {};
      for (const key of Object.keys(req.headers)) {
        this.lastEventRequestHeaders[key.toLowerCase()] = String(req.headers[key]);
      }
      if (this.streamOpenDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.streamOpenDelayMs));
      }
      const afterSeq = parseInt(new URL(`http://x${url}`).searchParams.get("afterSequence") ?? "0", 10);
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      // ─── Replay phase ───
      let lastReplayedSeq = afterSeq;
      for (const ev of this.events) {
        if (ev.sequence > afterSeq) {
          res.write(`event: domain-event\nid: ${ev.sequence}\ndata: ${JSON.stringify(ev)}\n\n`);
          lastReplayedSeq = ev.sequence;
        }
      }
      // Optional malformed frame during replay (for event_invalid test)
      if (this.malformedReplayFrame !== null) {
        res.write(this.malformedReplayFrame);
      }
      // ─── replay-complete control frame (Architecture Decision H) ───
      if (!this.omitReplayComplete) {
        const lastSeq = this.replayCompleteLastSequenceOverride ?? lastReplayedSeq;
        res.write(`event: replay-complete\nid: ${lastSeq}\ndata: {"lastSequence":${lastSeq}}\n\n`);
        // Register as live client for subsequent pushEvent/pushRawFrame calls.
        // Also listen for client-side disconnect so liveClients stays clean
        // (Plan Review Fix 15, v3) — without this, an adapter that closes
        // mid-stream leaves a stale entry that pollutes connection-count
        // assertions and later pushEvent calls.
        const clientEntry = { res, afterSequence: afterSeq };
        this.liveClients.push(clientEntry);
        res.on("close", () => {
          const idx = this.liveClients.indexOf(clientEntry);
          if (idx >= 0) this.liveClients.splice(idx, 1);
        });
      } else {
        // Plan Review Fix 13, v3: when omitReplayComplete is set, the server
        // MUST close the connection after sending the replay events (without
        // the replay-complete frame). Without this, the stream stays open,
        // `ready` never settles, and the Session is stuck in `synchronizing`
        // forever — never reaching `failed`. Closing here causes the adapter's
        // reader to see `done=true` without a `replay-complete` frame, which
        // per Architecture Decision H rejects `ready` with `stream_protocol_error`,
        // transitioning the Session to `failed` as the test expects.
        // Do NOT register as a live client — the stream is intentionally terminal.
        try { res.end(); } catch { /* best-effort */ }
      }
      return;
    }

    // POST /runtime/commands
    if (req.method === "POST" && url.endsWith("/runtime/commands")) {
      this.commandRequestCount += 1;
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        if (this.commandDelayMs > 0) {
          await new Promise((r) => setTimeout(r, this.commandDelayMs));
        }
        try {
          const cmd = JSON.parse(body) as OfficeCommand;
          const result = await this.commandHandler(cmd);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500);
          res.end(String(err));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("not found");
  }
}
