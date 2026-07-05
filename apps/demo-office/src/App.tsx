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
import { useState, useEffect, useRef, useMemo, type FC, type ReactNode } from "react";
import type { SnapshotStore, CommandGateway, RuntimeSession } from "@agent-office/core";
import type { AdapterCapabilities } from "@agent-office/protocol";
import {
  ControlPanel,
  useOfficeState,
  type ExperienceMode,
} from "@agent-office/control-ui";
import { PixelOfficeScene } from "@agent-office/pixel-office";
import { ListView } from "./ListView.js";
import { StatusStrip } from "./StatusStrip.js";
import type { DemoRuntimeMode } from "./runtime/types.js";

interface AppProps {
  session: RuntimeSession;
  store: SnapshotStore;
  gateway: CommandGateway;
  runtimeId: string;
  mode: DemoRuntimeMode;
  /** Adapter capabilities — used to disable unsupported command buttons. */
  capabilities?: AdapterCapabilities;
  /** 演示层专用控件（如 DemoControls），由装配层 main.tsx 注入。
   *  App 本身不依赖任何 Mock 专用类型。 */
  demoControls?: ReactNode;
}

type ViewMode = "pixel" | "list";

const EXPERIENCE_MODES: ExperienceMode[] = ["command", "focus", "debrief"];

function formatModeLabel(mode: ExperienceMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export const App: FC<AppProps> = ({
  session,
  store,
  gateway,
  runtimeId,
  mode,
  capabilities,
  demoControls,
}) => {
  const { projection, eventLog, errors, sessionState, diagnostics, sendCommand } = useOfficeState(
    session,
    store,
    gateway,
    runtimeId
  );
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("command");
  const [view, setView] = useState<ViewMode>("pixel");
  const [reduceMotion, setReduceMotion] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PixelOfficeScene | null>(null);

  // 初始化 PixelOfficeScene
  useEffect(() => {
    if (view !== "pixel" || !canvasRef.current) return;
    if (sceneRef.current) return;

    const scene = new PixelOfficeScene(canvasRef.current);
    sceneRef.current = scene;
    scene.init(canvasRef.current).catch((err) => {
      console.error("[App] PixelOfficeScene 初始化失败：", err);
    });

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [view]);

  // 当 projection 变化时更新场景
  useEffect(() => {
    if (sceneRef.current && view === "pixel") {
      sceneRef.current.updateProjection(projection);
    }
  }, [projection, view]);

  const lastEvent = useMemo(() => {
    const event = eventLog[eventLog.length - 1];
    if (!event) return null;
    return { type: event.type, timestamp: event.occurredAt };
  }, [eventLog]);

  const showFullView = experienceMode !== "focus";

  return (
    <div className={`app-shell ${reduceMotion ? "reduce-motion" : ""}`}>
      <StatusStrip
        mode={mode}
        runtimeId={runtimeId}
        sessionState={sessionState}
        diagnostics={diagnostics}
        lastError={errors.length > 0 ? errors[errors.length - 1] : null}
        lastEvent={lastEvent}
        retryable={false}
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

        <div className="mode-switcher" role="tablist" aria-label="Experience mode">
          {EXPERIENCE_MODES.map((m) => (
            <button
              key={m}
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
            onClick={() => setView("pixel")}
          >
            像素空间
          </button>
          <button
            className={`icon-btn ${view === "list" ? "icon-btn--active" : ""}`}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            列表视图
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

      <div className="app-body">
        <div className="app-stage">
          {showFullView ? (
            view === "pixel" ? (
              <canvas
                ref={canvasRef}
                className="app-canvas"
                width={800}
                height={600}
              />
            ) : (
              <ListView projection={projection} />
            )
          ) : (
            <FocusModeIndicator projection={projection} />
          )}
        </div>

        <div className="app-panel">
          {demoControls}
          <ControlPanel
            projection={projection}
            eventLog={eventLog}
            errors={errors}
            mode={experienceMode}
            onModeChange={setExperienceMode}
            onSendCommand={sendCommand}
            capabilities={capabilities}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Focus Mode 极简指示器 ────────────────────────────────────
const FocusModeIndicator: FC<{ projection: ReturnType<typeof useOfficeState>["projection"] }> = ({
  projection,
}) => {
  const pending = projection.pendingApprovals.length;
  const blocked = projection.blockedTasks.length;
  const artifacts = projection.artifacts.filter(
    (a) => a.status === "approved" || a.status === "generated"
  ).length;

  return (
    <div className="focus-indicator">
      <h2 className="focus-indicator__title">Focus Mode</h2>
      <p className="focus-indicator__hint">Agent 在后台继续工作，事件静默积压。</p>
      <div className="focus-indicator__stats">
        <div className="focus-indicator__stat">
          <span className="focus-indicator__num" style={{ color: "var(--success)" }}>
            {pending}
          </span>
          <span className="focus-indicator__label">待审批</span>
        </div>
        <div className="focus-indicator__stat">
          <span className="focus-indicator__num" style={{ color: "var(--failure)" }}>
            {blocked}
          </span>
          <span className="focus-indicator__label">阻塞任务</span>
        </div>
        <div className="focus-indicator__stat">
          <span className="focus-indicator__num" style={{ color: "var(--info)" }}>
            {artifacts}
          </span>
          <span className="focus-indicator__label">产物</span>
        </div>
      </div>
      <p className="focus-indicator__hint">切换到 Command 或 Debrief 模式查看详情。</p>
    </div>
  );
};
