#!/usr/bin/env node
/**
 * Capture baseline screenshots for Swarm Office Issue #12 visual QA.
 *
 * Captures 8 design states at three target resolutions:
 *   1366×768, 1440×900, 1920×1080
 *
 * Output layout:
 *   docs/design/swarm-office/baseline-screenshots/{width}x{height}/01-command-mode.png
 *
 * Requires: runtime at :3456, Vite at :5173, Playwright installed.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_OUT_DIR = join(__dirname, "..", "docs", "design", "swarm-office", "baseline-screenshots");
const APP_URL = "http://localhost:5173";
const RUNTIME_URL = "http://localhost:3456";

const RESOLUTIONS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postCommand(payload) {
  const res = await fetch(`${RUNTIME_URL}/runtime/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": `audit-${Date.now()}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`command failed: ${res.status}`);
  return res.json();
}

async function triggerArtifactReview() {
  const res = await fetch(`${RUNTIME_URL}/runtime/demo/trigger-artifact-review`, { method: "POST" });
  if (!res.ok) throw new Error(`trigger-artifact-review failed: ${res.status}`);
}

async function forceSessionError() {
  const res = await fetch(`${RUNTIME_URL}/runtime/demo/force-session-error`, { method: "POST" });
  if (!res.ok) throw new Error(`force-session-error failed: ${res.status}`);
}

async function resetRuntime() {
  const res = await fetch(`${RUNTIME_URL}/runtime/demo/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`reset failed: ${res.status}`);
}

async function capture(page, outDir, name) {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`Captured ${path}`);
}

async function openApp(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  // Poll for the connected status strip; diagnostics updates can keep the
  // DOM unstable, so a simple waitForSelector timeout is flaky.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const text = await page.locator("body").innerText().catch(() => "");
    if (text.includes("connected")) break;
    await delay(200);
  }
  await delay(600);
}

async function createTask(page, title, priority) {
  await page.fill('input[placeholder="Task title"]', title);
  await page.fill('input[placeholder="Priority"]', priority);
  await page.click('button:has-text("Create")');
}

async function waitForText(page, text, timeout = 10_000) {
  await page.waitForSelector(`text=${text}`, { timeout });
}

async function rejectPendingApproval() {
  const snapRes = await fetch(`${RUNTIME_URL}/runtime/snapshot`);
  const snapshot = await snapRes.json();
  const approval = snapshot.approvals.find((a) => a.status === "requested");
  if (!approval) throw new Error("No pending approval found");
  await postCommand({
    commandId: `cmd-audit-reject-${Date.now()}`,
    commandType: "approval.reject",
    timestamp: new Date().toISOString(),
    source: "user",
    actorId: "audit-user",
    runtimeId: snapshot.runtimeId,
    targetId: null,
    payload: { approvalId: approval.approvalId, reason: "Baseline audit rejection" },
  });
}

async function runScenario(browser, resolution, outDir) {
  const { width, height } = resolution;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });

  async function newPage() {
    const page = await context.newPage();
    await openApp(page);
    return page;
  }

  // Start each resolution from the same clean runtime checkpoint.
  await resetRuntime();

  try {
    // ── 01 Command mode: connected, no active task, pixel view ──
    {
      const page = await newPage();
      await capture(page, outDir, "01-command-mode");
      await page.close();
    }

    // ── 02 Focus mode: Command mode + Focus tab; focus overlay visible ──
    {
      const page = await newPage();
      await page.getByRole("tab", { name: "Focus" }).click();
      await delay(800);
      await capture(page, outDir, "02-focus-mode");
      await page.close();
    }

    // ── 03 Debrief mode: Command mode + Debrief tab; timeline visible ──
    {
      const page = await newPage();
      await page.getByRole("tab", { name: "Debrief" }).click();
      await delay(800);
      await capture(page, outDir, "03-debrief-mode");
      await page.close();
    }

    // ── 04 Idle state: connected, no active task ──
    {
      const page = await newPage();
      await capture(page, outDir, "04-idle-state");
      await page.close();
    }

    // ── 05 Working state: one running task ──
    {
      const page = await newPage();
      await createTask(page, "Audit task", "normal");
      await waitForText(page, "running");
      await delay(1000);
      await capture(page, outDir, "05-working-state");
      await page.close();
    }

    // ── 06 Approval state: pending approval visible ──
    {
      const page = await newPage();
      await createTask(page, "Audit task", "normal");
      await waitForText(page, "running");
      await delay(500);
      await triggerArtifactReview();
      await waitForText(page, "requested");
      await delay(1000);
      await capture(page, outDir, "06-approval-state");
      await page.close();
    }

    // ── 07 Blocked state: reject the pending approval from scenario 06 ──
    {
      const page = await newPage();
      await rejectPendingApproval();
      await waitForText(page, "blocked");
      await delay(800);
      await capture(page, outDir, "07-blocked-state");
      await page.close();
    }

    // ── 08 Error state: force session error via runtime API ──
    // The injected event causes a runtime_mismatch, transitioning the session
    // to "degraded" and surfacing the Resynchronize recovery action.
    {
      const page = await newPage();
      await forceSessionError();
      await page.waitForFunction(
        () => {
          const text = document.body.innerText.toLowerCase();
          return text.includes("failed") || text.includes("degraded");
        },
        { timeout: 10_000 }
      );
      await delay(800);
      await capture(page, outDir, "08-error-state");
      await page.close();
    }
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });

  try {
    for (const resolution of RESOLUTIONS) {
      const outDir = join(BASE_OUT_DIR, `${resolution.width}x${resolution.height}`);
      await mkdir(outDir, { recursive: true });
      console.log(`\nCapturing at ${resolution.width}x${resolution.height} → ${outDir}`);
      await runScenario(browser, resolution, outDir);
    }

    console.log("\nAll baseline screenshots captured.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
