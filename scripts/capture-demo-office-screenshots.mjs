import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://127.0.0.1:5173/";
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

async function capture(page, outDir, name, viewportWidth, viewportHeight) {
  const filePath = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  await assertScreenshot(page, filePath, viewportWidth, viewportHeight);
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
    args: ["--disable-gpu", "--disable-software-rasterizer", "--no-sandbox", "--disable-dev-shm-usage"],
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

    await context.close();
    console.log(`Resolution ${width}x${height} complete.`);
  }

  // New states that cannot be truthfully produced by the current mock adapter.
  skipState(
    "artifact-metadata-only / unavailable / unsupported-open",
    "MockRuntimeAdapter always creates artifacts with a URI and reports ARTIFACT_OPEN as supported; " +
    "there is no truthful path to metadata-only, unavailable, or unsupported-open artifact content."
  );
  skipState(
    "runtime-degraded",
    "MockRuntimeAdapter has no API or scripted scenario that emits a genuine runtime/session degraded state."
  );
  skipState(
    "runtime-failed",
    "MockRuntimeAdapter can emit blocked agents/tasks and revision_required artifacts, " +
    "but cannot independently trigger a genuine runtime-failed / runtime-error state."
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
