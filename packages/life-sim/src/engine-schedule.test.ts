import { describe, it, expect, beforeEach } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { createEmptySnapshot, InMemoryLifeSimStore } from "./store.js";
import { buildActiveActivity, findEffectiveEntry } from "./schedule.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import type { AgentScheduleEntry, LifeSimCommand, LifeSimEngineConfig, LifeSimSnapshot } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "schedule-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
  baseSchedules: sampleDay1Schedules(),
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

function makeSnapshot(overrides: Partial<LifeSimSnapshot> = {}): LifeSimSnapshot {
  return { ...createEmptySnapshot(config, fixedNow()), ...overrides };
}

describe("base schedule transitions", () => {
  let engine: Awaited<ReturnType<typeof createLifeSimEngine>>;

  beforeEach(async () => {
    engine = await createLifeSimEngine(config, { now: fixedNow, store: new InMemoryLifeSimStore() });
  });

  it("emits arrive entries on start_day", async () => {
    const result = await engine.execute(makeCommand("world.start_day", {}));
    expect(result.events.map((e) => e.type)).toEqual([
      "world.day_started",
      "schedule.activity_started",
      "schedule.activity_started",
      "schedule.activity_started",
      "agent.location_changed",
      "agent.location_changed",
      "agent.location_changed",
    ]);
    const starts = result.events.filter((e) => e.type === "schedule.activity_started");
    expect(starts.map((e) => (e.payload as { entryId: string }).entryId).sort()).toEqual(
      ["orch-arrive", "reviewer-arrive", "worker-arrive"].sort()
    );
    expect(starts.every((e) => (e.payload as { startedAtWorldMinute: number }).startedAtWorldMinute === 480)).toBe(true);
  });

  it("transitions to work entries at 08:30", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
    expect(result.events.map((e) => e.type)).toEqual([
      "schedule.activity_completed",
      "schedule.activity_completed",
      "schedule.activity_completed",
      "schedule.activity_started",
      "schedule.activity_started",
      "schedule.activity_started",
      "agent.location_changed",
      "agent.location_changed",
      "world.time_advanced",
    ]);
    expect(result.events.at(-1)?.type).toBe("world.time_advanced");

    const completed = result.events
      .filter((e) => e.type === "schedule.activity_completed")
      .map((e) => (e.payload as { entryId: string }).entryId)
      .sort();
    expect(completed).toEqual(["orch-arrive", "reviewer-arrive", "worker-arrive"].sort());

    const started = result.events
      .filter((e) => e.type === "schedule.activity_started")
      .map((e) => (e.payload as { entryId: string }).entryId)
      .sort();
    expect(started).toEqual(["orch-work-am", "reviewer-review-am", "worker-work-am"].sort());

    const locationChanges = result.events.filter((e) => e.type === "agent.location_changed");
    expect(locationChanges.map((e) => (e.payload as { agentId: string }).agentId).sort()).toEqual([
      "reviewer-1",
      "worker-1",
    ]);
  });

  it("preserves startedAtWorldMinute while continuing the same entry", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 60 }));
    const state1 = engine.getSnapshot().snapshot;
    const startedAt1 = state1.activeActivities.find((a) => a.agentId === "orchestrator-1")!.startedAtWorldMinute;
    expect(startedAt1).toBe(510);

    await engine.execute(makeCommand("world.advance_time", { minutes: 60 }));
    const state2 = engine.getSnapshot().snapshot;
    const startedAt2 = state2.activeActivities.find((a) => a.agentId === "orchestrator-1")!.startedAtWorldMinute;
    expect(startedAt2).toBe(510);
  });

  it("executes every crossed minute during a large advance", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.advance_time", { minutes: 300 }));
    expect(result.events.at(-1)?.type).toBe("world.time_advanced");

    expect(result.events.map((e) => e.type)).toEqual([
      // 08:30 - arrive ends, work/review starts
      "schedule.activity_completed",
      "schedule.activity_completed",
      "schedule.activity_completed",
      "schedule.activity_started",
      "schedule.activity_started",
      "schedule.activity_started",
      "agent.location_changed",
      "agent.location_changed",
      // 12:00 - morning work/review ends, afternoon begins
      "schedule.activity_completed",
      "schedule.activity_completed",
      "schedule.activity_completed",
      "world.phase_changed",
      // work/review entries end, agents move to idle (no room)
      "agent.location_changed",
      "agent.location_changed",
      "agent.location_changed",
      // coalesced advance
      "world.time_advanced",
    ]);

    expect(result.events.filter((e) => e.type === "world.phase_changed").map((e) => e.payload)).toEqual([
      { oldPhase: "morning", newPhase: "afternoon", minute: 720 },
    ]);

    const state = engine.getSnapshot().snapshot;
    expect(state.activeActivities).toHaveLength(0);
    expect(state.worldClock.minuteOfDay).toBe(780);
  });

  it("integrates run_to_end_of_day with schedule transitions", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const result = await engine.execute(makeCommand("world.run_to_end_of_day", {}));
    expect(result.events.at(-1)?.type).toBe("world.time_advanced");
    expect(result.events.at(-1)?.payload).toEqual({ oldMinute: 480, newMinute: 1110, day: 1 });

    const phaseChanges = result.events.filter((e) => e.type === "world.phase_changed");
    expect(phaseChanges.map((e) => e.payload)).toEqual([
      { oldPhase: "morning", newPhase: "afternoon", minute: 720 },
      { oldPhase: "afternoon", newPhase: "evening", minute: 1080 },
    ]);

    const state = engine.getSnapshot().snapshot;
    expect(state.worldClock.minuteOfDay).toBe(1110);
    expect(state.activeActivities).toHaveLength(0);
  });

  it("does not overwrite persisted base schedules on start_day", async () => {
    const existing: AgentScheduleEntry = {
      entryId: "existing-entry",
      agentId: "agent-x",
      startMinute: 480,
      endMinute: 600,
      activity: "idle",
      roomId: null,
      priority: 1,
      source: "base",
    };
    const store = new InMemoryLifeSimStore();
    const initial = makeSnapshot({ baseSchedules: [existing] });
    store.set(initial, [], new Map());
    const persistedEngine = await createLifeSimEngine(config, { now: fixedNow, store });
    await persistedEngine.execute(makeCommand("world.start_day", {}));
    expect(persistedEngine.getSnapshot().snapshot.baseSchedules).toEqual([existing]);
  });
});

