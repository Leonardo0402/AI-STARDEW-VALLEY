/**
 * EventLogViewer — 事件日志查看器。
 *
 * 设计原则：
 * - 日志天然是列表，使用事件行展示而非空间化
 * - 只读，不允许在此处修改事件
 * - 显示事件核心信息：sequence、type、摘要、occurredAt
 */
import { useState, type FC } from "react";
import type { DomainEvent } from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";
import { SectionHeader } from "./components/SectionHeader.js";
import { formatTime } from "./components/format-time.js";

interface EventLogViewerProps {
  events: DomainEvent[];
}

export const EventLogViewer: FC<EventLogViewerProps> = ({ events }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  const filtered = filter
    ? events.filter((e) => e.type.includes(filter))
    : events;

  const sorted = [...filtered].sort((a, b) => b.sequence - a.sequence);

  return (
    <div className="panel-section event-log">
      <SectionHeader title="Event Log" count={events.length} countIntent="info" />
      <input
        className="input"
        placeholder="Filter by type (e.g. task., approval.)"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="event-log__list">
        {sorted.length === 0 && (
          <div className="event-log__empty">No events</div>
        )}
        {sorted.map((event) => {
          const isExpanded = expanded === event.eventId;
          return (
            <div key={event.eventId} className="event-row__wrapper">
              <div
                className="event-row"
                onClick={() => setExpanded(isExpanded ? null : event.eventId)}
              >
                <span className="event-seq">#{event.sequence}</span>
                <span className="event-type">{event.type}</span>
                <span className="event-summary">{eventSummary(event)}</span>
                <span className="event-time">{formatTime(event.occurredAt)}</span>
              </div>
              {isExpanded && (
                <pre className="event-payload">
                  {JSON.stringify(event, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function eventSummary(event: DomainEvent): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case EventType.TASK_CREATED:
      return typeof p.title === "string" ? p.title : "—";
    case EventType.TASK_ASSIGNED:
    case EventType.TASK_STARTED:
      return typeof p.agentId === "string" ? p.agentId : "—";
    case EventType.TASK_BLOCKED:
    case EventType.TASK_FAILED:
      return typeof p.reason === "string" ? p.reason : "—";
    case EventType.AGENT_STATUS_CHANGED:
      return `${p.oldStatus ?? "?"} → ${p.newStatus ?? "?"}`;
    case EventType.APPROVAL_REQUESTED:
      return typeof p.reason === "string" ? p.reason : "—";
    case EventType.ARTIFACT_REVIEWED:
      return typeof p.verdict === "string" ? p.verdict : "—";
    case EventType.ERROR_RAISED:
      return typeof p.message === "string" ? p.message : "—";
    default:
      return "—";
  }
}
