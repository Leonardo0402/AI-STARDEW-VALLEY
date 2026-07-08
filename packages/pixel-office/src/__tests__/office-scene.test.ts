// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PixelOfficeScene } from "../office-scene.js";
import type { OfficeProjection, RoomView } from "@agent-office/protocol";
import { MockContainer, MockAssets, MockGraphics } from "./pixi-mock.js";

vi.mock("pixi.js", () => import("./pixi-mock.js").then((m) => m.createPixiMock()));

function createRoom(id: string, type: RoomView["type"], x: number, y: number): RoomView {
  return {
    roomId: id,
    name: id,
    type,
    bounds: { x, y, width: 200, height: 150 },
    activeAgentIds: [],
  };
}

const baseProjection: OfficeProjection = {
  agents: [],
  tasks: [],
  artifacts: [],
  approvals: [],
  rooms: [
    createRoom("command", "command", 0, 0),
    createRoom("execution", "execution", 220, 0),
  ],
  pendingApprovals: [],
  blockedTasks: [],
  errors: [],
};

describe("PixelOfficeScene renderer selection", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    MockAssets.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to the layered sprite renderer and can be initialized", async () => {
    const scene = new PixelOfficeScene(canvas);
    await scene.init(canvas);

    expect((scene as unknown as { useSpriteRenderer: boolean }).useSpriteRenderer).toBe(true);
    expect((scene as unknown as { roomRenderer?: unknown }).roomRenderer).toBeDefined();
    expect((scene as unknown as { propRenderer?: unknown }).propRenderer).toBeDefined();
    expect((scene as unknown as { agentRenderer?: unknown }).agentRenderer).toBeDefined();
    expect((scene as unknown as { effectRenderer?: unknown }).effectRenderer).toBeDefined();

    scene.destroy();
  });

  it("renders rooms through the procedural path when sprite renderer is disabled", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false });
    await scene.init(canvas);

    const roomLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[0] as MockContainer;
    expect(roomLayer.children.length).toBe(0);

    scene.updateProjection(baseProjection);
    expect(roomLayer.children.length).toBeGreaterThan(0);

    scene.destroy();
  });

  it("does not instantiate layered renderers when sprite renderer is disabled", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false });
    const renderers = (scene as unknown as { roomRenderer?: unknown }).roomRenderer;
    expect(renderers).toBeUndefined();
    scene.destroy();
  });

  it("can destroy before init without throwing", () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false });
    expect(() => scene.destroy()).not.toThrow();
  });

  it("instantiates layered renderers when sprite renderer is enabled", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    expect((scene as unknown as { roomRenderer?: unknown }).roomRenderer).toBeDefined();
    expect((scene as unknown as { propRenderer?: unknown }).propRenderer).toBeDefined();
    expect((scene as unknown as { agentRenderer?: unknown }).agentRenderer).toBeDefined();
    expect((scene as unknown as { effectRenderer?: unknown }).effectRenderer).toBeDefined();

    scene.updateProjection(baseProjection);

    const roomLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[0] as MockContainer;
    expect(roomLayer.children.length).toBeGreaterThan(0);

    scene.destroy();
  });

  it("forwards reduceMotion to layered renderers and does not throw", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true, reduceMotion: true });
    await scene.init(canvas);

    expect((scene as any).reduceMotion).toBe(true);
    expect((scene as any).agentRenderer.reduceMotion).toBe(true);
    expect((scene as any).effectRenderer.reduceMotion).toBe(true);

    scene.updateProjection(baseProjection);
    expect(() => scene.setReduceMotion(false)).not.toThrow();
    expect((scene as any).agentRenderer.reduceMotion).toBe(false);
    expect((scene as any).effectRenderer.reduceMotion).toBe(false);

    scene.destroy();
  });

  it("does not re-render effects every frame when reduceMotion is true", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true, reduceMotion: true });
    await scene.init(canvas);
    const effectRenderer = (scene as any).effectRenderer as { render: import("vitest").Mock };
    const renderSpy = vi.spyOn(effectRenderer, "render");

    scene.updateProjection(baseProjection);
    const callsAfterUpdate = renderSpy.mock.calls.length;
    expect(callsAfterUpdate).toBeGreaterThanOrEqual(1);

    (scene as unknown as { update: (ticker: { deltaMS: number }) => void }).update({ deltaMS: 16 } as unknown as import("pixi.js").Ticker);
    (scene as unknown as { update: (ticker: { deltaMS: number }) => void }).update({ deltaMS: 16 } as unknown as import("pixi.js").Ticker);

    expect(renderSpy.mock.calls.length).toBe(callsAfterUpdate);

    scene.destroy();
  });

  it("falls back to the default layout when projection rooms are empty", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    const idleProjection: OfficeProjection = {
      ...baseProjection,
      rooms: [],
      agents: [
        {
          agentId: "agent-1",
          name: "Idle Agent",
          role: "worker",
          status: "idle",
          currentTaskId: null,
          currentRoomId: "command",
          blockedReason: null,
        },
      ],
    };

    scene.updateProjection(idleProjection);

    const roomLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[0] as MockContainer;
    expect(roomLayer.children.length).toBeGreaterThan(0);

    const agentRenderer = (scene as any).agentRenderer;
    expect(agentRenderer.getAgentTarget("agent-1")).toBeDefined();

    scene.destroy();
  });
});

