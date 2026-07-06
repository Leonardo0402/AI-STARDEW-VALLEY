import { describe, it, expect } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import {
  taskAssigned,
  taskCompleted,
  taskCreated,
  artifactCreated,
  approvalRequested,
  approvalResolved,
} from "./__fixtures__/runtime-events.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "summary-test",
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

describe("DaySummary aggregation", () => {
  it("aggregates task and approval counts from runtime events", async () => {
    const engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });

    await engine.execute(makeCommand("world.start_day", { day: 1 }));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));

    await engine.applyRuntimeEvent(taskCreated(1, "t-1"));
    await engine.applyRuntimeEvent(taskAssigned(2, "t-1", "worker-1", "room-execution"));
    await engine.applyRuntimeEvent(
      artifactCreated(3, "a-1", "t-1", "worker-1", "Day 1 deliverable")
    );
    await engine.applyRuntimeEvent(
      approvalRequested(4, "ap-1", "t-1", "worker-1", "Deliverable ready for review")
    );
    await engine.applyRuntimeEvent(approvalResolved(5, "ap-1", "t-1", "approved", "reviewer-1"));
    await engine.applyRuntimeEvent(taskCompleted(6, "t-1"));

    await engine.execute(makeCommand("world.run_to_end_of_day", {}));
    await engine.execute(makeCommand("world.end_day", {}));

    const summary = engine.getSnapshot().snapshot.completedDaySummaries[0];
    expect(summary.taskCounts).toEqual({ created: 1, completed: 1, blocked: 0, failed: 0 });
    expect(summary.approvalCounts).toEqual({ requested: 1, approved: 1, rejected: 0 });
  });
});
