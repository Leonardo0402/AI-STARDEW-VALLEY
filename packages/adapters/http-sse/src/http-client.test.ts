import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpGet } from "./http-client.js";
import { fetchSnapshot } from "./snapshot-client.js";
import { fetchCapabilities } from "./capabilities-client.js";
import type { RuntimeStreamError } from "@agent-office/protocol";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  if (response instanceof Error) {
    fn.mockRejectedValue(response);
  } else {
    fn.mockResolvedValue(response);
  }
  return fn;
}

beforeEach(() => {
  globalThis.fetch = mockFetch(new Response('{"ok":true}', { status: 200 })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("httpGet", () => {
  it("returns 200 body as parsed JSON", async () => {
    const r = await httpGet("https://example.com/test");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual({ ok: true });
  });

  it("returns ok:false with status on 4xx", async () => {
    globalThis.fetch = mockFetch(new Response("nope", { status: 404 })) as unknown as typeof fetch;
    const r = await httpGet("https://example.com/missing");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("returns ok:false with status on 5xx", async () => {
    globalThis.fetch = mockFetch(new Response("err", { status: 500 })) as unknown as typeof fetch;
    const r = await httpGet("https://example.com/err");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(500);
  });

  it("rejects with NETWORK_ERROR on fetch throw", async () => {
    globalThis.fetch = mockFetch(new TypeError("failed to fetch")) as unknown as typeof fetch;
    await expect(httpGet("https://example.com/throw")).rejects.toMatchObject({
      code: "http_error",
    });
  });

  it("rejects with TIMEOUT when signal aborts due to timeout", async () => {
    // Use a real AbortController that aborts immediately
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 0);
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err: RuntimeStreamError = {
            code: "http_error",
            message: "TIMEOUT",
            recoverable: true,
          };
          reject(err);
        });
      });
    }) as unknown as typeof fetch;
    await expect(
      httpGet("https://example.com/slow", { signal: ac.signal, timeoutMs: 10 })
    ).rejects.toMatchObject({ code: "http_error" });
  });
});

describe("fetchSnapshot", () => {
  it("returns validated snapshot on 200", async () => {
    const snap = {
      runtimeId: "rt-1",
      snapshotId: "s1",
      sequence: 5,
      schemaVersion: "1.0",
      createdAt: "2026-07-04T00:00:00.000Z",
      lastEventId: "",
      agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
    };
    globalThis.fetch = mockFetch(new Response(JSON.stringify(snap), { status: 200 })) as unknown as typeof fetch;
    const r = await fetchSnapshot("https://example.com/snap", "rt-1", {});
    expect(r.sequence).toBe(5);
  });

  it("rejects with snapshot_invalid on runtimeId mismatch", async () => {
    const snap = { ...makeValidSnap(), runtimeId: "other" };
    globalThis.fetch = mockFetch(new Response(JSON.stringify(snap), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchSnapshot("https://example.com/snap", "rt-1", {})).rejects.toMatchObject({
      code: "snapshot_invalid",
    });
  });

  it("rejects with http_error on 500", async () => {
    globalThis.fetch = mockFetch(new Response("err", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchSnapshot("https://example.com/snap", "rt-1", {})).rejects.toMatchObject({
      code: "http_error",
    });
  });

  it("rejects with snapshot_invalid on malformed JSON", async () => {
    globalThis.fetch = mockFetch(new Response("not json", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchSnapshot("https://example.com/snap", "rt-1", {})).rejects.toMatchObject({
      code: "snapshot_invalid",
    });
  });
});

describe("fetchCapabilities", () => {
  it("returns validated capabilities on 200", async () => {
    const caps = {
      supportedEvents: ["task.created"],
      supportedCommands: ["task.create"],
      features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false },
    };
    globalThis.fetch = mockFetch(new Response(JSON.stringify(caps), { status: 200 })) as unknown as typeof fetch;
    const r = await fetchCapabilities("https://example.com/caps", {});
    expect(r.features.sse).toBe(true);
  });

  it("returns fallback when configured and endpoint 404s", async () => {
    globalThis.fetch = mockFetch(new Response("", { status: 404 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    const r = await fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback });
    expect(r.features.sse).toBe(true);
  });

  it("returns fallback when configured and endpoint returns 501", async () => {
    globalThis.fetch = mockFetch(new Response("", { status: 501 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    const r = await fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback });
    expect(r.features.sse).toBe(true);
  });

  // === Revised per Plan Review: fallback must NOT mask non-404/501 errors ===

  it("rejects with http_error on 500 even when fallback configured", async () => {
    globalThis.fetch = mockFetch(new Response("server err", { status: 500 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    await expect(fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback })).rejects.toMatchObject({
      code: "http_error", status: 500,
    });
  });

  it("rejects with authentication_failed on 401 even when fallback configured", async () => {
    globalThis.fetch = mockFetch(new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    await expect(fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback })).rejects.toMatchObject({
      code: "authentication_failed", status: 401,
    });
  });

  it("rejects with http_error on network failure even when fallback configured", async () => {
    globalThis.fetch = mockFetch(new TypeError("failed to fetch")) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    await expect(fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback })).rejects.toMatchObject({
      code: "http_error",
    });
  });

  it("rejects with capabilities_invalid on malformed body even when fallback configured", async () => {
    globalThis.fetch = mockFetch(new Response("garbage", { status: 200 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    await expect(fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback })).rejects.toMatchObject({
      code: "capabilities_invalid",
    });
  });

  it("rejects with capabilities_invalid on malformed body and no fallback", async () => {
    globalThis.fetch = mockFetch(new Response("garbage", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchCapabilities("https://example.com/caps", {})).rejects.toMatchObject({
      code: "capabilities_invalid",
    });
  });
});

function makeValidSnap() {
  return {
    runtimeId: "rt-1",
    snapshotId: "s1",
    sequence: 0,
    schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z",
    lastEventId: "",
    agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
  };
}
