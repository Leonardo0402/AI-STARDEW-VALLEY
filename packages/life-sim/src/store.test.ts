import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEmptySnapshot, FileLifeSimStore, InMemoryLifeSimStore } from "./store.js";
import type { LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "store-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
};

describe("InMemoryLifeSimStore", () => {
  it("returns null before first save", async () => {
    const store = new InMemoryLifeSimStore();
    expect(await store.load()).toBeNull();
  });

  it("round-trips snapshot and command results", async () => {
    const store = new InMemoryLifeSimStore();
    const snapshot = createEmptySnapshot(config, "2026-07-05T00:00:00Z");
    const results = new Map([
      [
        "cmd-1",
        {
          commandId: "cmd-1",
          status: "accepted" as const,
          lifeSimSequence: null,
          events: [],
          error: null,
        },
      ],
    ]);
    await store.save(snapshot, [], results);
    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.snapshot.worldClock.status).toBe("not_started");
    expect(loaded!.commandResults.get("cmd-1")?.status).toBe("accepted");
  });
});

describe("FileLifeSimStore", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "life-sim-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("returns null when file does not exist", async () => {
    const store = new FileLifeSimStore("missing", dataDir);
    expect(await store.load()).toBeNull();
  });

  it("round-trips through disk", async () => {
    const store = new FileLifeSimStore("disk-test", dataDir);
    const snapshot = createEmptySnapshot({ ...config, worldId: "disk-test" }, "2026-07-05T00:00:00Z");
    await store.save(snapshot, [], new Map());
    const loaded = await store.load();
    expect(loaded!.snapshot.worldId).toBe("disk-test");
    expect(loaded!.snapshot.checkpointLifeSimSequence).toBe(0);
  });
});
