# Task 4 review package

## Commits

3eb4179 chore(design): regenerate swarm-office-v1.1 baselines and annotated comparisons
79300c1 test(control-ui, pixel-office): cover exported helpers artifactStatusIntent and resolveAgentTreatment

## Diff stat

 .../01-idle-office-annotated.png                   | Bin 119148 -> 119109 bytes
 .../02-active-task-execution-annotated.png         | Bin 118706 -> 118782 bytes
 .../03-artifact-under-review-annotated.png         | Bin 126350 -> 126647 bytes
 .../04-pending-approval-annotated.png              | Bin 125660 -> 125615 bytes
 .../05-blocked-task-agent-annotated.png            | Bin 126235 -> 126310 bytes
 .../06-revision-required-annotated.png             | Bin 124230 -> 124300 bytes
 .../07-focus-mode-annotated.png                    | Bin 88073 -> 88446 bytes
 .../08-debrief-mode-annotated.png                  | Bin 82599 -> 83442 bytes
 .../09-selected-agent-annotated.png                | Bin 57320 -> 57455 bytes
 .../annotated-comparisons/09-selected-agent.html   |   2 +-
 .../10-selected-task-card-annotated.png            | Bin 117201 -> 117202 bytes
 .../10-selected-task-card.html                     |   2 +-
 .../baseline/1366x768/01-idle-office.png           | Bin 79800 -> 79818 bytes
 .../baseline/1366x768/02-active-task-execution.png | Bin 85117 -> 85172 bytes
 .../baseline/1366x768/03-artifact-under-review.png | Bin 92343 -> 92176 bytes
 .../baseline/1366x768/04-pending-approval.png      | Bin 94370 -> 94345 bytes
 .../baseline/1366x768/05-blocked-task-agent.png    | Bin 94317 -> 94232 bytes
 .../baseline/1366x768/06-revision-required.png     | Bin 92402 -> 92421 bytes
 .../baseline/1366x768/07-focus-mode.png            | Bin 63825 -> 64206 bytes
 .../baseline/1366x768/08-debrief-mode.png          | Bin 62700 -> 62966 bytes
 .../baseline/1366x768/09-selected-agent.png        | Bin 37541 -> 37572 bytes
 .../baseline/1366x768/10-selected-task-card.png    | Bin 89608 -> 89636 bytes
 .../baseline/1440x900/01-idle-office.png           | Bin 91186 -> 91147 bytes
 .../baseline/1440x900/02-active-task-execution.png | Bin 96999 -> 97080 bytes
 .../baseline/1440x900/03-artifact-under-review.png | Bin 103638 -> 103782 bytes
 .../baseline/1440x900/04-pending-approval.png      | Bin 105632 -> 105623 bytes
 .../baseline/1440x900/05-blocked-task-agent.png    | Bin 108023 -> 108100 bytes
 .../baseline/1440x900/06-revision-required.png     | Bin 102826 -> 102913 bytes
 .../baseline/1440x900/07-focus-mode.png            | Bin 68891 -> 69302 bytes
 .../baseline/1440x900/08-debrief-mode.png          | Bin 66487 -> 67324 bytes
 .../baseline/1440x900/09-selected-agent.png        | Bin 41402 -> 41537 bytes
 .../baseline/1440x900/10-selected-task-card.png    | Bin 100127 -> 100108 bytes
 .../1920x1080/02-active-task-execution.png         | Bin 122269 -> 122338 bytes
 .../1920x1080/03-artifact-under-review.png         | Bin 129363 -> 129365 bytes
 .../baseline/1920x1080/04-pending-approval.png     | Bin 131838 -> 131860 bytes
 .../baseline/1920x1080/05-blocked-task-agent.png   | Bin 141180 -> 140971 bytes
 .../baseline/1920x1080/06-revision-required.png    | Bin 129195 -> 129147 bytes
 .../baseline/1920x1080/07-focus-mode.png           | Bin 82487 -> 82875 bytes
 .../baseline/1920x1080/08-debrief-mode.png         | Bin 77116 -> 77421 bytes
 .../baseline/1920x1080/09-selected-agent.png       | Bin 48785 -> 48658 bytes
 .../baseline/1920x1080/10-selected-task-card.png   | Bin 126633 -> 126551 bytes
 docs/superpowers/plans/task-4-report.md            |  60 +++++++++++++++++++++
 packages/control-ui/src/components/intents.test.ts |  25 +++++++++
 .../src/__tests__/agent-renderer.test.ts           |  39 +++++++++++++-
 44 files changed, 125 insertions(+), 3 deletions(-)

