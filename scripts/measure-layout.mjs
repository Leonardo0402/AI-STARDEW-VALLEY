import { chromium } from "playwright";

const APP_URL = "http://localhost:5173";

const RESOLUTIONS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function measure(page) {
  return page.evaluate(() => {
    const rects = {};
    for (const sel of [".app-shell", ".app-body", ".app-stage", ".app-canvas", ".app-panel"]) {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        rects[sel] = { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    }
    const canvas = document.querySelector(".app-canvas");
    if (canvas) {
      rects["canvas-attr"] = { width: canvas.width, height: canvas.height };
    }
    const stage = document.querySelector(".app-stage");
    rects["stage-html"] = stage ? stage.innerHTML.slice(0, 400) : "no stage";
    return rects;
  });
}

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu", "--disable-software-rasterizer", "--disable-dev-shm-usage", "--no-sandbox"],
});

try {
  for (const resolution of RESOLUTIONS) {
    const context = await browser.newContext({ viewport: resolution, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const text = await page.locator("body").innerText().catch(() => "");
      if (text.includes("connected")) break;
      await delay(200);
    }
    await delay(1500);
    const viewLabel = await page.locator("button[aria-pressed='true']").first().innerText().catch(() => "unknown");
    const rects = await measure(page);
    rects["view-active"] = viewLabel;
    console.log(`\n${resolution.width}x${resolution.height}:`, JSON.stringify(rects, null, 2));
    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
}
