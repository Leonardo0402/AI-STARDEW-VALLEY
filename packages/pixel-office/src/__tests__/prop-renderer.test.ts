import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IntegrationProjection } from "@agent-office/control-ui/integration";
import { PropRenderer } from "../renderer/prop-renderer.js";
import { createDefaultLayout } from "../layout.js";
import { AssetLoader } from "../asset-loader.js";
import { MockContainer, MockGraphics, MockSprite, MockTexture, MockAssets } from "./pixi-mock.js";

vi.mock("pixi.js", () => import("./pixi-mock.js").then((m) => m.createPixiMock()));

let container: MockContainer;

describe("PropRenderer", () => {
  beforeEach(() => {
    container = new MockContainer();
    MockAssets.reset();
  });

  it("renders props procedurally when no asset loader is provided", () => {
    const renderer = new PropRenderer(container as unknown as import("pixi.js").Container);
    renderer.render(createDefaultLayout());

    const graphics = container.children.filter((c) => c instanceof MockGraphics);
    expect(graphics.length).toBeGreaterThan(0);
    const sprites = container.children.filter((c) => c instanceof MockSprite);
    expect(sprites.length).toBe(0);
  });

  it("uses prop texture sprites when available", async () => {
    const textures: Record<string, MockTexture> = {
      "desk-shared": new MockTexture("desk-shared"),
      workbench: new MockTexture("workbench"),
      "review-table": new MockTexture("review-table"),
      "approval-counter": new MockTexture("approval-counter"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll([
      "props/desk-shared",
      "props/workbench",
      "props/review-table",
      "props/approval-counter",
    ]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(createDefaultLayout());

    const sprites = container.children.filter((c) => c instanceof MockSprite) as MockSprite[];
    // command desk, 2 execution workbenches, review table, approval counter
    expect(sprites.length).toBe(5);
    const textureNames = sprites.map((s) => s.texture?.sourceUrl);
    expect(textureNames).toContain("desk-shared");
    expect(textureNames).toContain("workbench");
    expect(textureNames).toContain("review-table");
    expect(textureNames).toContain("approval-counter");
  });

  it("falls back to procedural prop when texture is missing", async () => {
    MockAssets.reset({}, ["desk-shared", "workbench", "review-table", "approval-counter"]);
    const loader = new AssetLoader();
    await loader.loadAll([
      "props/desk-shared",
      "props/workbench",
      "props/review-table",
      "props/approval-counter",
    ]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(createDefaultLayout());

    const sprites = container.children.filter((c) => c instanceof MockSprite);
    expect(sprites.length).toBe(0);
    const graphics = container.children.filter((c) => c instanceof MockGraphics);
    expect(graphics.length).toBeGreaterThan(0);
  });

  it("renders additional approval room props when pending approvals exist", () => {
    const renderer = new PropRenderer(container as unknown as import("pixi.js").Container);
    renderer.render(createDefaultLayout(), 2);

    const graphics = container.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];
    const approvalRoom = createDefaultLayout().rooms.find((r) => r.floorType === "approval_delivery")!;
    const cx = approvalRoom.x + approvalRoom.width / 2;
    const cy = approvalRoom.y + approvalRoom.height / 2;

    // Bell sits on the counter, package slot on the right wall, sconce on the left wall.
    const hasBell = graphics.some((g) =>
      g.commands.some((cmd) => cmd.type === "circle" && (cmd.args[1] as number) > cy)
    );
    const hasPackageSlot = graphics.some((g) =>
      g.commands.some(
        (cmd) =>
          cmd.type === "rect" &&
          (cmd.args[0] as number) > cx + 20 &&
          (cmd.args[1] as number) < cy
      )
    );
    const hasSconce = graphics.some((g) =>
      g.commands.some(
        (cmd) =>
          cmd.type === "rect" &&
          (cmd.args[0] as number) < cx - 20 &&
          (cmd.args[1] as number) < approvalRoom.y + 60
      )
    );

    expect(hasBell).toBe(true);
    expect(hasPackageSlot).toBe(true);
    expect(hasSconce).toBe(true);
  });

  it("does not render dynamic approval props when there are no pending approvals", () => {
    const renderer = new PropRenderer(container as unknown as import("pixi.js").Container);
    renderer.render(createDefaultLayout(), 0);

    const graphics = container.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];
    const approvalRoom = createDefaultLayout().rooms.find((r) => r.floorType === "approval_delivery")!;
    const cx = approvalRoom.x + approvalRoom.width / 2;
    const cy = approvalRoom.y + approvalRoom.height / 2;

    const hasBell = graphics.some((g) =>
      g.commands.some((cmd) => cmd.type === "circle" && (cmd.args[1] as number) > cy)
    );
    expect(hasBell).toBe(false);
  });
});

describe("integration props", () => {
  beforeEach(() => {
    container = new MockContainer();
    MockAssets.reset();
  });

  it("creates mission board when queue has items", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "mission-board": new MockTexture("mission-board"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/mission-board"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    const integration: IntegrationProjection = {
      github: { issues: [{ taskId: "t1" } as any], pulls: [], auditNotes: [] },
      reviews: { assigned: [], submitted: [] },
      timeline: { events: [] },
    };
    renderer.updateIntegration(integration);

    expect(renderer.getIntegrationSpriteNames()).toContain("mission-board");
  });

  it("creates review desk when assigned reviews exist", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "review-desk": new MockTexture("review-desk"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/review-desk"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    const integration: IntegrationProjection = {
      github: { issues: [], pulls: [], auditNotes: [] },
      reviews: { assigned: [{ taskId: "r1" } as any], submitted: [] },
      timeline: { events: [] },
    };
    renderer.updateIntegration(integration);

    expect(renderer.getIntegrationSpriteNames()).toContain("review-desk");
  });

  it("creates filing cabinet when audit notes exist", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "filing-cabinet": new MockTexture("filing-cabinet"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/filing-cabinet"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    const integration: IntegrationProjection = {
      github: { issues: [], pulls: [], auditNotes: [{ noteId: "n1" } as any] },
      reviews: { assigned: [], submitted: [] },
      timeline: { events: [] },
    };
    renderer.updateIntegration(integration);

    expect(renderer.getIntegrationSpriteNames()).toContain("filing-cabinet");
  });

  it("does not create wall scroll when github is non-null but timeline is empty", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "wall-scroll": new MockTexture("wall-scroll"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/wall-scroll"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    const integration: IntegrationProjection = {
      github: { issues: [{ taskId: "t1" } as any], pulls: [], auditNotes: [] },
      reviews: null,
      timeline: { events: [] },
    };
    renderer.updateIntegration(integration);

    expect(renderer.getIntegrationSpriteNames()).not.toContain("wall-scroll");
  });

  it("does not create wall scroll when reviews are non-null but timeline is empty", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "wall-scroll": new MockTexture("wall-scroll"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/wall-scroll"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    const integration: IntegrationProjection = {
      github: null,
      reviews: { assigned: [{ taskId: "r1" } as any], submitted: [] },
      timeline: { events: [] },
    };
    renderer.updateIntegration(integration);

    expect(renderer.getIntegrationSpriteNames()).not.toContain("wall-scroll");
  });

  it("does not create wall scroll when timeline projection has no events", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "wall-scroll": new MockTexture("wall-scroll"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/wall-scroll"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    const integration: IntegrationProjection = {
      github: null,
      reviews: null,
      timeline: { events: [] },
    };
    renderer.updateIntegration(integration);

    expect(renderer.getIntegrationSpriteNames()).not.toContain("wall-scroll");
  });

  it("creates wall scroll when review-assigned timeline event exists", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "wall-scroll": new MockTexture("wall-scroll"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/wall-scroll"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    const integration: IntegrationProjection = {
      github: null,
      reviews: null,
      timeline: {
        events: [
          { eventId: "e1", type: "review.assigned", timestamp: "2026-01-01T00:00:00Z", payload: { agentId: "a1" } },
        ],
      },
    };
    renderer.updateIntegration(integration);

    expect(renderer.getIntegrationSpriteNames()).toContain("wall-scroll");
  });

  it("creates wall scroll when audit-note-added timeline event exists", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "wall-scroll": new MockTexture("wall-scroll"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/wall-scroll"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    const integration: IntegrationProjection = {
      github: null,
      reviews: null,
      timeline: {
        events: [
          { eventId: "e1", type: "audit_note.added", timestamp: "2026-01-01T00:00:00Z", payload: { author: "auditor-1" } },
        ],
      },
    };
    renderer.updateIntegration(integration);

    expect(renderer.getIntegrationSpriteNames()).toContain("wall-scroll");
  });

  it("removes wall scroll when timeline becomes empty", async () => {
    const layout = createDefaultLayout();
    const textures: Record<string, MockTexture> = {
      "wall-scroll": new MockTexture("wall-scroll"),
    };
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll(["props/wall-scroll"]);

    const renderer = new PropRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    renderer.render(layout);

    renderer.updateIntegration({
      github: null,
      reviews: null,
      timeline: {
        events: [
          { eventId: "e1", type: "review.submitted", timestamp: "2026-01-01T00:00:00Z", payload: {} },
        ],
      },
    });
    expect(renderer.getIntegrationSpriteNames()).toContain("wall-scroll");

    renderer.updateIntegration({
      github: null,
      reviews: null,
      timeline: { events: [] },
    });
    expect(renderer.getIntegrationSpriteNames()).not.toContain("wall-scroll");
  });
});
