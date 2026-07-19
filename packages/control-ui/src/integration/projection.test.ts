import { describe, it, expect } from "vitest";
import { createEmptySnapshot } from "@agent-office/core";
import { EventType, type RuntimeAdapter, type RuntimeSnapshot, type DomainEvent } from "@agent-office/protocol";
import {
  projectIntegration,
  projectTimelineIntegration,
  emptyIntegrationProjection,
  type IntegrationProjectionProvider,
} from "./projection.js";
import type { IntegrationProjection } from "./types.js";

const fakeCapabilities = {
  supportedEvents: [] as string[],
  supportedCommands: [] as string[],
  features: {
    snapshot: false,
    sse: false,
    websocket: false,
    commandExecution: false,
    softMapping: false,
    hardOrchestration: false,
  },
};

class FakeProvider implements RuntimeAdapter, IntegrationProjectionProvider {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async execute(): Promise<never> { throw new Error("unused"); }
  async getSnapshot(): Promise<RuntimeSnapshot> { return createEmptySnapshot("r"); }
  getCapabilities() { return fakeCapabilities; }
  subscribe(): ReturnType<RuntimeAdapter["subscribe"]> {
    return { ready: Promise.resolve(), close: () => {} };
  }
  getIntegrationProjection(): IntegrationProjection {
    return {
      github: { issues: [], pulls: [], auditNotes: [] },
      reviews: { assigned: [], submitted: [] },
      timeline: null,
    };
  }
}

class FakePlainAdapter implements RuntimeAdapter {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async execute(): Promise<never> { throw new Error("unused"); }
  async getSnapshot(): Promise<RuntimeSnapshot> { return createEmptySnapshot("r"); }
  getCapabilities() { return fakeCapabilities; }
  subscribe(): ReturnType<RuntimeAdapter["subscribe"]> {
    return { ready: Promise.resolve(), close: () => {} };
  }
}

function makeEvent(overrides: Partial<DomainEvent> & { eventId: string; type: string; sequence: number }): DomainEvent {
  return {
    runtimeId: "r",
    schemaVersion: "1.0",
    occurredAt: "2026-01-01T00:00:00Z",
    receivedAt: "2026-01-01T00:00:00Z",
    correlationId: "c",
    causationId: null,
    traceId: "t",
    payload: {},
    ...overrides,
  } as DomainEvent;
}

describe("projectIntegration", () => {
  it("returns provider projection when adapter implements IntegrationProjectionProvider", async () => {
    const adapter = new FakeProvider();
    const snapshot = await adapter.getSnapshot();
    const result = projectIntegration(adapter, snapshot, []);
    expect(result.github).not.toBeNull();
    expect(result.reviews).not.toBeNull();
    expect(result.timeline).not.toBeNull();
    expect(result.timeline?.events).toEqual([]);
  });

  it("returns empty projection for plain adapter", async () => {
    const adapter = new FakePlainAdapter();
    const snapshot = await adapter.getSnapshot();
    const result = projectIntegration(adapter, snapshot);
    expect(result).toEqual(emptyIntegrationProjection());
  });

  it("computes timeline projection from event log", async () => {
    const adapter = new FakeProvider();
    const snapshot = await adapter.getSnapshot();
    const eventLog = [
      makeEvent({ eventId: "e1", type: EventType.TASK_CREATED, sequence: 1, payload: { taskId: "t1" } }),
      makeEvent({ eventId: "e2", type: EventType.AGENT_STATUS_CHANGED, sequence: 2, payload: {} }),
      makeEvent({ eventId: "e3", type: EventType.REVIEW_ASSIGNED, sequence: 3, payload: { agentId: "a1" } }),
    ];
    const result = projectIntegration(adapter, snapshot, eventLog);
    expect(result.timeline?.events).toHaveLength(2);
    expect(result.timeline?.events[0].type).toBe(EventType.TASK_CREATED);
    expect(result.timeline?.events[1].type).toBe(EventType.REVIEW_ASSIGNED);
  });
});

describe("projectTimelineIntegration", () => {
  it("filters to timeline-relevant event types", () => {
    const events: DomainEvent[] = [
      makeEvent({ eventId: "e1", type: EventType.TASK_CREATED, sequence: 1 }),
      makeEvent({ eventId: "e2", type: EventType.AGENT_STATUS_CHANGED, sequence: 2 }),
      makeEvent({ eventId: "e3", type: EventType.REVIEW_SUBMITTED, sequence: 3 }),
    ];
    const result = projectTimelineIntegration(events);
    expect(result.events.map((e) => e.type)).toEqual([
      EventType.TASK_CREATED,
      EventType.REVIEW_SUBMITTED,
    ]);
  });

  it("sorts events by sequence", () => {
    const events: DomainEvent[] = [
      makeEvent({ eventId: "e2", type: EventType.REVIEW_ASSIGNED, sequence: 2 }),
      makeEvent({ eventId: "e1", type: EventType.TASK_CREATED, sequence: 1 }),
    ];
    const result = projectTimelineIntegration(events);
    expect(result.events.map((e) => e.eventId)).toEqual(["e1", "e2"]);
    expect(result.events[0].sequence).toBe(1);
    expect(result.events[1].sequence).toBe(2);
  });

  it("returns empty events for empty input", () => {
    const result = projectTimelineIntegration([]);
    expect(result.events).toEqual([]);
  });
});
