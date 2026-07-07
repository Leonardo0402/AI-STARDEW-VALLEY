import { describe, it, expect, beforeEach, vi } from "vitest";
import { EffectRenderer } from "../renderer/effect-renderer.js";
import { createDefaultLayout, getAgentPositionByRoomId } from "../layout.js";
import { AssetLoader } from "../asset-loader.js";
import type { AgentView, ApprovalView, OfficeProjection, TaskView } from "@agent-office/protocol";
import { MockContainer, MockGraphics, MockSprite, MockText, MockTexture, MockAssets } from "./pixi-mock.js";

vi.mock("pixi.js", () => import("./pixi-mock.js").then((m) => m.createPixiMock()));

const layout = createDefaultLayout();

function agentSeed(agentId: string): number {
  return agentId.charCodeAt(agentId.length - 1);
}

function makeAgent(overrides: Partial<AgentView> = {}): AgentView {
  return {
    agentId: "a1",
    name: "Agent 1",
    role: "worker",
    status: "idle",
    currentTaskId: null,
    currentRoomId: "command",
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

function makeProjection(agents: AgentView[], tasks: TaskView[] = [], pendingApprovals: ApprovalView[] = []): OfficeProjection {
  return {
    agents,
    tasks,
    artifacts: [],
    approvals: [],
    rooms: [],
    pendingApprovals,
    blockedTasks: [],
    errors: [],
  };
}

function getSprites(container: MockContainer): MockSprite[] {
  return container.children.filter((c) => c instanceof MockSprite) as MockSprite[];
}

function getGraphics(container: MockContainer): MockGraphics[] {
  return container.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];
}

function getTexts(container: MockContainer): MockText[] {
  return container.children.filter((c) => c instanceof MockText) as MockText[];
}

describe("EffectRenderer", () => {
  let container: MockContainer;

  beforeEach(() => {
    container = new MockContainer();
    MockAssets.reset();
  });

  it("renders blocked marker above a blocked agent", async () => {
    MockAssets.reset({ "blocked-marker": new MockTexture("blocked-marker") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/blocked-marker"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const agent = makeAgent({ status: "blocked", currentRoomId: "execution", blockedReason: "stuck" });
    renderer.render(makeProjection([agent]), layout);

    const sprites = getSprites(container);
    expect(sprites.length).toBe(1);
    expect(sprites[0].texture?.sourceUrl).toBe("blocked-marker");

    const pos = getAgentPositionByRoomId(layout, "execution", agentSeed(agent.agentId));
    expect(sprites[0].x).toBe(pos.x);
    expect(sprites[0].y).toBe(pos.y - 18);
  });

  it("falls back to a red exclamation for blocked markers", () => {
    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);

    const agent = makeAgent({ status: "blocked", currentRoomId: "execution", blockedReason: "stuck" });
    renderer.render(makeProjection([agent]), layout);

    const texts = getTexts(container);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.text === "!")).toBe(true);
  });

  it("renders working sparkle above a working agent's shoulder", async () => {
    MockAssets.reset({ sparkle: new MockTexture("sparkle") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/sparkle"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const agent = makeAgent({ status: "working", currentRoomId: "execution" });
    renderer.render(makeProjection([agent]), layout);

    const sprites = getSprites(container);
    expect(sprites.length).toBe(1);
    expect(sprites[0].texture?.sourceUrl).toBe("sparkle");

    const pos = getAgentPositionByRoomId(layout, "execution", agentSeed(agent.agentId));
    expect(sprites[0].x).toBe(pos.x + 8);
    expect(sprites[0].y).toBe(pos.y - 14);
  });

  it("does not render sparkle for idle agents", () => {
    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);
    renderer.render(makeProjection([makeAgent({ status: "idle" })]), layout);

    expect(getSprites(container).length).toBe(0);
    expect(getGraphics(container).length).toBe(0);
  });

  it("renders service bell above approval_delivery and review rooms when pending approvals exist", async () => {
    MockAssets.reset({ "service-bell": new MockTexture("service-bell") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/service-bell"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const projection = makeProjection([], [], [
      { approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" },
    ]);
    renderer.render(projection, layout);

    const sprites = getSprites(container);
    expect(sprites.length).toBe(2);
    expect(sprites.every((s) => s.texture?.sourceUrl === "service-bell")).toBe(true);

    const reviewRoom = layout.rooms.find((r) => r.floorType === "review")!;
    const approvalRoom = layout.rooms.find((r) => r.floorType === "approval_delivery")!;
    expect(sprites.some((s) => s.x === reviewRoom.x + reviewRoom.width / 2 && s.y === reviewRoom.y + 20)).toBe(true);
    expect(sprites.some((s) => s.x === approvalRoom.x + approvalRoom.width / 2 && s.y === approvalRoom.y + 20)).toBe(true);
  });

  it("does not render service bell when there are no pending approvals", async () => {
    MockAssets.reset({ "service-bell": new MockTexture("service-bell") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/service-bell"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    renderer.render(makeProjection([]), layout);

    expect(getSprites(container).length).toBe(0);
    expect(getGraphics(container).length).toBe(0);
  });

  it("falls back to procedural bell shape when service-bell texture is missing", () => {
    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);

    const projection = makeProjection([], [], [
      { approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" },
    ]);
    renderer.render(projection, layout);

    expect(getGraphics(container).length).toBeGreaterThan(0);
    expect(getTexts(container).length).toBeGreaterThan(0);
  });

  it("uses a fixed pulse value when reduceMotion is true", async () => {
    MockAssets.reset({ "service-bell": new MockTexture("service-bell") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/service-bell"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader,
      true
    );

    const projection = makeProjection([], [], [
      { approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" },
    ]);

    renderer.render(projection, layout, 16);
    const firstCalls = getSprites(container).map((s) => [...s.scale.set.mock.calls]);

    renderer.render(projection, layout, 10000);
    const secondCalls = getSprites(container).map((s) => [...s.scale.set.mock.calls]);

    secondCalls.forEach((calls, i) => {
      expect(calls[calls.length - 1]).toEqual(firstCalls[i][firstCalls[i].length - 1]);
    });
  });

  it("draws an urgency glow ring around the service bell", async () => {
    MockAssets.reset({ "service-bell": new MockTexture("service-bell") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/service-bell"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const projection = makeProjection([], [], [
      { approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" },
    ]);
    renderer.render(projection, layout);

    const graphics = getGraphics(container);
    expect(graphics.length).toBeGreaterThan(0);
    const approvalRoom = layout.rooms.find((r) => r.floorType === "approval_delivery")!;
    const bx = approvalRoom.x + approvalRoom.width / 2;
    const by = approvalRoom.y + 20;
    const hasGlow = graphics.some((g) =>
      g.commands.some(
        (cmd) =>
          cmd.type === "circle" &&
          cmd.args[0] === bx &&
          cmd.args[1] === by &&
          (cmd.args[2] as number) > 12
      )
    );
    expect(hasGlow).toBe(true);
  });

  it("draws a red pulse glow and speech-bubble exclamation for blocked agents", async () => {
    MockAssets.reset({ "blocked-marker": new MockTexture("blocked-marker") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/blocked-marker"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const agent = makeAgent({ status: "blocked", currentRoomId: "execution", blockedReason: "stuck" });
    renderer.render(makeProjection([agent]), layout);

    const pos = getAgentPositionByRoomId(layout, "execution", agentSeed(agent.agentId));
    const graphics = getGraphics(container);
    const texts = getTexts(container);

    const hasGlow = graphics.some((g) =>
      g.commands.some(
        (cmd) =>
          cmd.type === "circle" &&
          cmd.args[0] === pos.x &&
          cmd.args[1] === pos.y &&
          (cmd.args[2] as number) > 10
      )
    );
    expect(hasGlow).toBe(true);
    expect(texts.some((t) => t.text === "!")).toBe(true);
  });

  it("draws an error tag next to failed agents", () => {
    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);

    const agent = makeAgent({ status: "failed", currentRoomId: "execution" });
    renderer.render(makeProjection([agent]), layout);

    const pos = getAgentPositionByRoomId(layout, "execution", agentSeed(agent.agentId));
    const graphics = getGraphics(container);
    const texts = getTexts(container);

    const hasErrorTag = graphics.some((g) =>
      g.commands.some(
        (cmd) =>
          cmd.type === "rect" &&
          (cmd.args[0] as number) > pos.x &&
          (cmd.args[1] as number) < pos.y
      )
    );
    expect(hasErrorTag).toBe(true);
    expect(texts.some((t) => t.text === "×")).toBe(true);
  });
});
