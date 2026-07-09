# Task 3 review package

## Commits

0194e82 docs(superpowers): update Task 3 report commit range and hash
5d8d2ea docs(superpowers): add Task 3 report for Issue #25
1aee6ef feat(scripts,design): capture selected states, assert dimensions, update gap-audit for Issue #25 Task 3

## Diff stat

 .../01-idle-office-annotated.png                   | Bin 118146 -> 119148 bytes
 .../annotated-comparisons/01-idle-office.html      |   8 +-
 .../02-active-task-execution-annotated.png         | Bin 121757 -> 118706 bytes
 .../02-active-task-execution.html                  |   8 +-
 .../03-artifact-under-review-annotated.png         | Bin 123539 -> 126350 bytes
 .../03-artifact-under-review.html                  |   8 +-
 .../04-pending-approval-annotated.png              | Bin 123271 -> 125660 bytes
 .../annotated-comparisons/04-pending-approval.html |   6 +-
 .../05-blocked-task-agent-annotated.png            | Bin 126061 -> 126235 bytes
 .../05-blocked-task-agent.html                     |   8 +-
 .../06-revision-required-annotated.png             | Bin 121318 -> 124230 bytes
 .../06-revision-required.html                      |   8 +-
 .../07-focus-mode-annotated.png                    | Bin 89785 -> 88073 bytes
 .../annotated-comparisons/07-focus-mode.html       |   8 +-
 .../08-debrief-mode-annotated.png                  | Bin 84908 -> 82599 bytes
 .../annotated-comparisons/08-debrief-mode.html     |   6 +-
 .../09-selected-agent-annotated.png                | Bin 0 -> 57320 bytes
 .../annotated-comparisons/09-selected-agent.html   |  82 ++++++++++++++
 .../10-selected-task-card-annotated.png            | Bin 0 -> 117201 bytes
 .../10-selected-task-card.html                     |  82 ++++++++++++++
 .../baseline/1366x768/02-active-task-execution.png | Bin 85168 -> 85117 bytes
 .../baseline/1366x768/03-artifact-under-review.png | Bin 87355 -> 92343 bytes
 .../baseline/1366x768/04-pending-approval.png      | Bin 88177 -> 94370 bytes
 .../baseline/1366x768/05-blocked-task-agent.png    | Bin 89152 -> 94317 bytes
 .../baseline/1366x768/06-revision-required.png     | Bin 86114 -> 92402 bytes
 .../baseline/1366x768/07-focus-mode.png            | Bin 64219 -> 63825 bytes
 .../baseline/1366x768/08-debrief-mode.png          | Bin 62675 -> 62700 bytes
 .../baseline/1366x768/09-selected-agent.png        | Bin 0 -> 37541 bytes
 .../baseline/1366x768/10-selected-task-card.png    | Bin 0 -> 89608 bytes
 .../baseline/1440x900/02-active-task-execution.png | Bin 97097 -> 96999 bytes
 .../baseline/1440x900/03-artifact-under-review.png | Bin 99337 -> 103638 bytes
 .../baseline/1440x900/04-pending-approval.png      | Bin 100535 -> 105632 bytes
 .../baseline/1440x900/05-blocked-task-agent.png    | Bin 102019 -> 108023 bytes
 .../baseline/1440x900/06-revision-required.png     | Bin 97925 -> 102826 bytes
 .../baseline/1440x900/07-focus-mode.png            | Bin 69502 -> 68891 bytes
 .../baseline/1440x900/08-debrief-mode.png          | Bin 66720 -> 66487 bytes
 .../baseline/1440x900/09-selected-agent.png        | Bin 0 -> 41402 bytes
 .../baseline/1440x900/10-selected-task-card.png    | Bin 0 -> 100127 bytes
 .../baseline/1920x1080/01-idle-office.png          | Bin 114924 -> 114917 bytes
 .../1920x1080/02-active-task-execution.png         | Bin 122300 -> 122269 bytes
 .../1920x1080/03-artifact-under-review.png         | Bin 127008 -> 129363 bytes
 .../baseline/1920x1080/04-pending-approval.png     | Bin 128015 -> 131838 bytes
 .../baseline/1920x1080/05-blocked-task-agent.png   | Bin 130668 -> 141180 bytes
 .../baseline/1920x1080/06-revision-required.png    | Bin 124548 -> 129195 bytes
 .../baseline/1920x1080/07-focus-mode.png           | Bin 82715 -> 82487 bytes
 .../baseline/1920x1080/08-debrief-mode.png         | Bin 76709 -> 77116 bytes
 .../baseline/1920x1080/09-selected-agent.png       | Bin 0 -> 48785 bytes
 .../baseline/1920x1080/10-selected-task-card.png   | Bin 0 -> 126633 bytes
 docs/design/swarm-office-v1.1/gap-audit.md         |  46 +++++---
 docs/superpowers/plans/task-3-report.md            |  62 +++++++++++
 scripts/capture-demo-office-screenshots.mjs        | 121 +++++++++++++++++++--
 scripts/generate-annotated-comparisons.mjs         |  80 +++++++++-----
 52 files changed, 446 insertions(+), 87 deletions(-)

## Full diff

diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png
index 9d10636..57e5be8 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html
index db62c8d..e9a3dce 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html
@@ -25,51 +25,51 @@
       <img src="../baseline/1440x900/01-idle-office.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 260)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="260" x2="390" y2="220" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="190" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Linked canvas ↔ control-panel selection is not implemented; clicking an agent/room does not highlight the panel card.
+          <strong style="color:#e6a85c">1.</strong> Linked selection baseline added: 09 + 10 capture selected agent and selected task card. Room/approval cross-highlight still needs dedicated baseline coverage.
         </div>
       </foreignObject>
       <g transform="translate(1090, 120)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="120" x2="1120" y2="80" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="50" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Multi-resolution layout still needs hardening: 1366×768 legibility and 1920×1080 space usage are not yet baselined.
+          <strong style="color:#e6a85c">2.</strong> Multi-resolution layout hardening: verify 1366×768 panel density and 1920×1080 stage spacing.
         </div>
       </foreignObject>
       <g transform="translate(1090, 320)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="320" x2="1120" y2="280" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="250" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Selected / hovered state capture is missing from visual QA; baselines only show default unselected views.
+          <strong style="color:#e6a85c">3.</strong> Artifact truth boundary: mock adapter cannot produce metadata-only / unavailable / unsupported-open content, so those UI states are not baselined.
         </div>
       </foreignObject>
       <g transform="translate(1090, 720)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="1090" y1="720" x2="1120" y2="680" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="650" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Mock adapter cannot independently trigger genuine runtime failed/degraded states; those screenshots are skipped rather than fabricated.
+          <strong style="color:#e6a85c">4.</strong> Runtime degraded/failed states are skipped because the mock adapter cannot truthfully produce them.
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
index 477015d..3f683ae 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html
index 4768a9d..26a8cd8 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html
@@ -25,51 +25,51 @@
       <img src="../baseline/1440x900/02-active-task-execution.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(560, 300)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="560" y1="300" x2="590" y2="260" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="595" y="230" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> No linked selection: selecting an agent on canvas does not highlight the matching Agents card or scroll it into view.
