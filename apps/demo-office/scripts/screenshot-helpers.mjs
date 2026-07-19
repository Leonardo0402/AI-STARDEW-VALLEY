/**
 * Pure helpers and static data shared by the screenshot automation scripts.
 *
 * These functions do not launch browsers, read files, or perform I/O. They are
 * extracted so the screenshot scripts can be unit-tested without executing
 * their side-effectful automation code.
 */

export const SCREENSHOT_STATE_NAMES = [
  "15-queue-populated",
  "16-review-pending",
  "17-evidence-added",
  "18-timeline-visible",
];

/**
 * Return the synthetic IntegrationProjection payload for a screenshot scenario.
 *
 * This data is consumed only by the dev-only `window.__mockAdapter` hook used
 * to drive the UI for screenshot baselines. It is not production flow data;
 * see the comment block in `capture-demo-office-screenshots.mjs` for the full
 * runtime-truth rationale.
 */
export function getIntegrationScenario(scenario) {
  const now = new Date().toISOString();

  switch (scenario) {
    case "queue-populated":
      return {
        github: {
          issues: [
            {
              taskId: "gh-issue-1",
              number: 42,
              kind: "issue",
              title: "Fix login crash",
              state: "open",
              closedAt: null,
              labels: ["bug", "p1"],
              assignees: ["alice"],
              url: "https://github.com/org/repo/issues/42",
            },
            {
              taskId: "gh-issue-2",
              number: 43,
              kind: "issue",
              title: "Update docs",
              state: "closed",
              stateReason: "completed",
              closedAt: now,
              labels: ["docs"],
              assignees: ["bob"],
              url: "https://github.com/org/repo/issues/43",
            },
          ],
          pulls: [
            {
              taskId: "gh-pr-1",
              artifactId: "gh-artifact-1",
              number: 101,
              kind: "pr",
              title: "Add OAuth support",
              state: "open",
              draft: false,
              labels: ["feature"],
              reviewers: ["alice"],
              url: "https://github.com/org/repo/pull/101",
            },
          ],
          auditNotes: [],
        },
        reviews: { assigned: [], submitted: [] },
      };
    case "review-pending":
      return {
        github: { issues: [], pulls: [], auditNotes: [] },
        reviews: {
          assigned: [
            {
              reviewId: "review-1",
              targetKind: "pr",
              targetNumber: 101,
              agentId: "agent-reviewer",
              assignedAt: now,
            },
          ],
          submitted: [
            {
              reviewId: "review-2",
              agentId: "agent-reviewer",
              verdict: "approved",
              comment: "Looks good to me.",
              targetKind: "pr",
              targetNumber: 102,
              submittedAt: now,
            },
          ],
        },
      };
    case "evidence-added":
      return {
        github: {
          issues: [],
          pulls: [],
          auditNotes: [
            {
              auditId: "audit-1",
              taskId: "task-1",
              body: "Verified reproduction steps and attached logs.",
              author: "agent-worker-1",
              createdAt: now,
            },
            {
              auditId: "audit-2",
              taskId: null,
              body: "Policy check passed before approval.",
              author: "agent-reviewer",
              createdAt: now,
            },
          ],
        },
        reviews: { assigned: [], submitted: [] },
      };
    case "timeline":
      // Non-null integration so the wall-scroll prop is visible, but empty
      // queues so the TimelinePanel is the focus of the screenshot.
      return {
        github: { issues: [], pulls: [], auditNotes: [] },
        reviews: { assigned: [], submitted: [] },
      };
    case "none":
    default:
      return { github: null, reviews: null };
  }
}

