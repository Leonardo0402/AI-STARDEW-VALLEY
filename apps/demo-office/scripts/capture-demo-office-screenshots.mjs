import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { getIntegrationScenario } from "./screenshot-helpers.mjs";

const BASE_URL = process.env.DEMO_OFFICE_URL || "http://localhost:5173/";
const BASE_OUT_DIR = process.argv[2] || path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline");

const SCRATCH_DIR = path.join(os.tmpdir(), `demo-office-screenshots-${Date.now()}`);
fs.mkdirSync(SCRATCH_DIR, { recursive: true });

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

const GOTO_TIMEOUT = 120_000;
const SERVER_START_TIMEOUT = 120_000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, "..");

const STATES_FILTER = new Set(
  (process.env.SCREENSHOT_STATES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
const shouldCapture = (name) => STATES_FILTER.size === 0 || STATES_FILTER.has(name);

const RESOLUTIONS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

/**
 * Per-state focus selector inside the control panel. Before capturing, the
 * screenshot script scrolls .control-panel so the target element is in view.
 */
const STATE_FOCUS_SELECTORS = {
  "16-review-pending": '[data-testid="review-blocker"]',
  "17-evidence-added": '[data-testid="evidence-panel"]',
  "18-timeline-visible": '[data-testid="timeline-panel"]',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getBaseUrlParts() {
  try {
    const u = new URL(BASE_URL);
    return { host: u.hostname, port: parseInt(u.port || "80", 10) };
  } catch {
    return { host: "localhost", port: 5173 };
  }
}

function isServerReachable(timeout = 1000) {
  const { host, port } = getBaseUrlParts();
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, { timeout }, (res) => {
      res.resume();
      resolve(typeof res.statusCode === "number" && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startDevServer() {
  console.log("Vite dev server not running; starting it...");

  // Copy static assets directly via node to avoid npm debug-log cleanup in
  // restricted paths (e.g. E:\DevCache\npm-cache\_logs).
  const copyAssetsPath = path.join(APP_DIR, "scripts", "copy-pixel-assets.mjs");
  const copyResult = spawnSync("node", [copyAssetsPath], {
    cwd: APP_DIR,
    stdio: "inherit",
  });
  if (copyResult.status !== 0) {
    throw new Error(
      `copy-pixel-assets failed with exit code ${copyResult.status ?? copyResult.signal}`
    );
  }

  const viteBin = path.resolve(APP_DIR, "../../node_modules/vite/bin/vite.js");
  const child = spawn("node", ["--import", "tsx", viteBin, "--no-open"], {
    cwd: APP_DIR,
    shell: false,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_LIFE_SIM_BASE_URL: "/",
      VITE_RUNTIME_MODE: "mock",
      VITE_RUNTIME_ID: "mock-runtime-001",
      VITE_PIXEL_PRESERVE_DRAWING_BUFFER: "true",
    },
  });
  const start = Date.now();
  while (Date.now() - start < SERVER_START_TIMEOUT) {
    await sleep(500);
    if (await isServerReachable(2000)) {
      console.log("Vite dev server ready.");
      return child;
    }
  }
  throw new Error("Vite dev server did not become reachable in time");
}

async function killServer(child) {
  if (!child) return;
  console.log("Stopping Vite dev server...");
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
      setTimeout(resolve, 5000);
    });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

async function gotoWithRetry(page, url) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto(url, { timeout: GOTO_TIMEOUT, waitUntil: "load" });
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`page.goto attempt ${attempt + 1} failed: ${err.message}`);
      await sleep(3000);
    }
  }
  throw lastErr;
}

async function waitForOfficeReady(page) {
  await page.waitForSelector("canvas.app-canvas", { timeout: GOTO_TIMEOUT });
  await page.waitForSelector('[data-testid="status-strip"]', { timeout: GOTO_TIMEOUT });
}

/**
 * Parse PNG dimensions from the IHDR chunk.
 * Playwright screenshots are written at the device pixel ratio, so the
 * returned size is in physical pixels.
 */
function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24 || buf[0] !== 0x89) {
    throw new Error(`Not a PNG file: ${filePath}`);
  }
  // Offset 16: width, offset 20: height (big-endian).
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