describe("PixelOfficeScene legacy renderer reduceMotion", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    MockAssets.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeApprovalProjection(): OfficeProjection {
    return {
      ...baseProjection,
      tasks: [
        {
          taskId: "t1",
          title: "Task",
          description: "",
          status: "queued",
          priority: "normal",
          assigneeId: null,
          roomId: "execution",
          artifactIds: [],
          approvalId: null,
          blockedReason: null,
        },
      ],
      pendingApprovals: [
        { approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" },
      ],
    };
  }

  function getOverlayLayer(scene: PixelOfficeScene): MockContainer {
    return (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[3] as MockContainer;
  }

  function getAgentLayer(scene: PixelOfficeScene): MockContainer {
    return (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[2] as MockContainer;
  }

  function getApprovalCircleRadius(overlayLayer: MockContainer): number | undefined {
    const graphics = overlayLayer.children[0] as import("./pixi-mock.js").MockGraphics;
    const circle = graphics.commands.find((c) => c.type === "circle");
    return circle?.args[2] as number | undefined;
  }

  function tick(scene: PixelOfficeScene, deltaMS: number): void {
    (scene as unknown as { update: (ticker: { deltaMS: number }) => void }).update({ deltaMS } as unknown as import("pixi.js").Ticker);
  }

  it("drives legacy overlay pulse from deltaMS", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    scene.updateProjection(makeApprovalProjection());
    const before = getApprovalCircleRadius(getOverlayLayer(scene))!;

    tick(scene, 1000);
    const after = getApprovalCircleRadius(getOverlayLayer(scene))!;

    expect(after).not.toBe(before);

    scene.destroy();
  });

  it("keeps legacy overlay pulse static when reduceMotion is true", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: true });
    await scene.init(canvas);

    scene.updateProjection(makeApprovalProjection());
    const before = getApprovalCircleRadius(getOverlayLayer(scene))!;

    tick(scene, 1000);
    const after = getApprovalCircleRadius(getOverlayLayer(scene))!;

    expect(after).toBe(before);

    scene.destroy();
  });

  it("moves legacy agents over time with a 200-300ms-per-tile walk duration", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "idle" as const,
      currentTaskId: null,
      currentRoomId: "command",
      blockedReason: null,
    };

    scene.updateProjection({ ...baseProjection, agents: [agent] });
    tick(scene, 16);

    scene.updateProjection({ ...baseProjection, agents: [{ ...agent, currentRoomId: "execution" }] });

    const agentLayer = getAgentLayer(scene);
    const container = agentLayer.children[0] as MockContainer;

    const startX = 100; // command center + a1 offsetX(0)
    const targetX = 320; // execution center + a1 offsetX(0)
    const distance = targetX - startX; // 220 px
    const duration = (distance / 64) * 250;
    const msPerTile = duration / (distance / 64);

    expect(msPerTile).toBeGreaterThanOrEqual(200);
    expect(msPerTile).toBeLessThanOrEqual(300);

    tick(scene, Math.floor(duration / 2));
    expect(container.x).not.toBe(startX);
    expect(container.x).not.toBe(targetX);

    tick(scene, Math.ceil(duration / 2) + 1);
    expect(container.x).toBe(targetX);

    scene.destroy();
  });

  it("teleports legacy agents instantly when reduceMotion is true", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: true });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "idle" as const,
      currentTaskId: null,
      currentRoomId: "command",
      blockedReason: null,
    };

    scene.updateProjection({ ...baseProjection, agents: [agent] });
    tick(scene, 16);

    scene.updateProjection({ ...baseProjection, agents: [{ ...agent, currentRoomId: "execution" }] });
    tick(scene, 16);

    const agentLayer = getAgentLayer(scene);
    const container = agentLayer.children[0] as MockContainer;
    // Agent "a1" hash gives offsetX=0, offsetY=50 inside the execution room.
    expect(container.x).toBe(320);
    expect(container.y).toBe(125);

    scene.destroy();
  });

  it("does not re-render legacy overlays every frame when reduceMotion is true", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: true });
    await scene.init(canvas);

    scene.updateProjection(makeApprovalProjection());
    const overlayLayer = getOverlayLayer(scene);
    const childrenBefore = overlayLayer.children.slice();

    tick(scene, 16);

    expect(overlayLayer.children).toEqual(childrenBefore);

    scene.destroy();
  });
});

