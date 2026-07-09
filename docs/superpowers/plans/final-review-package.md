# Final review package

## Commits

3eb4179 chore(design): regenerate swarm-office-v1.1 baselines and annotated comparisons
79300c1 test(control-ui, pixel-office): cover exported helpers artifactStatusIntent and resolveAgentTreatment
9175c8e docs(swarm-office): align current-state audit with Task 1/2 reality and fix report
0194e82 docs(superpowers): update Task 3 report commit range and hash
5d8d2ea docs(superpowers): add Task 3 report for Issue #25
1aee6ef feat(scripts,design): capture selected states, assert dimensions, update gap-audit for Issue #25 Task 3
29c3077 docs(superpowers): correct Task 2 report commits and brief paths
365c47d docs(superpowers): add task 2 report
ffa9ff4 feat(pixel-office): rework cue for revision_required artifacts and blocked/failed posture truth
3bd7680 feat(control-ui): distinct revision_required/rejected intents and artifact content states
2074d73 fix(pixel-office,control-ui): wire canvas agent click selection and clean up review findings for Issue #25
7bf4242 fix(demo-office): address Task 1 review findings for Issue #25
a5c72cb feat(demo-office): bidirectional canvas/control-panel selection for Issue #25 Task 1
f4cd3c3 docs(swarm-office): remove stale sentence in current-state audit
7bc21f8 docs(swarm-office): update gap-audit and annotation labels for Issue #25 Task 0

## Diff stat

 apps/demo-office/src/App.test.tsx                  | 352 ++++++++++++++++++++-
 apps/demo-office/src/App.tsx                       | 142 ++++++++-
 apps/demo-office/src/DemoControls.tsx              |   5 +-
 apps/demo-office/src/ListView.test.tsx             | 204 ++++++++++++
 apps/demo-office/src/ListView.tsx                  |  51 ++-
 apps/demo-office/src/theme.css                     |   2 +
 .../01-idle-office-annotated.png                   | Bin 113879 -> 119109 bytes
 .../annotated-comparisons/01-idle-office.html      |  10 +-
 .../02-active-task-execution-annotated.png         | Bin 118059 -> 118782 bytes
 .../02-active-task-execution.html                  |  34 +-
 .../03-artifact-under-review-annotated.png         | Bin 114322 -> 126647 bytes
 .../03-artifact-under-review.html                  |  24 +-
 .../04-pending-approval-annotated.png              | Bin 117085 -> 125615 bytes
 .../annotated-comparisons/04-pending-approval.html |  22 +-
 .../05-blocked-task-agent-annotated.png            | Bin 113544 -> 126310 bytes
 .../05-blocked-task-agent.html                     |  24 +-
 .../06-revision-required-annotated.png             | Bin 117155 -> 124300 bytes
 .../06-revision-required.html                      |  10 +-
 .../07-focus-mode-annotated.png                    | Bin 82941 -> 88446 bytes
 .../annotated-comparisons/07-focus-mode.html       |  28 +-
 .../08-debrief-mode-annotated.png                  | Bin 81313 -> 83442 bytes
 .../annotated-comparisons/08-debrief-mode.html     |  18 +-
 .../09-selected-agent-annotated.png                | Bin 0 -> 57455 bytes
 .../annotated-comparisons/09-selected-agent.html   |  82 +++++
 .../10-selected-task-card-annotated.png            | Bin 0 -> 117202 bytes
 .../10-selected-task-card.html                     |  82 +++++
 .../baseline/1366x768/01-idle-office.png           | Bin 79800 -> 79818 bytes
 .../baseline/1366x768/02-active-task-execution.png | Bin 85168 -> 85172 bytes
 .../baseline/1366x768/03-artifact-under-review.png | Bin 87355 -> 92176 bytes
 .../baseline/1366x768/04-pending-approval.png      | Bin 88177 -> 94345 bytes
 .../baseline/1366x768/05-blocked-task-agent.png    | Bin 89152 -> 94232 bytes
 .../baseline/1366x768/06-revision-required.png     | Bin 86114 -> 92421 bytes
 .../baseline/1366x768/07-focus-mode.png            | Bin 64219 -> 64206 bytes
 .../baseline/1366x768/08-debrief-mode.png          | Bin 62675 -> 62966 bytes
 .../baseline/1366x768/09-selected-agent.png        | Bin 0 -> 37572 bytes
 .../baseline/1366x768/10-selected-task-card.png    | Bin 0 -> 89636 bytes
 .../baseline/1440x900/01-idle-office.png           | Bin 91186 -> 91147 bytes
 .../baseline/1440x900/02-active-task-execution.png | Bin 97097 -> 97080 bytes
 .../baseline/1440x900/03-artifact-under-review.png | Bin 99337 -> 103782 bytes
 .../baseline/1440x900/04-pending-approval.png      | Bin 100535 -> 105623 bytes
 .../baseline/1440x900/05-blocked-task-agent.png    | Bin 102019 -> 108100 bytes
 .../baseline/1440x900/06-revision-required.png     | Bin 97925 -> 102913 bytes
 .../baseline/1440x900/07-focus-mode.png            | Bin 69502 -> 69302 bytes
 .../baseline/1440x900/08-debrief-mode.png          | Bin 66720 -> 67324 bytes
 .../baseline/1440x900/09-selected-agent.png        | Bin 0 -> 41537 bytes
 .../baseline/1440x900/10-selected-task-card.png    | Bin 0 -> 100108 bytes
 .../baseline/1920x1080/01-idle-office.png          | Bin 114924 -> 114917 bytes
 .../1920x1080/02-active-task-execution.png         | Bin 122300 -> 122338 bytes
 .../1920x1080/03-artifact-under-review.png         | Bin 127008 -> 129365 bytes
 .../baseline/1920x1080/04-pending-approval.png     | Bin 128015 -> 131860 bytes
 .../baseline/1920x1080/05-blocked-task-agent.png   | Bin 130668 -> 140971 bytes
 .../baseline/1920x1080/06-revision-required.png    | Bin 124548 -> 129147 bytes
 .../baseline/1920x1080/07-focus-mode.png           | Bin 82715 -> 82875 bytes
 .../baseline/1920x1080/08-debrief-mode.png         | Bin 76709 -> 77421 bytes
 .../baseline/1920x1080/09-selected-agent.png       | Bin 0 -> 48658 bytes
 .../baseline/1920x1080/10-selected-task-card.png   | Bin 0 -> 126551 bytes
 docs/design/swarm-office-v1.1/gap-audit.md         | 216 +++++--------
 .../2026-07-08-issue-25-swarm-office-follow-up.md  | 194 ++++++++++++
 docs/superpowers/plans/task-1-brief.md             |  63 ++++
 docs/superpowers/plans/task-1-report.md            | 169 ++++++++++
 docs/superpowers/plans/task-2-brief.md             |  51 +++
 docs/superpowers/plans/task-2-report.md            |  31 ++
 docs/superpowers/plans/task-3-report.md            |  63 ++++
 docs/superpowers/plans/task-4-report.md            |  60 ++++
 packages/control-ui/src/ControlPanel.test.tsx      |  97 +++++-
 packages/control-ui/src/ControlPanel.tsx           | 214 +++++++++++--
 .../src/components/ApprovalDrawer.test.tsx         |  52 +++
 .../control-ui/src/components/ApprovalDrawer.tsx   |  46 ++-
 packages/control-ui/src/components/Badge.tsx       |   4 +-
 packages/control-ui/src/components/Card.tsx        |  37 ++-
 packages/control-ui/src/components/intents.test.ts |  25 ++
 packages/control-ui/src/components/intents.ts      |   5 +-
 packages/control-ui/src/control-panel.css          |  41 +++
 .../src/__tests__/agent-renderer.test.ts           |  49 ++-
 .../src/__tests__/effect-renderer.test.ts          |  25 ++
 .../src/__tests__/office-scene.test.ts             | 175 ++++++++++
 packages/pixel-office/src/__tests__/pixi-mock.ts   |   6 +
 packages/pixel-office/src/index.ts                 |   1 +
 packages/pixel-office/src/office-scene.ts          |  23 ++
 .../pixel-office/src/renderer/agent-renderer.ts    |  70 ++++
 .../pixel-office/src/renderer/effect-renderer.ts   |  62 +++-
 .../pixel-office/src/renderer/room-renderer.ts     |  21 ++
 packages/pixel-office/src/selection.ts             |   6 +
 scripts/capture-demo-office-screenshots.mjs        | 121 ++++++-
 scripts/generate-annotated-comparisons.mjs         |  82 +++--
 85 files changed, 2800 insertions(+), 299 deletions(-)

## Textual diff (excluding binary additions)

diff --git a/apps/demo-office/src/App.test.tsx b/apps/demo-office/src/App.test.tsx
index dd4c055..82dde22 100644
--- a/apps/demo-office/src/App.test.tsx
+++ b/apps/demo-office/src/App.test.tsx
@@ -27,26 +27,39 @@ vi.mock("@agent-office/control-ui/life-sim", async () => {
     ...actual,
     LifeSimControlPanel: vi.fn(() => <div data-testid="life-sim-panel">LifeSimControlPanel</div>),
   };
 });
 
 vi.mock("./useComposedOfficeState.js", () => ({
   useComposedOfficeState: vi.fn(),
 }));
 
 vi.mock("@agent-office/pixel-office", () => ({
-  PixelOfficeScene: vi.fn().mockImplementation(() => ({
-    init: vi.fn().mockResolvedValue(undefined),
-    destroy: vi.fn(),
-    updateProjection: vi.fn(),
-    setReduceMotion: vi.fn(),
-  })),
+  PixelOfficeScene: vi.fn().mockImplementation(() => {
+    let onSelectCallback: ((selection: { kind: string; id: string }) => void) | null = null;
+    return {
+      init: vi.fn().mockResolvedValue(undefined),
+      destroy: vi.fn(),
+      updateProjection: vi.fn(),
+      setReduceMotion: vi.fn(),
+      selectAgent: vi.fn(),
+      selectAgents: vi.fn(),
+      selectRoom: vi.fn(),
+      clearSelection: vi.fn(),
+      setOnSelect: vi.fn((cb: typeof onSelectCallback) => {
+        onSelectCallback = cb;
+      }),
+      simulateAgentSelect: (id: string) => {
+        onSelectCallback?.({ kind: "agent", id });
+      },
+    };
+  }),
 }));
 
 let resizeCallback: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
 
 class ResizeObserverMock {
   constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
     resizeCallback = callback;
   }
   observe() {}
   disconnect() {}
@@ -482,10 +495,337 @@ describe("DemoControls panel card", () => {
 
     fireEvent.click(screen.getByRole("button", { name: "重置" }));
     expect(mockAdapter.reset).toHaveBeenCalled();
     expect(mockStore.reset).toHaveBeenCalled();
     expect(mockSession.resynchronize).toHaveBeenCalled();
 
     fireEvent.click(screen.getByRole("button", { name: "回放事件" }));
     expect(mockStore.rebuildFromLog).toHaveBeenCalled();
   });
 });