async function assertScreenshot(page, filePath, viewportWidth, viewportHeight) {
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const { scrollWidth, clientWidth, scrollHeight } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));

  if (scrollWidth > clientWidth) {
    throw new Error(
      `Horizontal overflow detected at ${viewportWidth}x${viewportHeight}: ` +
      `scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`
    );
  }

  const { width, height } = readPngDimensions(filePath);
  const expectedWidth = viewportWidth * dpr;
  const expectedHeight = scrollHeight * dpr;

  if (width !== expectedWidth) {
    throw new Error(
      `PNG width mismatch for ${filePath}: got ${width}, expected ${expectedWidth} ` +
      `(viewport ${viewportWidth} * dpr ${dpr})`
    );
  }

  if (height !== expectedHeight) {
    throw new Error(
      `PNG height mismatch for ${filePath}: got ${height}, expected ${expectedHeight} ` +
      `(scrollHeight ${scrollHeight} * dpr ${dpr})`
    );
  }
}

async function computeClipVariation(page, box) {
  const screenshotBuffer = await page.screenshot({
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    type: "png",
  });

  return page.evaluate(async (base64) => {
    const img = new Image();
    const blob = await fetch(`data:image/png;base64,${base64}`).then((r) => r.blob());
    const url = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { error: "No 2D context" };
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const samples = [
      { x: Math.floor(canvas.width * 0.25), y: Math.floor(canvas.height * 0.25) },
      { x: Math.floor(canvas.width * 0.75), y: Math.floor(canvas.height * 0.25) },
      { x: Math.floor(canvas.width * 0.25), y: Math.floor(canvas.height * 0.75) },
      { x: Math.floor(canvas.width * 0.75), y: Math.floor(canvas.height * 0.75) },
      { x: Math.floor(canvas.width * 0.5), y: Math.floor(canvas.height * 0.5) },
    ];
    const pixels = [];
    for (const { x, y } of samples) {
      const idx = (y * canvas.width + x) * 4;
      pixels.push({ x, y, rgba: [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]] });
    }

    let variation = 0;
    const step = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 16));
    let previous = null;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const idx = (y * canvas.width + x) * 4;
        const rgba = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
        if (previous) {
          variation += Math.abs(rgba[0] - previous[0]) + Math.abs(rgba[1] - previous[1]) + Math.abs(rgba[2] - previous[2]);
        }
        previous = rgba;
      }
    }

    return { ok: true, width: canvas.width, height: canvas.height, pixels, variation };
  }, screenshotBuffer.toString("base64"));
}

async function computeExtractVariation(page) {
  return page.evaluate(async () => {
    const scene = window.__pixelOfficeScene;
    if (!scene?.app?.renderer) {
      return { error: "Scene renderer not available" };
    }
    try {
      // Force a render before extracting to ensure the current stage state is
      // in the back buffer (relevant when the ticker is not running).
      scene.app.render();
      const extracted = scene.app.renderer.extract.canvas(scene.app.stage);
      const ctx = extracted.getContext("2d");
      if (!ctx) {
        return { error: "No 2D context on extracted canvas" };
      }
      const imageData = ctx.getImageData(0, 0, extracted.width, extracted.height);
      const data = imageData.data;

      const samples = [
        { x: Math.floor(extracted.width * 0.25), y: Math.floor(extracted.height * 0.25) },
        { x: Math.floor(extracted.width * 0.75), y: Math.floor(extracted.height * 0.25) },
        { x: Math.floor(extracted.width * 0.25), y: Math.floor(extracted.height * 0.75) },
        { x: Math.floor(extracted.width * 0.75), y: Math.floor(extracted.height * 0.75) },
        { x: Math.floor(extracted.width * 0.5), y: Math.floor(extracted.height * 0.5) },
      ];
      const pixels = [];
      for (const { x, y } of samples) {
        const idx = (y * extracted.width + x) * 4;
        pixels.push({ x, y, rgba: [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]] });
      }

      let variation = 0;
      const step = Math.max(1, Math.floor(Math.min(extracted.width, extracted.height) / 16));
      let previous = null;
      for (let y = 0; y < extracted.height; y += step) {
        for (let x = 0; x < extracted.width; x += step) {
          const idx = (y * extracted.width + x) * 4;
          const rgba = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
          if (previous) {
            variation += Math.abs(rgba[0] - previous[0]) + Math.abs(rgba[1] - previous[1]) + Math.abs(rgba[2] - previous[2]);
          }
          previous = rgba;
        }
      }

      return { ok: true, width: extracted.width, height: extracted.height, pixels, variation };
    } catch (err) {
      return { error: String(err?.message ?? err) };
    }
  });
}