+          <strong style="color:#e6a85c">1.</strong> Selected task card baseline (10) shows linked canvas highlight; hover-only state is not separately baselined.
         </div>
       </foreignObject>
       <g transform="translate(360, 560)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="490" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Artifact truth boundaries are not exposed here; task/artifact cannot yet show content-available vs metadata-only vs unavailable states.
+          <strong style="color:#e6a85c">2.</strong> Artifact truth: normal-flow artifact has a URI; metadata-only / unavailable / unsupported-open states remain unverified.
         </div>
       </foreignObject>
       <g transform="translate(1090, 760)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="760" x2="1120" y2="720" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="690" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Hover / selected state capture missing; no baseline shows a highlighted task or agent row.
+          <strong style="color:#e6a85c">3.</strong> Resolution hardening: check 1366×768 card text truncation and 1920×1080 panel width.
         </div>
       </foreignObject>
       <g transform="translate(1090, 320)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="1090" y1="320" x2="1120" y2="280" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="250" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Multi-resolution layout needs audit: 1366×768 panel density and 1920×1080 stage spacing.
+          <strong style="color:#e6a85c">4.</strong> Multi-resolution spacing audit pending.
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
index b518e35..22d0bb7 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html
index e59f2de..d7beea2 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html
@@ -25,51 +25,51 @@
       <img src="../baseline/1440x900/03-artifact-under-review.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 560)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="490" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Artifact state truth boundaries need hardening: revision_required, rejected, blocked, and failed must remain visually distinct and not invented.
+          <strong style="color:#e6a85c">1.</strong> Artifact state truth boundaries: revision_required, rejected, blocked, and failed must stay distinct. Mock cannot produce true runtime failed.
         </div>
       </foreignObject>
       <g transform="translate(1090, 600)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="530" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Metadata-only / unavailable artifact content is not yet rendered with dedicated UI states in the panel.
+          <strong style="color:#e6a85c">2.</strong> Metadata-only / unavailable / unsupported-open artifact UI is not baselined due to mock adapter limitations.
         </div>
       </foreignObject>
       <g transform="translate(1090, 760)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="760" x2="1120" y2="720" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="690" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Canvas ↔ panel linked selection missing; selecting the reviewer or artifact does not cross-highlight.
+          <strong style="color:#e6a85c">3.</strong> Canvas ↔ panel linked selection for reviewer/artifact is implemented but not yet a dedicated baseline.
         </div>
       </foreignObject>
       <g transform="translate(360, 760)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="360" y1="760" x2="390" y2="720" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="690" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Mock adapter can produce blocked/revision states, but cannot truthfully produce a runtime failed state.
+          <strong style="color:#e6a85c">4.</strong> Resolution hardening: wide/narrow viewport spacing.
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
index ddb2a30..6593905 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html
index 0178587..4ee90e5 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html
@@ -25,51 +25,51 @@
       <img src="../baseline/1440x900/04-pending-approval.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(620, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="620" y1="420" x2="650" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="655" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Approval selection is not linked: choosing the approval in the drawer does not highlight the related room or agent on canvas.
+          <strong style="color:#e6a85c">1.</strong> Approval cross-highlight is implemented; a dedicated selected-approval baseline is not yet captured.
         </div>
       </foreignObject>
       <g transform="translate(1090, 600)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="530" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
           <strong style="color:#e6a85c">2.</strong> Approve/Reject are decision outcomes; runtime failed/degraded states are out of scope for the mock adapter.
         </div>
       </foreignObject>
       <g transform="translate(1090, 320)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="320" x2="1120" y2="280" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="250" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Selected / hovered card capture missing from visual QA baseline set.
+          <strong style="color:#e6a85c">3.</strong> Selected / hovered card capture now exists for agent and task.
         </div>
       </foreignObject>
       <g transform="translate(360, 120)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="360" y1="120" x2="390" y2="80" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="50" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Multi-resolution hardening: wide-viewport spacing and narrow-viewport legibility not yet verified.
+          <strong style="color:#e6a85c">4.</strong> Multi-resolution hardening: verify spacing and legibility.
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
index cb8b434..2a23a88 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html
index 8fa2964..d7eb7c0 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html
@@ -25,51 +25,51 @@
       <img src="../baseline/1440x900/05-blocked-task-agent.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(560, 300)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="560" y1="300" x2="590" y2="260" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="595" y="230" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Blocked posture and pulse are present, but true runtime failed/degraded capture is limited by mock adapter capability.
+          <strong style="color:#e6a85c">1.</strong> Blocked posture and pulse baseline is truthful; runtime failed/degraded capture is skipped.
         </div>
       </foreignObject>
       <g transform="translate(360, 560)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="490" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> This baseline honestly represents blocked; a genuine runtime failure cannot be independently triggered by the mock adapter.
+          <strong style="color:#e6a85c">2.</strong> Blocked must not be mislabeled as failed or rejected.
         </div>
       </foreignObject>
       <g transform="translate(1090, 840)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="840" x2="1120" y2="800" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="770" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Linked selection missing: clicking a blocked agent card does not highlight the canvas counterpart.
+          <strong style="color:#e6a85c">3.</strong> Linked selection for blocked agent card is implemented; room cross-highlight baseline is pending.
         </div>
       </foreignObject>
       <g transform="translate(1090, 600)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="530" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Artifact truth boundary: a blocked task must not be rendered as failed or rejected.
+          <strong style="color:#e6a85c">4.</strong> Artifact truth boundary: a blocked task must not invent artifact content.
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
index 4ed0c7e..7780201 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html
index 7ed7c1c..095da21 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html
@@ -25,51 +25,51 @@
       <img src="../baseline/1440x900/06-revision-required.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="420" x2="390" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Revision/rework must remain visually distinct from rejected and failed; artifact truth boundaries are the main remaining gap.
+          <strong style="color:#e6a85c">1.</strong> Revision/rework badge is distinct from rejected and failed; artifact truth remains the main open gap.
         </div>
       </foreignObject>
       <g transform="translate(1090, 600)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="530" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Metadata-only / unavailable / unsupported-open artifact states need explicit UI in the artifact card.
+          <strong style="color:#e6a85c">2.</strong> Metadata-only / unavailable / unsupported-open artifact states need truthful adapter support to baseline.
         </div>
       </foreignObject>
       <g transform="translate(1090, 760)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="760" x2="1120" y2="720" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="690" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Selected / hovered task or artifact capture is not part of the current baseline set.
+          <strong style="color:#e6a85c">3.</strong> Selected task/artifact card baselines added; selected-reviewer baseline is pending.
         </div>
       </foreignObject>
       <g transform="translate(360, 560)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="490" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Mock adapter limitation: this baseline uses revision_required; true runtime failed state cannot be truthfully produced.
+          <strong style="color:#e6a85c">4.</strong> Mock adapter limitation: a true runtime failed state cannot be independently produced.
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
index ef976a6..5ed8a60 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html
index 4b22496..86097df 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html
@@ -25,51 +25,51 @@
       <img src="../baseline/1440x900/07-focus-mode.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="420" x2="390" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Focus panel exists but selection is not linked to canvas; no selected/hovered state capture.
+          <strong style="color:#e6a85c">1.</strong> Focus panel exists; selection linkage is implemented but not shown in this baseline.
         </div>
       </foreignObject>
       <g transform="translate(1090, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="420" x2="1120" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">2.</strong> Urgent-only compact view exists; multi-resolution spacing and 1366×768 legibility still need hardening.