describe("PixelOfficeScene legacy renderer animations", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    MockAssets.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeApprovalProjection(): OfficeProjection {
    return {
      ...baseProjection,
      tasks: [
        {
          taskId: "t1",
          title: "Task",
          description: "",
          status: "queued",
          priority: "normal",
          assigneeId: null,
          roomId: "execution",
          artifactIds: [],
          approvalId: null,
          blockedReason: null,
        },
      ],
      pendingApprovals: [
        { approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" },
      ],
    };
  }

  function getAgentLayer(scene: PixelOfficeScene): MockContainer {
    return (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[2] as MockContainer;
  }

  function getOverlayLayer(scene: PixelOfficeScene): MockContainer {
    return (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[3] as MockContainer;
  }

  function getApprovalCircleRadius(overlayLayer: MockContainer): number | undefined {
    const graphics = overlayLayer.children[0] as MockGraphics;
    const circle = graphics.commands.find((c) => c.type === "circle");
    return circle?.args[2] as number | undefined;
  }

  function tick(scene: PixelOfficeScene, deltaMS: number): void {
    (scene as unknown as { update: (ticker: { deltaMS: number }) => void }).update({ deltaMS } as unknown as import("pixi.js").Ticker);
  }

  it("pulses legacy approval overlay on a 1.2s loop", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    scene.updateProjection(makeApprovalProjection());
    const start = getApprovalCircleRadius(getOverlayLayer(scene))!;

    tick(scene, 300);
    const mid = getApprovalCircleRadius(getOverlayLayer(scene))!;

    tick(scene, 900);
    const end = getApprovalCircleRadius(getOverlayLayer(scene))!;

    expect(mid).not.toBe(start);
    expect(end).toBe(start);

    scene.destroy();
  });

  it("breathes idle legacy agents in a 1.5s loop", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "idle" as const,
      currentTaskId: null,
      currentRoomId: "command",
      blockedReason: null,
    };
    scene.updateProjection({ ...baseProjection, agents: [agent] });
    tick(scene, 0);

    const container = getAgentLayer(scene).children[0] as MockContainer;
    const startY = container.y;
    const startScale = [...container.scale.set.mock.calls].pop();

    tick(scene, 375);
    expect(container.y).not.toBe(startY);
    expect([...container.scale.set.mock.calls].pop()).not.toEqual(startScale);

    tick(scene, 1125);
    expect(container.y).toBe(startY);
    expect([...container.scale.set.mock.calls].pop()).toEqual(startScale);

    scene.destroy();
  });

  it("draws working sparkle above legacy working agents", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "working" as const,
      currentTaskId: null,
      currentRoomId: "execution",
      blockedReason: null,
    };
    scene.updateProjection({ ...baseProjection, agents: [agent] });

    const overlayLayer = getOverlayLayer(scene);
    const graphics = overlayLayer.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];
    expect(graphics.length).toBeGreaterThan(0);

    // Agent "a1" stands at execution center (320, 125).
    const hasSparkle = graphics.some((g) =>
      g.commands.some((c) => c.type === "moveTo" && (c.args[0] as number) > 320 && (c.args[1] as number) < 125)
    );
    expect(hasSparkle).toBe(true);

    scene.destroy();
  });

  it("draws red pulse glow around legacy blocked agents", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "blocked" as const,
      currentTaskId: null,
      currentRoomId: "execution",
      blockedReason: "stuck",
    };
    scene.updateProjection({ ...baseProjection, agents: [agent] });

    const overlayLayer = getOverlayLayer(scene);
    const graphics = overlayLayer.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];
    expect(graphics.length).toBeGreaterThan(0);

    // Agent "a1" stands at execution center (320, 125).
    const hasGlow = graphics.some((g) =>
      g.commands.some(
        (c) =>
          c.type === "circle" &&
          c.args[0] === 320 &&
          c.args[1] === 125 &&
          (c.args[2] as number) > 16
      )
    );
    expect(hasGlow).toBe(true);

    scene.destroy();
  });

  it("keeps legacy idle agents static when reduceMotion is true", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: true });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "idle" as const,
      currentTaskId: null,
      currentRoomId: "command",
      blockedReason: null,
    };
    scene.updateProjection({ ...baseProjection, agents: [agent] });
    tick(scene, 0);

    const container = getAgentLayer(scene).children[0] as MockContainer;
    const startY = container.y;

    tick(scene, 375);
    expect(container.y).toBe(startY);
    expect(container.scale.x).toBe(1);
    expect(container.scale.y).toBe(1);

    scene.destroy();
  });

  it("resets legacy idle breathe transform when reduceMotion is enabled mid-animation", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "idle" as const,
      currentTaskId: null,
      currentRoomId: "command",
      blockedReason: null,
    };
    scene.updateProjection({ ...baseProjection, agents: [agent] });
    tick(scene, 375);

    const container = getAgentLayer(scene).children[0] as MockContainer;
    expect(container.scale.x).not.toBe(1);

    scene.setReduceMotion(true);
    const sprite = (scene as unknown as { agentSprites: Map<string, { currentY: number }> }).agentSprites.get("a1")!;
    expect(container.scale.x).toBe(1);
    expect(container.scale.y).toBe(1);
    expect(container.y).toBe(sprite.currentY);

    scene.destroy();
  });

  it("reads stored target position for legacy overlay rendering", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "blocked" as const,
      currentTaskId: null,
      currentRoomId: "execution",
      blockedReason: "stuck",
    };
    scene.updateProjection({ ...baseProjection, agents: [agent] });
    tick(scene, 16);

    const sprite = (scene as unknown as { agentSprites: Map<string, { targetX: number; targetY: number }> }).agentSprites.get("a1")!;
    sprite.targetX = 999;
    sprite.targetY = 888;
    tick(scene, 16);

    const overlayLayer = getOverlayLayer(scene);
    const graphics = overlayLayer.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];
    const glow = graphics.find((g) =>
      g.commands.some((c) => c.type === "circle" && (c.args[2] as number) > 16)
    );
    expect(glow).toBeDefined();
    const glowCircle = glow!.commands.find((c) => c.type === "circle")!;
    expect(glowCircle.args[0]).toBe(999);
    expect(glowCircle.args[1]).toBe(888);

    scene.destroy();
  });

  it("keeps legacy working sparkle static when reduceMotion is true", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: true });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "working" as const,
      currentTaskId: null,
      currentRoomId: "execution",
      blockedReason: null,
    };
    scene.updateProjection({ ...baseProjection, agents: [agent] });

    const overlayLayer = getOverlayLayer(scene);
    const graphicsBefore = overlayLayer.children.filter((c) => c instanceof MockGraphics).length;

    tick(scene, 16);
    const graphicsAfter = overlayLayer.children.filter((c) => c instanceof MockGraphics).length;
    expect(graphicsAfter).toBe(graphicsBefore);

    scene.destroy();
  });

  it("keeps legacy blocked pulse static when reduceMotion is true", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: true });
    await scene.init(canvas);

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "blocked" as const,
      currentTaskId: null,
      currentRoomId: "execution",
      blockedReason: "stuck",
    };
    scene.updateProjection({ ...baseProjection, agents: [agent] });

    const overlayLayer = getOverlayLayer(scene);
    const graphicsBefore = overlayLayer.children.filter((c) => c instanceof MockGraphics).length;

    tick(scene, 16);
    const graphicsAfter = overlayLayer.children.filter((c) => c instanceof MockGraphics).length;
    expect(graphicsAfter).toBe(graphicsBefore);

    scene.destroy();
  });

  it("guards zero-distance walk duration for legacy agents", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: false, reduceMotion: false });
    await scene.init(canvas);

    const zeroDistanceProjection: OfficeProjection = {
      ...baseProjection,
      rooms: [
        { roomId: "command", name: "Command", type: "command", bounds: { x: 0, y: 0, width: 200, height: 150 }, activeAgentIds: [] },
        { roomId: "execution", name: "Execution", type: "execution", bounds: { x: 0, y: 0, width: 200, height: 150 }, activeAgentIds: [] },
      ],
    };

    const agent = {
      agentId: "a1",
      name: "Agent 1",
      role: "worker" as const,
      status: "blocked" as const,
      currentTaskId: null,
      currentRoomId: "command",
      blockedReason: "stuck",
    };
    scene.updateProjection({ ...zeroDistanceProjection, agents: [agent] });
    tick(scene, 16);

    scene.updateProjection({ ...zeroDistanceProjection, agents: [{ ...agent, currentRoomId: "execution" }] });
    tick(scene, 16);

    const container = getAgentLayer(scene).children[0] as MockContainer;
    expect(container.x).toBe(100);
    expect(container.y).toBe(125);
    expect(Number.isFinite(container.x)).toBe(true);
    expect(Number.isFinite(container.y)).toBe(true);

    scene.destroy();
  });
});

