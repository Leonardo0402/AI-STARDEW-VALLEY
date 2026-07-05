import { describe, it, expect, beforeEach } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import { taskAssigned, taskCompleted } from "./__fixtures__/runtime-events.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "runtime-test",
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

describe("runtime event handling", () => {
  let engine: Awaited<ReturnType<typeof createLifeSimEngine>>;

  beforeEach(async () => {
    engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
  });

  it("creates a task overlay for worker-1", async () => {
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays.some((o) => o.createdByTaskId === "t-1")).toBe(true);
    expect(state.activeActivities.find((a) => a.agentId === "worker-1")?.scheduleEntryId).toBe("overlay-t-1");
  });

  it("ends overlay when task completes", async () => {
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    await engine.applyRuntimeEvent(taskCompleted(8, "t-1"));
    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays.some((o) => o.createdByTaskId === "t-1")).toBe(false);
    expect(state.activeActivities.find((a) => a.agentId === "worker-1")?.scheduleEntryId).toBe("worker-work-am");
  });
});
