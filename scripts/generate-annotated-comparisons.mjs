import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASELINE_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline");
const OUT_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/annotated-comparisons");

fs.mkdirSync(OUT_DIR, { recursive: true });

const annotations = [
  {
    name: "01-idle-office",
    title: "01 — Idle Office",
    notes: [
      { x: 360, y: 260, label: "Canvas is blank black; target: full Command/Execution/Review/Approval rooms with wood floors, rugs, props" },
      { x: 1090, y: 120, label: "Mode switcher is plain text; target: segmented control with --base-600 active fill" },
      { x: 1090, y: 320, label: "World card lacks visual hierarchy; target: panel card --base-700 surface + --base-500 border" },
      { x: 1090, y: 720, label: "Agent list is flat; target: cards with role silhouettes, status badges, pause actions" },
    ],
  },
  {
    name: "02-active-task-execution",
    title: "02 — Active Task Execution",
    notes: [
      { x: 360, y: 220, label: "Rooms are flat color blocks; target: textured floors, wall lines, wooden doorway signs" },
      { x: 560, y: 320, label: "Worker is a generic block; target: sturdy silhouette with tool belt + helmet, tool sparks" },
      { x: 360, y: 560, label: "Missing props: workbench, task board, cable spool, cool task light" },
      { x: 1090, y: 760, label: "Status badge is small green pill; target: --success badge + 'working' non-color cue (leaning posture)" },
    ],
  },
  {
    name: "03-artifact-under-review",
    title: "03 — Artifact Under Review",
    notes: [
      { x: 360, y: 560, label: "Reviewer is generic block; target: slim silhouette with glasses + clipboard, page-flip activity" },
      { x: 360, y: 760, label: "Review room lacks rug, round table, magnifying lamp, papers" },
      { x: 1090, y: 760, label: "Status shows 'reviewing' but no approval-intent cue; target: clipboard page-flip + soft reading lamp" },
    ],
  },
  {
    name: "04-pending-approval",
    title: "04 — Pending Approval",
    notes: [
      { x: 620, y: 420, label: "Approval/Delivery room missing service bell, counter, package slot, wall sconce" },
      { x: 1090, y: 600, label: "Approval drawer lacks urgency border-left (--urgency 4px) and bell icon" },
      { x: 1090, y: 640, label: "Approve/Reject buttons style mismatch; target: primary + danger with --radius-md" },
      { x: 620, y: 420, label: "No pulsing service-bell glow on canvas counterpart" },
    ],
  },
  {
    name: "05-blocked-task-agent",
    title: "05 — Blocked Task / Agent",
    notes: [
      { x: 560, y: 300, label: "Blocked agent has red ! but no slumped posture or frustration expression" },
      { x: 560, y: 300, label: "Missing red pulse glow / speech bubble per design system" },
      { x: 1090, y: 840, label: "Blocked badge color correct but missing --failure-dim background + error code" },
    ],
  },
  {
    name: "06-failed-runtime-error",
    title: "06 — Failed / Runtime Error",
    notes: [
      { x: 360, y: 420, label: "Revision/failed state is visually indistinguishable from idle on canvas" },
      { x: 1090, y: 120, label: "No error banner in status strip; target: --failure-dim strip with error code + dismiss" },
      { x: 1090, y: 760, label: "Agent list shows idle, not failed; target: failed posture + red pulse + error tag" },
    ],
  },
  {
    name: "07-focus-mode",
    title: "07 — Focus Mode",
    notes: [
      { x: 360, y: 420, label: "Focus overlay dims canvas but does not show ambient activity or compact urgent cards" },
      { x: 1090, y: 640, label: "Urgent Summary cards exist but lack --urgency accents and count badges" },
      { x: 1090, y: 420, label: "Right panel still shows full controls; target: collapsed 'Urgent Only' view" },
    ],
  },
  {
    name: "08-debrief-mode",
    title: "08 — Debrief Mode",
    notes: [
      { x: 360, y: 120, label: "Debrief shows raw event timeline; target: Session Summary with metrics cards + Key timeline" },
      { x: 1090, y: 640, label: "Summary cards present but not grouped as 'Session Summary'; missing approvals/artifacts metrics" },
      { x: 360, y: 420, label: "No agent/room debrief visuals or heatmap on canvas" },
    ],
  },
];

function buildHtml(item) {
  const imgSrc = `../baseline/${item.name}.png`;
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
    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
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
