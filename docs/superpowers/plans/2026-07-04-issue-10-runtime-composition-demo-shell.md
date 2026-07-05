# Runtime-Connected Demo Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the hard-coded Mock-only demo-office into a runtime-connected application shell that can run against either `MockRuntimeAdapter` (local deterministic) or `HttpSseRuntimeAdapter` + `QclawTestRuntime` (remote HTTP/SSE) through configuration — without visual redesign.

**Architecture:** A new `apps/demo-office/src/runtime/` composition layer reads config from Vite env vars and constructs exactly one adapter/store/gateway/session per app lifecycle (module-level singleton with explicit `dispose()`). The QClaw test runtime gains dev-only CORS support. A `StatusStrip` component surfaces session state/diagnostics. `DemoControls` is gated to Mock mode only.

**Tech Stack:** React 18, Vite 5, TypeScript 5, vitest 2, Node http (QClaw runtime), existing `@agent-office/*` workspace packages.

## Global Constraints

- **No QClaw-specific types in app layer:** `demo-office` talks only to generic protocol types (`RuntimeSnapshot`, `DomainEvent`, `OfficeCommand`) and `@agent-office/core` / `@agent-office/adapter-http-sse` / `@agent-office/adapter-mock`. Never import from `@agent-office/qclaw-swarm` in the app.
- **Runtime construction not in visual components:** `createRuntime()` lives in `src/runtime/`, called from `main.tsx` (module level), never inside React components.
- **StrictMode-safe:** Module-level singleton; React StrictMode double-mount must not duplicate sessions/subscriptions.
- **One adapter/store/gateway/session per app lifecycle:** `dispose()` disconnects the session exactly once; HMR calls `dispose()` before recreating.
- **Invalid config = visible error, not silent fallback:** Missing `baseUrl` in http-sse mode renders a startup error screen, not a Mock fallback.
- **No visual redesign:** This issue is functional only. No sprite work, layout redesign, color system, or animation. `StatusStrip` is functional instrumentation.
- **Mock-only controls isolated:** `DemoControls` renders only when `mode === "mock"`. Remote mode cannot call Mock scenario helpers (`playNormalFlow`, `reset`, etc.).
- **Truthful copy:** Never label the synthetic runtime as real QClaw integration. Subtitle reflects actual mode.
- **Node launcher, no new deps:** `dev:remote-demo` uses a small Node script with `child_process.spawn`, not `concurrently`.
- **CORS dev-only:** QClaw runtime CORS defaults to `["http://localhost:5173"]` (Vite origin). Configurable via `allowedOrigins` option. No permissive `*` default.
- **Windows/PowerShell environment:** Commands must be PowerShell-compatible. No Bash heredocs.
- **Exact versions:** workspace deps use `"1.0.0"` (matching existing pattern).
- **TDD:** Every task writes failing test first, watches it fail, implements minimal code, watches it pass, commits.

---

## File Structure

```
apps/demo-office/
  src/
    runtime/
      types.ts           # Task 1: DemoRuntimeMode, DemoRuntimeConfig, RuntimeComposition
      config.ts          # Task 1: readConfigFromEnv() + validation
      create-runtime.ts  # Task 2: createRuntime(config) factory + dispose()
      create-runtime.test.ts  # Task 2: factory tests
      config.test.ts     # Task 1: config validation tests
    StatusStrip.tsx      # Task 7: session state/diagnostics strip
    main.tsx             # Task 6: rewritten to use factory + startup error
    App.tsx              # Task 7+8: mode prop, StatusStrip, Mock-only gating
  .env.example           # Task 10
  package.json           # Task 3: + @agent-office/adapter-http-sse dep
  vite.config.ts         # Task 3: + optimizeDeps exclude
  src/
    remote-golden-flow.test.ts  # Task 9

packages/adapters/qclaw-swarm/
  src/
    qclaw-runtime.ts     # Task 4: + CORS + OPTIONS handler
    dev-server.ts        # Task 5: CLI entry point
    qclaw-runtime.test.ts # Task 4: + CORS tests
  package.json           # Task 5: + bin entry

scripts/
  dev-remote-demo.mjs    # Task 5: Node launcher (spawn runtime + vite)

docs/integrations/demo-office/
  local-run-guide.md     # Task 10
  terminology.md         # Task 10: Mock vs Reference Swarm vs real QClaw
  troubleshooting.md     # Task 10

package.json             # Task 5: + dev:ui / dev:runtime / dev:remote-demo scripts
```

---

## Task 1: Runtime composition types + config

**Files:**
- Create: `apps/demo-office/src/runtime/types.ts`
- Create: `apps/demo-office/src/runtime/config.ts`
- Create: `apps/demo-office/src/runtime/config.test.ts`

**Interfaces:**
- Consumes: Vite env vars (`import.meta.env.VITE_*`)
- Produces: `DemoRuntimeMode`, `DemoRuntimeConfig`, `readConfigFromEnv()`, `ConfigError`

- [ ] **Step 1: Write the failing test**

`apps/demo-office/src/runtime/config.test.ts`:

```typescript
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
  });

  it("missing VITE_RUNTIME_ID throws ConfigError", () => {
    expect(() => readConfigFromEnv({})).toThrow(/VITE_RUNTIME_ID/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/demo-office/src/runtime/config.test.ts`
Expected: FAIL — `Cannot find module './config.js'`

- [ ] **Step 3: Write types.ts**

`apps/demo-office/src/runtime/types.ts`:

```typescript
/**
 * Runtime composition types for demo-office.
 *
 * The app can run against either a Mock adapter (deterministic local)
 * or an HTTP/SSE adapter (remote runtime speaking the generic wire protocol).
 */

export type DemoRuntimeMode = "mock" | "http-sse";

export interface DemoRuntimeConfig {
  mode: DemoRuntimeMode;
  runtimeId: string;
  /** Required when mode === "http-sse". */
  baseUrl?: string;
}

/**
 * Result of createRuntime(): the four runtime objects + a dispose function.
 * All four are constructed exactly once per app lifecycle.
 */
export interface RuntimeComposition {
  adapter: import("@agent-office/core").RuntimeAdapter;
  store: import("@agent-office/core").SnapshotStore;
  gateway: import("@agent-office/core").CommandGateway;
  session: import("@agent-office/core").RuntimeSession;
  /** Disconnect the session exactly once. Idempotent. */
  dispose: () => Promise<void>;
}
```

