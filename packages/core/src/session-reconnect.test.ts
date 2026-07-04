import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestRuntimeAdapter } from "./test-adapter.js";
import { RuntimeSession, type SessionState } from "./session.js";
import { SnapshotStore } from "./store.js";
import { CommandGateway } from "./gateway.js";
import type { RuntimeSnapshot, DomainEvent, RuntimeStreamError, RuntimeStreamObserver, RuntimeSubscription } from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";

const RUNTIME_ID = "rt-reconnect";

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

/**
 * Test adapter that captures the live observer so tests can inject post-ready
 * errors/reset-required through the adapter (simulating what a real adapter does
 * when the stream drops). This does NOT access any session private field.
 */
class ErrorAfterReadyAdapter extends TestRuntimeAdapter {
  private liveObs: RuntimeStreamObserver | null = null;

  subscribe(observer: RuntimeStreamObserver, options?: { afterSequence?: number }): RuntimeSubscription {
    const sub = super.subscribe(observer, options);
    // Capture observer after subscribe returns; the adapter will add it to subscribers
    // once ready resolves. We stash it for injection.
    this.liveObs = observer;
    return sub;
  }

  /** Inject a post-ready error (simulates adapter detecting stream drop). */
  injectError(err: RuntimeStreamError): void {
    this.liveObs?.onError?.(err);
    this.liveObs?.onState?.(err.recoverable ? "error" : "error");
  }

  /** Inject a reset-required signal (simulates adapter detecting trimmed log). */
  injectResetRequired(): void {
    this.liveObs?.onState?.("reset_required");
  }

  /** Inject a live event (simulates adapter delivering a post-ready event). */
  injectEvent(event: DomainEvent): void {
    this.liveObs?.onEvent?.(event);
  }
}

