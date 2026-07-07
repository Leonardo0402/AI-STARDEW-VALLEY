import { describe, it, expect } from "vitest";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import { taskAssigned, taskCompleted } from "./__fixtures__/runtime-events.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "engine-test",
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

class FailingStore extends InMemoryLifeSimStore {
  private failNext = false;

  failOnNextCall(): void {
    this.failNext = true;
  }

  async save(
    snapshot: Parameters<InMemoryLifeSimStore["save"]>[0],
    eventLogTail: Parameters<InMemoryLifeSimStore["save"]>[1],
    commandResults: Parameters<InMemoryLifeSimStore["save"]>[2]
  ): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("save failed");
    }
    return super.save(snapshot, eventLogTail, commandResults);
  }
}

describe("sequence rollback on persistence failure", () => {
  it("command path: retry after save failure uses sequence 1 for the first durable event", async () => {
    const store = new FailingStore();
    store.failOnNextCall();
    const engine = await createLifeSimEngine(config, { now: fixedNow, store });
    const command = makeCommand("world.start_day", {});

    await expect(engine.execute(command)).rejects.toThrow("save failed");

    const result = await engine.execute(command);
    expect(result.status).toBe("accepted");
    expect(result.events[0].lifeSimSequence).toBe(1);
    expect(engine.getSnapshot().eventLogTail[0].lifeSimSequence).toBe(1);
  });

  it("runtime path: no sequence gap after a failed runtime event save", async () => {
    const store = new FailingStore();
    const engine = await createLifeSimEngine(config, { now: fixedNow, store });
    await engine.execute(makeCommand("world.start_day", {}));
    const tailAfterStart = engine.getSnapshot().eventLogTail;
    const lastSequenceAfterStart = tailAfterStart[tailAfterStart.length - 1].lifeSimSequence;

    store.failOnNextCall();
    await expect(
      engine.applyRuntimeEvent(taskAssigned(1, "t-1", "worker-1", "room-execution"))
    ).rejects.toThrow("save failed");

    await engine.applyRuntimeEvent(taskCompleted(2, "t-1"));
    const tail = engine.getSnapshot().eventLogTail;
    const runtimeCausedEvents = tail.filter((e) => e.runtimeSequence !== null);
    expect(runtimeCausedEvents[0].lifeSimSequence).toBe(lastSequenceAfterStart + 1);
    for (let i = 1; i < runtimeCausedEvents.length; i++) {
      expect(runtimeCausedEvents[i].lifeSimSequence).toBe(
        runtimeCausedEvents[i - 1].lifeSimSequence + 1
      );
    }
  });
});