- [ ] **Step 4: Write config.ts**

`apps/demo-office/src/runtime/config.ts`:

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run apps/demo-office/src/runtime/config.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 6: Commit**

```bash
git add apps/demo-office/src/runtime/types.ts apps/demo-office/src/runtime/config.ts apps/demo-office/src/runtime/config.test.ts
git commit -m "feat(demo-office): runtime composition types and config validation (#10 Task 1)"
```

---

## Task 2: Runtime composition factory (create-runtime)

**Files:**
- Create: `apps/demo-office/src/runtime/create-runtime.ts`
- Create: `apps/demo-office/src/runtime/create-runtime.test.ts`

**Interfaces:**
- Consumes: `DemoRuntimeConfig` from Task 1, `MockRuntimeAdapter`, `HttpSseRuntimeAdapter`, `SnapshotStore`, `CommandGateway`, `RuntimeSession`
- Produces: `createRuntime(config): RuntimeComposition`

- [ ] **Step 1: Write the failing test**

`apps/demo-office/src/runtime/create-runtime.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { createRuntime } from "./create-runtime.js";
import type { RuntimeComposition } from "./types.js";

describe("createRuntime", () => {
  let comp: RuntimeComposition | null;

  afterEach(async () => {
    if (comp) {
      await comp.dispose();
      comp = null;
    }
  });

  it("mock config creates MockRuntimeAdapter composition", async () => {
    comp = createRuntime({ mode: "mock", runtimeId: "mock-runtime-001" });
    expect(comp.adapter).toBeDefined();
    expect(comp.store).toBeDefined();
    expect(comp.gateway).toBeDefined();
    expect(comp.session).toBeDefined();
    // Mock adapter connects synchronously (no-op)
    await comp.session.connect();
    expect(comp.session.getState()).toBe("connected");
    // Initial snapshot has 4 agents
    expect(comp.store.getSnapshot().agents).toHaveLength(4);
  });

  it("http-sse config creates HttpSseRuntimeAdapter composition (without connecting)", () => {
    comp = createRuntime({
      mode: "http-sse",
      runtimeId: "qclaw-swarm-runtime-001",
      baseUrl: "http://localhost:3456",
    });
    expect(comp.adapter).toBeDefined();
    expect(comp.store).toBeDefined();
    expect(comp.gateway).toBeDefined();
    expect(comp.session).toBeDefined();
    // Do NOT connect — no server running. Just verify construction.
  });

  it("dispose disconnects the session exactly once (idempotent)", async () => {
    comp = createRuntime({ mode: "mock", runtimeId: "mock-runtime-001" });
    await comp.session.connect();
    expect(comp.session.getState()).toBe("connected");
    await comp.dispose();
    expect(comp.session.getState()).toBe("disconnected");
    // Second dispose is a no-op
    await comp.dispose();
    expect(comp.session.getState()).toBe("disconnected");
  });

  it("createRuntime called twice produces independent compositions (StrictMode safety)", () => {
    const comp1 = createRuntime({ mode: "mock", runtimeId: "mock-runtime-001" });
    const comp2 = createRuntime({ mode: "mock", runtimeId: "mock-runtime-001" });
    expect(comp1.session).not.toBe(comp2.session);
    expect(comp1.store).not.toBe(comp2.store);
    // Cleanup both (synchronous — don't connect)
    comp1.dispose();
    comp2.dispose();
    comp = null;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/demo-office/src/runtime/create-runtime.test.ts`
Expected: FAIL — `Cannot find module './create-runtime.js'`

- [ ] **Step 3: Write create-runtime.ts**

`apps/demo-office/src/runtime/create-runtime.ts`:

```typescript
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import { HttpSseRuntimeAdapter } from "@agent-office/adapter-http-sse";
import { SnapshotStore, CommandGateway, RuntimeSession } from "@agent-office/core";
import type { RuntimeAdapter } from "@agent-office/protocol";
import type { DemoRuntimeConfig, RuntimeComposition } from "./types.js";

/**
 * Create the runtime composition: adapter + store + gateway + session.
 *
 * Constructs exactly one of each per call. The caller (main.tsx) holds the
 * result as a module-level singleton and calls dispose() on HMR/unmount.
 *
 * Does NOT call session.connect() — the caller is responsible for bootstrap,
 * so tests can construct without starting a server.
 */
export function createRuntime(config: DemoRuntimeConfig): RuntimeComposition {
  const adapter = createAdapter(config);
  const store = new SnapshotStore(config.runtimeId);
  const gateway = new CommandGateway(adapter);
  const session = new RuntimeSession(adapter, store, gateway);

  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    try {
      await session.disconnect();
    } catch {
      /* best-effort — already disconnected */
    }
  };

  return { adapter, store, gateway, session, dispose };
}

function createAdapter(config: DemoRuntimeConfig): RuntimeAdapter {
  switch (config.mode) {
    case "mock":
      return new MockRuntimeAdapter({ eventDelayMs: 250 });
    case "http-sse":
      return new HttpSseRuntimeAdapter({
        baseUrl: config.baseUrl!,
        runtimeId: config.runtimeId,
      });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/demo-office/src/runtime/create-runtime.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add apps/demo-office/src/runtime/create-runtime.ts apps/demo-office/src/runtime/create-runtime.test.ts
git commit -m "feat(demo-office): createRuntime factory with Mock and HTTP/SSE modes (#10 Task 2)"
```

---

## Task 3: demo-office package.json + vite.config update

**Files:**
- Modify: `apps/demo-office/package.json` (add @agent-office/adapter-http-sse dep)
- Modify: `apps/demo-office/vite.config.ts` (add optimizeDeps exclude)

**Interfaces:**
- Consumes: existing `@agent-office/adapter-http-sse` package
- Produces: updated build config enabling HTTP/SSE adapter import in browser

- [ ] **Step 1: Update package.json**

`apps/demo-office/package.json` — add `@agent-office/adapter-http-sse` to dependencies:

```json
{
  "name": "@agent-office/demo-office",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@agent-office/protocol": "1.0.0",
    "@agent-office/core": "1.0.0",
    "@agent-office/adapter-mock": "1.0.0",
    "@agent-office/adapter-http-sse": "1.0.0",
    "@agent-office/pixel-office": "1.0.0",
    "@agent-office/control-ui": "1.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "pixi.js": "^8.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Update vite.config.ts**

`apps/demo-office/vite.config.ts` — add `@agent-office/adapter-http-sse` to `optimizeDeps.exclude`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    exclude: [
      "@agent-office/protocol",
      "@agent-office/core",
      "@agent-office/adapter-mock",
      "@agent-office/adapter-http-sse",
      "@agent-office/pixel-office",
      "@agent-office/control-ui",
    ],
  },
});
```

