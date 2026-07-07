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

function getAgentContainer(container: MockContainer, index: number): MockContainer {
  return container.children[index] as MockContainer;
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

  it("does not give blocked agents the failed posture marker", () => {
    const agent = makeAgent("a1", "command", "worker");
    agent.status = "blocked";
    agent.blockedReason = "Adapter timeout";
    renderer.render([agent], layout, makeProjection([agent]));
    const blockedCommands = getAgentBody(container, 0).commands.slice();

    expect(blockedCommands.some((c) => c.type === "lineTo")).toBe(false);
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

    // Approval posture is a subtle turn (body offset 1); working is a stronger lean (body offset 2).
    const approvalBodyX = rects.find((c) => c.args[2] === 14 && c.args[3] === 15)!.args[0] as number;
    agent.status = "working";
    renderer.render([agent], layout, projection);
    const workingRects = getAgentBody(container, 0).commands.filter((c) => c.type === "rect");
    const workingBodyX = workingRects.find((c) => c.args[2] === 14 && c.args[3] === 15)!.args[0] as number;
    expect(Math.abs(approvalBodyX - target.x)).toBeGreaterThan(Math.abs(workingBodyX - target.x));
  });

  it("breathes idle agents in a 1.5s loop", () => {
    const agent = makeAgent("a1", "command", "worker");
    agent.status = "idle";
    renderer.render([agent], layout, makeProjection([agent]));

    const c = getAgentContainer(container, 0);
    renderer.tick(0);
    const startY = c.y;
    const startScaleY = c.scale.y;

    renderer.tick(375);
    const quarterY = c.y;
    const quarterScaleY = c.scale.y;
    expect(quarterY).not.toBe(startY);
    expect(quarterScaleY).not.toBe(startScaleY);

    renderer.tick(1125);
    expect(c.y).toBe(startY);
    expect(c.scale.y).toBe(startScaleY);
  });

  it("disables idle breathe when reduceMotion is true", () => {
    renderer = new AgentRenderer(container as unknown as import("pixi.js").Container, undefined, true);
    const agent = makeAgent("a1", "command", "worker");
    agent.status = "idle";
    renderer.render([agent], layout, makeProjection([agent]));

    const c = getAgentContainer(container, 0);
    renderer.tick(0);
    const startY = c.y;
    const startScaleY = c.scale.y;

    renderer.tick(375);
    expect(c.y).toBe(startY);
    expect(c.scale.y).toBe(startScaleY);
  });

  it("wraps idlePhase to prevent float drift", () => {
    const agent = makeAgent("a1", "command", "worker");
    agent.status = "idle";
    renderer.render([agent], layout, makeProjection([agent]));

    renderer.tick(1500 * 100 + 375);
    expect(renderer.getAgentIdlePhase("a1")).toBe(375);
  });

  it("applies idle breathe via container.scale.set", () => {
    const agent = makeAgent("a1", "command", "worker");
    agent.status = "idle";
    renderer.render([agent], layout, makeProjection([agent]));

    const c = getAgentContainer(container, 0);
    renderer.tick(0);
    c.scale.set.mockClear();
    renderer.tick(375);
    expect(c.scale.set).toHaveBeenCalled();
  });

  it("moves agents over time with a 200-300ms-per-tile walk duration", () => {
    renderer.render([makeAgent("a1", "command")], layout, makeProjection([]));
    renderer.render([makeAgent("a1", "execution")], layout, makeProjection([]));

    const start = renderer.getAgentPosition("a1")!;
    const target = renderer.getAgentTarget("a1")!;
    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    const tiles = distance / 64;
    const duration = renderer.getAgentWalkDuration("a1")!;
    const msPerTile = duration / tiles;

    expect(msPerTile).toBeGreaterThanOrEqual(200);
    expect(msPerTile).toBeLessThanOrEqual(300);

    renderer.tick(Math.floor(duration / 2));
    const mid = renderer.getAgentPosition("a1")!;
    expect(mid.x).not.toBe(target.x);

    renderer.tick(Math.ceil(duration / 2) + 1);
    const end = renderer.getAgentPosition("a1")!;
    expect(end.x).toBe(target.x);
    expect(end.y).toBe(target.y);
  });

  it("does not clamp short moves above 300ms per tile", () => {
    const shortLayout: import("../layout.js").RoomLayout = {
      rooms: [
        { roomId: "command", name: "Command", floorType: "command", x: 0, y: 0, width: 10, height: 10, props: [] },
        { roomId: "execution", name: "Execution", floorType: "execution", x: 10, y: 0, width: 10, height: 10, props: [] },
      ],
    };
    renderer.render([makeAgent("a1", "command")], shortLayout, makeProjection([]));
    renderer.render([makeAgent("a1", "execution")], shortLayout, makeProjection([]));

    const start = renderer.getAgentPosition("a1")!;
    const target = renderer.getAgentTarget("a1")!;
    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    const tiles = distance / 64;
    const duration = renderer.getAgentWalkDuration("a1")!;
    const msPerTile = duration / tiles;

    expect(msPerTile).toBeGreaterThanOrEqual(200);
    expect(msPerTile).toBeLessThanOrEqual(300);
  });

  it("guards zero-distance walk duration and avoids division by zero", () => {
    const zeroDistanceLayout: import("../layout.js").RoomLayout = {
      rooms: [
        { roomId: "command", name: "Command", floorType: "command", x: 100, y: 100, width: 10, height: 10, props: [] },
        { roomId: "execution", name: "Execution", floorType: "execution", x: 100, y: 100, width: 10, height: 10, props: [] },
      ],
    };
    renderer.render([makeAgent("a1", "command")], zeroDistanceLayout, makeProjection([]));
    renderer.render([makeAgent("a1", "execution")], zeroDistanceLayout, makeProjection([]));

    expect(renderer.getAgentWalkDuration("a1")).toBe(0);

    expect(() => renderer.tick(16)).not.toThrow();
    const position = renderer.getAgentPosition("a1")!;
    expect(Number.isFinite(position.x)).toBe(true);
    expect(Number.isFinite(position.y)).toBe(true);
  });
});