+          <strong style="color:#e6a85c">2.</strong> Urgent-only compact view; multi-resolution spacing and 1366×768 legibility need audit.
         </div>
       </foreignObject>
       <g transform="translate(1090, 640)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="1090" y1="640" x2="1120" y2="600" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="570" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> Keyboard-accessible selection (Tab/Enter/Space/Escape) is not implemented.
+          <strong style="color:#e6a85c">3.</strong> Keyboard-accessible selection is implemented (Tab/Enter/Space/Escape).
         </div>
       </foreignObject>
       <g transform="translate(360, 120)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="360" y1="120" x2="390" y2="80" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="50" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Runtime degraded/failed states are not captured because the mock adapter cannot truthfully produce them.
+          <strong style="color:#e6a85c">4.</strong> Runtime degraded/failed states are not captured because the mock adapter cannot produce them.
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
index 82d81e6..99daf70 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html
index 117512e..f8705c9 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html
@@ -25,51 +25,51 @@
       <img src="../baseline/1440x900/08-debrief-mode.png" id="targetImg" />
       <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
         
       <g transform="translate(360, 120)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
       </g>
       <line x1="360" y1="120" x2="390" y2="80" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="50" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">1.</strong> Session Summary + Key timeline are present, but selection/hover states and canvas linkage are not.
+          <strong style="color:#e6a85c">1.</strong> Session Summary + Key timeline are present; selected/hover states are not captured in debrief.
         </div>
       </foreignObject>
       <g transform="translate(1090, 640)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
       </g>
       <line x1="1090" y1="640" x2="1120" y2="600" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="570" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
           <strong style="color:#e6a85c">2.</strong> Multi-resolution layout: metrics cards and timeline should be audited at 1366×768 and 1920×1080.
         </div>
       </foreignObject>
       <g transform="translate(360, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
       </g>
       <line x1="360" y1="420" x2="390" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="395" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">3.</strong> No selected milestone or row highlight is captured in the baseline set.
+          <strong style="color:#e6a85c">3.</strong> No selected milestone or row highlight baseline yet.
         </div>
       </foreignObject>
       <g transform="translate(1090, 420)">
         <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
         <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
       </g>
       <line x1="1090" y1="420" x2="1120" y2="380" stroke="#e6a85c" stroke-width="2" />
       <foreignObject x="1125" y="350" width="340" height="80">
         <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