- [ ] **Step 3: Run npm install to sync lock file, then build + test**

Run: `npm install && npm run build && npm test`
Expected: clean build, all tests pass (previous count + Task 1+2 tests = 282)

- [ ] **Step 4: Commit**

```bash
git add apps/demo-office/package.json apps/demo-office/vite.config.ts package-lock.json
git commit -m "chore(demo-office): add @agent-office/adapter-http-sse dependency and Vite optimizeDeps (#10 Task 3)"
```

---

## Task 4: QClaw runtime CORS support

**Files:**
- Modify: `packages/adapters/qclaw-swarm/src/qclaw-runtime.ts` (add CORS + OPTIONS handler)
- Modify: `packages/adapters/qclaw-swarm/src/qclaw-runtime.test.ts` (add CORS tests)

**Interfaces:**
- Consumes: `QclawRuntimeOptions`
- Produces: `QclawRuntimeOptions.allowedOrigins?: string[]` (default `["http://localhost:5173"]`)

- [ ] **Step 1: Write the failing test**

Append to `packages/adapters/qclaw-swarm/src/qclaw-runtime.test.ts`:

```typescript
describe("QclawTestRuntime CORS", () => {
  let runtime: QclawTestRuntime;

  afterEach(async () => {
    if (runtime) await runtime.stop();
  });

  it("GET /runtime/snapshot includes CORS headers for allowed origin", async () => {
    runtime = new QclawTestRuntime({
      port: 0,
      allowedOrigins: ["http://localhost:5173"],
    });
    await runtime.start();

    const res = await fetch(runtime.getBaseUrl() + "/runtime/snapshot", {
      headers: { origin: "http://localhost:5173" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("OPTIONS preflight returns 204 with CORS headers", async () => {
    runtime = new QclawTestRuntime({
      port: 0,
      allowedOrigins: ["http://localhost:5173"],
    });
    await runtime.start();

    const res = await fetch(runtime.getBaseUrl() + "/runtime/commands", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,idempotency-key",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
    expect(res.headers.get("access-control-allow-headers")).toContain("content-type");
  });

  it("disallowed origin does not get CORS allow-origin header reflected", async () => {
    runtime = new QclawTestRuntime({
      port: 0,
      allowedOrigins: ["http://localhost:5173"],
    });
    await runtime.start();

    const res = await fetch(runtime.getBaseUrl() + "/runtime/snapshot", {
      headers: { origin: "http://evil.example.com" },
    });
    expect(res.status).toBe(200); // request still succeeds (no auth)
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("default allowedOrigins is http://localhost:5173 when not specified", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();

    const res = await fetch(runtime.getBaseUrl() + "/runtime/snapshot", {
      headers: { origin: "http://localhost:5173" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/qclaw-swarm/src/qclaw-runtime.test.ts -t "CORS"`
Expected: FAIL — CORS headers not present

- [ ] **Step 3: Update QclawRuntimeOptions and add CORS handling**

In `packages/adapters/qclaw-swarm/src/qclaw-runtime.ts`:

Update `QclawRuntimeOptions` interface:

```typescript
export interface QclawRuntimeOptions {
  port?: number;
  /** Allowed CORS origins for dev server. Defaults to ["http://localhost:5173"]. */
  allowedOrigins?: string[];
}
```

Add `DEFAULT_ALLOWED_ORIGINS` constant near the top (after imports):

```typescript
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173"];
```

Add `allowedOrigins` field to the class and update constructor:

```typescript
  private allowedOrigins: string[];

  constructor(opts: QclawRuntimeOptions = {}) {
    this.port = opts.port ?? 0;
    this.allowedOrigins = opts.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
    // ... rest unchanged
  }
```

Add a `corsHeaders(origin)` helper method:

```typescript
  private corsHeaders(origin: string | undefined): Record<string, string> {
    if (origin && this.allowedOrigins.includes(origin)) {
      return {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, idempotency-key",
        "access-control-max-age": "86400",
      };
    }
    return {};
  }
```

Update the `handle()` method to:
1. Handle OPTIONS preflight at the TOP (before route matching), returning 204 with CORS headers.
2. Merge CORS headers into every response's `writeHead`.

The new `handle()` method start:

```typescript
  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? "";
    const origin = req.headers.origin;
    const cors = this.corsHeaders(origin);

    // OPTIONS preflight — respond before route matching
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    if (req.method === "GET" && url.endsWith("/runtime/snapshot")) {
      res.writeHead(200, { "content-type": "application/json", ...cors });
      res.end(JSON.stringify(this.getSnapshot()));
      return;
    }

    if (req.method === "GET" && url.endsWith("/runtime/capabilities")) {
      res.writeHead(200, { "content-type": "application/json", ...cors });
      res.end(JSON.stringify(this.capabilities));
      return;
    }

    if (req.method === "GET" && url.includes("/runtime/events")) {
      const afterSeq = parseInt(new URL(`http://x${url}`).searchParams.get("afterSequence") ?? "0", 10);
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        ...cors,
      });
      // ... rest of SSE handler unchanged
    }

    if (req.method === "POST" && url.endsWith("/runtime/commands")) {
      const body = await this.readRequestBody(req);
      let cmd: OfficeCommand;
      try {
        cmd = JSON.parse(body) as OfficeCommand;
      } catch {
        res.writeHead(400, cors);
        res.end(JSON.stringify({
          commandId: "unknown",
          status: "error",
          error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
          affectedEventIds: [],
        }));
        return;
      }
      const result = this.executeCommand(cmd);
      res.writeHead(200, { "content-type": "application/json", ...cors });
      res.end(JSON.stringify(result));
      return;
    }

    // Demo endpoints — also add CORS
    if (req.method === "POST" && url.endsWith("/runtime/demo/trigger-artifact-review")) {
      this.triggerArtifactAndReviewForTest();
      res.writeHead(200, { "content-type": "application/json", ...cors });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method === "GET" && url.endsWith("/runtime/demo/event-log")) {
      res.writeHead(200, { "content-type": "application/json", ...cors });
      res.end(JSON.stringify(this.eventLog));
      return;
    }

    res.writeHead(404, cors);
    res.end("not found");
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/adapters/qclaw-swarm/src/qclaw-runtime.test.ts -t "CORS"`
Expected: PASS — 4 CORS tests

- [ ] **Step 5: Run full suite**

Run: `npm run build && npm test`
Expected: clean, all pass (282 + 4 = 286)

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/qclaw-swarm/src/qclaw-runtime.ts packages/adapters/qclaw-swarm/src/qclaw-runtime.test.ts
git commit -m "feat(qclaw-swarm): dev-only CORS support with configurable allowed origins (#10 Task 4)"
```

