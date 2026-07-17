/**
 * App — demo-office 的根组件。
 *
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
import React, {
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
import type { AdapterCapabilities, OfficeProjection, RuntimeAdapter } from "@agent-office/protocol";
import {
  ControlPanel,
  type ExperienceMode,
} from "@agent-office/control-ui";
import {
  LifeSimControlPanel,
  type LifeSimSession,
} from "@agent-office/control-ui/life-sim";
import {
  PixelOfficeScene,
  type OfficeSelection,
} from "@agent-office/pixel-office";
import { ListView } from "./ListView.js";
import { DebriefTimeline } from "./DebriefTimeline.js";
import { FocusModeIndicator } from "./FocusModeIndicator.js";
import { StatusStrip } from "./StatusStrip.js";
import { useComposedOfficeState } from "./useComposedOfficeState.js";

interface AppProps {
  session: RuntimeSession;
  store: SnapshotStore;
  gateway: CommandGateway;
  runtimeId: string;
  /** Runtime adapter used to project integration state. */
  adapter: RuntimeAdapter;
  /** Adapter capabilities — used to disable unsupported command buttons. */
  capabilities?: AdapterCapabilities;
  /** 演示层专用控件（如 DemoControls），由装配层 main.tsx 注入。
   *  App 本身不依赖任何 Mock 专用类型。 */
  demoControls?: ReactNode;
  /** Whether the Runtime Composition can be rebuilt without a full page reload. */
  retryable?: boolean;
  /** Called when the user chooses Retry from the status strip. */
  onRetry?: () => void;
  /** Active LifeSim session rendered by the control panel. */
  lifeSimSession: LifeSimSession;
  /** World identifier used when sending LifeSim commands. */
  lifeSimWorldId?: string;
}

type ViewMode = "pixel" | "list";

const EXPERIENCE_MODES: ExperienceMode[] = ["command", "focus", "debrief"];

