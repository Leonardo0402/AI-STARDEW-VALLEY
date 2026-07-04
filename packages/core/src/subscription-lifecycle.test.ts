import { describe, it, expect, beforeEach } from "vitest";
import { TestRuntimeAdapter } from "./test-adapter.js";
import { RuntimeSession } from "./session.js";
import { SnapshotStore } from "./store.js";
import { CommandGateway } from "./gateway.js";
import {
  EventType,
  type DomainEvent,
  type RuntimeSnapshot,
  type RuntimeStreamError,
} from "@agent-office/protocol";

const RUNTIME_ID = "rt-lifecycle";

function makeSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID,
    snapshotId: `snap-${seq}`,
    sequence: seq,
    schemaVersion: "1.0",
    createdAt: new Date().toISOString(),
    lastEventId: "",
    agents: [],
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [],
  };
}

function makeEvent(seq: number, runtimeId = RUNTIME_ID): DomainEvent {
  return {
    eventId: `evt-${seq}`,
    runtimeId,
    sequence: seq,
    schemaVersion: "1.0",
    type: EventType.TASK_CREATED,
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    correlationId: `corr-${seq}`,
    causationId: null,
    traceId: `trace-${seq}`,
    payload: {
      taskId: `t-${seq}`,
      title: `Task ${seq}`,
      description: "",
      priority: "normal",
      parentTaskId: null,
    },
  };
}

