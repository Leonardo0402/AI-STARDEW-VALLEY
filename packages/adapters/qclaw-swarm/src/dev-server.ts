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
