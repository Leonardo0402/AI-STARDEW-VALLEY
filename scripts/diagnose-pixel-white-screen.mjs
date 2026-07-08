import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.DEMO_OFFICE_URL || "http://localhost:5175/";
const OUT_DIR = path.join(process.cwd(), ".issue-28-evidence");

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  // Do NOT disable GPU — we need WebGL/Pixi to render normally.
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const logs = [];
page.on("console", (msg) => {
  logs.push({ type: msg.type(), text: msg.text() });
});
page.on("pageerror", (err) => {
  logs.push({ type: "pageerror", text: err.message });
});

await page.goto(BASE_URL);
await page.waitForLoadState("load");
await page.waitForTimeout(3000);

await page.screenshot({ path: path.join(OUT_DIR, "screenshot-initial.png"), fullPage: true });

function collectCanvasState() {
  const canvas = document.querySelector("canvas.app-canvas") || document.querySelector("canvas");
  const stage = document.querySelector(".app-stage");
  const body = document.querySelector(".app-body");

  let gl = null;
  let glType = null;
  if (canvas) {
    gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    glType = gl ? (canvas.getContext("webgl2") ? "webgl2" : "webgl") : null;
  }

  const pixiApp = (globalThis).__pixiApp;
  const scene = (globalThis).__pixelOfficeScene;
  let pixiState = null;
  try {
    pixiState = pixiApp
      ? {
          exists: true,
          rendererType: pixiApp.renderer?.type,
          rendererWidth: pixiApp.renderer?.width,
          rendererHeight: pixiApp.renderer?.height,
          stageChildren: pixiApp.stage?.children?.length,
          contextLost: pixiApp.renderer?.gl?.isContextLost?.(),
          tickerStarted: pixiApp.ticker?.started,
        }
      : { exists: false };
  } catch {
    pixiState = { exists: true, error: "Failed to read Pixi app state" };
  }

  let sceneState = null;
  try {
    sceneState = scene
      ? {
          exists: true,
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
      : { exists: false };
  } catch {
    sceneState = { exists: true, error: "Failed to read scene state" };
  }

  return {
    url: window.location.href,
    canvas: canvas
      ? {
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          offsetWidth: canvas.offsetWidth,
          offsetHeight: canvas.offsetHeight,
          rect: canvas.getBoundingClientRect(),
          style: {
            display: canvas.style.display,
            visibility: canvas.style.visibility,
            opacity: canvas.style.opacity,
          },
          childNodes: canvas.childNodes.length,
        }
      : null,
    webgl: gl
      ? {
          type: glType,
          isContextLost: gl.isContextLost(),
          renderer: gl.getParameter(gl.RENDERER),
          vendor: gl.getParameter(gl.VENDOR),
          version: gl.getParameter(gl.VERSION),
        }
      : null,
    stage: stage
      ? {
          clientWidth: stage.clientWidth,
          clientHeight: stage.clientHeight,
          classList: Array.from(stage.classList),
        }
      : null,
    body: body
      ? {
          clientWidth: body.clientWidth,
          clientHeight: body.clientHeight,
        }
      : null,
    pixi: pixiState,
    scene: sceneState,
    hasMockAdapter: typeof window.__mockAdapter !== "undefined",
    globalPixiKeys: Object.keys(window).filter((k) => /pixi|pixiApp|app/i.test(k)),
  };
}

function sampleCanvasPixels() {
  const canvas = document.querySelector("canvas.app-canvas") || document.querySelector("canvas");
  if (!canvas) return { error: "No canvas element found" };
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return { error: "No WebGL context on canvas" };
  if (gl.isContextLost()) return { error: "WebGL context is lost" };

  const width = canvas.width;
  const height = canvas.height;
  const samples = [
    { x: Math.floor(width * 0.25), y: Math.floor(height * 0.25) },
    { x: Math.floor(width * 0.75), y: Math.floor(height * 0.25) },
    { x: Math.floor(width * 0.25), y: Math.floor(height * 0.75) },
    { x: Math.floor(width * 0.75), y: Math.floor(height * 0.75) },
    { x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
  ];
  const pixels = [];
  const rgba = new Uint8Array(4);
  for (const { x, y } of samples) {
    const ry = Math.max(0, Math.min(height - 1 - y, height - 1));
    gl.readPixels(x, ry, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    pixels.push({ x, y, rgba: Array.from(rgba) });
  }
  return { ok: true, width, height, pixels };
}

const initial = await page.evaluate(collectCanvasState);
const pixelSamples = await page.evaluate(sampleCanvasPixels);

// Try switching to List and back to Pixel.
const listBtn = await page.locator('button:has-text("List")').first();
if (await listBtn.isVisible().catch(() => false)) {
  await listBtn.click();
  await page.waitForTimeout(500);
  const pixelBtn = await page.locator('button:has-text("Pixel")').first();
  if (await pixelBtn.isVisible().catch(() => false)) {
    await pixelBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, "screenshot-after-toggle.png"), fullPage: true });
  }
}

const afterToggle = await page.evaluate(collectCanvasState);
const pixelSamplesAfterToggle = await page.evaluate(sampleCanvasPixels);

fs.writeFileSync(
  path.join(OUT_DIR, "diagnostics.json"),
  JSON.stringify(
    {
      url: BASE_URL,
      initial,
      pixelSamples,
      afterToggle,
      pixelSamplesAfterToggle,
      consoleLogs: logs,
    },
    null,
    2
  )
);

console.log("Diagnostics written to", OUT_DIR);
console.log(JSON.stringify({ initial, pixelSamples }, null, 2));

await browser.close();
