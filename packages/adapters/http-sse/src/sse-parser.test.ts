import { describe, it, expect } from "vitest";
import { createSseParser } from "./sse-parser.js";

function capture() {
  const events: Array<{ event?: string; id?: string; data: string }> = [];
  const comments: string[] = [];
  const errors: Error[] = [];
  const parser = createSseParser({
    onEvent: (eventType, id, data) => events.push({ event: eventType, id, data }),
    onComment: (text) => comments.push(text),
    onError: (err) => errors.push(err),
  });
  return { parser, events, comments, errors };
}

describe("SSE parser", () => {
  it("parses a single complete frame in one chunk", () => {
    const c = capture();
    c.parser.feed("event: domain-event\ndata: {\"seq\":1}\n\n");
    expect(c.events).toHaveLength(1);
    expect(c.events[0].event).toBe("domain-event");
    expect(c.events[0].data).toBe('{"seq":1}');
  });

  it("parses a frame fragmented across 3 chunks", () => {
    const c = capture();
    c.parser.feed("event: domain-e");
    c.parser.feed("vent\ndata: {\"seq\"");
    c.parser.feed(":1}\n\n");
    expect(c.events).toHaveLength(1);
    expect(c.events[0].event).toBe("domain-event");
    expect(c.events[0].data).toBe('{"seq":1}');
  });

  it("parses 3 frames in one chunk", () => {
    const c = capture();
    c.parser.feed("data: a\n\ndata: b\n\ndata: c\n\n");
    expect(c.events).toHaveLength(3);
    expect(c.events.map((e) => e.data)).toEqual(["a", "b", "c"]);
  });

  it("handles LF-only line endings", () => {
    const c = capture();
    c.parser.feed("data: x\n\n");
    expect(c.events).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const c = capture();
    c.parser.feed("data: x\r\n\r\n");
    expect(c.events).toHaveLength(1);
  });

  it("joins multi-line data fields with \\n", () => {
    const c = capture();
    c.parser.feed("data: line1\ndata: line2\n\n");
    expect(c.events[0].data).toBe("line1\nline2");
  });

  it("captures id field", () => {
    const c = capture();
    c.parser.feed("id: 42\ndata: x\n\n");
    expect(c.events[0].id).toBe("42");
  });

  it("captures event field", () => {
    const c = capture();
    c.parser.feed("event: reset-required\ndata: {}\n\n");
    expect(c.events[0].event).toBe("reset-required");
  });

  it("treats comment lines (starting with :) as comments, not events", () => {
    const c = capture();
    c.parser.feed(": heartbeat\n\n");
    expect(c.events).toHaveLength(0);
    expect(c.comments).toHaveLength(1);
    expect(c.comments[0]).toBe("heartbeat");
  });

  it("drops incomplete final frame on finish()", () => {
    const c = capture();
    c.parser.feed("data: partial");
    c.parser.finish();
    expect(c.events).toHaveLength(0);
  });

  it("continues parsing after a malformed frame", () => {
    const c = capture();
    c.parser.feed("garbage:not-a-field\n\ndata: ok\n\n");
    // Per Plan Review Fix 11: unknown fields are silently ignored (not fatal).
    // `garbage` is an unknown field, so no error is reported; parsing continues.
    expect(c.errors).toHaveLength(0);
    expect(c.events).toHaveLength(1);
    expect(c.events[0].data).toBe("ok");
  });

  it("handles empty data field", () => {
    const c = capture();
    c.parser.feed("data:\n\n");
    expect(c.events).toHaveLength(1);
    expect(c.events[0].data).toBe("");
  });

  it("handles UTF-8 emoji in data (already decoded to string)", () => {
    const c = capture();
    c.parser.feed("data: 🎉\n\n");
    expect(c.events[0].data).toBe("🎉");
  });

  it("resets event type after dispatching (next frame has no event unless set)", () => {
    const c = capture();
    c.parser.feed("event: domain-event\ndata: a\n\ndata: b\n\n");
    expect(c.events[0].event).toBe("domain-event");
    expect(c.events[1].event).toBeUndefined();
  });

  it("ignores retry field (per spec, but does not error)", () => {
    const c = capture();
    c.parser.feed("retry: 5000\ndata: x\n\n");
    expect(c.events).toHaveLength(1);
    expect(c.errors).toHaveLength(0);
  });
});
