import type { DemoRuntimeConfig, DemoRuntimeMode } from "./types.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Read runtime configuration from Vite environment variables.
 *
 * VITE_RUNTIME_MODE:  "mock" (default) | "http-sse"
 * VITE_RUNTIME_ID:    required — the runtime identifier
 * VITE_RUNTIME_BASE_URL: required when mode === "http-sse"
 *
 * Invalid/missing configuration throws ConfigError — the caller (main.tsx)
 * catches and renders a startup error screen.
 */
export function readConfigFromEnv(env: Record<string, string | undefined>): DemoRuntimeConfig {
  const rawMode = env.VITE_RUNTIME_MODE ?? "mock";
  const runtimeId = env.VITE_RUNTIME_ID;
  const baseUrl = env.VITE_RUNTIME_BASE_URL;

  if (!runtimeId) {
    throw new ConfigError(
      "VITE_RUNTIME_ID is required. Set it in .env or Vite environment."
    );
  }

  let mode: DemoRuntimeMode;
  if (rawMode === "mock" || rawMode === "http-sse") {
    mode = rawMode;
  } else {
    throw new ConfigError(
      `VITE_RUNTIME_MODE must be "mock" or "http-sse", got: "${rawMode}"`
    );
  }

  if (mode === "http-sse" && !baseUrl) {
    throw new ConfigError(
      "VITE_RUNTIME_BASE_URL is required when VITE_RUNTIME_MODE=http-sse. " +
        'Example: VITE_RUNTIME_BASE_URL=http://localhost:3456'
    );
  }

  if (mode === "mock" && rawMode === undefined) {
    // eslint-disable-next-line no-console
    console.warn(
      "[demo-office] VITE_RUNTIME_MODE not set, defaulting to \"mock\". " +
        "Set VITE_RUNTIME_MODE=http-sse for remote runtime."
    );
  }

  return { mode, runtimeId, baseUrl };
}
