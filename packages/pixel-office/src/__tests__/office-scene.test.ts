// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PixelOfficeScene } from "../office-scene.js";
import type { OfficeProjection, RoomView } from "@agent-office/protocol";
import { MockContainer, MockAssets } from "./pixi-mock.js";

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

describe("PixelOfficeScene procedural fallback", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    MockAssets.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to the procedural renderer and can be initialized", async () => {
    const scene = new PixelOfficeScene(canvas);
    await scene.init(canvas);
    expect(scene).toBeDefined();
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
});