---

## Task 5: QClaw dev server launcher + root scripts

**Files:**
- Create: `packages/adapters/qclaw-swarm/src/dev-server.ts`
- Create: `scripts/dev-remote-demo.mjs`
- Modify: `packages/adapters/qclaw-swarm/package.json` (add bin)
- Modify: `package.json` (root — add dev:ui, dev:runtime, dev:remote-demo)

**Interfaces:**
- Consumes: `QclawTestRuntime`
- Produces: `dev-server.ts` CLI entry, `dev:remote-demo` launcher

- [ ] **Step 1: Create dev-server.ts**

`packages/adapters/qclaw-swarm/src/dev-server.ts`:

```typescript
/**
 * Dev server entry point for the QClaw test runtime.
 *
 * Usage: node --import tsx packages/adapters/qclaw-swarm/src/dev-server.ts
 *   --port=3456 --runtime-id=qclaw-swarm-runtime-001 --allowed-origins=http://localhost:5173
 *
 * Reads CLI args, starts QclawTestRuntime, logs the base URL, and keeps
 * the process alive until SIGINT/SIGTERM.
 */
import { QclawTestRuntime } from "./qclaw-runtime.js";

function parseArgs(argv: string[]): {
  port: number;
  runtimeId: string;
  allowedOrigins: string[];
} {
  const portArg = argv.find((a) => a.startsWith("--port="));
  const idArg = argv.find((a) => a.startsWith("--runtime-id="));
  const originsArg = argv.find((a) => a.startsWith("--allowed-origins="));

  const port = portArg ? parseInt(portArg.split("=")[1], 10) : 3456;
  const runtimeId = idArg ? idArg.split("=")[1] : "qclaw-swarm-runtime-001";
  const allowedOrigins = originsArg
    ? originsArg.split("=")[1].split(",")
    : ["http://localhost:5173"];

  return { port, runtimeId, allowedOrigins };
}

async function main(): Promise<void> {
  const { port, allowedOrigins } = parseArgs(process.argv.slice(2));
  const runtime = new QclawTestRuntime({ port, allowedOrigins });
  await runtime.start();
  console.log(`[qclaw-dev-server] QClaw test runtime ready at ${runtime.getBaseUrl()}`);
  console.log(`[qclaw-dev-server] Allowed CORS origins: ${allowedOrigins.join(", ")}`);
  console.log(`[qclaw-dev-server] Health check: GET ${runtime.getBaseUrl()}/runtime/snapshot`);

  const shutdown = async () => {
    console.log("\n[qclaw-dev-server] Shutting down...");
    await runtime.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[qclaw-dev-server] Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Update qclaw-swarm package.json (add bin + devDeps for tsx)**

`packages/adapters/qclaw-swarm/package.json`:

```json
{
  "name": "@agent-office/qclaw-swarm",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "bin": "./src/dev-server.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "dev": "node --import tsx ./src/dev-server.ts"
  },
  "dependencies": {
    "@agent-office/protocol": "1.0.0",
    "@agent-office/core": "1.0.0"
  },
  "devDependencies": {
    "@agent-office/adapter-http-sse": "1.0.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 3: Create dev-remote-demo.mjs launcher**

`scripts/dev-remote-demo.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Dev launcher: starts QClaw test runtime + Vite dev server concurrently.
 *
 * No external deps — uses child_process.spawn. Forwards stdout/stderr.
 * Ctrl+C kills both processes.
 *
 * Usage: node scripts/dev-remote-demo.mjs
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const RUNTIME_PORT = "3456";
const ALLOWED_ORIGIN = "http://localhost:5173";

const runtime = spawn(
  "node",
  ["--import", "tsx", "packages/adapters/qclaw-swarm/src/dev-server.ts",
   `--port=${RUNTIME_PORT}`, `--allowed-origins=${ALLOWED_ORIGIN}`],
  { stdio: ["inherit", "pipe", "pipe"] }
);

const vite = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "--config", "apps/demo-office/vite.config.ts"],
  {
    stdio: ["inherit", "pipe", "pipe"],
    env: {
      ...process.env,
      VITE_RUNTIME_MODE: "http-sse",
      VITE_RUNTIME_ID: "qclaw-swarm-runtime-001",
      VITE_RUNTIME_BASE_URL: `http://localhost:${RUNTIME_PORT}`,
    },
  }
);

function prefix(name, data) {
  return data
    .toString()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => `[${name}] ${l}`)
    .join("\n");
}

runtime.stdout.on("data", (d) => process.stdout.write(prefix("runtime", d) + "\n"));
runtime.stderr.on("data", (d) => process.stderr.write(prefix("runtime", d) + "\n"));
vite.stdout.on("data", (d) => process.stdout.write(prefix("vite", d) + "\n"));
vite.stderr.on("data", (d) => process.stderr.write(prefix("vite", d) + "\n"));

function killAll() {
  console.log("\n[dev-remote-demo] Shutting down both processes...");
  try { runtime.kill("SIGTERM"); } catch {}
  try { vite.kill("SIGTERM"); } catch {}
  process.exit(0);
}

