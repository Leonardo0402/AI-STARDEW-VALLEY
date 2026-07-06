import { describe, it, expect, beforeEach } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import { taskAssigned, taskCompleted } from "./__fixtures__/runtime-events.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "runtime-test",
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

describe("runtime event handling", () => {
  let engine: Awaited<ReturnType<typeof createLifeSimEngine>>;

  beforeEach(async () => {
    engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 30 }));
  });

  it("creates a task overlay for worker-1", async () => {
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays.some((o) => o.createdByTaskId === "t-1")).toBe(true);
    expect(state.activeActivities.find((a) => a.agentId === "worker-1")?.scheduleEntryId).toBe("overlay-t-1");
  });

  it("ends overlay when task completes", async () => {
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    await engine.applyRuntimeEvent(taskCompleted(8, "t-1"));
    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays.some((o) => o.createdByTaskId === "t-1")).toBe(false);
    expect(state.activeActivities.find((a) => a.agentId === "worker-1")?.scheduleEntryId).toBe("worker-work-am");
  });

  it("emits contiguous lifeSimSequence numbers without gaps", async () => {
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    await engine.applyRuntimeEvent(taskCompleted(8, "t-1"));
    const tail = engine.getSnapshot().eventLogTail;
    const lifeSimSequences = tail.map((e) => e.lifeSimSequence);
    for (let i = 1; i < lifeSimSequences.length; i++) {
      expect(lifeSimSequences[i]).toBe(lifeSimSequences[i - 1] + 1);
    }
  });

  it("creates task overlays with activity work", async () => {
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    await engine.applyRuntimeEvent(taskAssigned(8, "t-2", "reviewer-1", "room-review"));
    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays.every((o) => o.entry.activity === "work")).toBe(true);
  });

  it("emits schedule.activity_resumed when a task completes", async () => {
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    await engine.applyRuntimeEvent(taskCompleted(8, "t-1"));
    const tail = engine.getSnapshot().eventLogTail;
    const resumed = tail.filter((e) => e.type === "schedule.activity_resumed");
    expect(resumed.length).toBeGreaterThan(0);
    expect(resumed.at(-1)?.payload).toMatchObject({ agentId: "worker-1", entryId: "worker-work-am" });
  });

  it("replaces an existing task overlay when a second task is assigned to the same agent", async () => {
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    await engine.applyRuntimeEvent(taskAssigned(8, "t-2", "worker-1", "room-command"));
    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays.some((o) => o.createdByTaskId === "t-1")).toBe(false);
    expect(state.activeOverlays.some((o) => o.createdByTaskId === "t-2")).toBe(true);
    expect(state.activeActivities.find((a) => a.agentId === "worker-1")?.scheduleEntryId).toBe("overlay-t-2");
  });

  it("preserves startedAtWorldMinute for activities whose schedule entry does not change", async () => {
    // worker-1 gets a task overlay at minute 510.
    await engine.applyRuntimeEvent(taskAssigned(7, "t-1", "worker-1", "room-execution"));
    // Advance to 600; worker-1's overlay remains active with its original start minute.
    await engine.execute(makeCommand("world.advance_time", { minutes: 90 }));
    const beforeIntervention = engine.getSnapshot().snapshot;
    const workerActivityBefore = beforeIntervention.activeActivities.find((a) => a.agentId === "worker-1");
    expect(workerActivityBefore?.scheduleEntryId).toBe("overlay-t-1");
    expect(workerActivityBefore?.startedAtWorldMinute).toBe(510);

    // Assign a task to reviewer-1 at minute 600; this rebuilds activities for all agents.
    await engine.applyRuntimeEvent(taskAssigned(8, "t-2", "reviewer-1", "room-review"));
    const afterIntervention = engine.getSnapshot().snapshot;

    const workerActivityAfter = afterIntervention.activeActivities.find((a) => a.agentId === "worker-1");
    expect(workerActivityAfter?.scheduleEntryId).toBe("overlay-t-1");
    expect(workerActivityAfter?.startedAtWorldMinute).toBe(510);

    const reviewerActivityAfter = afterIntervention.activeActivities.find((a) => a.agentId === "reviewer-1");
    expect(reviewerActivityAfter?.scheduleEntryId).toBe("overlay-t-2");
    expect(reviewerActivityAfter?.startedAtWorldMinute).toBe(600);
  });
});
