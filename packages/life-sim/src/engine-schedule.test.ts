import { describe, it, expect, beforeEach } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "schedule-test",
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

describe("base schedule transitions", () => {
  let engine: Awaited<ReturnType<typeof createLifeSimEngine>>;

  beforeEach(async () => {
    engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });
  });

  it("emits arrive entries on start_day", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const state = engine.getSnapshot().snapshot;
    expect(state.activeActivities.map((a) => a.scheduleEntryId).sort()).toEqual(
      ["orch-arrive", "worker-arrive", "reviewer-arrive"].sort()
    );
  });

  it("transitions to work entries at 08:30", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
    const state = engine.getSnapshot().snapshot;
    expect(state.activeActivities.map((a) => a.scheduleEntryId).sort()).toEqual(
      ["orch-work-am", "worker-work-am", "reviewer-review-am"].sort()
    );
  });
});
