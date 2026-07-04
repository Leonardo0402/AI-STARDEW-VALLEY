import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { postCommand } from "./command-client.js";
import type { OfficeCommand } from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  if (response instanceof Error) fn.mockRejectedValue(response);
  else fn.mockResolvedValue(response);
  return fn;
}

function makeCommand(): OfficeCommand {
  return {
    commandId: "cmd-1",
    commandType: CommandType.TASK_CREATE,
    timestamp: "2026-07-04T00:00:00.000Z",
    source: "user",
    actorId: "user-1",
    runtimeId: "rt-1",
    targetId: null,
    payload: { title: "t", description: "d", priority: "normal", parentTaskId: null },
  };
}

beforeEach(() => {
  globalThis.fetch = mockFetch(
    new Response(JSON.stringify({ commandId: "cmd-1", status: "accepted", affectedEventIds: ["e1"] }), { status: 200, headers: { "content-type": "application/json" } })
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("postCommand", () => {
  it("sends Idempotency-Key header equal to commandId", async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Response(JSON.stringify({ commandId: "cmd-1", status: "accepted", affectedEventIds: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;
    await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(fetchSpy).toHaveBeenCalled();
    const init = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Idempotency-Key")).toBe("cmd-1");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns validated CommandResult on 200", async () => {
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("accepted");
    expect(r.commandId).toBe("cmd-1");
  });

  it("returns error CommandResult on 500 (no retry)", async () => {
    globalThis.fetch = mockFetch(new Response("err", { status: 500 })) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("error");
    expect(r.error?.code).toContain("500");
  });

  it("returns error CommandResult on network failure (no retry)", async () => {
    globalThis.fetch = mockFetch(new TypeError("network")) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("NETWORK_ERROR");
  });

  it("returns error CommandResult on timeout", async () => {
    // Use a fetch that never resolves; abort via short timeout
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 5);
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), { timeoutMs: 5 });
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("TIMEOUT");
  }, 5000);

  it("returns error CommandResult on malformed response body", async () => {
    globalThis.fetch = mockFetch(new Response("not json", { status: 200 })) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("COMMAND_RESPONSE_INVALID");
  });

  it("returns error CommandResult on commandId mismatch", async () => {
    globalThis.fetch = mockFetch(
      new Response(JSON.stringify({ commandId: "other", status: "accepted", affectedEventIds: [] }), { status: 200 })
    ) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("COMMAND_RESPONSE_INVALID");
  });
});