describe("PixelOfficeScene selection API", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    MockAssets.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes selectAgent, selectRoom, clearSelection and setOnSelect", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    expect(typeof scene.selectAgent).toBe("function");
    expect(typeof scene.selectRoom).toBe("function");
    expect(typeof scene.clearSelection).toBe("function");
    expect(typeof scene.setOnSelect).toBe("function");

    scene.destroy();
  });

  it("forwards selected agent ids to the agent renderer", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    const agentRenderer = (scene as unknown as { agentRenderer: { getSelectedIds: () => Set<string> } }).agentRenderer;

    scene.selectAgent("agent-1");
    expect(agentRenderer.getSelectedIds().has("agent-1")).toBe(true);

    scene.clearSelection();
    expect(agentRenderer.getSelectedIds().has("agent-1")).toBe(false);

    scene.destroy();
  });

  it("clears previous agent highlight when selecting a new agent", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    const agentRenderer = (scene as unknown as { agentRenderer: { getSelectedIds: () => Set<string> } }).agentRenderer;

    scene.selectAgent("agent-1");
    expect(agentRenderer.getSelectedIds().has("agent-1")).toBe(true);

    scene.selectAgent("agent-2");
    expect(agentRenderer.getSelectedIds().has("agent-1")).toBe(false);
    expect(agentRenderer.getSelectedIds().has("agent-2")).toBe(true);

    scene.destroy();
  });

  it("forwards selected room ids to the room renderer", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    const roomRenderer = (scene as unknown as { roomRenderer: { getSelectedIds: () => Set<string> } }).roomRenderer;

    scene.selectRoom("command");
    expect(roomRenderer.getSelectedIds().has("command")).toBe(true);

    scene.clearSelection();
    expect(roomRenderer.getSelectedIds().has("command")).toBe(false);

    scene.destroy();
  });

  it("clears previous room highlight when selecting a new room", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    const roomRenderer = (scene as unknown as { roomRenderer: { getSelectedIds: () => Set<string> } }).roomRenderer;

    scene.selectRoom("command");
    expect(roomRenderer.getSelectedIds().has("command")).toBe(true);

    scene.selectRoom("execution");
    expect(roomRenderer.getSelectedIds().has("command")).toBe(false);
    expect(roomRenderer.getSelectedIds().has("execution")).toBe(true);

    scene.destroy();
  });

  it("renders a highlight outline around a selected agent", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    const projection: OfficeProjection = {
      ...baseProjection,
      agents: [
        {
          agentId: "agent-1",
          name: "Agent 1",
          role: "worker",
          status: "idle",
          currentTaskId: null,
          currentRoomId: "command",
          blockedReason: null,
        },
      ],
    };

    scene.selectAgent("agent-1");
    scene.updateProjection(projection);

    const agentLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[2] as MockContainer;
    const container = agentLayer.children[0] as MockContainer;
    const highlights = container.children.filter((c) => c instanceof MockGraphics);

    expect(highlights.length).toBeGreaterThan(0);

    scene.destroy();
  });

  it("forwards pointerdown on an agent sprite to the setOnSelect callback", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    const onSelect = vi.fn();
    scene.setOnSelect(onSelect);

    const projection: OfficeProjection = {
      ...baseProjection,
      agents: [
        {
          agentId: "agent-1",
          name: "Agent 1",
          role: "worker",
          status: "idle",
          currentTaskId: null,
          currentRoomId: "command",
          blockedReason: null,
        },
      ],
    };

    scene.updateProjection(projection);

    const agentLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[2] as MockContainer;
    const container = agentLayer.children[0] as MockContainer;
    const pointerDownHandlers = container.eventHandlers["pointerdown"];
    expect(pointerDownHandlers?.length).toBeGreaterThan(0);
    pointerDownHandlers![0]();

    expect(onSelect).toHaveBeenCalledWith({ kind: "agent", id: "agent-1" });

    scene.destroy();
  });

  it("renders a highlight outline around a selected room", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
    await scene.init(canvas);

    scene.selectRoom("command");
    scene.updateProjection(baseProjection);

    const roomLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[0] as MockContainer;
    const roomGraphic = roomLayer.children.find((c) => c instanceof MockGraphics) as MockGraphics | undefined;
    expect(roomGraphic).toBeDefined();

    const outlineStrokes = roomGraphic!.commands.filter(
      (c) => c.type === "stroke" && (c.args[0] as { width?: number } | undefined)?.width === 4
    );
    expect(outlineStrokes.length).toBeGreaterThan(0);

    scene.destroy();
  });
});

