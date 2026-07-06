import { describe, it, expect } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import { taskAssigned, taskCompleted } from "./__fixtures__/runtime-events.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "golden-day-1",
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

describe("Day 1 Golden Flow", () => {
  it("reproduces the deterministic sample day", async () => {
    const engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });

    await engine.execute(makeCommand("world.start_day", { day: 1 }));
    expect(engine.getSnapshot().snapshot.worldClock.minuteOfDay).toBe(480);

    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
    const afterArrive = engine.getSnapshot().snapshot;
    expect(afterArrive.activeActivities.map((a) => a.scheduleEntryId).sort()).toEqual(
      ["orch-work-am", "worker-work-am", "reviewer-review-am"].sort()
    );

    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    const afterAssign = engine.getSnapshot().snapshot;
    expect(afterAssign.activeActivities.find((a) => a.agentId === "worker-1")?.scheduleEntryId).toBe("overlay-t-1");

    await engine.execute(makeCommand("world.advance_time", { minutes: 120 }));
    await engine.applyRuntimeEvent(taskCompleted(10, "t-1"));
    const afterComplete = engine.getSnapshot().snapshot;
    expect(afterComplete.activeOverlays.some((o) => o.createdByTaskId === "t-1")).toBe(false);

    await engine.execute(makeCommand("world.run_to_end_of_day", {}));
    expect(engine.getSnapshot().snapshot.worldClock.minuteOfDay).toBe(config.endOfDayMinute);

    await engine.execute(makeCommand("world.end_day", {}));
    expect(engine.getSnapshot().snapshot.worldClock.status).toBe("not_started");
  });
});
