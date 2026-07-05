/**
 * demo-office entry — runtime composition root.
 *
 * Reads config from Vite env vars, constructs the runtime composition
 * (adapter + store + gateway + session) at module level, and renders App.
 *
 * Invalid config renders a startup error screen instead of falling back.
 *
 * StrictMode-safe: module-level singleton; React double-mount does not
 * re-create the session. HMR calls dispose() via import.meta.hot.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { readConfigFromEnv, ConfigError } from "./runtime/config.js";
import { createRuntime } from "./runtime/create-runtime.js";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import type { RuntimeComposition, DemoRuntimeConfig } from "./runtime/types.js";
import { App } from "./App.js";
import { DemoControls } from "./DemoControls.js";

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

// ─── Runtime composition (module-level singleton) ─────────────
// Read config first; if it throws, render error screen and stop.
let config: DemoRuntimeConfig;
try {
  config = readConfigFromEnv(import.meta.env as unknown as Record<string, string>);
} catch (err) {
  renderStartupError(err);
  config = undefined as any; // unreachable — satisfies TS control flow
}

let composition: RuntimeComposition | undefined;
if (config) {
  try {
    composition = createRuntime(config);
    // Bootstrap the session (connect → snapshot → subscribe)
    composition.session.connect().catch((err) => {
      console.error("[demo-office] RuntimeSession bootstrap failed:", err);
    });
  } catch (err) {
    renderStartupError(err);
  }
}

// ─── Render (only when composition succeeded) ────────────────
if (composition && config) {
  const { mode, runtimeId } = config;
  const session = composition.session;
  const store = composition.store;
  const gateway = composition.gateway;
  const mockAdapter = mode === "mock" ? (composition.adapter as MockRuntimeAdapter) : null;
  const adapterCapabilities = composition.adapter.getCapabilities();
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <App
        session={session}
        store={store}
        gateway={gateway}
        runtimeId={runtimeId}
        mode={mode}
        capabilities={adapterCapabilities}
        demoControls={
          mockAdapter ? (
            <DemoControls adapter={mockAdapter} store={store} session={session} />
          ) : null
        }
      />
    </React.StrictMode>
  );

  // ─── HMR disposal ─────────────────────────────────────────
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      composition?.dispose();
    });
  }
}
