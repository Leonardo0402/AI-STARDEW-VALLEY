import { describe, it, expect } from "vitest";
import type { LifeSimSnapshot, WorldClockState } from "./types.js";

describe("LifeSim types", () => {
  it("compiles a minimal snapshot", () => {
    const clock: WorldClockState = {
      worldId: "w-1",
      day: 1,
      dayOfWeek: 1,
      minuteOfDay: 480,
      phase: "morning",
      status: "not_started",
      speed: 0,
      fractionalMinute: 0,
      updatedAt: "2026-07-05T00:00:00Z",
    };
    const snapshot: LifeSimSnapshot = {
      worldId: "w-1",
      schemaVersion: "1.0",
      checkpointLifeSimSequence: 0,
      lastObservedRuntimeSequence: 0,
      lastAppliedRuntimeSequence: 0,
      worldClock: clock,
      baseSchedules: [],
      activeActivities: [],
      activeOverlays: [],
      completedDaySummaries: [],
      truncatedHistory: { truncated: false, lostRuntimeRange: null },
    };
    expect(snapshot.worldClock.day).toBe(1);
  });
});