export const ANNOTATIONS = [
  {
    name: "01-idle-office",
    title: "01 — Idle Office",
    notes: [
      { x: 360, y: 260, label: "Linked selection baseline added: 09 + 10 capture selected agent and selected task card. Room/approval cross-highlight still needs dedicated baseline coverage." },
      { x: 1090, y: 120, label: "Multi-resolution layout hardening: verify 1366×768 panel density and 1920×1080 stage spacing." },
      { x: 1090, y: 320, label: "Artifact truth boundary: mock adapter cannot produce metadata-only / unavailable / unsupported-open content, so those UI states are not baselined." },
      { x: 1090, y: 720, label: "Runtime degraded/failed states are skipped because the mock adapter cannot truthfully produce them." },
    ],
  },
  {
    name: "02-active-task-execution",
    title: "02 — Active Task Execution",
    notes: [
      { x: 560, y: 300, label: "Selected task card baseline (10) shows linked canvas highlight; hover-only state is not separately baselined." },
      { x: 360, y: 560, label: "Artifact truth: normal-flow artifact has a URI; metadata-only / unavailable / unsupported-open states remain unverified." },
      { x: 1090, y: 760, label: "Resolution hardening: check 1366×768 card text truncation and 1920×1080 panel width." },
      { x: 1090, y: 320, label: "Multi-resolution spacing audit pending." },
    ],
  },
  {
    name: "03-artifact-under-review",
    title: "03 — Artifact Under Review",
    notes: [
      { x: 360, y: 560, label: "Artifact state truth boundaries: revision_required, rejected, blocked, and failed must stay distinct. Mock cannot produce true runtime failed." },
      { x: 1090, y: 600, label: "Metadata-only / unavailable / unsupported-open artifact UI is not baselined due to mock adapter limitations." },
      { x: 1090, y: 760, label: "Canvas ↔ panel linked selection for reviewer/artifact is implemented but not yet a dedicated baseline." },
      { x: 360, y: 760, label: "Resolution hardening: wide/narrow viewport spacing." },
    ],
  },
  {
    name: "04-pending-approval",
    title: "04 — Pending Approval",
    notes: [
      { x: 620, y: 420, label: "Approval cross-highlight is implemented; a dedicated selected-approval baseline is not yet captured." },
      { x: 1090, y: 600, label: "Approve/Reject are decision outcomes; runtime failed/degraded states are out of scope for the mock adapter." },
      { x: 1090, y: 320, label: "Selected / hovered card capture now exists for agent and task." },
      { x: 360, y: 120, label: "Multi-resolution hardening: verify spacing and legibility." },
    ],
  },
  {
    name: "05-blocked-task-agent",
    title: "05 — Blocked Task / Agent",
    notes: [
      { x: 560, y: 300, label: "Blocked posture and pulse baseline is truthful; runtime failed/degraded capture is skipped." },
      { x: 360, y: 560, label: "Blocked must not be mislabeled as failed or rejected." },
      { x: 1090, y: 840, label: "Linked selection for blocked agent card is implemented; room cross-highlight baseline is pending." },
      { x: 1090, y: 600, label: "Artifact truth boundary: a blocked task must not invent artifact content." },
    ],
  },
  {
    name: "06-revision-required",
    title: "06 — Revision / Rework Required",
    notes: [
      { x: 360, y: 420, label: "Revision/rework badge is distinct from rejected and failed; artifact truth remains the main open gap." },
      { x: 1090, y: 600, label: "Metadata-only / unavailable / unsupported-open artifact states need truthful adapter support to baseline." },
      { x: 1090, y: 760, label: "Selected task/artifact card baselines added; selected-reviewer baseline is pending." },
      { x: 360, y: 560, label: "Mock adapter limitation: a true runtime failed state cannot be independently produced." },
    ],
  },
  {
    name: "07-focus-mode",
    title: "07 — Focus Mode",
    notes: [
      { x: 360, y: 420, label: "Focus panel exists; selection linkage is implemented but not shown in this baseline." },
      { x: 1090, y: 420, label: "Urgent-only compact view; multi-resolution spacing and 1366×768 legibility need audit." },
      { x: 1090, y: 640, label: "Keyboard-accessible selection is implemented (Tab/Enter/Space/Escape)." },
      { x: 360, y: 120, label: "Runtime degraded/failed states are not captured because the mock adapter cannot produce them." },
    ],
  },
  {
    name: "08-debrief-mode",
    title: "08 — Debrief Mode",
    notes: [
      { x: 360, y: 120, label: "Session Summary + Key timeline are present; selected/hover states are not captured in debrief." },
      { x: 1090, y: 640, label: "Multi-resolution layout: metrics cards and timeline should be audited at 1366×768 and 1920×1080." },
      { x: 360, y: 420, label: "No selected milestone or row highlight baseline yet." },
      { x: 1090, y: 420, label: "Debrief selection linkage exists but is not baselined." },
    ],
  },
  {
    name: "09-selected-agent",
    title: "09 — Selected Agent",
    notes: [
      { x: 560, y: 260, label: "Canvas agent selection highlights the matching panel card and scrolls it into view." },
      { x: 1090, y: 320, label: "Linked selection baseline: agent ↔ card cross-highlight." },
      { x: 360, y: 560, label: "Resolution hardening: ensure selection ring is visible at all resolutions." },
      { x: 1090, y: 720, label: "Room/approval/task cross-highlight baselines still pending." },
    ],
  },
  {
    name: "10-selected-task-card",
    title: "10 — Selected Task Card",
    notes: [
      { x: 1090, y: 420, label: "Selected task card shows card--selected highlight and highlights the assignee on canvas." },
      { x: 560, y: 300, label: "Linked selection baseline: task card ↔ agent on canvas." },
      { x: 1090, y: 720, label: "Artifact/approval cross-highlight baselines still pending." },
      { x: 360, y: 120, label: "Resolution hardening: selection ring and panel width." },
    ],
  },
  {
    name: "11-domain-task-agent-failed",
    title: "11 — Domain task / agent failed",
    notes: [
      { x: 360, y: 40, label: "Status strip truthfully shows failure styling, error code, and the failed agent reason produced by playRuntimeFailureFlow()." },
      { x: 1090, y: 320, label: "Worker-2 agent card displays the failed badge with the critical error reason." },
      { x: 1090, y: 560, label: "Task card displays failed status; this is a genuine domain task/agent failure, not a session transport failure, not blocked or revision_required." },
      { x: 560, y: 300, label: "Canvas renders the failed agent marker/posture distinct from blocked." },
    ],
  },
  {
    name: "12-artifact-unavailable",
    title: "12 — Artifact Unavailable",
    notes: [
      { x: 1090, y: 640, label: "Artifact preview truthfully renders 'Content unavailable' because the artifact uri is null." },
      { x: 1090, y: 560, label: "View button is disabled; the artifact has no openable content." },
      { x: 560, y: 300, label: "Producer agent is still working; only the artifact content is unavailable." },
      { x: 360, y: 120, label: "Truthfully produced by MockRuntimeAdapter.playArtifactUnavailableFlow()." },
    ],
  },
  {
    name: "13-artifact-failed-open",
    title: "13 — Artifact Failed Open",
    notes: [
      { x: 1090, y: 640, label: "Artifact preview shows 'Open failed.' after the user clicks View." },
      { x: 1090, y: 720, label: "Action error banner shows the failed-open error returned by the adapter." },
      { x: 1090, y: 560, label: "View button remains enabled so the user can retry opening the artifact." },
      { x: 360, y: 120, label: "Truthfully produced by MockRuntimeAdapter.playArtifactFailedOpenFlow()." },
    ],
  },
  {
    name: "14-artifact-open-rejected",
    title: "14 — Artifact open rejected",
    notes: [
      { x: 1090, y: 640, label: "Artifact preview shows 'Open failed.' after the user clicks View." },
      { x: 1090, y: 720, label: "Action error banner shows the unsupported-open error from the room Profile inputArtifactTypes mismatch." },
      { x: 1090, y: 560, label: "View button stays enabled for retry; title reads 'Open failed — click to retry'." },
      { x: 360, y: 120, label: "No demo button exists for this flow; captured via dev-only window.__mockAdapter.playArtifactUnsupportedOpenFlow()." },
    ],
  },
  {
    name: "15-queue-populated",
    title: "15 — Queue Populated",
    notes: [
      { x: 1080, y: 460, label: "QueuePanel lists mocked GitHub issues and PRs; row selection synchronizes with the Pixel canvas." },
      { x: 160, y: 160, label: "Mission Board prop appears in the Command Room when the integration queue is non-empty." },
      { x: 1080, y: 120, label: "Integration data is injected via page.evaluate because MockRuntimeAdapter cannot produce truthful GitHub/review projections." },
      { x: 360, y: 120, label: "Canvas room layout is preserved; integration props are rendered as decorative overlays." },
    ],
  },
  {
    name: "16-review-pending",
    title: "16 — Review Pending",
    notes: [
      { x: 1080, y: 620, label: "ReviewBlocker shows assigned reviews and submitted reviews awaiting human Approve/Reject." },
      { x: 140, y: 560, label: "Review Desk prop in the Review Room reflects active review assignments." },
      { x: 1080, y: 120, label: "Submitted review rows route REVIEW_APPROVE / REVIEW_REJECT through the command gateway." },
      { x: 360, y: 560, label: "Reviewer agent posture can be oriented toward the Approval Room when human approval is pending." },
    ],
  },
  {
    name: "17-evidence-added",
    title: "17 — Evidence Added",
    notes: [
      { x: 1080, y: 700, label: "EvidencePanel displays audit notes with author, timestamp, optional task link, and expandable body." },
      { x: 80, y: 220, label: "Filing Cabinet prop in the Command Room indicates that audit evidence is available." },
      { x: 360, y: 120, label: "Audit note data is mocked integration projection for baseline coverage." },
      { x: 1080, y: 860, label: "Multi-resolution baseline verifies panel density and prop visibility across viewports." },
    ],
  },
  {
    name: "18-timeline-visible",
    title: "18 — Timeline Visible",
    notes: [
      { x: 1080, y: 800, label: "TimelinePanel filters the event log to GitHub/relevant event types and renders them chronologically." },
      { x: 80, y: 100, label: "Wall Scroll prop above the rooms reflects that integration timeline events exist." },
      { x: 360, y: 560, label: "Timeline events are produced truthfully by the normal-flow mock script." },
      { x: 1080, y: 120, label: "Filtered types: task.created, artifact.created, artifact.drafted, artifact.review_requested, review.assigned, review.submitted, artifact.reviewed, audit_note.added." },
    ],
  },
];

export function buildHtml(item) {
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
    <p>Baseline screenshot with current Issue #49 integration UI annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
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
