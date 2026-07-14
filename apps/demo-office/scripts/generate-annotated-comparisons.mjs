import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { ANNOTATIONS, buildHtml } from "./screenshot-helpers.mjs";

const BASELINE_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline/1440x900");
const OUT_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/annotated-comparisons");

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu", "--disable-software-rasterizer", "--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
const page = await context.newPage();

for (const item of ANNOTATIONS) {
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

await browser.close();
console.log("All annotated comparisons generated.");
