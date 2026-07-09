# Task 1 review package v2

## Commits

7bf4242 fix(demo-office): address Task 1 review findings for Issue #25
a5c72cb feat(demo-office): bidirectional canvas/control-panel selection for Issue #25 Task 1

## Diff stat

 apps/demo-office/src/App.test.tsx                  | 352 ++++++++++++++++++++-
 apps/demo-office/src/App.tsx                       | 142 ++++++++-
 apps/demo-office/src/DemoControls.tsx              |   5 +-
 apps/demo-office/src/ListView.test.tsx             | 204 ++++++++++++
 apps/demo-office/src/ListView.tsx                  |  51 ++-
 .../2026-07-08-issue-25-swarm-office-follow-up.md  | 194 ++++++++++++
 docs/superpowers/plans/task-1-brief.md             |  63 ++++
 docs/superpowers/plans/task-1-report.md            | 131 ++++++++
 packages/control-ui/src/ControlPanel.test.tsx      |  68 ++++
 packages/control-ui/src/ControlPanel.tsx           | 101 +++++-
 .../src/components/ApprovalDrawer.test.tsx         |  52 +++
 .../control-ui/src/components/ApprovalDrawer.tsx   |  46 ++-
 packages/control-ui/src/components/Card.tsx        |  37 ++-
 packages/control-ui/src/control-panel.css          |  14 +
 .../src/__tests__/office-scene.test.ts             | 139 ++++++++
 packages/pixel-office/src/index.ts                 |   1 +
 packages/pixel-office/src/office-scene.ts          |  22 ++
 .../pixel-office/src/renderer/agent-renderer.ts    |  64 ++++
 .../pixel-office/src/renderer/room-renderer.ts     |  21 ++
 packages/pixel-office/src/selection.ts             |   6 +
 20 files changed, 1676 insertions(+), 37 deletions(-)

## Full diff

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
 
