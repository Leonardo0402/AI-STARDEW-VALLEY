import type { FC } from "react";
import { EventType } from "@agent-office/protocol";
import type { TimelineIntegrationView } from "../integration/types.js";
import { SectionHeader } from "./SectionHeader.js";

interface TimelinePanelProps {
  timeline: TimelineIntegrationView | null;
}

export const TimelinePanel: FC<TimelinePanelProps> = ({ timeline }) => {
  const events = (timeline?.events ?? []).slice().sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="panel-section" data-testid="timeline-panel">
      <SectionHeader title="Timeline" count={events.length} countIntent="info" />
      {events.length === 0 ? (
        <div className="panel-empty">No relevant events.</div>
      ) : (
        <div className="timeline-list">
          {events.map((event) => (
            <div key={event.eventId} className="timeline-row">
              <div className="timeline-time">
                <div>{event.eventId}</div>
                <div>{formatTime(event.timestamp)}</div>
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

function summarizeEvent(event: { type: string; payload: Record<string, unknown> }): string {
  switch (event.type) {
    case EventType.TASK_CREATED:
      return `Task ${(event.payload.taskId as string | undefined) ?? ""}`;
    case EventType.ARTIFACT_CREATED:
      return `Artifact ${(event.payload.artifactId as string | undefined) ?? ""}`;
    case EventType.REVIEW_ASSIGNED:
      return `Review assigned to ${(event.payload.agentId as string | undefined) ?? ""}`;
    case EventType.REVIEW_SUBMITTED:
      return `Review submitted: ${(event.payload.verdict as string | undefined) ?? ""}`;
    case EventType.ARTIFACT_REVIEWED:
      return `Review finalized: ${(event.payload.verdict as string | undefined) ?? ""}`;
    case EventType.AUDIT_NOTE_ADDED:
      return `Audit note by ${(event.payload.author as string | undefined) ?? ""}`;
    default:
      return event.type;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
