import { describe, it, expect, afterEach } from "vitest";
import { QclawTestRuntime } from "./qclaw-runtime.js";
import { playGoldenFlow } from "./demo-script.js";

describe("playGoldenFlow", () => {
  let runtime: QclawTestRuntime;

  afterEach(async () => {
    if (runtime) await runtime.stop();
  });

  it("drives task from created to completed via approval", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const result = await playGoldenFlow(runtime.getBaseUrl());

    expect(result.finalSnapshot.tasks).toHaveLength(1);
    expect(result.finalSnapshot.tasks[0].status).toBe("completed");
    expect(result.finalSnapshot.artifacts).toHaveLength(1);
    expect(result.finalSnapshot.artifacts[0].status).toBe("approved");
    expect(result.finalSnapshot.approvals).toHaveLength(1);
    expect(result.finalSnapshot.approvals[0].status).toBe("approved");
  });

  it("emits events in the correct golden order", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const result = await playGoldenFlow(runtime.getBaseUrl());

    const types = result.events.map((e: any) => e.type);
    expect(types).toContain("task.created");
    expect(types).toContain("task.assigned");
    expect(types).toContain("task.started");
    expect(types).toContain("artifact.created");
    expect(types).toContain("artifact.reviewed");
    expect(types).toContain("approval.requested");
    expect(types).toContain("approval.resolved");
    expect(types).toContain("task.completed");
    // Verify order: task.created before approval.resolved
    expect(types.indexOf("task.created")).toBeLessThan(types.indexOf("approval.resolved"));
    expect(types.indexOf("approval.requested")).toBeLessThan(types.indexOf("approval.resolved"));
  });
});
