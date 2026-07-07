import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  LifeSimSnapshotResponse,
  LifeSimEvent,
  LifeSimCommand,
  LifeSimCommandResult,
} from "@agent-office/life-sim";
import { HttpLifeSimClient } from "./client.js";
import type { EventSourceConstructor } from "./client.js";
import type { LifeSimStreamObserver } from "./types.js";

const baseSnapshot: LifeSimSnapshotResponse = {
  worldId: "world-1",
  schemaVersion: "1",
  checkpointLifeSimSequence: 3,
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
  snapshot: {
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
      speed: 1,
      fractionalMinute: 0,
      updatedAt: "2026-07-06T08:00:00.000Z",
    },
    baseSchedules: [],
    activeActivities: [],
    activeOverlays: [],
    completedDaySummaries: [],
    truncatedHistory: { truncated: false, lostRuntimeRange: null },
  },
  eventLogTail: [],
};

const baseCommand: LifeSimCommand = {
  commandId: "cmd-1",
  commandType: "world.startDay",
  timestamp: "2026-07-06T08:00:00.000Z",
  source: "user",
  actorId: "user-1",
  worldId: "world-1",
  payload: {},
};

const baseCommandResult: LifeSimCommandResult = {
  commandId: "cmd-1",
  status: "accepted",
  lifeSimSequence: 4,
  events: [],
  error: null,
};

function makeEvent(seq: number): LifeSimEvent {
  return {
    eventId: `evt-${seq}`,
    worldId: "world-1",
    lifeSimSequence: seq,
    type: "agent.activity.started",
    occurredAt: "2026-07-06T08:00:00.000Z",
    worldMinute: 480,
    day: 1,
    causationId: null,
    runtimeEventId: null,
    runtimeSequence: null,
    payload: { agentId: "agent-1" },
  };
}

function mockFetch(response: Response | Error): typeof fetch {
  const fn = vi.fn();
  if (response instanceof Error) fn.mockRejectedValue(response);
  else fn.mockResolvedValue(response);
  return fn as unknown as typeof fetch;
}

class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];

  url: string;
  readyState = FakeEventSource.CONNECTING;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  private listeners = new Map<string, Set<(ev: unknown) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (ev: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (ev: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }

  simulateOpen(): void {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.({ type: "open" });
  }

  simulateEvent(type: string, data: string, id = ""): void {
    this.listeners.get(type)?.forEach((listener) => listener({ type, data, lastEventId: id }));
  }

  simulateError(): void {
    this.onerror?.({ type: "error" });
  }
}

function makeClient(overrides: {
  fetch?: typeof fetch;
  EventSource?: EventSourceConstructor;
} = {}) {
  return new HttpLifeSimClient({
    baseUrl: "http://localhost:9876",
    worldId: "world-1",
    fetch: overrides.fetch ?? mockFetch(new Response(JSON.stringify(baseSnapshot), { status: 200 })),
    EventSource: overrides.EventSource ?? (FakeEventSource as unknown as EventSourceConstructor),
  });
}

