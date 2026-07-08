import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.DEMO_OFFICE_URL || "http://localhost:5173/";
const OUT_DIR = path.join(process.cwd(), ".issue-28-evidence");

fs.mkdirSync(OUT_DIR, { recursive: true });

async function assertScreenshotRendered(page, selector, stateName) {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`Element ${selector} not found for ${stateName}`);
  }

  // Capture the composited browser output for the canvas region, not the WebGL
  // back buffer, which may be cleared after presentation.
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
    throw new Error(`Screenshot analysis failed for ${stateName}: ${result.error}`);
  }

  // A blank canvas has near-zero color variation. The idle office scene has
  // multiple room colors and agents, so expect significant variation.
  if (result.variation < 100) {
    throw new Error(
      `Canvas appears blank for ${stateName} (variation=${result.variation}). Sampled pixels: ${JSON.stringify(result.pixels)}`
    );
  }

  return result;
}

async function collectDiagnostics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.app-canvas") || document.querySelector("canvas");
    const pixiApp = window.__pixiApp;
    const scene = window.__pixelOfficeScene;

    return {
      url: window.location.href,
      canvas: canvas
        ? {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
          }
        : null,
      pixi: pixiApp
        ? {
            rendererType: pixiApp.renderer?.type,
            rendererWidth: pixiApp.renderer?.width,
            rendererHeight: pixiApp.renderer?.height,
            stageChildren: pixiApp.stage?.children?.length,
            contextLost: pixiApp.renderer?.gl?.isContextLost?.(),
            tickerStarted: pixiApp.ticker?.started,
          }
        : { exists: false },
      scene: scene
        ? {
            initialized: scene.initialized,
            destroyed: scene.destroyed,
            useSpriteRenderer: scene.useSpriteRenderer,
            contentRootChildren: scene.contentRoot?.children?.length,
            roomLayerChildren: scene.roomLayer?.children?.length,
            agentLayerChildren: scene.agentLayer?.children?.length,
            overlayLayerChildren: scene.overlayLayer?.children?.length,
            currentProjectionRooms: scene.currentProjection?.rooms?.length ?? null,
            currentProjectionAgents: scene.currentProjection?.agents?.length ?? null,
          }
        : { exists: false },
    };
  });
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const logs = [];
page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
page.on("pageerror", (err) => logs.push({ type: "pageerror", text: err.message }));

try {
  await page.goto(BASE_URL);
  await page.waitForLoadState("load");
  await page.waitForTimeout(3000);

  const screenshotPath = path.join(OUT_DIR, "regression-default-pixel.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const diagnostics = await collectDiagnostics(page);
  const renderCheck = await assertScreenshotRendered(page, "canvas.app-canvas", "default-pixel-startup");

  const reportPath = path.join(OUT_DIR, "regression-report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        url: BASE_URL,
        screenshot: screenshotPath,
        diagnostics,
        renderCheck,
        consoleLogs: logs,
        passed: true,
      },
      null,
      2
    )
  );

  console.log("Default Pixel view regression passed.");
  console.log(JSON.stringify({ diagnostics, renderCheck: { variation: renderCheck.variation } }, null, 2));
} catch (err) {
  fs.writeFileSync(
    path.join(OUT_DIR, "regression-report.json"),
    JSON.stringify({ url: BASE_URL, consoleLogs: logs, passed: false, error: err.message }, null, 2)
  );
  console.error("Default Pixel view regression failed:", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