## Full diff

diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png
index 57e5be8..6214567 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png
index 3f683ae..d5fe5d9 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png
index 22d0bb7..a08260e 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png
index 6593905..c5e6b78 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png
index 2a23a88..ee069e6 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png
index 7780201..a9c2317 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png
index 5ed8a60..f30c325 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png
index 99daf70..4982dbe 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent-annotated.png
index 22a00d5..3396bf3 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent.html b/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent.html
index 17fd8b8..4e1c103 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent.html
@@ -72,11 +72,11 @@
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
-</html>
+</html>
\ No newline at end of file
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card-annotated.png
index fa8a34d..5796cb9 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card.html b/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card.html
index 0846ce8..54eff63 100644
--- a/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card.html
+++ b/docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card.html
@@ -72,11 +72,11 @@
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
-</html>
+</html>
\ No newline at end of file
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/01-idle-office.png b/docs/design/swarm-office-v1.1/baseline/1366x768/01-idle-office.png
index 4e84917..b87a720 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/01-idle-office.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/01-idle-office.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png
index 51f42b9..3a67f6e 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png
index bae04c2..2b8f866 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png
index 97ecc98..fd10bfb 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png
index dc021cd..816b67c 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png
index 8c27c08..e49cc6b 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png
index d8d03b3..0714007 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png
index 88b25a6..e7b2d8c 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/09-selected-agent.png b/docs/design/swarm-office-v1.1/baseline/1366x768/09-selected-agent.png
index 29ba9bd..f7a07f9 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/09-selected-agent.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/09-selected-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/10-selected-task-card.png b/docs/design/swarm-office-v1.1/baseline/1366x768/10-selected-task-card.png
index 0c61b14..7aff4ca 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/10-selected-task-card.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/10-selected-task-card.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/01-idle-office.png b/docs/design/swarm-office-v1.1/baseline/1440x900/01-idle-office.png
index 5ac7405..a51bcfe 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/01-idle-office.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/01-idle-office.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png
index b63e84c..89ee304 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png
index 6167f23..63bc107 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png
index 4273cf3..1e6886f 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png
index 1b698c0..89fe587 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png
index 84e8f4b..065e92f 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png
index 13286ec..41af284 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png
index 5a9f615..5815536 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/09-selected-agent.png b/docs/design/swarm-office-v1.1/baseline/1440x900/09-selected-agent.png
index 585056a..d5879b4 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/09-selected-agent.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/09-selected-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/10-selected-task-card.png b/docs/design/swarm-office-v1.1/baseline/1440x900/10-selected-task-card.png
index 9763aaa..403c8d7 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/10-selected-task-card.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/10-selected-task-card.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png
index 723096c..62178f6 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png
index 26ed63f..6f4ae98 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png
index 0655d57..73c87fd 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png
index 080fad7..7cac5b5 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png
index 47f1d55..c4bac07 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png
index 3155cc8..fb2e60a 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png
index b3a83ef..a9b0fe7 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/09-selected-agent.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/09-selected-agent.png
index b9bde47..2210138 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/09-selected-agent.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/09-selected-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/10-selected-task-card.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/10-selected-task-card.png
index 18833ef..986c334 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/10-selected-task-card.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/10-selected-task-card.png differ
diff --git a/docs/superpowers/plans/task-4-report.md b/docs/superpowers/plans/task-4-report.md
new file mode 100644
index 0000000..5935e9d
--- /dev/null
+++ b/docs/superpowers/plans/task-4-report.md
@@ -0,0 +1,60 @@
+# Task 4: Tests and verification — Report
+
+## Status
+
+DONE
+
+## What was reviewed
+
+- Confirmed every new exported function/method added in Tasks 1–3 has at least one test.
+- Added missing direct tests for two exported helpers that previously only had indirect coverage:
+  - `packages/control-ui/src/components/intents.test.ts` — `artifactStatusIntent`
+  - `packages/pixel-office/src/__tests__/agent-renderer.test.ts` — `resolveAgentTreatment`
+- Ran the full local verification suite.
+- Checked for test-only/debug code and removed none (no new debug code found).
+
+## Test counts
+
+| Test file | Tests |
+|---|---|
+| `apps/demo-office/src/App.test.tsx` | 32 |
+| `apps/demo-office/src/ListView.test.tsx` | 9 |
+| `packages/control-ui/src/ControlPanel.test.tsx` | 29 |
+| `packages/control-ui/src/components/intents.test.ts` | 2 *(new)* |
+| `packages/pixel-office/src/__tests__/office-scene.test.ts` | 31 |
+| `packages/pixel-office/src/__tests__/agent-renderer.test.ts` | 23 *(+2)* |
+| `packages/pixel-office/src/__tests__/effect-renderer.test.ts` | 19 |
+| `packages/pixel-office/src/__tests__/presentation-state.test.ts` | 14 |
+| Other existing test files | 487 |
+| **Total** | **646 tests across 60 files** |
+
+## Verification results
+
+- `npm test -- --run` — **PASS** (646 tests, 60 files, ~10.9 s)
+- `npm run build` — **PASS**
+- `node scripts/capture-demo-office-screenshots.mjs` — **PASS**
+  - Baselines captured for 1366×768, 1440×900, and 1920×1080.
+  - Dimension and overflow assertions passed.
+  - Three states were skipped with logged reasons because the mock adapter cannot truthfully produce them:
+    - artifact metadata-only / unavailable / unsupported-open
+    - runtime degraded
+    - runtime failed
+- `node scripts/generate-annotated-comparisons.mjs` — **PASS**
+  - Regenerated annotated comparisons from the 1440×900 baseline.
+
+## CI status
+
+- GitHub workflow is named `CI` (not `build-test`).
+- No CI run exists yet for branch `issue-25-swarm-office-follow-up` because the branch has not been pushed/PR'd.
+- Latest `main` CI run (2026-07-07) was successful.
+- Local `npm test -- --run` and `npm run build` match the commands executed by `.github/workflows/ci.yml`, so the branch is expected to pass CI once pushed.
+
+## Changes made
+
+- Added `packages/control-ui/src/components/intents.test.ts`
+- Extended `packages/pixel-office/src/__tests__/agent-renderer.test.ts` with `resolveAgentTreatment` tests
+- Regenerated baseline screenshots and annotated comparisons (existing tracked files updated)
+
+## Concerns
+
+None. All required verifications pass and the two exported-helper coverage gaps were closed.
diff --git a/packages/control-ui/src/components/intents.test.ts b/packages/control-ui/src/components/intents.test.ts
new file mode 100644
index 0000000..23b50e0
--- /dev/null
+++ b/packages/control-ui/src/components/intents.test.ts
@@ -0,0 +1,25 @@
+import { describe, it, expect } from "vitest";
+import { artifactStatusIntent } from "./intents.js";
+import type { BadgeIntent } from "./Badge.js";
+
+describe("artifactStatusIntent", () => {
+  it("maps known artifact statuses to distinct intents", () => {
+    const cases: Array<{ status: Parameters<typeof artifactStatusIntent>[0]; intent: BadgeIntent }> = [
+      { status: "draft", intent: "idle" },
+      { status: "generated", intent: "info" },
+      { status: "under_review", intent: "waiting" },
+      { status: "revision_required", intent: "revision_required" },
+      { status: "approved", intent: "approved" },
+      { status: "rejected", intent: "rejected" },
+      { status: "delivered", intent: "running" },
+    ];
+
+    for (const { status, intent } of cases) {
+      expect(artifactStatusIntent(status)).toBe(intent);
+    }
+  });
+
+  it("falls back to info for unknown statuses", () => {
+    expect(artifactStatusIntent("unknown_status" as Parameters<typeof artifactStatusIntent>[0])).toBe("info");
+  });
+});
diff --git a/packages/pixel-office/src/__tests__/agent-renderer.test.ts b/packages/pixel-office/src/__tests__/agent-renderer.test.ts
index c48b5f9..6b16673 100644
--- a/packages/pixel-office/src/__tests__/agent-renderer.test.ts
+++ b/packages/pixel-office/src/__tests__/agent-renderer.test.ts
@@ -1,12 +1,12 @@
 import { describe, it, expect, beforeEach, vi } from "vitest";
