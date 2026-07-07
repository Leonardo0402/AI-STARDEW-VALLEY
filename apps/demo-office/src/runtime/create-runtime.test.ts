import { describe, it, expect, afterEach } from "vitest";
import { createRuntime } from "./create-runtime.js";
import type { RuntimeComposition } from "./types.js";

describe("createRuntime", () => {
  let comp: RuntimeComposition | null;

  afterEach(async () => {
    if (comp) {
      await comp.dispose();
      comp = null;
    }
  });

  it("mock config creates MockRuntimeAdapter composition", async () => {
    comp = createRuntime({ mode: "mock", runtimeId: "mock-runtime-001", lifeSimBaseUrl: "/life-sim" });
    expect(comp.adapter).toBeDefined();
    expect(comp.store).toBeDefined();
    expect(comp.gateway).toBeDefined();
    expect(comp.session).toBeDefined();
    // Mock adapter connects synchronously (no-op)
    await comp.session.connect();
    expect(comp.session.getState()).toBe("connected");
    // Initial snapshot has 4 agents
    expect(comp.store.getSnapshot().agents).toHaveLength(4);
  });

  it("http-sse config creates HttpSseRuntimeAdapter composition (without connecting)", () => {
    comp = createRuntime({
      mode: "http-sse",
      runtimeId: "qclaw-swarm-runtime-001",
      baseUrl: "http://localhost:3456",
      lifeSimBaseUrl: "/life-sim",
    });
    expect(comp.adapter).toBeDefined();
    expect(comp.store).toBeDefined();
    expect(comp.gateway).toBeDefined();
    expect(comp.session).toBeDefined();
    // Do NOT connect — no server running. Just verify construction.
  });

  it("dispose disconnects the session exactly once (idempotent)", async () => {
    comp = createRuntime({ mode: "mock", runtimeId: "mock-runtime-001", lifeSimBaseUrl: "/life-sim" });
    await comp.session.connect();
    expect(comp.session.getState()).toBe("connected");
    await comp.dispose();
    expect(comp.session.getState()).toBe("disconnected");
    // Second dispose is a no-op
    await comp.dispose();
    expect(comp.session.getState()).toBe("disconnected");
  });

  it("createRuntime called twice produces independent compositions (StrictMode safety)", () => {
    const comp1 = createRuntime({ mode: "mock", runtimeId: "mock-runtime-001", lifeSimBaseUrl: "/life-sim" });
    const comp2 = createRuntime({ mode: "mock", runtimeId: "mock-runtime-001", lifeSimBaseUrl: "/life-sim" });
    expect(comp1.session).not.toBe(comp2.session);
    expect(comp1.store).not.toBe(comp2.store);
    // Cleanup both (synchronous — don't connect)
    comp1.dispose();
    comp2.dispose();
    comp = null;
  });
});
