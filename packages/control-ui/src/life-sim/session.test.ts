import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  LifeSimSnapshotResponse,
  LifeSimEvent,
  LifeSimCommand,
  LifeSimCommandResult,
  LifeSimSnapshot,
} from "@agent-office/life-sim";
import type { LifeSimClient, LifeSimStreamObserver, LifeSimSessionState } from "./types.js";
import { LifeSimSession } from "./session.js";

const baseSnapshot: LifeSimSnapshot = {
  worldId: "world-1",
  schemaVersion: "1",
  checkpointLifeSimSequence: 3,
  lastObservedRuntimeSequence: 10,
  lastAppliedRuntimeSequence: 9,
  worldClock: {
    worldId: "world-1",
    day: 1,
    dayOfWeek: 1,
    minuteOfDay: 480,
    phase: "morning",
    status: "running",
    speed: 0,
    fractionalMinute: 0,
    updatedAt: "2026-07-06T08:00:00.000Z",
  },
  baseSchedules: [],
  activeActivities: [],
  activeOverlays: [],
  completedDaySummaries: [],
  truncatedHistory: { truncated: false, lostRuntimeRange: null },
};

function makeSnapshotResponse(tail: LifeSimEvent[] = []): LifeSimSnapshotResponse {
  return {
    worldId: baseSnapshot.worldId,
    schemaVersion: baseSnapshot.schemaVersion,
    checkpointLifeSimSequence: baseSnapshot.checkpointLifeSimSequence,
    snapshot: structuredClone(baseSnapshot),
    eventLogTail: structuredClone(tail),
  };
}

function makeEvent(seq: number, type: string, payload: unknown): LifeSimEvent {
  return {
    eventId: `evt-${seq}`,
    worldId: "world-1",
    lifeSimSequence: seq,
    type,
    occurredAt: "2026-07-06T08:00:00.000Z",
    worldMinute: 480,
    day: 1,
    causationId: null,
    runtimeEventId: null,
    runtimeSequence: null,
    payload,
  };
}

class MockSubscription {
  closed = false;
  ready = false;

  constructor(
    public afterLifeSimSequence: number,
    private observer: LifeSimStreamObserver
  ) {}

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.observer.onState?.("closed");
  }

  simulateReady(): void {
    if (this.closed) return;
    this.ready = true;
    this.observer.onState?.("ready");
  }

  simulateEvent(event: LifeSimEvent): void {
    if (this.closed) return;
    this.observer.onEvent(event);
  }

  simulateError(): void {
    if (this.closed) return;
    this.observer.onError?.({
      code: "network_error",
      message: "SSE connection error",
      recoverable: true,
    });
  }

  simulateReset(): void {
    if (this.closed) return;
    this.observer.onState?.("reset_required");
    this.close();
  }
}

class MockClient implements LifeSimClient {
  snapshotResponse: LifeSimSnapshotResponse = makeSnapshotResponse();
  commandResult: LifeSimCommandResult = {
    commandId: "cmd-1",
    status: "accepted",
    lifeSimSequence: 4,
    events: [],
    error: null,
  };
  getSnapshot = vi.fn(async () => structuredClone(this.snapshotResponse));
  execute = vi.fn(async (_command: LifeSimCommand) => structuredClone(this.commandResult));
  subscriptions: MockSubscription[] = [];
  subscribe = vi.fn((afterLifeSimSequence: number, observer: LifeSimStreamObserver) => {
    const sub = new MockSubscription(afterLifeSimSequence, observer);
    this.subscriptions.push(sub);
    observer.onState?.("opening");
    return {
      close: () => sub.close(),
    };
  });
}

