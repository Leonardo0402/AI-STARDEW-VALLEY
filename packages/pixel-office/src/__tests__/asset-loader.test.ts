import { describe, it, expect, beforeEach, vi } from "vitest";
import { AssetLoader } from "../asset-loader.js";
import { MockTexture, MockAssets } from "./pixi-mock.js";

vi.mock("pixi.js", () => import("./pixi-mock.js").then((m) => m.createPixiMock()));

describe("AssetLoader", () => {
  beforeEach(() => {
    MockAssets.reset();
  });

  it("reports zero progress before loading", () => {
    const loader = new AssetLoader("");
    expect(loader.getProgress()).toEqual({ loaded: 0, total: 0, failed: [] });
  });

  it("loads all provided assets and reports success", async () => {
    const idle = new MockTexture("orchestrator-idle");
    const walk = new MockTexture("orchestrator-walk");
    MockAssets.reset({ "orchestrator-idle": idle, "orchestrator-walk": walk });

    const loader = new AssetLoader("assets/agents/");
    const result = await loader.loadAll(["orchestrator-idle", "orchestrator-walk"]);

    expect(result.loaded).toBe(2);
    expect(result.total).toBe(2);
    expect(result.failed).toEqual([]);
    expect(loader.getTexture("orchestrator-idle")).toBe(idle);
    expect(loader.getTexture("orchestrator-walk")).toBe(walk);
  });

  it("reports failures and returns null for missing textures", async () => {
    const idle = new MockTexture("worker-idle");
    MockAssets.reset({ "worker-idle": idle }, ["worker-walk"]);

    const loader = new AssetLoader("assets/agents/");
    const result = await loader.loadAll(["worker-idle", "worker-walk"]);

    expect(result.loaded).toBe(1);
    expect(result.total).toBe(2);
    expect(result.failed).toContain("worker-walk");
    expect(loader.getTexture("worker-idle")).toBe(idle);
    expect(loader.getTexture("worker-walk")).toBeNull();
  });

  it("returns null for textures requested before loading", () => {
    const loader = new AssetLoader("");
    expect(loader.getTexture("anything")).toBeNull();
  });

  it("splits a horizontal walk strip into animation frames", async () => {
    const strip = new MockTexture("worker-walk");
    strip.width = 64;
    strip.height = 32;
    MockAssets.reset({ "worker-walk": strip });

    const loader = new AssetLoader();
    await loader.loadAll(["agents/worker-walk"]);

    const frames = loader.getAnimationFrames("worker-walk", 2);
    expect(frames).not.toBeNull();
    expect(frames!.length).toBe(2);
  });

  it("returns null animation frames for a missing strip", () => {
    const loader = new AssetLoader();
    expect(loader.getAnimationFrames("missing-walk", 2)).toBeNull();
  });

  it("loads the V1 asset list by default", async () => {
    const textures: Record<string, MockTexture> = {};
    const names = [
      "orchestrator-idle",
      "orchestrator-walk",
      "orchestrator-working",
      "orchestrator-blocked",
      "worker-idle",
      "worker-walk",
      "worker-working",
      "worker-blocked",
      "reviewer-idle",
      "reviewer-walk",
      "reviewer-working",
      "reviewer-blocked",
      "floor-command",
      "floor-execution",
      "floor-review",
      "floor-approval",
      "desk-shared",
      "workbench",
      "review-table",
      "approval-counter",
      "service-bell",
      "sparkle",
      "blocked-marker",
    ];
    for (const name of names) {
      textures[name] = new MockTexture(name);
    }
    MockAssets.reset(textures);

    const loader = new AssetLoader();
    const result = await loader.loadAll();

    expect(result.total).toBe(names.length);
    expect(result.loaded).toBe(names.length);
    expect(result.failed).toEqual([]);
  });
});
