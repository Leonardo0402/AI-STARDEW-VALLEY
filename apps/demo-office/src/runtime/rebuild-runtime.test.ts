import { describe, it, expect, vi } from "vitest";
import { createRuntime } from "./create-runtime.js";
import { rebuildRuntime } from "./rebuild-runtime.js";
import type { RuntimeComposition, DemoRuntimeConfig } from "./types.js";

vi.mock("./create-runtime.js", () => ({
  createRuntime: vi.fn(),
}));

function makeComposition(overrides: unknown = {}): RuntimeComposition {
  return {
    adapter: { id: "adapter" },
    store: { id: "store" },
    gateway: { id: "gateway" },
    session: {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
    dispose: vi.fn().mockResolvedValue(undefined),
    ...(overrides as object),
  } as unknown as RuntimeComposition;
}

const config: DemoRuntimeConfig = {
  mode: "mock",
  runtimeId: "runtime-001",
};

describe("rebuildRuntime", () => {
  it("disposes the existing composition, creates a new one, connects it, renders it, and returns it", async () => {
    const current = makeComposition();
    const next = makeComposition({ session: { connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn().mockResolvedValue(undefined) } });
    (createRuntime as ReturnType<typeof vi.fn>).mockReturnValue(next);

    const renderApp = vi.fn();

    const result = await rebuildRuntime(config, current, renderApp);

    expect(current.dispose).toHaveBeenCalledOnce();
    expect(createRuntime).toHaveBeenCalledWith(config);
    expect(next.session.connect).toHaveBeenCalledOnce();
    expect(renderApp).toHaveBeenCalledWith(next);
    expect(result).toBe(next);
  });

  it("propagates connect errors and leaves rendering to the caller", async () => {
    const current = makeComposition();
    const next = makeComposition({
      session: {
        connect: vi.fn().mockRejectedValue(new Error("connect failed")),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
    });
    (createRuntime as ReturnType<typeof vi.fn>).mockReturnValue(next);

    const renderApp = vi.fn();

    await expect(rebuildRuntime(config, current, renderApp)).rejects.toThrow("connect failed");
    expect(current.dispose).toHaveBeenCalledOnce();
    expect(renderApp).not.toHaveBeenCalled();
  });
});
