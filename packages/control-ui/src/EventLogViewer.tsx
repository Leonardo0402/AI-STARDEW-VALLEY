/**
 * EventLogViewer — 事件日志查看器。
 *
 * 设计原则：
 * - 日志天然是列表，使用普通表格展示而非空间化
 * - 只读，不允许在此处修改事件
 * - 显示事件核心信息：sequence、type、occurredAt、payload 摘要
 */
import { useState, type FC } from "react";
import type { DomainEvent } from "@agent-office/protocol";

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
    <div style={styles.section}>
      <h3 style={styles.h3}>事件日志 ({events.length})</h3>
      <input
        style={styles.input}
        placeholder="按类型过滤（如 task.、approval.）"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div style={styles.logContainer}>
        {sorted.length === 0 && (
          <div style={styles.empty}>无事件</div>
        )}
        {sorted.map((event) => {
          const isExpanded = expanded === event.eventId;
          return (
            <div key={event.eventId} style={styles.logRow}>
              <div
                style={styles.logHeader}
                onClick={() =>
                  setExpanded(isExpanded ? null : event.eventId)
                }
              >
                <span style={styles.seq}>#{event.sequence}</span>
                <span style={styles.type}>{event.type}</span>
                <span style={styles.time}>
                  {new Date(event.occurredAt).toLocaleTimeString()}
                </span>
              </div>
              {isExpanded && (
                <pre style={styles.payload}>
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

const styles: Record<string, React.CSSProperties> = {
  section: {
    borderTop: "1px solid #333",
    paddingTop: 12,
  },
  h3: {
    margin: "0 0 8px 0",
    fontSize: 14,
    color: "#88ccff",
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
  logContainer: {
    maxHeight: 300,
    overflowY: "auto" as const,
    border: "1px solid #333355",
    borderRadius: 3,
    backgroundColor: "#111122",
  },
  empty: {
    padding: 12,
    color: "#666666",
    textAlign: "center" as const,
    fontSize: 11,
  },
  logRow: {
    borderBottom: "1px solid #222233",
  },
  logHeader: {
    display: "flex",
    gap: 8,
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: 11,
    alignItems: "center",
  },
  seq: {
    color: "#888888",
    minWidth: 40,
  },
  type: {
    color: "#88ccff",
    flex: 1,
    fontWeight: "bold",
  },
  time: {
    color: "#666666",
    fontSize: 10,
  },
  payload: {
    margin: 0,
    padding: 8,
    backgroundColor: "#0a0a14",
    color: "#aaaaaa",
    fontSize: 10,
    fontFamily: "monospace",
    overflowX: "auto" as const,
    whiteSpace: "pre-wrap" as const,
  },
};
