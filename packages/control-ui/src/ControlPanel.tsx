/**
 * ControlPanel — 主控制面板。
 *
 * 只通过 onSendCommand 发命令，不直接持有 Adapter 或 Store。
 * 演示脚本控制（playNormal/playError/playRevision/reset/replay）
 * 由 demo-office 的 DemoControls 组件持有，不在 control-ui 中。
 *
 * 包含：
 * - 三模式切换
 * - 创建任务
 * - 暂停/恢复 Agent
 * - 打开 Artifact
 * - 批准/拒绝审批
 */
import { useState, type FC } from "react";
import type { OfficeProjection, DomainEvent, AdapterCapabilities } from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";
import { EventLogViewer } from "./EventLogViewer.js";

export type ExperienceMode = "command" | "focus" | "debrief";

interface ControlPanelProps {
  projection: OfficeProjection;
  eventLog: DomainEvent[];
  errors: string[];
  mode: ExperienceMode;
  onModeChange: (mode: ExperienceMode) => void;
  onSendCommand: (
    commandType: string,
    payload: unknown,
    targetId?: string | null
  ) => Promise<void>;
  /** Adapter capabilities — unsupported commands disable their buttons. */
  capabilities?: AdapterCapabilities;
}

export const ControlPanel: FC<ControlPanelProps> = ({
  projection,
  eventLog,
  errors,
  mode,
  onModeChange,
  onSendCommand,
  capabilities,
}) => {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const isSupported = (cmdType: string): boolean =>
    capabilities ? capabilities.supportedCommands.includes(cmdType) : true;

  const runAction = async (key: string, fn: () => Promise<void>): Promise<void> => {
    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionErrors((prev) => ({ ...prev, [key]: msg }));
      throw err;
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    await runAction("create-task", () =>
      onSendCommand(CommandType.TASK_CREATE, {
        title: taskTitle,
        description: taskDesc,
        priority: "normal",
      })
    );
    setTaskTitle("");
    setTaskDesc("");
  };

  const handleAssignTask = async (taskId: string, agentId: string) => {
    await runAction(`assign-${taskId}`, () =>
      onSendCommand(CommandType.TASK_ASSIGN, { taskId, agentId }, taskId)
    );
  };

  const handlePauseAgent = async (agentId: string) => {
    await runAction(`pause-${agentId}`, () =>
      onSendCommand(CommandType.AGENT_PAUSE, { agentId }, agentId)
    );
  };

  const handleResumeAgent = async (agentId: string) => {
    await runAction(`resume-${agentId}`, () =>
      onSendCommand(CommandType.AGENT_RESUME, { agentId }, agentId)
    );
  };

  const handleAcceptApproval = async (approvalId: string) => {
    await runAction(`accept-${approvalId}`, () =>
      onSendCommand(CommandType.APPROVAL_ACCEPT, { approvalId }, approvalId)
    );
  };

  const handleRejectApproval = async (approvalId: string) => {
    await runAction(`reject-${approvalId}`, () =>
      onSendCommand(
        CommandType.APPROVAL_REJECT,
        { approvalId, reason: "用户拒绝" },
        approvalId
      )
    );
  };

  const handleOpenArtifact = async (artifactId: string) => {
    await runAction(`open-${artifactId}`, () =>
      onSendCommand(CommandType.ARTIFACT_OPEN, { artifactId }, artifactId)
    );
    setSelectedArtifact(artifactId);
  };

  return (
    <div style={styles.container}>
      {/* 模式切换 */}
      <div style={styles.section}>
        <h3 style={styles.h3}>体验模式</h3>
        <div style={styles.buttonRow}>
          {(["command", "focus", "debrief"] as ExperienceMode[]).map((m) => (
            <button
              key={m}
              style={{
                ...styles.button,
                ...(mode === m ? styles.buttonActive : {}),
              }}
              onClick={() => onModeChange(m)}
            >
              {m === "command" ? "Command" : m === "focus" ? "Focus" : "Debrief"}
            </button>
          ))}
        </div>
        {mode === "focus" && (
          <p style={styles.hint}>
            Focus Mode: 事件静默积压。切换回 Debrief 查看积压。
          </p>
        )}
      </div>

      {/* 创建任务 */}
      <div style={styles.section}>
        <h3 style={styles.h3}>创建任务</h3>
        <input
          style={styles.input}
          placeholder="任务标题"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="任务描述"
          value={taskDesc}
          onChange={(e) => setTaskDesc(e.target.value)}
        />
        <button
          style={styles.button}
          onClick={handleCreateTask}
          disabled={!isSupported(CommandType.TASK_CREATE)}
          title={isSupported(CommandType.TASK_CREATE) ? undefined : "Adapter does not support task.create"}
        >
          创建任务
        </button>
        {actionErrors["create-task"] && (
          <div style={styles.actionError}>{actionErrors["create-task"]}</div>
        )}
      </div>

      {/* Agent 列表 */}
      <div style={styles.section}>
        <h3 style={styles.h3}>Agents ({projection.agents.length})</h3>
        {projection.agents.map((agent) => (
          <div key={agent.agentId} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.agentName}>{agent.name}</span>
              <span style={{ ...styles.badge, ...badgeColor(agent.status) }}>
                {agent.status}
              </span>
            </div>
            <div style={styles.cardBody}>
              <span>角色: {agent.role}</span>
              <span>任务: {agent.currentTaskId ?? "无"}</span>
              {agent.blockedReason && (
                <span style={{ color: "#ff6666" }}>阻塞: {agent.blockedReason}</span>
              )}
            </div>
            <div style={styles.buttonRow}>
              <button
                style={styles.smallButton}
                onClick={() => handlePauseAgent(agent.agentId)}
                disabled={
                  agent.status === "paused" ||
                  agent.status === "offline" ||
                  !isSupported(CommandType.AGENT_PAUSE)
                }
                title={isSupported(CommandType.AGENT_PAUSE) ? undefined : "Unsupported by adapter"}
              >
                暂停
              </button>
              <button
                style={styles.smallButton}
                onClick={() => handleResumeAgent(agent.agentId)}
                disabled={
                  agent.status !== "paused" ||
                  !isSupported(CommandType.AGENT_RESUME)
                }
                title={isSupported(CommandType.AGENT_RESUME) ? undefined : "Unsupported by adapter"}
              >
                恢复
              </button>
            </div>
            {(actionErrors[`pause-${agent.agentId}`] || actionErrors[`resume-${agent.agentId}`]) && (
              <div style={styles.actionError}>
                {actionErrors[`pause-${agent.agentId}`] ?? actionErrors[`resume-${agent.agentId}`]}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 任务列表 */}
      <div style={styles.section}>
        <h3 style={styles.h3}>Tasks ({projection.tasks.length})</h3>
        {projection.tasks.map((task) => (
          <div key={task.taskId} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.taskTitle}>{task.title}</span>
              <span style={{ ...styles.badge, ...taskBadgeColor(task.status) }}>
                {task.status}
              </span>
            </div>
            <div style={styles.cardBody}>
              <span>ID: {task.taskId}</span>
              <span>优先级: {task.priority}</span>
              <span>负责人: {task.assigneeId ?? "未分配"}</span>
              {task.blockedReason && (
                <span style={{ color: "#ff6666" }}>阻塞: {task.blockedReason}</span>
              )}
            </div>
            {task.status === "created" && isSupported(CommandType.TASK_ASSIGN) && (
              <div style={styles.buttonRow}>
                {projection.agents
                  .filter((a) => a.role === "worker" && a.status === "idle")
                  .map((a) => (
                    <button
                      key={a.agentId}
                      style={styles.smallButton}
                      onClick={() => handleAssignTask(task.taskId, a.agentId)}
                    >
                      分配给 {a.name}
                    </button>
                  ))}
              </div>
            )}
            {actionErrors[`assign-${task.taskId}`] && (
              <div style={styles.actionError}>{actionErrors[`assign-${task.taskId}`]}</div>
            )}
          </div>
        ))}
      </div>

      {/* 审批请求 */}
      {projection.pendingApprovals.length > 0 && (
        <div style={styles.section}>
          <h3 style={{ ...styles.h3, color: "#ffcc00" }}>
            待审批 ({projection.pendingApprovals.length})
          </h3>
          {projection.pendingApprovals.map((approval) => (
            <div key={approval.approvalId} style={{ ...styles.card, borderColor: "#ffcc00" }}>
              <div style={styles.cardHeader}>
                <span>审批 {approval.approvalId}</span>
                <span style={styles.badge}>{approval.kind}</span>
              </div>
              <div style={styles.cardBody}>
                <span>任务: {approval.taskId}</span>
                <span>原因: {approval.reason}</span>
              </div>
              <div style={styles.buttonRow}>
                <button
                  style={{ ...styles.smallButton, backgroundColor: "#2a5a2a" }}
                  onClick={() => handleAcceptApproval(approval.approvalId)}
                  disabled={!isSupported(CommandType.APPROVAL_ACCEPT)}
                  title={isSupported(CommandType.APPROVAL_ACCEPT) ? undefined : "Unsupported by adapter"}
                >
                  批准
                </button>
                <button
                  style={{ ...styles.smallButton, backgroundColor: "#5a2a2a" }}
                  onClick={() => handleRejectApproval(approval.approvalId)}
                  disabled={!isSupported(CommandType.APPROVAL_REJECT)}
                  title={isSupported(CommandType.APPROVAL_REJECT) ? undefined : "Unsupported by adapter"}
                >
                  拒绝
                </button>
              </div>
              {(actionErrors[`accept-${approval.approvalId}`] || actionErrors[`reject-${approval.approvalId}`]) && (
                <div style={styles.actionError}>
                  {actionErrors[`accept-${approval.approvalId}`] ?? actionErrors[`reject-${approval.approvalId}`]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Artifacts */}
      {projection.artifacts.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.h3}>Artifacts ({projection.artifacts.length})</h3>
          {projection.artifacts.map((art) => (
            <div key={art.artifactId} style={styles.card}>
              <div style={styles.cardHeader}>
                <span>{art.title}</span>
                <span style={{ ...styles.badge, ...artifactBadgeColor(art.status) }}>
                  {art.status} v{art.version}
                </span>
              </div>
              <div style={styles.cardBody}>
                <span>ID: {art.artifactId}</span>
                <span>类型: {art.type}</span>
                {art.reviewResult && (
                  <span>审查: {art.reviewResult.verdict} - {art.reviewResult.comment}</span>
                )}
              </div>
              <div style={styles.buttonRow}>
                <button
                  style={styles.smallButton}
                  onClick={() => handleOpenArtifact(art.artifactId)}
                  disabled={!isSupported(CommandType.ARTIFACT_OPEN)}
                  title={isSupported(CommandType.ARTIFACT_OPEN) ? undefined : "Unsupported by adapter"}
                >
                  查看
                </button>
              </div>
              {selectedArtifact === art.artifactId && (
                <div style={styles.artifactContent}>
                  <p>Artifact URI: {art.artifactId}</p>
                  <p>（Mock 内容 — 实际内容需通过 URI 获取）</p>
                </div>
              )}
              {actionErrors[`open-${art.artifactId}`] && (
                <div style={styles.actionError}>{actionErrors[`open-${art.artifactId}`]}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 错误 */}
      {errors.length > 0 && (
        <div style={styles.section}>
          <h3 style={{ ...styles.h3, color: "#ff6666" }}>错误</h3>
          {errors.map((err, i) => (
            <div key={i} style={{ color: "#ff6666", fontSize: 12, marginBottom: 4 }}>
              {err}
            </div>
          ))}
        </div>
      )}

      {/* 事件日志 */}
      <EventLogViewer events={eventLog} />
    </div>
  );
};

// ─── 样式 ────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 12,
    backgroundColor: "#1e1e2e",
    color: "#cccccc",
    fontFamily: "monospace",
    fontSize: 13,
    height: "100%",
    overflowY: "auto",
  },
  section: {
    borderBottom: "1px solid #333",
    paddingBottom: 12,
  },
  h3: {
    margin: "0 0 8px 0",
    fontSize: 14,
    color: "#88ccff",
  },
  buttonRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    marginTop: 6,
  },
  button: {
    padding: "4px 12px",
    backgroundColor: "#333355",
    color: "#cccccc",
    border: "1px solid #555577",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "monospace",
  },
  buttonActive: {
    backgroundColor: "#4488cc",
    color: "#ffffff",
    borderColor: "#66aaff",
  },
  smallButton: {
    padding: "2px 8px",
    backgroundColor: "#333355",
    color: "#cccccc",
    border: "1px solid #555577",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "monospace",
  },
  input: {
    display: "block",
    width: "100%",
    padding: "4px 8px",
    marginBottom: 6,
    backgroundColor: "#222233",
    color: "#cccccc",
    border: "1px solid #444466",
    borderRadius: 3,
    fontSize: 12,
    fontFamily: "monospace",
    boxSizing: "border-box" as const,
  },
  card: {
    backgroundColor: "#222233",
    border: "1px solid #333355",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardBody: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
    fontSize: 11,
    color: "#999999",
  },
  agentName: {
    fontWeight: "bold",
    color: "#ffffff",
  },
  taskTitle: {
    fontWeight: "bold",
    color: "#dddddd",
  },
  badge: {
    padding: "2px 6px",
    borderRadius: 3,
    fontSize: 10,
    backgroundColor: "#444466",
    color: "#cccccc",
  },
  hint: {
    fontSize: 11,
    color: "#888888",
    marginTop: 4,
  },
  artifactContent: {
    marginTop: 6,
    padding: 6,
    backgroundColor: "#111122",
    borderRadius: 3,
    fontSize: 11,
    color: "#aaaaaa",
  },
  actionError: {
    marginTop: 6,
    padding: "4px 6px",
    backgroundColor: "#3a1a1a",
    border: "1px solid #5a2a2a",
    borderRadius: 3,
    fontSize: 11,
    color: "#ff8888",
  },
};

function badgeColor(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    idle: "#444466",
    working: "#2a5a2a",
    blocked: "#5a2a2a",
    paused: "#5a5a2a",
    reviewing: "#5a2a5a",
    failed: "#5a1a1a",
  };
  return { backgroundColor: map[status] ?? "#444466" };
}

function taskBadgeColor(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    created: "#444466",
    running: "#2a5a2a",
    blocked: "#5a2a2a",
    completed: "#1a4a1a",
    waiting_approval: "#5a4a1a",
    revision_required: "#5a3a1a",
    failed: "#5a1a1a",
  };
  return { backgroundColor: map[status] ?? "#444466" };
}

function artifactBadgeColor(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    generated: "#444466",
    approved: "#2a5a2a",
    revision_required: "#5a3a1a",
    rejected: "#5a1a1a",
    delivered: "#1a4a4a",
  };
  return { backgroundColor: map[status] ?? "#444466" };
}