describe("findEffectiveEntry overlay precedence", () => {
  it("prefers system source over priority", () => {
    const base: AgentScheduleEntry = {
      entryId: "base",
      agentId: "a",
      startMinute: 0,
      endMinute: 100,
      activity: "idle",
      roomId: null,
      priority: 100,
      source: "base",
    };
    const system: AgentScheduleEntry = {
      entryId: "system",
      agentId: "a",
      startMinute: 0,
      endMinute: 100,
      activity: "work",
      roomId: null,
      priority: 1,
      source: "system",
    };
    const snapshot = makeSnapshot({ baseSchedules: [base, system] });
    expect(findEffectiveEntry(snapshot, "a", 50)?.entryId).toBe("system");
  });

  it("falls back to priority, then earlier startMinute, then entryId", () => {
    const e1: AgentScheduleEntry = {
      entryId: "b",
      agentId: "a",
      startMinute: 10,
      endMinute: 100,
      activity: "idle",
      roomId: null,
      priority: 2,
      source: "base",
    };
    const e2: AgentScheduleEntry = {
      entryId: "a",
      agentId: "a",
      startMinute: 10,
      endMinute: 100,
      activity: "idle",
      roomId: null,
      priority: 2,
      source: "base",
    };
    const e3: AgentScheduleEntry = {
      entryId: "c",
      agentId: "a",
      startMinute: 5,
      endMinute: 100,
      activity: "idle",
      roomId: null,
      priority: 2,
      source: "base",
    };
    const e4: AgentScheduleEntry = {
      entryId: "d",
      agentId: "a",
      startMinute: 10,
      endMinute: 100,
      activity: "idle",
      roomId: null,
      priority: 1,
      source: "base",
    };
    const snapshot = makeSnapshot({ baseSchedules: [e1, e2, e3, e4] });
    expect(findEffectiveEntry(snapshot, "a", 50)?.entryId).toBe("c");
  });
});

describe("buildActiveActivity", () => {
  it("returns an active activity from the effective entry", () => {
    const entry: AgentScheduleEntry = {
      entryId: "active",
      agentId: "a",
      startMinute: 10,
      endMinute: 100,
      activity: "work",
      roomId: "room-a",
      priority: 1,
      source: "base",
    };
    const snapshot = makeSnapshot({ baseSchedules: [entry] });
    expect(buildActiveActivity(snapshot, "a", 50, 42, "task-1")).toEqual({
      agentId: "a",
      scheduleEntryId: "active",
      activity: "work",
      roomId: "room-a",
      startedAtWorldMinute: 42,
      interruptedByTaskId: "task-1",
    });
  });

  it("returns null when no effective entry matches", () => {
    const snapshot = makeSnapshot();
    expect(buildActiveActivity(snapshot, "a", 50, 42)).toBeNull();
  });

  it("defaults interruptedByTaskId to null", () => {
    const entry: AgentScheduleEntry = {
      entryId: "active",
      agentId: "a",
      startMinute: 10,
      endMinute: 100,
      activity: "idle",
      roomId: null,
      priority: 1,
      source: "base",
    };
    const snapshot = makeSnapshot({ baseSchedules: [entry] });
    expect(buildActiveActivity(snapshot, "a", 50, 42)?.interruptedByTaskId).toBeNull();
  });
});
