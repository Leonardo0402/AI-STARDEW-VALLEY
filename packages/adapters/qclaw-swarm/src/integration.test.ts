/**
 * Integration test: HttpSseRuntimeAdapter <-> QclawTestRuntime <-> RuntimeSession.
 *
 * Boots the real QClaw test runtime (Node http server), connects the generic
 * HTTP/SSE adapter to it, drives the golden workflow via HTTP commands, and
 * asserts that events flow through the adapter into the SnapshotStore and
 * that the final session snapshot reflects the completed task.
 */
import { describe, it, expect, afterEach } from "vitest";
import { QclawTestRuntime } from "./qclaw-runtime.js";
import { playGoldenFlow } from "./demo-script.js";
import { HttpSseRuntimeAdapter } from "@agent-office/adapter-http-sse";
import { RuntimeSession, SnapshotStore, CommandGateway } from "@agent-office/core";

const RUNTIME_ID = "qclaw-swarm-runtime-001";

describe("QClaw + HttpSseRuntimeAdapter + RuntimeSession integration", () => {
  let runtime: QclawTestRuntime;
  let adapter: HttpSseRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;

  afterEach(async () => {
    if (session) {
      try {
        await session.disconnect();
      } catch {
        /* best-effort */
      }
    }
    if (runtime) {
      try {
        await runtime.stop();
      } catch {
        /* best-effort */
      }
    }
  });

  it("connects via HttpSseRuntimeAdapter and fetches initial snapshot into store", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();

    adapter = new HttpSseRuntimeAdapter({
      baseUrl: runtime.getBaseUrl(),
      runtimeId: RUNTIME_ID,
    });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);

    await session.connect();
    expect(session.getState()).toBe("connected");

    const snap = store.getSnapshot();
    expect(snap.runtimeId).toBe(RUNTIME_ID);
    expect(snap.agents).toHaveLength(4);
    expect(snap.rooms).toHaveLength(4);
  });

  it("receives live events through onAcceptedEvent during golden workflow", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();

    adapter = new HttpSseRuntimeAdapter({
      baseUrl: runtime.getBaseUrl(),
      runtimeId: RUNTIME_ID,
    });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);
    await session.connect();

    const receivedTypes: string[] = [];
    const unsubscribe = session.onAcceptedEvent((event) => {
      receivedTypes.push(event.type);
    });

    await playGoldenFlow(runtime.getBaseUrl());
    // Allow SSE events to propagate through adapter -> session -> store
    await new Promise((r) => setTimeout(r, 400));

    unsubscribe();

    expect(receivedTypes).toContain("task.created");
    expect(receivedTypes).toContain("task.assigned");
    expect(receivedTypes).toContain("task.started");
    expect(receivedTypes).toContain("artifact.created");
    expect(receivedTypes).toContain("artifact.reviewed");
    expect(receivedTypes).toContain("approval.requested");
    expect(receivedTypes).toContain("approval.resolved");
    expect(receivedTypes).toContain("task.completed");
  });

  it("golden workflow results in completed task, approved artifact, and approved approval in session snapshot", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();

    adapter = new HttpSseRuntimeAdapter({
      baseUrl: runtime.getBaseUrl(),
      runtimeId: RUNTIME_ID,
    });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);
    await session.connect();

    await playGoldenFlow(runtime.getBaseUrl());
    await new Promise((r) => setTimeout(r, 400));

    const snap = store.getSnapshot();
    expect(snap.tasks.length).toBeGreaterThan(0);
    expect(snap.tasks[0].status).toBe("completed");
    expect(snap.artifacts.length).toBeGreaterThan(0);
    expect(snap.artifacts[0].status).toBe("approved");
    expect(snap.approvals.length).toBeGreaterThan(0);
    expect(snap.approvals[0].status).toBe("approved");
  });
});
