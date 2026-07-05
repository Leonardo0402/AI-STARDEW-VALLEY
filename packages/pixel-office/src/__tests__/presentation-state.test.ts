import { describe, it, expect } from "vitest";
import {
  computeAgentPresentationState,
  type AgentPresentationState,
} from "../presentation-state.js";
import type { AgentView, OfficeProjection, TaskView } from "@agent-office/protocol";

function makeAgent(overrides: Partial<AgentView> = {}): AgentView {
  return {
    agentId: "a1",
    name: "Agent 1",
    role: "worker",
    status: "idle",
    currentTaskId: null,
    currentRoomId: null,
    blockedReason: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskView> = {}): TaskView {
  return {
    taskId: "t1",
    title: "Task",
    description: "",
    status: "queued",
    priority: "normal",
    assigneeId: null,
    roomId: null,
    artifactIds: [],
    approvalId: null,
    blockedReason: null,
    ...overrides,
  };
}

function makeProjection(agents: AgentView[], tasks: TaskView[] = []): OfficeProjection {
  return {
    agents,
    tasks,
    artifacts: [],
    approvals: [],
    rooms: [],
    pendingApprovals: [],
    blockedTasks: [],
    errors: [],
  };
}

function makePendingApproval(taskId: string) {
  return { approvalId: "ap1", taskId, kind: "artifact_delivery" as const, status: "requested" as const, requestedBy: "a1", reason: "" };
}

describe("computeAgentPresentationState", () => {
  it("returns blocked when agent.blockedReason is set", () => {
    const agent = makeAgent({ status: "working", blockedReason: "stuck" });
    expect(computeAgentPresentationState(agent, makeProjection([agent]))).toBe("blocked");
  });

  it("returns blocked for blocked/failed/paused status", () => {
    for (const status of ["blocked", "failed", "paused"] as const) {
      const agent = makeAgent({ status });
      expect(computeAgentPresentationState(agent, makeProjection([agent]))).toBe("blocked");
    }
  });

  it("returns working for working or planning status", () => {
    for (const status of ["working", "planning"] as const) {
      const agent = makeAgent({ status });
      expect(computeAgentPresentationState(agent, makeProjection([agent]))).toBe("working");
    }
  });

  it("returns working when current task is running", () => {
    const agent = makeAgent({ status: "idle", currentTaskId: "t1" });
    const task = makeTask({ taskId: "t1", status: "running" });
    expect(computeAgentPresentationState(agent, makeProjection([agent], [task]))).toBe("working");
  });

  it("returns approval when pending approvals exist, agent is in review/approval_delivery, and status is waiting/reviewing", () => {
    for (const roomId of ["review", "approval_delivery"] as const) {
      for (const status of ["waiting", "reviewing"] as const) {
        const agent = makeAgent({ status, currentRoomId: roomId });
        const projection: OfficeProjection = {
          ...makeProjection([agent]),
          pendingApprovals: [makePendingApproval("t1")],
        } as OfficeProjection;
        expect(computeAgentPresentationState(agent, projection)).toBe("approval");
      }
    }
  });

  it("returns approval when current task is waiting_approval", () => {
    const agent = makeAgent({ status: "idle", currentRoomId: "review", currentTaskId: "t1" });
    const task = makeTask({ taskId: "t1", status: "waiting_approval" });
    const projection: OfficeProjection = {
      ...makeProjection([agent], [task]),
      pendingApprovals: [makePendingApproval("t1")],
    } as OfficeProjection;
    expect(computeAgentPresentationState(agent, projection)).toBe("approval");
  });

  it("returns approval when current task has a matching pending approval", () => {
    const agent = makeAgent({ status: "idle", currentRoomId: "approval_delivery", currentTaskId: "t1" });
    const task = makeTask({ taskId: "t1", status: "assigned" });
    const projection: OfficeProjection = {
      ...makeProjection([agent], [task]),
      pendingApprovals: [makePendingApproval("t1")],
    } as OfficeProjection;
    expect(computeAgentPresentationState(agent, projection)).toBe("approval");
  });

  it("does not return approval without pending approvals", () => {
    const agent = makeAgent({ status: "waiting", currentRoomId: "review" });
    expect(computeAgentPresentationState(agent, makeProjection([agent]))).toBe("idle");
  });

  it("does not return approval outside review/approval_delivery rooms", () => {
    const agent = makeAgent({ status: "waiting", currentRoomId: "command" });
    const projection: OfficeProjection = {
      ...makeProjection([agent]),
      pendingApprovals: [makePendingApproval("t1")],
    } as OfficeProjection;
    expect(computeAgentPresentationState(agent, projection)).toBe("idle");
  });

  it("does not return approval when not waiting/reviewing and task is not awaiting approval", () => {
    const agent = makeAgent({ status: "idle", currentRoomId: "review", currentTaskId: "t1" });
    const task = makeTask({ taskId: "t1", status: "assigned" });
    const projection: OfficeProjection = {
      ...makeProjection([agent], [task]),
      pendingApprovals: [makePendingApproval("other")],
    } as OfficeProjection;
    expect(computeAgentPresentationState(agent, projection)).toBe("idle");
  });

  it("returns idle when no other rule matches", () => {
    const agent = makeAgent({ status: "offline" });
    expect(computeAgentPresentationState(agent, makeProjection([agent]))).toBe("idle");
  });

  it("does not mutate inputs", () => {
    const agent = makeAgent();
    const projection = makeProjection([agent]);
    const before = JSON.stringify(projection);
    computeAgentPresentationState(agent, projection);
    expect(JSON.stringify(projection)).toBe(before);
  });

  it("only returns known presentation states", () => {
    const agent = makeAgent();
    const state = computeAgentPresentationState(agent, makeProjection([agent]));
    const known: AgentPresentationState[] = ["idle", "working", "blocked", "walk", "approval"];
    expect(known).toContain(state);
  });
});