describe("PixelOfficeScene representative agent loads", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    MockAssets.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const ROOM_IDS = ["command", "execution", "review", "approval_delivery"] as const;

  function makeLoadProjection(agentCount: number): OfficeProjection {
    const rooms = ROOM_IDS.map((type, i) =>
      createRoom(type, type as import("@agent-office/protocol").RoomView["type"], (i % 2) * 420, Math.floor(i / 2) * 320)
    );

    const agents: import("@agent-office/protocol").AgentView[] = Array.from({ length: agentCount }, (_, i) => ({
      agentId: `agent-${i}`,
      name: `Agent ${i}`,
      role: ["orchestrator", "worker", "reviewer"][i % 3] as import("@agent-office/protocol").AgentView["role"],
      status: ["idle", "working", "blocked", "failed"][i % 4] as import("@agent-office/protocol").AgentView["status"],
      currentTaskId: null,
      currentRoomId: ROOM_IDS[i % ROOM_IDS.length],
      blockedReason: i % 4 === 2 ? "stuck" : null,
    }));

    return {
      ...baseProjection,
      rooms,
      agents,
    };
  }

  function getAgentLayer(scene: PixelOfficeScene): MockContainer {
    return (scene as unknown as { contentRoot: MockContainer }).contentRoot
      .children[2] as MockContainer;
  }

  function tick(scene: PixelOfficeScene, deltaMS: number): void {
    (scene as unknown as { update: (ticker: { deltaMS: number }) => void }).update({ deltaMS } as unknown as import("pixi.js").Ticker);
  }

  it.each([4, 12, 30])("renders %i agents without throwing", async (count) => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true, reduceMotion: true });
    await scene.init(canvas);

    const projection = makeLoadProjection(count);

    expect(() => scene.updateProjection(projection)).not.toThrow();

    const agentLayer = getAgentLayer(scene);
    expect(agentLayer.children.length).toBe(count);

    // Simulate several animation frames; reduced motion should keep effects static.
    expect(() => tick(scene, 16)).not.toThrow();
    expect(() => tick(scene, 16)).not.toThrow();
    expect(() => tick(scene, 16)).not.toThrow();

    scene.destroy();
  });

  it("cleans up all agent sprites after destroy", async () => {
    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true, reduceMotion: true });
    await scene.init(canvas);

    scene.updateProjection(makeLoadProjection(12));
    expect(getAgentLayer(scene).children.length).toBe(12);

    scene.destroy();

    expect(() => scene.updateProjection(makeLoadProjection(4))).not.toThrow();
  });
});