-import { AgentRenderer } from "../renderer/agent-renderer.js";
+import { AgentRenderer, resolveAgentTreatment } from "../renderer/agent-renderer.js";
 import { createDefaultLayout } from "../layout.js";
 import type { AgentView, OfficeProjection } from "@agent-office/protocol";
 import { MockContainer, MockGraphics } from "./pixi-mock.js";
 
 vi.mock("pixi.js", () => import("./pixi-mock.js").then((m) => m.createPixiMock()));
 
 function makeAgent(id: string, roomId: string | null, role: AgentView["role"] = "worker"): AgentView {
   return {
     agentId: id,
     name: `Agent-${id}`,
@@ -351,21 +351,58 @@ describe("AgentRenderer", () => {
     expect(msPerTile).toBeLessThanOrEqual(300);
   });
 
   it("guards zero-distance walk duration and avoids division by zero", () => {
     const zeroDistanceLayout: import("../layout.js").RoomLayout = {
       rooms: [
         { roomId: "command", name: "Command", floorType: "command", x: 100, y: 100, width: 10, height: 10, props: [] },
         { roomId: "execution", name: "Execution", floorType: "execution", x: 100, y: 100, width: 10, height: 10, props: [] },
       ],
     };
+
     renderer.render([makeAgent("a1", "command")], zeroDistanceLayout, makeProjection([]));
     renderer.render([makeAgent("a1", "execution")], zeroDistanceLayout, makeProjection([]));
 
     expect(renderer.getAgentWalkDuration("a1")).toBe(0);
 
     expect(() => renderer.tick(16)).not.toThrow();
     const position = renderer.getAgentPosition("a1")!;
     expect(Number.isFinite(position.x)).toBe(true);
     expect(Number.isFinite(position.y)).toBe(true);
   });
 });
+
+describe("resolveAgentTreatment", () => {
+  it("maps role to body color and status to accent color", () => {
+    const agent: AgentView = {
+      agentId: "a1",
+      name: "Agent 1",
+      role: "orchestrator",
+      status: "blocked",
+      currentTaskId: null,
+      currentRoomId: "command",
+      blockedReason: null,
+    };
+
+    const treatment = resolveAgentTreatment(agent);
+    expect(treatment.role).toBe("orchestrator");
+    expect(typeof treatment.bodyColor).toBe("number");
+    expect(typeof treatment.accentColor).toBe("number");
+    expect(treatment.bodyColor).not.toBe(treatment.accentColor);
+  });
+
+  it("falls back to base tokens for unknown role/status", () => {
+    const agent: AgentView = {
+      agentId: "a1",
+      name: "Agent 1",
+      role: "unknown-role" as AgentView["role"],
+      status: "unknown-status" as AgentView["status"],
+      currentTaskId: null,
+      currentRoomId: "command",
+      blockedReason: null,
+    };
+
+    const treatment = resolveAgentTreatment(agent);
+    expect(treatment.bodyColor).toBe(0xb8b0bc);
+    expect(treatment.accentColor).toBe(0x7d7682);
+  });
+});
