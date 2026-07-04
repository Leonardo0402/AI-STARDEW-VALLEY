#!/usr/bin/env node
/**
 * Dev launcher: starts QClaw test runtime + Vite dev server sequentially.
 *
 * Order (P0-2 fix): runtime first → poll /runtime/snapshot for readiness →
 * then start Vite. Without this wait, the browser can connect to Vite and
 * boot the app before the runtime listens, and HttpSseRuntimeAdapter's
 * one-time connect() permanently fails on the first ECONNREFUSED.
 *
 * No external deps — uses child_process.spawn + global fetch (Node 18+).
 * Ctrl+C kills both processes.
 *
 * Usage: node scripts/dev-remote-demo.mjs
 */
import { spawn } from "node:child_process";

const RUNTIME_PORT = "3456";
const ALLOWED_ORIGIN = "http://localhost:5173";
const RUNTIME_READY_TIMEOUT_MS = 10_000;
const RUNTIME_POLL_INTERVAL_MS = 100;

function prefix(name, data) {
  return data
    .toString()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => `[${name}] ${l}`)
    .join("\n");
}

function startRuntime() {
  const runtime = spawn(
    "node",
    ["--import", "tsx", "packages/adapters/qclaw-swarm/src/dev-server.ts",
     `--port=${RUNTIME_PORT}`, `--allowed-origins=${ALLOWED_ORIGIN}`],
    { stdio: ["inherit", "pipe", "pipe"] }
  );
  runtime.stdout.on("data", (d) => process.stdout.write(prefix("runtime", d) + "\n"));
  runtime.stderr.on("data", (d) => process.stderr.write(prefix("runtime", d) + "\n"));
  return runtime;
}

async function waitForRuntimeReady(baseUrl) {
  const deadline = Date.now() + RUNTIME_READY_TIMEOUT_MS;
  const url = `${baseUrl}/runtime/snapshot`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        if (body && body.runtimeId) return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, RUNTIME_POLL_INTERVAL_MS));
  }
  throw new Error(
    `[dev-remote-demo] Runtime did not become ready within ${RUNTIME_READY_TIMEOUT_MS}ms at ${baseUrl}`
  );
}

function startVite() {
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
  vite.stdout.on("data", (d) => process.stdout.write(prefix("vite", d) + "\n"));
  vite.stderr.on("data", (d) => process.stderr.write(prefix("vite", d) + "\n"));
  return vite;
}

function killAll(processes) {
  console.log("\n[dev-remote-demo] Shutting down...");
  for (const p of processes) {
    try { p.kill("SIGTERM"); } catch { /* best-effort */ }
  }
  process.exit(0);
}

async function main() {
  const runtime = startRuntime();
  const processes = [runtime];

  process.on("SIGINT", () => killAll(processes));
  process.on("SIGTERM", () => killAll(processes));
  runtime.on("exit", (code) => {
    console.log(`[dev-remote-demo] Runtime exited with code ${code}`);
    killAll(processes);
  });

  const baseUrl = `http://localhost:${RUNTIME_PORT}`;
  try {
    await waitForRuntimeReady(baseUrl);
    console.log(`[dev-remote-demo] Runtime ready at ${baseUrl}`);
  } catch (err) {
    console.error(String(err));
    killAll(processes);
    process.exit(1);
  }

  const vite = startVite();
  processes.push(vite);
  vite.on("exit", (code) => {
    console.log(`[dev-remote-demo] Vite exited with code ${code}`);
    killAll(processes);
  });
}

main().catch((err) => {
  console.error("[dev-remote-demo] Fatal:", err);
  process.exit(1);
});
