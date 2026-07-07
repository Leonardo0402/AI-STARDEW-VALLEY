import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASELINE_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline/1440x900");
const OUT_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/annotated-comparisons");

fs.mkdirSync(OUT_DIR, { recursive: true });

const annotations = [
  {
    name: "01-idle-office",
    title: "01 — Idle Office",
    notes: [
      { x: 360, y: 260, label: "Linked canvas ↔ control-panel selection is not implemented; clicking an agent/room does not highlight the panel card." },
      { x: 1090, y: 120, label: "Multi-resolution layout still needs hardening: 1366×768 legibility and 1920×1080 space usage are not yet baselined." },
      { x: 1090, y: 320, label: "Selected / hovered state capture is missing from visual QA; baselines only show default unselected views." },
      { x: 1090, y: 720, label: "Mock adapter cannot independently trigger genuine runtime failed/degraded states; those screenshots are skipped rather than fabricated." },
    ],
  },
  {
    name: "02-active-task-execution",
    title: "02 — Active Task Execution",
    notes: [
      { x: 560, y: 300, label: "No linked selection: selecting an agent on canvas does not highlight the matching Agents card or scroll it into view." },
      { x: 360, y: 560, label: "Artifact truth boundaries are not exposed here; task/artifact cannot yet show content-available vs metadata-only vs unavailable states." },
      { x: 1090, y: 760, label: "Hover / selected state capture missing; no baseline shows a highlighted task or agent row." },
      { x: 1090, y: 320, label: "Multi-resolution layout needs audit: 1366×768 panel density and 1920×1080 stage spacing." },
    ],
  },
  {
    name: "03-artifact-under-review",
    title: "03 — Artifact Under Review",
    notes: [
      { x: 360, y: 560, label: "Artifact state truth boundaries need hardening: revision_required, rejected, blocked, and failed must remain visually distinct and not invented." },
      { x: 1090, y: 600, label: "Metadata-only / unavailable artifact content is not yet rendered with dedicated UI states in the panel." },
      { x: 1090, y: 760, label: "Canvas ↔ panel linked selection missing; selecting the reviewer or artifact does not cross-highlight." },
      { x: 360, y: 760, label: "Mock adapter can produce blocked/revision states, but cannot truthfully produce a runtime failed state." },
    ],
  },
  {
    name: "04-pending-approval",
    title: "04 — Pending Approval",
    notes: [
      { x: 620, y: 420, label: "Approval selection is not linked: choosing the approval in the drawer does not highlight the related room or agent on canvas." },
      { x: 1090, y: 600, label: "Approve/Reject are decision outcomes; runtime failed/degraded states are out of scope for the mock adapter." },
      { x: 1090, y: 320, label: "Selected / hovered card capture missing from visual QA baseline set." },
      { x: 360, y: 120, label: "Multi-resolution hardening: wide-viewport spacing and narrow-viewport legibility not yet verified." },
    ],
  },
  {
    name: "05-blocked-task-agent",
    title: "05 — Blocked Task / Agent",
    notes: [
      { x: 560, y: 300, label: "Blocked posture and pulse are present, but true runtime failed/degraded capture is limited by mock adapter capability." },
      { x: 360, y: 560, label: "This baseline honestly represents blocked; a genuine runtime failure cannot be independently triggered by the mock adapter." },
      { x: 1090, y: 840, label: "Linked selection missing: clicking a blocked agent card does not highlight the canvas counterpart." },
      { x: 1090, y: 600, label: "Artifact truth boundary: a blocked task must not be rendered as failed or rejected." },
    ],
  },
  {
    name: "06-revision-required",
    title: "06 — Revision / Rework Required",
    notes: [
      { x: 360, y: 420, label: "Revision/rework must remain visually distinct from rejected and failed; artifact truth boundaries are the main remaining gap." },
      { x: 1090, y: 600, label: "Metadata-only / unavailable / unsupported-open artifact states need explicit UI in the artifact card." },
      { x: 1090, y: 760, label: "Selected / hovered task or artifact capture is not part of the current baseline set." },
      { x: 360, y: 560, label: "Mock adapter limitation: this baseline uses revision_required; true runtime failed state cannot be truthfully produced." },
    ],
  },
  {
    name: "07-focus-mode",
    title: "07 — Focus Mode",
    notes: [
      { x: 360, y: 420, label: "Focus panel exists but selection is not linked to canvas; no selected/hovered state capture." },
      { x: 1090, y: 420, label: "Urgent-only compact view exists; multi-resolution spacing and 1366×768 legibility still need hardening." },
      { x: 1090, y: 640, label: "Keyboard-accessible selection (Tab/Enter/Space/Escape) is not implemented." },
      { x: 360, y: 120, label: "Runtime degraded/failed states are not captured because the mock adapter cannot truthfully produce them." },
    ],
  },
  {
    name: "08-debrief-mode",
    title: "08 — Debrief Mode",
    notes: [
      { x: 360, y: 120, label: "Session Summary + Key timeline are present, but selection/hover states and canvas linkage are not." },
      { x: 1090, y: 640, label: "Multi-resolution layout: metrics cards and timeline should be audited at 1366×768 and 1920×1080." },
      { x: 360, y: 420, label: "No selected milestone or row highlight is captured in the baseline set." },
      { x: 1090, y: 420, label: "Debrief selection does not sync back to canvas or panel; linked selection is a remaining gap." },
    ],
  },
];

function buildHtml(item) {
  const imgSrc = `../baseline/1440x900/${item.name}.png`;
  const svgOverlays = item.notes
    .map((note, i) => {
      const num = i + 1;
      return `
      <g transform="translate(${note.x}, ${note.y})">
        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">${num}</text>
      </g>
      <line x1="${note.x}" y1="${note.y}" x2="${note.x + 30}" y2="${note.y - 40}" stroke="#e6a85c" stroke-width="2" />
      <foreignObject x="${note.x + 35}" y="${note.y - 70}" width="340" height="80">
        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
          <strong style="color:#e6a85c">${num}.</strong> ${note.label}
        </div>
      </foreignObject>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${item.title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #131014; color: #f2f0eb; font-family: Inter, system-ui, sans-serif; }
    .header { padding: 16px 24px; border-bottom: 1px solid #322e36; }
    .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
    .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
    .wrap { position: relative; display: inline-block; }
    .wrap img { display: block; max-width: 100%; }
    .container { padding: 16px 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${item.title}</h1>
    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
  </div>
  <div class="container">
    <div class="wrap" id="wrap">
      <img src="${imgSrc}" id="targetImg" />
      <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
        ${svgOverlays}
      </svg>
    </div>
  </div>
  <script>
    const img = document.getElementById('targetImg');
    const svg = document.getElementById('overlay');
    img.onload = () => {
      svg.setAttribute('width', img.naturalWidth);
      svg.setAttribute('height', img.naturalHeight);
      document.getElementById('wrap').style.width = img.naturalWidth + 'px';
    };
    if (img.complete) img.onload();
  </script>
</body>
</html>`;
}

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-gpu", "--disable-software-rasterizer", "--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
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

await browser.close();
console.log("All annotated comparisons generated.");