describe("LifeSimSession", () => {
  let client: MockClient;
  let session: LifeSimSession;

  beforeEach(() => {
    client = new MockClient();
    session = new LifeSimSession(client);
  });

  afterEach(async () => {
    session.stop();
    vi.useRealTimers();
  });

  it("start bootstraps from snapshot and exposes projection", async () => {
    await session.start();

    expect(client.getSnapshot).toHaveBeenCalledTimes(1);
    const projection = session.getProjection();
    expect(projection.world.day).toBe(1);
    expect(projection.agents).toEqual([]);
    expect(projection.truncated).toBe(false);
    expect(session.isTruncated()).toBe(false);
  });

  it("applies event log tail in order", async () => {
    client.snapshotResponse = makeSnapshotResponse([
      makeEvent(4, "world.day_started", {
        day: 2,
        dayOfWeek: 2,
        startedAtWorldMinute: 0,
      }),
    ]);

    await session.start();

    expect(session.getProjection().world.day).toBe(2);
    expect(session.getProjection().world.status).toBe("running");
    expect(client.subscriptions[0].afterLifeSimSequence).toBe(4);
  });

  it("applies live events and notifies projection listeners", async () => {
    await session.start();
    const listener = vi.fn();
    session.onProjectionChange(listener);

    client.subscriptions[0].simulateEvent(
      makeEvent(4, "world.day_started", {
        day: 2,
        dayOfWeek: 2,
        startedAtWorldMinute: 0,
      })
    );

    expect(session.getProjection().world.day).toBe(2);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        world: expect.objectContaining({ day: 2 }),
      })
    );
  });

  it("re-bootstraps after a tail continuity gap without rejecting start", async () => {
    vi.useFakeTimers();
    const bad = makeSnapshotResponse([
      makeEvent(5, "world.day_started", {
        day: 2,
        dayOfWeek: 2,
        startedAtWorldMinute: 0,
      }),
    ]);
    const good = makeSnapshotResponse([
      makeEvent(4, "world.day_started", {
        day: 2,
        dayOfWeek: 2,
        startedAtWorldMinute: 0,
      }),
    ]);
    client.getSnapshot = vi
      .fn()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(good);
    const states: LifeSimSessionState[] = [];
    session.onStateChange((state) => states.push(state));

    await expect(session.start()).resolves.toBeUndefined();
    expect(states).toContain("reconnecting");

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    expect(client.getSnapshot).toHaveBeenCalledTimes(2);
    expect(session.getProjection().world.day).toBe(2);
  });

  it("stop during bootstrap aborts in-flight start and leaves no subscription", async () => {
    let resolveSnapshot: (value: LifeSimSnapshotResponse) => void;
    const snapshotPromise = new Promise<LifeSimSnapshotResponse>((resolve) => {
      resolveSnapshot = resolve;
    });
    client.getSnapshot = vi.fn().mockResolvedValueOnce(snapshotPromise);

    const states: LifeSimSessionState[] = [];
    session.onStateChange((state) => states.push(state));

    const startPromise = session.start();

    expect(states).toContain("bootstrapping");

    session.stop();

    resolveSnapshot!(makeSnapshotResponse());
    await startPromise;

    expect(client.subscriptions).toHaveLength(0);
    expect(states).not.toContain("live");
    expect(states[states.length - 1]).toBe("idle");
  });

  it("re-bootstraps after a live event gap", async () => {
    vi.useFakeTimers();
    await session.start();
    const sub = client.subscriptions[0];

    client.getSnapshot.mockResolvedValueOnce(
      makeSnapshotResponse([
        makeEvent(4, "world.day_started", {
          day: 2,
          dayOfWeek: 2,
          startedAtWorldMinute: 0,
        }),
      ])
    );

    sub.simulateEvent(
      makeEvent(6, "world.day_started", {
        day: 3,
        dayOfWeek: 3,
        startedAtWorldMinute: 0,
      })
    );

    await vi.advanceTimersByTimeAsync(100);
    await vi.runAllTimersAsync();

    expect(client.getSnapshot).toHaveBeenCalledTimes(2);
    expect(session.getProjection().world.day).toBe(2);
  });

  it("execute forwards command and surfaces rejected results", async () => {
    client.commandResult = {
      commandId: "cmd-1",
      status: "rejected",
      lifeSimSequence: null,
      events: [],
      error: { code: "invalid_command", message: "bad command" },
    };

    const command: LifeSimCommand = {
      commandId: "cmd-1",
      commandType: "world.start_day",
      timestamp: "2026-07-06T08:00:00.000Z",
      source: "user",
      actorId: "user-1",
      worldId: "world-1",
      payload: {},
    };

    const result = await session.execute(command);

    expect(client.execute).toHaveBeenCalledWith(command);
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("invalid_command");
  });

  it("isTruncated reflects truncated snapshot history", async () => {
    const response = makeSnapshotResponse();
    response.snapshot.truncatedHistory = {
      truncated: true,
      lostRuntimeRange: { from: 1, to: 5 },
    };
    client.snapshotResponse = response;

    await session.start();

    expect(session.isTruncated()).toBe(true);
    expect(session.getProjection().truncated).toBe(true);
  });

  it("reset_required transitions session to error", async () => {
    const states: LifeSimSessionState[] = [];
    session.onStateChange((state) => states.push(state));

    await session.start();
    client.subscriptions[0].simulateReset();

    expect(states).toContain("error");
    expect(client.subscriptions[0].closed).toBe(true);
  });

  it("stop closes subscription and cancels reconnect", async () => {
    vi.useFakeTimers();
    client.getSnapshot = vi.fn().mockRejectedValue(new Error("network down"));

    await expect(session.start()).rejects.toThrow("network down");
    session.stop();

    expect(client.subscriptions).toHaveLength(0);
    // No further timers should fire.
    await vi.advanceTimersByTimeAsync(10000);
    expect(client.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it("retries with exponential backoff and enters error after max attempts", async () => {
    vi.useFakeTimers();
    client.getSnapshot = vi.fn().mockRejectedValue(new Error("network down"));
    const states: LifeSimSessionState[] = [];
    session.onStateChange((state) => states.push(state));

    await expect(session.start()).rejects.toThrow("network down");

    // initial + 5 retries: delays 100, 200, 400, 800, 1600 = 3100ms
    await vi.advanceTimersByTimeAsync(3100);
    await vi.runAllTimersAsync();

    expect(client.getSnapshot).toHaveBeenCalledTimes(6);
    expect(states).toContain("error");
  });

  it("getCapabilities reflects current world clock state", async () => {
    await session.start();

    const capabilities = session.getCapabilities();
    expect(capabilities.world.startDay).toBe(false);
    expect(capabilities.world.advanceTime).toBe(true);
    expect(capabilities.schedule.override).toBe(false);
    expect(capabilities.clock.mode).toBe("manual");
  });
});
