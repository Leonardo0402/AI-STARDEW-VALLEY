import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import { RuntimeSession, SnapshotStore, CommandGateway } from "@agent-office/core";
import { CommandType, EventType, type OfficeCommand, type DomainEvent } from "@agent-office/protocol";
import { createLifeSimEngine } from "./engine.js";
import { InMemoryLifeSimStore } from "./store.js";
import { RuntimeLifeSimBridge } from "./runtime-bridge.js";
import { sampleDay1Schedules } from "./__fixtures__/schedules.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const MOCK_RUNTIME_ID = "mock-runtime-001";

const config: LifeSimEngineConfig = {
  worldId: "bridge-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
  baseSchedules: sampleDay1Schedules(),
};

function makeLifeSimCommand(type: string, payload: unknown): LifeSimCommand {
  return {
    commandId: `cmd-ls-${type}-${JSON.stringify(payload)}`,
    commandType: type,
    timestamp: "2026-07-05T08:00:00Z",
    source: "user",
    actorId: "operator",
    worldId: config.worldId,
    payload,
  };
}

function makeOfficeCommand(
  commandId: string,
  type: string,
  payload: unknown,
  targetId: string | null = null
): OfficeCommand {
  return {
    commandId,
    commandType: type,
    timestamp: "2026-07-05T08:00:00Z",
    source: "user",
    actorId: "operator",
    runtimeId: MOCK_RUNTIME_ID,
    targetId,
    payload,
  };
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((r) => r());
  }
}

describe("RuntimeLifeSimBridge", () => {
  let adapter: MockRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;
  let engine: Awaited<ReturnType<typeof createLifeSimEngine>>;
  let bridge: RuntimeLifeSimBridge;

  beforeEach(async () => {
    adapter = new MockRuntimeAdapter({ eventDelayMs: 0 });
    store = new SnapshotStore(MOCK_RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);
    engine = await createLifeSimEngine(config, { store: new InMemoryLifeSimStore() });
    bridge = new RuntimeLifeSimBridge(session, engine);
  });

  afterEach(async () => {
    bridge.disconnect();
    await session.disconnect();
  });

  it("forwards applied task.assigned into the engine", async () => {
    bridge.connect();
    await session.connect();

    await engine.execute(makeLifeSimCommand("world.start_day", {}));
    await engine.execute(makeLifeSimCommand("world.advance_time", { minutes: 60 }));

    const createResult = await gateway.execute(
      makeOfficeCommand("cmd-create-1", CommandType.TASK_CREATE, {
        title: "Bridge task",
        description: "Assigned through the bridge",
      })
    );
    expect(createResult.status).toBe("accepted");

    const runtimeSnapshot = store.getSnapshot();
    const workerId = runtimeSnapshot.agents.find((a) => a.role === "worker")!.agentId;
    const taskId = runtimeSnapshot.tasks[0].taskId;

    const beforeSequence = engine.getSnapshot().snapshot.lastObservedRuntimeSequence;

    const assignResult = await gateway.execute(
      makeOfficeCommand("cmd-assign-1", CommandType.TASK_ASSIGN, { taskId, agentId: workerId }, taskId)
    );
    expect(assignResult.status).toBe("accepted");

    await flushPromises();

    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays.some((o) => o.createdByTaskId === taskId)).toBe(true);
    expect(state.lastObservedRuntimeSequence).toBeGreaterThan(beforeSequence);
    expect(state.lastAppliedRuntimeSequence).toBeGreaterThan(beforeSequence);
  });

  it("observes sequence for reducer_rejected task.completed", async () => {
    bridge.connect();
    await session.connect();

    await engine.execute(makeLifeSimCommand("world.start_day", {}));
    await engine.execute(makeLifeSimCommand("world.advance_time", { minutes: 60 }));

    const beforeSequence = engine.getSnapshot().snapshot.lastObservedRuntimeSequence;

    // Emit a task.completed event for a task that was never created.
    // The transport validation passes, but the core reducer rejects it.
    (adapter as unknown as { emit(event: DomainEvent): void }).emit({
      eventId: "evt-bad-complete-1",
      runtimeId: MOCK_RUNTIME_ID,
      sequence: 1,
      schemaVersion: "1.0",
      type: EventType.TASK_COMPLETED,
      occurredAt: "2026-07-05T08:00:00Z",
      receivedAt: "2026-07-05T08:00:00Z",
      correlationId: "corr-test",
      causationId: null,
      traceId: "trace-test",
      payload: { taskId: "task-never-created" },
    });

    await flushPromises();

    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays).toHaveLength(0);
    expect(state.lastObservedRuntimeSequence).toBeGreaterThan(beforeSequence);
    expect(state.lastAppliedRuntimeSequence).toBe(beforeSequence);
  });

  it("stops forwarding events after disconnect", async () => {
    bridge.connect();
    await session.connect();

    await engine.execute(makeLifeSimCommand("world.start_day", {}));
    await engine.execute(makeLifeSimCommand("world.advance_time", { minutes: 60 }));

    bridge.disconnect();

    const createResult = await gateway.execute(
      makeOfficeCommand("cmd-create-2", CommandType.TASK_CREATE, {
        title: "Ignored task",
        description: "Should not reach the engine",
      })
    );
    expect(createResult.status).toBe("accepted");

    const runtimeSnapshot = store.getSnapshot();
    const workerId = runtimeSnapshot.agents.find((a) => a.role === "worker")!.agentId;
    const taskId = runtimeSnapshot.tasks[0].taskId;

    const beforeSequence = engine.getSnapshot().snapshot.lastObservedRuntimeSequence;

    await gateway.execute(
      makeOfficeCommand("cmd-assign-2", CommandType.TASK_ASSIGN, { taskId, agentId: workerId }, taskId)
    );

    await flushPromises();

    const state = engine.getSnapshot().snapshot;
    expect(state.activeOverlays).toHaveLength(0);
    expect(state.lastObservedRuntimeSequence).toBe(beforeSequence);
  });
});