function formatModeLabel(mode: ExperienceMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

type CanvasSelection = { kind: "agent" | "room"; id: string } | null;

function resolveCanvasSelection(
  selection: OfficeSelection | null,
  projection: OfficeProjection
): CanvasSelection {
  if (!selection) return null;

  if (selection.kind === "agent") {
    return { kind: "agent", id: selection.id };
  }

  if (selection.kind === "room") {
    return { kind: "room", id: selection.id };
  }

  if (selection.kind === "task") {
    const task = projection.tasks.find((t) => t.taskId === selection.id);
    if (task?.assigneeId) return { kind: "agent", id: task.assigneeId };
    if (task?.roomId) return { kind: "room", id: task.roomId };
    return null;
  }

  if (selection.kind === "artifact") {
    const artifact = projection.artifacts.find((a) => a.artifactId === selection.id);
    if (artifact?.producerAgentId) return { kind: "agent", id: artifact.producerAgentId };
    const task = artifact?.taskId
      ? projection.tasks.find((t) => t.taskId === artifact.taskId)
      : undefined;
    if (task?.assigneeId) return { kind: "agent", id: task.assigneeId };
    if (task?.roomId) return { kind: "room", id: task.roomId };
    return null;
  }

  if (selection.kind === "approval") {
    const approval = projection.approvals.find((a) => a.approvalId === selection.id);
    if (approval?.requestedBy) return { kind: "agent", id: approval.requestedBy };
    const task = approval?.taskId
      ? projection.tasks.find((t) => t.taskId === approval.taskId)
      : undefined;
    if (task?.assigneeId) return { kind: "agent", id: task.assigneeId };
    if (task?.roomId) return { kind: "room", id: task.roomId };
    return null;
  }

  return null;
}

export const App: FC<AppProps> = ({
  session,
  store,
  gateway,
  runtimeId,
  adapter,
  capabilities,
  demoControls,
  retryable = false,
  onRetry,
  lifeSimSession,
  lifeSimWorldId = "default",
}) => {
  const {
    projection,
    eventLog,
    errors,
    sessionState,
    diagnostics,
    sendCommand,
    sendLifeSimCommand,
    clearErrors,
  } = useComposedOfficeState(
    session,
    store,
    gateway,
    runtimeId,
    lifeSimSession,
    adapter,
    lifeSimWorldId
  );
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("command");
  const [view, setView] = useState<ViewMode>("pixel");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selection, setSelection] = useState<OfficeSelection | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PixelOfficeScene | null>(null);
  const sceneLifecycleRef = useRef<Promise<void>>(Promise.resolve());
  const sceneReadyRef = useRef(false);
  const appBodyRef = useRef<HTMLDivElement>(null);
  const modeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastManualViewRef = useRef<ViewMode>("pixel");
  const prevCanvasSelectionRef = useRef<CanvasSelection>(null);
  const prevSelectionRef = useRef<OfficeSelection | null>(null);

  const applyCanvasSelection = useCallback(
    (scene: PixelOfficeScene, canvasSelection: CanvasSelection) => {
      scene.clearSelection();
      if (!canvasSelection) return;

      if (canvasSelection.kind === "agent") {
        scene.selectAgent(canvasSelection.id);
      } else if (canvasSelection.kind === "room") {
        scene.selectRoom(canvasSelection.id);
        const room = projection.rooms.find((r) => r.roomId === canvasSelection.id);
        if (room && room.activeAgentIds.length > 0) {
          scene.selectAgents(room.activeAgentIds);
        }
      }
    },
    [projection]
  );

  // 初始化 PixelOfficeScene
  useEffect(() => {
    if (view !== "pixel" || !canvasRef.current) return;
    if (sceneRef.current) return;

    const preserveDrawingBuffer = import.meta.env.VITE_PIXEL_PRESERVE_DRAWING_BUFFER === "true";
    console.log("[App] creating PixelOfficeScene", { preserveDrawingBuffer, raw: import.meta.env.VITE_PIXEL_PRESERVE_DRAWING_BUFFER });
    const scene = new PixelOfficeScene(canvasRef.current, {
      reduceMotion,
      preserveDrawingBuffer,
    });
    sceneRef.current = scene;
    sceneReadyRef.current = false;
    scene.setOnSelect((s) => setSelection(s as OfficeSelection));

    let cancelled = false;

    // Serialize scene init/destroy so React StrictMode (or rapid view toggles)
    // cannot create a second WebGL context on the same canvas before the first
    // instance has finished cleaning up. Overlapping contexts cause the browser
    // to lose the active context and leave the Pixel view blank.
    const lifecycle = sceneLifecycleRef.current
      .catch(() => {})
      .then(async () => {
        if (cancelled) return;
        await scene.init(canvasRef.current!);
        if (cancelled) {
          scene.destroy();
          if (sceneRef.current === scene) sceneRef.current = null;
          return;
        }
        // Only push the first projection and selection after init completes;
        // before init the renderers do not exist and selection calls are no-ops.
        sceneReadyRef.current = true;
        scene.updateProjection(projection);
        const canvasSelection = resolveCanvasSelection(selection, projection);
        applyCanvasSelection(scene, canvasSelection);
        prevCanvasSelectionRef.current = canvasSelection;
      })
      .catch((err) => {
        console.error("[App] PixelOfficeScene 初始化失败：", err);
      });

    sceneLifecycleRef.current = lifecycle;

    return () => {
      cancelled = true;
      sceneReadyRef.current = false;
      // Clear the ref synchronously so React StrictMode (or any rapid remount)
      // does not see the old instance and skip creating the replacement scene.
      // The async destroy still runs after the current lifecycle promise to
      // keep WebGL context creation serialized.
      if (sceneRef.current === scene) {
        sceneRef.current = null;
      }
      sceneLifecycleRef.current = lifecycle
        .catch(() => {})
        .then(() => {
          scene.destroy();
        });
    };
  }, [view]);

  // 将 reduceMotion 变更同步到已存在的场景
  useEffect(() => {
    sceneRef.current?.setReduceMotion?.(reduceMotion);
  }, [reduceMotion]);

  // 响应式：窄于 1024 px 自动切换到列表视图，恢复时还原上次手动选择的视图
  useEffect(() => {
    const el = appBodyRef.current;
    if (!el) return;

    let wasNarrow = el.getBoundingClientRect().width < 1024;
    const update = (width: number) => {
      const narrow = width < 1024;
      if (narrow && !wasNarrow) {
        setView("list");
      } else if (!narrow && wasNarrow) {
        setView(lastManualViewRef.current);
      }
      wasNarrow = narrow;
    };

    update(el.getBoundingClientRect().width);

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect?.width ?? window.innerWidth;
        update(width);
      });
      ro.observe(el);
      return () => ro.disconnect();
    }

    const onResize = () => update(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const setManualView = useCallback((next: ViewMode) => {
    lastManualViewRef.current = next;
    setView(next);
  }, []);

  const demoControlsWithReset = useMemo(() => {
    if (!demoControls || !React.isValidElement(demoControls)) return demoControls;
    return React.cloneElement(
      demoControls as React.ReactElement<{ onReset?: () => void }>,
      {
        onReset: () => {
          setSelection(null);
          clearErrors();
        },
      }
    );
  }, [demoControls, clearErrors]);

  const handleModeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = modeButtonRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = buttons.findIndex((b) => b === document.activeElement);
    if (index === -1) return;

    if (e.key === "ArrowRight") {
      buttons[(index + 1) % buttons.length].focus();
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      buttons[(index - 1 + buttons.length) % buttons.length].focus();
      e.preventDefault();
    } else if (e.key === "Home") {
      buttons[0].focus();
      e.preventDefault();
    } else if (e.key === "End") {
      buttons[buttons.length - 1].focus();
      e.preventDefault();
    }
  };

  // 当 projection 变化时更新场景（必须等 init 完成，否则 updateProjection 是 no-op）
  useEffect(() => {
    if (sceneRef.current && sceneReadyRef.current && view === "pixel") {
      sceneRef.current.updateProjection(projection);
    }
  }, [projection, view]);

  // 当 integration projection 变化时同步到像素场景装饰层
  useEffect(() => {
    sceneRef.current?.updateIntegration(projection.integration);
  }, [projection.integration]);

  // 将当前选择同步到场景渲染层
  useEffect(() => {
    if (!sceneRef.current) return;

    const canvasSelection = resolveCanvasSelection(selection, projection);
    const prev = prevCanvasSelectionRef.current;
    const rawSelectionChanged =
      prevSelectionRef.current?.kind !== selection?.kind ||
      prevSelectionRef.current?.id !== selection?.id;

    if (
      !rawSelectionChanged &&
      prev?.kind === canvasSelection?.kind &&
      prev?.id === canvasSelection?.id
    ) {
      return;
    }

    prevCanvasSelectionRef.current = canvasSelection;
    prevSelectionRef.current = selection;
    applyCanvasSelection(sceneRef.current, canvasSelection);
  }, [selection, projection, applyCanvasSelection]);

  // 当已选实体从 projection 中消失时清除选择
  useEffect(() => {
    if (!selection) return;

    const exists =
      (selection.kind === "agent" && projection.agents.some((a) => a.agentId === selection.id)) ||
      (selection.kind === "task" && projection.tasks.some((t) => t.taskId === selection.id)) ||
      (selection.kind === "artifact" && projection.artifacts.some((a) => a.artifactId === selection.id)) ||
      (selection.kind === "approval" && projection.approvals.some((a) => a.approvalId === selection.id)) ||
      (selection.kind === "room" && projection.rooms.some((r) => r.roomId === selection.id));

    if (!exists) {
      setSelection(null);
    }
  }, [projection, selection]);

  // Escape 清除选择
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const lastEvent = useMemo(() => {
    const event = eventLog[eventLog.length - 1];
    if (!event) return null;
    return { type: event.type, timestamp: event.occurredAt };
  }, [eventLog]);

  const failedCount = useMemo(
    () =>
      projection.agents.filter((a) => a.status === "failed").length +
      projection.tasks.filter((t) => t.status === "failed").length,
    [projection]
  );

  const failedError = useMemo(() => {
    const err = projection.errors.find(
      (e) => e.severity === "error" || e.severity === "critical"
    );
    return err
      ? {
          code: (err as { code?: string }).code ?? "PROJECTION_FAILURE",
          message: err.message,
        }
      : null;
  }, [projection]);

  const isFocus = experienceMode === "focus";
  const isDebrief = experienceMode === "debrief";

  return (
    <div className={`app-shell ${reduceMotion ? "reduce-motion" : ""}`}>
      <StatusStrip
        runtimeId={runtimeId}
        sessionState={sessionState}
        diagnostics={diagnostics}
        lastEvent={lastEvent}
        retryable={retryable}
        failedCount={failedCount}
        failedError={failedError}
        onRetry={onRetry}
        onResync={() => {
          session.resynchronize().catch((err) =>
            console.error("[App] resync failed:", err)
          );
        }}
        onReload={() => {
          window.location.reload();
        }}
      />

      <header className="app-header">
        <div className="brand">
          <div className="brand__logo" aria-hidden="true" />
          <span>Swarm Office</span>
        </div>

        <div
          className="mode-switcher"
          role="tablist"
          aria-label="Experience mode"
          onKeyDown={handleModeKeyDown}
        >
          {EXPERIENCE_MODES.map((m, i) => (
            <button
              key={m}
              ref={(el) => (modeButtonRefs.current[i] = el)}
              className={`mode-switcher__btn ${experienceMode === m ? "mode-switcher__btn--active" : ""}`}
              role="tab"
              aria-selected={experienceMode === m}
              onClick={() => setExperienceMode(m)}
            >
              {formatModeLabel(m)}
            </button>
          ))}
        </div>

        <div className="header-actions">
          <button
            className={`icon-btn ${view === "pixel" ? "icon-btn--active" : ""}`}
            aria-pressed={view === "pixel"}
            onClick={() => setManualView("pixel")}
          >
            Pixel
          </button>
          <button
            className={`icon-btn ${view === "list" ? "icon-btn--active" : ""}`}
            aria-pressed={view === "list"}
            onClick={() => setManualView("list")}
          >
            List
          </button>
          <button
            className={`icon-btn ${reduceMotion ? "icon-btn--active" : ""}`}
            aria-pressed={reduceMotion}
            onClick={() => setReduceMotion((v) => !v)}
          >
            {reduceMotion ? "Motion off" : "Motion on"}
          </button>
        </div>
      </header>

      <div
        className="app-body"
        ref={appBodyRef}
        role="main"
        aria-label="Swarm Office workspace"
      >
        <div className={`app-stage ${isFocus ? "app-stage--dimmed" : ""}`}>
          {isDebrief ? (
            view === "pixel" ? (
              <DebriefTimeline events={eventLog} />
            ) : (
              <ListView projection={projection} selection={selection} onSelect={setSelection} />
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
            <ListView projection={projection} selection={selection} onSelect={setSelection} />
          )}
          {isFocus && <FocusModeIndicator projection={projection} />}
        </div>

        <div className={`app-panel ${isFocus ? "app-panel--focus" : ""}`}>
          {isFocus ? (
            <div className="focus-urgent-panel" data-testid="focus-urgent-panel">
              <h3 className="focus-urgent-panel__title">Urgent Only</h3>
              <div className="focus-urgent-panel__cards">
                <div className="focus-urgent-panel__card focus-urgent-panel__card--urgency">
                  <span
                    className="focus-urgent-panel__count"
                    data-testid="focus-urgent-count"
                  >
                    {projection.pendingApprovals.length}
                  </span>
                  <span className="focus-urgent-panel__label">
                    Pending approvals
                  </span>
                </div>
                <div className="focus-urgent-panel__card focus-urgent-panel__card--urgency">
                  <span
                    className="focus-urgent-panel__count"
                    data-testid="focus-urgent-count"
                  >
                    {projection.blockedTasks.length}
                  </span>
                  <span className="focus-urgent-panel__label">
                    Blocked tasks
                  </span>
                </div>
                <div className="focus-urgent-panel__card focus-urgent-panel__card--urgency">
                  <span
                    className="focus-urgent-panel__count"
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
              {demoControlsWithReset}
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
                selection={selection}
                onSelect={setSelection}
                integration={projection.integration}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
