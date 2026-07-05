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

  it("rejects start_day when a day is already started", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.start_day", { day: 5 }));
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("day_already_started");
  });

  it("end_day transitions to ending and emits day_ending", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    const result = await engine.execute(makeCommand("world.end_day", {}));
    expect(result.status).toBe("accepted");
    expect(result.events[0].type).toBe("world.day_ending");
    expect(engine.getSnapshot().snapshot.worldClock.status).toBe("ending");
  });

  it("repeated end_day for the same day is idempotent", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    await engine.execute(makeCommand("world.end_day", {}));
    const repeat: LifeSimCommand = {
      ...makeCommand("world.end_day", {}),
      commandId: "cmd-world.end_day-repeat",
    };
    const result = await engine.execute(repeat);
    expect(result.status).toBe("accepted");
    expect(result.events).toHaveLength(0);
    expect(result.lifeSimSequence).toBeNull();
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

  it("run_to_end_of_day advances to EOD without day_ending", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.run_to_end_of_day", {}));
    expect(result.status).toBe("accepted");
    expect(engine.getSnapshot().snapshot.worldClock.minuteOfDay).toBe(config.endOfDayMinute);
    expect(result.events.map((e) => e.type)).toContain("world.time_advanced");
    expect(result.events.map((e) => e.type)).not.toContain("world.day_ending");
  });
});