describe("subscription lifecycle (async)", () => {
  let adapter: TestRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;

  beforeEach(() => {
    adapter = new TestRuntimeAdapter({ initialSnapshot: makeSnapshot() });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);
  });

  // ─── Basic contract tests ─────────────────────────────────

  it("handleEvent drops events after removeSubscription (async close window)", async () => {
    await session.connect();
    const seqBefore = store.getLastSequence();

    // Simulate: session disconnects (removes subscription), then a delayed event arrives
    await session.disconnect();
    adapter.emit(makeEvent(seqBefore + 1));

    // Store should not have processed the event (no subscription active)
    expect(store.getLastSequence()).toBe(seqBefore);
  });

  it("RuntimeSubscription.close() is idempotent", async () => {
    const sub = adapter.subscribe({ onEvent: () => {} });
    await sub.ready;
    await Promise.resolve(sub.close());
    await Promise.resolve(sub.close()); // second call must not throw
    expect(adapter.unsubscribeCount).toBe(1);
  });

  it("RuntimeSubscription.ready resolves after microtask-deferred replay", async () => {
    // Pre-load an event into adapter log
    adapter.emit(makeEvent(1));

    const sub = adapter.subscribe(
      { onEvent: () => {} },
      { afterSequence: 0 }
    );
    await sub.ready;
    // ready resolved — replay completed
    expect(sub.ready).resolves.toBeUndefined();
  });

  it("session transitions to connected only after subscription.ready", async () => {
    const states: string[] = [];
    session.onStateChange((s) => states.push(s));
    await session.connect();
    expect(states[states.length - 1]).toBe("connected");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(true);
  });

  it("disconnect clears subscription diagnostics", async () => {
    await session.connect();
    expect(session.getDiagnostics().hasActiveSubscription).toBe(true);
    await session.disconnect();
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
    expect(session.getDiagnostics().activeSubscriptionCursor).toBeNull();
  });

  // ─── Issue #6 critical edge cases ─────────────────────────

  it("session awaits subscription.ready (delayed ready — not connected until ready resolves)", async () => {
    // Use an adapter with delayed ready
    const slowAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(),
    });
    slowAdapter.subscribeReadyDelayMs = 50;
    const slowSession = new RuntimeSession(
      slowAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(slowAdapter)
    );

    let connected = false;
    slowSession.onStateChange((s) => {
      if (s === "connected") connected = true;
    });

    // Start connect — should NOT reach connected until ready resolves
    const connectP = slowSession.connect();
    // Let microtasks run but ready is still pending (50ms delay)
    await new Promise((r) => setTimeout(r, 10));
    expect(slowSession.getState()).not.toBe("connected");
    expect(connected).toBe(false);

    await connectP;
    expect(connected).toBe(true);
    expect(slowSession.getState()).toBe("connected");
  });

  it("ready rejection — session enters failed, subscription closed, error is subscribe_failed", async () => {
    const failAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(),
    });
    const readyError: RuntimeStreamError = {
      code: "stream_open_failed",
      message: "stream rejected",
      recoverable: false,
    };
    failAdapter.subscribeReadyError = readyError;
    const failSession = new RuntimeSession(
      failAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(failAdapter)
    );

    await expect(failSession.connect()).rejects.toThrow();
    expect(failSession.getState()).toBe("failed");
    expect(failSession.getDiagnostics().lastError).not.toBeNull();
    expect(failSession.getDiagnostics().lastError!.code).toBe("subscribe_failed");
    expect(failSession.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  it("replay-time gap — session does not enter connected immediately, triggers resync", async () => {
    // Set up: adapter has event seq=5 in log, but snapshot at seq=0.
    // emit() updates both eventLog AND snapshot.seq, so we reset snapshot after.
    const gapAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(0),
    });
    gapAdapter.emit(makeEvent(5)); // eventLog has seq=5, snapshot.seq=5
    gapAdapter.setSnapshot(makeSnapshot(0)); // reset snapshot to seq=0

    // On resync's getSnapshot (2nd call), return seq=5 to stop resync loop.
    // Without this, resync would re-replay seq=5, detect gap again, loop forever.
    let getSnapshotCount = 0;
    const realGetSnapshot = gapAdapter.getSnapshot.bind(gapAdapter);
    gapAdapter.getSnapshot = async () => {
      getSnapshotCount++;
      if (getSnapshotCount >= 2) {
        gapAdapter.setSnapshot(makeSnapshot(5));
      }
      return realGetSnapshot();
    };

    const gapSession = new RuntimeSession(
      gapAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(gapAdapter)
    );

    await gapSession.connect();
    // connect() returns, but session is NOT "connected" — gap triggered resync.
    // doConnect bailed out because this.subscription !== subscription (resync
    // removed it). Wait for resync to complete.
    await new Promise((r) => setTimeout(r, 100));

    const diag = gapSession.getDiagnostics();
    expect(diag.resyncCount).toBeGreaterThanOrEqual(1);
    expect(diag.lastGap).not.toBeNull();
    expect(diag.lastGap!.receivedSequence).toBe(5);
  });

  it("replay-time runtime mismatch — session enters degraded, not connected", async () => {
    // Set up: adapter has mismatched event in log, snapshot at seq=0.
    const mismatchAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(0),
    });
    mismatchAdapter.emit(makeEvent(1, "other-runtime")); // eventLog + snapshot.seq=1
    mismatchAdapter.setSnapshot(makeSnapshot(0)); // reset snapshot to seq=0

    const mismatchSession = new RuntimeSession(
      mismatchAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(mismatchAdapter)
    );

    await mismatchSession.connect();
    // Replay delivered mismatched event → store.applyEvent returns runtime_mismatch
    // → session enters degraded (not connected)
    expect(mismatchSession.getState()).toBe("degraded");
    expect(mismatchSession.getDiagnostics().lastError).not.toBeNull();
    expect(mismatchSession.getDiagnostics().lastError!.code).toBe(
      "runtime_mismatch"
    );
  });

  it("async close — new subscription not established before old close completes", async () => {
    const slowCloseAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(),
    });
    slowCloseAdapter.closeDelayMs = 50;
    const slowCloseSession = new RuntimeSession(
      slowCloseAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(slowCloseAdapter)
    );

    await slowCloseSession.connect();
    expect(slowCloseSession.getDiagnostics().hasActiveSubscription).toBe(true);

    // disconnect must wait for close() to complete
    const disconnectStart = Date.now();
    await slowCloseSession.disconnect();
    const elapsed = Date.now() - disconnectStart;
    expect(elapsed).toBeGreaterThanOrEqual(40); // close delay was 50ms
    expect(slowCloseSession.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  it("close-before-ready — ready rejects with aborted, no dangling Promise", async () => {
    const sub = adapter.subscribe({ onEvent: () => {} });
    // Close before awaiting ready (microtask hasn't run yet)
    await Promise.resolve(sub.close());

    // ready must settle (reject) with aborted
    await expect(sub.ready).rejects.toMatchObject({ code: "aborted" });
  });

  it("session resync re-establishes subscription after gap recovery", async () => {
    await session.connect();
    expect(adapter.subscribeCalls).toHaveLength(1);

    // Trigger a gap
    const gapEvent = makeEvent(store.getLastSequence() + 5);
    adapter.emit(gapEvent);

    // Wait for resync to complete
    await new Promise((r) => setTimeout(r, 50));
    expect(session.getDiagnostics().resyncCount).toBe(1);
    expect(adapter.subscribeCalls).toHaveLength(2);
    expect(session.getDiagnostics().hasActiveSubscription).toBe(true);
  });
});
