import { describe, it, expect } from "vitest";
import { resolveAuthHeaders, sanitizeHeadersForLog, sanitizeErrorMessage } from "./auth.js";

describe("resolveAuthHeaders", () => {
  it("returns object headers as-is (shallow copy)", async () => {
    const h = { Authorization: "Bearer abc", "X-Custom": "x" };
    const r = await resolveAuthHeaders(h);
    expect(r).toEqual(h);
    expect(r).not.toBe(h); // different reference
  });

  it("awaits function provider", async () => {
    const provider = async () => ({ Authorization: "Bearer dynamic" });
    const r = await resolveAuthHeaders(provider);
    expect(r.Authorization).toBe("Bearer dynamic");
  });

  it("returns empty object for undefined", async () => {
    const r = await resolveAuthHeaders(undefined);
    expect(r).toEqual({});
  });

  it("propagates provider errors", async () => {
    const provider = async () => { throw new Error("token endpoint down"); };
    await expect(resolveAuthHeaders(provider)).rejects.toThrow("token endpoint down");
  });
});

describe("sanitizeHeadersForLog", () => {
  it("redacts Authorization header", () => {
    const r = sanitizeHeadersForLog({ Authorization: "Bearer secret-token-123" });
    expect(r.Authorization).toBe("<redacted>");
  });

  it("redacts Cookie header", () => {
    const r = sanitizeHeadersForLog({ Cookie: "session=abc123" });
    expect(r.Cookie).toBe("<redacted>");
  });

  it("preserves non-sensitive headers", () => {
    const r = sanitizeHeadersForLog({ "Content-Type": "application/json", "X-Request-Id": "abc" });
    expect(r["Content-Type"]).toBe("application/json");
    expect(r["X-Request-Id"]).toBe("abc");
  });

  it("handles case-insensitive Authorization", () => {
    const r = sanitizeHeadersForLog({ authorization: "Bearer x" });
    expect(r.authorization).toBe("<redacted>");
  });
});

describe("sanitizeErrorMessage", () => {
  it("removes token from message", () => {
    const msg = `Request failed with token=secret-token-123`;
    const r = sanitizeErrorMessage(msg, "secret-token-123");
    expect(r).not.toContain("secret-token-123");
  });

  it("returns message unchanged if secret not present", () => {
    const r = sanitizeErrorMessage("plain error", "secret-token-123");
    expect(r).toBe("plain error");
  });
});

describe("HttpSseRuntimeAdapter token safety", () => {
  // Plan Review Fix 12, v3: connect() now fetches Capabilities only (NOT Snapshot).
  // The test name is about the *snapshot fetch* error message, so call getSnapshot()
  // directly — no connect() needed (getSnapshot performs its own fresh HTTP fetch
  // and does not require cached capabilities).
  it("auth header does not appear in snapshot fetch error message", async () => {
    const { HttpSseRuntimeAdapter } = await import("./adapter.js");
    const adapter = new HttpSseRuntimeAdapter({
      runtimeId: "rt-1",
      baseUrl: "https://example.com",
      headers: { Authorization: "Bearer secret-token-XYZ" },
    });
    // Force a 500 error on snapshot fetch (no connect() — see Fix 12 above).
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response("err", { status: 500 }))) as unknown as typeof fetch;
    try {
      await adapter.getSnapshot();
      expect.fail("getSnapshot should have thrown");
    } catch (err) {
      const e = err as { message?: string };
      expect(e.message).not.toContain("secret-token-XYZ");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Plan Review Fix 12, v3: companion test — connect() now fetches Capabilities,
  // so the same secret-safety guarantee must hold for the capabilities fetch path.
  it("auth header does not appear in capabilities fetch error message", async () => {
    const { HttpSseRuntimeAdapter } = await import("./adapter.js");
    const adapter = new HttpSseRuntimeAdapter({
      runtimeId: "rt-1",
      baseUrl: "https://example.com",
      headers: { Authorization: "Bearer secret-token-XYZ" },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response("err", { status: 500 }))) as unknown as typeof fetch;
    try {
      await adapter.connect();
      expect.fail("connect should have thrown");
    } catch (err) {
      const e = err as { message?: string };
      expect(e.message).not.toContain("secret-token-XYZ");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
