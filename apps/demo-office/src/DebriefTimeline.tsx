import type { FC } from "react";
import type { DomainEvent } from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";
import { formatTime } from "@agent-office/control-ui";

interface DebriefTimelineProps {
  events: DomainEvent[];
}

const MILESTONE_TYPES: Set<string> = new Set([
  EventType.TASK_COMPLETED,
  EventType.APPROVAL_RESOLVED,
  EventType.ARTIFACT_REVIEWED,
  EventType.TASK_FAILED,
]);

export const DebriefTimeline: FC<DebriefTimelineProps> = ({ events }) => {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);

  const tasksCompleted = sorted.filter(
    (e) => e.type === EventType.TASK_COMPLETED
  ).length;
  const approvalsResolved = sorted.filter(
    (e) => e.type === EventType.APPROVAL_RESOLVED
  ).length;
  const artifactsDelivered = sorted.filter((e) => {
    if (e.type !== EventType.ARTIFACT_REVIEWED) return false;
    const verdict = (e.payload as { verdict?: string }).verdict;
    return verdict === "approved";
  }).length;

  const milestones = sorted.filter((e) => MILESTONE_TYPES.has(e.type));

  return (
    <div className="debrief-timeline" data-testid="debrief-timeline">
      <h2 className="debrief-timeline__title">Session Summary</h2>

      <div className="debrief-summary__cards">
        <div className="debrief-summary__card">
          <span
            className="debrief-summary__count debrief-summary__count--success"
            data-testid="summary-tasks-completed"
          >
            {tasksCompleted}
          </span>
          <span className="debrief-summary__label">Tasks completed</span>
        </div>
        <div className="debrief-summary__card">
          <span
            className="debrief-summary__count debrief-summary__count--urgency"
            data-testid="summary-approvals-resolved"
          >
            {approvalsResolved}
          </span>
          <span className="debrief-summary__label">Approvals resolved</span>
        </div>
        <div className="debrief-summary__card">
          <span
            className="debrief-summary__count debrief-summary__count--info"
            data-testid="summary-artifacts-delivered"
          >
            {artifactsDelivered}
          </span>
          <span className="debrief-summary__label">Artifacts delivered</span>
        </div>
        <div className="debrief-summary__card">
          <span
            className="debrief-summary__count debrief-summary__count--base"
            data-testid="summary-events-count"
          >
            {sorted.length}
          </span>
          <span className="debrief-summary__label">Events</span>
        </div>
      </div>

      <h3 className="debrief-timeline__subtitle">Key timeline</h3>
      <div className="debrief-timeline__list">
        {milestones.length === 0 && (
          <div className="debrief-timeline__empty">No events recorded</div>
        )}
        {milestones.map((event) => (
          <div
            key={event.eventId}
            className="debrief-timeline__row"
            data-testid="debrief-timeline-row"
          >
            <span className="debrief-timeline__time">
              {formatTime(event.occurredAt)}
            </span>
            <span className="debrief-timeline__seq">#{event.sequence}</span>
            <span className="debrief-timeline__type">{event.type}</span>
            {(() => {
              const outcome = eventOutcome(event);
              if (!outcome) return null;
              return (
                <span
                  className={`debrief-timeline__outcome debrief-timeline__outcome--${outcomeKind(outcome)}`}
                >
                  {outcome}
                </span>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
};

function eventOutcome(event: DomainEvent): string | null {
  switch (event.type) {
    case EventType.TASK_COMPLETED:
      return "completed";
    case EventType.TASK_BLOCKED:
      return "blocked";
    case EventType.TASK_FAILED:
      return "failed";
    case EventType.APPROVAL_RESOLVED: {
      const status = (event.payload as { status?: string }).status;
      if (status === "approved") return "approved";
      if (status === "rejected") return "rejected";
      return null;
    }
    case EventType.ARTIFACT_REVIEWED: {
      const verdict = (event.payload as { verdict?: string }).verdict;
      if (verdict === "approved") return "approved";
      if (verdict === "rejected" || verdict === "revision_required")
        return "rejected";
      return null;
    }
    default:
      return null;
  }
}

function outcomeKind(outcome: string): "success" | "failure" | "info" {
  switch (outcome) {
    case "completed":
    case "approved":
    case "delivered":
      return "success";
    case "blocked":
    case "failed":
    case "rejected":
      return "failure";
    default:
      return "info";
  }
}
