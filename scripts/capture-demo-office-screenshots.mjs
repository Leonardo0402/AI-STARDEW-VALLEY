import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.DEMO_OFFICE_URL || "http://localhost:5173/";
const BASE_OUT_DIR = process.argv[2] || path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline");

const RESOLUTIONS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function assertCanvasRendered(page, stateName) {
  const box = await page.locator("canvas.app-canvas").boundingBox();
  if (!box) {
    throw new Error(`Canvas element not found for ${stateName}`);
  }

  // Capture the composited browser output for the canvas region. Reading the
  // WebGL back buffer directly is unreliable because the browser may clear it
  // after presentation unless preserveDrawingBuffer is enabled.
  const screenshotBuffer = await page.screenshot({
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    type: "png",
  });

  const result = await page.evaluate(async (base64) => {
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

  if (result.error) {
    throw new Error(`Canvas render check failed for ${stateName}: ${result.error}`);
  }

  // A truly blank canvas has near-zero color variation. The idle office has
  // distinct room colors and agents, so expect meaningful variation.
  if (result.variation < 100) {
    throw new Error(
      `Canvas appears blank for ${stateName} (variation=${result.variation}). Sampled pixels: ${JSON.stringify(result.pixels)}`
    );
  }
}

async function capture(page, outDir, name, viewportWidth, viewportHeight) {
  const filePath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  await assertScreenshot(page, filePath, viewportWidth, viewportHeight);
  if (name === "01-idle-office") {
    await assertCanvasRendered(page, name);
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

let browser;

const skippedStates = [];

function skipState(name, reason) {
  const entry = `${name}: ${reason}`;
  if (!skippedStates.includes(entry)) {
    skippedStates.push(entry);
    console.log(`Skipped state: ${entry}`);
  }
}

try {
  browser = await chromium.launch({
    headless: true,
    // WebGL is required for PixiJS. Headless Chromium uses SwiftShader software
    // WebGL by default; do not pass --disable-gpu or --disable-software-rasterizer.
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  for (const { width, height } of RESOLUTIONS) {
    const outDir = path.join(BASE_OUT_DIR, `${width}x${height}`);
    fs.mkdirSync(outDir, { recursive: true });

    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();

    await page.goto(BASE_URL);
    await waitForStable(page);
    await sleep(2000);

    // Rebind capture to this resolution's output directory.
    const captureHere = (name) => capture(page, outDir, name, width, height);

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

    // 11. Runtime failed
    await clickButton(page, "重置");
    await sleep(1000);
    await clickButton(page, "异常: 运行失败");
    await waitForText(page, "failed");
    await sleep(500);
    await captureHere("11-runtime-failed");

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

    // 14. Artifact unsupported open (no demo button; driven via dev-only adapter hook)
    await clickButton(page, "重置");
    await sleep(1000);
    await runAdapterFlow(page, "playArtifactUnsupportedOpenFlow");
    await waitForText(page, "旧版二进制产物");
    await clickViewButtonForArtifact(page, "旧版二进制产物");
    await waitForText(page, "Open failed.");
    await sleep(500);
    await captureHere("14-artifact-unsupported-open");

    await context.close();
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
  console.error("Screenshot capture failed:", err);
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
}