describe("HttpLifeSimClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeEventSource.instances = [];
  });

  it("getSnapshot fetches the snapshot endpoint and parses JSON", async () => {
    const fetchImpl = mockFetch(
      new Response(JSON.stringify(baseSnapshot), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const client = makeClient({ fetch: fetchImpl });

    const snapshot = await client.getSnapshot();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:9876/life-sim/world-1/snapshot");
    expect(snapshot).toEqual(baseSnapshot);
  });

  it("default same-origin baseUrl with worldId 'default' constructs /life-sim/default/snapshot", async () => {
    const fetchImpl = mockFetch(
      new Response(JSON.stringify(baseSnapshot), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const client = new HttpLifeSimClient({
      baseUrl: "",
      worldId: "default",
      fetch: fetchImpl,
      EventSource: FakeEventSource as unknown as EventSourceConstructor,
    });

    await client.getSnapshot();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith("/life-sim/default/snapshot");
  });

  it("execute POSTs the command body and parses the result", async () => {
    const fetchImpl = mockFetch(
      new Response(JSON.stringify(baseCommandResult), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    const client = makeClient({ fetch: fetchImpl });

    const result = await client.execute(baseCommand);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:9876/life-sim/world-1/command",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" }),
        body: JSON.stringify(baseCommand),
      })
    );
    expect(result).toEqual(baseCommandResult);
  });

  it("getSnapshot includes status text in HTTP error message", async () => {
    const fetchImpl = mockFetch(
      new Response("Not Found", { status: 404, statusText: "Not Found" })
    );
    const client = makeClient({ fetch: fetchImpl });

    await expect(client.getSnapshot()).rejects.toThrow("Snapshot fetch failed: HTTP 404: Not Found");
  });

  it("execute includes status text in HTTP error message", async () => {
    const fetchImpl = mockFetch(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" })
    );
    const client = makeClient({ fetch: fetchImpl });

    await expect(client.execute(baseCommand)).rejects.toThrow(
      "Command execution failed: HTTP 400: Bad Request"
    );
  });

  it("subscribe opens an EventSource to the events endpoint", () => {
    const client = makeClient();

    const sub = client.subscribe(3, { onEvent: vi.fn() });

    const instances = FakeEventSource.instances;
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toBe(
      "http://localhost:9876/life-sim/world-1/events?afterLifeSimSequence=3"
    );
    sub.close();
  });

  it("subscribe notifies opening then ready when the stream opens", () => {
    const client = makeClient();
    const observer: LifeSimStreamObserver = {
      onEvent: vi.fn(),
      onState: vi.fn(),
    };

    const sub = client.subscribe(3, observer);
    const es = FakeEventSource.instances[0];
    es.simulateOpen();

    expect(observer.onState).toHaveBeenCalledWith("opening");
    expect(observer.onState).toHaveBeenCalledWith("ready");
    sub.close();
  });

  it("subscribe dispatches life-sim-event frames to onEvent", () => {
    const client = makeClient();
    const observer: LifeSimStreamObserver = { onEvent: vi.fn() };

    const sub = client.subscribe(3, observer);
    const es = FakeEventSource.instances[0];
    const event = makeEvent(4);
    es.simulateEvent("life-sim-event", JSON.stringify(event), "4");

    expect(observer.onEvent).toHaveBeenCalledTimes(1);
    expect(observer.onEvent).toHaveBeenCalledWith(event);
    sub.close();
  });

  it("subscribe closes EventSource and calls onError when the SSE connection drops", () => {
    const client = makeClient();
    const observer: LifeSimStreamObserver = {
      onEvent: vi.fn(),
      onError: vi.fn(),
    };

    const sub = client.subscribe(3, observer);
    const es = FakeEventSource.instances[0];
    es.simulateError();

    expect(es.readyState).toBe(FakeEventSource.CLOSED);
    expect(observer.onError).toHaveBeenCalledTimes(1);
    expect(observer.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "network_error", recoverable: true })
    );
    // Observer should stay alive; calling close explicitly still works.
    expect(() => sub.close()).not.toThrow();
  });

  it("subscribe signals reset_required and closes on reset event", () => {
    const client = makeClient();
    const observer: LifeSimStreamObserver = {
      onEvent: vi.fn(),
      onState: vi.fn(),
    };

    const sub = client.subscribe(3, observer);
    const es = FakeEventSource.instances[0];
    es.simulateEvent("reset", JSON.stringify({ reason: "truncated" }));

    expect(observer.onState).toHaveBeenCalledWith("reset_required");
    expect(es.readyState).toBe(FakeEventSource.CLOSED);
    expect(() => sub.close()).not.toThrow();
  });

  it("close notifies closed state", () => {
    const client = makeClient();
    const observer: LifeSimStreamObserver = {
      onEvent: vi.fn(),
      onState: vi.fn(),
    };

    const sub = client.subscribe(3, observer);
    sub.close();

    expect(observer.onState).toHaveBeenCalledWith("closed");
  });
});
