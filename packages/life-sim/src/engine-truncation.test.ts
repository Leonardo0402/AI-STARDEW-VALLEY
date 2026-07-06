import { describe, it, expect, beforeEach } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import type { LifeSimCommand, LifeSimEngineConfig, RuntimeSnapshot } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "truncation-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
  baseSchedules: sampleDay1Schedules(),
};

function makeCommand(type: string, payload: unknown): LifeSimCommand {
  return {
    commandId: `cmd-${type}-${JSON.stringify(payload)}`,
    commandType: type,
    timestamp: "2026-07-05T08:00:00Z",
    source: "user",
    actorId: "operator",
    worldId: config.worldId,
    payload,
  };
}

describe("truncation recovery", () => {
  it("closes overlay for a completed task after reconciliation", async () => {
    const engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
    // Simulate runtime snapshot with task completed
    const runtimeSnapshot: RuntimeSnapshot = {
      runtimeId: "runtime-1",
      snapshotId: "snap-1",
      sequence: 10,
      schemaVersion: "1.0",
      createdAt: "2026-07-05T08:00:00Z",
      lastEventId: "evt-10",
      agents: [],
      tasks: [
        {
          taskId: "t-1",
          runtimeId: "runtime-1",
          title: "Task 1",
          description: "",
          status: "completed",
          priority: "normal",
          parentTaskId: null,
          assigneeId: "worker-1",
          roomId: "room-execution",
          dependencyIds: [],
          artifactIds: [],
          approvalId: null,
          createdAt: "2026-07-05T08:00:00Z",
          startedAt: "2026-07-05T08:00:00Z",
          completedAt: "2026-07-05T08:00:00Z",
          blockedReason: null,
        },
      ],
      artifacts: [],
      approvals: [],
      rooms: [],
    };
    // In a real implementation the engine exposes reconcileFromRuntimeSnapshot(runtimeSnapshot)
    // For the test, import reconcileOverlays directly.
    const { reconcileOverlays } = await import("./truncation.js");
    const { snapshot } = reconcileOverlays(engine.getSnapshot().snapshot, runtimeSnapshot, config.endOfDayMinute);
    expect(snapshot.activeOverlays.some((o) => o.createdByTaskId === "t-1")).toBe(false);
  });

  it("creates overlays with placeholder createdByRuntimeSequence in Phase 1", async () => {
    const engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
    const runtimeSnapshot: RuntimeSnapshot = {
      runtimeId: "runtime-1",
      snapshotId: "snap-1",
      sequence: 10,
      schemaVersion: "1.0",
      createdAt: "2026-07-05T08:00:00Z",
      lastEventId: "evt-10",
      agents: [],
      tasks: [
        {
          taskId: "t-1",
          runtimeId: "runtime-1",
          title: "Task 1",
          description: "",
          status: "assigned",
          priority: "normal",
          parentTaskId: null,
          assigneeId: "worker-1",
          roomId: "room-execution",
          dependencyIds: [],
          artifactIds: [],
          approvalId: null,
          createdAt: "2026-07-05T08:00:00Z",
          startedAt: "2026-07-05T08:00:00Z",
          completedAt: null,
          blockedReason: null,
        },
      ],
      artifacts: [],
      approvals: [],
      rooms: [],
    };
    const { reconcileOverlays } = await import("./truncation.js");
    const { created } = reconcileOverlays(engine.getSnapshot().snapshot, runtimeSnapshot, config.endOfDayMinute);
    expect(created).toHaveLength(1);
    expect(created[0].createdByRuntimeSequence).toBe(0);
    expect(created[0].createdByTaskId).toBe("t-1");
  });
});
