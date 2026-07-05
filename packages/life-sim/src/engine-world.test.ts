import { describe, it, expect, beforeEach } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "world-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
};

function fixedNow() {
  return "2026-07-05T08:00:00Z";
}

function makeCommand(type: string, payload: unknown): LifeSimCommand {
  return {
    commandId: `cmd-${type}-${JSON.stringify(payload)}`,
    commandType: type,
    timestamp: fixedNow(),
    source: "user",
    actorId: "operator",
    worldId: config.worldId,
    payload,
  };
}

describe("world commands", () => {
  let engine: Awaited<ReturnType<typeof createLifeSimEngine>>;

  beforeEach(async () => {
    engine = await createLifeSimEngine(config, { now: fixedNow, store: new InMemoryLifeSimStore() });
  });

  it("starts day 1", async () => {
    const result = await engine.execute(makeCommand("world.start_day", {}));
    expect(result.status).toBe("accepted");
    expect(result.events[0].type).toBe("world.day_started");
    expect(engine.getSnapshot().snapshot.worldClock.day).toBe(1);
  });

  it("rejects start_day with wrong day", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    await engine.execute(makeCommand("world.end_day", {}));
    // Day 1 summary would be recorded by schedule reducer; here worldClock returns to not_started via reducer
    const result = await engine.execute(makeCommand("world.start_day", { day: 5 }));
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("invalid_day");
  });

  it("advance_time stops at EOD without day_ending", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    expect(result.status).toBe("accepted");
    expect(engine.getSnapshot().snapshot.worldClock.minuteOfDay).toBe(config.endOfDayMinute);
    expect(result.events.map((e) => e.type)).not.toContain("world.day_ending");
  });

  it("end_day is only allowed at EOD", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.end_day", {}));
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("end_of_day_not_reached");
  });
});
