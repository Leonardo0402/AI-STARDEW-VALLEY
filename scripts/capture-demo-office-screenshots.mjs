import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = "http://127.0.0.1:5173/";
const OUT_DIR = process.argv[2] || path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline");

fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function capture(page, name) {
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
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

let browser;

try {
  browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--disable-software-rasterizer", "--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE_URL);
  await waitForStable(page);
  await sleep(2000);

  // 1. Idle office
  await capture(page, "01-idle-office");

  // 2. Active task execution
  await clickButton(page, "正常流程");
  await waitForText(page, "working");
  await sleep(500);
  await capture(page, "02-active-task-execution");

  // 3. Artifact under review
  await waitForText(page, "reviewing");
  await sleep(500);
  await capture(page, "03-artifact-under-review");

  // 4. Pending approval
  await waitForText(page, "Approve");
  await sleep(500);
  await capture(page, "04-pending-approval");

  // 5. Blocked task / agent
  await clickButton(page, "重置");
  await sleep(1000);
  await clickButton(page, "异常: 阻塞");
  await waitForText(page, "blocked");
  await sleep(500);
  await capture(page, "05-blocked-task-agent");

  // 6. Failed / runtime error (revision flow)
  await clickButton(page, "重置");
  await sleep(1000);
  await clickButton(page, "异常: 返工");
  await waitForText(page, "revision_required");
  await sleep(500);
  await capture(page, "06-failed-runtime-error");

  // 7. Focus mode
  await clickButton(page, "重置");
  await sleep(1000);
  await clickButton(page, "正常流程");
  await waitForText(page, "working");
  await sleep(500);
  await page.locator("text=Focus").first().click();
  await sleep(1000);
  await capture(page, "07-focus-mode");

  // 8. Debrief mode
  await page.locator("text=Debrief").first().click();
  await sleep(1000);
  await capture(page, "08-debrief-mode");

  console.log("All screenshots captured.");
} catch (err) {
  console.error("Screenshot capture failed:", err);
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
}