describe("RuntimeSession reconnect integration", () => {
  let adapter: ErrorAfterReadyAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;

  beforeEach(() => {
    adapter = new ErrorAfterReadyAdapter({ initialSnapshot: makeSnapshot() });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway, {
      reconnectPolicy: { initialDelayMs: 10, maxDelayMs: 50, maxAttempts: 3, jitterRatio: 0 },
    });
  });

  it("post-ready recoverable error triggers reconnect with backoff", async () => {
    await session.connect();
    expect(session.getState()).toBe("connected");
    expect(session.getDiagnostics().reconnectCount).toBe(0);

    adapter.injectError({ code: "http_error", message: "simulated network drop", recoverable: true });

    // Wait for backoff (10ms initial) + resync
    await new Promise((r) => setTimeout(r, 80));
    expect(session.getDiagnostics().reconnectCount).toBeGreaterThanOrEqual(1);
    // After successful resync, state returns to connected
    expect(session.getState()).toBe("connected");
  });

  it("multiple rapid errors produce only one reconnect (single-flight via reconnectPromise + reconnectTimer)", async () => {
    await session.connect();
    const states: SessionState[] = [];
    session.onStateChange((s) => states.push(s));

    adapter.injectError({ code: "http_error", message: "drop 1", recoverable: true });
    adapter.injectError({ code: "http_error", message: "drop 2", recoverable: true });
    adapter.injectError({ code: "http_error", message: "drop 3", recoverable: true });

    await new Promise((r) => setTimeout(r, 120));
    // Only one reconnect should have been scheduled (single-flight)
    expect(session.getDiagnostics().reconnectCount).toBe(1);
    expect(session.getState()).toBe("connected");
  });

  it("disconnect cancels pending reconnect timer and awaits in-flight reconnectPromise", async () => {
    await session.connect();
    adapter.injectError({ code: "http_error", message: "drop", recoverable: true });
    // disconnect before the timer fires / while reconnectPromise is in-flight
    await session.disconnect();
    const countAfterDisconnect = session.getDiagnostics().reconnectCount;
    await new Promise((r) => setTimeout(r, 120));
    // reconnectCount should NOT have increased after disconnect
    expect(session.getDiagnostics().reconnectCount).toBe(countAfterDisconnect);
    expect(session.getState()).toBe("disconnected");
  });

  it("exceeding maxAttempts transitions to failed (resynchronizeOrThrow re-throws)", async () => {
    // Adapter that always fails getSnapshot during resync
    const failAdapter = new ErrorAfterReadyAdapter({ initialSnapshot: makeSnapshot() });
    const failSession = new RuntimeSession(failAdapter, new SnapshotStore(RUNTIME_ID), new CommandGateway(failAdapter), {
      reconnectPolicy: { initialDelayMs: 5, maxDelayMs: 10, maxAttempts: 2, jitterRatio: 0 },
    });
    await failSession.connect();
    // Set snapshotError AFTER connect so initial connect succeeds but resync fails
    failAdapter.snapshotError = new Error("resync fails");
    failAdapter.injectError({ code: "http_error", message: "drop", recoverable: true });

    // Wait for 2 reconnect attempts to fail
    await new Promise((r) => setTimeout(r, 200));
    expect(failSession.getState()).toBe("failed");
    expect(failSession.getDiagnostics().reconnectCount).toBe(2);
    expect(failSession.getDiagnostics().lastError?.code).toBe("reconnect_failed");
  });

  it("reset_required triggers immediate resync (no backoff)", async () => {
    await session.connect();
    expect(session.getDiagnostics().resyncCount).toBe(0);

    adapter.injectResetRequired();

    await new Promise((r) => setTimeout(r, 80));
    expect(session.getDiagnostics().resyncCount).toBe(1);
    expect(session.getState()).toBe("connected");
  });

  it("reset_required during in-flight gap-triggered resync does not start a second resync", async () => {
    // Regression test for Fix 2: triggerResetRecovery must check resyncPromise
    // (not just reconnectPromise). Without this guard, a reset_required arriving
    // while a gap-triggered resync is in-flight starts a SECOND concurrent
    // resynchronizeOrThrow(), whose installSubscription overwrites the first
    // resync's subscription (leaked reader).
    await session.connect();
    expect(session.getDiagnostics().resyncCount).toBe(0);

    // Slow down ready so the gap-triggered resync is in the "await ready" window
    // (where this.subscription IS set but resyncPromise is still pending) when
    // we inject reset_required. This isolates Fix 2: Fix 3's !subscription guard
    // does NOT fire (subscription is set), so only the resyncPromise guard can
    // prevent the second resync.
    adapter.subscribeReadyDelayMs = 200;

    // Emit a gap event (seq=5 when snapshot seq=0) → triggers triggerResync.
    adapter.emit(makeEvent(5));

    // Wait for the resync to reach "await subscription.ready" — getSnapshot
    // (sync) and installSubscription have completed, so this.subscription is
    // set, but ready (200ms) is still pending.
    await new Promise((r) => setTimeout(r, 50));

    // Inject reset_required. Without Fix 2, triggerResetRecovery proceeds
    // (reconnectPromise is null) and starts a SECOND concurrent resync.
    // With Fix 2, triggerResetRecovery bails because resyncPromise is set.
    adapter.injectResetRequired();

    // Wait for everything to settle (ready resolves at ~200ms).
    await new Promise((r) => setTimeout(r, 350));

    // Only ONE resync should have happened (the gap-triggered one).
    expect(session.getDiagnostics().resyncCount).toBe(1);
    expect(session.getState()).toBe("connected");
  });

  it("non-recoverable error closes subscription BEFORE entering failed (no stale stream)", async () => {
    await session.connect();
    // Verify subscription is active
    expect(session.getDiagnostics().hasActiveSubscription).toBe(true);

    adapter.injectError({ code: "authentication_failed", message: "token expired", recoverable: false });

    await new Promise((r) => setTimeout(r, 50));
    expect(session.getState()).toBe("failed");
    expect(session.getDiagnostics().reconnectCount).toBe(0);
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    // Subscription must be closed (no stale stream in failed session)
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  it("reconnectCount is cumulative (never resets on success)", async () => {
    await session.connect();
    adapter.injectError({ code: "http_error", message: "drop 1", recoverable: true });
    await new Promise((r) => setTimeout(r, 80));
    expect(session.getDiagnostics().reconnectCount).toBe(1);

    // Second drop — count should increment to 2, not reset
    adapter.injectError({ code: "http_error", message: "drop 2", recoverable: true });
    await new Promise((r) => setTimeout(r, 80));
    expect(session.getDiagnostics().reconnectCount).toBe(2);
    expect(session.getState()).toBe("connected");
  });
});