+
+describe("App selection", () => {
+  const projectionWithEntities = {
+    ...baseState.projection,
+    agents: [
+      {
+        agentId: "agent-1",
+        name: "Agent One",
+        role: "orchestrator",
+        status: "idle",
+        currentTaskId: null,
+        currentRoomId: "room-1",
+        blockedReason: null,
+      },
+      {
+        agentId: "agent-2",
+        name: "Agent Two",
+        role: "worker",
+        status: "working",
+        currentTaskId: "task-1",
+        currentRoomId: "room-2",
+        blockedReason: null,
+      },
+    ],
+    tasks: [
+      {
+        taskId: "task-1",
+        title: "Task One",
+        description: "",
+        status: "running",
+        priority: "high",
+        assigneeId: "agent-2",
+        roomId: "room-2",
+        artifactIds: ["art-1"],
+        approvalId: null,
+        blockedReason: null,
+      },
+    ],
+    artifacts: [
+      {
+        artifactId: "art-1",
+        taskId: "task-1",
+        producerAgentId: "agent-2",
+        type: "document",
+        title: "Artifact One",
+        status: "generated",
+        version: 1,
+        reviewResult: null,
+      },
+    ],
+    approvals: [
+      {
+        approvalId: "approval-1",
+        taskId: "task-1",
+        kind: "artifact_delivery",
+        status: "requested",
+        requestedBy: "agent-2",
+        reason: "Approve delivery",
+      },
+    ],
+    rooms: [
+      {
+        roomId: "room-1",
+        name: "Command",
+        type: "command",
+        bounds: { x: 0, y: 0, width: 200, height: 150 },
+        activeAgentIds: ["agent-1"],
+      },
+      {
+        roomId: "room-2",
+        name: "Execution",
+        type: "execution",
+        bounds: { x: 220, y: 0, width: 200, height: 150 },
+        activeAgentIds: ["agent-2"],
+      },
+    ],
+  };
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    setBodyWidth(1280);
+    (useComposedOfficeState as Mock).mockReturnValue({
+      ...baseState,
+      projection: projectionWithEntities,
+    });
+  });
+
+  function getControlPanelProps(): Record<string, unknown> {
+    const calls = (ControlPanel as Mock).mock.calls;
+    return calls[calls.length - 1][0] as Record<string, unknown>;
+  }
+
+  function getSceneInstance(): Record<string, ReturnType<typeof vi.fn>> {
+    return (PixelOfficeScene as Mock).mock.results[(PixelOfficeScene as Mock).mock.results.length - 1]
+      .value as Record<string, ReturnType<typeof vi.fn>>;
+  }
+
+  it("passes selection and onSelect to ControlPanel and applies agent selection to the scene", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    expect(typeof props.onSelect).toBe("function");
+
+    const scene = getSceneInstance();
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
+    });
+
+    expect(scene.selectAgent).toHaveBeenCalledWith("agent-1");
+
+    const nextProps = getControlPanelProps();
+    expect(nextProps.selection).toEqual({ kind: "agent", id: "agent-1" });
+  });
+
+  it("selection survives mode switches", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
+    });
+
+    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));
+    fireEvent.click(screen.getByRole("tab", { name: "Command" }));
+
+    expect(getControlPanelProps().selection).toEqual({ kind: "agent", id: "agent-1" });
+  });
+
+  it("selection survives pixel/list view switches", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
+    });
+
+    fireEvent.click(screen.getByRole("button", { name: "List" }));
+    fireEvent.click(screen.getByRole("button", { name: "Pixel" }));
+
+    const scene = getSceneInstance();
+    expect(scene.selectAgent).toHaveBeenCalledWith("agent-1");
+    expect(getControlPanelProps().selection).toEqual({ kind: "agent", id: "agent-1" });
+  });
+
+  it("clears selection when the selected entity disappears from the projection", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
+    });
+
+    expect(getSceneInstance().selectAgent).toHaveBeenCalledWith("agent-1");
+
+    (useComposedOfficeState as Mock).mockReturnValue({
+      ...baseState,
+      projection: { ...projectionWithEntities, agents: projectionWithEntities.agents.slice(1) },
+    });
+
+    // Trigger a re-render while still in pixel view so the scene stays alive.
+    fireEvent.click(screen.getByRole("button", { name: "Motion on" }));
+
+    expect(getSceneInstance().clearSelection).toHaveBeenCalled();
+    expect(getControlPanelProps().selection).toBeNull();
+  });
+
+  it("clears selection when Escape is pressed", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    const scene = getSceneInstance();
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
+    });
+
+    scene.selectAgent.mockClear();
+
+    fireEvent.keyDown(document.body, { key: "Escape" });
+
+    expect(scene.clearSelection).toHaveBeenCalled();
+    expect(getControlPanelProps().selection).toBeNull();
+  });
+
+  it("updates selection when an agent is selected on the canvas", () => {
+    renderApp();
+    const scene = getSceneInstance();
+    act(() => {
+      scene.simulateAgentSelect("agent-2");
+    });
+
+    expect(getControlPanelProps().selection).toEqual({ kind: "agent", id: "agent-2" });
+    expect(scene.selectAgent).toHaveBeenCalledWith("agent-2");
+  });
+
+  it("highlights the assignee agent when a task is selected", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    const scene = getSceneInstance();
+
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "task", id: "task-1" });
+    });
+
+    expect(scene.selectAgent).toHaveBeenCalledWith("agent-2");
+  });
+
+  it("highlights the producer agent when an artifact is selected", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    const scene = getSceneInstance();
+
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "artifact", id: "art-1" });
+    });
+
+    expect(scene.selectAgent).toHaveBeenCalledWith("agent-2");
+  });
+
+  it("highlights the requesting agent when an approval is selected", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    const scene = getSceneInstance();
+
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "approval", id: "approval-1" });
+    });
+
+    expect(scene.selectAgent).toHaveBeenCalledWith("agent-2");
+  });
+
+  it("highlights the room and its active agents when a room is selected", () => {
+    renderApp();
+    const props = getControlPanelProps();
+    const scene = getSceneInstance();
+
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "room", id: "room-1" });
+    });
+
+    expect(scene.selectRoom).toHaveBeenCalledWith("room-1");
+    expect(scene.selectAgents).toHaveBeenCalledWith(["agent-1"]);
+  });
+
+  it("falls back to room highlight when a task has no assignee", () => {
+    (useComposedOfficeState as Mock).mockReturnValue({
+      ...baseState,
+      projection: {
+        ...projectionWithEntities,
+        tasks: [
+          {
+            ...projectionWithEntities.tasks[0],
+            assigneeId: null,
+          },
+        ],
+      },
+    });
+
+    renderApp();
+    const props = getControlPanelProps();
+    const scene = getSceneInstance();
+
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "task", id: "task-1" });
+    });
+
+    expect(scene.selectRoom).toHaveBeenCalledWith("room-2");
+  });
+
+  it("clears canvas highlight when the selected entity has no related agent or room", () => {
+    (useComposedOfficeState as Mock).mockReturnValue({
+      ...baseState,
+      projection: {
+        ...projectionWithEntities,
+        tasks: [
+          {
+            ...projectionWithEntities.tasks[0],
+            assigneeId: null,
+            roomId: null,
+          },
+        ],
+      },
+    });
+
+    renderApp();
+    const props = getControlPanelProps();
+    const scene = getSceneInstance();
+
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "task", id: "task-1" });
+    });
+
+    expect(scene.clearSelection).toHaveBeenCalled();
+  });
+
+  it("clears selection when Reset is triggered", () => {
+    const adapter = {
+      playNormalFlow: vi.fn(),
+      playErrorFlow: vi.fn(),
+      playRevisionFlow: vi.fn(),
+      reset: vi.fn(),
+    };
+    const store = { reset: vi.fn() };
+    const resetSession = { resynchronize: vi.fn().mockResolvedValue(undefined) };
+
+    renderApp({
+      demoControls: (
+        <DemoControls
+          adapter={adapter as any}
+          store={store as any}
+          session={resetSession as any}
+        />
+      ),
+    });
+
+    const props = getControlPanelProps();
+    const scene = getSceneInstance();
+
+    act(() => {
+      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
+    });
+
+    expect(getControlPanelProps().selection).toEqual({ kind: "agent", id: "agent-1" });
+
+    fireEvent.click(screen.getByRole("button", { name: "重置" }));
+
+    expect(adapter.reset).toHaveBeenCalled();
+    expect(store.reset).toHaveBeenCalled();
+    expect(resetSession.resynchronize).toHaveBeenCalled();
+    expect(scene.clearSelection).toHaveBeenCalled();
+    expect(getControlPanelProps().selection).toBeNull();
+  });
+});
diff --git a/apps/demo-office/src/App.tsx b/apps/demo-office/src/App.tsx
index cedbec9..5924607 100644
--- a/apps/demo-office/src/App.tsx
+++ b/apps/demo-office/src/App.tsx
@@ -4,41 +4,44 @@
  * 新布局（Swarm Office shell）：
  * ┌──────────────────────────────────────┬──────────────────┐
  * │ status strip                         │                  │
  * ├──────────────────────────────────────┴──────────────────┤
  * │ header (brand · mode switcher · view / motion toggles)   │
  * ├──────────────────────────────────────┬──────────────────┤
  * │  像素空间 / 列表视图 / Focus 指示器    │  ControlPanel    │
  * │                                       │                  │
  * └──────────────────────────────────────┴──────────────────┘
  */
