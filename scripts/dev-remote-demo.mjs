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
