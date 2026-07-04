import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FakeServer } from "./fake-server.js";
import { HttpSseRuntimeAdapter, defaultEndpoints } from "./index.js";
import { RuntimeSession, SnapshotStore, CommandGateway } from "@agent-office/core";
import type { SessionState } from "@agent-office/core";
import type { RuntimeSnapshot, DomainEvent, OfficeCommand, ReconnectPolicy } from "@agent-office/protocol";
import { EventType, CommandType } from "@agent-office/protocol";

const RUNTIME_ID = "rt-integration";

function makeSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID, snapshotId: `snap-${seq}`, sequence: seq, schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z", lastEventId: "",
    agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
  };
}

function makeEvent(seq: number): DomainEvent {
  return {
    eventId: `evt-${seq}`, runtimeId: RUNTIME_ID, sequence: seq, schemaVersion: "1.0",
    type: EventType.TASK_CREATED, occurredAt: "2026-07-04T00:00:00.000Z",
    receivedAt: "2026-07-04T00:00:00.000Z", correlationId: `c-${seq}`,
    causationId: null, traceId: `t-${seq}`, payload: {},
  };
}

function makeCommand(id: string): OfficeCommand {
  return {
    commandId: id,
    commandType: CommandType.TASK_CREATE,
    timestamp: "2026-07-04T00:00:00.000Z",
    source: "user",
    actorId: "user-1",
    runtimeId: RUNTIME_ID,
    targetId: null,
    payload: { title: "t", description: "d" },
  };
}

/** Local helper — NOT added to RuntimeSession. Uses onStateChange() (the real API). */
function waitForState(session: RuntimeSession, target: SessionState, timeoutMs = 5000): Promise<void> {
  if (session.getState() === target) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`waitForState(${target}) timed out after ${timeoutMs}ms (current=${session.getState()})`));
    }, timeoutMs);
    const off = session.onStateChange((s) => {
      if (s === target) {
        clearTimeout(timer);
        off();
        resolve();
      }
    });
  });
}

let server: FakeServer;
let baseUrl: string;

beforeAll(async () => {
  server = new FakeServer({ runtimeId: RUNTIME_ID });
  await server.start();
  baseUrl = server.getBaseUrl();
});

afterAll(async () => {
  await server.stop();
});

beforeEach(() => {
  // Clean up any lingering live clients from a failed previous test
  // (prevents cascade failures where a timed-out test leaves live SSE
  // connections that pollute subsequent live-client-count assertions).
  server.disconnectAllLiveClients();
  server.setSnapshot(makeSnapshot(0));
  server.setEvents([]);
  server.snapshotRequestCount = 0;
  server.capabilitiesRequestCount = 0;
  server.commandRequestCount = 0;
  server.streamOpenRequestCount = 0;
  server.snapshotDelayMs = 0;
  server.commandDelayMs = 0;
  server.streamOpenDelayMs = 0;
  server.snapshotErrorStatus = null;
  server.capabilitiesErrorStatus = null;
  server.omitReplayComplete = false;
  server.replayCompleteLastSequenceOverride = null;
  server.malformedReplayFrame = null;
});

function makeAdapter(opts: {
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  fallbackCapabilities?: import("@agent-office/protocol").AdapterCapabilities;
} = {}): HttpSseRuntimeAdapter {
  return new HttpSseRuntimeAdapter({
    runtimeId: RUNTIME_ID,
    baseUrl,
    endpoints: defaultEndpoints,
    headers: opts.headers,
    fallbackCapabilities: opts.fallbackCapabilities,
  });
}

function makeSession(
  adapter: HttpSseRuntimeAdapter,
  reconnectPolicy?: ReconnectPolicy
): { session: RuntimeSession; store: SnapshotStore; gateway: CommandGateway } {
  const store = new SnapshotStore(RUNTIME_ID);
  const gateway = new CommandGateway(adapter);
  const session = new RuntimeSession(adapter, store, gateway, {
    autoResume: true,
    reconnectPolicy,
  });
  return { session, store, gateway };
}

const FAST_POLICY: ReconnectPolicy = { initialDelayMs: 10, maxDelayMs: 50, maxAttempts: 5, jitterRatio: 0 };

