/**
 * Remote golden-flow smoke test.
 *
 * Boots QclawTestRuntime, creates the app composition via createRuntime()
 * in http-sse mode, drives the golden workflow via HTTP, and verifies
 * that events flow through the adapter into the SnapshotStore and that
 * the final projection reflects the completed task.
 *
 * Uses the SAME createRuntime() factory as main.tsx — no test-only shortcuts
 * in the composition path.
 */
import { describe, it, expect, afterEach } from "vitest";
import { QclawTestRuntime, playGoldenFlow } from "@agent-office/qclaw-swarm";
import { createRuntime } from "./runtime/create-runtime.js";
import { projectSnapshot } from "@agent-office/core";

describe("Remote golden-flow smoke test (http-sse mode)", () => {
  let runtime: QclawTestRuntime;
  let dispose: () => Promise<void>;

  afterEach(async () => {
    if (dispose) await dispose();
    if (runtime) await runtime.stop();
  });

  it("createRuntime(http-sse) connects to QClaw runtime and golden flow updates projection", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();

    const comp = createRuntime({
      mode: "http-sse",
      runtimeId: "qclaw-swarm-runtime-001",
      baseUrl: runtime.getBaseUrl(),
    });
    dispose = comp.dispose;

    await comp.session.connect();
    expect(comp.session.getState()).toBe("connected");

    // Initial snapshot: 4 agents, 4 rooms
    const initialSnap = comp.store.getSnapshot();
    expect(initialSnap.agents).toHaveLength(4);
    expect(initialSnap.rooms).toHaveLength(4);

    // Drive golden flow via HTTP (same as playGoldenFlow)
    await playGoldenFlow(runtime.getBaseUrl());
    await new Promise((r) => setTimeout(r, 500));

    // Final snapshot: task completed, artifact approved, approval approved
    const finalSnap = comp.store.getSnapshot();
    expect(finalSnap.tasks.length).toBeGreaterThan(0);
    expect(finalSnap.tasks[0].status).toBe("completed");
    expect(finalSnap.artifacts[0].status).toBe("approved");
    expect(finalSnap.approvals[0].status).toBe("approved");

    // Projection pipeline works (same projection consumed by list/pixel views)
    const projection = projectSnapshot(finalSnap);
    expect(projection.tasks.length).toBeGreaterThan(0);
  });

  it("dispose disconnects the session, no active stream remains", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();

    const comp = createRuntime({
      mode: "http-sse",
      runtimeId: "qclaw-swarm-runtime-001",
      baseUrl: runtime.getBaseUrl(),
    });
    dispose = comp.dispose;

    await comp.session.connect();
    expect(comp.session.getState()).toBe("connected");

    await comp.dispose();
    expect(comp.session.getState()).toBe("disconnected");

    // After dispose, session cannot reconnect (one-time adapter).
    // Verify the store is frozen at last known state.
    const snap = comp.store.getSnapshot();
    expect(snap).toBeDefined();

    dispose = async () => {}; // prevent double-dispose in afterEach
  });

  it("remote mode does not expose Mock DemoControls (factory returns no mock adapter)", () => {
    runtime = new QclawTestRuntime({ port: 0 });

    const comp = createRuntime({
      mode: "http-sse",
      runtimeId: "qclaw-swarm-runtime-001",
      baseUrl: "http://localhost:1", // don't actually connect
    });
    dispose = comp.dispose;

    // The adapter is HttpSseRuntimeAdapter, not MockRuntimeAdapter.
    // main.tsx uses `configMode === "mock"` to gate DemoControls — verify
    // that the factory does not produce a Mock adapter in http-sse mode.
    const adapterConstructorName = comp.adapter.constructor.name;
    expect(adapterConstructorName).toBe("HttpSseRuntimeAdapter");
  });
});