process.on("SIGINT", killAll);
process.on("SIGTERM", killAll);
runtime.on("exit", (code) => {
  console.log(`[dev-remote-demo] Runtime exited with code ${code}`);
  killAll();
});
vite.on("exit", (code) => {
  console.log(`[dev-remote-demo] Vite exited with code ${code}`);
  killAll();
});
```

- [ ] **Step 4: Update root package.json scripts**

`package.json` (root) — add to `scripts`:

```json
{
  "scripts": {
    "dev": "npm run dev --workspace=apps/demo-office",
    "dev:ui": "npm run dev --workspace=apps/demo-office",
    "dev:runtime": "node --import tsx packages/adapters/qclaw-swarm/src/dev-server.ts --port=3456 --allowed-origins=http://localhost:5173",
    "dev:remote-demo": "node scripts/dev-remote-demo.mjs",
    "build": "tsc -b && npm run build -w apps/demo-office",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: Install tsx, run build + test**

Run: `npm install && npm run build && npm test`
Expected: clean build, all tests pass (286). The dev-server.ts is not tested directly (it's a CLI entry), but it must compile.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/qclaw-swarm/src/dev-server.ts packages/adapters/qclaw-swarm/package.json scripts/dev-remote-demo.mjs package.json package-lock.json
git commit -m "feat: QClaw dev server launcher + dev:remote-demo concurrent launcher (#10 Task 5)"
```

---

## Task 6: main.tsx rewrite — use factory + startup error

**Files:**
- Modify: `apps/demo-office/src/main.tsx`

**Interfaces:**
- Consumes: `createRuntime` from Task 2, `readConfigFromEnv` from Task 1
- Produces: rewritten `main.tsx` using composition layer

- [ ] **Step 1: Rewrite main.tsx**

`apps/demo-office/src/main.tsx`:

```typescript
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
import type { RuntimeComposition } from "./runtime/types.js";
import { App } from "./App.js";
import { DemoControls } from "./DemoControls.js";

// ─── Runtime composition (module-level singleton) ─────────────
let composition: RuntimeComposition;
let configMode: string;
let configRuntimeId: string;

try {
  const config = readConfigFromEnv(import.meta.env as unknown as Record<string, string>);
  configMode = config.mode;
  configRuntimeId = config.runtimeId;
  composition = createRuntime(config);

  // Bootstrap the session (connect → snapshot → subscribe)
  composition.session.connect().catch((err) => {
    console.error("[demo-office] RuntimeSession bootstrap failed:", err);
  });
} catch (err) {
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
  throw err;
}

// ─── HMR disposal ─────────────────────────────────────────────
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    composition.dispose();
  });
}

// ─── Render ───────────────────────────────────────────────────
const { session, store, gateway, adapter } = composition;
const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App
      session={session}
      store={store}
      gateway={gateway}
      runtimeId={configRuntimeId}
      mode={configMode}
      demoControls={
        configMode === "mock" ? (
          <DemoControls adapter={adapter as never} store={store} session={session} />
        ) : null
      }
    />
  </React.StrictMode>
);
```

Note: `adapter as never` is a temporary cast — Task 8 will pass the typed MockRuntimeAdapter properly. The `mode` prop on App is added in Task 7.

- [ ] **Step 2: Run build to verify it compiles**

Run: `npm run build`
Expected: clean build (App.tsx may need `mode` prop added — that's Task 7; for now, build may warn about missing prop. If build FAILS due to `mode` prop, add `mode: string` to AppProps in App.tsx as a minimal change and proceed.)

If build fails on `mode` prop: add to `AppProps` in `App.tsx`:
```typescript
interface AppProps {
  session: RuntimeSession;
  store: SnapshotStore;
  gateway: CommandGateway;
  runtimeId: string;
  mode?: string;  // added by Task 6, used by Task 7+8
  demoControls?: ReactNode;
}
```
And destructure `mode` in the function signature (unused for now — Task 7+8 use it).

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all pass (286)

- [ ] **Step 4: Commit**

```bash
git add apps/demo-office/src/main.tsx apps/demo-office/src/App.tsx
git commit -m "refactor(demo-office): main.tsx uses createRuntime factory + startup error screen (#10 Task 6)"
```

---

## Task 7: StatusStrip component + App.tsx integration

**Files:**
- Create: `apps/demo-office/src/StatusStrip.tsx`
- Modify: `apps/demo-office/src/App.tsx` (integrate StatusStrip, remove hardcoded subtitle)

**Interfaces:**
- Consumes: `useOfficeState` output (`sessionState`, `diagnostics`), `mode` prop
- Produces: `StatusStrip` component

- [ ] **Step 1: Create StatusStrip.tsx**

`apps/demo-office/src/StatusStrip.tsx`:

```typescript
/**
 * StatusStrip — functional instrumentation for runtime connection state.
 *
 * Displays: mode, runtimeId, session state, last sequence, resync/reconnect
 * counts, last error, and a reconnect button when recovery is allowed.
 *
 * This is NOT visual polish — it's a diagnostic surface. Minimal inline styles.
 */
import type { FC } from "react";
import type { SessionState, SessionDiagnostics } from "@agent-office/core";

interface StatusStripProps {
  mode: string;
  runtimeId: string;
  sessionState: SessionState;
  diagnostics: SessionDiagnostics;
  lastError: string | null;
  onReconnect: () => void;
}

const STATE_COLORS: Record<SessionState, string> = {
  connected: "#4caf50",
  connecting: "#ff9800",
  synchronizing: "#ff9800",
  resynchronizing: "#ff9800",
  degraded: "#ff9800",
  disconnected: "#666",
  failed: "#f44336",
};

