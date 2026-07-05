import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentRenderer } from "../renderer/agent-renderer.js";
import { createDefaultLayout } from "../layout.js";
import type { AgentView, OfficeProjection } from "@agent-office/protocol";
import { MockContainer } from "./pixi-mock.js";

vi.mock("pixi.js", () => import("./pixi-mock.js").then((m) => m.createPixiMock()));

function makeAgent(id: string, roomId: string | null, role: AgentView["role"] = "worker"): AgentView {
  return {
    agentId: id,
    name: `Agent-${id}`,
    role,
    status: "working",
    currentTaskId: null,
    currentRoomId: roomId,
    blockedReason: null,
  };
}

function makeProjection(agents: AgentView[]): OfficeProjection {
  return {
    agents,
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [],
    pendingApprovals: [],
    blockedTasks: [],
    errors: [],
  };
}

const layout = createDefaultLayout();

describe("AgentRenderer", () => {
  let container: MockContainer;
  let renderer: AgentRenderer;

  beforeEach(() => {
    container = new MockContainer();
    renderer = new AgentRenderer(container as unknown as import("pixi.js").Container);
  });

  it("positions agents by currentRoomId inside the correct room", () => {
    const agents = [makeAgent("a1", "command"), makeAgent("a2", "execution")];
    renderer.render(agents, layout, makeProjection(agents));

    const command = layout.rooms.find((r) => r.roomId === "command")!;
    const execution = layout.rooms.find((r) => r.roomId === "execution")!;

    const p1 = renderer.getAgentTarget("a1")!;
    expect(p1.x).toBeGreaterThanOrEqual(command.x);
    expect(p1.x).toBeLessThanOrEqual(command.x + command.width);
    expect(p1.y).toBeGreaterThanOrEqual(command.y);
    expect(p1.y).toBeLessThanOrEqual(command.y + command.height);

    const p2 = renderer.getAgentTarget("a2")!;
    expect(p2.x).toBeGreaterThanOrEqual(execution.x);
    expect(p2.x).toBeLessThanOrEqual(execution.x + execution.width);
    expect(p2.y).toBeGreaterThanOrEqual(execution.y);
    expect(p2.y).toBeLessThanOrEqual(execution.y + execution.height);
  });

  it("places agents without a room at the command room center", () => {
    const agents = [makeAgent("a1", null)];
    renderer.render(agents, layout, makeProjection(agents));
    const commandCenter = { x: 40 + 340 / 2, y: 40 + 240 / 2 };
    expect(renderer.getAgentTarget("a1")).toMatchObject(commandCenter);
  });

  it("removes sprites for agents that are no longer present", () => {
    const agents = [makeAgent("a1", "command")];
    renderer.render(agents, layout, makeProjection(agents));
    expect(renderer.getAgentTarget("a1")).toBeDefined();

    renderer.render([], layout, makeProjection([]));
    expect(renderer.getAgentTarget("a1")).toBeNull();
  });

  it("keeps agents in different rooms visually separated", () => {
    const agents = [makeAgent("a1", "command"), makeAgent("a2", "command")];
    renderer.render(agents, layout, makeProjection(agents));
    const p1 = renderer.getAgentTarget("a1")!;
    const p2 = renderer.getAgentTarget("a2")!;
    expect(p1.x).not.toBe(p2.x);
  });

  it("maps agent role to a distinct visual treatment", () => {
    const agents = [
      makeAgent("a1", "command", "orchestrator"),
      makeAgent("a2", "command", "worker"),
      makeAgent("a3", "command", "reviewer"),
    ];
    renderer.render(agents, layout, makeProjection(agents));
    const treatments = renderer.getAgentVisualTreatments();
    const bodyColors = treatments.map((t) => t.bodyColor);
    expect(new Set(bodyColors).size).toBe(3);
  });

  it("teleports agents instantly and skips walk-frame cycling when reduceMotion is true", () => {
    renderer = new AgentRenderer(container as unknown as import("pixi.js").Container, undefined, true);
    renderer.render([makeAgent("a1", "command")], layout, makeProjection([]));
    const before = renderer.getAgentPosition("a1")!;

    renderer.render([makeAgent("a1", "execution")], layout, makeProjection([]));
    const target = renderer.getAgentTarget("a1")!;
    expect(before.x).not.toBe(target.x);

    renderer.tick();
    const after = renderer.getAgentPosition("a1")!;
    expect(after.x).toBe(target.x);
    expect(after.y).toBe(target.y);
  });
});
