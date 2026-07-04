import { describe, it, expect, afterEach } from "vitest";
import { QclawTestRuntime } from "./qclaw-runtime.js";

describe("QclawTestRuntime skeleton", () => {
  let runtime: QclawTestRuntime;

  afterEach(async () => {
    if (runtime) await runtime.stop();
  });

  it("starts and responds to GET /runtime/snapshot with 200 JSON", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    const body = await res.json();
    expect(body.runtimeId).toBe("qclaw-swarm-runtime-001");
    expect(body.sequence).toBe(0);
  });

  it("responds to GET /runtime/capabilities with 200 JSON", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/capabilities`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.features.sse).toBe(true);
    expect(body.features.websocket).toBe(false);
  });

  it("returns 404 for unknown paths", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/unknown`);
    expect(res.status).toBe(404);
  });

  it("stop() closes the server", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const baseUrl = runtime.getBaseUrl();
    await runtime.stop();
    await expect(fetch(`${baseUrl}/runtime/snapshot`)).rejects.toThrow();
    runtime = undefined as any;
  });
});
