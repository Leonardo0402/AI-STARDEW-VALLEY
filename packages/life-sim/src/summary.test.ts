import { describe, it, expect } from "vitest";
import { computeDaySummary } from "./summary.js";
import { createEmptySnapshot } from "./store.js";
import type { LifeSimEngineConfig, LifeSimSnapshot } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "summary-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
};

describe("computeDaySummary", () => {
  it("returns empty agent activities in Phase 1 without mutating the snapshot", () => {
    const snapshot = createEmptySnapshot(config, "2026-07-05T08:00:00Z");
    snapshot.completedDaySummaries = [
      {
        day: 1,
        startedAtWorldMinute: 480,
        endedAtWorldMinute: 1110,
        truncated: false,
        agentActivities: [],
        taskCounts: { created: 1, completed: 0, blocked: 0, failed: 0 },
        approvalCounts: { requested: 0, approved: 0, rejected: 0 },
        notableEventIds: ["evt-1", "evt-2"],
      },
    ];
    const before = JSON.stringify(snapshot);

    const { summary, events } = computeDaySummary(snapshot, 1, 480, 1110);

    expect(summary.agentActivities).toEqual([]);
    expect(summary.taskCounts).toEqual({ created: 0, completed: 0, blocked: 0, failed: 0 });
    expect(summary.approvalCounts).toEqual({ requested: 0, approved: 0, rejected: 0 });
    expect(summary.notableEventIds).toEqual([]);
    expect(events).toEqual([]);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});