-import {
+import React, {
   useState,
   useEffect,
   useRef,
   useMemo,
   useCallback,
   type FC,
   type ReactNode,
   type KeyboardEvent,
 } from "react";
 import type { SnapshotStore, CommandGateway, RuntimeSession } from "@agent-office/core";
-import type { AdapterCapabilities } from "@agent-office/protocol";
+import type { AdapterCapabilities, OfficeProjection } from "@agent-office/protocol";
 import {
   ControlPanel,
   type ExperienceMode,
 } from "@agent-office/control-ui";
 import {
   LifeSimControlPanel,
   type LifeSimSession,
 } from "@agent-office/control-ui/life-sim";
-import { PixelOfficeScene } from "@agent-office/pixel-office";
+import {
+  PixelOfficeScene,
+  type OfficeSelection,
+} from "@agent-office/pixel-office";
 import { ListView } from "./ListView.js";
 import { DebriefTimeline } from "./DebriefTimeline.js";
 import { FocusModeIndicator } from "./FocusModeIndicator.js";
 import { StatusStrip } from "./StatusStrip.js";
 import { useComposedOfficeState } from "./useComposedOfficeState.js";
 
 interface AppProps {
   session: RuntimeSession;
   store: SnapshotStore;
   gateway: CommandGateway;
@@ -59,20 +62,68 @@ interface AppProps {
 }
 
 type ViewMode = "pixel" | "list";
 
 const EXPERIENCE_MODES: ExperienceMode[] = ["command", "focus", "debrief"];
 
 function formatModeLabel(mode: ExperienceMode): string {
   return mode.charAt(0).toUpperCase() + mode.slice(1);
 }
 
+type CanvasSelection = { kind: "agent" | "room"; id: string } | null;
+
+function resolveCanvasSelection(
+  selection: OfficeSelection | null,
+  projection: OfficeProjection
+): CanvasSelection {
+  if (!selection) return null;
+
+  if (selection.kind === "agent") {
+    return { kind: "agent", id: selection.id };
+  }
+
+  if (selection.kind === "room") {
+    return { kind: "room", id: selection.id };
+  }
+
+  if (selection.kind === "task") {
+    const task = projection.tasks.find((t) => t.taskId === selection.id);
+    if (task?.assigneeId) return { kind: "agent", id: task.assigneeId };
+    if (task?.roomId) return { kind: "room", id: task.roomId };
+    return null;
+  }
+
+  if (selection.kind === "artifact") {
+    const artifact = projection.artifacts.find((a) => a.artifactId === selection.id);
+    if (artifact?.producerAgentId) return { kind: "agent", id: artifact.producerAgentId };
+    const task = artifact?.taskId
+      ? projection.tasks.find((t) => t.taskId === artifact.taskId)
+      : undefined;
+    if (task?.assigneeId) return { kind: "agent", id: task.assigneeId };
+    if (task?.roomId) return { kind: "room", id: task.roomId };
+    return null;
+  }
+
+  if (selection.kind === "approval") {
+    const approval = projection.approvals.find((a) => a.approvalId === selection.id);
+    if (approval?.requestedBy) return { kind: "agent", id: approval.requestedBy };
+    const task = approval?.taskId
+      ? projection.tasks.find((t) => t.taskId === approval.taskId)
+      : undefined;
+    if (task?.assigneeId) return { kind: "agent", id: task.assigneeId };
+    if (task?.roomId) return { kind: "room", id: task.roomId };
+    return null;
+  }
+
+  return null;
+}
+
 export const App: FC<AppProps> = ({
   session,
   store,
   gateway,
   runtimeId,
   capabilities,
   demoControls,
   retryable = false,
   onRetry,
   lifeSimSession,
@@ -90,33 +141,58 @@ export const App: FC<AppProps> = ({
     session,
     store,
     gateway,
     runtimeId,
     lifeSimSession,
     lifeSimWorldId
   );
   const [experienceMode, setExperienceMode] = useState<ExperienceMode>("command");
   const [view, setView] = useState<ViewMode>("pixel");
   const [reduceMotion, setReduceMotion] = useState(false);
+  const [selection, setSelection] = useState<OfficeSelection | null>(null);
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const sceneRef = useRef<PixelOfficeScene | null>(null);
   const appBodyRef = useRef<HTMLDivElement>(null);
   const modeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
   const lastManualViewRef = useRef<ViewMode>("pixel");
+  const prevCanvasSelectionRef = useRef<CanvasSelection>(null);
+
+  const applyCanvasSelection = useCallback(
+    (scene: PixelOfficeScene, canvasSelection: CanvasSelection) => {
+      scene.clearSelection();
+      if (!canvasSelection) return;
+
+      if (canvasSelection.kind === "agent") {
+        scene.selectAgent(canvasSelection.id);
+      } else if (canvasSelection.kind === "room") {
+        scene.selectRoom(canvasSelection.id);
+        const room = projection.rooms.find((r) => r.roomId === canvasSelection.id);
+        if (room && room.activeAgentIds.length > 0) {
+          scene.selectAgents(room.activeAgentIds);
+        }
+      }
+    },
+    [projection]
+  );
 
   // 初始化 PixelOfficeScene
   useEffect(() => {
     if (view !== "pixel" || !canvasRef.current) return;
     if (sceneRef.current) return;
 
     const scene = new PixelOfficeScene(canvasRef.current, { reduceMotion });
     sceneRef.current = scene;
+    scene.setOnSelect((s) => setSelection(s as OfficeSelection));
+
+    const canvasSelection = resolveCanvasSelection(selection, projection);
+    applyCanvasSelection(scene, canvasSelection);
+    prevCanvasSelectionRef.current = canvasSelection;
     scene.init(canvasRef.current).catch((err) => {
       console.error("[App] PixelOfficeScene 初始化失败：", err);
     });
 
     return () => {
       scene.destroy();
       sceneRef.current = null;
     };
   }, [view]);
 
@@ -155,20 +231,28 @@ export const App: FC<AppProps> = ({
     const onResize = () => update(window.innerWidth);
     window.addEventListener("resize", onResize);
     return () => window.removeEventListener("resize", onResize);
   }, []);
 
   const setManualView = useCallback((next: ViewMode) => {
     lastManualViewRef.current = next;
     setView(next);
   }, []);
 
+  const demoControlsWithReset = useMemo(() => {
+    if (!demoControls || !React.isValidElement(demoControls)) return demoControls;
+    return React.cloneElement(
+      demoControls as React.ReactElement<{ onReset?: () => void }>,
+      { onReset: () => setSelection(null) }
+    );
+  }, [demoControls]);
+
   const handleModeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
     const buttons = modeButtonRefs.current.filter(Boolean) as HTMLButtonElement[];
     const index = buttons.findIndex((b) => b === document.activeElement);
     if (index === -1) return;
 
     if (e.key === "ArrowRight") {
       buttons[(index + 1) % buttons.length].focus();
       e.preventDefault();
     } else if (e.key === "ArrowLeft") {
       buttons[(index - 1 + buttons.length) % buttons.length].focus();
@@ -182,20 +266,64 @@ export const App: FC<AppProps> = ({
     }
   };
 
   // 当 projection 变化时更新场景
   useEffect(() => {
     if (sceneRef.current && view === "pixel") {
       sceneRef.current.updateProjection(projection);
     }
   }, [projection, view]);
 
+  // 将当前选择同步到场景渲染层
+  useEffect(() => {
+    if (!sceneRef.current) return;
+
+    const canvasSelection = resolveCanvasSelection(selection, projection);
+    const prev = prevCanvasSelectionRef.current;
+    if (
+      prev?.kind === canvasSelection?.kind &&
+      prev?.id === canvasSelection?.id
+    ) {
+      return;
+    }
+    prevCanvasSelectionRef.current = canvasSelection;
+
+    applyCanvasSelection(sceneRef.current, canvasSelection);
+  }, [selection, projection, applyCanvasSelection]);
+
+  // 当已选实体从 projection 中消失时清除选择
+  useEffect(() => {
+    if (!selection) return;
+
+    const exists =
+      (selection.kind === "agent" && projection.agents.some((a) => a.agentId === selection.id)) ||
+      (selection.kind === "task" && projection.tasks.some((t) => t.taskId === selection.id)) ||
+      (selection.kind === "artifact" && projection.artifacts.some((a) => a.artifactId === selection.id)) ||
+      (selection.kind === "approval" && projection.approvals.some((a) => a.approvalId === selection.id)) ||
+      (selection.kind === "room" && projection.rooms.some((r) => r.roomId === selection.id));
+
+    if (!exists) {
+      setSelection(null);
+    }
+  }, [projection, selection]);
+
+  // Escape 清除选择
+  useEffect(() => {
+    const onKeyDown = (e: globalThis.KeyboardEvent) => {
+      if (e.key === "Escape") {
+        setSelection(null);
+      }
+    };
+    document.addEventListener("keydown", onKeyDown);
+    return () => document.removeEventListener("keydown", onKeyDown);
+  }, []);
+
   const lastEvent = useMemo(() => {
     const event = eventLog[eventLog.length - 1];
     if (!event) return null;
     return { type: event.type, timestamp: event.occurredAt };
   }, [eventLog]);
 
   const failedCount = useMemo(
     () =>
       projection.agents.filter((a) => a.status === "failed").length +
       projection.tasks.filter((t) => t.status === "failed").length,
@@ -288,32 +416,32 @@ export const App: FC<AppProps> = ({
           </button>
         </div>
       </header>
 
       <div className="app-body" ref={appBodyRef}>
         <div className={`app-stage ${isFocus ? "app-stage--dimmed" : ""}`}>
           {isDebrief ? (
             view === "pixel" ? (
               <DebriefTimeline events={eventLog} />
             ) : (
-              <ListView projection={projection} />
+              <ListView projection={projection} selection={selection} onSelect={setSelection} />
             )
           ) : view === "pixel" ? (
             <canvas
               ref={canvasRef}
               className="app-canvas"
               width={800}
               height={600}
               aria-label="Pixel office map showing agent rooms and tasks"
             />
           ) : (
-            <ListView projection={projection} />
+            <ListView projection={projection} selection={selection} onSelect={setSelection} />
           )}
           {isFocus && <FocusModeIndicator projection={projection} />}
         </div>
 
         <div className={`app-panel ${isFocus ? "app-panel--focus" : ""}`}>
           {isFocus ? (
             <div className="focus-urgent-panel" data-testid="focus-urgent-panel">
               <h3 className="focus-urgent-panel__title">Urgent Only</h3>
               <div className="focus-urgent-panel__cards">
                 <div className="focus-urgent-panel__card focus-urgent-panel__card--urgency">
@@ -344,30 +472,32 @@ export const App: FC<AppProps> = ({
                     data-testid="focus-urgent-count"
                   >
                     {failedCount}
                   </span>
                   <span className="focus-urgent-panel__label">Failed</span>
                 </div>
               </div>
             </div>
           ) : (
             <>
-              {demoControls}
+              {demoControlsWithReset}
               <LifeSimControlPanel
                 projection={projection.lifeSim}
                 onSendCommand={sendLifeSimCommand}
               />
               <ControlPanel
                 projection={projection}
                 eventLog={eventLog}
                 errors={errors}
                 mode={experienceMode}
                 onSendCommand={sendCommand}
                 capabilities={capabilities}
+                selection={selection}
+                onSelect={setSelection}
               />
             </>
           )}
         </div>
       </div>
     </div>
   );
 };
diff --git a/apps/demo-office/src/DemoControls.tsx b/apps/demo-office/src/DemoControls.tsx
index 1b6ff7e..5fee86d 100644
--- a/apps/demo-office/src/DemoControls.tsx
+++ b/apps/demo-office/src/DemoControls.tsx
@@ -10,26 +10,29 @@
  * 在真实 Runtime 接入后，这些按钮将被移除或替换为 Runtime 管理操作。
  */
 import type { FC } from "react";
 import type { MockRuntimeAdapter } from "@agent-office/adapter-mock";
 import type { SnapshotStore, RuntimeSession } from "@agent-office/core";
 
 interface DemoControlsProps {
   adapter: MockRuntimeAdapter;
   store: SnapshotStore;
   session: RuntimeSession;
+  /** Called after the adapter and store have been reset. */
+  onReset?: () => void;
 }
 
-export const DemoControls: FC<DemoControlsProps> = ({ adapter, store, session }) => {
+export const DemoControls: FC<DemoControlsProps> = ({ adapter, store, session, onReset }) => {
   const handleReset = () => {
     adapter.reset();
     store.reset();
+    onReset?.();
     // 重新安装 checkpoint 并恢复订阅（由 session 统一管理）
     session.resynchronize().catch((err) => {
       console.error("[DemoControls] resynchronize 失败：", err);
     });
   };
 
   const handleReplay = () => {
     store.rebuildFromLog();
   };
 
diff --git a/apps/demo-office/src/ListView.tsx b/apps/demo-office/src/ListView.tsx
index 27ecb73..f4e3f11 100644
--- a/apps/demo-office/src/ListView.tsx
+++ b/apps/demo-office/src/ListView.tsx
@@ -1,28 +1,65 @@
 /**
  * ListView — 普通列表视图（Dashboard 对照）。
  *
  * 用于和像素空间视图对照比较：
  * - 同样的 OfficeProjection 数据
  * - 用传统表格 + 列表呈现
  * - 不使用任何空间化表达
  *
  * 这是为了让用户能直观对比"空间表达 vs 传统 Dashboard"的差异。
  */
-import type { FC } from "react";
+import type { FC, KeyboardEvent } from "react";
 import type { OfficeProjection } from "@agent-office/protocol";
+import type { OfficeSelection } from "@agent-office/pixel-office";
 
 interface ListViewProps {
   projection: OfficeProjection;
+  selection?: OfficeSelection | null;
+  onSelect?: (selection: OfficeSelection) => void;
 }
 
-export const ListView: FC<ListViewProps> = ({ projection }) => {
+export const ListView: FC<ListViewProps> = ({ projection, selection = null, onSelect }) => {
+  const isSelected = (kind: OfficeSelection["kind"], id: string): boolean =>
+    selection?.kind === kind && selection?.id === id;
+
+  const handleSelect = (kind: OfficeSelection["kind"], id: string): void => {
+    onSelect?.({ kind, id });
+  };
+
+  const handleRowKeyDown =
+    (kind: OfficeSelection["kind"], id: string) =>
+    (e: KeyboardEvent<HTMLTableRowElement | HTMLDivElement>): void => {
+      if (e.key === "Enter" || e.key === " ") {
+        e.preventDefault();
+        onSelect?.({ kind, id });
+      }
+    };
+
+  const rowProps = (kind: OfficeSelection["kind"], id: string) => ({
+    tabIndex: onSelect ? 0 : undefined,
+    "aria-selected": isSelected(kind, id),
+    className: `list-view__row ${isSelected(kind, id) ? "list-view__row--selected" : ""}`,
+    onClick: () => handleSelect(kind, id),
+    onKeyDown: handleRowKeyDown(kind, id),
+    style: styles.tr,
+  });
+
+  const roomCardProps = (room: { roomId: string; name: string }) => ({
+    role: "button" as const,
+    tabIndex: onSelect ? 0 : undefined,
+    "aria-selected": isSelected("room", room.roomId),
+    "aria-label": `Select room ${room.name}`,
+    className: `list-view__room-card ${isSelected("room", room.roomId) ? "list-view__row--selected" : ""}`,
+    onClick: () => handleSelect("room", room.roomId),
+    onKeyDown: handleRowKeyDown("room", room.roomId),
+  });
   return (
     <div style={styles.container}>
       <h2 style={styles.title}>Dashboard 视图（传统列表）</h2>
       <p style={styles.hint}>
         此视图与左侧像素空间视图共享同一 OfficeProjection，便于对照比较。
       </p>
 
       {/* 状态摘要 */}
       <div style={styles.summaryRow}>
         <div style={styles.summaryBox}>
@@ -63,21 +100,21 @@ export const ListView: FC<ListViewProps> = ({ projection }) => {
               <th style={styles.th}>状态</th>
               <th style={styles.th}>当前任务</th>
               <th style={styles.th}>所在房间</th>
               <th style={styles.th}>阻塞原因</th>
             </tr>
           </thead>
           <tbody>
             {projection.agents.map((a) => {
               const room = projection.rooms.find((r) => r.roomId === a.currentRoomId);
               return (
-                <tr key={a.agentId} style={styles.tr}>
+                <tr key={a.agentId} {...rowProps("agent", a.agentId)}>
                   <td style={styles.td}>{a.agentId}</td>
                   <td style={styles.td}>{a.name}</td>
                   <td style={styles.td}>{a.role}</td>
                   <td style={{ ...styles.td, ...statusColor(a.status) }}>{a.status}</td>
                   <td style={styles.td}>{a.currentTaskId ?? "—"}</td>
                   <td style={styles.td}>{room?.name ?? "—"}</td>
                   <td style={{ ...styles.td, color: "var(--failure)" }}>{a.blockedReason ?? "—"}</td>
                 </tr>
               );
             })}
@@ -98,21 +135,21 @@ export const ListView: FC<ListViewProps> = ({ projection }) => {
               <th style={styles.th}>负责人</th>
               <th style={styles.th}>所在房间</th>
               <th style={styles.th}>审批</th>
               <th style={styles.th}>阻塞</th>
             </tr>
           </thead>
           <tbody>
             {projection.tasks.map((t) => {
               const room = projection.rooms.find((r) => r.roomId === t.roomId);
               return (
-                <tr key={t.taskId} style={styles.tr}>
+                <tr key={t.taskId} {...rowProps("task", t.taskId)}>
                   <td style={styles.td}>{t.taskId}</td>
                   <td style={styles.td}>{t.title}</td>
                   <td style={{ ...styles.td, ...taskStatusColor(t.status) }}>{t.status}</td>
                   <td style={styles.td}>{t.priority}</td>
                   <td style={styles.td}>{t.assigneeId ?? "—"}</td>
                   <td style={styles.td}>{room?.name ?? "—"}</td>
                   <td style={styles.td}>{t.approvalId ?? "—"}</td>
                   <td style={{ ...styles.td, color: "var(--failure)" }}>{t.blockedReason ?? "—"}</td>
                 </tr>
               );
@@ -131,21 +168,21 @@ export const ListView: FC<ListViewProps> = ({ projection }) => {
                 <th style={styles.th}>ID</th>
                 <th style={styles.th}>标题</th>
                 <th style={styles.th}>类型</th>
                 <th style={styles.th}>状态</th>
                 <th style={styles.th}>版本</th>
                 <th style={styles.th}>审查结果</th>
               </tr>
             </thead>
             <tbody>
               {projection.artifacts.map((a) => (
-                <tr key={a.artifactId} style={styles.tr}>
+                <tr key={a.artifactId} {...rowProps("artifact", a.artifactId)}>
                   <td style={styles.td}>{a.artifactId}</td>
                   <td style={styles.td}>{a.title}</td>
                   <td style={styles.td}>{a.type}</td>
                   <td style={{ ...styles.td, ...artifactStatusColor(a.status) }}>{a.status}</td>
                   <td style={styles.td}>v{a.version}</td>
                   <td style={styles.td}>
                     {a.reviewResult
                       ? `${a.reviewResult.verdict} — ${a.reviewResult.comment}`
                       : "—"}
                   </td>
@@ -166,40 +203,40 @@ export const ListView: FC<ListViewProps> = ({ projection }) => {
                 <th style={styles.th}>ID</th>
                 <th style={styles.th}>任务</th>
                 <th style={styles.th}>类型</th>
                 <th style={styles.th}>状态</th>
                 <th style={styles.th}>请求人</th>
                 <th style={styles.th}>原因</th>
               </tr>
             </thead>
             <tbody>
               {projection.approvals.map((a) => (
-                <tr key={a.approvalId} style={styles.tr}>
+                <tr key={a.approvalId} {...rowProps("approval", a.approvalId)}>
                   <td style={styles.td}>{a.approvalId}</td>
                   <td style={styles.td}>{a.taskId}</td>
                   <td style={styles.td}>{a.kind}</td>
                   <td style={{ ...styles.td, ...approvalStatusColor(a.status) }}>{a.status}</td>
                   <td style={styles.td}>{a.requestedBy}</td>
                   <td style={styles.td}>{a.reason}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </section>
       )}
 
       {/* Rooms */}
       <section style={styles.section}>
         <h3 style={styles.h3}>Rooms</h3>
         <div style={styles.roomGrid}>
           {projection.rooms.map((r) => (
-            <div key={r.roomId} style={styles.roomCard}>
+            <div key={r.roomId} {...roomCardProps(r)} style={styles.roomCard}>
               <div style={styles.roomName}>{r.name}</div>
               <div style={styles.roomType}>{r.type}</div>
               <div style={styles.roomAgents}>
                 活跃 Agents: {r.activeAgentIds.length}
               </div>
             </div>
           ))}
         </div>
       </section>
     </div>
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
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png
index 1cdc9fe..6214567 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html b/docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office.html
index b2042a5..e9a3dce 100644
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
-          <strong style="color:#e6a85c">2.</strong> Mode switcher is plain text; target: segmented control with --base-600 active fill
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
-          <strong style="color:#e6a85c">3.</strong> World card lacks visual hierarchy; target: panel card --base-700 surface + --base-500 border
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
-          <strong style="color:#e6a85c">4.</strong> Agent list is flat; target: cards with role silhouettes, status badges, pause actions
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
index 6a591b7..d5fe5d9 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html b/docs/design/swarm-office-v1.1/annotated-comparisons/02-active-task-execution.html
index e90f9ff..26a8cd8 100644
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
+          <strong style="color:#e6a85c">1.</strong> Selected task card baseline (10) shows linked canvas highlight; hover-only state is not separately baselined.
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
+          <strong style="color:#e6a85c">2.</strong> Artifact truth: normal-flow artifact has a URI; metadata-only / unavailable / unsupported-open states remain unverified.
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
+          <strong style="color:#e6a85c">3.</strong> Resolution hardening: check 1366×768 card text truncation and 1920×1080 panel width.
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
index 4373281..a08260e 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html b/docs/design/swarm-office-v1.1/annotated-comparisons/03-artifact-under-review.html
index 01aefcb..d7beea2 100644
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
+          <strong style="color:#e6a85c">1.</strong> Artifact state truth boundaries: revision_required, rejected, blocked, and failed must stay distinct. Mock cannot produce true runtime failed.
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
-          <strong style="color:#e6a85c">3.</strong> Status shows 'reviewing' but no approval-intent cue; target: clipboard page-flip + soft reading lamp
+          <strong style="color:#e6a85c">3.</strong> Canvas ↔ panel linked selection for reviewer/artifact is implemented but not yet a dedicated baseline.
+        </div>
+      </foreignObject>
+      <g transform="translate(360, 760)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
+      </g>
+      <line x1="360" y1="760" x2="390" y2="720" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="395" y="690" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
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
index 6525067..c5e6b78 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html b/docs/design/swarm-office-v1.1/annotated-comparisons/04-pending-approval.html
index 733e56f..4ee90e5 100644
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
+          <strong style="color:#e6a85c">3.</strong> Selected / hovered card capture now exists for agent and task.
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
index d133d51..ee069e6 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html b/docs/design/swarm-office-v1.1/annotated-comparisons/05-blocked-task-agent.html
index 58eab2e..d7eb7c0 100644
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
+          <strong style="color:#e6a85c">1.</strong> Blocked posture and pulse baseline is truthful; runtime failed/degraded capture is skipped.
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
-          <strong style="color:#e6a85c">3.</strong> Blocked badge color correct but missing --failure-dim background + error code
+          <strong style="color:#e6a85c">3.</strong> Linked selection for blocked agent card is implemented; room cross-highlight baseline is pending.
+        </div>
+      </foreignObject>
+      <g transform="translate(1090, 600)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
+      </g>
+      <line x1="1090" y1="600" x2="1120" y2="560" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="530" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
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
index 7729095..a9c2317 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html b/docs/design/swarm-office-v1.1/annotated-comparisons/06-revision-required.html
index 085c0d4..095da21 100644
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
-          <strong style="color:#e6a85c">2.</strong> Artifact/task marked revision_required but lacks a rework cue (clipboard with red flag)
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
-          <strong style="color:#e6a85c">3.</strong> Agent list shows idle; target: reviewer/worker posture indicating rework + revision badge
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
-          <strong style="color:#e6a85c">4.</strong> Note: mock adapter cannot independently trigger a true failed/runtime-error state
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
index e9f249f..f30c325 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html b/docs/design/swarm-office-v1.1/annotated-comparisons/07-focus-mode.html
index 88a8d61..86097df 100644
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
+          <strong style="color:#e6a85c">1.</strong> Focus panel exists; selection linkage is implemented but not shown in this baseline.
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
+          <strong style="color:#e6a85c">2.</strong> Urgent-only compact view; multi-resolution spacing and 1366×768 legibility need audit.
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
+          <strong style="color:#e6a85c">3.</strong> Keyboard-accessible selection is implemented (Tab/Enter/Space/Escape).
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
index 9568723..4982dbe 100644
Binary files a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png and b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode-annotated.png differ
diff --git a/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html b/docs/design/swarm-office-v1.1/annotated-comparisons/08-debrief-mode.html
index f567240..f8705c9 100644
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
+          <strong style="color:#e6a85c">3.</strong> No selected milestone or row highlight baseline yet.
+        </div>
+      </foreignObject>
+      <g transform="translate(1090, 420)">
+        <circle r="14" fill="#e6a85c" stroke="#131014" stroke-width="2" />
+        <text text-anchor="middle" dy="5" fill="#131014" font-size="14" font-weight="700">4</text>
+      </g>
+      <line x1="1090" y1="420" x2="1120" y2="380" stroke="#e6a85c" stroke-width="2" />
+      <foreignObject x="1125" y="350" width="340" height="80">
+        <div xmlns="http://www.w3.org/1999/xhtml" style="background:rgba(19,16,20,0.92);border:1px solid #e6a85c;border-radius:4px;padding:6px 8px;color:#f2f0eb;font-size:11px;line-height:1.35;font-family:Inter,system-ui,sans-serif;">
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
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/01-idle-office.png b/docs/design/swarm-office-v1.1/baseline/1366x768/01-idle-office.png
index 4e84917..b87a720 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/01-idle-office.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/01-idle-office.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png
index b46ca54..3a67f6e 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png
index 40161ed..2b8f866 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png
index 1a7b006..fd10bfb 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png
index 88712d3..816b67c 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png
index e5f28f3..e49cc6b 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png
index 8baab65..0714007 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png
index a13faca..e7b2d8c 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1366x768/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/01-idle-office.png b/docs/design/swarm-office-v1.1/baseline/1440x900/01-idle-office.png
index 5ac7405..a51bcfe 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/01-idle-office.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/01-idle-office.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png
index 21b1997..89ee304 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png
index 313b9af..63bc107 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png
index de6a6c1..1e6886f 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png
index 120ef00..89fe587 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png
index d98c63f..065e92f 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png
index 2c2cfb6..41af284 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png
index fd75a41..5815536 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1440x900/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/01-idle-office.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/01-idle-office.png
index 9328685..3c356d0 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/01-idle-office.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/01-idle-office.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png
index a9d3a37..62178f6 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/02-active-task-execution.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png
index 95e3fb5..6f4ae98 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/03-artifact-under-review.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png
index f364dae..73c87fd 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/04-pending-approval.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png
index 6ad8f75..7cac5b5 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/05-blocked-task-agent.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png
index c2de1cb..c4bac07 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/06-revision-required.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png
index 7a9c9e3..fb2e60a 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/07-focus-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png b/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png
index cc72b14..a9b0fe7 100644
Binary files a/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png and b/docs/design/swarm-office-v1.1/baseline/1920x1080/08-debrief-mode.png differ
diff --git a/docs/design/swarm-office-v1.1/gap-audit.md b/docs/design/swarm-office-v1.1/gap-audit.md
index c8f2007..de67887 100644
--- a/docs/design/swarm-office-v1.1/gap-audit.md
+++ b/docs/design/swarm-office-v1.1/gap-audit.md
@@ -1,197 +1,149 @@
 # Swarm Office V1.1 — Gap Audit
 
 > Evidence-based visual/UX gap analysis for `apps/demo-office`.
 > Baseline screenshots: `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/`
 > Annotated comparisons: `docs/design/swarm-office-v1.1/annotated-comparisons/`
 > Reference: `docs/design/swarm-office/design-system.md` + `docs/design/swarm-office/high-fidelity-designs-preview.png`
+> PR context: Task 3 of Issue #25; pre-PR #24 findings are now historical. Refs #14.
 
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
+- Agent/task bidirectional linked selection is implemented and baselined (`09-selected-agent`, `10-selected-task-card`).
+- `PixelOfficeScene` exposes `selectAgent`, `selectRoom`, `selectAgents`, `clearSelection`, and `setOnSelect`; `AgentRenderer` and `RoomRenderer` render selected/highlight outlines.
+- `ControlPanel` cards accept `selection`/`onSelect`, show `aria-pressed`, and support Tab/Enter/Space keyboard selection.
+- `ListView` rows are selectable with `aria-selected` and sync with canvas selection.
+- Remaining unbaselined gaps: room/approval/artifact cross-highlight and selected/hovered rows in Debrief mode.
 
-### Typography
+### 2. Artifact state truth boundaries
 
-| Token | Status | Notes |
-|-------|--------|-------|
-| `--font-ui` Inter 12–14px | Partial | Font stack not explicit; sizes roughly match. |
-| `--font-mono` JetBrains Mono | Missing | Runtime IDs/sequence use default monospace. |
-| `--font-pixel` Press Start 2P | Missing | Room labels are sans-serif, not pixel font. |
-| Headings (`--h1`, `--h2`) | Partial | Section titles lack consistent weight/scale. |
+- `revision_required`, `rejected`, `blocked`, and `failed` are now visually distinct on both canvas and panel (`revision_required` shows a rework cue, `rejected` uses a dedicated decision intent).
+- `ControlPanel` explicitly renders artifact content states: `content-available`, `metadata-only`, `unavailable`, `loading`, `failed-open`, and `unsupported-open`.
+- `artifactId` is never treated as a URI; missing content references render as metadata-only/unavailable rather than invented content.
+- The mock adapter cannot truthfully produce `metadata-only`, `unavailable`, `unsupported-open`, or `failed-open` states, so those UI states are implemented but not baselined.
 
-### Layout
+### 3. Multi-resolution layout hardening
 
-| Token | Status | Notes |
-|-------|--------|-------|
-| `--panel-width` 420px | Partial | Right panel width is close but not fixed/tokenized. |
-| `--status-height` 28px | Partial | Status strip exists; height not explicit. |
-| `--header-height` 44px | Partial | Header exists; height not explicit. |
-| Spacing tokens | Missing | Values are hard-coded in inline styles. |
+- Baselines were re-captured at `1366x768`, `1440x900`, and `1920x1080` with dimension and overflow assertions.
+- No horizontal overflow was detected at any target resolution.
+- `1366x768` panel density, mode-switcher labels, and card text remain legible.
+- `1920x1080` uses the extra stage width for the centered, scaled canvas; the `420px` panel feels proportional.
+- The responsive auto-switch to list view below `1024px` is implemented but not baselined.
 
-### Components
+### 4. Selected / hovered state capture
 
-| Component | Status | Notes |
-|-----------|--------|-------|
-| Status strip | Partial | Shows connection + runtime ID + seq; missing error state / timestamp. |
-| App header | Partial | Wordmark present; mode switcher is not a segmented control. |
-| Mode switcher | Missing | Plain text buttons, no active fill. |
-| Panel cards | Missing | No `--base-700` surface / `--base-500` border. |
-| Status badges | Partial | Colors roughly match but sizing/typography inconsistent. |
-| Approval drawer | Missing | No urgency border-left or bell icon. |
-| Error banner | Missing | Failed state has no banner. |
+- The screenshot pipeline now captures:
+  - selected agent on canvas + highlighted panel card (`09-selected-agent`),
+  - selected task card + highlighted assignee on canvas (`10-selected-task-card`).
+- Linked selection for agent and task is therefore baselined.
+- Not yet captured: hover-only states, selected room and related active agents, selected approval/artifact cross-highlight, and selected/hovered rows in Debrief mode.
 
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
+This section records the visual QA evidence after PR #24 and Task 3. All ten baseline screenshots and annotated comparisons were re-captured on 2026-07-08 across the three canonical resolutions.
 
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
+| 09 | Selected agent | `baseline/1440x900/09-selected-agent.png` | `09-selected-agent-annotated.png` |
+| 10 | Selected task card | `baseline/1440x900/10-selected-task-card.png` | `10-selected-task-card-annotated.png` |
 
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
+## Resolution pass
+
+A dedicated per-resolution pass was run on 2026-07-08 across `1366x768`, `1440x900`, and `1920x1080` using the updated `capture-demo-office-screenshots.mjs`. The script asserts that every PNG matches the target viewport width, matches the full-page height, and that `document.documentElement.scrollWidth <= clientWidth`.
+
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
-| Plan | `docs/superpowers/plans/2026-07-07-issue-23-swarm-office-v1.1-implementation.md` |
+| Plan | `docs/superpowers/plans/2026-07-08-issue-25-swarm-office-follow-up.md` |
+| Task brief | `docs/superpowers/plans/task-3-brief.md` |
 | Design system | `docs/design/swarm-office/design-system.md` |
 | High-fidelity reference | `docs/design/swarm-office/high-fidelity-designs-preview.png` |
 | Baseline screenshots | `docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/` |
 | Annotated comparisons | `docs/design/swarm-office-v1.1/annotated-comparisons/` |
 | Screenshot script | `scripts/capture-demo-office-screenshots.mjs` |
 | Annotation script | `scripts/generate-annotated-comparisons.mjs` |
diff --git a/packages/control-ui/src/ControlPanel.test.tsx b/packages/control-ui/src/ControlPanel.test.tsx
index b3ea61e..51b27c8 100644
--- a/packages/control-ui/src/ControlPanel.test.tsx
+++ b/packages/control-ui/src/ControlPanel.test.tsx
@@ -1,16 +1,16 @@
 // @vitest-environment jsdom
 
 import "@testing-library/jest-dom/vitest";
 import React from "react";
 import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
-import { describe, it, expect, vi, beforeEach } from "vitest";
+import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
 import { ControlPanel, type ExperienceMode } from "./ControlPanel.js";
 import { CommandType } from "@agent-office/protocol";
 import type { OfficeProjection, DomainEvent, AdapterCapabilities } from "@agent-office/protocol";
 
 const capabilities: AdapterCapabilities = {
   supportedEvents: [],
   supportedCommands: Object.values(CommandType),
   features: {
     snapshot: true,
     sse: false,
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
@@ -549,10 +569,85 @@ describe("ControlPanel", () => {
     expect(screen.getByText("delivered.md")).toBeInTheDocument();
     expect(screen.getByRole("heading", { name: /Decisions/i })).toBeInTheDocument();
     expect(screen.getByRole("heading", { name: /Event Timeline/i })).toBeInTheDocument();
     expect(screen.getByText(/task.completed/)).toBeInTheDocument();
 
     expect(screen.queryByRole("heading", { name: /^Create Task$/i })).not.toBeInTheDocument();
     expect(screen.queryByRole("heading", { name: /^Agents$/i })).not.toBeInTheDocument();
     expect(screen.queryByRole("heading", { name: /^Tasks$/i })).not.toBeInTheDocument();
   });
 });
+
+describe("ControlPanel selection", () => {
+  const originalScrollIntoView = Element.prototype.scrollIntoView;
+
+  afterEach(() => {
+    Element.prototype.scrollIntoView = originalScrollIntoView;
+  });
+
+  it("calls onSelect when clicking an agent card", () => {
+    const onSelect = vi.fn();
+    renderPanel({ onSelect });
+    const card = screen.getByText("Orchestrator").closest(".card") as HTMLElement;
+    fireEvent.click(card);
+    expect(onSelect).toHaveBeenCalledWith({ kind: "agent", id: "agent-1" });
+  });
+
+  it("calls onSelect when clicking a task card", () => {
+    const onSelect = vi.fn();
+    renderPanel({ onSelect });
+    const card = screen.getByText("Write Q3 report").closest(".card") as HTMLElement;
+    fireEvent.click(card);
+    expect(onSelect).toHaveBeenCalledWith({ kind: "task", id: "task-1" });
+  });
+
+  it("calls onSelect when clicking an artifact card", () => {
+    const onSelect = vi.fn();
+    renderPanel({ onSelect });
+    const card = screen.getByText("Q3-report-v2.md").closest(".card") as HTMLElement;
+    fireEvent.click(card);
+    expect(onSelect).toHaveBeenCalledWith({ kind: "artifact", id: "art-1" });
+  });
+
+  it("marks the selected card with highlight attributes", () => {
+    renderPanel({
+      selection: { kind: "agent", id: "agent-1" },
+      onSelect: vi.fn(),
+    });
+    const card = screen.getByText("Orchestrator").closest(".card") as HTMLElement;
+    expect(card).toHaveAttribute("aria-pressed", "true");
+    expect(card.classList.contains("card--selected")).toBe(true);
+  });
+
+  it("supports Enter key selection on a focused card", () => {
+    const onSelect = vi.fn();
+    renderPanel({ onSelect });
+    const card = screen.getByText("Worker-1").closest(".card") as HTMLElement;
+    card.focus();
+    fireEvent.keyDown(card, { key: "Enter" });
+    expect(onSelect).toHaveBeenCalledWith({ kind: "agent", id: "agent-2" });
+  });
+
+  it("supports Space key selection on a focused card", () => {
+    const onSelect = vi.fn();
+    renderPanel({ onSelect });
+    const card = screen.getByText("Write Q3 report").closest(".card") as HTMLElement;
+    card.focus();
+    fireEvent.keyDown(card, { key: " " });
+    expect(onSelect).toHaveBeenCalledWith({ kind: "task", id: "task-1" });
+  });
+
+  it("scrolls the selected card into view", () => {
+    const scrollIntoView = vi.fn();
+    Element.prototype.scrollIntoView = scrollIntoView;
+
+    const { rerender, props } = renderPanel({
+      selection: { kind: "agent", id: "agent-1" },
+    });
+
+    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
+
+    scrollIntoView.mockClear();
+    rerender(<ControlPanel {...props} selection={{ kind: "task", id: "task-1" }} />);
+    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
+  });
+});
diff --git a/packages/control-ui/src/ControlPanel.tsx b/packages/control-ui/src/ControlPanel.tsx
index 50d9bdc..36a4473 100644
--- a/packages/control-ui/src/ControlPanel.tsx
+++ b/packages/control-ui/src/ControlPanel.tsx
@@ -1,25 +1,26 @@
 /**
  * ControlPanel — 右侧控制面板。
  *
  * 只通过 onSendCommand 发命令，不直接持有 Adapter 或 Store。
  * Stage 2 移除模式切换器（已上移到 App header），仅保留操作卡片和审批表面。
  */
-import { useState, type FC } from "react";
+import { useState, useEffect, useRef, useCallback, type FC } from "react";
 import type {
   OfficeProjection,
   DomainEvent,
   AdapterCapabilities,
   AgentView,
   TaskView,
 } from "@agent-office/protocol";
 import { CommandType } from "@agent-office/protocol";
+import type { OfficeSelection } from "@agent-office/pixel-office";
 import { EventLogViewer } from "./EventLogViewer.js";
 import { Card } from "./components/Card.js";
 import { Badge, type BadgeIntent } from "./components/Badge.js";
 import { SectionHeader } from "./components/SectionHeader.js";
 import { ApprovalDrawer } from "./components/ApprovalDrawer.js";
 import { TaskForm } from "./components/TaskForm.js";
 import { ErrorBanner } from "./components/ErrorBanner.js";
 import { FocusPanel } from "./FocusPanel.js";
 import { DebriefPanel } from "./DebriefPanel.js";
 import { artifactStatusIntent } from "./components/intents.js";
@@ -32,32 +33,37 @@ interface ControlPanelProps {
   eventLog: DomainEvent[];
   errors: string[];
   mode: ExperienceMode;
   onSendCommand: (
     commandType: string,
     payload: unknown,
     targetId?: string | null
   ) => Promise<void>;
   /** Adapter capabilities — unsupported commands disable their buttons. */
   capabilities?: AdapterCapabilities;
+  selection?: OfficeSelection | null;
+  onSelect?: (selection: OfficeSelection) => void;
 }
 
 export const ControlPanel: FC<ControlPanelProps> = ({
   projection,
   eventLog,
   errors,
   mode,
   onSendCommand,
   capabilities,
+  selection = null,
+  onSelect,
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
@@ -108,44 +114,94 @@ export const ControlPanel: FC<ControlPanelProps> = ({
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
 
   const dismissError = (err: string) => {
     setDismissedErrors((prev) => new Set(prev).add(err));
   };
 
   const idleWorkers = projection.agents.filter(
     (a) => a.role === "worker" && a.status === "idle" && !a.blockedReason
   );
 
+  const isSelected = (kind: OfficeSelection["kind"], id: string): boolean =>
+    selection?.kind === kind && selection?.id === id;
+
+  const handleSelect =
+    (kind: OfficeSelection["kind"], id: string) =>
+    (e?: { stopPropagation?: () => void }): void => {
+      e?.stopPropagation?.();
+      onSelect?.({ kind, id });
+    };
+
+  const handleCardKeyDown =
+    (kind: OfficeSelection["kind"], id: string) =>
+    (e: import("react").KeyboardEvent<HTMLDivElement>): void => {
+      if (e.key === "Enter" || e.key === " ") {
+        e.preventDefault();
+        onSelect?.({ kind, id });
+      }
+    };
+
+  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
+
+  const setCardRef = useCallback(
+    (kind: OfficeSelection["kind"], id: string) =>
+      (el: HTMLDivElement | null): void => {
+        const key = `${kind}:${id}`;
+        if (el) {
+          cardRefs.current.set(key, el);
+        } else {
+          cardRefs.current.delete(key);
+        }
+      },
+    []
+  );
+
+  useEffect(() => {
+    if (!selection) return;
+    const key = `${selection.kind}:${selection.id}`;
+    const el = cardRefs.current.get(key);
+    if (el && typeof el.scrollIntoView === "function") {
+      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
+    }
+  }, [selection]);
+
   return (
     <div className="control-panel">
       {visibleErrors.length > 0 && (
         <div className="panel-section">
           {visibleErrors.map((err, index) => {
             const { code, message } = parseError(err);
             return (
               <ErrorBanner
                 key={`${index}-${hashString(message)}`}
                 code={code}
@@ -158,99 +214,127 @@ export const ControlPanel: FC<ControlPanelProps> = ({
       )}
 
       {mode === "command" && (
         <>
           <ApprovalDrawer
             approvals={projection.pendingApprovals}
             onApprove={handleAcceptApproval}
             onReject={handleRejectApproval}
             approveDisabled={!isSupported(CommandType.APPROVAL_ACCEPT)}
             rejectDisabled={!isSupported(CommandType.APPROVAL_REJECT)}
+            selection={selection}
+            onSelect={onSelect}
+            cardRef={(approvalId) => setCardRef("approval", approvalId)}
           />
 
           <div className="panel-section">
             <SectionHeader title="Create Task" />
             <TaskForm onCreate={handleCreateTask} disabled={!isSupported(CommandType.TASK_CREATE)} />
             {actionErrors["create-task"] && (
               <div className="action-error">{actionErrors["create-task"]}</div>
             )}
           </div>
 
           <div className="panel-section">
             <SectionHeader title="Agents" count={projection.agents.length} countIntent="idle" />
             {projection.agents.map((agent) => (
-              <Card key={agent.agentId}>
+              <Card
+                key={agent.agentId}
+                ref={setCardRef("agent", agent.agentId)}
+                selectable={Boolean(onSelect)}
+                selected={isSelected("agent", agent.agentId)}
+                ariaLabel={`Select agent ${agent.name}`}
+                onClick={handleSelect("agent", agent.agentId)}
+                onKeyDown={handleCardKeyDown("agent", agent.agentId)}
+              >
                 <div className="card-row">
                   <div>
                     <div className="card-title">{agent.name}</div>
                     <div className="card-meta">
                       {agent.role}
                       {agent.currentTaskId ? ` · ${agent.currentTaskId}` : " · no task"}
                       {agent.blockedReason ? ` · ${agent.blockedReason}` : ""}
                     </div>
                   </div>
                   <Badge intent={agentStatusIntent(agent.status)}>{agent.status}</Badge>
                 </div>
                 <div className="card-footer">
                   <button
                     className="btn btn--secondary btn--small"
-                    onClick={() => handlePauseAgent(agent.agentId)}
+                    onClick={(e) => {
+                      e.stopPropagation();
+                      handlePauseAgent(agent.agentId);
+                    }}
                     disabled={
                       agent.status === "paused" ||
                       agent.status === "offline" ||
                       !isSupported(CommandType.AGENT_PAUSE)
                     }
                     title={isSupported(CommandType.AGENT_PAUSE) ? undefined : "Unsupported by adapter"}
                   >
                     Pause
                   </button>
                   <button
                     className="btn btn--secondary btn--small"
-                    onClick={() => handleResumeAgent(agent.agentId)}
+                    onClick={(e) => {
+                      e.stopPropagation();
+                      handleResumeAgent(agent.agentId);
+                    }}
                     disabled={
                       agent.status !== "paused" || !isSupported(CommandType.AGENT_RESUME)
                     }
                     title={isSupported(CommandType.AGENT_RESUME) ? undefined : "Unsupported by adapter"}
                   >
                     Resume
                   </button>
                 </div>
                 {(actionErrors[`pause-${agent.agentId}`] || actionErrors[`resume-${agent.agentId}`]) && (
                   <div className="action-error">
                     {actionErrors[`pause-${agent.agentId}`] ?? actionErrors[`resume-${agent.agentId}`]}
                   </div>
                 )}
               </Card>
             ))}
           </div>
 
           <div className="panel-section">
             <SectionHeader title="Tasks" count={projection.tasks.length} countIntent="info" />
             {projection.tasks.map((task) => (
-              <Card key={task.taskId}>
+              <Card
+                key={task.taskId}
+                ref={setCardRef("task", task.taskId)}
+                selectable={Boolean(onSelect)}
+                selected={isSelected("task", task.taskId)}
+                ariaLabel={`Select task ${task.title}`}
+                onClick={handleSelect("task", task.taskId)}
+                onKeyDown={handleCardKeyDown("task", task.taskId)}
+              >
                 <div className="card-row">
                   <div>
                     <div className="card-title">{task.title}</div>
                     <div className="card-meta">
                       {task.taskId} · {task.assigneeId ?? "unassigned"} · {task.priority}
                       {task.blockedReason ? ` · ${task.blockedReason}` : ""}
                     </div>
                   </div>
                   <Badge intent={taskStatusIntent(task.status)}>{task.status}</Badge>
                 </div>
                 {task.status === "created" && idleWorkers.length > 0 && isSupported(CommandType.TASK_ASSIGN) && (
                   <div className="card-footer">
                     {idleWorkers.map((a) => (
                       <button
                         key={a.agentId}
                         className="btn btn--primary btn--small"
-                        onClick={() => handleAssignTask(task.taskId, a.agentId)}
+                        onClick={(e) => {
+                          e.stopPropagation();
+                          handleAssignTask(task.taskId, a.agentId);
+                        }}
                       >
                         Assign to {a.name}
                       </button>
                     ))}
                   </div>
                 )}
                 {actionErrors[`assign-${task.taskId}`] && (
                   <div className="action-error">{actionErrors[`assign-${task.taskId}`]}</div>
                 )}
               </Card>
@@ -258,68 +342,82 @@ export const ControlPanel: FC<ControlPanelProps> = ({
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
-                  <Card key={art.artifactId}>
+                  <Card
+                    key={art.artifactId}
+                    ref={setCardRef("artifact", art.artifactId)}
+                    selectable={Boolean(onSelect)}
+                    selected={isSelected("artifact", art.artifactId)}
+                    ariaLabel={`Select artifact ${art.title}`}
+                    onClick={handleSelect("artifact", art.artifactId)}
+                    onKeyDown={handleCardKeyDown("artifact", art.artifactId)}
+                  >
                     <div className="card-row">
                       <div>
                         <div className="card-title">{art.title}</div>
                         <div className="card-meta">
                           {art.artifactId} · {art.type}
                           {art.reviewResult
                             ? ` · ${art.reviewResult.verdict}: ${art.reviewResult.comment}`
                             : ""}
                         </div>
                       </div>
                       <Badge intent={artifactStatusIntent(art.status)}>
                         {art.status} v{art.version}
                       </Badge>
                     </div>
                     <div className="card-footer">
                       <button
                         className="btn btn--secondary btn--small"
-                        onClick={() => handleOpenArtifact(art.artifactId)}
+                        onClick={(e) => {
+                          e.stopPropagation();
+                          handleOpenArtifact(art.artifactId);
+                        }}
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
@@ -358,20 +456,79 @@ function hashString(input: string): string {
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
@@ -393,22 +550,23 @@ function taskStatusIntent(status: TaskView["status"]): BadgeIntent {
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
diff --git a/packages/control-ui/src/components/ApprovalDrawer.test.tsx b/packages/control-ui/src/components/ApprovalDrawer.test.tsx
index 6e67340..7514833 100644
--- a/packages/control-ui/src/components/ApprovalDrawer.test.tsx
+++ b/packages/control-ui/src/components/ApprovalDrawer.test.tsx
@@ -73,11 +73,63 @@ describe("ApprovalDrawer", () => {
         onReject={vi.fn()}
       />
     );
 
     const title = document.querySelector(".approval-drawer__title");
     const approveBtn = screen.getByRole("button", { name: "Approve approval ap1" });
     approveBtn.focus();
     fireEvent.keyDown(approveBtn, { key: "Escape" });
     expect(title).toHaveFocus();
   });
+
+  it("calls onSelect when clicking an approval card", () => {
+    const onSelect = vi.fn();
+    render(
+      <ApprovalDrawer
+        approvals={[makeApproval("ap1")]}
+        onApprove={vi.fn()}
+        onReject={vi.fn()}
+        selection={null}
+        onSelect={onSelect}
+      />
+    );
+
+    const card = document.querySelector(".approval-drawer");
+    expect(card).toBeInTheDocument();
+    fireEvent.click(card!);
+    expect(onSelect).toHaveBeenCalledWith({ kind: "approval", id: "ap1" });
+  });
+
+  it("marks the selected approval card with highlight attributes", () => {
+    render(
+      <ApprovalDrawer
+        approvals={[makeApproval("ap1")]}
+        onApprove={vi.fn()}
+        onReject={vi.fn()}
+        selection={{ kind: "approval", id: "ap1" }}
+        onSelect={vi.fn()}
+      />
+    );
+
+    const card = document.querySelector(".approval-drawer");
+    expect(card).toHaveAttribute("aria-pressed", "true");
+    expect(card?.classList.contains("card--selected")).toBe(true);
+  });
+
+  it("supports Enter key selection on a focused approval card", () => {
+    const onSelect = vi.fn();
+    render(
+      <ApprovalDrawer
+        approvals={[makeApproval("ap1")]}
+        onApprove={vi.fn()}
+        onReject={vi.fn()}
+        selection={null}
+        onSelect={onSelect}
+      />
+    );
+
+    const card = document.querySelector(".approval-drawer") as HTMLElement;
+    card.focus();
+    fireEvent.keyDown(card, { key: "Enter" });
+    expect(onSelect).toHaveBeenCalledWith({ kind: "approval", id: "ap1" });
+  });
 });
diff --git a/packages/control-ui/src/components/ApprovalDrawer.tsx b/packages/control-ui/src/components/ApprovalDrawer.tsx
index 2253d90..bf9ffe4 100644
--- a/packages/control-ui/src/components/ApprovalDrawer.tsx
+++ b/packages/control-ui/src/components/ApprovalDrawer.tsx
@@ -1,64 +1,102 @@
-import { useRef, type FC, type KeyboardEvent } from "react";
+import { useRef, type FC, type KeyboardEvent, type MouseEvent } from "react";
 import type { ApprovalView } from "@agent-office/protocol";
+import type { OfficeSelection } from "@agent-office/pixel-office";
 import { Card } from "./Card.js";
 
 interface ApprovalDrawerProps {
   approvals: ApprovalView[];
   onApprove: (approvalId: string) => void;
   onReject: (approvalId: string) => void;
   approveDisabled?: boolean;
   rejectDisabled?: boolean;
+  selection?: OfficeSelection | null;
+  onSelect?: (selection: OfficeSelection) => void;
+  cardRef?: (approvalId: string) => (el: HTMLDivElement | null) => void;
 }
 
 export const ApprovalDrawer: FC<ApprovalDrawerProps> = ({
   approvals,
   onApprove,
   onReject,
   approveDisabled = false,
   rejectDisabled = false,
+  selection = null,
+  onSelect,
+  cardRef,
 }) => {
   const titleRef = useRef<HTMLHeadingElement>(null);
 
   if (approvals.length === 0) return null;
 
+  const isSelected = (id: string): boolean =>
+    selection?.kind === "approval" && selection?.id === id;
+
+  const handleSelect = (id: string): void => {
+    onSelect?.({ kind: "approval", id });
+  };
+
   const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
     if (e.key === "Escape") {
       titleRef.current?.focus();
       e.preventDefault();
     }
   };
 
+  const handleCardKeyDown =
+    (id: string) =>
+    (e: KeyboardEvent<HTMLDivElement>): void => {
+      if (e.key === "Enter" || e.key === " ") {
+        e.preventDefault();
+        onSelect?.({ kind: "approval", id });
+      }
+    };
+
   return (
     <div className="panel-section approval-drawer__container" onKeyDown={handleKeyDown}>
       <h3 className="approval-drawer__title" ref={titleRef} tabIndex={-1}>
         Pending Approval <span className="badge badge--count">{approvals.length}</span>
       </h3>
       {approvals.map((approval) => (
-        <Card key={approval.approvalId} className="approval-drawer">
+        <Card
+          key={approval.approvalId}
+          ref={cardRef?.(approval.approvalId)}
+          className="approval-drawer"
+          selectable={Boolean(onSelect)}
+          selected={isSelected(approval.approvalId)}
+          ariaLabel={`Select approval ${approval.approvalId}`}
+          onClick={() => handleSelect(approval.approvalId)}
+          onKeyDown={handleCardKeyDown(approval.approvalId)}
+        >
           <div className="approval-drawer__meta">
             {approval.kind} · {approval.taskId}
             {approval.reason ? ` · ${approval.reason}` : ""}
           </div>
           <div className="approval-drawer__actions">
             <button
               className="btn btn--primary btn--small"
               aria-label={`Approve approval ${approval.approvalId}`}
-              onClick={() => onApprove(approval.approvalId)}
+              onClick={(e: MouseEvent<HTMLButtonElement>) => {
+                e.stopPropagation();
+                onApprove(approval.approvalId);
+              }}
               disabled={approveDisabled}
             >
               Approve
             </button>
             <button
               className="btn btn--danger btn--small"
               aria-label={`Reject approval ${approval.approvalId}`}
-              onClick={() => onReject(approval.approvalId)}
+              onClick={(e: MouseEvent<HTMLButtonElement>) => {
+                e.stopPropagation();
+                onReject(approval.approvalId);
+              }}
               disabled={rejectDisabled}
             >
               Reject
             </button>
           </div>
         </Card>
       ))}
     </div>
   );
 };
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
diff --git a/packages/control-ui/src/components/Card.tsx b/packages/control-ui/src/components/Card.tsx
index 3a057af..426f33a 100644
--- a/packages/control-ui/src/components/Card.tsx
+++ b/packages/control-ui/src/components/Card.tsx
@@ -1,12 +1,39 @@
-import type { FC, ReactNode } from "react";
+import { forwardRef, type ReactNode, type KeyboardEvent, type MouseEvent } from "react";
 
 interface CardProps {
   children: ReactNode;
   className?: string;
   hover?: boolean;
+  selected?: boolean;
+  selectable?: boolean;
+  ariaLabel?: string;
+  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
+  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
 }
 
-export const Card: FC<CardProps> = ({ children, className = "", hover = false }) => {
-  const cls = ["card", hover ? "card--hover" : "", className].filter(Boolean).join(" ");
-  return <div className={cls}>{children}</div>;
-};
+export const Card = forwardRef<HTMLDivElement, CardProps>(
+  ({ children, className = "", hover = false, selected = false, selectable = false, ariaLabel, onClick, onKeyDown }, ref) => {
+    const cls = [
+      "card",
+      hover ? "card--hover" : "",
+      selectable ? "card--selectable" : "",
+      selected ? "card--selected" : "",
+      className,
+    ].filter(Boolean).join(" ");
+    return (
+      <div
+        ref={ref}
+        className={cls}
+        role={selectable ? "button" : undefined}
+        aria-pressed={selectable ? selected : undefined}
+        aria-label={ariaLabel}
+        tabIndex={selectable ? 0 : undefined}
+        onClick={onClick}
+        onKeyDown={onKeyDown}
+      >
+        {children}
+      </div>
+    );
+  }
+);
+Card.displayName = "Card";
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
index aa661dd..aacc261 100644
--- a/packages/control-ui/src/control-panel.css
+++ b/packages/control-ui/src/control-panel.css
@@ -54,20 +54,34 @@
 }
 
 .card:last-child {
   margin-bottom: 0;
 }
 
 .card--hover:hover {
   background: var(--base-600);
 }
 
+.card--selectable {
+  cursor: pointer;
+}
+
+.card--selectable:focus-visible {
+  outline: 2px solid var(--info);
+  outline-offset: 2px;
+}
+
+.card--selected {
+  border-color: var(--info);
+  box-shadow: 0 0 0 2px var(--info);
+}
+
 .card-title {
   font-weight: 600;
   font-size: 12px;
   color: var(--base-100);
   margin-bottom: var(--space-xs);
 }
 
 .card-meta {
   color: var(--base-400);
   font-size: 11px;
@@ -123,20 +137,31 @@
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
 
@@ -414,20 +439,36 @@
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
index cc246c8..6b16673 100644
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
@@ -341,21 +351,58 @@ describe("AgentRenderer", () => {
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
 
diff --git a/packages/pixel-office/src/__tests__/office-scene.test.ts b/packages/pixel-office/src/__tests__/office-scene.test.ts
index 9896f2c..4e57516 100644
--- a/packages/pixel-office/src/__tests__/office-scene.test.ts
+++ b/packages/pixel-office/src/__tests__/office-scene.test.ts
@@ -673,10 +673,185 @@ describe("PixelOfficeScene legacy renderer animations", () => {
 
     const container = getAgentLayer(scene).children[0] as MockContainer;
     expect(container.x).toBe(100);
     expect(container.y).toBe(125);
     expect(Number.isFinite(container.x)).toBe(true);
     expect(Number.isFinite(container.y)).toBe(true);
 
     scene.destroy();
   });
 });
+
+describe("PixelOfficeScene selection API", () => {
+  let canvas: HTMLCanvasElement;
+
+  beforeEach(() => {
+    canvas = document.createElement("canvas");
+    MockAssets.reset();
+  });
+
+  afterEach(() => {
+    vi.clearAllMocks();
+  });
+
+  it("exposes selectAgent, selectRoom, clearSelection and setOnSelect", async () => {
+    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
+    await scene.init(canvas);
+
+    expect(typeof scene.selectAgent).toBe("function");
+    expect(typeof scene.selectRoom).toBe("function");
+    expect(typeof scene.clearSelection).toBe("function");
+    expect(typeof scene.setOnSelect).toBe("function");
+
+    scene.destroy();
+  });
+
+  it("forwards selected agent ids to the agent renderer", async () => {
+    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
+    await scene.init(canvas);
+
+    const agentRenderer = (scene as unknown as { agentRenderer: { getSelectedIds: () => Set<string> } }).agentRenderer;
+
+    scene.selectAgent("agent-1");
+    expect(agentRenderer.getSelectedIds().has("agent-1")).toBe(true);
+
+    scene.clearSelection();
+    expect(agentRenderer.getSelectedIds().has("agent-1")).toBe(false);
+
+    scene.destroy();
+  });
+
+  it("clears previous agent highlight when selecting a new agent", async () => {
+    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
+    await scene.init(canvas);
+
+    const agentRenderer = (scene as unknown as { agentRenderer: { getSelectedIds: () => Set<string> } }).agentRenderer;
+
+    scene.selectAgent("agent-1");
+    expect(agentRenderer.getSelectedIds().has("agent-1")).toBe(true);
+
+    scene.selectAgent("agent-2");
+    expect(agentRenderer.getSelectedIds().has("agent-1")).toBe(false);
+    expect(agentRenderer.getSelectedIds().has("agent-2")).toBe(true);
+
+    scene.destroy();
+  });
+
+  it("forwards selected room ids to the room renderer", async () => {
+    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
+    await scene.init(canvas);
+
+    const roomRenderer = (scene as unknown as { roomRenderer: { getSelectedIds: () => Set<string> } }).roomRenderer;
+
+    scene.selectRoom("command");
+    expect(roomRenderer.getSelectedIds().has("command")).toBe(true);
+
+    scene.clearSelection();
+    expect(roomRenderer.getSelectedIds().has("command")).toBe(false);
+
+    scene.destroy();
+  });
+
+  it("clears previous room highlight when selecting a new room", async () => {
+    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
+    await scene.init(canvas);
+
+    const roomRenderer = (scene as unknown as { roomRenderer: { getSelectedIds: () => Set<string> } }).roomRenderer;
+
+    scene.selectRoom("command");
+    expect(roomRenderer.getSelectedIds().has("command")).toBe(true);
+
+    scene.selectRoom("execution");
+    expect(roomRenderer.getSelectedIds().has("command")).toBe(false);
+    expect(roomRenderer.getSelectedIds().has("execution")).toBe(true);
+
+    scene.destroy();
+  });
+
+  it("renders a highlight outline around a selected agent", async () => {
+    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
+    await scene.init(canvas);
+
+    const projection: OfficeProjection = {
+      ...baseProjection,
+      agents: [
+        {
+          agentId: "agent-1",
+          name: "Agent 1",
+          role: "worker",
+          status: "idle",
+          currentTaskId: null,
+          currentRoomId: "command",
+          blockedReason: null,
+        },
+      ],
+    };
+
+    scene.selectAgent("agent-1");
+    scene.updateProjection(projection);
+
+    const agentLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
+      .children[2] as MockContainer;
+    const container = agentLayer.children[0] as MockContainer;
+    const highlights = container.children.filter((c) => c instanceof MockGraphics);
+
+    expect(highlights.length).toBeGreaterThan(0);
+
+    scene.destroy();
+  });
+
+  it("forwards pointerdown on an agent sprite to the setOnSelect callback", async () => {
+    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
+    await scene.init(canvas);
+
+    const onSelect = vi.fn();
+    scene.setOnSelect(onSelect);
+
+    const projection: OfficeProjection = {
+      ...baseProjection,
+      agents: [
+        {
+          agentId: "agent-1",
+          name: "Agent 1",
+          role: "worker",
+          status: "idle",
+          currentTaskId: null,
+          currentRoomId: "command",
+          blockedReason: null,
+        },
+      ],
+    };
+
+    scene.updateProjection(projection);
+
+    const agentLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
+      .children[2] as MockContainer;
+    const container = agentLayer.children[0] as MockContainer;
+    const pointerDownHandlers = container.eventHandlers["pointerdown"];
+    expect(pointerDownHandlers?.length).toBeGreaterThan(0);
+    pointerDownHandlers![0]();
+
+    expect(onSelect).toHaveBeenCalledWith({ kind: "agent", id: "agent-1" });
+
+    scene.destroy();
+  });
+
+  it("renders a highlight outline around a selected room", async () => {
+    const scene = new PixelOfficeScene(canvas, { useSpriteRenderer: true });
+    await scene.init(canvas);
+
+    scene.selectRoom("command");
+    scene.updateProjection(baseProjection);
+
+    const roomLayer = (scene as unknown as { contentRoot: MockContainer }).contentRoot
+      .children[0] as MockContainer;
+    const roomGraphic = roomLayer.children.find((c) => c instanceof MockGraphics) as MockGraphics | undefined;
+    expect(roomGraphic).toBeDefined();
+
+    const outlineStrokes = roomGraphic!.commands.filter(
+      (c) => c.type === "stroke" && (c.args[0] as { width?: number } | undefined)?.width === 4
+    );
+    expect(outlineStrokes.length).toBeGreaterThan(0);
+
+    scene.destroy();
+  });
+});
diff --git a/packages/pixel-office/src/__tests__/pixi-mock.ts b/packages/pixel-office/src/__tests__/pixi-mock.ts
index ca4c506..1095485 100644
--- a/packages/pixel-office/src/__tests__/pixi-mock.ts
+++ b/packages/pixel-office/src/__tests__/pixi-mock.ts
@@ -75,20 +75,26 @@ export class MockContainer {
   public y = 0;
   public scale = {
     x: 1,
     y: 1,
     set: vi.fn((x: number, y: number) => {
       this.scale.x = x;
       this.scale.y = y;
     }),
   };
   public removed = false;
+  public eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};
+
+  on(event: string, handler: (...args: unknown[]) => void): void {
+    if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
+    this.eventHandlers[event].push(handler);
+  }
 
   addChild(child: unknown): unknown {
     this.children.push(child);
     return child;
   }
 
   removeChild(child: unknown): unknown {
     this.children = this.children.filter((c) => c !== child);
     return child;
   }
diff --git a/packages/pixel-office/src/index.ts b/packages/pixel-office/src/index.ts
index b7df3fe..de88802 100644
--- a/packages/pixel-office/src/index.ts
+++ b/packages/pixel-office/src/index.ts
@@ -14,10 +14,11 @@ export {
 export {
   createDefaultLayout,
   createLayoutFromRoomViews,
   getAgentPositionByRoomId,
   type RoomLayout,
   type RoomLayoutEntry,
   type RoomProp,
   type Position,
   type PropType,
 } from "./layout.js";
+export { type OfficeSelection, type OfficeSelectionKind } from "./selection.js";
diff --git a/packages/pixel-office/src/office-scene.ts b/packages/pixel-office/src/office-scene.ts
index 6559390..3b88075 100644
--- a/packages/pixel-office/src/office-scene.ts
+++ b/packages/pixel-office/src/office-scene.ts
@@ -77,20 +77,21 @@ export class PixelOfficeScene {
   private reduceMotion: boolean;
   private overlayPulsePhase = 0;
   private idlePhase = 0;
   private blockedPulsePhase = 0;
   private sparklePhase = 0;
   private roomRenderer?: RoomRenderer;
   private propRenderer?: PropRenderer;
   private agentRenderer?: AgentRenderer;
   private effectRenderer?: EffectRenderer;
   private assetLoader?: AssetLoader;
+  private onSelectCallback: ((selection: { kind: string; id: string }) => void) | null = null;
 
   constructor(canvas: HTMLCanvasElement, options: PixelOfficeSceneOptions = {}) {
     this.useSpriteRenderer = options.useSpriteRenderer ?? true;
     this.reduceMotion = options.reduceMotion ?? false;
     this.app = new Application();
     this.contentRoot = new Container();
     this.roomLayer = new Container();
     this.propLayer = new Container();
     this.agentLayer = new Container();
     this.overlayLayer = new Container();
@@ -146,20 +147,21 @@ export class PixelOfficeScene {
     if (this.useSpriteRenderer) {
       this.assetLoader = new AssetLoader(this.resolveAssetBasePath());
       try {
         await this.assetLoader.loadAll();
       } catch {
         // 加载失败时继续：各渲染器内部会回退到程序化绘制
       }
       this.roomRenderer = new RoomRenderer(this.roomLayer, this.assetLoader);
       this.propRenderer = new PropRenderer(this.propLayer, this.assetLoader);
       this.agentRenderer = new AgentRenderer(this.agentLayer, this.assetLoader, this.reduceMotion);
+      this.agentRenderer.onSelectAgent = (agentId) => this.onSelectCallback?.({ kind: "agent", id: agentId });
       this.effectRenderer = new EffectRenderer(this.overlayLayer, this.assetLoader, this.reduceMotion);
     }
 
     // 启动渲染循环
     this.app.ticker.add((ticker) => this.update(ticker));
     this.initialized = true;
 
     // 如果在初始化完成前已有投影传入，补渲染一次。
     if (this.pendingProjection) {
       this.updateProjection(this.pendingProjection);
@@ -222,20 +224,41 @@ export class PixelOfficeScene {
       try {
         // Keep the <canvas> element in the DOM so React can unmount/reuse it.
         this.app.destroy({ removeView: false });
       } catch {
         // PixiJS destroy 可能抛错（如 StrictMode 双调用），忽略
       }
     }
     this.initialized = false;
   }
 
+  selectAgent(agentId: string): void {
+    this.agentRenderer?.selectAgent(agentId);
+  }
+
+  selectAgents(agentIds: string[]): void {
+    this.agentRenderer?.selectAgents(agentIds);
+  }
+
+  selectRoom(roomId: string): void {
+    this.roomRenderer?.selectRoom(roomId);
+  }
+
+  clearSelection(): void {
+    this.agentRenderer?.clearSelection();
+    this.roomRenderer?.clearSelection();
+  }
+
+  setOnSelect(callback: (selection: { kind: string; id: string }) => void): void {
+    this.onSelectCallback = callback;
+  }
+
   // ─── 内部渲染方法 ──────────────────────────────────────────
 
   private renderRooms(rooms: RoomView[]): void {
     this.roomLayer.removeChildren();
     for (const room of rooms) {
       const g = new Graphics();
       const color = ROOM_COLORS[room.type] ?? 0x333333;
       g.rect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height)
         .fill({ color, alpha: 0.3 })
         .stroke({ color, width: 2 });
diff --git a/packages/pixel-office/src/renderer/agent-renderer.ts b/packages/pixel-office/src/renderer/agent-renderer.ts
index 0c07d0f..6ee256f 100644
--- a/packages/pixel-office/src/renderer/agent-renderer.ts
+++ b/packages/pixel-office/src/renderer/agent-renderer.ts
@@ -12,20 +12,21 @@ import { ROLE_COLORS, STATUS_COLORS } from "../design-tokens.js";
 
 const IDLE_BREATHE_PERIOD_MS = 1500;
 const WALK_MS_PER_TILE = 250;
 const TILE_SIZE_PX = 64;
 const WALK_FRAME_MS = 100;
 
 export interface AgentSprite {
   container: Container;
   nameText: Text;
   statusText: Text;
+  highlight?: Graphics;
   agentId: string;
   role: string;
   treatment: AgentVisualTreatment;
   currentState: AgentPresentationState;
   currentTexture: Texture | null;
   walkFrames: Texture[] | null;
   walkFrameIndex: number;
   walkTimer: number;
   lastRoomId: string | null;
   lastStatus: AgentView["status"];
@@ -58,38 +59,78 @@ interface AgentPosture {
 }
 
 export function resolveAgentTreatment(agent: AgentView): AgentVisualTreatment {
   return {
     bodyColor: ROLE_COLORS[agent.role] ?? 0xb8b0bc, // --base-300 fallback
     accentColor: STATUS_COLORS[agent.status] ?? 0x7d7682, // --base-400 fallback
     role: agent.role,
   };
 }
 
+const HIGHLIGHT_COLOR = 0xe6a85c;
+
 export class AgentRenderer {
   private sprites = new Map<string, AgentSprite>();
   private lastProjection: OfficeProjection | null = null;
   private lastLayout: RoomLayout | null = null;
   private reduceMotion = false;
+  private selectedIds = new Set<string>();
+
+  onSelectAgent?: (agentId: string) => void;
 
   constructor(
     private layer: Container,
     private assetLoader?: AssetLoader,
     reduceMotion?: boolean
   ) {
     this.reduceMotion = reduceMotion ?? false;
   }
 
   setReduceMotion(value: boolean): void {
     this.reduceMotion = value;
   }
 
+  selectAgent(agentId: string): void {
+    this.clearSelection();
+    this.selectedIds.add(agentId);
+    const sprite = this.sprites.get(agentId);
+    if (sprite) {
+      this.updateHighlight(sprite);
+    }
+  }
+
+  selectAgents(agentIds: string[]): void {
+    this.clearSelection();
+    for (const agentId of agentIds) {
+      this.selectedIds.add(agentId);
+      const sprite = this.sprites.get(agentId);
+      if (sprite) {
+        this.updateHighlight(sprite);
+      }
+    }
+  }
+
+  clearSelection(): void {
+    const previous = new Set(this.selectedIds);
+    this.selectedIds.clear();
+    for (const id of previous) {
+      const sprite = this.sprites.get(id);
+      if (sprite) {
+        this.removeHighlight(sprite);
+      }
+    }
+  }
+
+  getSelectedIds(): Set<string> {
+    return new Set(this.selectedIds);
+  }
+
   render(agents: AgentView[], layout: RoomLayout, projection: OfficeProjection): void {
     this.lastProjection = projection;
     this.lastLayout = layout;
 
     // 移除不存在的 agent
     for (const [id, sprite] of this.sprites) {
       if (!agents.find((a) => a.agentId === id)) {
         this.layer.removeChild(sprite.container);
         this.sprites.delete(id);
       }
@@ -124,20 +165,24 @@ export class AgentRenderer {
       text: agent.status,
       style: new TextStyle({ fontSize: 10, fill: 0xb8b0bc, fontFamily: "Inter, system-ui, sans-serif" }),
     });
     statusText.anchor.set(0.5, 0);
     statusText.y = 30;
 
     container.addChild(body);
     container.addChild(nameText);
     container.addChild(statusText);
 
+    container.eventMode = "static";
+    container.cursor = "pointer";
+    container.on("pointerdown", () => this.onSelectAgent?.(agent.agentId));
+
     return {
       container,
       nameText,
       statusText,
       agentId: agent.agentId,
       role: agent.role,
       treatment,
       currentState: "idle",
       currentTexture: null,
       walkFrames: null,
@@ -199,20 +244,45 @@ export class AgentRenderer {
       sprite.walkFrames = this.assetLoader?.getAnimationFrames(`${agent.role}-walk`, 2) ?? null;
       sprite.walkStartX = sprite.currentX;
       sprite.walkStartY = sprite.currentY;
       sprite.walkElapsed = 0;
       const distance = Math.hypot(sprite.targetX - sprite.currentX, sprite.targetY - sprite.currentY);
       sprite.walkDuration = distance === 0 ? 0 : (distance / TILE_SIZE_PX) * WALK_MS_PER_TILE;
     }
 
     sprite.lastStatus = agent.status;
     this.applyVisual(sprite, agent);
+    this.updateHighlight(sprite);
+  }
+
+  private updateHighlight(sprite: AgentSprite): void {
+    const isSelected = this.selectedIds.has(sprite.agentId);
+    if (!isSelected) {
+      this.removeHighlight(sprite);
+      return;
+    }
+    if (!sprite.highlight) {
+      sprite.highlight = new Graphics();
+      sprite.container.addChild(sprite.highlight);
+    }
+    const g = sprite.highlight;
+    g.clear();
+    g.rect(-20, -30, 40, 50)
+      .stroke({ color: HIGHLIGHT_COLOR, width: 2 })
+      .fill({ color: HIGHLIGHT_COLOR, alpha: 0.05 });
+  }
+
+  private removeHighlight(sprite: AgentSprite): void {
+    if (sprite.highlight) {
+      sprite.container.removeChild(sprite.highlight);
+      sprite.highlight = undefined;
+    }
   }
 
   private applyVisual(sprite: AgentSprite, agent: AgentView): void {
     const projection = this.lastProjection ?? this.emptyProjection();
     const computedState = computeAgentPresentationState(agent, projection);
     let visualState: AgentVisualState = sprite.currentState === "walk" ? "walk" : computedState;
     if (agent.status === "failed" && visualState !== "walk") {
       visualState = "failed";
     }
     const presentationState: AgentPresentationState = visualState === "failed" ? "blocked" : visualState;
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
diff --git a/packages/pixel-office/src/renderer/room-renderer.ts b/packages/pixel-office/src/renderer/room-renderer.ts
index 34367b2..69be346 100644
--- a/packages/pixel-office/src/renderer/room-renderer.ts
+++ b/packages/pixel-office/src/renderer/room-renderer.ts
@@ -18,27 +18,43 @@ const FLOOR_TEXTURE_NAMES: Record<string, string> = {
   execution: "floor-execution",
   review: "floor-review",
   approval_delivery: "floor-approval",
 };
 
 const WALL_COLOR = 0x3d3530; // --warm-700
 const SIGN_COLOR = 0x6b5f56; // --warm-500
 const SIGN_BORDER_COLOR = 0x3d3530; // --warm-700
 const SIGN_WIDTH = 150;
 const SIGN_HEIGHT = 18;
+const HIGHLIGHT_COLOR = 0xe6a85c;
 
 export class RoomRenderer {
+  private selectedIds = new Set<string>();
+
   constructor(
     private layer: Container,
     private assetLoader?: AssetLoader
   ) {}
 
+  selectRoom(roomId: string): void {
+    this.clearSelection();
+    this.selectedIds.add(roomId);
+  }
+
+  clearSelection(): void {
+    this.selectedIds.clear();
+  }
+
+  getSelectedIds(): Set<string> {
+    return new Set(this.selectedIds);
+  }
+
   render(layout: RoomLayout): void {
     this.layer.removeChildren();
 
     for (const room of layout.rooms) {
       this.drawRoom(room);
     }
   }
 
   private drawRoom(room: RoomLayoutEntry): void {
     const baseColor = FLOOR_COLORS[room.floorType] ?? 0x25222a; // --base-700 fallback
@@ -53,20 +69,25 @@ export class RoomRenderer {
       floor.width = room.width;
       floor.height = room.height;
       this.layer.addChild(floor);
     }
 
     const g = new Graphics();
     g.rect(room.x, room.y, room.width, room.height)
       .fill({ color: baseColor, alpha: floorTexture ? 0.15 : 0.4 })
       .stroke({ color: baseColor, width: 3 });
 
+    if (this.selectedIds.has(room.roomId)) {
+      g.rect(room.x - 2, room.y - 2, room.width + 4, room.height + 4)
+        .stroke({ color: HIGHLIGHT_COLOR, width: 4 });
+    }
+
     this.drawFloorPattern(g, room, patternColor, floorTexture ? 0.2 : 0.35);
     this.drawWalls(g, room, WALL_COLOR);
     this.drawSign(g, room, SIGN_COLOR);
 
     const label = new Text({
       text: room.name,
       style: new TextStyle({
         fontSize: 10,
         fill: 0xf2f0eb,
         fontFamily: '"Press Start 2P", monospace',
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
index 740a074..884fee0 100644
--- a/scripts/generate-annotated-comparisons.mjs
+++ b/scripts/generate-annotated-comparisons.mjs
@@ -5,90 +5,114 @@ import path from "node:path";
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
-      { x: 360, y: 220, label: "Rooms are flat color blocks; target: textured floors, wall lines, wooden doorway signs" },
-      { x: 560, y: 320, label: "Worker is a generic block; target: sturdy silhouette with tool belt + helmet, tool sparks" },
-      { x: 360, y: 560, label: "Missing props: workbench, task board, cable spool, cool task light" },
-      { x: 1090, y: 760, label: "Status badge is small green pill; target: --success badge + 'working' non-color cue (leaning posture)" },
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
-      { x: 360, y: 560, label: "Reviewer is generic block; target: slim silhouette with glasses + clipboard, page-flip activity" },
-      { x: 360, y: 760, label: "Review room lacks rug, round table, magnifying lamp, papers" },
-      { x: 1090, y: 760, label: "Status shows 'reviewing' but no approval-intent cue; target: clipboard page-flip + soft reading lamp" },
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
-      { x: 620, y: 420, label: "Approval/Delivery room missing service bell, counter, package slot, wall sconce" },
-      { x: 1090, y: 600, label: "Approval drawer lacks urgency border-left (--urgency 4px) and bell icon" },
-      { x: 1090, y: 640, label: "Approve/Reject buttons style mismatch; target: primary + danger with --radius-md" },
-      { x: 620, y: 420, label: "No pulsing service-bell glow on canvas counterpart" },
+      { x: 620, y: 420, label: "Approval cross-highlight is implemented; a dedicated selected-approval baseline is not yet captured." },
+      { x: 1090, y: 600, label: "Approve/Reject are decision outcomes; runtime failed/degraded states are out of scope for the mock adapter." },
+      { x: 1090, y: 320, label: "Selected / hovered card capture now exists for agent and task." },
+      { x: 360, y: 120, label: "Multi-resolution hardening: verify spacing and legibility." },
     ],
   },
   {
     name: "05-blocked-task-agent",
     title: "05 — Blocked Task / Agent",
     notes: [
-      { x: 560, y: 300, label: "Blocked agent has red ! but no slumped posture or frustration expression" },
-      { x: 560, y: 300, label: "Missing red pulse glow / speech bubble per design system" },
-      { x: 1090, y: 840, label: "Blocked badge color correct but missing --failure-dim background + error code" },
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
-      { x: 360, y: 420, label: "Revision state is visually indistinguishable from idle on canvas" },
-      { x: 1090, y: 600, label: "Artifact/task marked revision_required but lacks a rework cue (clipboard with red flag)" },
-      { x: 1090, y: 760, label: "Agent list shows idle; target: reviewer/worker posture indicating rework + revision badge" },
-      { x: 360, y: 560, label: "Note: mock adapter cannot independently trigger a true failed/runtime-error state" },
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
-      { x: 360, y: 420, label: "Focus overlay dims canvas but does not show ambient activity or compact urgent cards" },
-      { x: 1090, y: 640, label: "Urgent Summary cards exist but lack --urgency accents and count badges" },
-      { x: 1090, y: 420, label: "Right panel still shows full controls; target: collapsed 'Urgent Only' view" },
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
-      { x: 360, y: 120, label: "Debrief shows raw event timeline; target: Session Summary with metrics cards + Key timeline" },
-      { x: 1090, y: 640, label: "Summary cards present but not grouped as 'Session Summary'; missing approvals/artifacts metrics" },
-      { x: 360, y: 420, label: "No agent/room debrief visuals or heatmap on canvas" },
+      { x: 360, y: 120, label: "Session Summary + Key timeline are present; selected/hover states are not captured in debrief." },
+      { x: 1090, y: 640, label: "Multi-resolution layout: metrics cards and timeline should be audited at 1366×768 and 1920×1080." },
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
@@ -118,21 +142,21 @@ function buildHtml(item) {
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

## Added binary files

docs/design/swarm-office-v1.1/annotated-comparisons/09-selected-agent-annotated.png
docs/design/swarm-office-v1.1/annotated-comparisons/10-selected-task-card-annotated.png
docs/design/swarm-office-v1.1/baseline/1366x768/09-selected-agent.png
docs/design/swarm-office-v1.1/baseline/1366x768/10-selected-task-card.png
docs/design/swarm-office-v1.1/baseline/1440x900/09-selected-agent.png
docs/design/swarm-office-v1.1/baseline/1440x900/10-selected-task-card.png
docs/design/swarm-office-v1.1/baseline/1920x1080/09-selected-agent.png
docs/design/swarm-office-v1.1/baseline/1920x1080/10-selected-task-card.png
