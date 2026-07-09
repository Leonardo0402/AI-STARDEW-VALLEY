# Task 2 review package

## Commits

365c47d docs(superpowers): add task 2 report
ffa9ff4 feat(pixel-office): rework cue for revision_required artifacts and blocked/failed posture truth
3bd7680 feat(control-ui): distinct revision_required/rejected intents and artifact content states

## Diff stat

 apps/demo-office/src/theme.css                     |   2 +
 docs/superpowers/plans/task-2-report.md            |  30 ++++++
 packages/control-ui/src/ControlPanel.test.tsx      |  20 ++++
 packages/control-ui/src/ControlPanel.tsx           | 111 +++++++++++++++++----
 packages/control-ui/src/components/Badge.tsx       |   4 +-
 packages/control-ui/src/components/intents.ts      |   5 +-
 packages/control-ui/src/control-panel.css          |  27 +++++
 .../src/__tests__/agent-renderer.test.ts           |  10 ++
 .../src/__tests__/effect-renderer.test.ts          |  25 +++++
 .../pixel-office/src/renderer/effect-renderer.ts   |  62 +++++++++++-
 10 files changed, 272 insertions(+), 24 deletions(-)

## Full diff

diff --git a/apps/demo-office/src/theme.css b/apps/demo-office/src/theme.css
index 4f396fd..305774f 100644
--- a/apps/demo-office/src/theme.css
+++ b/apps/demo-office/src/theme.css
@@ -20,20 +20,22 @@
   --warm-500: #6b5f56;
   --warm-300: #a89788;
 
   --info: #7ec0c8;
   --info-dim: #4a7c82;
   --urgency: #e6a85c;
   --urgency-dim: #8f6232;
   --success: #7db68a;
   --failure: #c96a5b;
   --failure-dim: #7a3d34;
+  --rework: #e85d75;
+  --rejected: #7d7682;
   --paused: #7a9cc6;
 
   --glow-info: rgba(126, 192, 200, 0.35);
   --glow-urgency: rgba(230, 168, 92, 0.45);
   --glow-failure: rgba(201, 106, 91, 0.45);
 
   /* Typography */
   --font-ui: Inter, system-ui, sans-serif;
   --font-mono: "JetBrains Mono", "Courier New", monospace;
   --font-pixel: "Press Start 2P", monospace;
diff --git a/docs/superpowers/plans/task-2-report.md b/docs/superpowers/plans/task-2-report.md
new file mode 100644
index 0000000..5753f3d
--- /dev/null
+++ b/docs/superpowers/plans/task-2-report.md
@@ -0,0 +1,30 @@
+# Task 2 Report: Truthful artifact and outcome states
+
+## Status
+
+DONE
+
+## Commits
+
+- `3bd7680` — feat(control-ui): distinct revision_required/rejected intents and artifact content states
+- `ffa9ff4` — feat(pixel-office): rework cue for revision_required artifacts and blocked/failed posture truth
+
+## Summary
+
+Implemented the Task 2 requirements for Issue #25 (Refs #14):
+
+- Added `revision_required` and `rejected` badge intents/colors and applied them to artifact and task badges.
+- Reclassified artifact cards into explicit content states: `content-available`, `metadata-only`, `unavailable`, `loading`, `failed-open`, and `unsupported-open`.
+- Kept `artifactId` out of the content area; URI is only shown when a real `uri` field is present.
+- Tracked in-flight `ARTIFACT_OPEN` commands so the UI can show a loading state.
+- Ensured blocked agents retain slumped posture, red pulse, and speech bubble; failed agents only render when `status === "failed"`.
+- Added a red-flag clipboard + "rework" label cue for `revision_required` artifacts in the effect renderer.
+
+## Verification
+
+- `npm test` — 59 files, 642 tests, all green.
+- `npm run build` — passed (Vite production build succeeded).
+
+## Concerns
+
+None. No protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport were changed.
diff --git a/packages/control-ui/src/ControlPanel.test.tsx b/packages/control-ui/src/ControlPanel.test.tsx
index 2dc110d..51b27c8 100644
--- a/packages/control-ui/src/ControlPanel.test.tsx
+++ b/packages/control-ui/src/ControlPanel.test.tsx
@@ -422,20 +422,40 @@ describe("ControlPanel", () => {
     const badges = screen.getAllByTestId("badge");
     const labels = badges.map((b) => b.textContent);
     expect(labels).toContain("idle");
     expect(labels).toContain("working");
     expect(labels).toContain("running");
     expect(labels).toContain("created");
     expect(labels).toContain("generated v2");
     labels.forEach((label) => expect(label).not.toBe(""));
   });
 
