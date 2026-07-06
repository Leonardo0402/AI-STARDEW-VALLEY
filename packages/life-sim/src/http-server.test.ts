import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { tmpdir } from "node:os";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import { RuntimeSession, SnapshotStore, CommandGateway } from "@agent-office/core";
import { CommandType, type OfficeCommand } from "@agent-office/protocol";
import { createLifeSimServer, startLifeSimServerFromCli, parseCliArgs } from "./http-server.js";
import { FileLifeSimStore } from "./store.js";
import type { LifeSimCommand, LifeSimEngineConfig } from "./types.js";

const MOCK_RUNTIME_ID = "mock-runtime-001";

const config: LifeSimEngineConfig = {
  worldId: "server-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
};

function fixedNow() {
  return "2026-07-05T08:00:00Z";
}

function makeCommand(type: string, payload: unknown): LifeSimCommand {
  return {
    commandId: `cmd-${type}-${JSON.stringify(payload)}`,
    commandType: type,
    timestamp: fixedNow(),
    source: "user",
    actorId: "operator",
    worldId: config.worldId,
    payload,
  };
}

function makeOfficeCommand(
  commandId: string,
  type: string,
  payload: unknown,
  targetId: string | null = null
): OfficeCommand {
  return {
    commandId,
    commandType: type,
    timestamp: fixedNow(),
    source: "user",
    actorId: "operator",
    runtimeId: MOCK_RUNTIME_ID,
    targetId,
    payload,
  };
}

function getJson(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: data ? (JSON.parse(data) as unknown) : null });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
  });
}

function postJson(url: string, body: unknown): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      url,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: data ? (JSON.parse(data) as unknown) : null });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((r) => r());
  }
}

describe("createLifeSimServer", () => {
  let server: Awaited<ReturnType<typeof createLifeSimServer>>;

  afterEach(async () => {
    await server.stop();
  });

  it("returns start, stop, and getBaseUrl methods", async () => {
    server = await createLifeSimServer(config, { port: 0 });
    expect(typeof server.start).toBe("function");
    expect(typeof server.stop).toBe("function");
    expect(typeof server.getBaseUrl).toBe("function");
  });

  it("starts a server and exposes a base URL", async () => {
    server = await createLifeSimServer(config, { port: 0 });
    await server.start();
    const baseUrl = server.getBaseUrl();
    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const { status, body } = await getJson(`${baseUrl}/life-sim/${config.worldId}/snapshot`);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      worldId: config.worldId,
      snapshot: expect.objectContaining({ worldId: config.worldId }),
      eventLogTail: [],
    });
  });

  it("executes commands over HTTP", async () => {
    server = await createLifeSimServer(config, { port: 0 });
    await server.start();
    const baseUrl = server.getBaseUrl();
    const command = makeCommand("world.start_day", {});
    const { status, body } = await postJson(`${baseUrl}/life-sim/${config.worldId}/command`, command);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      commandId: command.commandId,
      status: "accepted",
      events: expect.arrayContaining([expect.objectContaining({ type: "world.day_started" })]),
    });
  });

  it("stops accepting requests after stop()", async () => {
    server = await createLifeSimServer(config, { port: 0 });
    await server.start();
    await server.stop();
    await expect(getJson(`${server.getBaseUrl()}/life-sim/${config.worldId}/snapshot`)).rejects.toThrow();
  });

  it("uses an in-memory store by default", async () => {
    server = await createLifeSimServer(config, { port: 0 });
    await server.start();
    const baseUrl = server.getBaseUrl();
    const { body } = await getJson(`${baseUrl}/life-sim/${config.worldId}/snapshot`);
    const snapshot = (body as { snapshot: { checkpointLifeSimSequence: number } }).snapshot;
    expect(snapshot.checkpointLifeSimSequence).toBe(0);
  });
});

