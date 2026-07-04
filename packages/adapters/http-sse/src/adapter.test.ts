import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpSseRuntimeAdapter } from "./adapter.js";
import type { RuntimeSnapshot, DomainEvent } from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";

const RUNTIME_ID = "rt-adapter-test";
const BASE_URL = "https://example.com";

function makeSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID, snapshotId: `snap-${seq}`, sequence: seq, schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z", lastEventId: "",
    agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
  };
}

function makeEvent(seq: number): DomainEvent {
  return {
    eventId: `evt-${seq}`, runtimeId: RUNTIME_ID, sequence: seq, schemaVersion: "1.0",
    type: EventType.TASK_CREATED, occurredAt: "2026-07-04T00:00:00.000Z",
    receivedAt: "2026-07-04T00:00:00.000Z", correlationId: `c-${seq}`,
    causationId: null, traceId: `t-${seq}`, payload: {},
  };
}

function sseFrame(event: DomainEvent): string {
  return `event: domain-event\nid: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`;
}

function replayCompleteFrame(lastSequence: number): string {
  return `event: replay-complete\nid: ${lastSequence}\ndata: {"lastSequence":${lastSequence}}\n\n`;
}

const CAPS_BODY = JSON.stringify({
  supportedEvents: [], supportedCommands: [],
  features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false },
});

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("HttpSseRuntimeAdapter", () => {
  it("connect fetches capabilities (no snapshot cache — getSnapshot fetches fresh)", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200, headers: { "content-type": "application/json" } });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(5)), { status: 200, headers: { "content-type": "application/json" } });
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const snap = await adapter.getSnapshot();
    expect(snap.runtimeId).toBe(RUNTIME_ID);
    const caps = adapter.getCapabilities();
    expect(caps.features.sse).toBe(true);
  });

  it("subscribe ready resolves after replay-complete with empty replay", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(replayCompleteFrame(0)));
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await sub.ready;
    await expect(sub.ready).resolves.toBeUndefined();
    await sub.close();
  });

  it("subscribe delivers replay events then resolves ready on replay-complete", async () => {
    const ev1 = makeEvent(1);
    const ev2 = makeEvent(2);
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseFrame(ev1) + sseFrame(ev2) + replayCompleteFrame(2)));
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const received: DomainEvent[] = [];
    const sub = adapter.subscribe({ onEvent: (e) => received.push(e) }, { afterSequence: 0 });
    await sub.ready;
    expect(received.map((e) => e.sequence)).toEqual([1, 2]);
    await sub.close();
  });

  it("subscribe ready rejects when stream closes before replay-complete (reader.done is NOT a replay boundary)", async () => {
    const ev1 = makeEvent(1);
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseFrame(ev1)));
            controller.close(); // close WITHOUT replay-complete → protocol violation
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "stream_protocol_error" });
  });

  it("subscribe ready rejects on replay gap", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            // first event seq=2 (gap: expected 1, got 2)
            controller.enqueue(new TextEncoder().encode(sseFrame(makeEvent(2))));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "event_log_trimmed" });
  });

  it("subscribe ready rejects on invalid event in replay (event_invalid, never silently dropped)", async () => {
    const ev = makeEvent(1);
    ev.runtimeId = "other-runtime"; // runtime mismatch → event_invalid
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseFrame(ev)));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "event_invalid" });
  });

  it("subscribe ready rejects on SSE id/sequence mismatch in replay", async () => {
    const ev = makeEvent(1);
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const frame = `event: domain-event\nid: 99\ndata: ${JSON.stringify(ev)}\n\n`; // id=99 but seq=1
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(frame));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "stream_protocol_error" });
  });

  it("subscribe ready rejects on replay-complete id/data mismatch", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        // id=2 but data.lastSequence=5 → mismatch
        const frame = `event: replay-complete\nid: 2\ndata: {"lastSequence":5}\n\n`;
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(frame));
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "stream_protocol_error" });
  });

  it("subscribe ready rejects on 401 stream open", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) return new Response("unauthorized", { status: 401 });
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "authentication_failed" });
  });

  it("close before ready rejects ready with aborted", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        // stream that never sends data — ready won't resolve
        const stream = new ReadableStream({ start() { /* never close */ } });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await sub.close();
    await expect(sub.ready).rejects.toMatchObject({ code: "aborted" });
  });

  it("LIVE invalid event: onError(event_invalid, recoverable=false) + onState(error), never silently dropped", async () => {
    const ev1 = makeEvent(1);
    const bad = makeEvent(2);
    bad.runtimeId = "other-runtime"; // invalid in live
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(
              sseFrame(ev1) + replayCompleteFrame(1) + sseFrame(bad)
            ));
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const errors: unknown[] = [];
    const states: string[] = [];
    const sub = adapter.subscribe({
      onEvent: () => {},
      onError: (e) => errors.push(e),
      onState: (s) => states.push(s),
    }, { afterSequence: 0 });
    await sub.ready;
    // give the live loop a tick to process the bad frame
    await new Promise((r) => setTimeout(r, 50));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "event_invalid", recoverable: false });
    expect(states).toContain("error");
    await sub.close();
  });

  it("LIVE stream close (reader.done) emits onError(http_error, recoverable=true) + onState(error)", async () => {
    const ev1 = makeEvent(1);
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseFrame(ev1) + replayCompleteFrame(1)));
            controller.close(); // server closes during live
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const errors: unknown[] = [];
    const states: string[] = [];
    const sub = adapter.subscribe({
      onEvent: () => {},
      onError: (e) => errors.push(e),
      onState: (s) => states.push(s),
    }, { afterSequence: 0 });
    await sub.ready;
    await new Promise((r) => setTimeout(r, 50));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "http_error", recoverable: true });
    expect(states).toContain("error");
  });

  it("getSnapshot() performs a fresh fetch on every call (no permanent cache)", async () => {
    let snapshotSeq = 5;
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) {
        const current = snapshotSeq;
        return new Response(JSON.stringify({ ...makeSnapshot(current), sequence: current }), {
          status: 200, headers: { "content-type": "application/json" }
        });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const snap1 = await adapter.getSnapshot();
    expect(snap1.sequence).toBe(5);
    snapshotSeq = 20; // server advances
    const snap2 = await adapter.getSnapshot();
    expect(snap2.sequence).toBe(20); // fresh fetch — NOT cached
  });

  it("disconnect() aborts in-flight stream open (lifecycleAbort)", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        // stream that never sends data — disconnect during this window
        const stream = new ReadableStream({ start() { /* never close */ } });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    // disconnect while subscription is OPENING/REPLAY (ready not yet resolved)
    await adapter.disconnect();
    await expect(sub.ready).rejects.toMatchObject({ code: "aborted" });
  });
});
