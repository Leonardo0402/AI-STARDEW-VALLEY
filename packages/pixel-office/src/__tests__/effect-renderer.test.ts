import { describe, it, expect, beforeEach, vi } from "vitest";
import { EffectRenderer } from "../renderer/effect-renderer.js";
import { createDefaultLayout, getAgentPositionByRoomId } from "../layout.js";
import { AssetLoader } from "../asset-loader.js";
import type { AgentView, ApprovalView, OfficeProjection, TaskView } from "@agent-office/protocol";
import type { IntegrationProjection } from "@agent-office/control-ui/integration";
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

  it("renders service bell above the approval_delivery room when pending approvals exist", async () => {
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
    expect(sprites.length).toBe(1);
    expect(sprites[0].texture?.sourceUrl).toBe("service-bell");

    const approvalRoom = layout.rooms.find((r) => r.floorType === "approval_delivery")!;
    expect(sprites[0].x).toBe(approvalRoom.x + approvalRoom.width / 2);
    expect(sprites[0].y).toBe(approvalRoom.y + 20);
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

  it("draws a rework cue above the producer of a revision_required artifact", () => {
    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);

    const agent = makeAgent({ agentId: "a1", status: "idle", currentRoomId: "execution" });
    const projection: OfficeProjection = {
      ...makeProjection([agent]),
      artifacts: [
        {
          artifactId: "art-1",
          taskId: "t1",
          producerAgentId: "a1",
          type: "document",
          title: "Report",
          status: "revision_required",
          version: 1,
          reviewResult: null,
        },
      ],
    };
    renderer.render(projection, layout);

    const texts = getTexts(container);
    expect(texts.some((t) => t.text === "rework")).toBe(true);
  });

  it("pulses the service bell on a 1.2s loop", async () => {
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

    renderer.render(projection, layout, 0);
    const start = lastScale(getSprites(container)[0]);

    renderer.render(projection, layout, 300);
    const quarter = lastScale(getSprites(container)[0]);
    expect(quarter).not.toBe(start);

    renderer.render(projection, layout, 900);
    const full = lastScale(getSprites(container)[0]);
    expect(full).toBe(start);
  });

  it("pulses blocked markers on a 1s loop", async () => {
    MockAssets.reset({ "blocked-marker": new MockTexture("blocked-marker") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/blocked-marker"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const agent = makeAgent({ status: "blocked", currentRoomId: "execution", blockedReason: "stuck" });

    renderer.render(makeProjection([agent]), layout, 0);
    const start = lastScale(getSprites(container)[0]);

    renderer.render(makeProjection([agent]), layout, 250);
    const quarter = lastScale(getSprites(container)[0]);
    expect(quarter).not.toBe(start);

    renderer.render(makeProjection([agent]), layout, 750);
    const full = lastScale(getSprites(container)[0]);
    expect(full).toBe(start);
  });

  it("animates working sparkles in 0.8s steps", async () => {
    MockAssets.reset({ sparkle: new MockTexture("sparkle") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/sparkle"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const agent = makeAgent({ status: "working", currentRoomId: "execution" });

    renderer.render(makeProjection([agent]), layout, 0);
    const step0 = lastScale(getSprites(container)[0]);

    renderer.render(makeProjection([agent]), layout, 200);
    const step1 = lastScale(getSprites(container)[0]);
    expect(step1).not.toBe(step0);

    renderer.render(makeProjection([agent]), layout, 200);
    const step2 = lastScale(getSprites(container)[0]);
    expect(step2).not.toBe(step1);

    renderer.render(makeProjection([agent]), layout, 400);
    const step4 = lastScale(getSprites(container)[0]);
    expect(step4).toBe(step0);
  });

  it("keeps working sparkle static when reduceMotion is true", async () => {
    MockAssets.reset({ sparkle: new MockTexture("sparkle") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/sparkle"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader,
      true
    );

    const agent = makeAgent({ status: "working", currentRoomId: "execution" });

    renderer.render(makeProjection([agent]), layout, 0);
    const start = lastScale(getSprites(container)[0]);

    renderer.render(makeProjection([agent]), layout, 1000);
    const later = lastScale(getSprites(container)[0]);
    expect(later).toBe(start);
  });

  it("keeps blocked marker static when reduceMotion is true", async () => {
    MockAssets.reset({ "blocked-marker": new MockTexture("blocked-marker") });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/blocked-marker"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader,
      true
    );

    const agent = makeAgent({ status: "blocked", currentRoomId: "execution", blockedReason: "stuck" });

    renderer.render(makeProjection([agent]), layout, 0);
    const start = lastScale(getSprites(container)[0]);

    renderer.render(makeProjection([agent]), layout, 1000);
    const later = lastScale(getSprites(container)[0]);
    expect(later).toBe(start);
  });

  it("wraps effect phases to avoid long-term float drift", async () => {
    MockAssets.reset({
      "service-bell": new MockTexture("service-bell"),
      "blocked-marker": new MockTexture("blocked-marker"),
      sparkle: new MockTexture("sparkle"),
    });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/service-bell", "effects/blocked-marker", "effects/sparkle"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const agent = makeAgent({ status: "blocked", currentRoomId: "execution", blockedReason: "stuck" });
    const projection = makeProjection(
      [agent],
      [],
      [{ approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" }]
    );

    renderer.render(projection, layout, 1e9);

    const bellPulsePhase = (renderer as unknown as { bellPulsePhase: number }).bellPulsePhase;
    const blockedPulsePhase = (renderer as unknown as { blockedPulsePhase: number }).blockedPulsePhase;
    const sparklePhase = (renderer as unknown as { sparklePhase: number }).sparklePhase;

    expect(bellPulsePhase).toBeGreaterThanOrEqual(0);
    expect(bellPulsePhase).toBeLessThan(1200);
    expect(blockedPulsePhase).toBeGreaterThanOrEqual(0);
    expect(blockedPulsePhase).toBeLessThan(1000);
    expect(sparklePhase).toBeGreaterThanOrEqual(0);
    expect(sparklePhase).toBeLessThan(800);
  });

  it("does not accumulate effect phases when reduceMotion is true", async () => {
    MockAssets.reset({
      "service-bell": new MockTexture("service-bell"),
      "blocked-marker": new MockTexture("blocked-marker"),
      sparkle: new MockTexture("sparkle"),
    });
    const loader = new AssetLoader();
    await loader.loadAll(["effects/service-bell", "effects/blocked-marker", "effects/sparkle"]);

    const renderer = new EffectRenderer(
      container as unknown as import("pixi.js").Container,
      loader,
      true
    );

    const agent = makeAgent({ status: "blocked", currentRoomId: "execution", blockedReason: "stuck" });
    const projection = makeProjection(
      [agent],
      [],
      [{ approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" }]
    );

    renderer.render(projection, layout, 16);
    const before = {
      bellPulsePhase: (renderer as unknown as { bellPulsePhase: number }).bellPulsePhase,
      blockedPulsePhase: (renderer as unknown as { blockedPulsePhase: number }).blockedPulsePhase,
      sparklePhase: (renderer as unknown as { sparklePhase: number }).sparklePhase,
    };

    renderer.render(projection, layout, 10000);
    const after = {
      bellPulsePhase: (renderer as unknown as { bellPulsePhase: number }).bellPulsePhase,
      blockedPulsePhase: (renderer as unknown as { blockedPulsePhase: number }).blockedPulsePhase,
      sparklePhase: (renderer as unknown as { sparklePhase: number }).sparklePhase,
    };

    expect(after).toEqual(before);
  });
});

describe("integration effects", () => {
  let container: MockContainer;

  beforeEach(() => {
    container = new MockContainer();
    MockAssets.reset();
  });

  it("adds glow when reviews are pending approval", () => {
    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);
    const integration: IntegrationProjection = {
      github: null,
      reviews: { assigned: [], submitted: [{ reviewId: "r1" } as any] },
    };
    renderer.updateIntegration(integration);
    expect(renderer.getActiveEffects()).toContain("review-pending");
  });

  it("adds queue glow when github issues or pulls exist", () => {
    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);
    const integration: IntegrationProjection = {
      github: { issues: [{ taskId: "t1" } as any], pulls: [], auditNotes: [] },
      reviews: { assigned: [], submitted: [] },
    };
    renderer.updateIntegration(integration);
    expect(renderer.getActiveEffects()).toContain("queue-glow");
  });

  it("removes effects when integration state is cleared", () => {
    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);
    renderer.updateIntegration({
      github: null,
      reviews: { assigned: [], submitted: [{ reviewId: "r1" } as any] },
    });
    renderer.updateIntegration({ github: null, reviews: null });
    expect(renderer.getActiveEffects()).not.toContain("review-pending");
    expect(renderer.getActiveEffects()).not.toContain("queue-glow");
  });
});

function lastScale(sprite: MockSprite): number {
  const calls = sprite.scale.set.mock.calls;
  const last = calls[calls.length - 1] as [number, number] | undefined;
  return last?.[0] ?? 1;
}