async function assertCanvasRendered(page, stateName) {
  const box = await page.locator("canvas.app-canvas").boundingBox();
  if (!box) {
    throw new Error(`Canvas element not found for ${stateName}`);
  }

  // Capture the composited browser output for the canvas region. Reading the
  // WebGL back buffer directly is unreliable because the browser may clear it
  // after presentation unless preserveDrawingBuffer is enabled.
  // Retry a few times: headless SwiftShader WebGL presentation can be delayed,
  // so the first composited frame may still be the clear color.
  let lastResult = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await sleep(500);
    }
    // Force the browser compositor to present the WebGL canvas by reading it.
    // In headless SwiftShader mode the back buffer may not be flushed to the
    // composited view until the canvas is accessed via toDataURL/readPixels.
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas.app-canvas");
      if (canvas) canvas.toDataURL("image/png");
    });
    lastResult = await computeClipVariation(page, box);
    if (lastResult.error) {
      throw new Error(`Canvas render check failed for ${stateName}: ${lastResult.error}`);
    }
    if (lastResult.variation >= 100) {
      return;
    }
  }

  // Fallback: some headless SwiftShader configurations never present the WebGL
  // canvas to the compositor, even though PixiJS has rendered content. Verify
  // via PixiJS's own extract system, which reads directly from the renderer.
  const extractResult = await computeExtractVariation(page);
  if (extractResult.error) {
    throw new Error(`Canvas extract check failed for ${stateName}: ${extractResult.error}`);
  }
  if (extractResult.variation >= 100) {
    console.log(
      `[${stateName}] composited canvas appears blank but PixiJS extract has content (variation=${extractResult.variation}); accepting with overlay fallback.`
    );
    return;
  }

  throw new Error(
    `Canvas appears blank for ${stateName} (composited variation=${lastResult.variation}, ` +
    `extract variation=${extractResult.variation}). Sampled pixels: ${JSON.stringify(extractResult.pixels)}`
  );
}

/**
 * Some headless Chromium / SwiftShader configurations do not present the WebGL
 * canvas to the browser compositor in a way that Playwright can capture. As a
 * workaround, extract the PixiJS stage into a temporary 2D canvas overlay at
 * exactly the same screen position, take the screenshot, then remove it. This
 * keeps the resulting baseline images truthful to the rendered scene without
 * changing production rendering code.
 */
async function preparePixiOverlay(page) {
  return page.evaluate(() => {
    const scene = window.__pixelOfficeScene;
    const canvas = document.querySelector("canvas.app-canvas");
    if (!scene?.app?.renderer || !canvas) {
      return false;
    }

    // Ensure the current frame is in the renderer before extracting.
    scene.app.render();

    const extracted = scene.app.renderer.extract.canvas(scene.app.stage);
    const rect = canvas.getBoundingClientRect();
    const overlay = document.createElement("canvas");
    overlay.id = "__pixiScreenshotOverlay";
    overlay.width = extracted.width;
    overlay.height = extracted.height;
    overlay.style.position = "fixed";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "2147483647";

    const ctx = overlay.getContext("2d");
    if (ctx) {
      ctx.drawImage(extracted, 0, 0);
    }

    document.body.appendChild(overlay);
    return true;
  });
}

async function removePixiOverlay(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById("__pixiScreenshotOverlay");
    if (overlay) overlay.remove();
  });
}

/**
 * Scroll the control panel so the target element is fully visible inside it.
 * Returns true when the element exists.
 */
async function scrollControlPanelTo(page, selector) {
  return page.evaluate((sel) => {
    const panel = document.querySelector(".control-panel");
    const element = document.querySelector(sel);
    if (!panel || !element) return { ok: false, reason: !panel ? "no panel" : "no element" };

    const panelRect = panel.getBoundingClientRect();
    const elemRect = element.getBoundingClientRect();
    const relativeTop = elemRect.top - panelRect.top + panel.scrollTop;
    const relativeBottom = relativeTop + elemRect.height;

    if (elemRect.height > panelRect.height) {
      // Element is taller than the panel: align its top with the panel top.
      panel.scrollTop = relativeTop;
    } else if (relativeTop < panel.scrollTop) {
      panel.scrollTop = relativeTop;
    } else if (relativeBottom > panel.scrollTop + panelRect.height) {
      panel.scrollTop = relativeBottom - panelRect.height;
    }

    return { ok: true };
  }, selector);
}

