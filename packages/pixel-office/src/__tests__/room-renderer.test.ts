import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoomRenderer } from "../renderer/room-renderer.js";
import { createDefaultLayout } from "../layout.js";
import { AssetLoader } from "../asset-loader.js";
import { MockContainer, MockGraphics, MockText, MockTexture, MockAssets, MockSprite } from "./pixi-mock.js";

vi.mock("pixi.js", () => import("./pixi-mock.js").then((m) => m.createPixiMock()));

describe("RoomRenderer", () => {
  let container: MockContainer;
  let renderer: RoomRenderer;

  beforeEach(() => {
    container = new MockContainer();
    renderer = new RoomRenderer(container as unknown as import("pixi.js").Container);
    MockAssets.reset();
  });

  it("renders four rooms from the default layout", () => {
    renderer.render(createDefaultLayout());
    const graphics = container.children.filter((c) => c instanceof MockGraphics);
    const texts = container.children.filter((c) => c instanceof MockText);

    expect(graphics.length).toBe(4);
    expect(texts.length).toBe(4);
  });

  it("renders distinct floor patterns for each room type", () => {
    renderer.render(createDefaultLayout());
    const graphics = container.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];

    const floorFillColors = graphics.map((g) => {
      const mainRectIndex = g.commands.findIndex(
        (cmd) =>
          cmd.type === "rect" &&
          typeof cmd.args[2] === "number" &&
          (cmd.args[2] as number) >= 300
      );
      const fillCmd = g.commands.slice(mainRectIndex).find((cmd) => cmd.type === "fill");
      return (fillCmd?.args[0] as { color?: number } | undefined)?.color;
    });
    expect(new Set(floorFillColors).size).toBe(4);
  });

  it("draws each room at its layout position", () => {
    const layout = createDefaultLayout();
    renderer.render(layout);
    const graphics = container.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];

    for (const room of layout.rooms) {
      const roomGraphic = graphics.find((g) =>
        g.commands.some(
          (cmd) =>
            cmd.type === "rect" &&
            cmd.args[0] === room.x &&
            cmd.args[1] === room.y &&
            cmd.args[2] === room.width &&
            cmd.args[3] === room.height
        )
      );
      expect(roomGraphic).toBeDefined();
    }
  });

  it("labels each room with a wooden-sign styled text", () => {
    const layout = createDefaultLayout();
    renderer.render(layout);
    const texts = container.children.filter((c) => c instanceof MockText) as MockText[];

    for (const room of layout.rooms) {
      const label = texts.find((t) => t.text === room.name);
      expect(label).toBeDefined();
      expect(label!.x).toBe(room.x + 8);
      expect(label!.y).toBe(room.y + 4);
    }
  });

  it("draws wall lines along room edges", () => {
    const layout = createDefaultLayout();
    renderer.render(layout);
    const graphics = container.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];

    for (const room of layout.rooms) {
      const roomGraphic = graphics.find((g) =>
        g.commands.some(
          (cmd) =>
            cmd.type === "rect" &&
            cmd.args[0] === room.x &&
            cmd.args[1] === room.y &&
            cmd.args[2] === room.width &&
            cmd.args[3] === room.height
        )
      );
      expect(roomGraphic).toBeDefined();

      const hasTopWall = roomGraphic!.commands.some(
        (cmd) =>
          cmd.type === "moveTo" &&
          cmd.args[0] === room.x &&
          cmd.args[1] === room.y
      );
      expect(hasTopWall).toBe(true);
    }
  });

  it("draws wooden doorway signs behind room labels", () => {
    const layout = createDefaultLayout();
    renderer.render(layout);
    const graphics = container.children.filter((c) => c instanceof MockGraphics) as MockGraphics[];

    for (const room of layout.rooms) {
      const roomGraphic = graphics.find((g) =>
        g.commands.some(
          (cmd) =>
            cmd.type === "rect" &&
            cmd.args[0] === room.x &&
            cmd.args[1] === room.y &&
            cmd.args[2] === room.width &&
            cmd.args[3] === room.height
        )
      );
      expect(roomGraphic).toBeDefined();

      const signRects = roomGraphic!.commands.filter(
        (cmd) =>
          cmd.type === "rect" &&
          cmd.args[0] === room.x + 4 &&
          cmd.args[1] === room.y + 2 &&
          typeof cmd.args[2] === "number" &&
          (cmd.args[2] as number) > 0 &&
          typeof cmd.args[3] === "number" &&
          (cmd.args[3] as number) > 0
      );
      expect(signRects.length).toBeGreaterThan(0);
    }
  });

  it("clears previous rooms before re-rendering", () => {
    renderer.render(createDefaultLayout());
    renderer.render(createDefaultLayout());
    const graphics = container.children.filter((c) => c instanceof MockGraphics);
    expect(graphics.length).toBe(4);
  });

  it("uses floor texture sprites when asset loader provides them", async () => {
    const textures: Record<string, MockTexture> = {};
    for (const type of ["command", "execution", "review", "approval"]) {
      textures[`floor-${type}`] = new MockTexture(`floor-${type}`);
    }
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    await loader.loadAll([
      "rooms/floor-command",
      "rooms/floor-execution",
      "rooms/floor-review",
      "rooms/floor-approval",
    ]);

    const spriteRenderer = new RoomRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    spriteRenderer.render(createDefaultLayout());

    const sprites = container.children.filter((c) => c instanceof MockSprite) as MockSprite[];
    expect(sprites.length).toBe(4);
    const textureNames = sprites.map((s) => s.texture?.sourceUrl);
    expect(textureNames).toContain("floor-command");
    expect(textureNames).toContain("floor-execution");
    expect(textureNames).toContain("floor-review");
    expect(textureNames).toContain("floor-approval");
  });

  it("falls back to procedural floor when asset loader has no texture", async () => {
    MockAssets.reset({}, ["floor-command", "floor-execution", "floor-review", "floor-approval"]);
    const loader = new AssetLoader();
    await loader.loadAll([
      "rooms/floor-command",
      "rooms/floor-execution",
      "rooms/floor-review",
      "rooms/floor-approval",
    ]);

    const fallbackRenderer = new RoomRenderer(
      container as unknown as import("pixi.js").Container,
      loader
    );
    fallbackRenderer.render(createDefaultLayout());

    const sprites = container.children.filter((c) => c instanceof MockSprite);
    expect(sprites.length).toBe(0);
    const graphics = container.children.filter((c) => c instanceof MockGraphics);
    expect(graphics.length).toBe(4);
  });
});