describe("createLifeSimServer with runtimeSession", () => {
  let adapter: MockRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;
  let server: Awaited<ReturnType<typeof createLifeSimServer>>;

  beforeEach(async () => {
    adapter = new MockRuntimeAdapter({ eventDelayMs: 0 });
    store = new SnapshotStore(MOCK_RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);
  });

  afterEach(async () => {
    await server.stop();
    await session.disconnect();
  });

  it("connects RuntimeLifeSimBridge and forwards applied runtime events", async () => {
    server = await createLifeSimServer(config, { port: 0, runtimeSession: session });
    await server.start();
    await session.connect();

    const baseUrl = server.getBaseUrl();
    await postJson(`${baseUrl}/life-sim/${config.worldId}/command`, makeCommand("world.start_day", {}));
    await postJson(`${baseUrl}/life-sim/${config.worldId}/command`, makeCommand("world.advance_time", { minutes: 60 }));

    const createResult = await gateway.execute(
      makeOfficeCommand("cmd-create-1", CommandType.TASK_CREATE, {
        title: "Bridge task",
        description: "Assigned through the bridge",
      })
    );
    expect(createResult.status).toBe("accepted");

    const runtimeSnapshot = store.getSnapshot();
    const workerId = runtimeSnapshot.agents.find((a) => a.role === "worker")!.agentId;
    const taskId = runtimeSnapshot.tasks[0].taskId;

    const beforeSequence = (await getJson(`${baseUrl}/life-sim/${config.worldId}/snapshot`)).body as {
      snapshot: { lastObservedRuntimeSequence: number };
    };

    const assignResult = await gateway.execute(
      makeOfficeCommand("cmd-assign-1", CommandType.TASK_ASSIGN, { taskId, agentId: workerId }, taskId)
    );
    expect(assignResult.status).toBe("accepted");

    await flushPromises();

    const { body } = await getJson(`${baseUrl}/life-sim/${config.worldId}/snapshot`);
    const snapshot = (body as { snapshot: { activeOverlays: { createdByTaskId: string }[]; lastObservedRuntimeSequence: number; lastAppliedRuntimeSequence: number } }).snapshot;
    expect(snapshot.activeOverlays.some((o) => o.createdByTaskId === taskId)).toBe(true);
    expect(snapshot.lastObservedRuntimeSequence).toBeGreaterThan(beforeSequence.snapshot.lastObservedRuntimeSequence);
    expect(snapshot.lastAppliedRuntimeSequence).toBeGreaterThan(beforeSequence.snapshot.lastObservedRuntimeSequence);
  });
});

describe("createLifeSimServer with dataDir", () => {
  let dataDir: string;
  let server: Awaited<ReturnType<typeof createLifeSimServer>>;

  beforeEach(async () => {
    dataDir = join(tmpdir(), `life-sim-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(dataDir, { recursive: true });
  });

  afterEach(async () => {
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("persists snapshot to disk via FileLifeSimStore", async () => {
    server = await createLifeSimServer(config, { port: 0, dataDir });
    await server.start();
    const baseUrl = server.getBaseUrl();
    const command = makeCommand("world.start_day", {});
    await postJson(`${baseUrl}/life-sim/${config.worldId}/command`, command);

    const store = new FileLifeSimStore(config.worldId, dataDir);
    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.snapshot.worldClock.status).toBe("running");
  });
});

describe("parseCliArgs", () => {
  it("parses --port and --data-dir", () => {
    const args = ["--port", "3457", "--data-dir", "./data/life-sim"];
    expect(parseCliArgs(args)).toEqual({ port: 3457, dataDir: "./data/life-sim" });
  });

  it("parses --port=3457 and --data-dir=./data/life-sim", () => {
    const args = ["--port=3457", "--data-dir=./data/life-sim"];
    expect(parseCliArgs(args)).toEqual({ port: 3457, dataDir: "./data/life-sim" });
  });

  it("defaults port to 3457", () => {
    expect(parseCliArgs([])).toEqual({ port: 3457 });
  });

  it("rejects non-numeric port", () => {
    expect(() => parseCliArgs(["--port=abc"])).toThrow();
  });
});

describe("startLifeSimServerFromCli", () => {
  let server: Awaited<ReturnType<typeof startLifeSimServerFromCli>>;

  afterEach(async () => {
    await server.stop();
  });

  it("starts a server from CLI arguments", async () => {
    server = await startLifeSimServerFromCli(["--port=0"], config);
    const baseUrl = server.getBaseUrl();
    const { status, body } = await getJson(`${baseUrl}/life-sim/${config.worldId}/snapshot`);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      worldId: config.worldId,
      snapshot: expect.objectContaining({ worldId: config.worldId }),
    });
  });
});
