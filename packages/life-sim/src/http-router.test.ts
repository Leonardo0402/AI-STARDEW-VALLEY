import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { createLifeSimEngine } from "./engine.js";
import { createLifeSimRouter } from "./http-router.js";
import { InMemoryLifeSimStore } from "./store.js";
import type { LifeSimCommand, LifeSimEngine, LifeSimEngineConfig } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "world-test",
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

async function startServer(engine: LifeSimEngine): Promise<{ server: http.Server; baseUrl: string; close: () => Promise<void> }> {
  const router = createLifeSimRouter(engine);
  const server = http.createServer((req, res) => {
    void router.handle(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("unexpected server address");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    server,
    baseUrl,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        if ("closeAllConnections" in server && typeof server.closeAllConnections === "function") {
          server.closeAllConnections();
        }
      }),
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

function openSse(url: string): { response: Promise<http.IncomingMessage>; events: Array<{ id: string; data: unknown }>; abort: () => void } {
  const events: Array<{ id: string; data: unknown }> = [];
  let rawBuffer = "";
  const controller = new AbortController();
  const response = new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = http.get(url, { signal: controller.signal }, (res) => {
      resolve(res);
      res.on("data", (chunk: Buffer) => {
        rawBuffer += chunk.toString("utf-8");
        const messages = rawBuffer.split("\n\n");
        rawBuffer = messages.pop() ?? "";
        for (const message of messages) {
          const lines = message.split("\n");
          let id = "";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("id: ")) {
              id = line.slice(4);
            } else if (line.startsWith("data: ")) {
              data = line.slice(6);
            }
          }
          if (data) {
            events.push({ id, data: JSON.parse(data) as unknown });
          }
        }
      });
    });
    req.on("error", reject);
  });
  return {
    response,
    get events() {
      return events;
    },
    abort: () => controller.abort(),
  };
}

describe("life-sim HTTP router", () => {
  let engine: LifeSimEngine;
  let server: http.Server;
  let baseUrl: string;
  let closeServer: () => Promise<void>;

  beforeEach(async () => {
    engine = await createLifeSimEngine(config, { now: fixedNow, store: new InMemoryLifeSimStore() });
    const started = await startServer(engine);
    server = started.server;
    baseUrl = started.baseUrl;
    closeServer = started.close;
  });

  afterEach(async () => {
    await closeServer();
  });

  it("GET /snapshot returns the current snapshot response", async () => {
    const { status, body } = await getJson(`${baseUrl}/life-sim/${config.worldId}/snapshot`);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      worldId: config.worldId,
      schemaVersion: "1.0",
      snapshot: expect.objectContaining({ worldId: config.worldId }),
      eventLogTail: [],
    });
  });

  it("POST /command executes a command and returns the result", async () => {
    const command = makeCommand("world.start_day", {});
    const { status, body } = await postJson(`${baseUrl}/life-sim/${config.worldId}/command`, command);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      commandId: command.commandId,
      status: "accepted",
      events: expect.arrayContaining([expect.objectContaining({ type: "world.day_started" })]),
    });
  });

  it("repeating the same commandId returns the same result", async () => {
    const command = makeCommand("world.start_day", {});
    const first = await postJson(`${baseUrl}/life-sim/${config.worldId}/command`, command);
    const second = await postJson(`${baseUrl}/life-sim/${config.worldId}/command`, command);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual(second.body);
  });

  it("GET /events opens an SSE stream with replay and live events", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    await engine.execute(makeCommand("world.advance_time", { minutes: 10 }));

    const sse = openSse(`${baseUrl}/life-sim/${config.worldId}/events?afterLifeSimSequence=0`);
    const res = await sse.response;
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("text/event-stream");

    const liveCommand: LifeSimCommand = {
      ...makeCommand("world.advance_time", { minutes: 10 }),
      commandId: "cmd-live-advance",
    };
    await engine.execute(liveCommand);
    await new Promise((r) => setTimeout(r, 50));

    const types = sse.events.map((e) => (e.data as { type: string }).type);
    expect(types).toContain("world.day_started");
    expect(types).toContain("world.time_advanced");
    expect(sse.events.length).toBeGreaterThanOrEqual(3);

    sse.abort();
  });

  it("GET /events replays only events after afterLifeSimSequence", async () => {
    await engine.execute(makeCommand("world.start_day", {}));
    const snapshot = engine.getSnapshot();
    const checkpoint = snapshot.checkpointLifeSimSequence;
    await engine.execute(makeCommand("world.advance_time", { minutes: 10 }));
    await engine.execute(makeCommand("world.advance_time", { minutes: 10 }));

    const sse = openSse(`${baseUrl}/life-sim/${config.worldId}/events?afterLifeSimSequence=${checkpoint + 1}`);
    await sse.response;
    await new Promise((r) => setTimeout(r, 50));

    const sequences = sse.events.map((e) => (e.data as { lifeSimSequence: number }).lifeSimSequence);
    expect(Math.min(...sequences)).toBeGreaterThan(checkpoint + 1);

    sse.abort();
  });

  it("GET /events keeps the connection open when afterLifeSimSequence is ahead and streams live events", async () => {
    const sse = openSse(`${baseUrl}/life-sim/${config.worldId}/events?afterLifeSimSequence=9999`);
    const res = await sse.response;
    expect(res.statusCode).toBe(200);

    await engine.execute(makeCommand("world.start_day", {}));
    await new Promise((r) => setTimeout(r, 50));

    expect(sse.events.length).toBeGreaterThanOrEqual(1);

    sse.abort();
  });

  it("rejects requests with mismatched worldId with 404", async () => {
    const { status } = await getJson(`${baseUrl}/life-sim/wrong-world/snapshot`);
    expect(status).toBe(404);
  });

  it("rejects non-JSON command body with 400", async () => {
    const { status, body } = await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const payload = "not json";
      const req = http.request(
        `${baseUrl}/life-sim/${config.worldId}/command`,
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
    expect(status).toBe(400);
    expect(body).toMatchObject({ error: expect.any(String) });
  });

  it("returns 404 for unrecognized paths", async () => {
    const { status } = await getJson(`${baseUrl}/life-sim/${config.worldId}/unknown`);
    expect(status).toBe(404);
  });
});