diff --git a/apps/demo-office/src/ListView.test.tsx b/apps/demo-office/src/ListView.test.tsx
new file mode 100644
index 0000000..9da3c26
--- /dev/null
+++ b/apps/demo-office/src/ListView.test.tsx
@@ -0,0 +1,204 @@
+// @vitest-environment jsdom
+
+import "@testing-library/jest-dom/vitest";
+import React from "react";
+import { render, screen, fireEvent } from "@testing-library/react";
+import { describe, it, expect, vi, beforeEach } from "vitest";
+import { ListView } from "./ListView.js";
+import type { OfficeProjection } from "@agent-office/protocol";
+import type { OfficeSelection } from "@agent-office/pixel-office";
+
+const baseProjection: OfficeProjection = {
+  agents: [
+    {
+      agentId: "agent-1",
+      name: "Orchestrator",
+      role: "orchestrator",
+      status: "idle",
+      currentTaskId: null,
+      currentRoomId: "room-1",
+      blockedReason: null,
+    },
+    {
+      agentId: "agent-2",
+      name: "Worker",
+      role: "worker",
+      status: "working",
+      currentTaskId: "task-1",
+      currentRoomId: "room-2",
+      blockedReason: null,
+    },
+  ],
+  tasks: [
+    {
+      taskId: "task-1",
+      title: "Write report",
+      description: "",
+      status: "running",
+      priority: "high",
+      assigneeId: "agent-2",
+      roomId: "room-2",
+      artifactIds: [],
+      approvalId: null,
+      blockedReason: null,
+    },
+  ],
+  artifacts: [
+    {
+      artifactId: "art-1",
+      taskId: "task-1",
+      producerAgentId: "agent-2",
+      type: "document",
+      title: "report.md",
+      status: "generated",
+      version: 1,
+      reviewResult: null,
+    },
+  ],
+  approvals: [
+    {
+      approvalId: "approval-1",
+      taskId: "task-1",
+      kind: "artifact_delivery",
+      status: "requested",
+      requestedBy: "agent-2",
+      reason: "Deliver report",
+    },
+  ],
+  rooms: [
+    {
+      roomId: "room-1",
+      name: "Command",
+      type: "command",
+      bounds: { x: 0, y: 0, width: 200, height: 150 },
+      activeAgentIds: ["agent-1"],
+    },
+    {
+      roomId: "room-2",
+      name: "Execution",
+      type: "execution",
+      bounds: { x: 220, y: 0, width: 200, height: 150 },
+      activeAgentIds: ["agent-2"],
+    },
+  ],
+  pendingApprovals: [
+    {
+      approvalId: "approval-1",
+      taskId: "task-1",
+      kind: "artifact_delivery",
+      status: "requested",
+      requestedBy: "agent-2",
+      reason: "Deliver report",
+    },
+  ],
+  blockedTasks: [],
+  errors: [],
+};
+
+function renderListView(
+  overrides: Partial<React.ComponentProps<typeof ListView>> = {}
+) {
+  const props: React.ComponentProps<typeof ListView> = {
+    projection: baseProjection,
+    selection: null,
+    onSelect: vi.fn(),
+    ...overrides,
+  };
+  return { ...render(<ListView {...props} />), props };
+}
+
+describe("ListView", () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+  });
+
+  it("renders agents, tasks, artifacts, approvals and rooms", () => {
+    renderListView();
+    expect(screen.getByText("Orchestrator")).toBeInTheDocument();
+    expect(screen.getByText("Write report")).toBeInTheDocument();
+    expect(screen.getByText("report.md")).toBeInTheDocument();
+    expect(screen.getByText("approval-1")).toBeInTheDocument();
+    expect(screen.getByRole("button", { name: "Select room Command" })).toBeInTheDocument();
+  });
+
+  it("calls onSelect when clicking an agent row", () => {
+    const { props } = renderListView();
+    const row = screen.getByText("Orchestrator").closest("tr");
+    expect(row).toBeInTheDocument();
+    fireEvent.click(row!);
+    expect(props.onSelect).toHaveBeenCalledWith({
+      kind: "agent",
+      id: "agent-1",
+    });
+  });
+
+  it("calls onSelect when clicking a task row", () => {
+    const { props } = renderListView();
+    const row = screen.getByText("Write report").closest("tr");
+    fireEvent.click(row!);
+    expect(props.onSelect).toHaveBeenCalledWith({
+      kind: "task",
+      id: "task-1",
+    });
+  });
+
+  it("calls onSelect when clicking an artifact row", () => {
+    const { props } = renderListView();
+    const row = screen.getByText("report.md").closest("tr");
+    fireEvent.click(row!);
+    expect(props.onSelect).toHaveBeenCalledWith({
+      kind: "artifact",
+      id: "art-1",
+    });
+  });
+
+  it("calls onSelect when clicking an approval row", () => {
+    const { props } = renderListView();
+    const row = screen.getByText("approval-1").closest("tr");
+    fireEvent.click(row!);
+    expect(props.onSelect).toHaveBeenCalledWith({
+      kind: "approval",
+      id: "approval-1",
+    });
+  });
+
+  it("calls onSelect when clicking a room card", () => {
+    const { props } = renderListView();
+    const card = screen.getByRole("button", { name: "Select room Command" });
+    fireEvent.click(card);
+    expect(props.onSelect).toHaveBeenCalledWith({
+      kind: "room",
+      id: "room-1",
+    });
+  });
+
+  it("marks the selected row with highlight attributes", () => {
+    const selection: OfficeSelection = { kind: "agent", id: "agent-1" };
+    renderListView({ selection });
+    const row = screen.getByText("Orchestrator").closest("tr");
+    expect(row).toHaveAttribute("aria-selected", "true");
+    expect(row?.classList.contains("list-view__row--selected")).toBe(true);
+  });
+
+  it("supports Enter key selection on a focused row", () => {
+    const { props } = renderListView();
+    const row = screen.getByText("Worker").closest("tr");
+    row!.focus();
+    fireEvent.keyDown(row!, { key: "Enter" });
+    expect(props.onSelect).toHaveBeenCalledWith({
+      kind: "agent",
+      id: "agent-2",
+    });
+  });
+
+  it("supports Space key selection on a focused row", () => {
+    const { props } = renderListView();
+    const row = screen.getByText("Write report").closest("tr");
+    row!.focus();
+    fireEvent.keyDown(row!, { key: " " });
+    expect(props.onSelect).toHaveBeenCalledWith({
+      kind: "task",
+      id: "task-1",
+    });
+  });
+});
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
diff --git a/docs/superpowers/plans/2026-07-08-issue-25-swarm-office-follow-up.md b/docs/superpowers/plans/2026-07-08-issue-25-swarm-office-follow-up.md
new file mode 100644
index 0000000..ff70e47
--- /dev/null
+++ b/docs/superpowers/plans/2026-07-08-issue-25-swarm-office-follow-up.md
@@ -0,0 +1,194 @@
+# Issue #25: Swarm Office V1.1 follow-up — linked selection, artifact truth, and current-state visual QA
+
+## Context
+
+Issue #23 was implemented by PR #24, closing the first Swarm Office V1.1 visual pass (canvas foundation, role sprites, mode polish, revision/failed naming correction, and multi-resolution screenshot capture).
+
+Issue #14 remains open as the parent V1.1 epic. This plan covers the remaining #14 work that PR #24 deliberately left out.
+
+## Goal
+
+Make the pixel canvas and control panel behave as one selectable surface, ensure artifact/task states are rendered truthfully without invented content, and turn visual QA into a current-state regression gate.
+
+## Global constraints
+
+- Scope is strictly:
+  - `apps/demo-office`
+  - `packages/pixel-office`
+  - `scripts/`
+  - `docs/design/swarm-office-v1.1/`
+- Do not change protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport. If a feature truly needs protocol support, create a separate protocol-proposal issue first.
+- Selection is presentation-only. It must never mutate Runtime Snapshot, LifeSim state, commands, reducers, or domain facts.
+- `artifactId` is not a URI. Missing content reference must render metadata-only / unavailable / unsupported-open; never fabricate content.
+- The final PR description must use `Closes #25` and `Refs #14`. Do not close #14 unless every #14 acceptance criterion is explicitly satisfied.
+
+## Task 0: Current-state evidence cleanup
+
+Before adding new UI behavior, clean up stale audit annotations so the team is working from the current product state rather than pre-PR #24 gaps.
+
+Files: `docs/design/swarm-office-v1.1/gap-audit.md`, `scripts/generate-annotated-comparisons.mjs`
+
+Requirements:
+
+- Rewrite `gap-audit.md` so pre-PR #24 findings (e.g., "idle canvas is blank black", "mode switcher is plain text") are moved to a "Historical V1.0 → V1.1 delta" section.
+- Add a "Current-state audit" section that lists remaining gaps after PR #24: linked selection, truthful artifact states, multi-resolution layout, selected/hovered state capture, runtime degraded/failed capture limitations.
+- Update `generate-annotated-comparisons.mjs` annotation labels to describe current gaps, not already-fixed V1.0 gaps.
+- Add an explicit "Accepted deviations" note documenting that the mock adapter cannot independently trigger a genuine runtime `failed` / runtime-error state, so screenshots for those states are only captured if the adapter truthfully supports them.
+- Canonicalize paths so multi-resolution folders (`baseline/1366x768`, `baseline/1440x900`, `baseline/1920x1080`) are the source of truth and the old flat `baseline/` files stay deleted.
+
+Verification:
+
+- `npm test` still passes after documentation-only changes.
+- `npm run build` passes.
+
+## Task 1: Canvas / control-panel linked selection
+
+Implement bidirectional, presentation-only selection between the pixel scene and the React control surface.
+
+Files:
+
+- `apps/demo-office/src/App.tsx` — add selection state and wire callbacks
+- `apps/demo-office/src/useComposedOfficeState.ts` or a new local hook — keep selection out of Runtime state
+- `apps/demo-office/src/ControlPanel.tsx` — accept selection props, highlight cards, support keyboard/list selection
+- `packages/pixel-office/src/office-scene.ts` — expose selection API
+- `packages/pixel-office/src/renderer/agent-renderer.ts` — render selected/highlight outline
+- `packages/pixel-office/src/renderer/room-renderer.ts` — render selected/highlight outline
+- `apps/demo-office/src/ListView.tsx` — support selecting entities from list view
+
+Selection shape:
+
+```ts
+interface OfficeSelection {
+  kind: "agent" | "task" | "artifact" | "approval" | "room";
+  id: string;
+}
+```
+
+Requirements:
+
+- Selecting an agent on the pixel canvas highlights the matching agent card in the panel and scrolls it into view.
+- Selecting a task/artifact/approval card in the panel highlights the related agent(s) and/or room on the canvas when the relation exists.
+- Selecting a room highlights the room and relevant active agents.
+- Selection is presentation-only; no commands are sent and no Runtime/LifeSim state changes.
+- Selection survives Command ↔ Focus ↔ Debrief mode switches and Pixel ↔ List view switches as long as the selected entity exists.
+- Selection clears only on:
+  - explicit "Clear selection" action,
+  - Reset / adapter reset,
+  - entity disappearance from the projection.
+- Provide a keyboard-accessible path: Tab into the panel cards, Enter/Space to select, Escape to clear.
+- Highlight must not be color-only (add outline, ring, or label change).
+- In List view, selecting an entity row highlights it and, when switched back to Pixel view, the canvas shows the same selection.
+
+Verification:
+
+- New/updated tests:
+  - `apps/demo-office/src/App.test.tsx` — selection state survives mode/view switches and clears on Reset
+  - `apps/demo-office/src/ControlPanel.test.tsx` — clicking a card calls onSelect; selected card has highlight attributes
+  - `packages/pixel-office/src/__tests__/office-scene.test.ts` — calling scene.selectAgent / scene.selectRoom renders highlight outline
+  - `apps/demo-office/src/ListView.test.tsx` — list selection highlights row and is reflected externally
+- All existing tests still pass.
+
+## Task 2: Truthful artifact and outcome states
+
+Make artifact/task/review outcomes exact and non-invented.
+
+Files:
+
+- `apps/demo-office/src/ControlPanel.tsx` — artifact card state classification and rendering
+- `apps/demo-office/src/components/intents.ts` — add `revision_required` / `rejected` distinct intents if missing
+- `apps/demo-office/src/theme.css` — add rework / rejected / unavailable styles
+- `packages/pixel-office/src/presentation-state.ts` and renderers — truthful agent posture mapping
+- `packages/pixel-office/src/renderer/effect-renderer.ts` — add rework cue for revision_required artifacts
+
+Requirements:
+
+- `revision_required` renders a rework cue (red-flag clipboard, "rework" badge) distinct from `rejected`, `blocked`, and `failed`.
+- `rejected` renders as a decision outcome, not a runtime failure.
+- `blocked` agents keep slumped posture + red pulse + speech bubble; panel card shows blocker reason when available.
+- `failed` agents/tasks render only when backed by real Runtime/session or domain failure state.
+- Artifact cards explicitly represent these content states:
+  - `content-available` — `content` or `uri` present and openable
+  - `metadata-only` — no `content` and no `uri`
+  - `unavailable` — `uri === null` (explicitly unavailable)
+  - `loading` — open command in flight
+  - `failed-open` — `ARTIFACT_OPEN` command returned an error
+  - `unsupported-open` — adapter does not support `ARTIFACT_OPEN`
+- Do not label `artifactId` as a URI.
+- If an artifact lacks a content reference, show metadata-only/unavailable UI; do not invent content.
+
+Verification:
+
+- New/updated tests:
+  - `apps/demo-office/src/ControlPanel.test.tsx` — revision_required artifact shows rework badge; rejected shows distinct rejected badge; unavailable shows unavailable message; unsupported disables View button with correct title
+  - `packages/pixel-office/src/__tests__/agent-renderer.test.ts` — blocked agent renders blocked posture/speech bubble; failed agent only renders when status is failed
+  - `packages/pixel-office/src/__tests__/effect-renderer.test.ts` — revision_required produces rework cue
+- All existing tests still pass.
+
+## Task 3: Visual QA hardening
+
+Turn the screenshot pipeline into a current-state regression gate.
+
+Files:
+
+- `scripts/capture-demo-office-screenshots.mjs`
+- `scripts/generate-annotated-comparisons.mjs`
+- `docs/design/swarm-office-v1.1/gap-audit.md`
+- `docs/design/swarm-office-v1.1/baseline/`
+- `docs/design/swarm-office-v1.1/annotated-comparisons/`
+
+Requirements:
+
+- Capture baseline sets for 1366×768, 1440×900, and 1920×1080.
+- Include existing 8 states plus:
+  - selected agent on canvas + highlighted panel card
+  - hovered/selected task or artifact card
+  - artifact metadata-only / unavailable / unsupported-open state
+  - runtime degraded state if the adapter can truthfully produce it
+  - runtime failed state only if the adapter can truthfully produce it; otherwise document the limitation
+- Add script-level assertions:
+  - each PNG width equals the viewport width for the resolution
+  - each PNG height equals the viewport height (or fullPage height if fullPage remains enabled)
+  - page `scrollWidth <= clientWidth` for the target viewport (no horizontal overflow)
+- If a state cannot be truthfully produced by the mock adapter, skip it with a logged reason rather than fabricating it.
+- Regenerate annotated comparisons from the 1440×900 baseline with current-gap labels.
+- Update `gap-audit.md` with a "Resolution pass" section and any newly discovered per-resolution gaps.
+
+Verification:
+
+- Running `node scripts/capture-demo-office-screenshots.mjs` succeeds and asserts dimensions/overflow.
+- Running `node scripts/generate-annotated-comparisons.mjs` succeeds.
+- `npm test` and `npm run build` pass.
+
+## Task 4: Tests and verification
+
+Ensure all new behavior has failing-first tests and the full suite stays green.
+
+Requirements:
+
+- Every new function/method has a test.
+- Each test was watched to fail for the expected reason before implementation.
+- Full `npm test` passes (target: 58+ files, all green).
+- `npm run build` passes.
+- GitHub CI `build-test` passes.
+
+## Task 5: Final review and PR
+
+- Run final whole-branch review using the code-reviewer template.
+- Fix any Critical/Important findings.
+- Create PR with `Closes #25` and `Refs #14`.
+- Wait for CI green, then merge.
+- Delete the feature branch.
+
+## Acceptance criteria (roll-up)
+
+- [ ] PR starts with current-state evidence cleanup, not stale annotations.
+- [ ] Linked selection works for agents, rooms, tasks, artifacts, and approvals when relationships exist.
+- [ ] Selection is presentation-only and preserves Runtime/LifeSim truth boundaries.
+- [ ] Selection survives mode/view switches and clears only on explicit clear, Reset, or entity disappearance.
+- [ ] `revision_required`, `rejected`, `blocked`, and `failed` are visually distinct on canvas and panel.
+- [ ] Artifact cards truthfully represent content available, metadata-only, unavailable, loading, failed-open, and unsupported-open states as supported by current data.
+- [ ] Visual QA covers required resolutions and does not claim impossible states.
+- [ ] Screenshot script includes dimension and overflow assertions.
+- [ ] `gap-audit.md` reflects current post-PR #24 state and remaining gaps.
+- [ ] `npm test`, `npm run build`, and GitHub CI pass.
+- [ ] PR description uses `Closes #25` and `Refs #14`; #14 stays open unless all its acceptance criteria are satisfied.
diff --git a/docs/superpowers/plans/task-1-brief.md b/docs/superpowers/plans/task-1-brief.md
new file mode 100644
index 0000000..d7b471b
--- /dev/null
+++ b/docs/superpowers/plans/task-1-brief.md
@@ -0,0 +1,63 @@
+# Task 1: Canvas / control-panel linked selection
+
+## Where this fits
+
+This is Task 1 of Issue #25 (Swarm Office V1.1 follow-up). Task 0 established the current-state audit. This task adds bidirectional, presentation-only selection between the pixel canvas and the React control surface.
+
+## Requirements
+
+Files to modify:
+
+- `apps/demo-office/src/App.tsx` — add selection state and wire callbacks
+- `apps/demo-office/src/useComposedOfficeState.ts` or a new local hook — keep selection out of Runtime state
+- `apps/demo-office/src/ControlPanel.tsx` — accept selection props, highlight cards, support keyboard/list selection
+- `packages/pixel-office/src/office-scene.ts` — expose selection API
+- `packages/pixel-office/src/renderer/agent-renderer.ts` — render selected/highlight outline
+- `packages/pixel-office/src/renderer/room-renderer.ts` — render selected/highlight outline
+- `apps/demo-office/src/ListView.tsx` — support selecting entities from list view
+
+Selection shape:
+
+```ts
+interface OfficeSelection {
+  kind: "agent" | "task" | "artifact" | "approval" | "room";
+  id: string;
+}
+```
+
+Behavior:
+
+- Selecting an agent on the pixel canvas highlights the matching agent card in the panel and scrolls it into view.
+- Selecting a task/artifact/approval card in the panel highlights the related agent(s) and/or room on the canvas when the relation exists.
+- Selecting a room highlights the room and relevant active agents.
+- Selection is presentation-only; no commands are sent and no Runtime/LifeSim state changes.
+- Selection survives Command ↔ Focus ↔ Debrief mode switches and Pixel ↔ List view switches as long as the selected entity exists.
+- Selection clears only on:
+  - explicit "Clear selection" action,
+  - Reset / adapter reset,
+  - entity disappearance from the projection.
+- Provide a keyboard-accessible path: Tab into the panel cards, Enter/Space to select, Escape to clear.
+- Highlight must not be color-only (add outline, ring, or label change).
+- In List view, selecting an entity row highlights it and, when switched back to Pixel view, the canvas shows the same selection.
+
+## Constraints
+
+- Do not change protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport.
+- Selection must never mutate Runtime Snapshot, LifeSim state, commands, reducers, or domain facts.
+- Keep PR relationship: Issue #25 Refs #14.
+- Follow TDD: write the failing test first, watch it fail, then implement.
+
+## Verification
+
+New/updated tests:
+
+- `apps/demo-office/src/App.test.tsx` — selection state survives mode/view switches and clears on Reset
+- `apps/demo-office/src/ControlPanel.test.tsx` — clicking a card calls onSelect; selected card has highlight attributes
+- `packages/pixel-office/src/__tests__/office-scene.test.ts` — calling scene.selectAgent / scene.selectRoom renders highlight outline
+- `apps/demo-office/src/ListView.test.tsx` — list selection highlights row and is reflected externally
+
+All existing tests must still pass. `npm run build` must pass.
+
+## Report
+
+Write a report to `docs/superpowers/plans/task-1-report.md` with status (DONE or BLOCKED), commits, test summary, and any concerns.
diff --git a/docs/superpowers/plans/task-1-report.md b/docs/superpowers/plans/task-1-report.md
new file mode 100644
index 0000000..0b23110
--- /dev/null
+++ b/docs/superpowers/plans/task-1-report.md
@@ -0,0 +1,131 @@
+# Task 1 报告：Canvas / control-panel linked selection
+
+## 状态
+
+DONE
+
+## 提交
+
+本次改动已提交（未 push）：
+
+- `feat(demo-office): bidirectional canvas/control-panel selection for Issue #25 Task 1`
+  - 初始 Task 1 实现：task/artifact/approval 选择映射到相关 agent/room 高亮，Reset / adapter reset 显式清除选择。
+
+- `fix(demo-office): address Task 1 review findings for Issue #25`
+  - 修复评审发现的 Important / Minor 问题：renderer 单选语义、房间选择高亮活跃 agent、面板卡片滚动到视图、approval 卡片可选中、清理死代码，并补充对应测试。
+
+## 初始实现修改文件
+
+- `packages/pixel-office/src/selection.ts`（新增）
+  - 定义共享 `OfficeSelection` 类型：`kind: "agent" | "task" | "artifact" | "approval" | "room"`，`id: string`。
+  - 从 `packages/pixel-office/src/index.ts` 导出。
+
+- `packages/pixel-office/src/office-scene.ts`
+  - 暴露 `selectAgent(agentId)`、`selectRoom(roomId)`、`clearSelection()`、`setOnSelect(callback)` API。
+
+- `packages/pixel-office/src/renderer/agent-renderer.ts`
+  - 新增 `selectedIds` 集合与高亮描边渲染。
+  - 实现 `selectAgent` / `clearSelection`，高亮使用轮廓+半透明填充，非仅颜色。
+
+- `packages/pixel-office/src/renderer/room-renderer.ts`
+  - 新增 `selectedIds` 集合，绘制房间高亮外框。
+
+- `packages/control-ui/src/components/Card.tsx`
+  - 增加 `selected`、`selectable`、`ariaLabel`、`onKeyDown` 支持。
+  - 可被选中的卡片具备 `role="button"`、`aria-pressed`、Tab 聚焦能力。
+
+- `packages/control-ui/src/ControlPanel.tsx`
+  - 接收 `selection` 与 `onSelect` props。
+  - Agent / Task / Artifact 卡片支持点击与 Enter/Space 键盘选择。
+  - 选中卡片显示 `card--selected` 样式与 `aria-pressed`。
+
+- `packages/control-ui/src/control-panel.css`
+  - 新增选中态样式（outline + ring），满足非颜色唯一提示的要求。
+
+- `apps/demo-office/src/ListView.tsx`
+  - 接收 `selection` 与 `onSelect` props。
+  - Agent / Task / Artifact / Approval / Room 行支持点击、Enter/Space 键盘选择、`aria-selected`。
+
+- `apps/demo-office/src/ListView.test.tsx`（新增）
+  - 覆盖列表渲染、行选择、键盘选择、`aria-selected` 状态。
+
+- `apps/demo-office/src/App.tsx`
+  - 使用 `useState` 管理 `OfficeSelection | null`，不侵入 Runtime/LifeSim 状态。
+  - 将 `selection` / `onSelect` 传给 `ControlPanel` 与 `ListView`。
+  - 注册场景 `setOnSelect` 回调，实现画布到面板的单向同步。
+  - 新增 `resolveCanvasSelection`：将 task / artifact / approval 选择按 projection 关系解析为相关 agent / room，优先 agent（assignee / producer / requestedBy），其次 room（task.roomId），无关联时返回 `null`。
+  - `useEffect` 将当前选择同步到 `PixelOfficeScene`（agent / room / clear）。
+  - 新建场景时立即应用当前选择，保证 Pixel ↔ List 视图切换后高亮不丢失。
+  - 选择实体从 projection 中消失时自动清除选择。
+  - `Escape` 全局监听清除选择。
+  - 通过 `React.cloneElement` 为 `demoControls` 注入 `onReset` 回调，在 adapter / store reset 后显式清空选择。
+
+- `apps/demo-office/src/DemoControls.tsx`
+  - 新增可选 `onReset` prop；在 `handleReset` 中 adapter.reset() 与 store.reset() 之后调用 `onReset?.()`。
+
+- `apps/demo-office/src/App.test.tsx`
+  - 新增 App selection 测试套件，覆盖模式/视图切换、实体消失清除、Escape 清除、画布回调、task/artifact/approval 关系映射、Reset 清除。
+
+- `packages/pixel-office/src/__tests__/office-scene.test.ts`
+  - 补充 `selectAgent` / `selectRoom` 渲染高亮轮廓的断言。
+
+- `packages/control-ui/src/ControlPanel.test.tsx`
+  - 补充卡片点击、Enter/Space 键盘选择、选中高亮属性的测试。
+
+## 评审修复修改文件
+
+- `packages/pixel-office/src/renderer/agent-renderer.ts`
+  - `selectAgent` 现在先 `clearSelection()`，确保切换 agent 时不会残留多个高亮。
+  - 新增 `selectAgents(agentIds)`，支持一次性高亮多个 agent（用于房间选择时高亮全部活跃 agent）。
+
+- `packages/pixel-office/src/renderer/room-renderer.ts`
+  - `selectRoom` 现在先 `clearSelection()`，确保切换房间时不会残留多个高亮。
+
+- `packages/pixel-office/src/office-scene.ts`
+  - 暴露 `selectAgents(agentIds)` API，转发给 `AgentRenderer`。
+
+- `apps/demo-office/src/App.tsx`
+  - 提取 `applyCanvasSelection` 回调，统一在场景初始化和同步 effect 中应用选择。
+  - 应用新选择前始终调用 `scene.clearSelection()`，避免旧高亮残留。
+  - 当 canvas 选择为 room 时，先 `selectRoom(roomId)`，再 `selectAgents(room.activeAgentIds)` 高亮房间内所有活跃 agent。
+  - 删除未使用的 `prevSelectionRef`。
+
+- `packages/control-ui/src/components/Card.tsx`
+  - 使用 `React.forwardRef` 支持外部 ref，用于滚动定位。
+
+- `packages/control-ui/src/ControlPanel.tsx`
+  - 为 Agent / Task / Artifact / Approval 卡片维护 `cardRefs` 映射。
+  - `useEffect` 在 `selection` 变化时，将匹配卡片 `scrollIntoView({ behavior: "smooth", block: "nearest" })`。
+  - 向 `ApprovalDrawer` 传递 `selection`、`onSelect` 以及每张 approval 卡片的 ref 回调。
+
+- `packages/control-ui/src/components/ApprovalDrawer.tsx`
+  - 新增 `selection`、`onSelect`、`cardRef` props。
+  - approval `Card` 支持选中态（`aria-pressed`、TabIndex、Enter/Space 键盘选择）。
+  - Approve / Reject 按钮阻止事件冒泡，避免触发卡片选择。
+
+- `packages/pixel-office/src/__tests__/office-scene.test.ts`
+  - 新增测试：renderer 在选中新 agent / room 时会清除之前的高亮。
+
+- `apps/demo-office/src/App.test.tsx`
+  - 新增测试：选择 room 时调用 `selectRoom` 和 `selectAgents` 高亮活跃 agent。
+  - 更新 `PixelOfficeScene` mock，加入 `selectAgents`。
+
+- `packages/control-ui/src/ControlPanel.test.tsx`
+  - 新增测试：选中卡片变化时调用 `scrollIntoView`。
+
+- `packages/control-ui/src/components/ApprovalDrawer.test.tsx`
+  - 新增测试：approval 卡片点击 / Enter 键盘触发 `onSelect`，选中态具备 `aria-pressed` 与 `card--selected`。
+
+## 验证结果
+
+- `npm test -- --run`：59 个测试文件，637 个测试全部通过。
+- `npm run build`：TypeScript 与 demo-office Vite 构建均通过（仅有大于 500kB chunk 的常规警告）。
+
+## 注意事项
+
+- 协议类型、reducer、LifeSimEngine、RuntimeSession 与后端传输均未改动。
+- 选择状态为纯展示性质，不会发送任何命令或修改 Runtime Snapshot / LifeSim 状态。
+- task / artifact / approval 的选择已按 projection 关系映射到相关 agent / room 高亮；无关联时清空画布高亮但保留面板选择。
+- room 选择现在会同时高亮房间及其全部活跃 agent（通过 `selectAgents`）。
+- Reset / adapter reset 已通过 `DemoControls.onReset` 回调显式清空选择。
+- 未执行 `git push`。
diff --git a/packages/control-ui/src/ControlPanel.test.tsx b/packages/control-ui/src/ControlPanel.test.tsx
index b3ea61e..32e87a1 100644
--- a/packages/control-ui/src/ControlPanel.test.tsx
+++ b/packages/control-ui/src/ControlPanel.test.tsx
@@ -549,10 +549,78 @@ describe("ControlPanel", () => {
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
index 50d9bdc..0f447ad 100644
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
+import { useState, useEffect, useRef, type FC } from "react";
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
@@ -32,29 +33,33 @@ interface ControlPanelProps {
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
 
   const isSupported = (cmdType: string): boolean =>
     capabilities ? capabilities.supportedCommands.includes(cmdType) : true;
 
   const runAction = async (key: string, fn: () => Promise<void>): Promise<void> => {
     setActionErrors((prev) => {
       const next = { ...prev };
@@ -132,20 +137,61 @@ export const ControlPanel: FC<ControlPanelProps> = ({
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
+  const setCardRef =
+    (kind: OfficeSelection["kind"], id: string) =>
+    (el: HTMLDivElement | null): void => {
+      const key = `${kind}:${id}`;
+      if (el) {
+        cardRefs.current.set(key, el);
+      } else {
+        cardRefs.current.delete(key);
+      }
+    };
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
@@ -158,99 +204,127 @@ export const ControlPanel: FC<ControlPanelProps> = ({
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
+                selectable={Boolean(onSelect) || selection !== null}
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
+                selectable={Boolean(onSelect) || selection !== null}
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
@@ -268,39 +342,50 @@ export const ControlPanel: FC<ControlPanelProps> = ({
                 // NOTE: art.status is intentionally not used for content-state classification.
                 // The current ArtifactStatus union has no explicit content_unavailable/load_failed
                 // values; we use art.uri === null and actionErrors for those states instead.
                 const artifactOpenSupported = isSupported(CommandType.ARTIFACT_OPEN);
                 const hasContent = Boolean(art.content);
                 const hasUri = Boolean(art.uri);
                 const canOpen = artifactOpenSupported && (hasContent || hasUri);
                 const openError = actionErrors[`open-${art.artifactId}`];
 
                 return (
-                  <Card key={art.artifactId}>
+                  <Card
+                    key={art.artifactId}
+                    ref={setCardRef("artifact", art.artifactId)}
+                    selectable={Boolean(onSelect) || selection !== null}
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
                         title={
                           !artifactOpenSupported
                             ? "Unsupported by adapter"
                             : !hasContent && !hasUri
                               ? "Metadata only — content not loaded."
                               : undefined
                         }
                       >
                         View
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
diff --git a/packages/control-ui/src/control-panel.css b/packages/control-ui/src/control-panel.css
index aa661dd..0b02423 100644
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
diff --git a/packages/pixel-office/src/__tests__/office-scene.test.ts b/packages/pixel-office/src/__tests__/office-scene.test.ts
index 9896f2c..1ca10db 100644
--- a/packages/pixel-office/src/__tests__/office-scene.test.ts
+++ b/packages/pixel-office/src/__tests__/office-scene.test.ts
@@ -673,10 +673,149 @@ describe("PixelOfficeScene legacy renderer animations", () => {
 
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
index 6559390..2439d69 100644
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
@@ -222,20 +223,41 @@ export class PixelOfficeScene {
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
index 0c07d0f..26cf388 100644
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
@@ -58,38 +59,76 @@ interface AgentPosture {
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
@@ -199,20 +238,45 @@ export class AgentRenderer {
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
diff --git a/packages/pixel-office/src/selection.ts b/packages/pixel-office/src/selection.ts
new file mode 100644
index 0000000..d4a4123
--- /dev/null
+++ b/packages/pixel-office/src/selection.ts
@@ -0,0 +1,6 @@
+export type OfficeSelectionKind = "agent" | "task" | "artifact" | "approval" | "room";
+
+export interface OfficeSelection {
+  kind: OfficeSelectionKind;
+  id: string;
+}