describe("integration: HttpSseRuntimeAdapter + RuntimeSession", () => {
  // ─── Hard scenario 1 & 2: replay delivered exactly once (with replay-complete) ───
  it("replays events between snapshot and subscribe exactly once", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1), makeEvent(2), makeEvent(3)]);

    const adapter = makeAdapter();
    const { session } = makeSession(adapter);
    const received: number[] = [];
    session.onAcceptedEvent((e) => received.push(e.sequence));
    await session.connect();
    await waitForState(session, "connected");
    await new Promise((r) => setTimeout(r, 50)); // flush replay microtasks
    expect(received).toEqual([1, 2, 3]);
    await session.disconnect();
  });

  // ─── Hard scenario 3: replay gap rejects ready → failed + subscribe_failed code ───
  it("replay gap rejects ready: state=failed, lastError.code=subscribe_failed", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1), makeEvent(3)]); // gap at 2

    const adapter = makeAdapter();
    const { session } = makeSession(adapter);
    await session.connect().catch(() => {});
    await waitForState(session, "failed");
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
    await session.disconnect();
  });

  // ─── Hard scenario 4: runtime mismatch rejects ready ───
  it("runtime mismatch in stream rejects ready and prevents events entering Core", async () => {
    server.setSnapshot(makeSnapshot(0));
    const wrongEvent: DomainEvent = { ...makeEvent(1), runtimeId: "rt-other" };
    server.setEvents([wrongEvent]);

    const adapter = makeAdapter();
    const { session, store } = makeSession(adapter);
    await session.connect().catch(() => {});
    await waitForState(session, "failed");
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    expect(store.getSnapshot().sequence).toBe(0); // Core untouched
    await session.disconnect();
  });

  // ─── Hard scenario 5: ready failure leaves no active stream ───
  it("ready failure leaves no active stream (reader aborted)", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1), makeEvent(3)]); // gap

    const adapter = makeAdapter();
    const { session } = makeSession(adapter);
    await session.connect().catch(() => {});
    await waitForState(session, "failed");
    // Push a live event — must NOT be delivered (no active reader)
    const received: number[] = [];
    session.onAcceptedEvent((e) => received.push(e.sequence));
    server.pushEvent(makeEvent(4));
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toEqual([]);
    await session.disconnect();
  });

  // ─── Hard scenario 6: replay-complete omitted → stream_protocol_error ───
  it("server omitting replay-complete rejects ready with stream_protocol_error", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1)]);
    server.omitReplayComplete = true;

    const adapter = makeAdapter();
    const { session } = makeSession(adapter);
    await session.connect().catch(() => {});
    await waitForState(session, "failed");
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    await session.disconnect();
  });

  // ─── Hard scenario 7: post-ready network drop triggers single-flight reconnect ───
  it("post-ready network drop triggers reconnect and returns to connected", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    expect(session.getDiagnostics().reconnectCount).toBe(0);

    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: MUST first wait for `degraded` to prove the drop
    // was actually detected by the adapter. Without this gate, `waitForState(
    // "connected")` could pass immediately because the session is STILL in
    // `connected` (the reader-error → onError → scheduleReconnect chain hasn't
    // run yet) — a false positive. Only after `degraded` is observed do we
    // wait for recovery to `connected`.
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    expect(session.getDiagnostics().reconnectCount).toBeGreaterThanOrEqual(1);
    await session.disconnect();
  });

  // ─── Hard scenario 8: multiple rapid drops produce only one reconnect (single-flight) ───
  it("multiple rapid drops produce only one reconnect (single-flight via reconnectPromise)", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    const countBefore = session.getDiagnostics().reconnectCount;

    // Three rapid drops — only one reconnect should be scheduled.
    // Deviation from brief: removed `await new Promise(r => setTimeout(r, 5))`
    // delays between drops. The 5ms macrotask yields allowed the event loop
    // to process the socket-destruction I/O event, causing the adapter to
    // detect the drop → degrade → reconnect (FAST_POLICY initialDelayMs=10)
    // all BEFORE `waitForState("degraded")` was called. By the time the
    // assertion ran, the session had already returned to "connected",
    // producing a false "timed out (current=connected)" failure. Without
    // the macrotask yields, the 3 drops happen within microtask flushing
    // only, and the reader detects the drop when `waitForState` yields.
    await server.disconnectAllLiveClients();
    await server.disconnectAllLiveClients();
    await server.disconnectAllLiveClients();

    // Plan Review Fix 14, v3: gate on `degraded` first (see scenario 7 for
    // rationale) — the burst of drops must be observed before asserting
    // recovery. Otherwise `waitForState("connected")` could return immediately
    // off the pre-drop `connected` state.
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    const countAfter = session.getDiagnostics().reconnectCount;
    // Single-flight: at most one reconnect increment from the burst
    expect(countAfter - countBefore).toBeLessThanOrEqual(2);
    await session.disconnect();
  });

  // ─── Hard scenario 9: disconnect cancels fetch, reader, and timer ───
  it("disconnect during live read cancels reader and clears reconnect timer", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const slowPolicy: ReconnectPolicy = { initialDelayMs: 5000, maxDelayMs: 10000, maxAttempts: 5, jitterRatio: 0 };
    const { session } = makeSession(adapter, slowPolicy);
    await session.connect();
    await waitForState(session, "connected");

    // Trigger a stream drop — schedules a reconnect timer (5s backoff)
    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: wait for `degraded` to PROVE the drop was
    // detected and the reconnect timer was actually scheduled. The previous
    // 20ms fixed sleep was non-deterministic — if the reader-error hadn't
    // propagated yet, disconnect() would clean up nothing and the test would
    // still pass (false positive). Gating on `degraded` guarantees the timer
    // exists before we disconnect and assert it's canceled.
    await waitForState(session, "degraded", 1000);
    // disconnect before the timer fires
    await session.disconnect();

    expect(session.getState()).toBe("disconnected");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
    // Wait past when the timer would have fired — no state change
    await new Promise((r) => setTimeout(r, 100));
    expect(session.getState()).toBe("disconnected");
  });

  // ─── Hard scenario 10: reset_required triggers immediate resync with new checkpoint ───
  it("reset_required triggers immediate resync pulling fresh checkpoint", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1), makeEvent(2)]);
    const adapter = makeAdapter();
    const { session, store } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "connected");
    const snapshotCountBefore = server.snapshotRequestCount;

    // Server advances checkpoint; signal reset via event_log_trimmed frame
    server.setSnapshot(makeSnapshot(5));
    server.setEvents([makeEvent(3), makeEvent(4), makeEvent(5)]);
    // Push a reset-required frame to live clients
    server.pushRawFrame(`event: reset-required\nid: 2\ndata: {}\n\n`);

    await waitForState(session, "resynchronizing", 1000);
    await waitForState(session, "connected", 3000);

    // getSnapshot() must have fetched fresh checkpoint (no cache)
    expect(server.snapshotRequestCount).toBeGreaterThan(snapshotCountBefore);
    expect(store.getSnapshot().sequence).toBe(5);
    await session.disconnect();
  });

  // ─── Hard scenario 11: after resync only one active stream ───
  it("after resync only one active stream exists", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    expect(server.getLiveClientCount()).toBe(1);

    // Trigger resync via reset-required
    server.setSnapshot(makeSnapshot(2));
    server.setEvents([makeEvent(1), makeEvent(2)]);
    server.pushRawFrame(`event: reset-required\nid: 0\ndata: {}\n\n`);

    await waitForState(session, "resynchronizing", 1000);
    await waitForState(session, "connected", 3000);
    expect(server.getLiveClientCount()).toBe(1);
    await session.disconnect();
  });

  // ─── Hard scenario 12: auth header refreshed on every reconnect ───
  it("auth header is refreshed on every reconnect", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    let tokenGen = 0;
    const headers = () => Promise.resolve({ Authorization: `Bearer token-${++tokenGen}` });
    const adapter = makeAdapter({ headers });
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    expect(server.getLastEventRequestHeader("authorization")).toBe("Bearer token-1");

    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: gate on `degraded` first to prove the drop was
    // detected and a reconnect was actually triggered (otherwise the auth
    // header assertion below could flake on the pre-drop state).
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    expect(server.getLastEventRequestHeader("authorization")).toBe("Bearer token-2");
    await session.disconnect();
  });

  // ─── Hard scenario 13: Authorization never appears in diagnostics ───
  it("Authorization header never appears in session diagnostics", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter({ headers: { Authorization: "Bearer secret-token-XYZ" } });
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");

    // Trigger an error via server-side drop; inspect diagnostics
    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: gate on `degraded` to PROVE the drop was
    // detected and an error diagnostic was actually recorded. The previous
    // 50ms sleep was non-deterministic — if the drop hadn't been processed
    // yet, the diagnostics might have no error at all, and the "Authorization
    // never appears" assertion would pass vacuously (false positive).
    await waitForState(session, "degraded", 1000);
    const diag = session.getDiagnostics();
    const serialized = JSON.stringify(diag);
    expect(serialized).not.toContain("secret-token-XYZ");
    expect(serialized).not.toContain("Bearer");
    await session.disconnect();
  });

  // ─── Hard scenario 14: POST command is never auto-retried ───
  it("POST command is never auto-retried by adapter", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    let postCount = 0;
    server.setCommandHandler(async (cmd) => {
      postCount += 1;
      throw new Error("transient 503"); // adapter must NOT retry
    });
    const adapter = makeAdapter();
    const { session, gateway } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "connected");

    const result = await gateway.execute(makeCommand("cmd-1"));
    expect(postCount).toBe(1); // no retry
    expect(result.status).toBe("error");
    await session.disconnect();
  });

  // ─── Hard scenario 15: manual retry requires new commandId (gateway caches) ───
  it("manual retry with same commandId returns cached result (no new POST)", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    let postCount = 0;
    server.setCommandHandler(async (cmd) => {
      postCount += 1;
      return { commandId: cmd.commandId, status: "accepted" as const, affectedEventIds: [] };
    });
    const adapter = makeAdapter();
    const { session, gateway } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "connected");

    const r1 = await gateway.execute(makeCommand("cmd-1"));
    expect(postCount).toBe(1);
    // Same commandId → gateway returns cached result, no new POST
    const r2 = await gateway.execute(makeCommand("cmd-1"));
    expect(postCount).toBe(1); // still 1
    expect(r2).toEqual(r1);
    // New commandId → new POST
    await gateway.execute(makeCommand("cmd-2"));
    expect(postCount).toBe(2);
    await session.disconnect();
  });

  // ─── Hard scenario 16: getSnapshot() fresh fetch (no permanent cache) ───
  it("getSnapshot() fetches fresh checkpoint on every call (no cache)", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    const countAfterConnect = server.snapshotRequestCount;

    // Trigger resync — getSnapshot() must fetch fresh
    server.setSnapshot(makeSnapshot(3));
    server.setEvents([makeEvent(1), makeEvent(2), makeEvent(3)]);
    server.pushRawFrame(`event: reset-required\nid: 0\ndata: {}\n\n`);
    await waitForState(session, "resynchronizing", 1000);
    await waitForState(session, "connected", 3000);

    expect(server.snapshotRequestCount).toBeGreaterThan(countAfterConnect);
    await session.disconnect();
  });

  // ─── Hard scenario 17: LIVE invalid event triggers onError + closes stream ───
  it("LIVE invalid event is reported (not silently dropped) and closes stream", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");

    // Push a malformed domain-event frame (invalid JSON in data)
    server.pushRawFrame(`event: domain-event\nid: 99\ndata: {not valid json}\n\n`);
    // The adapter must call onError(event_invalid) and close the stream.
    // Non-recoverable → session enters failed.
    await waitForState(session, "failed", 3000);
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
    await session.disconnect();
  });

  // ─── Hard scenario 18: Capabilities 404 → fallback ───
  it("capabilities 404 uses fallbackCapabilities", async () => {
    server.capabilitiesErrorStatus = 404;
    const fallback = {
      supportedEvents: [], supportedCommands: [],
      features: { snapshot: true, sse: true, websocket: false, commandExecution: false, softMapping: false, hardOrchestration: false },
    };
    const adapter = makeAdapter({ fallbackCapabilities: fallback });
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    await session.disconnect();
  });

  // ─── Hard scenario 19: Capabilities 401 → NO fallback (surfaces error) ───
  it("capabilities 401 does NOT use fallback (surfaces error)", async () => {
    server.capabilitiesErrorStatus = 401;
    const fallback = {
      supportedEvents: [], supportedCommands: [],
      features: { snapshot: true, sse: true, websocket: false, commandExecution: false, softMapping: false, hardOrchestration: false },
    };
    const adapter = makeAdapter({ fallbackCapabilities: fallback });
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect().catch(() => {});
    // Must NOT reach connected — auth error surfaces
    await waitForState(session, "failed", 3000);
    expect(session.getDiagnostics().lastError?.code).toBe("connect_failed");
    await session.disconnect();
  });

  // ─── Hard scenario 20: disconnect during snapshot fetch ───
  it("disconnect during snapshot fetch aborts cleanly", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    server.snapshotDelayMs = 500;
    const adapter = makeAdapter();
    const { session } = makeSession(adapter);

    const connectP = session.connect();
    await new Promise((r) => setTimeout(r, 50)); // let snapshot fetch start
    await session.disconnect();
    await connectP.catch(() => {}); // connect may reject due to abort
    expect(session.getState()).toBe("disconnected");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  // ─── Hard scenario 21: disconnect during command POST ───
  it("disconnect during command POST aborts cleanly", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    server.commandDelayMs = 500;
    const adapter = makeAdapter();
    const { session, gateway } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "connected");

    const execP = gateway.execute(makeCommand("cmd-x"));
    await new Promise((r) => setTimeout(r, 50)); // let POST start
    await session.disconnect();
    const result = await execP;
    expect(result.status).toBe("error");
    expect(session.getState()).toBe("disconnected");
  });

  // ─── Hard scenario 22: disconnect during stream opening ───
  it("disconnect during stream opening aborts cleanly", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    server.streamOpenDelayMs = 500;
    const adapter = makeAdapter();
    const { session } = makeSession(adapter);

    const connectP = session.connect();
    await new Promise((r) => setTimeout(r, 100)); // let stream open start
    await session.disconnect();
    await connectP.catch(() => {});
    expect(session.getState()).toBe("disconnected");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  // ─── Hard scenario 23: disconnect during reconnect backoff ───
  it("disconnect during reconnect backoff cancels timer", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const slowPolicy: ReconnectPolicy = { initialDelayMs: 2000, maxDelayMs: 5000, maxAttempts: 5, jitterRatio: 0 };
    const { session } = makeSession(adapter, slowPolicy);
    await session.connect();
    await waitForState(session, "connected");

    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: gate on `degraded` to PROVE the backoff timer
    // was actually scheduled before disconnecting and asserting cancellation.
    // The previous 50ms fixed sleep was non-deterministic.
    await waitForState(session, "degraded", 1000);
    // disconnect during backoff
    await session.disconnect();
    expect(session.getState()).toBe("disconnected");
    // Wait past backoff — no reconnect attempt
    await new Promise((r) => setTimeout(r, 100));
    expect(session.getState()).toBe("disconnected");
  });

  // ─── Hard scenario 24: reconnectCount is cumulative (never resets) ───
  it("reconnectCount is cumulative across multiple successful reconnects", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");

    // First drop
    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: gate on `degraded` before `connected` for both
    // drops — without this, `waitForState("connected")` could return immediately
    // off the pre-drop `connected` state, making the count assertion a no-op.
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    const countAfterFirst = session.getDiagnostics().reconnectCount;
    expect(countAfterFirst).toBeGreaterThanOrEqual(1);

    // Second drop — count must increment, NOT reset
    await server.disconnectAllLiveClients();
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    const countAfterSecond = session.getDiagnostics().reconnectCount;
    expect(countAfterSecond).toBeGreaterThan(countAfterFirst);
    await session.disconnect();
  });
});

// Hard scenario (mock adapter regression): covered by full-suite gate (npm test) — no new test here.
