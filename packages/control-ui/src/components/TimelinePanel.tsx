import type { FC } from "react";
import { EventType, type DomainEvent } from "@agent-office/protocol";
import { SectionHeader } from "./SectionHeader.js";

interface TimelinePanelProps {
  events: DomainEvent[];
}

const TIMELINE_EVENT_TYPES: Set<string> = new Set([
  EventType.TASK_CREATED,
  EventType.ARTIFACT_CREATED,
  EventType.ARTIFACT_DRAFTED,
  EventType.ARTIFACT_REVIEW_REQUESTED,
  EventType.REVIEW_ASSIGNED,
  EventType.REVIEW_SUBMITTED,
  EventType.ARTIFACT_REVIEWED,
  EventType.AUDIT_NOTE_ADDED,
]);

export const TimelinePanel: FC<TimelinePanelProps> = ({ events }) => {
  const filtered = events
    .filter((e) => TIMELINE_EVENT_TYPES.has(e.type))
    .sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="panel-section" data-testid="timeline-panel">
      <SectionHeader title="Timeline" count={filtered.length} countIntent="info" />
      {filtered.length === 0 ? (
        <div className="panel-empty">No relevant events.</div>
      ) : (
        <div className="timeline-list">
          {filtered.map((event) => (
            <div key={event.eventId} className="timeline-row">
              <div className="timeline-time">
                <div>#{event.sequence}</div>
                <div>{formatTime(event.occurredAt)}</div>
              </div>
              <div className="timeline-content">
                <div className="timeline-type">{event.type}</div>
                <div className="timeline-summary">{summarizeEvent(event)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function summarizeEvent(event: DomainEvent): string {
  switch (event.type) {
    case EventType.TASK_CREATED:
      return `Task ${(event.payload as { taskId?: string }).taskId ?? ""}`;
    case EventType.ARTIFACT_CREATED:
      return `Artifact ${(event.payload as { artifactId?: string }).artifactId ?? ""}`;
    case EventType.REVIEW_ASSIGNED:
      return `Review assigned to ${(event.payload as { agentId?: string }).agentId ?? ""}`;
    case EventType.REVIEW_SUBMITTED:
      return `Review submitted: ${(event.payload as { verdict?: string }).verdict ?? ""}`;
    case EventType.ARTIFACT_REVIEWED:
      return `Review finalized: ${(event.payload as { verdict?: string }).verdict ?? ""}`;
    case EventType.AUDIT_NOTE_ADDED:
      return `Audit note by ${(event.payload as { author?: string }).author ?? ""}`;
    default:
      return event.eventId;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