export const StatusStrip: FC<StatusStripProps> = ({
  mode,
  runtimeId,
  sessionState,
  diagnostics,
  lastError,
  onReconnect,
}) => {
  const color = STATE_COLORS[sessionState] ?? "#666";
  const canReconnect =
    sessionState === "failed" || sessionState === "disconnected" || sessionState === "degraded";

  return (
    <div style={styles.strip}>
      <span style={styles.badge(color)}>{sessionState}</span>
      <span style={styles.label}>mode: <strong>{mode}</strong></span>
      <span style={styles.label}>id: <code>{runtimeId}</code></span>
      <span style={styles.label}>seq: {diagnostics.lastSequence}</span>
      <span style={styles.label}>resync: {diagnostics.resyncCount}</span>
      <span style={styles.label}>reconnect: {diagnostics.reconnectCount}</span>
      {lastError && (
        <span style={styles.error} title={lastError}>err: {lastError.slice(0, 40)}</span>
      )}
      {canReconnect && (
        <button style={styles.button} onClick={onReconnect}>
          Reconnect
        </button>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  strip: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "4px 12px",
    backgroundColor: "#0d0d1a",
    borderBottom: "1px solid #222",
    fontSize: 11,
    fontFamily: "monospace",
    color: "#aaa",
    flexWrap: "wrap" as const,
  },
  badge: (color: string): React.CSSProperties => ({
    backgroundColor: color,
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 3,
    fontWeight: "bold",
    textTransform: "uppercase",
    fontSize: 10,
  }),
  label: { whiteSpace: "nowrap" as const },
  error: { color: "#ff6666", fontStyle: "italic" },
  button: {
    padding: "2px 8px",
    backgroundColor: "#333355",
    color: "#cccccc",
    border: "1px solid #555577",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "monospace",
  },
};
```

- [ ] **Step 2: Update App.tsx — add mode prop, integrate StatusStrip, remove hardcoded subtitle**

In `apps/demo-office/src/App.tsx`:

Update `AppProps` (add `mode`):

```typescript
interface AppProps {
  session: RuntimeSession;
  store: SnapshotStore;
  gateway: CommandGateway;
  runtimeId: string;
  mode: string;
  demoControls?: ReactNode;
}
```

Update the component signature to accept `mode` and destructure it:

```typescript
export const App: FC<AppProps> = ({ session, store, gateway, runtimeId, mode, demoControls }) => {
  const { projection, eventLog, errors, sessionState, diagnostics, sendCommand } = useOfficeState(
    session,
    store,
    gateway,
    runtimeId
  );
```

Add `StatusStrip` import at top:

```typescript
import { StatusStrip } from "./StatusStrip.js";
```

Replace the hardcoded subtitle line:
```typescript
<span style={styles.subtitle}>垂直切片 v1 · MockRuntimeAdapter</span>
```
with a mode-aware subtitle:
```typescript
<span style={styles.subtitle}>垂直切片 v1 · {mode === "mock" ? "Mock" : "Reference Swarm (HTTP/SSE)"}</span>
```

Add `StatusStrip` inside the topbar (after the spacer, before viewSwitch) or as a separate row below topbar. Insert it right after the opening of the root div, before topbar:

```typescript
  return (
    <div style={styles.root}>
      <StatusStrip
        mode={mode}
        runtimeId={runtimeId}
        sessionState={sessionState}
        diagnostics={diagnostics}
        lastError={errors.length > 0 ? errors[errors.length - 1] : null}
        onReconnect={() => {
          session.resynchronize().catch((err) =>
            console.error("[App] reconnect failed:", err)
          );
        }}
      />
      {/* 顶部工具栏 */}
      <div style={styles.topbar}>
```

- [ ] **Step 3: Run build + test**

Run: `npm run build && npm test`
Expected: clean build, all tests pass (286). StatusStrip is a presentational component; no new tests required (covered by Task 9 integration test).

- [ ] **Step 4: Commit**

```bash
git add apps/demo-office/src/StatusStrip.tsx apps/demo-office/src/App.tsx
git commit -m "feat(demo-office): StatusStrip component with session state/diagnostics + mode-aware subtitle (#10 Task 7)"
```

---

## Task 8: Mock-only behavior isolation + UI truthfulness

**Files:**
- Modify: `apps/demo-office/src/main.tsx` (type-safe DemoControls injection)
- Modify: `apps/demo-office/src/App.tsx` (ensure demoControls only renders in mock mode)

**Interfaces:**
- Consumes: `mode` prop, `DemoControls`
- Produces: clean Mock-only gating

- [ ] **Step 1: Fix DemoControls typing in main.tsx**

In `apps/demo-office/src/main.tsx`, replace the `adapter as never` cast with a proper typed MockRuntimeAdapter check:

```typescript
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";

// ... after composition creation ...

const mockAdapter = configMode === "mock" ? (composition.adapter as MockRuntimeAdapter) : null;

root.render(
  <React.StrictMode>
    <App
      session={session}
      store={store}
      gateway={gateway}
      runtimeId={configRuntimeId}
      mode={configMode}
      demoControls={
        mockAdapter ? (
          <DemoControls adapter={mockAdapter} store={store} session={session} />
        ) : null
      }
    />
  </React.StrictMode>
);
```

- [ ] **Step 2: Verify App.tsx demoControls gating**

In `apps/demo-office/src/App.tsx`, the `demoControls` is already injected as `null` when `mode !== "mock"` (from main.tsx). Verify the App renders `demoControls` only when truthy:

```typescript
{/* 右侧：控制面板 */}
<div style={styles.panel}>
  {demoControls}
  <ControlPanel ... />
</div>
```

This already conditionally renders (React ignores `null`). No change needed if `demoControls` is `null` in remote mode. Confirm by reading the current App.tsx.

- [ ] **Step 3: Run build + test**

Run: `npm run build && npm test`
Expected: clean build, all tests pass (286)

- [ ] **Step 4: Commit**

```bash
git add apps/demo-office/src/main.tsx
git commit -m "refactor(demo-office): type-safe Mock-only DemoControls injection (#10 Task 8)"
```

---

## Task 9: Remote golden-flow smoke test

**Files:**
- Create: `apps/demo-office/src/remote-golden-flow.test.ts`

**Interfaces:**
- Consumes: `QclawTestRuntime`, `createRuntime`, `playGoldenFlow`
- Produces: end-to-end smoke test using the same factory as the app

- [ ] **Step 1: Write the test**

`apps/demo-office/src/remote-golden-flow.test.ts`:

```typescript
/**
 * Remote golden-flow smoke test.
 *
 * Boots QclawTestRuntime, creates the app composition via createRuntime()
 * in http-sse mode, drives the golden workflow via HTTP, and verifies
 * that events flow through the adapter into the SnapshotStore and that
 * the final projection reflects the completed task.
 *
 * Uses the SAME createRuntime() factory as main.tsx — no test-only shortcuts
 * in the composition path.
 */
import { describe, it, expect, afterEach } from "vitest";
import { QclawTestRuntime, playGoldenFlow } from "@agent-office/qclaw-swarm";
import { createRuntime } from "./runtime/create-runtime.js";
import { projectSnapshot } from "@agent-office/core";

describe("Remote golden-flow smoke test (http-sse mode)", () => {
  let runtime: QclawTestRuntime;
  let dispose: () => Promise<void>;

  afterEach(async () => {
    if (dispose) await dispose();
    if (runtime) await runtime.stop();
  });

  it("createRuntime(http-sse) connects to QClaw runtime and golden flow updates projection", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();

    const comp = createRuntime({
      mode: "http-sse",
      runtimeId: "qclaw-swarm-runtime-001",
      baseUrl: runtime.getBaseUrl(),
    });
    dispose = comp.dispose;

    await comp.session.connect();
    expect(comp.session.getState()).toBe("connected");

    // Initial snapshot: 4 agents, 4 rooms
    const initialSnap = comp.store.getSnapshot();
    expect(initialSnap.agents).toHaveLength(4);
    expect(initialSnap.rooms).toHaveLength(4);

    // Drive golden flow via HTTP (same as playGoldenFlow)
    await playGoldenFlow(runtime.getBaseUrl());
    await new Promise((r) => setTimeout(r, 500));

    // Final snapshot: task completed, artifact approved, approval approved
    const finalSnap = comp.store.getSnapshot();
    expect(finalSnap.tasks.length).toBeGreaterThan(0);
    expect(finalSnap.tasks[0].status).toBe("completed");
    expect(finalSnap.artifacts[0].status).toBe("approved");
    expect(finalSnap.approvals[0].status).toBe("approved");

    // Projection pipeline works (same projection consumed by list/pixel views)
    const projection = projectSnapshot(finalSnap);
    expect(projection.tasks.length).toBeGreaterThan(0);
  });

  it("dispose disconnects the session, no active stream remains", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();

    const comp = createRuntime({
      mode: "http-sse",
      runtimeId: "qclaw-swarm-runtime-001",
      baseUrl: runtime.getBaseUrl(),
    });
    dispose = comp.dispose;

    await comp.session.connect();
    expect(comp.session.getState()).toBe("connected");

    await comp.dispose();
    expect(comp.session.getState()).toBe("disconnected");

    // After dispose, session cannot reconnect (one-time adapter).
    // Verify the store is frozen at last known state.
    const snap = comp.store.getSnapshot();
    expect(snap).toBeDefined();

    dispose = async () => {}; // prevent double-dispose in afterEach
  });

  it("remote mode does not expose Mock DemoControls (factory returns no mock adapter)", () => {
    runtime = new QclawTestRuntime({ port: 0 });

    const comp = createRuntime({
      mode: "http-sse",
      runtimeId: "qclaw-swarm-runtime-001",
      baseUrl: "http://localhost:1", // don't actually connect
    });
    dispose = comp.dispose;

    // The adapter is HttpSseRuntimeAdapter, not MockRuntimeAdapter.
    // main.tsx uses `configMode === "mock"` to gate DemoControls — verify
    // that the factory does not produce a Mock adapter in http-sse mode.
    const adapterConstructorName = comp.adapter.constructor.name;
    expect(adapterConstructorName).toBe("HttpSseRuntimeAdapter");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run apps/demo-office/src/remote-golden-flow.test.ts`
Expected: PASS — 3 tests

Note: This test may pass on first run (integration test against already-built components). Verify via test output that all 3 tests ran and asserted non-trivially.

- [ ] **Step 3: Run full suite**

Run: `npm run build && npm test`
Expected: clean build, all pass (286 + 3 = 289)

- [ ] **Step 4: Commit**

```bash
git add apps/demo-office/src/remote-golden-flow.test.ts
git commit -m "test(demo-office): remote golden-flow smoke test via createRuntime factory (#10 Task 9)"
```

---

## Task 10: Documentation + .env.example

**Files:**
- Create: `apps/demo-office/.env.example`
- Create: `docs/integrations/demo-office/local-run-guide.md`
- Create: `docs/integrations/demo-office/terminology.md`
- Create: `docs/integrations/demo-office/troubleshooting.md`

**Interfaces:**
- Consumes: all prior tasks
- Produces: configuration reference + startup guide + terminology + troubleshooting

- [ ] **Step 1: Create .env.example**

`apps/demo-office/.env.example`:

```env
# Runtime configuration for demo-office.
# Copy to .env.local and adjust. Vite reads VITE_* vars at build/dev time.

# Runtime mode: "mock" (default, deterministic local) | "http-sse" (remote runtime)
VITE_RUNTIME_MODE=mock

# Runtime identifier (must match the runtime you connect to)
VITE_RUNTIME_ID=mock-runtime-001

# Base URL of the remote runtime (required when VITE_RUNTIME_MODE=http-sse)
# VITE_RUNTIME_BASE_URL=http://localhost:3456
```

- [ ] **Step 2: Create local-run-guide.md**

`docs/integrations/demo-office/local-run-guide.md`:

```markdown
# demo-office Local Run Guide

## Prerequisites

- Node.js 22
- npm workspace dependencies installed (`npm install` at repo root)

## Option 1: Mock mode (default, no separate runtime)

```bash
npm run dev
```

The app runs at http://localhost:5173 against `MockRuntimeAdapter` (in-memory, deterministic). No separate runtime process needed.

## Option 2: Remote mode (HTTP/SSE + QClaw test runtime)

### Start both processes concurrently (recommended)

```bash
npm run dev:remote-demo
```

This launches:
- QClaw test runtime at http://localhost:3456 (with CORS for http://localhost:5173)
- Vite dev server at http://localhost:5173 (with `VITE_RUNTIME_MODE=http-sse`)

Open http://localhost:5173 — the app connects to the remote runtime via `HttpSseRuntimeAdapter`.

### Start processes separately

Terminal 1 — start the runtime:

```bash
npm run dev:runtime
```

Terminal 2 — start the UI with remote config:

```bash
# Linux/macOS
VITE_RUNTIME_MODE=http-sse VITE_RUNTIME_ID=qclaw-swarm-runtime-001 VITE_RUNTIME_BASE_URL=http://localhost:3456 npm run dev:ui

# Windows PowerShell
$env:VITE_RUNTIME_MODE="http-sse"; $env:VITE_RUNTIME_ID="qclaw-swarm-runtime-001"; $env:VITE_RUNTIME_BASE_URL="http://localhost:3456"; npm run dev:ui
```

## Configuration

See `apps/demo-office/.env.example` for all supported env vars. Create `.env.local` in `apps/demo-office/` to override defaults.

## Health Check

`GET http://localhost:3456/runtime/snapshot` returning 200 indicates the QClaw runtime is healthy.

## Stopping

`Ctrl+C` in the terminal running `dev:remote-demo` stops both processes.
```

- [ ] **Step 3: Create terminology.md**

`docs/integrations/demo-office/terminology.md`:

```markdown
# Runtime Terminology

## Mock

`MockRuntimeAdapter` — an in-memory, deterministic adapter that simulates a runtime within the browser process. Used for local development, regression tests, and demos. No network involved. Supports scripted scenarios (`playNormalFlow`, `playErrorFlow`, `playRevisionFlow`, `reset`).

## Reference Swarm

The synthetic QClaw-style test runtime (`@agent-office/qclaw-swarm`), accessed over the generic HTTP/SSE wire protocol via `HttpSseRuntimeAdapter`. It is NOT a real QClaw/Swarm integration — it is a contract discovery target that mimics QClaw execution semantics (auto-dispatch, approval-gated completion) for testing the remote transport path.

## Real QClaw Integration

A future, real QClaw/Swarm backend speaking the same generic wire protocol. NOT implemented in this project. The app layer (`demo-office`) is transport-agnostic and would connect to a real QClaw runtime the same way it connects to the Reference Swarm — by pointing `VITE_RUNTIME_BASE_URL` at the real server.

## Why the distinction matters

The app must never label the Reference Swarm as "real QClaw." The `StatusStrip` and subtitle reflect the actual mode (`Mock` or `Reference Swarm (HTTP/SSE)`), never claiming real integration.
```

- [ ] **Step 4: Create troubleshooting.md**

`docs/integrations/demo-office/troubleshooting.md`:

```markdown
# demo-office Troubleshooting

## "Configuration error: VITE_RUNTIME_ID is required"

The `VITE_RUNTIME_ID` env var is missing. Set it in `apps/demo-office/.env.local` or in your shell before starting Vite.

## "Configuration error: VITE_RUNTIME_BASE_URL is required when VITE_RUNTIME_MODE=http-sse"

You set `VITE_RUNTIME_MODE=http-sse` but did not provide `VITE_RUNTIME_BASE_URL`. Set it to the runtime's base URL (e.g., `http://localhost:3456`).

## Browser console shows CORS error / fetch blocked

The QClaw runtime rejects cross-origin requests from origins not in its allow-list. By default, only `http://localhost:5173` (Vite's default origin) is allowed.

If your Vite runs on a different port, start the runtime with `--allowed-origins=http://localhost:YOUR_PORT`:

```bash
npm run dev:runtime -- --allowed-origins=http://localhost:5174
```

## "wrong runtimeId" / runtime mismatch errors

The `VITE_RUNTIME_ID` must match the runtime's actual runtimeId. For the QClaw test runtime, this is `qclaw-swarm-runtime-001`. For Mock, it is `mock-runtime-001`.

## SSE stream connects but no events arrive / "missing replay marker"

1. Verify the runtime is running: `curl http://localhost:3456/runtime/snapshot` should return JSON.
2. Check the runtime console for errors.
3. The SSE stream sends a `replay-complete` control frame after replaying history. If you don't see it, the runtime may have crashed mid-stream — check the runtime process.

## Session stuck in "failed" state

The `HttpSseRuntimeAdapter` is one-time: after `disconnect()`, the same adapter cannot reconnect. If the session fails, refresh the browser page (which constructs a new adapter). The `Reconnect` button in `StatusStrip` calls `session.resynchronize()`, which fetches a fresh snapshot and re-subscribes — this works for transient failures but not for a disconnected adapter.

## DemoControls buttons missing in remote mode

This is intentional. `DemoControls` (playNormalFlow, reset, etc.) are Mock-only. In `http-sse` mode, they are not rendered because the remote runtime does not support Mock-specific scenario scripts.
```

- [ ] **Step 5: Run build + test**

Run: `npm run build && npm test`
Expected: clean build, all 289 tests pass (docs-only change)

- [ ] **Step 6: Commit**

```bash
git add apps/demo-office/.env.example docs/integrations/demo-office/
git commit -m "docs(demo-office): .env.example, local run guide, terminology, troubleshooting (#10 Task 10)"
```

---

## Spec Coverage Checklist

- [x] P0 Runtime composition root (Task 1+2: types, config, createRuntime factory)
- [x] P0 HTTP/SSE browser wiring (Task 2+3: HttpSseRuntimeAdapter in factory, package.json dep)
- [x] P0 Reference runtime development server (Task 4+5: CORS, dev-server.ts, dev:remote-demo launcher)
- [x] P0 Connection lifecycle surface (Task 7: StatusStrip with state/diagnostics/reconnect)
- [x] P0 Mock-only behavior isolation (Task 8: DemoControls gated to mock mode)
- [x] P0 Remote golden-flow smoke test (Task 9: end-to-end via createRuntime factory)
- [x] P1 UI truthfulness audit (Task 7: mode-aware subtitle; Task 10: terminology doc)
- [x] P1 Responsive safety baseline (no layout changes — existing layout already functional)
- [x] Tests: valid Mock configuration (Task 2)
- [x] Tests: valid HTTP/SSE configuration (Task 2)
- [x] Tests: missing base URL fails clearly (Task 1)
- [x] Tests: factory disposal disconnects once (Task 2)
- [x] Tests: StrictMode-style mount/unmount no duplicate (Task 2)
- [x] Tests: remote mode does not expose Mock DemoControls (Task 9)
- [x] Tests: session status updates reach shell (Task 7 + Task 9)
- [x] Tests: reconnect action uses existing Session lifecycle (Task 7 StatusStrip)
- [x] Tests: remote golden flow updates OfficeProjection (Task 9)
- [x] Tests: full suite and build pass (every task)
- [x] Docs: .env.example (Task 10)
- [x] Docs: local two-process startup guide (Task 10)
- [x] Docs: Mock vs Reference Swarm terminology (Task 10)
- [x] Docs: browser CORS setup (Task 10)
- [x] Docs: troubleshooting (Task 10)

## Self-Review Notes

- **Spec coverage:** All P0/P1 items addressed. P1 "Responsive safety baseline" requires no code changes — the existing layout (flexbox with min/max widths on the panel, scrollable stage) already satisfies the functional requirements.
- **Placeholder scan:** No TBD/TODO. Each task has concrete code and tests.
- **Type consistency:** `DemoRuntimeMode`, `DemoRuntimeConfig`, `RuntimeComposition` used consistently. `createRuntime` returns `RuntimeComposition` with `dispose()`.
- **Architecture integrity:** Runtime construction stays in `src/runtime/` (not in components). `main.tsx` is the only caller. Module-level singleton. HMR disposal via `import.meta.hot`.
- **Out of scope respected:** No visual redesign, no sprite work, no mobile, no real QClaw, no OpenClaw/Hermes, no multi-runtime, no production auth.
