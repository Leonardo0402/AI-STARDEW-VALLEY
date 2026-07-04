/**
 * App — demo-office 的根组件。
 *
 * 布局：
 * ┌──────────────────────────────┬──────────────────┐
 * │  像素空间视图 / 列表视图       │  ControlPanel    │
 * │  （可切换）                    │                  │
 * └──────────────────────────────┴──────────────────┘
 *
 * 核心规则：
 * - 像素视图只消费 OfficeProjection
 * - 列表视图同样只消费 OfficeProjection（普通 Dashboard 对照）
 * - ControlPanel 通过 CommandGateway 发命令
 * - UI 卸载不影响 Runtime（PixelOfficeScene.destroy 不影响 adapter）
 */
import { useState, useEffect, useRef, type FC, type ReactNode } from "react";
import type { SnapshotStore, CommandGateway, RuntimeSession } from "@agent-office/core";
import {
  ControlPanel,
  useOfficeState,
  type ExperienceMode,
} from "@agent-office/control-ui";
import { PixelOfficeScene } from "@agent-office/pixel-office";
import { ListView } from "./ListView.js";

interface AppProps {
  session: RuntimeSession;
  store: SnapshotStore;
  gateway: CommandGateway;
  runtimeId: string;
  mode?: string;  // added by Task 6, used by Task 7+8
  /** 演示层专用控件（如 DemoControls），由装配层 main.tsx 注入。
   *  App 本身不依赖任何 Mock 专用类型。 */
  demoControls?: ReactNode;
}

type ViewMode = "pixel" | "list";

export const App: FC<AppProps> = ({ session, store, gateway, runtimeId, demoControls }) => {
  const { projection, eventLog, errors, sendCommand } = useOfficeState(
    session,
    store,
    gateway,
    runtimeId
  );
  const [mode, setMode] = useState<ExperienceMode>("command");
  const [view, setView] = useState<ViewMode>("pixel");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PixelOfficeScene | null>(null);

  // 初始化 PixelOfficeScene
  useEffect(() => {
    if (view !== "pixel" || !canvasRef.current) return;
    if (sceneRef.current) return; // 已初始化

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

  // Focus Mode 下隐藏像素视图（极简指示器）
  const showFullView = mode !== "focus";

  return (
    <div style={styles.root}>
      {/* 顶部工具栏 */}
      <div style={styles.topbar}>
        <span style={styles.title}>AI-像素 Agent Office</span>
        <span style={styles.subtitle}>垂直切片 v1 · MockRuntimeAdapter</span>
        <div style={styles.spacer} />
        <div style={styles.viewSwitch}>
          <button
            style={{
              ...styles.viewBtn,
              ...(view === "pixel" ? styles.viewBtnActive : {}),
            }}
            onClick={() => setView("pixel")}
          >
            像素空间
          </button>
          <button
            style={{
              ...styles.viewBtn,
              ...(view === "list" ? styles.viewBtnActive : {}),
            }}
            onClick={() => setView("list")}
          >
            列表视图
          </button>
        </div>
      </div>

      {/* 主体 */}
      <div style={styles.body}>
        {/* 左侧：空间视图或列表视图 */}
        <div style={styles.stage}>
          {showFullView ? (
            view === "pixel" ? (
              <canvas
                ref={canvasRef}
                style={styles.canvas}
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

        {/* 右侧：控制面板 */}
        <div style={styles.panel}>
          {demoControls}
          <ControlPanel
            projection={projection}
            eventLog={eventLog}
            errors={errors}
            mode={mode}
            onModeChange={setMode}
            onSendCommand={sendCommand}
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
    <div style={styles.focusContainer}>
      <h2 style={styles.focusTitle}>Focus Mode</h2>
      <p style={styles.focusHint}>Agent 在后台继续工作，事件静默积压。</p>
      <div style={styles.focusStats}>
        <div style={styles.focusStat}>
          <span style={styles.focusStatNum}>{pending}</span>
          <span style={styles.focusStatLabel}>待审批</span>
        </div>
        <div style={styles.focusStat}>
          <span style={styles.focusStatNum}>{blocked}</span>
          <span style={styles.focusStatLabel}>阻塞任务</span>
        </div>
        <div style={styles.focusStat}>
          <span style={styles.focusStatNum}>{artifacts}</span>
          <span style={styles.focusStatLabel}>产物</span>
        </div>
      </div>
      <p style={styles.focusHint}>切换到 Command 或 Debrief 模式查看详情。</p>
    </div>
  );
};

// ─── 样式 ────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100vh",
    backgroundColor: "#1a1a2e",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    backgroundColor: "#161623",
    borderBottom: "1px solid #333",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#88ccff",
  },
  subtitle: {
    fontSize: 11,
    color: "#666",
  },
  spacer: {
    flex: 1,
  },
  viewSwitch: {
    display: "flex",
    gap: 4,
  },
  viewBtn: {
    padding: "4px 12px",
    backgroundColor: "#2a2a3e",
    color: "#aaa",
    border: "1px solid #444",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "monospace",
  },
  viewBtnActive: {
    backgroundColor: "#4488cc",
    color: "#fff",
    borderColor: "#66aaff",
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  stage: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111122",
    overflow: "auto",
    padding: 12,
  },
  canvas: {
    border: "1px solid #333",
    backgroundColor: "#1a1a2e",
    maxWidth: "100%",
    maxHeight: "100%",
  },
  panel: {
    width: 420,
    minWidth: 360,
    maxWidth: 480,
    borderLeft: "1px solid #333",
    backgroundColor: "#1e1e2e",
    overflowY: "auto",
  },
  focusContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  focusTitle: {
    fontSize: 22,
    color: "#88ccff",
    margin: 0,
  },
  focusHint: {
    fontSize: 12,
    color: "#888",
    margin: 0,
  },
  focusStats: {
    display: "flex",
    gap: 24,
    margin: "16px 0",
  },
  focusStat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  focusStatNum: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
  },
  focusStatLabel: {
    fontSize: 11,
    color: "#888",
  },
};
