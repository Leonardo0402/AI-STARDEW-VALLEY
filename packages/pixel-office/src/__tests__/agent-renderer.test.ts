import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentRenderer } from "../renderer/agent-renderer.js";
import { createDefaultLayout } from "../layout.js";
import type { AgentView, OfficeProjection } from "@agent-office/protocol";
import { MockContainer, MockGraphics } from "./pixi-mock.js";

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

function getAgentBody(container: MockContainer, index: number): MockGraphics {
  const sprite = container.children[index] as MockContainer;
  return sprite.getChildAt(0) as MockGraphics;
}

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

  it("draws orchestrator with tall body, headset and tablet", () => {
    const agents = [makeAgent("a1", "command", "orchestrator")];
    renderer.render(agents, layout, makeProjection(agents));
    const body = getAgentBody(container, 0);
    const rects = body.commands.filter((c) => c.type === "rect");
    expect(rects.some((c) => c.args[2] === 8 && c.args[3] === 18)).toBe(true);
    expect(rects.some((c) => c.args[2] === 5 && c.args[3] === 7)).toBe(true);
    expect(body.commands.some((c) => c.type === "lineTo")).toBe(true);
  });

  it("draws worker with sturdy body, helmet and tool belt", () => {
    const agents = [makeAgent("a1", "command", "worker")];
    renderer.render(agents, layout, makeProjection(agents));
    const body = getAgentBody(container, 0);
    const rects = body.commands.filter((c) => c.type === "rect");
    expect(rects.some((c) => c.args[2] === 14 && c.args[3] === 15)).toBe(true);
    expect(rects.some((c) => c.args[2] === 12 && c.args[3] === 4)).toBe(true);
    expect(rects.some((c) => c.args[2] === 14 && c.args[3] === 3)).toBe(true);
  });

  it("draws reviewer with slim body, glasses and clipboard", () => {
    const agents = [makeAgent("a1", "command", "reviewer")];
    renderer.render(agents, layout, makeProjection(agents));
    const body = getAgentBody(container, 0);
    const rects = body.commands.filter((c) => c.type === "rect");
    expect(rects.some((c) => c.args[2] === 6 && c.args[3] === 16)).toBe(true);
    expect(rects.filter((c) => c.args[2] === 3 && c.args[3] === 2).length).toBe(2);
    expect(rects.some((c) => c.args[2] === 6 && c.args[3] === 9)).toBe(true);
  });

  it("leans working agents forward", () => {
    const agent = makeAgent("a1", "command", "worker");
    agent.status = "working";
    renderer.render([agent], layout, makeProjection([agent]));
    const workingCommands = getAgentBody(container, 0).commands.slice();
    const workingHead = workingCommands.find((c) => c.type === "circle")!;

    agent.status = "idle";
    renderer.render([agent], layout, makeProjection([agent]));
    const idleCommands = getAgentBody(container, 0).commands.slice();
    const idleHead = idleCommands.find((c) => c.type === "circle")!;

    expect(workingHead.args[0]).not.toBe(idleHead.args[0]);
  });

  it("slumps blocked agents lower", () => {
    const agent = makeAgent("a1", "command", "worker");
    agent.status = "blocked";
    renderer.render([agent], layout, makeProjection([agent]));
    const blockedCommands = getAgentBody(container, 0).commands.slice();
    const blockedHead = blockedCommands.find((c) => c.type === "circle")!;

    agent.status = "idle";
    agent.blockedReason = null;
    renderer.render([agent], layout, makeProjection([agent]));
    const idleCommands = getAgentBody(container, 0).commands.slice();
    const idleHead = idleCommands.find((c) => c.type === "circle")!;

    expect(blockedHead.args[1] as number).toBeGreaterThan(idleHead.args[1] as number);
  });

  it("downcasts failed agents", () => {
    const agent = makeAgent("a1", "command", "worker");
    agent.status = "failed";
    renderer.render([agent], layout, makeProjection([agent]));
    const failedCommands = getAgentBody(container, 0).commands.slice();
    const failedHead = failedCommands.find((c) => c.type === "circle")!;

    agent.status = "idle";
    renderer.render([agent], layout, makeProjection([agent]));
    const idleCommands = getAgentBody(container, 0).commands.slice();
    const idleHead = idleCommands.find((c) => c.type === "circle")!;

    expect(failedHead.args[1] as number).toBeGreaterThan(idleHead.args[1] as number);
    expect(failedCommands.some((c) => c.type === "lineTo")).toBe(true);
  });

  it("turns approval agents toward the service bell at room center", () => {
    const agent = makeAgent("a1", "approval_delivery", "worker");
    agent.status = "waiting";
    const projection: OfficeProjection = {
      ...makeProjection([agent]),
      rooms: [
        {
          roomId: "approval_delivery",
          name: "Approval Hall",
          type: "approval_delivery",
          bounds: { x: 420, y: 320, width: 340, height: 240 },
          activeAgentIds: ["a1"],
        },
      ],
      pendingApprovals: [
        { approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "deliver" },
      ],
    };
    renderer.render([agent], layout, projection);
    const target = renderer.getAgentTarget("a1")!;
    const room = layout.rooms.find((r) => r.roomId === "approval_delivery")!;
    const roomCenterX = room.x + room.width / 2;
    const expectedFaceDir = roomCenterX > target.x ? 1 : -1;

    const body = getAgentBody(container, 0);
    const rects = body.commands.filter((c) => c.type === "rect");
    const pouch = rects.find((c) => c.args[2] === 4 && c.args[3] === 4);
    expect(pouch).toBeDefined();
    expect(Math.sign(pouch!.args[0] as number)).toBe(expectedFaceDir);
  });
});