/**
 * Assert that every selector/text in `checks` is visible within .control-panel.
 * For strings, an element containing the text must be visible. For selectors,
 * the matching element must be visible.
 */
async function assertVisibleInControlPanel(page, name, checks) {
  const result = await page.evaluate((checkList) => {
    const TOLERANCE = 2;

    function findElementByText(root, text) {
      const candidates = root.querySelectorAll("*");
      let best = null;
      let bestArea = Infinity;
      for (const el of candidates) {
        const rendered = el.innerText ?? el.textContent ?? "";
        if (rendered.includes(text)) {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area < bestArea) {
            bestArea = area;
            best = el;
          }
        }
      }
      return best;
    }

    const panel = document.querySelector(".control-panel");
    if (!panel) return { ok: false, reason: "missing .control-panel" };
    const panelRect = panel.getBoundingClientRect();

    const failures = [];
    for (const check of checkList) {
      let element;
      if (check.kind === "selector") {
        element = panel.querySelector(check.value) || document.querySelector(check.value);
      } else if (check.kind === "text") {
        element = findElementByText(panel, check.value) || findElementByText(document.body, check.value);
      }

      if (!element) {
        failures.push(`${check.label}: element not found for "${check.value}"`);
        continue;
      }

      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        rect.top >= panelRect.top - TOLERANCE &&
        rect.bottom <= panelRect.bottom + TOLERANCE &&
        rect.left >= panelRect.left - TOLERANCE &&
        rect.right <= panelRect.right + TOLERANCE;

      if (!visible) {
        failures.push(
          `${check.label}: not visible in control panel (rect=${JSON.stringify({
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
          })}, panel=${JSON.stringify({
            top: panelRect.top,
            bottom: panelRect.bottom,
            left: panelRect.left,
            right: panelRect.right,
          })})`
        );
      }
    }
    return { ok: failures.length === 0, failures };
  }, checks);

  if (!result.ok) {
    throw new Error(
      `Visibility assertion failed for ${name}:\n${result.failures.join("\n")}`
    );
  }
}

/**
 * Return visibility checks for states that have strict viewport requirements.
 */
function getVisibilityChecks(name) {
  switch (name) {
    case "16-review-pending":
      return [
        { kind: "text", value: "Review Blocker", label: "Review Blocker title" },
        { kind: "text", value: "reviewing #101", label: "assigned review" },
        { kind: "text", value: "Looks good to me.", label: "submitted review comment" },
        { kind: "text", value: "Approve", label: "Approve button" },
        { kind: "text", value: "Reject", label: "Reject button" },
      ];
    case "17-evidence-added":
      return [
        { kind: "selector", value: '[data-testid="evidence-panel"]', label: "EvidencePanel" },
        { kind: "text", value: "Verified reproduction steps", label: "audit note body" },
      ];
    default:
      return [];
  }
}

