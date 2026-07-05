import type { FC } from "react";
import type { DomainEvent } from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";
import { formatTime } from "@agent-office/control-ui";

interface DebriefTimelineProps {
  events: DomainEvent[];
}

export const DebriefTimeline: FC<DebriefTimelineProps> = ({ events }) => {
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="debrief-timeline" data-testid="debrief-timeline">
      <h2 className="debrief-timeline__title">Session Timeline</h2>
      <div className="debrief-timeline__list">
        {sorted.length === 0 && (
          <div className="debrief-timeline__empty">No events recorded</div>
        )}
        {sorted.map((event) => (
          <div key={event.eventId} className="debrief-timeline__row">
            <span className="debrief-timeline__time">{formatTime(event.occurredAt)}</span>
            <span className="debrief-timeline__seq">#{event.sequence}</span>
            <span className="debrief-timeline__type">{event.type}</span>
            {(() => {
              const outcome = eventOutcome(event);
              if (!outcome) return null;
              return (
                <span className={`debrief-timeline__outcome debrief-timeline__outcome--${outcomeKind(outcome)}`}>
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
      if (verdict === "rejected" || verdict === "revision_required") return "rejected";
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
