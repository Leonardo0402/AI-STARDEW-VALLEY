import type { FC } from "react";
import type { OfficeProjection } from "@agent-office/protocol";
import { Card } from "./components/Card.js";
import { Badge } from "./components/Badge.js";
import { SectionHeader } from "./components/SectionHeader.js";
import { ApprovalDrawer } from "./components/ApprovalDrawer.js";

interface FocusPanelProps {
  projection: OfficeProjection;
  onApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
  approveDisabled?: boolean;
  rejectDisabled?: boolean;
}

export const FocusPanel: FC<FocusPanelProps> = ({
  projection,
  onApprove,
  onReject,
  approveDisabled,
  rejectDisabled,
}) => {
  const blockedAgents = projection.agents.filter(
    (a) => a.status === "blocked" || a.blockedReason
  );
  const blockedTasks = projection.blockedTasks;
  const pendingApprovals = projection.pendingApprovals;
  const completedTasks = projection.tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="focus-panel">
      <ApprovalDrawer
        approvals={pendingApprovals}
        onApprove={onApprove}
        onReject={onReject}
        approveDisabled={approveDisabled}
        rejectDisabled={rejectDisabled}
      />

      {blockedAgents.length > 0 && (
        <div className="panel-section">
          <SectionHeader title="Blocked Agents" count={blockedAgents.length} countIntent="blocked" />
          {blockedAgents.map((agent) => (
            <Card key={agent.agentId}>
              <div className="card-row">
                <div>
                  <div className="card-title">{agent.name}</div>
                  <div className="card-meta">
                    {agent.role}
                    {agent.blockedReason ? ` · ${agent.blockedReason}` : ""}
                  </div>
                </div>
                <Badge intent="blocked">{agent.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {blockedTasks.length > 0 && (
        <div className="panel-section">
          <SectionHeader title="Blocked Tasks" count={blockedTasks.length} countIntent="blocked" />
          {blockedTasks.map((task) => (
            <Card key={task.taskId}>
              <div className="card-row">
                <div>
                  <div className="card-title">{task.title}</div>
                  <div className="card-meta">
                    {task.taskId}
                    {task.assigneeId ? ` · ${task.assigneeId}` : ""}
                    {task.blockedReason ? ` · ${task.blockedReason}` : ""}
                  </div>
                </div>
                <Badge intent="blocked">{task.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="panel-section">
        <SectionHeader title="Urgent Summary" />
        <div className="focus-summary">
          <div className="focus-summary__item">
            <span className="focus-summary__num focus-summary__num--urgency">
              {pendingApprovals.length}
            </span>
            <span className="focus-summary__label">Pending</span>
          </div>
          <div className="focus-summary__item">
            <span className="focus-summary__num focus-summary__num--failure">
              {blockedTasks.length}
            </span>
            <span className="focus-summary__label">Blocked Tasks</span>
          </div>
          <div className="focus-summary__item">
            <span className="focus-summary__num focus-summary__num--failure">
              {blockedAgents.length}
            </span>
            <span className="focus-summary__label">Blocked Agents</span>
          </div>
          <div className="focus-summary__item">
            <span className="focus-summary__num focus-summary__num--success">
              {completedTasks}
            </span>
            <span className="focus-summary__label">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
};
