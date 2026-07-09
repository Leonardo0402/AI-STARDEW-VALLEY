# Task 0 review package

## Commits

7bc21f8 docs(swarm-office): update gap-audit and annotation labels for Issue #25 Task 0

## Diff stat

 .../01-idle-office-annotated.png                   | Bin 113879 -> 118146 bytes
 .../annotated-comparisons/01-idle-office.html      |  10 +-
 .../02-active-task-execution-annotated.png         | Bin 118059 -> 121757 bytes
 .../02-active-task-execution.html                  |  34 ++--
 .../03-artifact-under-review-annotated.png         | Bin 114322 -> 123539 bytes
 .../03-artifact-under-review.html                  |  24 ++-
 .../04-pending-approval-annotated.png              | Bin 117085 -> 123271 bytes
 .../annotated-comparisons/04-pending-approval.html |  22 +--
 .../05-blocked-task-agent-annotated.png            | Bin 113544 -> 126061 bytes
 .../05-blocked-task-agent.html                     |  24 ++-
 .../06-revision-required-annotated.png             | Bin 117155 -> 121318 bytes
 .../06-revision-required.html                      |  10 +-
 .../07-focus-mode-annotated.png                    | Bin 82941 -> 89785 bytes
 .../annotated-comparisons/07-focus-mode.html       |  28 ++-
 .../08-debrief-mode-annotated.png                  | Bin 81313 -> 84908 bytes
 .../annotated-comparisons/08-debrief-mode.html     |  18 +-
 docs/design/swarm-office-v1.1/gap-audit.md         | 204 ++++++++-------------
 scripts/generate-annotated-comparisons.mjs         |  62 ++++---
 18 files changed, 210 insertions(+), 226 deletions(-)

## Full diff

diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png
index 1cdc9fe..9d10636 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html
index b2042a5..db62c8d 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html
@@ -11,65 +11,65 @@
     .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
     .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
     .wrap { position: relative; display: inline-block; }
     .wrap img { display: block; max-width: 100%; }
     .container { padding: 16px 24px; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>01 — Idle Office</h1>
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
   </div>
   <div class="container">
     <div class="wrap" id="wrap">
       <img src="../baseline/1440x900/01-idle-office.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 260)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="260" x2="390" y2="220" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="190" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Canvas is blank black; target: full Command/Execution/Review/Approval rooms with wood floors, rugs, props
+          <strong style="color:#e6a85c">1.</strong> Linked canvas ↔ control-panel selection is not implemented; clicking an agent/room does not highlight the panel card.
         </div>
       </foreignObject>
       <g transform="translate(1090, 120)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="120" x2="1120" y2="80" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="50" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Mode switcher is plain text; target: segmented control with --base-600 active fill
+          <strong style="color:#e6a85c">2.</strong> Multi-resolution layout still needs hardening: 1366×768 legibility and 1920×1080 space usage are not yet baselined.
         </div>
       </foreignObject>
       <g transform="translate(1090, 320)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="320" x2="1120" y2="280" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="250" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> World card lacks visual hierarchy; target: panel card --base-700 surface + --base-500 border
+          <strong style="color:#e6a85c">3.</strong> Selected / hovered state capture is missing from visual QA; baselines only show default unselected views.
         </div>
       </foreignObject>
       <g transform="translate(1090, 720)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="1090" y1="720" x2="1120" y2="680" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="650" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Agent list is flat; target: cards with role silhouettes, status badges, pause actions
+          <strong style="color:#e6a85c">4.</strong> Mock adapter cannot independently trigger genuine runtime failed/degraded states; those screenshots are skipped rather than fabricated.
         </div>
       </foreignObject>
       </svg>
     </div>
   </div>
   <script>
     const img = document.getElementById('targetImg');
     const svg = document.getElementById('overlay');
     img.onload = () => {
       svg.setAttribute('width', img.naturalWidth);
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png
index 6a591b7..477015d 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html
index e90f9ff..4768a9d 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html
@@ -11,65 +11,65 @@
     .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
     .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
     .wrap { position: relative; display: inline-block; }
     .wrap img { display: block; max-width: 100%; }
     .container { padding: 16px 24px; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>02 — Active Task Execution</h1>
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
   </div>
   <div class="container">
     <div class="wrap" id="wrap">
       <img src="../baseline/1440x900/02-active-task-execution.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
-      <g transform="translate(360, 220)">
+      <g transform="translate(560, 300)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
-      <line x1="360" y1="220" x2="390" y2="180" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="395" y="150" width="340" height="80">
+      <line x1="560" y1="300" x2="590" y2="260" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="595" y="230" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Rooms are flat color blocks; target: textured floors, wall lines, wooden doorway signs
+          <strong style="color:#e6a85c">1.</strong> No linked selection: selecting an agent on canvas does not highlight the matching Agents card or scroll it into view.
         </div>
       </foreignObject>
-      <g transform="translate(560, 320)">
+      <g transform="translate(360, 560)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
-      <line x1="560" y1="320" x2="590" y2="280" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="595" y="250" width="340" height="80">
+      <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="395" y="490" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Worker is a generic block; target: sturdy silhouette with tool belt + helmet, tool sparks
+          <strong style="color:#e6a85c">2.</strong> Artifact truth boundaries are not exposed here; task/artifact cannot yet show content-available vs metadata-only vs unavailable states.
         </div>
       </foreignObject>
-      <g transform="translate(360, 560)">
+      <g transform="translate(1090, 760)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
-      <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="395" y="490" width="340" height="80">
+      <line x1="1090" y1="760" x2="1120" y2="720" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="690" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Missing props: workbench, task board, cable spool, cool task light
+          <strong style="color:#e6a85c">3.</strong> Hover / selected state capture missing; no baseline shows a highlighted task or agent row.
         </div>
       </foreignObject>
-      <g transform="translate(1090, 760)">
+      <g transform="translate(1090, 320)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
-      <line x1="1090" y1="760" x2="1120" y2="720" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="1125" y="690" width="340" height="80">
+      <line x1="1090" y1="320" x2="1120" y2="280" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="250" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Status badge is small green pill; target: --success badge + 'working' non-color cue (leaning posture)
+          <strong style="color:#e6a85c">4.</strong> Multi-resolution layout needs audit: 1366×768 panel density and 1920×1080 stage spacing.
         </div>
       </foreignObject>
       </svg>
     </div>
   </div>
   <script>
     const img = document.getElementById('targetImg');
     const svg = document.getElementById('overlay');
     img.onload = () => {
       svg.setAttribute('width', img.naturalWidth);
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png
index 4373281..b518e35 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html
index 01aefcb..e59f2de 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html
@@ -11,55 +11,65 @@
     .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
     .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
     .wrap { position: relative; display: inline-block; }
     .wrap img { display: block; max-width: 100%; }
     .container { padding: 16px 24px; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>03 — Artifact Under Review</h1>
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
   </div>
   <div class="container">
     <div class="wrap" id="wrap">
       <img src="../baseline/1440x900/03-artifact-under-review.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 560)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="490" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Reviewer is generic block; target: slim silhouette with glasses + clipboard, page-flip activity
+          <strong style="color:#e6a85c">1.</strong> Artifact state truth boundaries need hardening: revision_required, rejected, blocked, and failed must remain visually distinct and not invented.
         </div>
       </foreignObject>
-      <g transform="translate(360, 760)">
+      <g transform="translate(1090, 600)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
-      <line x1="360" y1="760" x2="390" y2="720" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="395" y="690" width="340" height="80">
+      <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="530" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Review room lacks rug, round table, magnifying lamp, papers
+          <strong style="color:#e6a85c">2.</strong> Metadata-only / unavailable artifact content is not yet rendered with dedicated UI states in the panel.
         </div>
       </foreignObject>
       <g transform="translate(1090, 760)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="760" x2="1120" y2="720" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="690" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Status shows 'reviewing' but no approval-intent cue; target: clipboard page-flip + soft reading lamp
+          <strong style="color:#e6a85c">3.</strong> Canvas ↔ panel linked selection missing; selecting the reviewer or artifact does not cross-highlight.
+        </div>
+      </foreignObject>
+      <g transform="translate(360, 760)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
+      </g>
+      <line x1="360" y1="760" x2="390" y2="720" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="395" y="690" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">4.</strong> Mock adapter can produce blocked/revision states, but cannot truthfully produce a runtime failed state.
         </div>
       </foreignObject>
       </svg>
     </div>
   </div>
   <script>
     const img = document.getElementById('targetImg');
     const svg = document.getElementById('overlay');
     img.onload = () => {
       svg.setAttribute('width', img.naturalWidth);
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png
index 6525067..ddb2a30 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html
index 733e56f..0178587 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html
@@ -11,65 +11,65 @@
     .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
     .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
     .wrap { position: relative; display: inline-block; }
     .wrap img { display: block; max-width: 100%; }
     .container { padding: 16px 24px; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>04 — Pending Approval</h1>
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
   </div>
   <div class="container">
     <div class="wrap" id="wrap">
       <img src="../baseline/1440x900/04-pending-approval.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(620, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="620" y1="420" x2="650" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="655" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Approval/Delivery room missing service bell, counter, package slot, wall sconce
+          <strong style="color:#e6a85c">1.</strong> Approval selection is not linked: choosing the approval in the drawer does not highlight the related room or agent on canvas.
         </div>
       </foreignObject>
       <g transform="translate(1090, 600)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="530" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Approval drawer lacks urgency border-left (--urgency 4px) and bell icon
+          <strong style="color:#e6a85c">2.</strong> Approve/Reject are decision outcomes; runtime failed/degraded states are out of scope for the mock adapter.
         </div>
       </foreignObject>
-      <g transform="translate(1090, 640)">
+      <g transform="translate(1090, 320)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
-      <line x1="1090" y1="640" x2="1120" y2="600" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="1125" y="570" width="340" height="80">
+      <line x1="1090" y1="320" x2="1120" y2="280" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="250" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Approve/Reject buttons style mismatch; target: primary + danger with --radius-md
+          <strong style="color:#e6a85c">3.</strong> Selected / hovered card capture missing from visual QA baseline set.
         </div>
       </foreignObject>
-      <g transform="translate(620, 420)">
+      <g transform="translate(360, 120)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
-      <line x1="620" y1="420" x2="650" y2="380" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="655" y="350" width="340" height="80">
+      <line x1="360" y1="120" x2="390" y2="80" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="395" y="50" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> No pulsing service-bell glow on canvas counterpart
+          <strong style="color:#e6a85c">4.</strong> Multi-resolution hardening: wide-viewport spacing and narrow-viewport legibility not yet verified.
         </div>
       </foreignObject>
       </svg>
     </div>
   </div>
   <script>
     const img = document.getElementById('targetImg');
     const svg = document.getElementById('overlay');
     img.onload = () => {
       svg.setAttribute('width', img.naturalWidth);
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png
index d133d51..cb8b434 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html
index 58eab2e..8fa2964 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html
@@ -11,55 +11,65 @@
     .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
     .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
     .wrap { position: relative; display: inline-block; }
     .wrap img { display: block; max-width: 100%; }
     .container { padding: 16px 24px; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>05 — Blocked Task / Agent</h1>
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
   </div>
   <div class="container">
     <div class="wrap" id="wrap">
       <img src="../baseline/1440x900/05-blocked-task-agent.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(560, 300)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="560" y1="300" x2="590" y2="260" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="595" y="230" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Blocked agent has red ! but no slumped posture or frustration expression
+          <strong style="color:#e6a85c">1.</strong> Blocked posture and pulse are present, but true runtime failed/degraded capture is limited by mock adapter capability.
         </div>
       </foreignObject>
-      <g transform="translate(560, 300)">
+      <g transform="translate(360, 560)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
-      <line x1="560" y1="300" x2="590" y2="260" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="595" y="230" width="340" height="80">
+      <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="395" y="490" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Missing red pulse glow / speech bubble per design system
+          <strong style="color:#e6a85c">2.</strong> This baseline honestly represents blocked; a genuine runtime failure cannot be independently triggered by the mock adapter.
         </div>
       </foreignObject>
       <g transform="translate(1090, 840)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="840" x2="1120" y2="800" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="770" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Blocked badge color correct but missing --failure-dim background + error code
+          <strong style="color:#e6a85c">3.</strong> Linked selection missing: clicking a blocked agent card does not highlight the canvas counterpart.
+        </div>
+      </foreignObject>
+      <g transform="translate(1090, 600)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
+      </g>
+      <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="530" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">4.</strong> Artifact truth boundary: a blocked task must not be rendered as failed or rejected.
         </div>
       </foreignObject>
       </svg>
     </div>
   </div>
   <script>
     const img = document.getElementById('targetImg');
     const svg = document.getElementById('overlay');
     img.onload = () => {
       svg.setAttribute('width', img.naturalWidth);
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png
index 7729095..4ed0c7e 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html
index 085c0d4..7ed7c1c 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html
@@ -11,65 +11,65 @@
     .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
     .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
     .wrap { position: relative; display: inline-block; }
     .wrap img { display: block; max-width: 100%; }
     .container { padding: 16px 24px; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>06 — Revision / Rework Required</h1>
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
   </div>
   <div class="container">
     <div class="wrap" id="wrap">
       <img src="../baseline/1440x900/06-revision-required.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="420" x2="390" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Revision state is visually indistinguishable from idle on canvas
+          <strong style="color:#e6a85c">1.</strong> Revision/rework must remain visually distinct from rejected and failed; artifact truth boundaries are the main remaining gap.
         </div>
       </foreignObject>
       <g transform="translate(1090, 600)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="530" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Artifact/task marked revision_required but lacks a rework cue (clipboard with red flag)
+          <strong style="color:#e6a85c">2.</strong> Metadata-only / unavailable / unsupported-open artifact states need explicit UI in the artifact card.
         </div>
       </foreignObject>
       <g transform="translate(1090, 760)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="760" x2="1120" y2="720" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="690" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Agent list shows idle; target: reviewer/worker posture indicating rework + revision badge
+          <strong style="color:#e6a85c">3.</strong> Selected / hovered task or artifact capture is not part of the current baseline set.
         </div>
       </foreignObject>
       <g transform="translate(360, 560)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="490" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Note: mock adapter cannot independently trigger a true failed/runtime-error state
+          <strong style="color:#e6a85c">4.</strong> Mock adapter limitation: this baseline uses revision_required; true runtime failed state cannot be truthfully produced.
         </div>
       </foreignObject>
       </svg>
     </div>
   </div>
   <script>
     const img = document.getElementById('targetImg');
     const svg = document.getElementById('overlay');
     img.onload = () => {
       svg.setAttribute('width', img.naturalWidth);
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png
index e9f249f..ef976a6 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html
index 88a8d61..4b22496 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html
@@ -11,55 +11,65 @@
     .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
     .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
     .wrap { position: relative; display: inline-block; }
     .wrap img { display: block; max-width: 100%; }
     .container { padding: 16px 24px; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>07 — Focus Mode</h1>
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
   </div>
   <div class="container">
     <div class="wrap" id="wrap">
       <img src="../baseline/1440x900/07-focus-mode.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="420" x2="390" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Focus overlay dims canvas but does not show ambient activity or compact urgent cards
+          <strong style="color:#e6a85c">1.</strong> Focus panel exists but selection is not linked to canvas; no selected/hovered state capture.
         </div>
       </foreignObject>
-      <g transform="translate(1090, 640)">
+      <g transform="translate(1090, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
+      <line x1="1090" y1="420" x2="1120" y2="380" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="350" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">2.</strong> Urgent-only compact view exists; multi-resolution spacing and 1366×768 legibility still need hardening.
+        </div>
+      </foreignObject>
+      <g transform="translate(1090, 640)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
+      </g>
       <line x1="1090" y1="640" x2="1120" y2="600" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="570" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Urgent Summary cards exist but lack --urgency accents and count badges
+          <strong style="color:#e6a85c">3.</strong> Keyboard-accessible selection (Tab/Enter/Space/Escape) is not implemented.
         </div>
       </foreignObject>
-      <g transform="translate(1090, 420)">
+      <g transform="translate(360, 120)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
-        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
-      <line x1="1090" y1="420" x2="1120" y2="380" stroke="#e6a85c" stroke-width="2" />
-      <foreignObject x="1125" y="350" width="340" height="80">
+      <line x1="360" y1="120" x2="390" y2="80" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="395" y="50" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Right panel still shows full controls; target: collapsed 'Urgent Only' view
+          <strong style="color:#e6a85c">4.</strong> Runtime degraded/failed states are not captured because the mock adapter cannot truthfully produce them.
         </div>
       </foreignObject>
       </svg>
     </div>
   </div>
   <script>
     const img = document.getElementById('targetImg');
     const svg = document.getElementById('overlay');
     img.onload = () => {
       svg.setAttribute('width', img.naturalWidth);
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png
index 9568723..82d81e6 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html
index f567240..117512e 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html
@@ -11,55 +11,65 @@
     .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
     .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
     .wrap { position: relative; display: inline-block; }
     .wrap img { display: block; max-width: 100%; }
     .container { padding: 16px 24px; }
   </style>
 </head>
 <body>
   <div class="header">
     <h1>08 — Debrief Mode</h1>
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
   </div>
   <div class="container">
     <div class="wrap" id="wrap">
       <img src="../baseline/1440x900/08-debrief-mode.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 120)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="120" x2="390" y2="80" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="50" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Debrief shows raw event timeline; target: Session Summary with metrics cards + Key timeline
+          <strong style="color:#e6a85c">1.</strong> Session Summary + Key timeline are present, but selection/hover states and canvas linkage are not.
         </div>
       </foreignObject>
       <g transform="translate(1090, 640)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="640" x2="1120" y2="600" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="570" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Summary cards present but not grouped as 'Session Summary'; missing approvals/artifacts metrics
+          <strong style="color:#e6a85c">2.</strong> Multi-resolution layout: metrics cards and timeline should be audited at 1366×768 and 1920×1080.
         </div>
       </foreignObject>
       <g transform="translate(360, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="360" y1="420" x2="390" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> No agent/room debrief visuals or heatmap on canvas
+          <strong style="color:#e6a85c">3.</strong> No selected milestone or row highlight is captured in the baseline set.
+        </div>
+      </foreignObject>
+      <g transform="translate(1090, 420)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
+      </g>
+      <line x1="1090" y1="420" x2="1120" y2="380" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="350" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">4.</strong> Debrief selection does not sync back to canvas or panel; linked selection is a remaining gap.
         </div>
       </foreignObject>
       </svg>
     </div>
   </div>
   <script>
     const img = document.getElementById('targetImg');
     const svg = document.getElementById('overlay');
     img.onload = () => {
       svg.setAttribute('width', img.naturalWidth);
diff --git a/docs/design/swarm-office-v1.1/gap-audit.md b/docs/design/swarm-office-v1.1/gap-audit.md
index c8f2007..cfccc87 100644
--- a/docs/design/swarm-office-v1.1/gap-audit.md
+++ b/docs/design/swarm-office-v1.1/gap-audit.md
@@ -1,197 +1,137 @@
 # Swarm Office V1.1 — Gap Audit
 
 > Evidence-based visual/UX gap analysis for `apps/demo-office`.
 > Baseline screenshots: `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/`
 > Annotated comparisons: `docs/design/swarm-office-v1.1/annotated-comparisons/`
 > Reference: `docs/design/swarm-office/design-system.md` + `docs/design/swarm-office/high-fidelity-designs-preview.png`
+> PR context: Task 0 of Issue #25; pre-PR #24 findings are now historical. Refs #14.
 
 ## Executive summary
 
-`demo-office` successfully renders all eight requested runtime states (idle, execution, review, approval, blocked, failed, focus, debrief) and the underlying Runtime → LifeSim integration is functional. However, the current UI is still a wireframe-level implementation: the pixel canvas lacks the approved "Cozy Pixel Operations Room" art direction, panels do not follow the design-system token hierarchy, and several high-impact product moments (approval, blocked, failed) rely on text rather than visual storytelling.
+PR #24 closed the first Swarm Office V1.1 visual pass. `apps/demo-office` now renders all eight runtime states with rooms, role-differentiated agent sprites, state postures, approval/blocked effects, and mode-specific panels. The remaining work tracked by Issue #25 is interaction and truth-boundary hardening rather than a wireframe-to-visual upgrade.
 
-The single largest gap is the **idle/blank canvas**: in Command mode with no active task, the pixel office is entirely black, giving the impression the app is broken. The second largest is **role/state readability**: agents are colored blocks with only a name label and a small badge, missing the silhouette, posture, and glow cues defined in the design system.
+This audit therefore splits the evidence into two sections:
 
-This audit recommends a phased visual pass: first fix canvas props, room textures, and idle-agent presence (P0); then role-specific sprites, state animations, and approval/blocked/failed expression (P1); finally polish focus/debrief layouts and micro-interactions (P2).
+1. **Historical V1.0 → V1.1 delta** — gaps that existed before PR #24 and are now resolved.
+2. **Current-state audit** — gaps that remain after PR #24 and are the focus of Issue #25.
 
-## State-by-state gap table
+## Historical V1.0 → V1.1 delta (resolved by PR #24)
 
-| State | Baseline file (1440×900) | Annotated file | What works | Key gaps |
-|-------|--------------------------|----------------|------------|----------|
-| Idle office | `baseline/1440x900/01-idle-office.png` | `01-idle-office-annotated.png` | Header, status strip, control panel skeleton load | Canvas is black/empty; no room art, props, or ambient agents. Mode switcher is plain text. Panel cards lack `--base-700` surface / `--base-500` border. Agent list is flat. |
-| Active task execution | `baseline/1440x900/02-active-task-execution.png` | `02-active-task-execution-annotated.png` | Four rooms render, task flows, status badge shows "working" | Rooms are flat color blocks without floor texture, walls, or doorway signs. Worker is a generic block; missing tool-belt/helmet silhouette and tool sparks. Props (workbench, task board, cable spool, task light) absent. |
-| Artifact under review | `baseline/1440x900/03-artifact-under-review.png` | `03-artifact-under-review-annotated.png` | Reviewer moves to review room, status shows "reviewing" | Reviewer lacks glasses/clipboard. Review room has no rug, round table, magnifying lamp, or papers. No page-flip activity cue. |
-| Pending approval | `baseline/1440x900/04-pending-approval.png` | `04-pending-approval-annotated.png` | Approval drawer appears with Approve/Reject | Approval/Delivery room missing counter, service bell, package slot, sconce. Drawer lacks `--urgency` 4px left border and bell icon. Buttons do not match primary/danger token styles. No pulsing bell glow on canvas. |
-| Blocked task / agent | `baseline/1440x900/05-blocked-task-agent.png` | `05-blocked-task-agent-annotated.png` | Agent shows red exclamation, "blocked" badge appears | Blocked agent posture is upright/idle, not slumped/frustrated. Missing red pulse glow and speech-bubble cue. Badge lacks `--failure-dim` background and error code. |
-| Revision / rework required | `baseline/1440x900/06-revision-required.png` | `06-revision-required-annotated.png` | Revision state is reachable | Revision state is visually indistinguishable from idle on canvas. No rework cue (clipboard with red flag). Agent list shows idle instead of reviewer/worker rework posture. |
-| Focus mode | `baseline/1440x900/07-focus-mode.png` | `07-focus-mode-annotated.png` | Overlay appears, urgent counts render | Overlay dims canvas but does not show ambient activity or compact urgent cards. Right panel still shows full controls instead of collapsed "Urgent Only" view. Summary cards lack `--urgency` accents and count badges. |
-| Debrief mode | `baseline/1440x900/08-debrief-mode.png` | `08-debrief-mode-annotated.png` | Event timeline renders, summary counts present | Debrief shows raw event log rather than curated "Session Summary" with metrics cards and Key timeline. Missing agent/room debrief visuals or heatmap. |
+| # | Pre-PR #24 gap | Resolution in PR #24 |
+|---|---|---|
+| 1 | Idle canvas was blank black. | Four rooms render in idle: Command (wood planks), Execution (concrete tiles), Review (rug), Approval/Delivery (polished wood), with wall lines and doorway signs. |
+| 2 | Mode switcher was plain text. | Header uses a segmented control with `--base-700` track, `--base-600` active fill, and keyboard arrow navigation. |
+| 3 | Rooms were flat color blocks. | `RoomRenderer` draws floor textures and patterns per room type; floor texture assets exist for all four rooms. |
+| 4 | Agents were generic colored blocks. | `AgentRenderer` uses role-differentiated sprites/procedural silhouettes for Orchestrator, Worker, and Reviewer, with state posture offsets. |
+| 5 | Panel cards lacked surface/border hierarchy. | `.panel-card` uses `--base-700` background, `--base-500` border, and `--radius-md`; ApprovalDrawer uses `--urgency` accent. |
+| 6 | Approval moment lacked service bell and urgency styling. | Pending approval shows a service-bell marker with pulsing glow, a drawer with `--urgency` left border and bell icon, and primary/danger Approve/Reject buttons. |
+| 7 | Blocked agent had no slumped posture or pulse. | `AgentRenderer` applies a `blocked` posture; `EffectRenderer` adds a red pulse glow and speech-bubble exclamation marker. |
+| 8 | Revision / rework was visually indistinguishable from idle. | The revision-required path is reachable; reviewer/worker postures, artifact badge intent, and task status communicate rework. |
+| 9 | Focus mode did not collapse the right panel. | Focus mode dims the canvas and replaces the full panel with a compact "Urgent Only" view. |
+| 10 | Debrief showed a raw event log. | Debrief mode presents a curated "Session Summary" with metrics cards and a "Key timeline" of milestone events. |
 
-## Design-system compliance checklist
+## Current-state audit (post-PR #24)
 
-### Color tokens
+### 1. Canvas / control-panel linked selection
 
-| Token | Status | Notes |
-|-------|--------|-------|
-| `--base-900` / `--base-800` backgrounds | Partial | App background is dark but not using the exact token values. |
-| `--base-700` panel cards | Missing | Panels use flatter surfaces without card borders. |
-| `--base-500` borders | Missing | Dividers exist but are ad-hoc grays. |
-| `--info` / `--urgency` / `--failure` intents | Partial | Badges use similar hues but not the exact tokens; glows missing. |
-| `--glow-*` | Missing | No glow effects for approval, blocked, or working states. |
+- `App` and `useComposedOfficeState` have no selection state.
+- `PixelOfficeScene` exposes no selection API; `AgentRenderer` and `RoomRenderer` do not render selected/hovered outlines.
+- `ControlPanel` cards do not accept `onSelect` or highlight a selected entity.
+- `ListView` rows are not selectable and do not sync with canvas selection.
+- Keyboard selection path (Tab into cards, Enter/Space to select, Escape to clear) is absent.
 
-### Typography
+### 2. Artifact state truth boundaries
 
-| Token | Status | Notes |
-|-------|--------|-------|
-| `--font-ui` Inter 12–14px | Partial | Font stack not explicit; sizes roughly match. |
-| `--font-mono` JetBrains Mono | Missing | Runtime IDs/sequence use default monospace. |
-| `--font-pixel` Press Start 2P | Missing | Room labels are sans-serif, not pixel font. |
-| Headings (`--h1`, `--h2`) | Partial | Section titles lack consistent weight/scale. |
+- `revision_required`, `rejected`, `blocked`, and `failed` must remain visually distinct on both canvas and panel.
+- `ControlPanel` already classifies artifact content by `content`, `uri`, and `uri === null`, but does not render explicit `metadata-only`, `unavailable`, `loading`, `failed-open`, or `unsupported-open` UI states.
+- `artifactStatusIntent` maps `rejected` to the `failed` badge intent, which can blur the difference between a decision outcome and a runtime failure.
+- `artifactId` is never treated as a URI; missing content references must render as metadata-only/unavailable rather than invented content.
 
-### Layout
+### 3. Multi-resolution layout hardening
 
-| Token | Status | Notes |
-|-------|--------|-------|
-| `--panel-width` 420px | Partial | Right panel width is close but not fixed/tokenized. |
-| `--status-height` 28px | Partial | Status strip exists; height not explicit. |
-| `--header-height` 44px | Partial | Header exists; height not explicit. |
-| Spacing tokens | Missing | Values are hard-coded in inline styles. |
+- Baselines exist for `1366x768`, `1440x900`, and `1920x1080`, but a per-resolution pass has not been completed.
+- `1366x768`: panel density, mode-switcher labels, and card text need legibility verification.
+- `1920x1080`: extra horizontal space can leave the stage/panel feeling loose; spacing and panel width need audit.
+- The responsive auto-switch to list view below `1024px` is implemented but not baselined.
 
-### Components
+### 4. Selected / hovered state capture missing from visual QA
 
-| Component | Status | Notes |
-|-----------|--------|-------|
-| Status strip | Partial | Shows connection + runtime ID + seq; missing error state / timestamp. |
-| App header | Partial | Wordmark present; mode switcher is not a segmented control. |
-| Mode switcher | Missing | Plain text buttons, no active fill. |
-| Panel cards | Missing | No `--base-700` surface / `--base-500` border. |
-| Status badges | Partial | Colors roughly match but sizing/typography inconsistent. |
-| Approval drawer | Missing | No urgency border-left or bell icon. |
-| Error banner | Missing | Failed state has no banner. |
+- The screenshot pipeline captures the eight default runtime states, but does not capture:
+  - selected agent on canvas + highlighted panel card,
+  - hovered/selected task or artifact card,
+  - selected room and related active agents.
+- The annotation script still labels pre-PR #24 gaps and must be updated to current-gap labels.
 
-### Assets / animation
+### 5. Runtime degraded / failed state capture limited by mock adapter
 
-| Area | Status | Notes |
-|------|--------|-------|
-| Agent sprites (28×36, role silhouettes) | Missing | Agents are solid-color rectangles. |
-| Room floor tiles (64×64) | Missing | Flat fills instead of textured tiles. |
-| Props (desk, workbench, lamp, bell) | Missing | Only simple desks present; no lamps/bells/signs. |
-| State animations (breathe, walk, sparkle, pulse) | Missing | Agents are static. |
-| Reduced-motion toggle | Present | "Motion on" toggle exists in header. |
+- The mock adapter can produce `blocked` agents/tasks and `revision_required` artifacts through its scripted scenarios.
+- It cannot independently trigger a genuine runtime `failed` / runtime-error state, nor a runtime-degraded/session-degraded state.
+- Visual QA for these states must be skipped rather than fabricated; screenshots are only captured if the adapter truthfully supports the state.
 
-## Prioritized recommendations
+## Accepted deviations
 
-### P0 — Must have before V1.1 feels complete
+The mock adapter used by `apps/demo-office` cannot independently trigger a genuine runtime `failed` / runtime-error state or a runtime-degraded state. The V1.1 demo therefore honestly labels state 05 as **blocked task / agent** and state 06 as **revision / rework required**, rather than claiming true runtime failures. Screenshots for runtime failed/degraded states will only be added if the underlying adapter or Runtime session can truthfully produce them.
 
-1. **Idle canvas must not be blank.** Render the four rooms even when no task is active: wood-plank Command floor, concrete Execution floor, rug Review floor, polished-wood Approval floor, plus wall lines and doorway signs.
-2. **Fix the mode switcher.** Convert Command/Focus/Debrief text buttons into a segmented control per the design system (`--base-600` active fill, `--base-100` active text).
-3. **Panel card surfaces.** Apply `--base-700` background, `--base-500` 1px border, `--radius-md`, and `--space-sm` padding to World, Actions, Create Task, Agents, Pending Approval, and Summary cards.
+## Screenshot path canonicalization
 
-### P1 — High impact on observability and character
+The multi-resolution folders are the source of truth:
 
-4. **Role-differentiated agent sprites.** Implement Orchestrator (tall, headset, tablet), Worker (sturdy, tool belt, helmet), and Reviewer (slim, glasses, clipboard) silhouettes.
-5. **State-specific posture and glows.** Add working lean + tool sparkle, blocked slumped posture + red pulse + speech bubble, approval turn-toward-bell + "?" thought bubble, failed downcast + error tag.
-6. **Approval moment.** Add service bell prop, pulsing `--glow-urgency`, `--urgency` left-border drawer, bell icon, and primary/danger Approve/Reject buttons.
-7. **Blocked/failed expression.** Add `--failure-dim` badge background, error code in status strip / agent card, and canvas-side red pulse marker.
+- `docs/design/swarm-office-v1.1/baseline/1366x768/`
+- `docs/design/swarm-office-v1.1/baseline/1440x900/`
+- `docs/design/swarm-office-v1.1/baseline/1920x1080/`
 
-### P2 — Polish and mode-specific layouts
-
-8. **Focus mode redesign.** Collapse right panel to an "Urgent Only" compact view with `--urgency`-accented count cards; keep canvas dimmed but show ambient agent silhouettes.
-9. **Debrief mode redesign.** Replace raw event timeline with curated Session Summary: Tasks completed, Approvals resolved, Artifacts delivered, Events count, plus a Key timeline of meaningful milestones.
-10. **Micro-animations.** Agent idle breathe, walk transitions, approval bell pulse, blocked pulse, panel card expand; all gated by reduced-motion toggle.
-11. **Typography hardening.** Enforce Inter / JetBrains Mono / Press Start 2P stacks and tokenized sizes across app and canvas.
-
-## Proposed implementation plan for follow-up PR
-
-### PR scope
-
-A single visual/interaction PR targeting `apps/demo-office` and `packages/pixel-office` only. No protocol or reducer changes.
-
-### Task breakdown
-
-1. **Canvas scene foundation**
-   - Draw four rooms with floor tiles, wall lines, doorway signs.
-   - Keep agents visible in idle state.
-   - Files: `packages/pixel-office/src/scene/*`
-
-2. **Mode switcher + panel card styling**
-   - Implement segmented control in app header.
-   - Apply panel card tokens to right-hand components.
-   - Files: `apps/demo-office/src/App.tsx`, `apps/demo-office/src/components/*`
-
-3. **Agent sprites and state postures**
-   - Add role-specific sprites and state postures.
-   - Wire Runtime state to sprite selection.
-   - Files: `packages/pixel-office/src/agents/*`, `packages/pixel-office/src/render/*`
-
-4. **Approval, blocked, failed moments**
-   - Service bell prop + glow.
-   - Approval drawer styling.
-   - Blocked/failed badges and error banner.
-   - Files: `packages/pixel-office/src/rooms/approval.ts`, `apps/demo-office/src/panels/*`
-
-5. **Focus and Debrief layouts**
-   - Compact urgent-only panel for Focus.
-   - Session Summary + Key timeline for Debrief.
-   - Files: `apps/demo-office/src/modes/*`
-
-6. **Animation pass**
-   - Idle breathe, walk, sparkle, pulse, bell glow.
-   - Reduced-motion gating.
-   - Files: `packages/pixel-office/src/animations/*`
-
-### Acceptance criteria
-
-- [x] All eight baseline states are re-captured and show clear visual improvement against this audit.
-- [x] Mode switcher matches design-system segmented control.
-- [x] Idle canvas shows all four rooms with props.
-- [x] Agents show role silhouettes and state postures.
-- [x] Approval, blocked, and failed states have explicit visual cues.
-- [x] Focus mode shows compact urgent-only panel.
-- [x] Debrief mode shows Session Summary + Key timeline.
-- [x] `npm test` and `npm run build` pass.
-- [x] PR description links `Issue #23` and `Refs #14`.
+Old flat files directly under `baseline/` have been removed and must stay gone. The 1440×900 set remains the source image for `scripts/generate-annotated-comparisons.mjs`.
 
 ## V1.1 verification
 
-This section records the visual QA evidence regenerated after Tasks 1–6 were completed. All eight baseline screenshots and annotated comparisons were re-captured on 2026-07-07.
+This section records the visual QA evidence after PR #24. All eight baseline screenshots and annotated comparisons were re-captured on 2026-07-08 across the three canonical resolutions.
 
 ### Re-captured states
 
-| # | State | Baseline | Annotated |
-|---|-------|----------|-----------|
+| # | State | Baseline (1440×900) | Annotated |
+|---|-------|---------------------|-----------|
 | 01 | Idle office | `baseline/1440x900/01-idle-office.png` | `01-idle-office-annotated.png` |
 | 02 | Active task execution | `baseline/1440x900/02-active-task-execution.png` | `02-active-task-execution-annotated.png` |
 | 03 | Artifact under review | `baseline/1440x900/03-artifact-under-review.png` | `03-artifact-under-review-annotated.png` |
 | 04 | Pending approval | `baseline/1440x900/04-pending-approval.png` | `04-pending-approval-annotated.png` |
 | 05 | Blocked task / agent | `baseline/1440x900/05-blocked-task-agent.png` | `05-blocked-task-agent-annotated.png` |
 | 06 | Revision / rework required | `baseline/1440x900/06-revision-required.png` | `06-revision-required-annotated.png` |
 | 07 | Focus mode | `baseline/1440x900/07-focus-mode.png` | `07-focus-mode-annotated.png` |
 | 08 | Debrief mode | `baseline/1440x900/08-debrief-mode.png` | `08-debrief-mode-annotated.png` |
 
 ### Visual upgrades verified
 
 The regenerated evidence shows the following V1.1 improvements over the original wireframe baseline:
 
-- **Four rooms and floor textures**: Idle canvas now renders Command, Execution, Review, and Approval/Delivery rooms with distinct floor patterns (wood planks, concrete tiles, woven rug, polished wood), wall lines, and wooden doorway signs. Previously the idle canvas was blank black.
-- **Role sprites and posture**: Agents display role-differentiated sprites (Orchestrator, Worker, Reviewer) with state-specific posture cues for idle, working, reviewing, blocked, and approval.
-- **Approval moment**: Pending-approval state shows the service-bell prop, pulsing urgency glow on the canvas, and an approval drawer with `--urgency` left-border accent, bell icon, and primary/danger Approve/Reject buttons.
-- **Blocked / failed expression**: Blocked agents show a red exclamation speech-bubble marker, red pulse glow, slumped posture, and a `--failure` badge with the blocked reason in the agent card.
+- **Four rooms and floor textures**: Idle canvas renders Command, Execution, Review, and Approval/Delivery rooms with distinct floor patterns, wall lines, and wooden doorway signs. Previously the idle canvas was blank black.
+- **Role sprites and posture**: Agents display role-differentiated sprites/procedural silhouettes (Orchestrator, Worker, Reviewer) with state-specific posture cues for idle, working, reviewing, blocked, and approval.
+- **Approval moment**: Pending-approval state shows the service-bell marker, pulsing urgency glow on the canvas, and an approval drawer with `--urgency` left-border accent, bell icon, and primary/danger Approve/Reject buttons.
+- **Blocked / failed expression**: Blocked agents show a red exclamation speech-bubble marker, red pulse glow, slumped posture, and a `--failure` badge with the blocked reason in the agent card. Agents whose `status` is `failed` receive a distinct failed marker.
 - **Focus panel**: Focus mode dims the canvas and collapses the right panel to a compact "Urgent Only" view with urgency-accented count cards for pending approvals, blocked tasks, and failed items.
 - **Debrief panel**: Debrief mode presents a curated "Session Summary" with Tasks completed, Approvals resolved, Artifacts delivered, and Events metrics, plus a Key timeline of milestone events.
-- **Micro-animations and reduced motion**: Agent idle breathe, working tool sparkle, approval bell pulse, and blocked pulse are implemented and gated by the "Motion on / Motion off" toggle in the header.
+- **Micro-animations and reduced motion**: Agent idle breathe, working tool sparkle, approval bell pulse, and blocked pulse are implemented and gated by the "Motion on / Motion off" toggle and by the `prefers-reduced-motion` media query.
 
 ### Audit caveat
 
-The mock adapter used by `apps/demo-office` cannot independently trigger a genuine runtime `failed` / runtime-error state. The V1.1 demo therefore honestly labels state 06 as **revision / rework required** (triggered by the "异常：返工" scenario) rather than as a true runtime failure. The canvas and panel still communicate rework through the Reviewer posture, review-room props, and related task cues.
+The mock adapter cannot independently trigger a genuine runtime `failed` / runtime-error state. The V1.1 demo therefore honestly labels state 06 as **revision / rework required** (triggered by the "异常：返工" scenario) rather than as a true runtime failure. The canvas and panel still communicate rework through the reviewer posture, review-room props, and related task cues.
+
+## Resolution pass (pending)
+
+A dedicated per-resolution pass is part of Issue #25 Task 3. Until that pass is completed, the following preliminary concerns are recorded:
+
+- `1366x768`: verify that the right panel at `360px` width does not truncate card text or badges.
+- `1440x900`: current reference resolution; used as the source for annotated comparisons.
+- `1920x1080`: verify that the wider `420px` panel and the centered canvas scaling use the extra space without excessive letterboxing.
 
 ## Appendix: artifact inventory
 
 | Artifact | Path |
 |----------|------|
-| Plan | `docs/superpowers/plans/2026-07-07-issue-23-swarm-office-v1.1-implementation.md` |
+| Plan | `docs/superpowers/plans/2026-07-08-issue-25-swarm-office-follow-up.md` |
+| Task brief | `docs/superpowers/plans/task-0-brief.md` |
 | Design system | `docs/design/swarm-office/design-system.md` |
 | High-fidelity reference | `docs/design/swarm-office/high-fidelity-designs-preview.png` |
 | Baseline screenshots | `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/` |
 | Annotated comparisons | `docs/design/swarm-office-v1.1/annotated-comparisons/` |
 | Screenshot script | `scripts/capture-demo-office-screenshots.mjs` |
 | Annotation script | `scripts/generate-annotated-comparisons.mjs` |
diff --git a/scripts/generate-annotated-comparisons.mjs b/scripts/generate-annotated-comparisons.mjs
index 740a074..e34ec2b 100644
--- a/scripts/generate-annotated-comparisons.mjs
+++ b/scripts/generate-annotated-comparisons.mjs
@@ -5,90 +5,94 @@ import path from "node:path";
 const BASELINE_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline/1440x900");
 const OUT_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/annotated-comparisons");
 
 fs.mkdirSync(OUT_DIR, { recursive: true });
 
 const annotations = [
   {
     name: "01-idle-office",
     title: "01 — Idle Office",
     notes: [
-      { x: 360, y: 260, label: "Canvas is blank black; target: full Command/Execution/Review/Approval rooms with wood floors, rugs, props" },
-      { x: 1090, y: 120, label: "Mode switcher is plain text; target: segmented control with --base-600 active fill" },
-      { x: 1090, y: 320, label: "World card lacks visual hierarchy; target: panel card --base-700 surface + --base-500 border" },
-      { x: 1090, y: 720, label: "Agent list is flat; target: cards with role silhouettes, status badges, pause actions" },
+      { x: 360, y: 260, label: "Linked canvas ↔ control-panel selection is not implemented; clicking an agent/room does not highlight the panel card." },
+      { x: 1090, y: 120, label: "Multi-resolution layout still needs hardening: 1366×768 legibility and 1920×1080 space usage are not yet baselined." },
+      { x: 1090, y: 320, label: "Selected / hovered state capture is missing from visual QA; baselines only show default unselected views." },
+      { x: 1090, y: 720, label: "Mock adapter cannot independently trigger genuine runtime failed/degraded states; those screenshots are skipped rather than fabricated." },
     ],
   },
   {
     name: "02-active-task-execution",
     title: "02 — Active Task Execution",
     notes: [
-      { x: 360, y: 220, label: "Rooms are flat color blocks; target: textured floors, wall lines, wooden doorway signs" },
-      { x: 560, y: 320, label: "Worker is a generic block; target: sturdy silhouette with tool belt + helmet, tool sparks" },
-      { x: 360, y: 560, label: "Missing props: workbench, task board, cable spool, cool task light" },
-      { x: 1090, y: 760, label: "Status badge is small green pill; target: --success badge + 'working' non-color cue (leaning posture)" },
+      { x: 560, y: 300, label: "No linked selection: selecting an agent on canvas does not highlight the matching Agents card or scroll it into view." },
+      { x: 360, y: 560, label: "Artifact truth boundaries are not exposed here; task/artifact cannot yet show content-available vs metadata-only vs unavailable states." },
+      { x: 1090, y: 760, label: "Hover / selected state capture missing; no baseline shows a highlighted task or agent row." },
+      { x: 1090, y: 320, label: "Multi-resolution layout needs audit: 1366×768 panel density and 1920×1080 stage spacing." },
     ],
   },
   {
     name: "03-artifact-under-review",
     title: "03 — Artifact Under Review",
     notes: [
-      { x: 360, y: 560, label: "Reviewer is generic block; target: slim silhouette with glasses + clipboard, page-flip activity" },
-      { x: 360, y: 760, label: "Review room lacks rug, round table, magnifying lamp, papers" },
-      { x: 1090, y: 760, label: "Status shows 'reviewing' but no approval-intent cue; target: clipboard page-flip + soft reading lamp" },
+      { x: 360, y: 560, label: "Artifact state truth boundaries need hardening: revision_required, rejected, blocked, and failed must remain visually distinct and not invented." },
+      { x: 1090, y: 600, label: "Metadata-only / unavailable artifact content is not yet rendered with dedicated UI states in the panel." },
+      { x: 1090, y: 760, label: "Canvas ↔ panel linked selection missing; selecting the reviewer or artifact does not cross-highlight." },
+      { x: 360, y: 760, label: "Mock adapter can produce blocked/revision states, but cannot truthfully produce a runtime failed state." },
     ],
   },
   {
     name: "04-pending-approval",
     title: "04 — Pending Approval",
     notes: [
-      { x: 620, y: 420, label: "Approval/Delivery room missing service bell, counter, package slot, wall sconce" },
-      { x: 1090, y: 600, label: "Approval drawer lacks urgency border-left (--urgency 4px) and bell icon" },
-      { x: 1090, y: 640, label: "Approve/Reject buttons style mismatch; target: primary + danger with --radius-md" },
-      { x: 620, y: 420, label: "No pulsing service-bell glow on canvas counterpart" },
+      { x: 620, y: 420, label: "Approval selection is not linked: choosing the approval in the drawer does not highlight the related room or agent on canvas." },
+      { x: 1090, y: 600, label: "Approve/Reject are decision outcomes; runtime failed/degraded states are out of scope for the mock adapter." },
+      { x: 1090, y: 320, label: "Selected / hovered card capture missing from visual QA baseline set." },
+      { x: 360, y: 120, label: "Multi-resolution hardening: wide-viewport spacing and narrow-viewport legibility not yet verified." },
     ],
   },
   {
     name: "05-blocked-task-agent",
     title: "05 — Blocked Task / Agent",
     notes: [
-      { x: 560, y: 300, label: "Blocked agent has red ! but no slumped posture or frustration expression" },
-      { x: 560, y: 300, label: "Missing red pulse glow / speech bubble per design system" },
-      { x: 1090, y: 840, label: "Blocked badge color correct but missing --failure-dim background + error code" },
+      { x: 560, y: 300, label: "Blocked posture and pulse are present, but true runtime failed/degraded capture is limited by mock adapter capability." },
+      { x: 360, y: 560, label: "This baseline honestly represents blocked; a genuine runtime failure cannot be independently triggered by the mock adapter." },
+      { x: 1090, y: 840, label: "Linked selection missing: clicking a blocked agent card does not highlight the canvas counterpart." },
+      { x: 1090, y: 600, label: "Artifact truth boundary: a blocked task must not be rendered as failed or rejected." },
     ],
   },
   {
     name: "06-revision-required",
     title: "06 — Revision / Rework Required",
     notes: [
-      { x: 360, y: 420, label: "Revision state is visually indistinguishable from idle on canvas" },
-      { x: 1090, y: 600, label: "Artifact/task marked revision_required but lacks a rework cue (clipboard with red flag)" },
-      { x: 1090, y: 760, label: "Agent list shows idle; target: reviewer/worker posture indicating rework + revision badge" },
-      { x: 360, y: 560, label: "Note: mock adapter cannot independently trigger a true failed/runtime-error state" },
+      { x: 360, y: 420, label: "Revision/rework must remain visually distinct from rejected and failed; artifact truth boundaries are the main remaining gap." },
+      { x: 1090, y: 600, label: "Metadata-only / unavailable / unsupported-open artifact states need explicit UI in the artifact card." },
+      { x: 1090, y: 760, label: "Selected / hovered task or artifact capture is not part of the current baseline set." },
+      { x: 360, y: 560, label: "Mock adapter limitation: this baseline uses revision_required; true runtime failed state cannot be truthfully produced." },
     ],
   },
   {
     name: "07-focus-mode",
     title: "07 — Focus Mode",
     notes: [
-      { x: 360, y: 420, label: "Focus overlay dims canvas but does not show ambient activity or compact urgent cards" },
-      { x: 1090, y: 640, label: "Urgent Summary cards exist but lack --urgency accents and count badges" },
-      { x: 1090, y: 420, label: "Right panel still shows full controls; target: collapsed 'Urgent Only' view" },
+      { x: 360, y: 420, label: "Focus panel exists but selection is not linked to canvas; no selected/hovered state capture." },
+      { x: 1090, y: 420, label: "Urgent-only compact view exists; multi-resolution spacing and 1366×768 legibility still need hardening." },
+      { x: 1090, y: 640, label: "Keyboard-accessible selection (Tab/Enter/Space/Escape) is not implemented." },
+      { x: 360, y: 120, label: "Runtime degraded/failed states are not captured because the mock adapter cannot truthfully produce them." },
     ],
   },
   {
     name: "08-debrief-mode",
     title: "08 — Debrief Mode",
     notes: [
-      { x: 360, y: 120, label: "Debrief shows raw event timeline; target: Session Summary with metrics cards + Key timeline" },
-      { x: 1090, y: 640, label: "Summary cards present but not grouped as 'Session Summary'; missing approvals/artifacts metrics" },
-      { x: 360, y: 420, label: "No agent/room debrief visuals or heatmap on canvas" },
+      { x: 360, y: 120, label: "Session Summary + Key timeline are present, but selection/hover states and canvas linkage are not." },
+      { x: 1090, y: 640, label: "Multi-resolution layout: metrics cards and timeline should be audited at 1366×768 and 1920×1080." },
+      { x: 360, y: 420, label: "No selected milestone or row highlight is captured in the baseline set." },
+      { x: 1090, y: 420, label: "Debrief selection does not sync back to canvas or panel; linked selection is a remaining gap." },
     ],
   },
 ];
 
 function buildHtml(item) {
   const imgSrc = `../baseline/1440x900/${item.name}.png`;
   const svgOverlays = item.notes
     .map((note, i) => {
       const num = i + 1;
       return `
@@ -118,21 +122,21 @@ function buildHtml(item) {
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
-    <p>Baseline screenshot with design-system / high-fidelity gaps annotated. Reference: docs/design/swarm-office/design-system.md</p>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
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
