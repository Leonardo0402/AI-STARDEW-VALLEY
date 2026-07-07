// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { createRoot } from "react-dom/client";
import { readConfigFromEnv, ConfigError } from "./runtime/config.js";
import { createRuntime } from "./runtime/create-runtime.js";

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn().mockImplementation(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

vi.mock("./runtime/config.js", () => ({
  readConfigFromEnv: vi.fn(),
  ConfigError: class ConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ConfigError";
    }
  },
}));

vi.mock("./runtime/create-runtime.js", () => ({
  createRuntime: vi.fn(),
}));

vi.mock("./runtime/rebuild-runtime.js", () => ({
  rebuildRuntime: vi.fn(),
}));

vi.mock("./App.js", () => ({
  App: () => <div data-testid="app">App</div>,
}));

vi.mock("./DemoControls.js", () => ({
  DemoControls: () => <div data-testid="demo-controls">DemoControls</div>,
}));

vi.mock("@agent-office/control-ui/life-sim", () => ({
  HttpLifeSimClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  })),
  LifeSimSession: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    execute: vi.fn().mockResolvedValue({ status: "accepted" }),
    projection: {
      currentDay: 1,
      currentTime: "08:00",
      isRunning: false,
      isEndOfDay: false,
      summary: null,
    },
  })),
}));

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    document.body.innerHTML = '<div id="root"></div>';
  });

  it("creates the React root only once when configuration fails", async () => {
    (readConfigFromEnv as Mock).mockImplementation(() => {
      throw new ConfigError("VITE_RUNTIME_ID missing");
    });

    await import("./main.js");
    await flushPromises();

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).toHaveBeenCalledWith(document.getElementById("root"));
  });

  it("creates the React root only once during a successful bootstrap", async () => {
    const mockComposition = {
      adapter: {
        getCapabilities: vi.fn().mockReturnValue({
          supportedCommands: [],
          supportedEvents: [],
          features: {},
        }),
      },
      store: {},
      gateway: {},
      session: {
        connect: vi.fn().mockResolvedValue(undefined),
      },
      dispose: vi.fn(),
    };

    (readConfigFromEnv as Mock).mockReturnValue({
      mode: "mock",
      runtimeId: "mock-runtime-001",
      lifeSimBaseUrl: "/life-sim",
    });
    (createRuntime as Mock).mockReturnValue(mockComposition);

    await import("./main.js");
    await flushPromises();

    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).toHaveBeenCalledWith(document.getElementById("root"));
    expect(mockComposition.session.connect).toHaveBeenCalled();
  });
});
