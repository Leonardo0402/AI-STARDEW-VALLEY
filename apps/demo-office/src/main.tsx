import React from "react";
import { createRoot } from "react-dom/client";
import { readConfigFromEnv, ConfigError } from "./runtime/config.js";
import { createRuntime } from "./runtime/create-runtime.js";
import { rebuildRuntime } from "./runtime/rebuild-runtime.js";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import {
  HttpLifeSimClient,
  LifeSimSession,
} from "@agent-office/control-ui/life-sim";
import type { DemoRuntimeConfig } from "./runtime/types.js";
import type { RuntimeComposition } from "./runtime/types.js";
import { App } from "./App.js";
import { DemoControls } from "./DemoControls.js";
import "./theme.css";

const LIFE_SIM_WORLD_ID = "default";

declare global {
  interface Window {
    /** Dev-only hook so screenshot scripts can drive MockRuntimeAdapter flows that have no UI button. */
    __mockAdapter?: MockRuntimeAdapter;
  }
}

function renderStartupError(
  root: ReturnType<typeof createRoot>,
  err: unknown
): void {
  if (err instanceof ConfigError) {
    console.error("[demo-office] Configuration error:", err.message);
  } else {
    console.error("[demo-office] Unexpected startup error:", err);
  }

  root.render(
    <React.StrictMode>
      <div
        style={{
          padding: 24,
          fontFamily: "var(--font-mono), monospace",
          color: "var(--failure)",
          background: "var(--base-900)",
          minHeight: "100vh",
        }}
      >
        <h2>demo-office startup error</h2>
        <pre>{err instanceof Error ? err.message : String(err)}</pre>
        <p style={{ color: "var(--base-400)", marginTop: 16 }}>
          Check your <code>.env</code> or Vite environment variables.
          See <code>.env.example</code> for required values.
        </p>
      </div>
    </React.StrictMode>
  );
}

function renderAppComposition(
  root: ReturnType<typeof createRoot>,
  config: DemoRuntimeConfig,
  composition: RuntimeComposition,
  lifeSimSession: LifeSimSession,
  onRetry: () => void
): void {
  const session = composition.session;
  const store = composition.store;
  const gateway = composition.gateway;
  const mockAdapter = config.mode === "mock" ? (composition.adapter as MockRuntimeAdapter) : null;
  const adapterCapabilities = composition.adapter.getCapabilities();

  if (mockAdapter) {
    window.__mockAdapter = mockAdapter;
  }

  root.render(
    <React.StrictMode>
      <App
        session={session}
        store={store}
        gateway={gateway}
        runtimeId={config.runtimeId}
        capabilities={adapterCapabilities}
        demoControls={
          mockAdapter ? (
            <DemoControls adapter={mockAdapter} store={store} session={session} />
          ) : null
        }
        retryable={true}
        onRetry={onRetry}
        lifeSimSession={lifeSimSession}
        lifeSimWorldId={LIFE_SIM_WORLD_ID}
      />
    </React.StrictMode>
  );
}

// Wait for session.connect() before reading adapter capabilities.
// HttpSseRuntimeAdapter fetches capabilities from the runtime; calling
// getCapabilities() before connect() throws because they are not cached yet.
async function bootstrap(): Promise<void> {
  const root = createRoot(document.getElementById("root")!);

  let config: DemoRuntimeConfig;
  try {
    config = readConfigFromEnv(import.meta.env as unknown as Record<string, string>);
  } catch (err) {
    renderStartupError(root, err);
    return;
  }

  let composition = createRuntime(config);

  async function handleRetry(lifeSimSession: LifeSimSession): Promise<void> {
    try {
      composition = await rebuildRuntime(config, composition, (next) => {
        renderAppComposition(root, config, next, lifeSimSession, handleRetry.bind(null, lifeSimSession));
      });
    } catch (err) {
      console.error("[demo-office] Runtime retry failed:", err);
      renderStartupError(root, err);
    }
  }

  root.render(
    <React.StrictMode>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100vw",
          height: "100vh",
          backgroundColor: "var(--base-900)",
          color: "var(--info)",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 14,
        }}
      >
        Connecting to {config.mode === "mock" ? "Mock Runtime" : config.runtimeId}...
      </div>
    </React.StrictMode>
  );

  try {
    await composition.session.connect();
  } catch (err) {
    console.error("[demo-office] RuntimeSession bootstrap failed:", err);
    renderStartupError(root, err);
    return;
  }

  const lifeSimClient = new HttpLifeSimClient({
    baseUrl: config.lifeSimBaseUrl,
    worldId: LIFE_SIM_WORLD_ID,
  });
  const lifeSimSession = new LifeSimSession(lifeSimClient);

  try {
    await lifeSimSession.start();
  } catch (err) {
    console.error("[demo-office] LifeSimSession bootstrap failed:", err);
    renderStartupError(root, err);
    return;
  }

  renderAppComposition(root, config, composition, lifeSimSession, handleRetry.bind(null, lifeSimSession));

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      lifeSimSession.stop();
      composition.dispose();
    });
  }
}

bootstrap();
