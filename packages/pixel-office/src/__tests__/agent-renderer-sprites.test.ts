import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentRenderer } from "../renderer/agent-renderer.js";
import { createDefaultLayout } from "../layout.js";
import { AssetLoader } from "../asset-loader.js";
import type { AgentView, OfficeProjection } from "@agent-office/protocol";
import { MockContainer, MockSprite, MockTexture, MockAssets } from "./pixi-mock.js";

vi.mock("pixi.js", () => import("./pixi-mock.js").then((m) => m.createPixiMock()));

function makeAgent(
  id: string,
  roomId: string | null,
  role: AgentView["role"] = "worker",
  status: AgentView["status"] = "working",
  currentTaskId: string | null = null
): AgentView {
  return {
    agentId: id,
    name: `Agent-${id}`,
    role,
    status,
    currentTaskId,
    currentRoomId: roomId,
    blockedReason: status === "blocked" ? "stuck" : null,
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

function getAgentSprites(container: MockContainer): MockSprite[] {
  return container.children
    .filter((c) => c instanceof MockContainer)
    .flatMap((c) => (c as MockContainer).children)
    .filter((c) => c instanceof MockSprite) as MockSprite[];
}

describe("AgentRenderer sprites", () => {
  let container: MockContainer;

  beforeEach(() => {
    container = new MockContainer();
    MockAssets.reset();
  });

  it("uses role + idle texture when agent is idle", async () => {
    const textures: Record<string, MockTexture> = {
      "orchestrator-idle": new MockTexture("orchestrator-idle"),
    };
    MockAssets.reset(textures);
    const loader = new AssetLoader();
    await loader.loadAll(["agents/orchestrator-idle"]);

    const renderer = new AgentRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render([makeAgent("a1", "command", "orchestrator", "idle")], layout, makeProjection([]));

    const sprites = getAgentSprites(container);
    expect(sprites.length).toBe(1);
    expect(sprites[0].texture?.sourceUrl).toBe("orchestrator-idle");
  });

  it("uses role + working texture for working status", async () => {
    const textures: Record<string, MockTexture> = {
      "worker-working": new MockTexture("worker-working"),
    };
    MockAssets.reset(textures);
    const loader = new AssetLoader();
    await loader.loadAll(["agents/worker-working"]);

    const renderer = new AgentRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render([makeAgent("a1", "command", "worker", "working")], layout, makeProjection([]));

    const sprites = getAgentSprites(container);
    expect(sprites.length).toBe(1);
    expect(sprites[0].texture?.sourceUrl).toBe("worker-working");
  });

  it("uses role + blocked texture for blocked status", async () => {
    const textures: Record<string, MockTexture> = {
      "reviewer-blocked": new MockTexture("reviewer-blocked"),
    };
    MockAssets.reset(textures);
    const loader = new AssetLoader();
    await loader.loadAll(["agents/reviewer-blocked"]);

    const renderer = new AgentRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render([makeAgent("a1", "command", "reviewer", "blocked")], layout, makeProjection([]));

    const sprites = getAgentSprites(container);
    expect(sprites.length).toBe(1);
    expect(sprites[0].texture?.sourceUrl).toBe("reviewer-blocked");
  });

  it("falls back to procedural body when texture is missing", async () => {
    MockAssets.reset({}, ["worker-idle"]);
    const loader = new AssetLoader();
    await loader.loadAll(["agents/worker-idle"]);

    const renderer = new AgentRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render([makeAgent("a1", "command", "worker", "idle")], layout, makeProjection([]));

    const sprites = getAgentSprites(container);
    expect(sprites.length).toBe(0);
  });

  it("switches to walk texture when currentRoomId changes", async () => {
    const walkStrip = new MockTexture("worker-walk");
    walkStrip.width = 64;
    walkStrip.height = 32;
    const textures: Record<string, MockTexture> = {
      "worker-idle": new MockTexture("worker-idle"),
      "worker-walk": walkStrip,
    };
    MockAssets.reset(textures);
    const loader = new AssetLoader();
    await loader.loadAll(["agents/worker-idle", "agents/worker-walk"]);

    const renderer = new AgentRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render([makeAgent("a1", "command", "worker", "idle")], layout, makeProjection([]));

    // move agent to another room
    renderer.render([makeAgent("a1", "execution", "worker", "idle")], layout, makeProjection([]));

    const sprites = getAgentSprites(container);
    expect(sprites.length).toBe(1);
    expect(sprites[0].texture?.sourceUrl).toBe("worker-walk");
  });

  it("uses role + idle texture for approval state and does not load a missing approval texture", async () => {
    const textures: Record<string, MockTexture> = {
      "worker-idle": new MockTexture("worker-idle"),
    };
    MockAssets.reset(textures);
    const loader = new AssetLoader();
    await loader.loadAll(["agents/worker-idle"]);

    const renderer = new AgentRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );

    const agent = makeAgent("a1", "review", "worker", "waiting");
    const projection: OfficeProjection = {
      ...makeProjection([agent]),
      pendingApprovals: [
        { approvalId: "ap1", taskId: "t1", kind: "artifact_delivery", status: "requested", requestedBy: "a1", reason: "" },
      ],
    } as OfficeProjection;

    renderer.render([agent], layout, projection);

    const sprites = getAgentSprites(container);
    expect(sprites.length).toBe(1);
    expect(sprites[0].texture?.sourceUrl).toBe("worker-idle");
    expect(loader.getTexture("worker-approval")).toBeNull();
  });
});
