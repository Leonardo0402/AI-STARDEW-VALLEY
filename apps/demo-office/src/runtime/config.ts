import type { DemoRuntimeConfig, RuntimeMode } from "./types.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Read runtime configuration from Vite environment variables.
 *
 * VITE_RUNTIME_MODE:  "mock" (default) | "http-sse" | "github"
 * VITE_RUNTIME_ID:    required — the runtime identifier
 * VITE_RUNTIME_BASE_URL: required when mode === "http-sse"
 * VITE_GITHUB_OWNER:  required only for github network write commands
 * VITE_GITHUB_REPO:   required only for github network write commands
 * VITE_GITHUB_TOKEN:  optional — GitHub personal access token
 *
 * Invalid/missing configuration throws ConfigError — the caller (main.tsx)
 * catches and renders a startup error screen.
 */
export function readConfigFromEnv(env: Record<string, string | undefined>): DemoRuntimeConfig {
  const rawMode = env.VITE_RUNTIME_MODE;
  const explicitRuntimeId = env.VITE_RUNTIME_ID;
  const baseUrl = env.VITE_RUNTIME_BASE_URL;
  const lifeSimBaseUrl = env.VITE_LIFE_SIM_BASE_URL ?? "http://localhost:3001";

  // Determine mode — default to "mock" when not set
  let mode: RuntimeMode;
  if (rawMode === undefined) {
    mode = "mock";
    // eslint-disable-next-line no-console
    console.warn(
      "[demo-office] VITE_RUNTIME_MODE not set, defaulting to \"mock\". " +
        "Set VITE_RUNTIME_MODE=http-sse for remote runtime or github for GitHub projection."
    );
  } else if (rawMode === "mock" || rawMode === "http-sse" || rawMode === "github") {
    mode = rawMode;
  } else {
    throw new ConfigError(
      `VITE_RUNTIME_MODE must be "mock", "http-sse" or "github", got: "${rawMode}"`
    );
  }

  // runtimeId: required for http-sse; default for mock so `npm run dev` works out-of-box
  const runtimeId = explicitRuntimeId ?? (mode === "mock" ? "mock-runtime-001" : undefined);
  if (!runtimeId) {
    throw new ConfigError(
      "VITE_RUNTIME_ID is required when VITE_RUNTIME_MODE=http-sse or github. " +
        "Set it in .env or Vite environment."
    );
  }

  if (mode === "http-sse" && !baseUrl) {
    throw new ConfigError(
      "VITE_RUNTIME_BASE_URL is required when VITE_RUNTIME_MODE=http-sse. " +
        'Example: VITE_RUNTIME_BASE_URL=http://localhost:3456'
    );
  }

  if (mode === "github" && (!env.VITE_GITHUB_OWNER || !env.VITE_GITHUB_REPO)) {
    // optional warning only; adapter supports unconfigured local commands
    // eslint-disable-next-line no-console
    console.warn(
      "[demo-office] VITE_GITHUB_OWNER or VITE_GITHUB_REPO not set. " +
        "GitHub mode will operate with local commands only."
    );
  }

  return {
    mode,
    runtimeId,
    baseUrl,
    lifeSimBaseUrl,
    githubOwner: env.VITE_GITHUB_OWNER,
    githubRepo: env.VITE_GITHUB_REPO,
    githubToken: env.VITE_GITHUB_TOKEN,
  };
}