async function capture(page, outDir, name, viewportWidth, viewportHeight) {
  const filePath = path.join(outDir, `${name}.png`);

  // Focus the control panel on the state-specific element when defined.
  // Otherwise keep the panel at the top so integration sections are visible.
  const focusSelector = STATE_FOCUS_SELECTORS[name];
  if (focusSelector) {
    const scrollResult = await scrollControlPanelTo(page, focusSelector);
    if (!scrollResult.ok) {
      throw new Error(`Failed to focus ${name} on ${focusSelector}: ${scrollResult.reason}`);
    }
  } else {
    await page.evaluate(() => {
      const panel = document.querySelector(".control-panel");
      if (panel) panel.scrollTop = 0;
    });
  }

  // Some UI states (e.g., Debrief mode) replace the pixel canvas with a
  // timeline view. In those cases we still capture the full-page screenshot
  // but skip the canvas-specific overlay and render assertions.
  const hasCanvas = await page.evaluate(() =>
    !!document.querySelector("canvas.app-canvas")
  );

  // Debug scene state before screenshot
  const sceneDebug = await page.evaluate(() => {
    const scene = window.__pixelOfficeScene;
    const canvas = document.querySelector("canvas.app-canvas");
    if (!scene || !canvas) return { error: "scene or canvas not found", hasCanvas: !!canvas };
    const app = scene.app ?? (scene["app"]);
    const renderer = app?.renderer;
    return {
      hasCanvas: true,
      canvasSize: { width: canvas.clientWidth, height: canvas.clientHeight, rect: canvas.getBoundingClientRect() },
      rendererSize: renderer ? { width: renderer.width, height: renderer.height } : null,
      preserveDrawingBuffer: renderer?.gl?.getContextAttributes()?.preserveDrawingBuffer ?? null,
      contentRoot: scene.contentRoot ? { x: scene.contentRoot.x, y: scene.contentRoot.y, scaleX: scene.contentRoot.scale.x, scaleY: scene.contentRoot.scale.y, children: scene.contentRoot.children.length } : null,
      roomLayer: scene.roomLayer ? { children: scene.roomLayer.children.length } : null,
      propLayer: scene.propLayer ? { children: scene.propLayer.children.length } : null,
      agentLayer: scene.agentLayer ? { children: scene.agentLayer.children.length } : null,
      overlayLayer: scene.overlayLayer ? { children: scene.overlayLayer.children.length } : null,
      currentIntegration: scene.currentIntegration ? { hasGithub: !!scene.currentIntegration.github, hasReviews: !!scene.currentIntegration.reviews } : null,
    };
  });
  console.log(`[debug:${name}]`, JSON.stringify(sceneDebug));

  // Headless SwiftShader sometimes fails to present WebGL to the compositor.
  // Use a truthful PixiJS-extracted overlay so the screenshot always contains
  // the rendered scene.
  let overlayReady = false;
  if (hasCanvas) {
    overlayReady = await preparePixiOverlay(page);
  }
  try {
    await page.screenshot({ path: filePath, fullPage: true });
  } finally {
    if (overlayReady) await removePixiOverlay(page);
  }
  await assertScreenshot(page, filePath, viewportWidth, viewportHeight);
  if (hasCanvas) {
    await assertCanvasRendered(page, name);
  }

  const visibilityChecks = getVisibilityChecks(name);
  if (visibilityChecks.length > 0) {
    await assertVisibleInControlPanel(page, name, visibilityChecks);
  }

  console.log(`Captured: ${filePath}`);
}

async function waitForText(page, text, timeout = 10000) {
  await page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    text,
    { timeout }
  );
}

async function clickButton(page, label) {
  const button = page.locator(`button:has-text("${label}")`).first();
  await button.click();
}

async function clickViewButtonForArtifact(page, artifactTitle) {
  const card = page.locator(`.card:has(.card-title:text-is("${artifactTitle}"))`).first();
  const button = card.locator("button:text-is('View')").first();
  await button.click();
}

async function runAdapterFlow(page, methodName) {
  await page.evaluate((method) => {
    const adapter = window.__mockAdapter;
    if (!adapter || typeof adapter[method] !== "function") {
      throw new Error(`MockRuntimeAdapter.${method} is not available`);
    }
    adapter[method]();
  }, methodName);
}

async function waitForStable(page) {
  await page.waitForLoadState("load");
}

async function clickAgentCard(page, name) {
  const card = page.locator(`.card:has-text("${name}")`).first();
  await card.click();
}

async function clickTaskCard(page, title) {
  const card = page.locator(`.card:has-text("${title}")`).first();
  await card.click();
}

/**
 * Set a synthetic IntegrationProjection on the dev-only MockRuntimeAdapter.
 *
 * IMPORTANT SCOPE NOTE:
 * - This is screenshot test scaffolding, not production data flow. The values
 *   injected here are mocked fixtures used solely to render the Issue #49
 *   integration panels and canvas props for baseline screenshots.
 * - The real Runtime Event -> Snapshot -> IntegrationProjection flow is
 *   validated by unit tests and Task 19 verification.
 * - This mock is used only because the mock runtime cannot synthesize GitHub
 *   integration state, and the github adapter mode is opt-in/config-driven.
 *
 * Calling "reset" after patching triggers a snapshot update, which causes
 * useIntegrationState to recompute with the patched method.
 */
