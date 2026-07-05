import React from "react";
import { createRoot } from "react-dom/client";
import { readConfigFromEnv, ConfigError } from "./runtime/config.js";
import { createRuntime } from "./runtime/create-runtime.js";
import { rebuildRuntime } from "./runtime/rebuild-runtime.js";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import type { DemoRuntimeConfig } from "./runtime/types.js";
import type { RuntimeComposition } from "./runtime/types.js";
import { App } from "./App.js";
import { DemoControls } from "./DemoControls.js";
import "./theme.css";

function renderStartupError(err: unknown): void {
  if (err instanceof ConfigError) {
    console.error("[demo-office] Configuration error:", err.message);
  } else {
    console.error("[demo-office] Unexpected startup error:", err);
  }

  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <div style={{ padding: 24, fontFamily: "monospace", color: "#ff6666", background: "#1a1a2e", minHeight: "100vh" }}>
        <h2>demo-office startup error</h2>
        <pre>{err instanceof Error ? err.message : String(err)}</pre>
        <p style={{ color: "#888", marginTop: 16 }}>
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
  onRetry: () => void
): void {
  const session = composition.session;
  const store = composition.store;
  const gateway = composition.gateway;
  const mockAdapter = config.mode === "mock" ? (composition.adapter as MockRuntimeAdapter) : null;
  const adapterCapabilities = composition.adapter.getCapabilities();

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
      />
    </React.StrictMode>
  );
}

// Wait for session.connect() before reading adapter capabilities.
// HttpSseRuntimeAdapter fetches capabilities from the runtime; calling
// getCapabilities() before connect() throws because they are not cached yet.
async function bootstrap(): Promise<void> {
  let config: DemoRuntimeConfig;
  try {
    config = readConfigFromEnv(import.meta.env as unknown as Record<string, string>);
  } catch (err) {
    renderStartupError(err);
    return;
  }

  const root = createRoot(document.getElementById("root")!);
  let composition = createRuntime(config);

  async function handleRetry(): Promise<void> {
    try {
      composition = await rebuildRuntime(config, composition, (next) => {
        renderAppComposition(root, config, next, handleRetry);
      });
    } catch (err) {
      console.error("[demo-office] Runtime retry failed:", err);
      renderStartupError(err);
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
          backgroundColor: "#1a1a2e",
          color: "#88ccff",
          fontFamily: "monospace",
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
    renderStartupError(err);
    return;
  }

  renderAppComposition(root, config, composition, handleRetry);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      composition.dispose();
    });
  }
}

bootstrap();
