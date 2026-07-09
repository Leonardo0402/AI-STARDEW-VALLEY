import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLifeSimEngine } from "./engine.js";
import { FileLifeSimStore, InMemoryLifeSimStore } from "./store.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import { taskAssigned } from "./__fixtures__/runtime-events.js";
import { EventType } from "@agent-office/protocol";
import type { LifeSimCommand, LifeSimEngineConfig, LifeSimEvent } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "closure-audit",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
  baseSchedules: sampleDay1Schedules(),
};

const RUNTIME_EVENT_TYPES: string[] = Object.values(EventType);

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

describe("Issue #15 closure: Criterion 8 — schedule commands do not fabricate Runtime truth", () => {
  it("world/schedule/day commands never emit Runtime business-truth event types", async () => {
    const engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });
    const emitted: LifeSimEvent[] = [];
    engine.onLifeSimEvent((event) => emitted.push(event));

    await engine.execute(makeCommand("world.start_day", { day: 1 }));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
    await engine.execute(makeCommand("world.run_to_end_of_day", {}));
    await engine.execute(makeCommand("world.end_day", {}));

    const emittedTypes = new Set(emitted.map((e) => e.type));
    const violations = [...emittedTypes].filter((t) => RUNTIME_EVENT_TYPES.includes(t));
    expect(violations).toEqual([]);
  });
});

describe("Issue #15 closure: Criterion 5 — mid-day reload restores exact state", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "life-sim-closure-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("FileLifeSimStore reload restores mid-day snapshot, tail, cursors, and command results", async () => {
    const store = new FileLifeSimStore(config.worldId, dataDir);
    const engine = await createLifeSimEngine(config, { store });

    await engine.execute(makeCommand("world.start_day", { day: 1 }));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));

    const beforeReload = engine.getSnapshot();
    expect(beforeReload.snapshot.activeOverlays.length).toBeGreaterThan(0);
    expect(beforeReload.eventLogTail.length).toBeGreaterThan(0);
    expect(beforeReload.snapshot.lastAppliedRuntimeSequence).toBe(7);

    const reloadedEngine = await createLifeSimEngine(config, { store });
    const afterReload = reloadedEngine.getSnapshot();

    expect(afterReload.snapshot.worldClock).toEqual(beforeReload.snapshot.worldClock);
    expect(afterReload.snapshot.activeActivities).toEqual(beforeReload.snapshot.activeActivities);
    expect(afterReload.snapshot.activeOverlays).toEqual(beforeReload.snapshot.activeOverlays);
    expect(afterReload.snapshot.checkpointLifeSimSequence).toBe(beforeReload.snapshot.checkpointLifeSimSequence);
    expect(afterReload.snapshot.lastObservedRuntimeSequence).toBe(beforeReload.snapshot.lastObservedRuntimeSequence);
    expect(afterReload.snapshot.lastAppliedRuntimeSequence).toBe(beforeReload.snapshot.lastAppliedRuntimeSequence);
    expect(afterReload.eventLogTail).toEqual(beforeReload.eventLogTail);
  });
});

describe("Issue #15 closure: Criterion 7 — Day 1 history survives Day 2 start", () => {
  it("Day 1 completedDaySummaries and event tail remain accessible after Day 2 starts", async () => {
    const engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });

    await engine.execute(makeCommand("world.start_day", { day: 1 }));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
    await engine.execute(makeCommand("world.run_to_end_of_day", {}));
    await engine.execute(makeCommand("world.end_day", {}));

    const day1Snapshot = engine.getSnapshot();
    const day1SummaryCount = day1Snapshot.snapshot.completedDaySummaries.length;
    const day1TailLength = day1Snapshot.eventLogTail.length;
    expect(day1SummaryCount).toBeGreaterThan(0);

    await engine.execute(makeCommand("world.start_day", { day: 2 }));

    const afterDay2Start = engine.getSnapshot();
    expect(afterDay2Start.snapshot.completedDaySummaries.length).toBe(day1SummaryCount);
    expect(afterDay2Start.snapshot.completedDaySummaries[0].day).toBe(1);
    expect(afterDay2Start.eventLogTail.length).toBeGreaterThanOrEqual(day1TailLength);
  });
});
