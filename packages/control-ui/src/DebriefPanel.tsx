import type { FC } from "react";
import type { OfficeProjection, DomainEvent, ApprovalView } from "@agent-office/protocol";
import { Card } from "./components/Card.js";
import { Badge, type BadgeIntent } from "./components/Badge.js";
import { SectionHeader } from "./components/SectionHeader.js";
import { formatTime } from "./components/format-time.js";
import { artifactStatusIntent } from "./components/intents.js";

interface DebriefPanelProps {
  projection: OfficeProjection;
  eventLog: DomainEvent[];
}

export const DebriefPanel: FC<DebriefPanelProps> = ({ projection, eventLog }) => {
  const completedTasks = projection.tasks.filter((t) => t.status === "completed");
  const resolvedApprovals = projection.approvals.filter(
    (a) => a.status === "approved" || a.status === "rejected"
  );
  const deliveredArtifacts = projection.artifacts.filter((a) => a.status === "delivered");
  const sortedEvents = [...eventLog].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="debrief-panel">
      <div className="panel-section">
        <SectionHeader title="Session Summary" />
        <div className="debrief-summary">
          <div className="debrief-summary__item">
            <span className="debrief-summary__num">{completedTasks.length}</span>
            <span className="debrief-summary__label">Tasks completed</span>
          </div>
          <div className="debrief-summary__item">
            <span className="debrief-summary__num">{resolvedApprovals.length}</span>
            <span className="debrief-summary__label">Approvals resolved</span>
          </div>
          <div className="debrief-summary__item">
            <span className="debrief-summary__num">{deliveredArtifacts.length}</span>
            <span className="debrief-summary__label">Artifacts delivered</span>
          </div>
          <div className="debrief-summary__item">
            <span className="debrief-summary__num">{eventLog.length}</span>
            <span className="debrief-summary__label">Events</span>
          </div>
        </div>
        {completedTasks.length > 0 && (
          <div className="debrief-summary__list">
            {completedTasks.map((task) => (
              <div key={task.taskId} className="debrief-summary__row">
                {task.title}
              </div>
            ))}
          </div>
        )}
      </div>

      {projection.artifacts.length > 0 && (
        <div className="panel-section">
          <SectionHeader title="Artifacts" count={projection.artifacts.length} countIntent="approved" />
          {projection.artifacts.map((art) => (
            <Card key={art.artifactId}>
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
            </Card>
          ))}
        </div>
      )}

      {resolvedApprovals.length > 0 && (
        <div className="panel-section">
          <SectionHeader title="Decisions" count={resolvedApprovals.length} countIntent="info" />
          {resolvedApprovals.map((appr) => (
            <Card key={appr.approvalId}>
              <div className="card-row">
                <div>
                  <div className="card-title">{appr.kind}</div>
                  <div className="card-meta">
                    {appr.approvalId} · {appr.taskId}
                    {appr.reason ? ` · ${appr.reason}` : ""}
                  </div>
                </div>
                <Badge intent={approvalStatusIntent(appr.status)}>{appr.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="panel-section event-log">
        <SectionHeader title="Event Timeline" count={eventLog.length} countIntent="info" />
        <div className="event-log__list">
          {sortedEvents.length === 0 && (
            <div className="event-log__empty">No events</div>
          )}
          {sortedEvents.map((event) => (
            <div key={event.eventId} className="event-row__wrapper">
              <div className="event-row">
                <span className="event-seq">#{event.sequence}</span>
                <span className="event-type">{event.type}</span>
                <span className="event-time">{formatTime(event.occurredAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function approvalStatusIntent(status: ApprovalView["status"]): BadgeIntent {
  switch (status) {
    case "requested":
      return "waiting";
    case "approved":
      return "approved";
    case "rejected":
      return "failed";
    case "expired":
    case "cancelled":
      return "idle";
    default:
      return "info";
  }
}
