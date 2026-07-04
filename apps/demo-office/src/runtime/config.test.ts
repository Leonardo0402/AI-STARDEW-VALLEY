import { describe, it, expect } from "vitest";
import { readConfigFromEnv } from "./config.js";

describe("readConfigFromEnv", () => {
  it("valid mock config returns DemoRuntimeConfig with mode=mock", () => {
    const config = readConfigFromEnv({
      VITE_RUNTIME_MODE: "mock",
      VITE_RUNTIME_ID: "mock-runtime-001",
    });
    expect(config.mode).toBe("mock");
    expect(config.runtimeId).toBe("mock-runtime-001");
    expect(config.baseUrl).toBeUndefined();
  });

  it("valid http-sse config returns DemoRuntimeConfig with mode=http-sse and baseUrl", () => {
    const config = readConfigFromEnv({
      VITE_RUNTIME_MODE: "http-sse",
      VITE_RUNTIME_ID: "qclaw-swarm-runtime-001",
      VITE_RUNTIME_BASE_URL: "http://localhost:3456",
    });
    expect(config.mode).toBe("http-sse");
    expect(config.runtimeId).toBe("qclaw-swarm-runtime-001");
    expect(config.baseUrl).toBe("http://localhost:3456");
  });

  it("missing VITE_RUNTIME_MODE defaults to mock (with warning)", () => {
    const config = readConfigFromEnv({
      VITE_RUNTIME_ID: "mock-runtime-001",
    });
    expect(config.mode).toBe("mock");
    expect(config.runtimeId).toBe("mock-runtime-001");
  });

  it("empty env defaults to mock mode with mock-runtime-001 (npm run dev works out-of-box)", () => {
    const config = readConfigFromEnv({});
    expect(config.mode).toBe("mock");
    expect(config.runtimeId).toBe("mock-runtime-001");
  });

  it("missing VITE_RUNTIME_ID in http-sse mode throws ConfigError", () => {
    expect(() =>
      readConfigFromEnv({
        VITE_RUNTIME_MODE: "http-sse",
        VITE_RUNTIME_BASE_URL: "http://localhost:3456",
      })
    ).toThrow(/VITE_RUNTIME_ID/);
  });

  it("http-sse mode without VITE_RUNTIME_BASE_URL throws ConfigError", () => {
    expect(() =>
      readConfigFromEnv({
        VITE_RUNTIME_MODE: "http-sse",
        VITE_RUNTIME_ID: "qclaw-swarm-runtime-001",
      })
    ).toThrow(/VITE_RUNTIME_BASE_URL/);
  });

  it("invalid VITE_RUNTIME_MODE throws ConfigError", () => {
    expect(() =>
      readConfigFromEnv({
        VITE_RUNTIME_MODE: "websocket",
        VITE_RUNTIME_ID: "x",
      })
    ).toThrow(/VITE_RUNTIME_MODE/);
  });
});
