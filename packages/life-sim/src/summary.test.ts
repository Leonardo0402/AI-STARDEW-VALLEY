import { describe, it, expect } from "vitest";
import { computeDaySummary } from "./summary.js";
import { createEmptySnapshot } from "./store.js";
import type { LifeSimEngineConfig, LifeSimEvent } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "summary-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
};

function makeEvent(type: string, payload: unknown, day = 1): LifeSimEvent {
  return {
    eventId: `evt-${type}`,
    worldId: config.worldId,
    lifeSimSequence: 1,
    type,
    occurredAt: "2026-07-05T08:00:00Z",
    worldMinute: 480,
    day,
    causationId: null,
    runtimeEventId: null,
    runtimeSequence: null,
    payload,
  };
}

describe("computeDaySummary", () => {
  it("aggregates task and approval counts from the event log without mutating the snapshot", () => {
    const snapshot = createEmptySnapshot(config, "2026-07-05T08:00:00Z");
    const eventLogTail = [
      makeEvent("day.task_created", { taskId: "t-1" }),
      makeEvent("day.task_completed", { taskId: "t-1" }),
      makeEvent("day.task_failed", { taskId: "t-2" }),
      makeEvent("day.task_blocked", { taskId: "t-3" }),
      makeEvent("day.approval_requested", { approvalId: "ap-1", taskId: "t-1" }),
      makeEvent("day.approval_resolved", { approvalId: "ap-1", taskId: "t-1", status: "approved" }),
      makeEvent("day.approval_resolved", { approvalId: "ap-2", taskId: "t-2", status: "rejected" }),
      makeEvent("day.task_created", { taskId: "t-4" }, 2),
    ];
    const before = JSON.stringify(snapshot);

    const { summary, events } = computeDaySummary(snapshot, eventLogTail, 1, 480, 1110);

    expect(summary.agentActivities).toEqual([]);
    expect(summary.taskCounts).toEqual({ created: 1, completed: 1, blocked: 1, failed: 1 });
    expect(summary.approvalCounts).toEqual({ requested: 1, approved: 1, rejected: 1 });
    expect(summary.notableEventIds).toEqual([]);
    expect(events).toEqual([]);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});