+  it("shows a rework badge for revision_required artifacts", () => {
+    const projection: OfficeProjection = {
+      ...baseProjection,
+      artifacts: [{ ...baseProjection.artifacts[0], status: "revision_required" }],
+    };
+    renderPanel({ projection });
+    const badge = screen.getByText(/revision_required/i);
+    expect(badge).toHaveClass("badge--revision_required");
+  });
+
+  it("shows a distinct rejected badge for rejected artifacts", () => {
+    const projection: OfficeProjection = {
+      ...baseProjection,
+      artifacts: [{ ...baseProjection.artifacts[0], status: "rejected" }],
+    };
+    renderPanel({ projection });
+    const badge = screen.getByText(/rejected/i);
+    expect(badge).toHaveClass("badge--rejected");
+  });
+
   it("focus panel only surfaces pending approvals and blocked states", () => {
     const projection: OfficeProjection = {
       ...baseProjection,
       agents: [
         ...baseProjection.agents,
         {
           agentId: "agent-4",
           name: "Blocked-Agent",
           role: "worker",
           status: "blocked",
diff --git a/packages/control-ui/src/ControlPanel.tsx b/packages/control-ui/src/ControlPanel.tsx
index f0afa6a..36a4473 100644
--- a/packages/control-ui/src/ControlPanel.tsx
+++ b/packages/control-ui/src/ControlPanel.tsx
@@ -49,20 +49,21 @@ export const ControlPanel: FC<ControlPanelProps> = ({
   eventLog,
   errors,
   mode,
   onSendCommand,
   capabilities,
   selection = null,
   onSelect,
 }) => {
   const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
   const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
+  const [openingArtifacts, setOpeningArtifacts] = useState<Set<string>>(new Set());
 
   const isSupported = (cmdType: string): boolean =>
     capabilities ? capabilities.supportedCommands.includes(cmdType) : true;
 
   const runAction = async (key: string, fn: () => Promise<void>): Promise<void> => {
     setActionErrors((prev) => {
       const next = { ...prev };
       delete next[key];
       return next;
     });
@@ -113,26 +114,33 @@ export const ControlPanel: FC<ControlPanelProps> = ({
     await runAction(`reject-${approvalId}`, () =>
       onSendCommand(
         CommandType.APPROVAL_REJECT,
         { approvalId, reason: "rejected by operator" },
         approvalId
       )
     );
   };
 
   const handleOpenArtifact = async (artifactId: string) => {
+    setOpeningArtifacts((prev) => new Set(prev).add(artifactId));
     try {
       await runAction(`open-${artifactId}`, () =>
         onSendCommand(CommandType.ARTIFACT_OPEN, { artifactId }, artifactId)
       );
     } catch {
       // Error is already recorded in actionErrors; swallow so it doesn't become unhandled.
+    } finally {
+      setOpeningArtifacts((prev) => {
+        const next = new Set(prev);
+        next.delete(artifactId);
+        return next;
+      });
     }
   };
 
   const allErrorMessages: string[] = [
     ...errors,
     ...Object.entries(actionErrors).map(([key, msg]) => `[${key}] ${msg}`),
   ];
 
   const visibleErrors = allErrorMessages.filter((err) => !dismissedErrors.has(err));
 
@@ -334,27 +342,26 @@ export const ControlPanel: FC<ControlPanelProps> = ({
           </div>
 
           {projection.artifacts.length > 0 && (
             <div className="panel-section">
               <SectionHeader
                 title="Artifacts"
                 count={projection.artifacts.length}
                 countIntent="approved"
               />
               {projection.artifacts.map((art) => {
-                // NOTE: art.status is intentionally not used for content-state classification.
-                // The current ArtifactStatus union has no explicit content_unavailable/load_failed
-                // values; we use art.uri === null and actionErrors for those states instead.
                 const artifactOpenSupported = isSupported(CommandType.ARTIFACT_OPEN);
-                const hasContent = Boolean(art.content);
-                const hasUri = Boolean(art.uri);
-                const canOpen = artifactOpenSupported && (hasContent || hasUri);
+                const { state, canOpen, title } = classifyArtifactContentState(art, {
+                  artifactOpenSupported,
+                  openingArtifacts,
+                  actionErrors,
+                });
                 const openError = actionErrors[`open-${art.artifactId}`];
 
                 return (
                   <Card
                     key={art.artifactId}
                     ref={setCardRef("artifact", art.artifactId)}
                     selectable={Boolean(onSelect)}
                     selected={isSelected("artifact", art.artifactId)}
                     ariaLabel={`Select artifact ${art.title}`}
                     onClick={handleSelect("artifact", art.artifactId)}
@@ -375,38 +382,42 @@ export const ControlPanel: FC<ControlPanelProps> = ({
                       </Badge>
                     </div>
                     <div className="card-footer">
                       <button
                         className="btn btn--secondary btn--small"
                         onClick={(e) => {
                           e.stopPropagation();
                           handleOpenArtifact(art.artifactId);
                         }}
                         disabled={!canOpen}
-                        title={
-                          !artifactOpenSupported
-                            ? "Unsupported by adapter"
-                            : !hasContent && !hasUri
-                              ? "Metadata only — content not loaded."
-                              : undefined
-                        }
+                        title={title}
                       >
                         View
                       </button>
                     </div>
-                    <div className="artifact-preview">
-                      {hasContent ? (
-                        <div className="artifact-preview__content">{art.content}</div>
-                      ) : hasUri ? (
-                        <div className="artifact-preview__uri">{art.uri}</div>
-                      ) : art.uri === null ? (
+                    <div className={`artifact-preview artifact-preview--${state}`}>
+                      {state === "content-available" ? (
+                        art.content != null ? (
+                          <div className="artifact-preview__content">{art.content}</div>
+                        ) : (
+                          <div className="artifact-preview__uri">{art.uri}</div>
+                        )
+                      ) : state === "unavailable" ? (
                         <div className="artifact-preview__unavailable">Content unavailable</div>
+                      ) : state === "loading" ? (
+                        <div className="artifact-preview__loading">Opening…</div>
+                      ) : state === "failed-open" ? (
+                        <div className="artifact-preview__failed">Open failed.</div>
+                      ) : state === "unsupported-open" ? (
+                        <div className="artifact-preview__unsupported">
+                          Opening not supported by adapter.
+                        </div>
                       ) : (
                         <div className="artifact-preview__metadata">
                           Metadata only — content not loaded.
                         </div>
                       )}
                     </div>
                     {openError && (
                       <div className="action-error">{openError}</div>
                     )}
                   </Card>
@@ -445,20 +456,79 @@ function hashString(input: string): string {
 }
 
 function parseError(err: string): { code: string; message: string } {
   const match = err.match(/^\[([^\]]+)\]\s*(.*)$/);
   if (match) {
     return { code: match[1], message: match[2] };
   }
   return { code: "ERROR", message: err };
 }
 
+type ArtifactContentState =
+  | "content-available"
+  | "metadata-only"
+  | "unavailable"
+  | "loading"
+  | "failed-open"
+  | "unsupported-open";
+
+interface ClassifyOptions {
+  artifactOpenSupported: boolean;
+  openingArtifacts: Set<string>;
+  actionErrors: Record<string, string>;
+}
+
+function classifyArtifactContentState(
+  art: import("@agent-office/protocol").ArtifactView,
+  { artifactOpenSupported, openingArtifacts, actionErrors }: ClassifyOptions
+): { state: ArtifactContentState; canOpen: boolean; title?: string } {
+  const openError = actionErrors[`open-${art.artifactId}`];
+
+  if (!artifactOpenSupported) {
+    return {
+      state: "unsupported-open",
+      canOpen: false,
+      title: "Unsupported by adapter",
+    };
+  }
+
+  if (openingArtifacts.has(art.artifactId)) {
+    return { state: "loading", canOpen: false, title: "Opening…" };
+  }
+
+  if (openError) {
+    return {
+      state: "failed-open",
+      canOpen: true,
+      title: "Open failed — click to retry",
+    };
+  }
+
+  if (art.uri === null) {
+    return {
+      state: "unavailable",
+      canOpen: false,
+      title: "Content unavailable",
+    };
+  }
+
+  if (art.content != null || art.uri != null) {
+    return { state: "content-available", canOpen: true };
+  }
+
+  return {
+    state: "metadata-only",
+    canOpen: false,
+    title: "Metadata only — content not loaded.",
+  };
+}
+
 function agentStatusIntent(status: AgentView["status"]): BadgeIntent {
   switch (status) {
     case "idle":
     case "offline":
       return "idle";
     case "working":
       return "running";
     case "waiting":
       return "waiting";
     case "blocked":
@@ -480,22 +550,23 @@ function taskStatusIntent(status: TaskView["status"]): BadgeIntent {
     case "queued":
     case "cancelled":
       return "idle";
     case "assigned":
     case "planning":
     case "reviewing":
       return "info";
     case "running":
       return "running";
     case "waiting_approval":
-    case "revision_required":
       return "waiting";
+    case "revision_required":
+      return "revision_required";
     case "blocked":
       return "blocked";
     case "completed":
       return "approved";
     case "failed":
       return "failed";
     default:
       return "info";
   }
 }
diff --git a/packages/control-ui/src/components/Badge.tsx b/packages/control-ui/src/components/Badge.tsx
index a964095..3a3c7a8 100644
--- a/packages/control-ui/src/components/Badge.tsx
+++ b/packages/control-ui/src/components/Badge.tsx
@@ -1,21 +1,23 @@
 import type { FC, ReactNode } from "react";
 
 export type BadgeIntent =
   | "idle"
   | "running"
   | "waiting"
   | "blocked"
   | "failed"
   | "paused"
   | "approved"
-  | "info";
+  | "info"
+  | "revision_required"
+  | "rejected";
 
 interface BadgeProps {
   intent: BadgeIntent;
   children: ReactNode;
   className?: string;
   title?: string;
 }
 
 export const Badge: FC<BadgeProps> = ({ intent, children, className = "", title }) => {
   return (
diff --git a/packages/control-ui/src/components/intents.ts b/packages/control-ui/src/components/intents.ts
index 389d165..88712db 100644
--- a/packages/control-ui/src/components/intents.ts
+++ b/packages/control-ui/src/components/intents.ts
@@ -1,22 +1,23 @@
 import type { ArtifactView } from "@agent-office/protocol";
 import type { BadgeIntent } from "./Badge.js";
 
 export function artifactStatusIntent(status: ArtifactView["status"]): BadgeIntent {
   switch (status) {
     case "draft":
       return "idle";
     case "generated":
       return "info";
     case "under_review":
-    case "revision_required":
       return "waiting";
+    case "revision_required":
+      return "revision_required";
     case "approved":
       return "approved";
     case "rejected":
-      return "failed";
+      return "rejected";
     case "delivered":
       return "running";
     default:
       return "info";
   }
 }
diff --git a/packages/control-ui/src/control-panel.css b/packages/control-ui/src/control-panel.css
index 0b02423..aacc261 100644
--- a/packages/control-ui/src/control-panel.css
+++ b/packages/control-ui/src/control-panel.css
@@ -137,20 +137,31 @@
   background: var(--urgency);
   color: var(--base-900);
 }
 
 .badge--blocked,
 .badge--failed {
   background: var(--failure);
   color: var(--base-100);
 }
 
+.badge--revision_required {
+  background: var(--rework);
+  color: var(--base-100);
+  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
+}
+
+.badge--rejected {
+  background: var(--rejected);
+  color: var(--base-100);
+}
+
 .badge--paused {
   background: var(--paused);
   color: var(--base-100);
 }
 
 .badge--info {
   background: var(--info);
   color: var(--base-900);
 }
 
@@ -428,20 +439,36 @@
   margin-top: var(--space-sm);
   padding: var(--space-sm);
   background: var(--base-900);
   border: 1px solid var(--base-500);
   border-radius: var(--radius-sm);
   font-size: 11px;
   color: var(--base-300);
   font-family: var(--font-mono);
 }
 
+.artifact-preview--unavailable,
+.artifact-preview--unsupported-open {
+  border-color: var(--base-500);
+  color: var(--base-400);
+}
+
+.artifact-preview--loading {
+  border-color: var(--info-dim);
+  color: var(--info);
+}
+
+.artifact-preview--failed-open {
+  border-color: var(--failure);
+  color: var(--failure);
+}
+
 /* ─── Status helpers ──────────────────────────────────────── */
 
 .status-blocked {
   color: var(--failure);
 }
 
 /* ─── Focus & Debrief summaries ───────────────────────────── */
 
 .focus-summary,
 .debrief-summary {
diff --git a/packages/pixel-office/src/__tests__/agent-renderer.test.ts b/packages/pixel-office/src/__tests__/agent-renderer.test.ts
index cc246c8..c48b5f9 100644
--- a/packages/pixel-office/src/__tests__/agent-renderer.test.ts
+++ b/packages/pixel-office/src/__tests__/agent-renderer.test.ts
@@ -192,20 +192,30 @@ describe("AgentRenderer", () => {
 
     agent.status = "idle";
     renderer.render([agent], layout, makeProjection([agent]));
     const idleCommands = getAgentBody(container, 0).commands.slice();
     const idleHead = idleCommands.find((c) => c.type === "circle")!;
 
     expect(failedHead.args[1] as number).toBeGreaterThan(idleHead.args[1] as number);
     expect(failedCommands.some((c) => c.type === "lineTo")).toBe(true);
   });
 
+  it("does not give blocked agents the failed posture marker", () => {
+    const agent = makeAgent("a1", "command", "worker");
+    agent.status = "blocked";
+    agent.blockedReason = "Adapter timeout";
+    renderer.render([agent], layout, makeProjection([agent]));
+    const blockedCommands = getAgentBody(container, 0).commands.slice();
+
+    expect(blockedCommands.some((c) => c.type === "lineTo")).toBe(false);
+  });
+
   it("turns approval agents toward the service bell at room center", () => {
     const agent = makeAgent("a1", "approval_delivery", "worker");
     agent.status = "waiting";
     const projection: OfficeProjection = {
       ...makeProjection([agent]),
       rooms: [
         {
           roomId: "approval_delivery",
           name: "Approval Hall",
           type: "approval_delivery",
diff --git a/packages/pixel-office/src/__tests__/effect-renderer.test.ts b/packages/pixel-office/src/__tests__/effect-renderer.test.ts
index a5cadfe..62f1acd 100644
--- a/packages/pixel-office/src/__tests__/effect-renderer.test.ts
+++ b/packages/pixel-office/src/__tests__/effect-renderer.test.ts
@@ -293,20 +293,45 @@ describe("EffectRenderer", () => {
         (cmd) =>
           cmd.type === "rect" &&
           (cmd.args[0] as number) > pos.x &&
           (cmd.args[1] as number) < pos.y
       )
     );
     expect(hasErrorTag).toBe(true);
     expect(texts.some((t) => t.text === "×")).toBe(true);
   });
 
+  it("draws a rework cue above the producer of a revision_required artifact", () => {
+    const renderer = new EffectRenderer(container as unknown as import("pixi.js").Container);
+
+    const agent = makeAgent({ agentId: "a1", status: "idle", currentRoomId: "execution" });
+    const projection: OfficeProjection = {
+      ...makeProjection([agent]),
+      artifacts: [
+        {
+          artifactId: "art-1",
+          taskId: "t1",
+          producerAgentId: "a1",
+          type: "document",
+          title: "Report",
+          status: "revision_required",
+          version: 1,
+          reviewResult: null,
+        },
+      ],
+    };
+    renderer.render(projection, layout);
+
+    const texts = getTexts(container);
+    expect(texts.some((t) => t.text === "rework")).toBe(true);
+  });
+
   it("pulses the service bell on a 1.2s loop", async () => {
     MockAssets.reset({ "service-bell": new MockTexture("service-bell") });
     const loader = new AssetLoader();
     await loader.loadAll(["effects/service-bell"]);
 
     const renderer = new EffectRenderer(
       container as unknown as import("pixi.js").Container,
       loader
     );
 
diff --git a/packages/pixel-office/src/renderer/effect-renderer.ts b/packages/pixel-office/src/renderer/effect-renderer.ts
index 70bec14..265f6e8 100644
--- a/packages/pixel-office/src/renderer/effect-renderer.ts
+++ b/packages/pixel-office/src/renderer/effect-renderer.ts
@@ -1,20 +1,20 @@
 /**
  * EffectRenderer — 渲染阻塞标记、工作状态火花、审批服务铃等覆盖层效果。
  *
  * V1 效果规则：
  * - 每个 presentation state 为 blocked 的 agent 头顶绘制红色阻塞标记。
  * - 每个 presentation state 为 working 的 agent 肩膀上方绘制 sparkle。
  * - 当存在 pendingApprovals 时，在 approval_delivery 房间中心绘制服务铃。
  */
 import { Container, Graphics, Text, TextStyle, Sprite, Texture } from "pixi.js";
-import type { OfficeProjection, AgentView } from "@agent-office/protocol";
+import type { OfficeProjection, AgentView, ArtifactView } from "@agent-office/protocol";
 import { getAgentPositionByRoomId, type RoomLayout, type RoomLayoutEntry } from "../layout.js";
 import type { AssetLoader } from "../asset-loader.js";
 import { computeAgentPresentationState } from "../presentation-state.js";
 
 const BELL_PERIOD_MS = 1200;
 const BLOCKED_PERIOD_MS = 1000;
 const SPARKLE_PERIOD_MS = 800;
 const SPARKLE_STEPS = 4;
 const SPARKLE_STEP_SCALES = [0.8, 1.0, 1.1, 0.9];
 
@@ -22,20 +22,21 @@ interface EffectItem {
   graphics: Graphics;
   label: Text;
   sprite?: Sprite;
 }
 
 export class EffectRenderer {
   private blockedItems: EffectItem[] = [];
   private sparkleItems: EffectItem[] = [];
   private bellItems: EffectItem[] = [];
   private failedItems: EffectItem[] = [];
+  private reworkItems: EffectItem[] = [];
   private reduceMotion = false;
   private bellPulsePhase = 0;
   private blockedPulsePhase = 0;
   private sparklePhase = 0;
 
   constructor(
     private layer: Container,
     private assetLoader?: AssetLoader,
     reduceMotion?: boolean
   ) {
@@ -76,20 +77,26 @@ export class EffectRenderer {
     this.hideExtras(this.failedItems, failedCount);
 
     const blockedCount = this.renderBlockedMarkers(blockedAgents, layout, blockedPulse);
     this.hideExtras(this.blockedItems, blockedCount);
 
     const sparkleCount = this.renderWorkingSparkles(workingAgents, layout);
     this.hideExtras(this.sparkleItems, sparkleCount);
 
     const bellCount = this.renderServiceBells(bellRooms, bellPulse);
     this.hideExtras(this.bellItems, bellCount);
+
+    const reworkArtifacts = projection.artifacts.filter(
+      (a) => a.status === "revision_required" && a.producerAgentId
+    );
+    const reworkCount = this.renderReworkCues(reworkArtifacts, projection, layout);
+    this.hideExtras(this.reworkItems, reworkCount);
   }
 
   private renderBlockedMarkers(agents: AgentView[], layout: RoomLayout, pulse: number): number {
     const markerTexture = this.assetLoader?.getTexture("blocked-marker");
     let index = 0;
     for (const agent of agents) {
       const item = this.getItem(this.blockedItems, index++);
       const pos = getAgentPositionByRoomId(
         layout,
         agent.currentRoomId ?? "command",
@@ -254,20 +261,73 @@ export class EffectRenderer {
       item.label.style = new TextStyle({ fontSize: 8, fill: 0xf2f0eb, fontFamily: "Inter, system-ui, sans-serif" });
       item.label.anchor.set(0.5, 0.5);
       item.label.x = x + 4;
       item.label.y = y + 4;
       item.label.visible = true;
       if (item.sprite) item.sprite.visible = false;
     }
     return index;
   }
 
+  private renderReworkCues(
+    artifacts: ArtifactView[],
+    projection: OfficeProjection,
+    layout: RoomLayout
+  ): number {
+    let index = 0;
+    for (const artifact of artifacts) {
+      const producer = projection.agents.find((a) => a.agentId === artifact.producerAgentId);
+      if (!producer?.currentRoomId) continue;
+
+      const item = this.getItem(this.reworkItems, index++);
+      const pos = getAgentPositionByRoomId(
+        layout,
+        producer.currentRoomId,
+        this.hashSeed(artifact.artifactId)
+      );
+      const x = pos.x + 10;
+      const y = pos.y - 38;
+
+      item.graphics.clear();
+      // Clipboard body
+      item.graphics
+        .rect(x, y, 10, 12)
+        .fill({ color: 0xa89788 })
+        .stroke({ color: 0x7d7682, width: 1 });
+      // Clipboard clip
+      item.graphics.rect(x + 2, y - 1, 6, 2).fill({ color: 0x7d7682 });
+      // Red flag pole
+      item.graphics.rect(x + 2, y - 8, 1, 8).fill({ color: 0xc96a5b });
+      // Red flag
+      item.graphics
+        .moveTo(x + 3, y - 8)
+        .lineTo(x + 10, y - 5)
+        .lineTo(x + 3, y - 2)
+        .closePath()
+        .fill({ color: 0xc96a5b });
+      item.graphics.visible = true;
+
+      item.label.text = "rework";
+      item.label.style = new TextStyle({
+        fontSize: 8,
+        fill: 0xc96a5b,
+        fontFamily: "Inter, system-ui, sans-serif",
+      });
+      item.label.anchor.set(0.5, 0);
+      item.label.x = x + 5;
+      item.label.y = y + 14;
+      item.label.visible = true;
+      if (item.sprite) item.sprite.visible = false;
+    }
+    return index;
+  }
+
   private getItem(pool: EffectItem[], index: number): EffectItem {
     if (index < pool.length) {
       return pool[index];
     }
     const graphics = new Graphics();
     const label = new Text({
       text: "",
       style: new TextStyle({ fontSize: 10, fill: 0xf2f0eb, fontFamily: "Inter, system-ui, sans-serif" }),
     });
     label.anchor.set(0.5, 0.5);
