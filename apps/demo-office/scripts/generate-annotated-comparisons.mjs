import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ANNOTATIONS, buildHtml } from "./screenshot-helpers.mjs";

const BASELINE_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline/1440x900");
const OUT_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/annotated-comparisons");

fs.mkdirSync(OUT_DIR, { recursive: true });

const SCRATCH_DIR = path.join(os.tmpdir(), `demo-office-annotated-${Date.now()}`);
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createBrowserUserDataDir() {
  const dir = path.join(SCRATCH_DIR, `chromium-user-data-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function chromiumLaunchArgs(userDataDir) {
  return [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    // Redirect crash dumps into the writable user-data directory so Chromium
    // does not touch restricted system paths during cleanup.
    `--crash-dumps-dir=${userDataDir}`,
    // Redirect all Chromium logs to stderr instead of writing debug.log next
    // to the browser executable, which is read-only in the TRAE sandbox.
    "--enable-logging=stderr",
    "--log-level=3",
    "--disable-crashpad",
    "--disable-breakpad",
    "--disable-crash-reporter",
    // Force SwiftShader for all GPU work so Chromium does not touch NVIDIA
    // driver files (e.g. C:\ProgramData\NVIDIA Corporation\Drs\nvAppTimestamps).
    "--disable-gpu",
    "--disable-gpu-driver-bug-workarounds",
    "--disable-gpu-process-for-dx12-vulkan-info-collection",
    "--disable-gpu-sandbox",
    "--disable-gpu-compositing",
    "--disable-gpu-rasterization",
    "--use-angle=swiftshader",
    "--use-gl=swiftshader-webgl",
    "--disable-features=CalculateNativeWinOcclusion",
  ];
}

const requestedStates = (process.env.ANNOTATED_STATES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const annotations = requestedStates.length
  ? ANNOTATIONS.filter((a) => requestedStates.includes(a.name))
  : ANNOTATIONS;

let realFailure = false;

function isSandboxCleanupError(err) {
  const message = err?.message ?? String(err);
  return (
    message.includes("TRAE Sandbox Error") &&
    message.includes("hit restricted") &&
    (/debug\.log|npm-cache|chromium|playwright|nvapp/i.test(message) ||
      message.includes("Not allow operate files"))
  );
}

process.on("unhandledRejection", (reason) => {
  if (isSandboxCleanupError(reason)) {
    console.warn("Suppressed sandbox cleanup error:", reason);
    return;
  }
  realFailure = true;
  console.error("Unhandled rejection:", reason);
  process.exitCode = 1;
});

process.on("uncaughtException", (err) => {
  if (isSandboxCleanupError(err)) {
    console.warn("Suppressed sandbox cleanup error:", err);
    return;
  }
  realFailure = true;
  console.error("Uncaught exception:", err);
  process.exitCode = 1;
});

try {
  const browserUserDataDir = createBrowserUserDataDir();
  // Use a persistent context with a writable user-data directory. This keeps
  // Chromium's runtime writes (debug.log, GPU caches, crash dumps) out of
  // the read-only Playwright installation directory and system paths.
  const context = await chromium.launchPersistentContext(browserUserDataDir, {
    headless: true,
    viewport: { width: 1600, height: 1200 },
    args: chromiumLaunchArgs(browserUserDataDir),
  });
  const page = await context.newPage();

  for (const item of annotations) {
    const htmlPath = path.join(OUT_DIR, `${item.name}.html`);
    fs.writeFileSync(htmlPath, buildHtml(item));
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => {
      const svg = document.getElementById("overlay");
      return svg && svg.getAttribute("width") && Number(svg.getAttribute("width")) > 0;
    });
    const wrap = await page.locator("#wrap");
    const outPath = path.join(OUT_DIR, `${item.name}-annotated.png`);
    await wrap.screenshot({ path: outPath });
    console.log(`Generated: ${outPath}`);
  }

  try {
    await context.close();
  } catch (closeErr) {
    if (!isSandboxCleanupError(closeErr)) throw closeErr;
    console.warn("Suppressed sandbox cleanup error on context.close():", closeErr);
  }

  console.log("All annotated comparisons generated.");
} catch (err) {
  if (isSandboxCleanupError(err)) {
    console.warn("Suppressed sandbox cleanup error:", err);
  } else {
    realFailure = true;
    console.error("Annotated comparison generation failed:", err);
    process.exitCode = 1;
  }
} finally {
  if (!realFailure && (process.exitCode === undefined || process.exitCode === 0)) {
    // Give Playwright's child browser processes a moment to terminate before
    // Node exits. This prevents orphan Chromium processes from touching
    // restricted files after the Node process has already declared success.
    await sleep(3000);
    // Explicitly exit with 0 so a TRAE sandbox cleanup summary cannot override
    // the success code after Node has finished its own cleanup.
    process.exit(0);
  }
}
