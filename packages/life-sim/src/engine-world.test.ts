import { describe, it, expect, beforeEach } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { createEmptySnapshot, InMemoryLifeSimStore } from "./store.js";
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

async function createEngineWithSpeed(speed: number) {
  const store = new InMemoryLifeSimStore();
  const snapshot = createEmptySnapshot(config, fixedNow());
  snapshot.worldClock.status = "running";
  snapshot.worldClock.speed = speed;
  snapshot.worldClock.day = 1;
  store.set(snapshot, [], new Map());
  return createLifeSimEngine(config, { now: fixedNow, store });
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

  it("getSnapshot returns a deep copy of the current snapshot", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const snapshot = engine.getSnapshot().snapshot;
    snapshot.worldClock.day = 999;
    snapshot.activeActivities.push({
      agentId: "x",
      scheduleEntryId: "injected",
      activity: "idle",
      roomId: null,
      startedAtWorldMinute: 0,
      interruptedByTaskId: null,
    });
    const fresh = engine.getSnapshot().snapshot;
    expect(fresh.worldClock.day).toBe(1);
    expect(fresh.activeActivities).toHaveLength(0);
  });

  it("rejects start_day when a day is already started", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.start_day", { day: 5 }));
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("day_already_started");
  });

  it("records a DaySummary skeleton with empty agent activities in Phase 1", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    await engine.execute(makeCommand("world.end_day", {}));
    const summary = engine.getSnapshot().snapshot.completedDaySummaries[0];
    expect(summary.agentActivities).toEqual([]);
    expect(summary.taskCounts).toEqual({ created: 0, completed: 0, blocked: 0, failed: 0 });
    expect(summary.approvalCounts).toEqual({ requested: 0, approved: 0, rejected: 0 });
  });

  it("end_day records summary, resets clock and emits day lifecycle events", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    const result = await engine.execute(makeCommand("world.end_day", {}));
    expect(result.status).toBe("accepted");
    expect(result.events.map((e) => e.type)).toEqual([
      "world.day_ending",
      "day.summary_recorded",
      "world.day_ended",
    ]);
    expect(result.events[0].payload).toEqual({ day: 1, endedAtWorldMinute: config.endOfDayMinute });
    expect(result.events[1].payload).toEqual({
      summaryId: "summary-1",
      day: 1,
      summary: expect.objectContaining({ day: 1 }),
    });
    expect(result.events[2].payload).toEqual({ day: 1, summaryId: "summary-1" });
    const finalSnapshot = engine.getSnapshot().snapshot;
    expect(finalSnapshot.worldClock.status).toBe("not_started");
    expect(finalSnapshot.worldClock.minuteOfDay).toBe(config.startOfDayMinute);
    expect(finalSnapshot.worldClock.fractionalMinute).toBe(0);
    expect(finalSnapshot.completedDaySummaries).toHaveLength(1);
    expect(finalSnapshot.completedDaySummaries[0].day).toBe(1);
  });

  it("repeated end_day for the same day returns accepted no-op", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    await engine.execute(makeCommand("world.end_day", {}));
    const repeat: LifeSimCommand = {
      ...makeCommand("world.end_day", {}),
      commandId: "cmd-world.end_day-repeat",
    };
    const result = await engine.execute(repeat);
    expect(result.status).toBe("accepted");
    expect(result.lifeSimSequence).toBeNull();
    expect(result.events).toEqual([]);
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

  it("accepts start_day after end_day for the next day", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    await engine.execute(makeCommand("world.end_day", {}));
    const result = await engine.execute(makeCommand("world.start_day", { day: 2 }));
    expect(result.status).toBe("accepted");
    expect(result.events[0].type).toBe("world.day_started");
    expect(engine.getSnapshot().snapshot.worldClock.day).toBe(2);
  });

  it("rejects advance_time in real-time mode", async () => {
    const rtEngine = await createEngineWithSpeed(10);
    const result = await rtEngine.execute(makeCommand("world.advance_time", { minutes: 10 }));
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("advance_not_allowed_in_realtime");
  });

  it.each([0, -1, 1.5])("rejects advance_time with invalid_time for minutes=%s", async (minutes) => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.advance_time", { minutes }));
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("invalid_time");
  });

  it("recomputes capabilities after accepted commands", async () => {
    expect(engine.getCapabilities()).toEqual({
      world: { startDay: true, pause: false, resume: false, endDay: false, advanceTime: false, runToEndOfDay: false },
      schedule: { override: false, clearOverride: false },
      clock: { mode: "manual", maxSpeed: 0 },
    });

    await engine.execute(makeCommand("world.start_day", {}));
    expect(engine.getCapabilities().world).toEqual({
      startDay: false,
      pause: false,
      resume: false,
      endDay: false,
      advanceTime: true,
      runToEndOfDay: true,
    });

    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    expect(engine.getCapabilities().world).toEqual({
      startDay: false,
      pause: false,
      resume: false,
      endDay: true,
      advanceTime: true,
      runToEndOfDay: false,
    });

    await engine.execute(makeCommand("world.end_day", {}));
    expect(engine.getCapabilities().world).toEqual({
      startDay: true,
      pause: false,
      resume: false,
      endDay: false,
      advanceTime: false,
      runToEndOfDay: false,
    });
    expect(engine.getCapabilities().clock).toEqual({ mode: "manual", maxSpeed: 0 });
  });

  it("never advertises pause or resume capabilities in Phase 1", async () => {
    expect(engine.getCapabilities().world.pause).toBe(false);
    expect(engine.getCapabilities().world.resume).toBe(false);

    await engine.execute(makeCommand("world.start_day", {}));
    expect(engine.getCapabilities().world.pause).toBe(false);
    expect(engine.getCapabilities().world.resume).toBe(false);

    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    expect(engine.getCapabilities().world.pause).toBe(false);
    expect(engine.getCapabilities().world.resume).toBe(false);

    await engine.execute(makeCommand("world.end_day", {}));
    expect(engine.getCapabilities().world.pause).toBe(false);
    expect(engine.getCapabilities().world.resume).toBe(false);
  });

  it("advertises runToEndOfDay only when a day is running and not at EOD", async () => {
    expect(engine.getCapabilities().world.runToEndOfDay).toBe(false);

    await engine.execute(makeCommand("world.start_day", {}));
    expect(engine.getCapabilities().world.runToEndOfDay).toBe(true);

    await engine.execute(makeCommand("world.advance_time", { minutes: 9999 }));
    expect(engine.getCapabilities().world.runToEndOfDay).toBe(false);

    await engine.execute(makeCommand("world.end_day", {}));
    expect(engine.getCapabilities().world.runToEndOfDay).toBe(false);
  });

  it("emits phase_changed events for large advances crossing boundaries", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.advance_time", { minutes: 630 }));
    expect(result.status).toBe("accepted");
    expect(result.events.map((e) => e.type)).toEqual([
      "world.phase_changed",
      "world.phase_changed",
      "world.time_advanced",
    ]);
    expect(result.events[0].payload).toEqual({ oldPhase: "morning", newPhase: "afternoon", minute: 720 });
    expect(result.events[1].payload).toEqual({ oldPhase: "afternoon", newPhase: "evening", minute: 1080 });
    expect(result.events[2].payload).toEqual({ oldMinute: 480, newMinute: 1110, day: 1 });
  });
});