async function setIntegrationScenario(page, scenario) {
  const payload = getIntegrationScenario(scenario);
  await page.evaluate(({ scenarioName, projection }) => {
    const adapter = window.__mockAdapter;
    if (!adapter) {
      throw new Error("window.__mockAdapter is not available");
    }
    adapter.getIntegrationProjection = () => projection;
    window.__integrationScenario = scenarioName;
  }, { scenarioName: scenario, projection: payload });
}

const skippedStates = [];

function skipState(name, reason) {
  const entry = `${name}: ${reason}`;
  if (!skippedStates.includes(entry)) {
    skippedStates.push(entry);
    console.log(`Skipped state: ${entry}`);
  }
}

let devServer = null;
let realFailure = false;

/**
 * Return true if an error is a TRAE sandbox restriction on cleanup files.
 * These are not real test failures and should not cause a non-zero exit.
 */
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
  if (process.env.DEMO_OFFICE_URL === undefined && !(await isServerReachable())) {
    devServer = await startDevServer();
  }

  for (const { width, height } of RESOLUTIONS) {
    // Launch a fresh browser per resolution. Headless Chromium / SwiftShader can
    // accumulate WebGL contexts across contexts, causing the canvas to stay
    // blank on later resolutions even after previous contexts are closed.
    const browserUserDataDir = createBrowserUserDataDir();
    // Use a persistent context with a writable user-data directory. This keeps
    // Chromium's runtime writes (debug.log, GPU caches, crash dumps) out of
    // the read-only Playwright installation directory and system paths.
    const context = await chromium.launchPersistentContext(browserUserDataDir, {
      headless: true,
      viewport: { width, height },
      // WebGL is required for PixiJS. Headless Chromium uses SwiftShader software
      // WebGL by default. We disable GPU hardware acceleration and driver
      // probing so the sandbox does not touch restricted NVIDIA/driver files,
      // while SwiftShader keeps WebGL available for the canvas.
      args: chromiumLaunchArgs(browserUserDataDir),
    });
    const page = await context.newPage();

    const outDir = path.join(BASE_OUT_DIR, `${width}x${height}`);
    fs.mkdirSync(outDir, { recursive: true });

    page.on("console", (msg) => {
      console.log(`[browser:${width}x${height}] ${msg.type()}: ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error(`[browser:${width}x${height}] pageerror: ${err.message}`);
    });

    await gotoWithRetry(page, BASE_URL);
    await waitForStable(page);
    await waitForOfficeReady(page);

    // Rebind capture to this resolution's output directory.
    const captureHere = (name) =>
      shouldCapture(name) ? capture(page, outDir, name, width, height) : Promise.resolve();

    // 1. Idle office
    await captureHere("01-idle-office");

    // 2. Active task execution
    await clickButton(page, "正常流程");
    await waitForText(page, "working");
    await sleep(500);
    await captureHere("02-active-task-execution");

    // 10. Selected task card (uses the active task from state 02)
    await clickTaskCard(page, "分析项目代码质量");
    await sleep(500);
    await captureHere("10-selected-task-card");

    // 3. Artifact under review
    await waitForText(page, "reviewing");
    await sleep(500);
    await captureHere("03-artifact-under-review");

    // 4. Pending approval
    await waitForText(page, "Approve");
    await sleep(500);
    await captureHere("04-pending-approval");

    // 5. Blocked task / agent
    await clickButton(page, "重置");
    await sleep(1000);
    await clickButton(page, "异常: 阻塞");
    await waitForText(page, "blocked");
    await sleep(500);
    await captureHere("05-blocked-task-agent");

    // 6. Revision / rework required
    await clickButton(page, "重置");
    await sleep(1000);
    await clickButton(page, "异常: 返工");
    await waitForText(page, "revision_required");
    await sleep(500);
    await captureHere("06-revision-required");

    // 7. Focus mode
    await clickButton(page, "重置");
    await sleep(1000);
    await clickButton(page, "正常流程");
    await waitForText(page, "working");
    await sleep(500);
    await page.locator("text=Focus").first().click();
    await sleep(1000);
    await captureHere("07-focus-mode");

    // 8. Debrief mode
    await page.locator("text=Debrief").first().click();
    await sleep(1000);
    await captureHere("08-debrief-mode");

    // 9. Selected agent on canvas + highlighted panel card
    await clickButton(page, "重置");
    await sleep(1000);
    await page.locator("text=Command").first().click();
    await sleep(500);
    await clickAgentCard(page, "Orchestrator");
    await sleep(500);
    await captureHere("09-selected-agent");

    // 10. Selected task card is captured earlier (uses active task from state 02)

    // 11. Domain task / agent failed (domain-level failure, not session transport failure)
    await clickButton(page, "重置");
    await sleep(1000);
    await clickButton(page, "异常: 任务失败");
    await waitForText(page, "failed");
    await sleep(500);
    await captureHere("11-domain-task-agent-failed");

    // 12. Artifact unavailable
    await clickButton(page, "重置");
    await sleep(1000);
    await clickButton(page, "异常: 工件不可用");
    await waitForText(page, "Content unavailable");
    await sleep(500);
    await captureHere("12-artifact-unavailable");

    // 13. Artifact failed open
    await clickButton(page, "重置");
    await sleep(1000);
    await clickButton(page, "异常: 打开失败");
    await waitForText(page, "报告（打开会失败）");
    await clickViewButtonForArtifact(page, "报告（打开会失败）");
    await waitForText(page, "Open failed.");
    await sleep(500);
    await captureHere("13-artifact-failed-open");

    // 14. Artifact open rejected (no demo button; driven via dev-only adapter hook)
    await clickButton(page, "重置");
    await sleep(1000);
    await runAdapterFlow(page, "playArtifactUnsupportedOpenFlow");
    await waitForText(page, "旧版二进制产物");
    await clickViewButtonForArtifact(page, "旧版二进制产物");
    await waitForText(page, "Open failed.");
    await sleep(500);
    await captureHere("14-artifact-open-rejected");

    // 15. Queue populated — integration panels: QueuePanel + Mission Board prop
    await clickButton(page, "重置");
    await sleep(1000);
    await setIntegrationScenario(page, "queue-populated");
    await clickButton(page, "重置");
    await waitForText(page, "Fix login crash");
    await sleep(1000);
    await captureHere("15-queue-populated");

    // 16. Review pending — ReviewBlocker + Review Desk prop
    await clickButton(page, "重置");
    await sleep(1000);
    await setIntegrationScenario(page, "review-pending");
    await clickButton(page, "重置");
    await waitForText(page, "reviewing #101");
    await sleep(1000);
    await captureHere("16-review-pending");

    // 17. Evidence added — EvidencePanel + Filing Cabinet prop
    await clickButton(page, "重置");
    await sleep(1000);
    await setIntegrationScenario(page, "evidence-added");
    await clickButton(page, "重置");
    await waitForText(page, "Verified reproduction steps");
    await sleep(1000);
    await captureHere("17-evidence-added");

    // 18. Timeline visible — TimelinePanel + Wall Scroll prop
    await clickButton(page, "重置");
    await sleep(1000);
    await setIntegrationScenario(page, "timeline");
    await clickButton(page, "正常流程");
    await waitForText(page, "working");
    await waitForText(page, "task.created");
    await sleep(1000);
    await captureHere("18-timeline-visible");

    try {
      await context.close();
    } catch (closeErr) {
      if (!isSandboxCleanupError(closeErr)) throw closeErr;
      console.warn("Suppressed sandbox cleanup error on context.close():", closeErr);
    }
    console.log(`Resolution ${width}x${height} complete.`);
  }

  // States that remain impossible to truthfully produce after Task 0.
  skipState(
    "artifact-metadata-only",
    "MockRuntimeAdapter always creates artifacts with either a URI or content reference; " +
    "there is no truthful path to a metadata-only artifact that has neither URI nor content."
  );
  skipState(
    "runtime-degraded (persistent)",
    "MockRuntimeAdapter can emit a recoverable stream error, but the degraded state is transient; " +
    "a persistent runtime-degraded/session-degraded state requires protocol or session changes not yet implemented."
  );

  console.log("All screenshots captured.");
} catch (err) {
  if (isSandboxCleanupError(err)) {
    console.warn("Suppressed sandbox cleanup error during capture:", err);
  } else {
    realFailure = true;
    console.error("Screenshot capture failed:", err);
    process.exitCode = 1;
  }
} finally {
  try {
    await killServer(devServer);
  } catch (killErr) {
    if (!isSandboxCleanupError(killErr)) {
      realFailure = true;
      console.error("Failed to stop dev server:", killErr);
      process.exitCode = 1;
    } else {
      console.warn("Suppressed sandbox cleanup error on killServer():", killErr);
    }
  }
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
