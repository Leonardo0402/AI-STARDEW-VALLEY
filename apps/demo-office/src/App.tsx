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
import {
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
import type { AdapterCapabilities } from "@agent-office/protocol";
import {
  ControlPanel,
  type ExperienceMode,
} from "@agent-office/control-ui";
import {
  LifeSimControlPanel,
  type LifeSimSession,
  type ComposedOfficeProjection,
} from "@agent-office/control-ui/life-sim";
import { PixelOfficeScene } from "@agent-office/pixel-office";
import { ListView } from "./ListView.js";
import { DebriefTimeline } from "./DebriefTimeline.js";
import { StatusStrip } from "./StatusStrip.js";
import { useComposedOfficeState } from "./useComposedOfficeState.js";

interface AppProps {
  session: RuntimeSession;
  store: SnapshotStore;
  gateway: CommandGateway;
  runtimeId: string;
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
  } = useComposedOfficeState(
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PixelOfficeScene | null>(null);
  const appBodyRef = useRef<HTMLDivElement>(null);
  const modeButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastManualViewRef = useRef<ViewMode>("pixel");

  // 初始化 PixelOfficeScene
  useEffect(() => {
    if (view !== "pixel" || !canvasRef.current) return;
    if (sceneRef.current) return;

    const scene = new PixelOfficeScene(canvasRef.current, { reduceMotion });
    sceneRef.current = scene;
    scene.init(canvasRef.current).catch((err) => {
      console.error("[App] PixelOfficeScene 初始化失败：", err);
    });

    return () => {
      scene.destroy();
      sceneRef.current = null;
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

      <div className="app-body" ref={appBodyRef}>
        <div className={`app-stage ${isFocus ? "app-stage--dimmed" : ""}`}>
          {isDebrief ? (
            view === "pixel" ? (
              <DebriefTimeline events={eventLog} />
            ) : (
              <ListView projection={projection} />
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
            <ListView projection={projection} />
          )}
          {isFocus && <FocusModeIndicator projection={projection} />}
        </div>

        <div className="app-panel">
          {demoControls}
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
          />
        </div>
      </div>
    </div>
  );
};

// ─── Focus Mode 极简指示器 ────────────────────────────────────
const FocusModeIndicator: FC<{ projection: ComposedOfficeProjection }> = ({
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
      <p className="focus-indicator__hint">Agents continue working in the background; events queue quietly.</p>
      <div className="focus-indicator__stats">
        <div className="focus-indicator__stat">
          <span className="focus-indicator__num focus-indicator__num--urgency">
            {pending}
          </span>
          <span className="focus-indicator__label">Pending</span>
        </div>
        <div className="focus-indicator__stat">
          <span className="focus-indicator__num focus-indicator__num--failure">
            {blocked}
          </span>
          <span className="focus-indicator__label">Blocked</span>
        </div>
        <div className="focus-indicator__stat">
          <span className="focus-indicator__num focus-indicator__num--info">
            {artifacts}
          </span>
          <span className="focus-indicator__label">Artifacts</span>
        </div>
      </div>
      <p className="focus-indicator__hint">Switch to Command or Debrief for details.</p>
    </div>
  );
};
