/**
 * ControlPanel — 右侧控制面板。
 *
 * 只通过 onSendCommand 发命令，不直接持有 Adapter 或 Store。
 * Stage 2 移除模式切换器（已上移到 App header），仅保留操作卡片和审批表面。
 */
import { useState, type FC } from "react";
import type {
  OfficeProjection,
  DomainEvent,
  AdapterCapabilities,
  AgentView,
  TaskView,
} from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";
import type { OfficeSelection } from "@agent-office/pixel-office";
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
import "./control-panel.css";

export type ExperienceMode = "command" | "focus" | "debrief";

interface ControlPanelProps {
  projection: OfficeProjection;
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
  selection?: OfficeSelection | null;
  onSelect?: (selection: OfficeSelection) => void;
}

export const ControlPanel: FC<ControlPanelProps> = ({
  projection,
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

  const handleCreateTask = async (title: string, _description: string, priority: string) => {
    await runAction("create-task", () =>
      onSendCommand(CommandType.TASK_CREATE, {
        title,
        description: "",
        priority,
      })
    );
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
        { approvalId, reason: "rejected by operator" },
        approvalId
      )
    );
  };

  const handleOpenArtifact = async (artifactId: string) => {
    try {
      await runAction(`open-${artifactId}`, () =>
        onSendCommand(CommandType.ARTIFACT_OPEN, { artifactId }, artifactId)
      );
    } catch {
      // Error is already recorded in actionErrors; swallow so it doesn't become unhandled.
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

  const isSelected = (kind: OfficeSelection["kind"], id: string): boolean =>
    selection?.kind === kind && selection?.id === id;

  const handleSelect =
    (kind: OfficeSelection["kind"], id: string) =>
    (e?: { stopPropagation?: () => void }): void => {
      e?.stopPropagation?.();
      onSelect?.({ kind, id });
    };

  const handleCardKeyDown =
    (kind: OfficeSelection["kind"], id: string) =>
    (e: import("react").KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.({ kind, id });
      }
    };

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
                message={message}
                onDismiss={() => dismissError(err)}
              />
            );
          })}
        </div>
      )}

      {mode === "command" && (
        <>
          <ApprovalDrawer
            approvals={projection.pendingApprovals}
            onApprove={handleAcceptApproval}
            onReject={handleRejectApproval}
            approveDisabled={!isSupported(CommandType.APPROVAL_ACCEPT)}
            rejectDisabled={!isSupported(CommandType.APPROVAL_REJECT)}
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
              <Card
                key={agent.agentId}
                selectable={Boolean(onSelect) || selection !== null}
                selected={isSelected("agent", agent.agentId)}
                ariaLabel={`Select agent ${agent.name}`}
                onClick={handleSelect("agent", agent.agentId)}
                onKeyDown={handleCardKeyDown("agent", agent.agentId)}
              >
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePauseAgent(agent.agentId);
                    }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResumeAgent(agent.agentId);
                    }}
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
              <Card
                key={task.taskId}
                selectable={Boolean(onSelect) || selection !== null}
                selected={isSelected("task", task.taskId)}
                ariaLabel={`Select task ${task.title}`}
                onClick={handleSelect("task", task.taskId)}
                onKeyDown={handleCardKeyDown("task", task.taskId)}
              >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAssignTask(task.taskId, a.agentId);
                        }}
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
            ))}
          </div>

          {projection.artifacts.length > 0 && (
            <div className="panel-section">
              <SectionHeader
                title="Artifacts"
                count={projection.artifacts.length}
                countIntent="approved"
              />
              {projection.artifacts.map((art) => {
                // NOTE: art.status is intentionally not used for content-state classification.
                // The current ArtifactStatus union has no explicit content_unavailable/load_failed
                // values; we use art.uri === null and actionErrors for those states instead.
                const artifactOpenSupported = isSupported(CommandType.ARTIFACT_OPEN);
                const hasContent = Boolean(art.content);
                const hasUri = Boolean(art.uri);
                const canOpen = artifactOpenSupported && (hasContent || hasUri);
                const openError = actionErrors[`open-${art.artifactId}`];

                return (
                  <Card
                    key={art.artifactId}
                    selectable={Boolean(onSelect) || selection !== null}
                    selected={isSelected("artifact", art.artifactId)}
                    ariaLabel={`Select artifact ${art.title}`}
                    onClick={handleSelect("artifact", art.artifactId)}
                    onKeyDown={handleCardKeyDown("artifact", art.artifactId)}
                  >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenArtifact(art.artifactId);
                        }}
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
                      </button>
                    </div>
                    <div className="artifact-preview">
                      {hasContent ? (
                        <div className="artifact-preview__content">{art.content}</div>
                      ) : hasUri ? (
                        <div className="artifact-preview__uri">{art.uri}</div>
                      ) : art.uri === null ? (
                        <div className="artifact-preview__unavailable">Content unavailable</div>
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
                );
              })}
            </div>
          )}

          <EventLogViewer events={eventLog} />
        </>
      )}

      {mode === "focus" && (
        <FocusPanel
          projection={projection}
          onApprove={handleAcceptApproval}
          onReject={handleRejectApproval}
          approveDisabled={!isSupported(CommandType.APPROVAL_ACCEPT)}
          rejectDisabled={!isSupported(CommandType.APPROVAL_REJECT)}
        />
      )}

      {mode === "debrief" && <DebriefPanel projection={projection} eventLog={eventLog} />}
    </div>
  );
};

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function parseError(err: string): { code: string; message: string } {
  const match = err.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    return { code: match[1], message: match[2] };
  }
  return { code: "ERROR", message: err };
}

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
      return "blocked";
    case "paused":
      return "paused";
    case "failed":
      return "failed";
    case "planning":
    case "reviewing":
    default:
      return "info";
  }
}

function taskStatusIntent(status: TaskView["status"]): BadgeIntent {
  switch (status) {
    case "created":
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
    case "revision_required":
      return "waiting";
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

