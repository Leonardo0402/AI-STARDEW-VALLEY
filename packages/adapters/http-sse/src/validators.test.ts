import { describe, it, expect } from "vitest";
import {
  validateSnapshot,
  validateEvent,
  validateCapabilities,
  validateCommandResult,
} from "./validators.js";
import type {
  RuntimeSnapshot,
  DomainEvent,
  AdapterCapabilities,
  CommandResult,
  AgentStatus,
  AgentRole,
  Priority,
  RoomType,
} from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";

const RUNTIME_ID = "rt-test";

function makeValidSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID,
    snapshotId: `snap-${seq}`,
    sequence: seq,
    schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z",
    lastEventId: "",
    agents: [],
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [],
  };
}

function makeValidEvent(seq: number): DomainEvent {
  return {
    eventId: `evt-${seq}`,
    runtimeId: RUNTIME_ID,
    sequence: seq,
    schemaVersion: "1.0",
    type: EventType.TASK_CREATED,
    occurredAt: "2026-07-04T00:00:00.000Z",
    receivedAt: "2026-07-04T00:00:00.000Z",
    correlationId: `corr-${seq}`,
    causationId: null,
    traceId: `trace-${seq}`,
    payload: {},
  };
}

function makeValidCapabilities(): AdapterCapabilities {
  return {
    supportedEvents: ["task.created"],
    supportedCommands: ["task.create"],
    features: {
      snapshot: true,
      sse: true,
      websocket: false,
      commandExecution: true,
      softMapping: false,
      hardOrchestration: false,
    },
  };
}

function makeValidCommandResult(): CommandResult {
  return {
    commandId: "cmd-1",
    status: "accepted",
    affectedEventIds: ["evt-1"],
  };
}