-          <strong style="color:#e6a85c">4.</strong> Debrief selection does not sync back to canvas or panel; linked selection is a remaining gap.
+          <strong style="color:#e6a85c">4.</strong> Debrief selection linkage exists but is not baselined.
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
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent-annotated.png
new file mode 100644
index 0000000..22a00d5
Binary files /dev/null and b/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent.html b/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent.html
new file mode 100644
index 0000000..4e1c103
--- /dev/null
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent.html
@@ -0,0 +1,82 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8" />
+  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+  <title>09 — Selected Agent</title>
+  <style>
+    * { box-sizing: border-box; }
+    body { margin: 0; background: #131014; color: #f2f0eb; font-family: Inter, system-ui, sans-serif; }
+    .header { padding: 16px 24px; border-bottom: 1px solid #322e36; }
+    .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
+    .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
+    .wrap { position: relative; display: inline-block; }
+    .wrap img { display: block; max-width: 100%; }
+    .container { padding: 16px 24px; }
+  </style>
+</head>
+<body>
+  <div class="header">
+    <h1>09 — Selected Agent</h1>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
+  </div>
+  <div class="container">
+    <div class="wrap" id="wrap">
+      <img src="../baseline/1440x900/09-selected-agent.png" id="targetImg" />
+      <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
+        
+      <g transform="translate(560, 260)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
+      </g>
+      <line x1="560" y1="260" x2="590" y2="220" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="595" y="190" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">1.</strong> Canvas agent selection highlights the matching panel card and scrolls it into view.
+        </div>
+      </foreignObject>
+      <g transform="translate(1090, 320)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
+      </g>
+      <line x1="1090" y1="320" x2="1120" y2="280" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="250" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">2.</strong> Linked selection baseline: agent ↔ card cross-highlight.
+        </div>
+      </foreignObject>
+      <g transform="translate(360, 560)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
+      </g>
+      <line x1="360" y1="560" x2="390" y2="520" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="395" y="490" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">3.</strong> Resolution hardening: ensure selection ring is visible at all resolutions.
+        </div>
+      </foreignObject>
+      <g transform="translate(1090, 720)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
+      </g>
+      <line x1="1090" y1="720" x2="1120" y2="680" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="650" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">4.</strong> Room/approval/task cross-highlight baselines still pending.
+        </div>
+      </foreignObject>
+      </svg>
+    </div>
+  </div>
+  <script>
+    const img = document.getElementById('targetImg');
+    const svg = document.getElementById('overlay');
+    img.onload = () => {
+      svg.setAttribute('width', img.naturalWidth);
+      svg.setAttribute('height', img.naturalHeight);
+      document.getElementById('wrap').style.width = img.naturalWidth + 'px';
+    };
+    if (img.complete) img.onload();
+  </script>
+</body>
+</html>
\ No newline at end of file
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card-annotated.png
new file mode 100644
index 0000000..fa8a34d
Binary files /dev/null and b/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card.html b/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card.html
new file mode 100644
index 0000000..54eff63
--- /dev/null
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card.html
@@ -0,0 +1,82 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8" />
+  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+  <title>10 — Selected Task Card</title>
+  <style>
+    * { box-sizing: border-box; }
+    body { margin: 0; background: #131014; color: #f2f0eb; font-family: Inter, system-ui, sans-serif; }
+    .header { padding: 16px 24px; border-bottom: 1px solid #322e36; }
+    .header h1 { margin: 0; font-size: 16px; font-weight: 600; }
+    .header p { margin: 4px 0 0; font-size: 11px; color: #b8b0bc; }
+    .wrap { position: relative; display: inline-block; }
+    .wrap img { display: block; max-width: 100%; }
+    .container { padding: 16px 24px; }
+  </style>
+</head>
+<body>
+  <div class="header">
+    <h1>10 — Selected Task Card</h1>
+    <p>Baseline screenshot with current Issue #25 gaps annotated. Reference: docs/design/swarm-office-v1.1/gap-audit.md</p>
+  </div>
+  <div class="container">
+    <div class="wrap" id="wrap">
+      <img src="../baseline/1440x900/10-selected-task-card.png" id="targetImg" />
+      <svg id="overlay" style="position:absolute;top:0;left:0;pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
+        
+      <g transform="translate(1090, 420)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">1</text>
+      </g>
+      <line x1="1090" y1="420" x2="1120" y2="380" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="350" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">1.</strong> Selected task card shows card--selected highlight and highlights the assignee on canvas.
+        </div>
+      </foreignObject>
+      <g transform="translate(560, 300)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">2</text>
+      </g>
+      <line x1="560" y1="300" x2="590" y2="260" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="595" y="230" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">2.</strong> Linked selection baseline: task card ↔ agent on canvas.
+        </div>
+      </foreignObject>
+      <g transform="translate(1090, 720)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">3</text>
+      </g>
+      <line x1="1090" y1="720" x2="1120" y2="680" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="650" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">3.</strong> Artifact/approval cross-highlight baselines still pending.
+        </div>
+      </foreignObject>
+      <g transform="translate(360, 120)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
+      </g>
+      <line x1="360" y1="120" x2="390" y2="80" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="395" y="50" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
+          <strong style="color:#e6a85c">4.</strong> Resolution hardening: selection ring and panel width.
+        </div>
+      </foreignObject>
+      </svg>
+    </div>
+  </div>
+  <script>
+    const img = document.getElementById('targetImg');
+    const svg = document.getElementById('overlay');
+    img.onload = () => {
+      svg.setAttribute('width', img.naturalWidth);
+      svg.setAttribute('height', img.naturalHeight);
+      document.getElementById('wrap').style.width = img.naturalWidth + 'px';
+    };
+    if (img.complete) img.onload();
+  </script>
+</body>
+</html>
\ No newline at end of file
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png
index b46ca54..51f42b9 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png
index 40161ed..bae04c2 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png
index 1a7b006..97ecc98 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png
index 88712d3..dc021cd 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png
index e5f28f3..8c27c08 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png
index 8baab65..d8d03b3 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png
index a13faca..88b25a6 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/09-selected-agent.png b/docs/design/swarm-office-v1.1/baseline/1366x768/09-selected-agent.png
new file mode 100644
index 0000000..29ba9bd
Binary files /dev/null and b/docs/design/swarm-office-v1.1/baseline/1366x768/09-selected-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/10-selected-task-card.png b/docs/design/swarm-office-v1.1/baseline/1366x768/10-selected-task-card.png
new file mode 100644
index 0000000..0c61b14
Binary files /dev/null and b/docs/design/swarm-office-v1.1/baseline/1366x768/10-selected-task-card.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png
index 21b1997..b63e84c 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png
index 313b9af..6167f23 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png
index de6a6c1..4273cf3 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png
index 120ef00..1b698c0 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png
index d98c63f..84e8f4b 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png
index 2c2cfb6..13286ec 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png
index fd75a41..5a9f615 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/09-selected-agent.png b/docs/design/swarm-office-v1.1/baseline/1440x900/09-selected-agent.png
new file mode 100644
index 0000000..585056a
Binary files /dev/null and b/docs/design/swarm-office-v1.1/baseline/1440x900/09-selected-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/10-selected-task-card.png b/docs/design/swarm-office-v1.1/baseline/1440x900/10-selected-task-card.png
new file mode 100644
index 0000000..9763aaa
Binary files /dev/null and b/docs/design/swarm-office-v1.1/baseline/1440x900/10-selected-task-card.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/01-idle-office.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/01-idle-office.png
index 9328685..3c356d0 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/01-idle-office.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/01-idle-office.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png
index a9d3a37..723096c 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png
index 95e3fb5..26ed63f 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png
index f364dae..0655d57 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png
index 6ad8f75..080fad7 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png
index c2de1cb..47f1d55 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png
index 7a9c9e3..3155cc8 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png
index cc72b14..b3a83ef 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/09-selected-agent.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/09-selected-agent.png
new file mode 100644
index 0000000..b9bde47
Binary files /dev/null and b/docs/design/swarm-office-v1.1/baseline/1920x1080/09-selected-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/10-selected-task-card.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/10-selected-task-card.png
new file mode 100644
index 0000000..18833ef
Binary files /dev/null and b/docs/design/swarm-office-v1.1/baseline/1920x1080/10-selected-task-card.png differ
diff --git a/docs/design/swarm-office-v1.1/gap-audit.md b/docs/design/swarm-office-v1.1/gap-audit.md
index 83b99d3..44fb2c7 100644
--- a/docs/design/swarm-office-v1.1/gap-audit.md
+++ b/docs/design/swarm-office-v1.1/gap-audit.md
@@ -1,17 +1,17 @@
 # Swarm Office V1.1 — Gap Audit
 
 > Evidence-based visual/UX gap analysis for `apps/demo-office`.
 > Baseline screenshots: `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/`
 > Annotated comparisons: `docs/design/swarm-office-v1.1/annotated-comparisons/`
 > Reference: `docs/design/swarm-office/design-system.md` + `docs/design/swarm-office/high-fidelity-designs-preview.png`
-> PR context: Task 0 of Issue #25; pre-PR #24 findings are now historical. Refs #14.
+> PR context: Task 3 of Issue #25; pre-PR #24 findings are now historical. Refs #14.
 
 ## Executive summary
 
 PR #24 closed the first Swarm Office V1.1 visual pass. `apps/demo-office` now renders all eight runtime states with rooms, role-differentiated agent sprites, state postures, approval/blocked effects, and mode-specific panels. The remaining work tracked by Issue #25 is interaction and truth-boundary hardening rather than a wireframe-to-visual upgrade.
 
 This audit therefore splits the evidence into two sections:
 
 1. **Historical V1.0 → V1.1 delta** — gaps that existed before PR #24 and are now resolved.
 2. **Current-state audit** — gaps that remain after PR #24 and are the focus of Issue #25.
 
@@ -42,32 +42,33 @@ This audit therefore splits the evidence into two sections:
 
 ### 2. Artifact state truth boundaries
 
 - `revision_required`, `rejected`, `blocked`, and `failed` must remain visually distinct on both canvas and panel.
 - `ControlPanel` already classifies artifact content by `content`, `uri`, and `uri === null`, but does not render explicit `metadata-only`, `unavailable`, `loading`, `failed-open`, or `unsupported-open` UI states.
 - `artifactStatusIntent` maps `rejected` to the `failed` badge intent, which can blur the difference between a decision outcome and a runtime failure.
 - `artifactId` is never treated as a URI; missing content references must render as metadata-only/unavailable rather than invented content.
 
 ### 3. Multi-resolution layout hardening
 
-- Baselines exist for `1366x768`, `1440x900`, and `1920x1080`, but a per-resolution pass has not been completed.
-- `1366x768`: panel density, mode-switcher labels, and card text need legibility verification.
-- `1920x1080`: extra horizontal space can leave the stage/panel feeling loose; spacing and panel width need audit.
+- Baselines were re-captured at `1366x768`, `1440x900`, and `1920x1080` with dimension and overflow assertions.
+- No horizontal overflow was detected at any target resolution.
+- `1366x768` panel density, mode-switcher labels, and card text remain legible.
+- `1920x1080` uses the extra stage width for the centered, scaled canvas; the `420px` panel feels proportional.
 - The responsive auto-switch to list view below `1024px` is implemented but not baselined.
 
-### 4. Selected / hovered state capture missing from visual QA
+### 4. Selected / hovered state capture
 
-- The screenshot pipeline captures the eight default runtime states, but does not capture:
-  - selected agent on canvas + highlighted panel card,
-  - hovered/selected task or artifact card,
-  - selected room and related active agents.
-- The annotation script has been updated to use current-gap labels; the remaining work is to capture selected/hovered states in the screenshot pipeline.
+- The screenshot pipeline now captures:
+  - selected agent on canvas + highlighted panel card (`09-selected-agent`),
+  - selected task card + highlighted assignee on canvas (`10-selected-task-card`).
+- Linked selection for agent and task is therefore baselined.
+- Not yet captured: hover-only states, selected room and related active agents, selected approval/artifact cross-highlight, and selected/hovered rows in Debrief mode.
 
 ### 5. Runtime degraded / failed state capture limited by mock adapter
 
 - The mock adapter can produce `blocked` agents/tasks and `revision_required` artifacts through its scripted scenarios.
 - It cannot independently trigger a genuine runtime `failed` / runtime-error state, nor a runtime-degraded/session-degraded state.
 - Visual QA for these states must be skipped rather than fabricated; screenshots are only captured if the adapter truthfully supports the state.
 
 ## Accepted deviations
 
 The mock adapter used by `apps/demo-office` cannot independently trigger a genuine runtime `failed` / runtime-error state or a runtime-degraded state. The V1.1 demo therefore honestly labels state 05 as **blocked task / agent** and state 06 as **revision / rework required**, rather than claiming true runtime failures. Screenshots for runtime failed/degraded states will only be added if the underlying adapter or Runtime session can truthfully produce them.
@@ -77,61 +78,72 @@ The mock adapter used by `apps/demo-office` cannot independently trigger a genui
 The multi-resolution folders are the source of truth:
 
 - `docs/design/swarm-office-v1.1/baseline/1366x768/`
 - `docs/design/swarm-office-v1.1/baseline/1440x900/`
 - `docs/design/swarm-office-v1.1/baseline/1920x1080/`
 
 Old flat files directly under `baseline/` have been removed and must stay gone. The 1440×900 set remains the source image for `scripts/generate-annotated-comparisons.mjs`.
 
 ## V1.1 verification
 
-This section records the visual QA evidence after PR #24. All eight baseline screenshots and annotated comparisons were re-captured on 2026-07-08 across the three canonical resolutions.
+This section records the visual QA evidence after PR #24 and Task 3. All ten baseline screenshots and annotated comparisons were re-captured on 2026-07-08 across the three canonical resolutions.
 
 ### Re-captured states
 
 | # | State | Baseline (1440×900) | Annotated |
 |---|-------|---------------------|-----------|
 | 01 | Idle office | `baseline/1440x900/01-idle-office.png` | `01-idle-office-annotated.png` |
 | 02 | Active task execution | `baseline/1440x900/02-active-task-execution.png` | `02-active-task-execution-annotated.png` |
 | 03 | Artifact under review | `baseline/1440x900/03-artifact-under-review.png` | `03-artifact-under-review-annotated.png` |
 | 04 | Pending approval | `baseline/1440x900/04-pending-approval.png` | `04-pending-approval-annotated.png` |
 | 05 | Blocked task / agent | `baseline/1440x900/05-blocked-task-agent.png` | `05-blocked-task-agent-annotated.png` |
 | 06 | Revision / rework required | `baseline/1440x900/06-revision-required.png` | `06-revision-required-annotated.png` |
 | 07 | Focus mode | `baseline/1440x900/07-focus-mode.png` | `07-focus-mode-annotated.png` |
 | 08 | Debrief mode | `baseline/1440x900/08-debrief-mode.png` | `08-debrief-mode-annotated.png` |
+| 09 | Selected agent | `baseline/1440x900/09-selected-agent.png` | `09-selected-agent-annotated.png` |
+| 10 | Selected task card | `baseline/1440x900/10-selected-task-card.png` | `10-selected-task-card-annotated.png` |
 
 ### Visual upgrades verified
 
 The regenerated evidence shows the following V1.1 improvements over the original wireframe baseline:
 
 - **Four rooms and floor textures**: Idle canvas renders Command, Execution, Review, and Approval/Delivery rooms with distinct floor patterns, wall lines, and wooden doorway signs. Previously the idle canvas was blank black.
 - **Role sprites and posture**: Agents display role-differentiated sprites/procedural silhouettes (Orchestrator, Worker, Reviewer) with state-specific posture cues for idle, working, reviewing, blocked, and approval.
 - **Approval moment**: Pending-approval state shows the service-bell marker, pulsing urgency glow on the canvas, and an approval drawer with `--urgency` left-border accent, bell icon, and primary/danger Approve/Reject buttons.
 - **Blocked / failed expression**: Blocked agents show a red exclamation speech-bubble marker, red pulse glow, slumped posture, and a `--failure` badge with the blocked reason in the agent card. Agents whose `status` is `failed` receive a distinct failed marker.
 - **Focus panel**: Focus mode dims the canvas and collapses the right panel to a compact "Urgent Only" view with urgency-accented count cards for pending approvals, blocked tasks, and failed items.
 - **Debrief panel**: Debrief mode presents a curated "Session Summary" with Tasks completed, Approvals resolved, Artifacts delivered, and Events metrics, plus a Key timeline of milestone events.
 - **Micro-animations and reduced motion**: Agent idle breathe, working tool sparkle, approval bell pulse, and blocked pulse are implemented and gated by the "Motion on / Motion off" toggle and by the `prefers-reduced-motion` media query.
 
 ### Audit caveat
 
 The mock adapter cannot independently trigger a genuine runtime `failed` / runtime-error state. The V1.1 demo therefore honestly labels state 06 as **revision / rework required** (triggered by the "异常：返工" scenario) rather than as a true runtime failure. The canvas and panel still communicate rework through the reviewer posture, review-room props, and related task cues.
 
-## Resolution pass (pending)
+## Resolution pass
 
-A dedicated per-resolution pass is part of Issue #25 Task 3. Until that pass is completed, the following preliminary concerns are recorded:
+A dedicated per-resolution pass was run on 2026-07-08 across `1366x768`, `1440x900`, and `1920x1080` using the updated `capture-demo-office-screenshots.mjs`. The script asserts that every PNG matches the target viewport width, matches the full-page height, and that `document.documentElement.scrollWidth <= clientWidth`.
 
-- `1366x768`: verify that the right panel at `360px` width does not truncate card text or badges.
-- `1440x900`: current reference resolution; used as the source for annotated comparisons.
-- `1920x1080`: verify that the wider `420px` panel and the centered canvas scaling use the extra space without excessive letterboxing.
+| Resolution | Panel width | Approx. stage width | Observations |
+|---|---|---|---|
+| `1366x768` | `360px` | `1006px` | No horizontal overflow; panel density, mode-switcher labels, and card text remain legible. |
+| `1440x900` | `380px` | `1060px` | Reference resolution used for annotated comparisons; no overflow. |
+| `1920x1080` | `420px` | `1500px` | No horizontal overflow; extra stage width is used by the centered, scaled canvas without excessive letterboxing. |
+
+Findings:
+
+- All three resolutions pass the dimension and overflow assertions.
+- Full-page screenshots scale correctly with the device pixel ratio.
+- The responsive panel shrink (`360px` / `380px` / `420px`) keeps the layout balanced.
+- Gaps not resolved by this pass: artifact truth states that the mock adapter cannot produce (`metadata-only`, `unavailable`, `unsupported-open`), and runtime `degraded` / `failed` states.
 
 ## Appendix: artifact inventory
 
 | Artifact | Path |
 |----------|------|
 | Plan | `docs/superpowers/plans/2026-07-08-issue-25-swarm-office-follow-up.md` |
-| Task brief | `docs/superpowers/plans/task-0-brief.md` |
+| Task brief | `docs/superpowers/plans/task-3-brief.md` |
 | Design system | `docs/design/swarm-office/design-system.md` |
 | High-fidelity reference | `docs/design/swarm-office/high-fidelity-designs-preview.png` |
 | Baseline screenshots | `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/` |
 | Annotated comparisons | `docs/design/swarm-office-v1.1/annotated-comparisons/` |
 | Screenshot script | `scripts/capture-demo-office-screenshots.mjs` |
 | Annotation script | `scripts/generate-annotated-comparisons.mjs` |
diff --git a/docs/superpowers/plans/task-3-report.md b/docs/superpowers/plans/task-3-report.md
new file mode 100644
index 0000000..270cdd7
--- /dev/null
+++ b/docs/superpowers/plans/task-3-report.md
@@ -0,0 +1,62 @@
+# Task 3 报告：Visual QA hardening
+
+## 状态
+
+DONE
+
+## 提交
+
+- `1aee6ef` feat(scripts,design): capture selected states, assert dimensions, update gap-audit for Issue #25 Task 3
+- `5d8d2ea` docs(superpowers): add Task 3 report for Issue #25
+
+分支：`issue-25-swarm-office-follow-up`
+范围：`1aee6ef^..5d8d2ea`
+
+## 测试摘要
+
+- `node scripts/capture-demo-office-screenshots.mjs`：通过，10 个状态 × 3 种分辨率全部捕获，所有截图均通过尺寸与水平溢出断言。
+- `node scripts/generate-annotated-comparisons.mjs`：通过，生成 10 张带标注对比图。
+- `npm test -- --run`：59 个测试文件，642 个测试全部通过。
+- `npm run build`：通过，demo-office 生产构建成功。
+
+## 已完成
+
+1. 更新 `scripts/capture-demo-office-screenshots.mjs`
+   - 保留原有 8 个状态。
+   - 新增 `09-selected-agent`：点击 Agents 卡片，画布与卡片联动高亮。
+   - 新增 `10-selected-task-card`：点击 Tasks 卡片，卡片与画布负责人联动高亮。
+   - 每个 PNG 后断言：宽度等于视口宽度 × DPR，高度等于 `scrollHeight × DPR`，且 `scrollWidth <= clientWidth`（无水平溢出）。
+
+2. 更新 `scripts/generate-annotated-comparisons.mjs`
+   - 使用当前差距标签（linked selection、artifact truth、resolution hardening）。
+   - 为 01–08 更新标注文案，反映已有进展。
+   - 新增 09、10 的标注页面与图片。
+
+3. 更新 `docs/design/swarm-office-v1.1/gap-audit.md`
+   - 重写“Resolution pass”为实际执行结果。
+   - 更新当前状态审计：多分辨率通过、agent/task 联动选择已基线化、剩余未捕获项。
+   - 补充 09、10 到 re-captured states 表格。
+
+4. 重新生成基线与标注图
+   - `baseline/{1366x768,1440x900,1920x1080}/` 下 10 张 PNG。
+   - `annotated-comparisons/` 下 10 张带标注 PNG 与 HTML。
+
+## 跳过的状态及原因
+
+以下状态因当前 `MockRuntimeAdapter` 无法真实产生而被跳过，未伪造：
+
+1. `artifact metadata-only / unavailable / unsupported-open`
+   - 原因：Mock 生成的 Artifact 始终带有 URI，且 `ARTIFACT_OPEN` 在 capability 中被标记为支持，没有真实路径产生 metadata-only、uri === null 或 unsupported-open 状态。
+
+2. `runtime-degraded`
+   - 原因：MockRuntimeAdapter 没有 API 或脚本场景能独立触发真正的 runtime/session degraded 状态。
+
+3. `runtime-failed`
+   - 原因：MockRuntimeAdapter 可产生 blocked agent/task 与 revision_required artifact，但无法独立触发真正的 runtime-failed / runtime-error 状态。
+
+## 注意事项
+
+- 未修改协议类型、reducer、LifeSimEngine、RuntimeSession 或后端传输层。
+- 未伪造 Mock 无法真实产生的状态。
+- 本次变更保持在 Issue #25 范围内，Refs #14。
+- 未将无关的未跟踪文件（如其他 task 的 plan/report）加入提交。
diff --git a/scripts/capture-demo-office-screenshots.mjs b/scripts/capture-demo-office-screenshots.mjs
index 573ac37..ee5f68d 100644
--- a/scripts/capture-demo-office-screenshots.mjs
+++ b/scripts/capture-demo-office-screenshots.mjs
@@ -6,118 +6,219 @@ const BASE_URL = "http://127.0.0.1:5173/";
 const BASE_OUT_DIR = process.argv[2] || path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline");
 
 const RESOLUTIONS = [
   { width: 1366, height: 768 },
   { width: 1440, height: 900 },
   { width: 1920, height: 1080 },
 ];
 
 const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
 
-async function capture(page, outDir, name) {
+/**
+ * Parse PNG dimensions from the IHDR chunk.
+ * Playwright screenshots are written at the device pixel ratio, so the
+ * returned size is in physical pixels.
+ */
+function readPngDimensions(filePath) {
+  const buf = fs.readFileSync(filePath);
+  if (buf.length < 24 || buf[0] !== 0x89) {
+    throw new Error(`Not a PNG file: ${filePath}`);
+  }
+  // Offset 16: width, offset 20: height (big-endian).
+  const width = buf.readUInt32BE(16);
+  const height = buf.readUInt32BE(20);
+  return { width, height };
+}
+
+async function assertScreenshot(page, filePath, viewportWidth, viewportHeight) {
+  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
+  const { scrollWidth, clientWidth, scrollHeight } = await page.evaluate(() => ({
+    scrollWidth: document.documentElement.scrollWidth,
+    clientWidth: document.documentElement.clientWidth,
+    scrollHeight: document.documentElement.scrollHeight,
+  }));
+
+  if (scrollWidth > clientWidth) {
+    throw new Error(
+      `Horizontal overflow detected at ${viewportWidth}x${viewportHeight}: ` +
+      `scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`
+    );
+  }
+
+  const { width, height } = readPngDimensions(filePath);
+  const expectedWidth = viewportWidth * dpr;
+  const expectedHeight = scrollHeight * dpr;
+
+  if (width !== expectedWidth) {
+    throw new Error(
+      `PNG width mismatch for ${filePath}: got ${width}, expected ${expectedWidth} ` +
+      `(viewport ${viewportWidth} * dpr ${dpr})`
+    );
+  }
+
+  if (height !== expectedHeight) {
+    throw new Error(
+      `PNG height mismatch for ${filePath}: got ${height}, expected ${expectedHeight} ` +
+      `(scrollHeight ${scrollHeight} * dpr ${dpr})`
+    );
+  }
+}
+
+async function capture(page, outDir, name, viewportWidth, viewportHeight) {
   const filePath = path.join(outDir, `${name}.png`);
   await page.screenshot({ path: filePath, fullPage: true });
+  await assertScreenshot(page, filePath, viewportWidth, viewportHeight);
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
 
+async function clickAgentCard(page, name) {
+  const card = page.locator(`.card:has-text("${name}")`).first();
+  await card.click();
+}
+
+async function clickTaskCard(page, title) {
+  const card = page.locator(`.card:has-text("${title}")`).first();
+  await card.click();
+}
+
 let browser;
 
+const skippedStates = [];
+
+function skipState(name, reason) {
+  const entry = `${name}: ${reason}`;
+  if (!skippedStates.includes(entry)) {
+    skippedStates.push(entry);
+    console.log(`Skipped state: ${entry}`);
+  }
+}
+
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
-    const captureHere = (p, name) => capture(p, outDir, name);
+    const captureHere = (name) => capture(page, outDir, name, width, height);
 
     // 1. Idle office
-    await captureHere(page, "01-idle-office");
+    await captureHere("01-idle-office");
 
     // 2. Active task execution
     await clickButton(page, "正常流程");
     await waitForText(page, "working");
     await sleep(500);
-    await captureHere(page, "02-active-task-execution");
+    await captureHere("02-active-task-execution");
+
+    // 10. Selected task card (uses the active task from state 02)
+    await clickTaskCard(page, "分析项目代码质量");
+    await sleep(500);
+    await captureHere("10-selected-task-card");
 
     // 3. Artifact under review
     await waitForText(page, "reviewing");
     await sleep(500);
-    await captureHere(page, "03-artifact-under-review");
+    await captureHere("03-artifact-under-review");
 
     // 4. Pending approval
     await waitForText(page, "Approve");
     await sleep(500);
-    await captureHere(page, "04-pending-approval");
+    await captureHere("04-pending-approval");
 
     // 5. Blocked task / agent
     await clickButton(page, "重置");
     await sleep(1000);
     await clickButton(page, "异常: 阻塞");
     await waitForText(page, "blocked");
     await sleep(500);
-    await captureHere(page, "05-blocked-task-agent");
+    await captureHere("05-blocked-task-agent");
 
     // 6. Revision / rework required
     await clickButton(page, "重置");
     await sleep(1000);
     await clickButton(page, "异常: 返工");
     await waitForText(page, "revision_required");
     await sleep(500);
-    await captureHere(page, "06-revision-required");
+    await captureHere("06-revision-required");
 
     // 7. Focus mode
     await clickButton(page, "重置");
     await sleep(1000);
     await clickButton(page, "正常流程");
     await waitForText(page, "working");
     await sleep(500);
     await page.locator("text=Focus").first().click();
     await sleep(1000);
-    await captureHere(page, "07-focus-mode");
+    await captureHere("07-focus-mode");
 
     // 8. Debrief mode
     await page.locator("text=Debrief").first().click();
     await sleep(1000);
-    await captureHere(page, "08-debrief-mode");
+    await captureHere("08-debrief-mode");
+
+    // 9. Selected agent on canvas + highlighted panel card
+    await clickButton(page, "重置");
+    await sleep(1000);
+    await page.locator("text=Command").first().click();
+    await sleep(500);
+    await clickAgentCard(page, "Orchestrator");
+    await sleep(500);
+    await captureHere("09-selected-agent");
 
     await context.close();
     console.log(`Resolution ${width}x${height} complete.`);
   }
 
+  // New states that cannot be truthfully produced by the current mock adapter.
+  skipState(
+    "artifact-metadata-only / unavailable / unsupported-open",
+    "MockRuntimeAdapter always creates artifacts with a URI and reports ARTIFACT_OPEN as supported; " +
+    "there is no truthful path to metadata-only, unavailable, or unsupported-open artifact content."
+  );
+  skipState(
+    "runtime-degraded",
+    "MockRuntimeAdapter has no API or scripted scenario that emits a genuine runtime/session degraded state."
+  );
+  skipState(
+    "runtime-failed",
+    "MockRuntimeAdapter can emit blocked agents/tasks and revision_required artifacts, " +
+    "but cannot independently trigger a genuine runtime-failed / runtime-error state."
+  );
+
   console.log("All screenshots captured.");
 } catch (err) {
   console.error("Screenshot capture failed:", err);
   process.exitCode = 1;
 } finally {
   if (browser) {
     await browser.close();
   }
 }
diff --git a/scripts/generate-annotated-comparisons.mjs b/scripts/generate-annotated-comparisons.mjs
index e34ec2b..884fee0 100644
--- a/scripts/generate-annotated-comparisons.mjs
+++ b/scripts/generate-annotated-comparisons.mjs
@@ -5,94 +5,114 @@ import path from "node:path";
 const BASELINE_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/baseline/1440x900");
 const OUT_DIR = path.join(process.cwd(), "docs/design/swarm-office-v1.1/annotated-comparisons");
 
 fs.mkdirSync(OUT_DIR, { recursive: true });
 
 const annotations = [
   {
     name: "01-idle-office",
     title: "01 — Idle Office",
     notes: [
-      { x: 360, y: 260, label: "Linked canvas ↔ control-panel selection is not implemented; clicking an agent/room does not highlight the panel card." },
-      { x: 1090, y: 120, label: "Multi-resolution layout still needs hardening: 1366×768 legibility and 1920×1080 space usage are not yet baselined." },
-      { x: 1090, y: 320, label: "Selected / hovered state capture is missing from visual QA; baselines only show default unselected views." },
-      { x: 1090, y: 720, label: "Mock adapter cannot independently trigger genuine runtime failed/degraded states; those screenshots are skipped rather than fabricated." },
+      { x: 360, y: 260, label: "Linked selection baseline added: 09 + 10 capture selected agent and selected task card. Room/approval cross-highlight still needs dedicated baseline coverage." },
+      { x: 1090, y: 120, label: "Multi-resolution layout hardening: verify 1366×768 panel density and 1920×1080 stage spacing." },
+      { x: 1090, y: 320, label: "Artifact truth boundary: mock adapter cannot produce metadata-only / unavailable / unsupported-open content, so those UI states are not baselined." },
+      { x: 1090, y: 720, label: "Runtime degraded/failed states are skipped because the mock adapter cannot truthfully produce them." },
     ],
   },
   {
     name: "02-active-task-execution",
     title: "02 — Active Task Execution",
     notes: [
-      { x: 560, y: 300, label: "No linked selection: selecting an agent on canvas does not highlight the matching Agents card or scroll it into view." },
-      { x: 360, y: 560, label: "Artifact truth boundaries are not exposed here; task/artifact cannot yet show content-available vs metadata-only vs unavailable states." },
-      { x: 1090, y: 760, label: "Hover / selected state capture missing; no baseline shows a highlighted task or agent row." },
-      { x: 1090, y: 320, label: "Multi-resolution layout needs audit: 1366×768 panel density and 1920×1080 stage spacing." },
+      { x: 560, y: 300, label: "Selected task card baseline (10) shows linked canvas highlight; hover-only state is not separately baselined." },
+      { x: 360, y: 560, label: "Artifact truth: normal-flow artifact has a URI; metadata-only / unavailable / unsupported-open states remain unverified." },
+      { x: 1090, y: 760, label: "Resolution hardening: check 1366×768 card text truncation and 1920×1080 panel width." },
+      { x: 1090, y: 320, label: "Multi-resolution spacing audit pending." },
     ],
   },
   {
     name: "03-artifact-under-review",
     title: "03 — Artifact Under Review",
     notes: [
-      { x: 360, y: 560, label: "Artifact state truth boundaries need hardening: revision_required, rejected, blocked, and failed must remain visually distinct and not invented." },
-      { x: 1090, y: 600, label: "Metadata-only / unavailable artifact content is not yet rendered with dedicated UI states in the panel." },
-      { x: 1090, y: 760, label: "Canvas ↔ panel linked selection missing; selecting the reviewer or artifact does not cross-highlight." },
-      { x: 360, y: 760, label: "Mock adapter can produce blocked/revision states, but cannot truthfully produce a runtime failed state." },
+      { x: 360, y: 560, label: "Artifact state truth boundaries: revision_required, rejected, blocked, and failed must stay distinct. Mock cannot produce true runtime failed." },
+      { x: 1090, y: 600, label: "Metadata-only / unavailable / unsupported-open artifact UI is not baselined due to mock adapter limitations." },
+      { x: 1090, y: 760, label: "Canvas ↔ panel linked selection for reviewer/artifact is implemented but not yet a dedicated baseline." },
+      { x: 360, y: 760, label: "Resolution hardening: wide/narrow viewport spacing." },
     ],
   },
   {
     name: "04-pending-approval",
     title: "04 — Pending Approval",
     notes: [
-      { x: 620, y: 420, label: "Approval selection is not linked: choosing the approval in the drawer does not highlight the related room or agent on canvas." },
+      { x: 620, y: 420, label: "Approval cross-highlight is implemented; a dedicated selected-approval baseline is not yet captured." },
       { x: 1090, y: 600, label: "Approve/Reject are decision outcomes; runtime failed/degraded states are out of scope for the mock adapter." },
-      { x: 1090, y: 320, label: "Selected / hovered card capture missing from visual QA baseline set." },
-      { x: 360, y: 120, label: "Multi-resolution hardening: wide-viewport spacing and narrow-viewport legibility not yet verified." },
+      { x: 1090, y: 320, label: "Selected / hovered card capture now exists for agent and task." },
+      { x: 360, y: 120, label: "Multi-resolution hardening: verify spacing and legibility." },
     ],
   },
   {
     name: "05-blocked-task-agent",
     title: "05 — Blocked Task / Agent",
     notes: [
-      { x: 560, y: 300, label: "Blocked posture and pulse are present, but true runtime failed/degraded capture is limited by mock adapter capability." },
-      { x: 360, y: 560, label: "This baseline honestly represents blocked; a genuine runtime failure cannot be independently triggered by the mock adapter." },
-      { x: 1090, y: 840, label: "Linked selection missing: clicking a blocked agent card does not highlight the canvas counterpart." },
-      { x: 1090, y: 600, label: "Artifact truth boundary: a blocked task must not be rendered as failed or rejected." },
+      { x: 560, y: 300, label: "Blocked posture and pulse baseline is truthful; runtime failed/degraded capture is skipped." },
+      { x: 360, y: 560, label: "Blocked must not be mislabeled as failed or rejected." },
+      { x: 1090, y: 840, label: "Linked selection for blocked agent card is implemented; room cross-highlight baseline is pending." },
+      { x: 1090, y: 600, label: "Artifact truth boundary: a blocked task must not invent artifact content." },
     ],
   },
   {
     name: "06-revision-required",
     title: "06 — Revision / Rework Required",
     notes: [
-      { x: 360, y: 420, label: "Revision/rework must remain visually distinct from rejected and failed; artifact truth boundaries are the main remaining gap." },
-      { x: 1090, y: 600, label: "Metadata-only / unavailable / unsupported-open artifact states need explicit UI in the artifact card." },
-      { x: 1090, y: 760, label: "Selected / hovered task or artifact capture is not part of the current baseline set." },
-      { x: 360, y: 560, label: "Mock adapter limitation: this baseline uses revision_required; true runtime failed state cannot be truthfully produced." },
+      { x: 360, y: 420, label: "Revision/rework badge is distinct from rejected and failed; artifact truth remains the main open gap." },
+      { x: 1090, y: 600, label: "Metadata-only / unavailable / unsupported-open artifact states need truthful adapter support to baseline." },
+      { x: 1090, y: 760, label: "Selected task/artifact card baselines added; selected-reviewer baseline is pending." },
+      { x: 360, y: 560, label: "Mock adapter limitation: a true runtime failed state cannot be independently produced." },
     ],
   },
   {
     name: "07-focus-mode",
     title: "07 — Focus Mode",
     notes: [
-      { x: 360, y: 420, label: "Focus panel exists but selection is not linked to canvas; no selected/hovered state capture." },
-      { x: 1090, y: 420, label: "Urgent-only compact view exists; multi-resolution spacing and 1366×768 legibility still need hardening." },
-      { x: 1090, y: 640, label: "Keyboard-accessible selection (Tab/Enter/Space/Escape) is not implemented." },
-      { x: 360, y: 120, label: "Runtime degraded/failed states are not captured because the mock adapter cannot truthfully produce them." },
+      { x: 360, y: 420, label: "Focus panel exists; selection linkage is implemented but not shown in this baseline." },
+      { x: 1090, y: 420, label: "Urgent-only compact view; multi-resolution spacing and 1366×768 legibility need audit." },
+      { x: 1090, y: 640, label: "Keyboard-accessible selection is implemented (Tab/Enter/Space/Escape)." },
+      { x: 360, y: 120, label: "Runtime degraded/failed states are not captured because the mock adapter cannot produce them." },
     ],
   },
   {
     name: "08-debrief-mode",
     title: "08 — Debrief Mode",
     notes: [
-      { x: 360, y: 120, label: "Session Summary + Key timeline are present, but selection/hover states and canvas linkage are not." },
+      { x: 360, y: 120, label: "Session Summary + Key timeline are present; selected/hover states are not captured in debrief." },
       { x: 1090, y: 640, label: "Multi-resolution layout: metrics cards and timeline should be audited at 1366×768 and 1920×1080." },
-      { x: 360, y: 420, label: "No selected milestone or row highlight is captured in the baseline set." },
-      { x: 1090, y: 420, label: "Debrief selection does not sync back to canvas or panel; linked selection is a remaining gap." },
+      { x: 360, y: 420, label: "No selected milestone or row highlight baseline yet." },
+      { x: 1090, y: 420, label: "Debrief selection linkage exists but is not baselined." },
+    ],
+  },
+  {
+    name: "09-selected-agent",
+    title: "09 — Selected Agent",
+    notes: [
+      { x: 560, y: 260, label: "Canvas agent selection highlights the matching panel card and scrolls it into view." },
+      { x: 1090, y: 320, label: "Linked selection baseline: agent ↔ card cross-highlight." },
+      { x: 360, y: 560, label: "Resolution hardening: ensure selection ring is visible at all resolutions." },
+      { x: 1090, y: 720, label: "Room/approval/task cross-highlight baselines still pending." },
+    ],
+  },
+  {
+    name: "10-selected-task-card",
+    title: "10 — Selected Task Card",
+    notes: [
+      { x: 1090, y: 420, label: "Selected task card shows card--selected highlight and highlights the assignee on canvas." },
+      { x: 560, y: 300, label: "Linked selection baseline: task card ↔ agent on canvas." },
+      { x: 1090, y: 720, label: "Artifact/approval cross-highlight baselines still pending." },
+      { x: 360, y: 120, label: "Resolution hardening: selection ring and panel width." },
     ],
   },
 ];
 
 function buildHtml(item) {
   const imgSrc = `../baseline/1440x900/${item.name}.png`;
   const svgOverlays = item.notes
     .map((note, i) => {
       const num = i + 1;
       return `