describe("validateSnapshot", () => {
  it("accepts a valid snapshot", () => {
    const r = validateSnapshot(makeValidSnapshot(5), RUNTIME_ID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sequence).toBe(5);
  });

  it("rejects runtimeId mismatch", () => {
    const snap = makeValidSnapshot();
    snap.runtimeId = "other-runtime";
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("snapshot_invalid");
  });

  it("rejects negative sequence", () => {
    const snap = makeValidSnapshot();
    snap.sequence = -1;
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("snapshot_invalid");
  });

  it("rejects non-integer sequence", () => {
    const snap = makeValidSnapshot();
    (snap as { sequence: number }).sequence = 1.5;
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects unsupported schemaVersion", () => {
    const snap = makeValidSnapshot();
    snap.schemaVersion = "2.0";
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("snapshot_invalid");
  });

  it("rejects missing agents array", () => {
    const snap = makeValidSnapshot();
    delete (snap as { agents?: unknown }).agents;
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects null input", () => {
    const r = validateSnapshot(null, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  // === DEEP validation tests (per Plan Review P0 item 2) ===

  it("rejects AgentSnapshot with non-string agentId", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: 123 as unknown as string, runtimeId: RUNTIME_ID, name: "a",
      role: "worker", status: "idle", currentTaskId: null, currentRoomId: null,
      capabilityGrants: [], lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("snapshot_invalid");
  });

  it("rejects AgentSnapshot with invalid status enum", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: "a1", runtimeId: RUNTIME_ID, name: "a",
      role: "worker", status: "banana" as unknown as AgentStatus,
      currentTaskId: null, currentRoomId: null,
      capabilityGrants: [], lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects AgentSnapshot with invalid role enum", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: "a1", runtimeId: RUNTIME_ID, name: "a",
      role: "superuser" as unknown as AgentRole, status: "idle",
      currentTaskId: null, currentRoomId: null,
      capabilityGrants: [], lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects AgentSnapshot with runtimeId mismatch on entity", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: "a1", runtimeId: "other-runtime", name: "a",
      role: "worker", status: "idle", currentTaskId: null, currentRoomId: null,
      capabilityGrants: [], lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects CapabilityGrant with invalid effect enum", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: "a1", runtimeId: RUNTIME_ID, name: "a",
      role: "worker", status: "idle", currentTaskId: null, currentRoomId: null,
      capabilityGrants: [{
        grantId: "g1", principalId: "p1", capability: "c",
        effect: "maybe" as unknown as "allow", scope: {},
        expiresAt: null, issuedBy: "u1", state: "active",
      }],
      lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects TaskSnapshot with invalid priority enum", () => {
    const snap = makeValidSnapshot();
    snap.tasks = [{
      taskId: "t1", runtimeId: RUNTIME_ID, title: "t", description: "d",
      status: "created", priority: "critical" as unknown as Priority,
      parentTaskId: null, assigneeId: null, roomId: null,
      dependencyIds: [], artifactIds: [], approvalId: null,
      createdAt: "2026-07-04T00:00:00Z", startedAt: null, completedAt: null,
      blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects ArtifactSnapshot with negative version", () => {
    const snap = makeValidSnapshot();
    snap.artifacts = [{
      artifactId: "ar1", runtimeId: RUNTIME_ID, taskId: "t1",
      producerAgentId: "a1", type: "doc", title: "t", status: "draft",
      uri: null, version: -1, createdAt: "2026-07-04T00:00:00Z", reviewResult: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects ArtifactReviewResult with invalid verdict", () => {
    const snap = makeValidSnapshot();
    snap.artifacts = [{
      artifactId: "ar1", runtimeId: RUNTIME_ID, taskId: "t1",
      producerAgentId: "a1", type: "doc", title: "t", status: "draft",
      uri: null, version: 1, createdAt: "2026-07-04T00:00:00Z",
      reviewResult: {
        reviewerId: "r1", verdict: "maybe" as unknown as "approved",
        comment: "c", reviewedAt: "2026-07-04T00:00:00Z",
      },
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects ApprovalSnapshot with invalid kind enum", () => {
    const snap = makeValidSnapshot();
    snap.approvals = [{
      approvalId: "ap1", runtimeId: RUNTIME_ID, taskId: "t1",
      kind: "other" as unknown as "artifact_delivery", status: "requested",
      requestedBy: "u1", resolvedBy: null, payloadRef: "p", reason: "r",
      createdAt: "2026-07-04T00:00:00Z", resolvedAt: null, expiresAt: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects RoomSnapshot with invalid bounds (negative width)", () => {
    const snap = makeValidSnapshot();
    snap.rooms = [{
      roomId: "r1", runtimeId: RUNTIME_ID, name: "r", type: "command",
      bounds: { x: 0, y: 0, width: -10, height: 10 },
      activeAgentIds: [], visualState: {},
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects RoomSnapshot with non-finite bounds.x", () => {
    const snap = makeValidSnapshot();
    snap.rooms = [{
      roomId: "r1", runtimeId: RUNTIME_ID, name: "r", type: "command",
      bounds: { x: NaN, y: 0, width: 10, height: 10 },
      activeAgentIds: [], visualState: {},
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects RoomSnapshot with invalid type enum", () => {
    const snap = makeValidSnapshot();
    snap.rooms = [{
      roomId: "r1", runtimeId: RUNTIME_ID, name: "r",
      type: "kitchen" as unknown as RoomType,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      activeAgentIds: [], visualState: {},
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("accepts a fully-populated valid snapshot with all entity types", () => {
    const snap = makeValidSnapshot(5);
    snap.agents = [{
      agentId: "a1", runtimeId: RUNTIME_ID, name: "Alice",
      role: "orchestrator", status: "idle", currentTaskId: null, currentRoomId: "r1",
      capabilityGrants: [{
        grantId: "g1", principalId: "a1", capability: "task.create",
        effect: "allow", scope: {}, expiresAt: null, issuedBy: "system", state: "active",
      }],
      lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    snap.tasks = [{
      taskId: "t1", runtimeId: RUNTIME_ID, title: "Task 1", description: "desc",
      status: "created", priority: "normal",
      parentTaskId: null, assigneeId: "a1", roomId: "r1",
      dependencyIds: [], artifactIds: ["ar1"], approvalId: null,
      createdAt: "2026-07-04T00:00:00Z", startedAt: null, completedAt: null,
      blockedReason: null,
    }];
    snap.artifacts = [{
      artifactId: "ar1", runtimeId: RUNTIME_ID, taskId: "t1",
      producerAgentId: "a1", type: "document", title: "Doc", status: "draft",
      uri: "file:///doc.md", version: 1, createdAt: "2026-07-04T00:00:00Z",
      reviewResult: null,
    }];
    snap.approvals = [];
    snap.rooms = [{
      roomId: "r1", runtimeId: RUNTIME_ID, name: "Command",
      type: "command", bounds: { x: 0, y: 0, width: 100, height: 100 },
      activeAgentIds: ["a1"], visualState: {},
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.agents.length).toBe(1);
  });
});

describe("validateEvent", () => {
  it("accepts a valid event", () => {
    const r = validateEvent(makeValidEvent(1), RUNTIME_ID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sequence).toBe(1);
  });

  it("rejects runtimeId mismatch", () => {
    const ev = makeValidEvent(1);
    ev.runtimeId = "other";
    const r = validateEvent(ev, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("event_invalid");
  });

  it("rejects zero sequence", () => {
    const ev = makeValidEvent(0);
    const r = validateEvent(ev, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects missing eventId", () => {
    const ev = makeValidEvent(1);
    delete (ev as { eventId?: string }).eventId;
    const r = validateEvent(ev, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects non-string type", () => {
    const ev = makeValidEvent(1);
    (ev as { type: unknown }).type = 42;
    const r = validateEvent(ev, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });
});

describe("validateCapabilities", () => {
  it("accepts valid capabilities", () => {
    const r = validateCapabilities(makeValidCapabilities());
    expect(r.ok).toBe(true);
  });

  it("rejects missing features", () => {
    const caps = makeValidCapabilities();
    delete (caps as { features?: unknown }).features;
    const r = validateCapabilities(caps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("capabilities_invalid");
  });

  it("rejects non-array supportedEvents", () => {
    const caps = makeValidCapabilities();
    (caps as { supportedEvents: unknown }).supportedEvents = "not-an-array";
    const r = validateCapabilities(caps);
    expect(r.ok).toBe(false);
  });
});

describe("validateCommandResult", () => {
  it("accepts a valid accepted result", () => {
    const r = validateCommandResult(makeValidCommandResult(), "cmd-1");
    expect(r.ok).toBe(true);
  });

  it("rejects commandId mismatch", () => {
    const r = validateCommandResult(makeValidCommandResult(), "cmd-other");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("command_response_invalid");
  });

  it("rejects invalid status", () => {
    const cr = makeValidCommandResult();
    (cr as { status: unknown }).status = "weird";
    const r = validateCommandResult(cr, "cmd-1");
    expect(r.ok).toBe(false);
  });

  it("rejects error status without error field", () => {
    const cr = makeValidCommandResult();
    cr.status = "error";
    delete (cr as { error?: unknown }).error;
    const r = validateCommandResult(cr, "cmd-1");
    expect(r.ok).toBe(false);
  });
});
