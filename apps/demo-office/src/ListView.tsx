/**
 * ListView — 普通列表视图（Dashboard 对照）。
 *
 * 用于和像素空间视图对照比较：
 * - 同样的 OfficeProjection 数据
 * - 用传统表格 + 列表呈现
 * - 不使用任何空间化表达
 *
 * 这是为了让用户能直观对比"空间表达 vs 传统 Dashboard"的差异。
 */
import type { FC, KeyboardEvent } from "react";
import type { OfficeProjection } from "@agent-office/protocol";
import type { OfficeSelection } from "@agent-office/pixel-office";

interface ListViewProps {
  projection: OfficeProjection;
  selection?: OfficeSelection | null;
  onSelect?: (selection: OfficeSelection) => void;
}

export const ListView: FC<ListViewProps> = ({ projection, selection = null, onSelect }) => {
  const isSelected = (kind: OfficeSelection["kind"], id: string): boolean =>
    selection?.kind === kind && selection?.id === id;

  const handleSelect = (kind: OfficeSelection["kind"], id: string): void => {
    onSelect?.({ kind, id });
  };

  const handleRowKeyDown =
    (kind: OfficeSelection["kind"], id: string) =>
    (e: KeyboardEvent<HTMLTableRowElement | HTMLDivElement>): void => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.({ kind, id });
      }
    };

  const rowProps = (kind: OfficeSelection["kind"], id: string) => ({
    tabIndex: onSelect ? 0 : undefined,
    "aria-selected": isSelected(kind, id),
    className: `list-view__row ${isSelected(kind, id) ? "list-view__row--selected" : ""}`,
    onClick: () => handleSelect(kind, id),
    onKeyDown: handleRowKeyDown(kind, id),
    style: styles.tr,
  });

  const roomCardProps = (room: { roomId: string; name: string }) => ({
    role: "button" as const,
    tabIndex: onSelect ? 0 : undefined,
    "aria-selected": isSelected("room", room.roomId),
    "aria-label": `Select room ${room.name}`,
    className: `list-view__room-card ${isSelected("room", room.roomId) ? "list-view__row--selected" : ""}`,
    onClick: () => handleSelect("room", room.roomId),
    onKeyDown: handleRowKeyDown("room", room.roomId),
  });
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Dashboard 视图（传统列表）</h2>
      <p style={styles.hint}>
        此视图与左侧像素空间视图共享同一 OfficeProjection，便于对照比较。
      </p>

      {/* 状态摘要 */}
      <div style={styles.summaryRow}>
        <div style={styles.summaryBox}>
          <div style={styles.summaryNum}>{projection.agents.length}</div>
          <div style={styles.summaryLabel}>Agents</div>
        </div>
        <div style={styles.summaryBox}>
          <div style={styles.summaryNum}>{projection.tasks.length}</div>
          <div style={styles.summaryLabel}>Tasks</div>
        </div>
        <div style={styles.summaryBox}>
          <div style={styles.summaryNum}>{projection.artifacts.length}</div>
          <div style={styles.summaryLabel}>Artifacts</div>
        </div>
        <div style={{ ...styles.summaryBox, borderColor: "var(--urgency)" }}>
          <div style={{ ...styles.summaryNum, color: "var(--urgency)" }}>
            {projection.pendingApprovals.length}
          </div>
          <div style={styles.summaryLabel}>Pending</div>
        </div>
        <div style={{ ...styles.summaryBox, borderColor: "var(--failure)" }}>
          <div style={{ ...styles.summaryNum, color: "var(--failure)" }}>
            {projection.blockedTasks.length}
          </div>
          <div style={styles.summaryLabel}>Blocked</div>
        </div>
      </div>

      {/* Agents 表格 */}
      <section style={styles.section}>
        <h3 style={styles.h3}>Agents</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>名称</th>
              <th style={styles.th}>角色</th>
              <th style={styles.th}>状态</th>
              <th style={styles.th}>当前任务</th>
              <th style={styles.th}>所在房间</th>
              <th style={styles.th}>阻塞原因</th>
            </tr>
          </thead>
          <tbody>
            {projection.agents.map((a) => {
              const room = projection.rooms.find((r) => r.roomId === a.currentRoomId);
              return (
                <tr key={a.agentId} {...rowProps("agent", a.agentId)}>
                  <td style={styles.td}>{a.agentId}</td>
                  <td style={styles.td}>{a.name}</td>
                  <td style={styles.td}>{a.role}</td>
                  <td style={{ ...styles.td, ...statusColor(a.status) }}>{a.status}</td>
                  <td style={styles.td}>{a.currentTaskId ?? "—"}</td>
                  <td style={styles.td}>{room?.name ?? "—"}</td>
                  <td style={{ ...styles.td, color: "var(--failure)" }}>{a.blockedReason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Tasks 表格 */}
      <section style={styles.section}>
        <h3 style={styles.h3}>Tasks</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>标题</th>
              <th style={styles.th}>状态</th>
              <th style={styles.th}>优先级</th>
              <th style={styles.th}>负责人</th>
              <th style={styles.th}>所在房间</th>
              <th style={styles.th}>审批</th>
              <th style={styles.th}>阻塞</th>
            </tr>
          </thead>
          <tbody>
            {projection.tasks.map((t) => {
              const room = projection.rooms.find((r) => r.roomId === t.roomId);
              return (
                <tr key={t.taskId} {...rowProps("task", t.taskId)}>
                  <td style={styles.td}>{t.taskId}</td>
                  <td style={styles.td}>{t.title}</td>
                  <td style={{ ...styles.td, ...taskStatusColor(t.status) }}>{t.status}</td>
                  <td style={styles.td}>{t.priority}</td>
                  <td style={styles.td}>{t.assigneeId ?? "—"}</td>
                  <td style={styles.td}>{room?.name ?? "—"}</td>
                  <td style={styles.td}>{t.approvalId ?? "—"}</td>
                  <td style={{ ...styles.td, color: "var(--failure)" }}>{t.blockedReason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Artifacts 表格 */}
      {projection.artifacts.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.h3}>Artifacts</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>标题</th>
                <th style={styles.th}>类型</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>版本</th>
                <th style={styles.th}>审查结果</th>
              </tr>
            </thead>
            <tbody>
              {projection.artifacts.map((a) => (
                <tr key={a.artifactId} {...rowProps("artifact", a.artifactId)}>
                  <td style={styles.td}>{a.artifactId}</td>
                  <td style={styles.td}>{a.title}</td>
                  <td style={styles.td}>{a.type}</td>
                  <td style={{ ...styles.td, ...artifactStatusColor(a.status) }}>{a.status}</td>
                  <td style={styles.td}>v{a.version}</td>
                  <td style={styles.td}>
                    {a.reviewResult
                      ? `${a.reviewResult.verdict} — ${a.reviewResult.comment}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Approvals 表格 */}
      {projection.approvals.length > 0 && (
        <section style={styles.section}>
          <h3 style={styles.h3}>Approvals</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>任务</th>
                <th style={styles.th}>类型</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>请求人</th>
                <th style={styles.th}>原因</th>
              </tr>
            </thead>
            <tbody>
              {projection.approvals.map((a) => (
                <tr key={a.approvalId} {...rowProps("approval", a.approvalId)}>
                  <td style={styles.td}>{a.approvalId}</td>
                  <td style={styles.td}>{a.taskId}</td>
                  <td style={styles.td}>{a.kind}</td>
                  <td style={{ ...styles.td, ...approvalStatusColor(a.status) }}>{a.status}</td>
                  <td style={styles.td}>{a.requestedBy}</td>
                  <td style={styles.td}>{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Rooms */}
      <section style={styles.section}>
        <h3 style={styles.h3}>Rooms</h3>
        <div style={styles.roomGrid}>
          {projection.rooms.map((r) => (
            <div key={r.roomId} {...roomCardProps(r)} style={styles.roomCard}>
              <div style={styles.roomName}>{r.name}</div>
              <div style={styles.roomType}>{r.type}</div>
              <div style={styles.roomAgents}>
                活跃 Agents: {r.activeAgentIds.length}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// ─── 状态颜色辅助 ────────────────────────────────────────────
function statusColor(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    idle: "var(--base-400)",
    working: "var(--success)",
    blocked: "var(--failure)",
    paused: "var(--base-400)",
    reviewing: "var(--info)",
    failed: "var(--failure)",
  };
  return { color: map[status] ?? "var(--base-300)" };
}

function taskStatusColor(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    running: "var(--success)",
    blocked: "var(--failure)",
    completed: "var(--info)",
    waiting_approval: "var(--urgency)",
    revision_required: "var(--urgency)",
    failed: "var(--failure)",
  };
  return { color: map[status] ?? "var(--base-300)" };
}

function artifactStatusColor(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    generated: "var(--base-300)",
    approved: "var(--success)",
    revision_required: "var(--urgency)",
    rejected: "var(--failure)",
    delivered: "var(--info)",
  };
  return { color: map[status] ?? "var(--base-300)" };
}

function approvalStatusColor(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    requested: "var(--urgency)",
    approved: "var(--success)",
    rejected: "var(--failure)",
    expired: "var(--base-400)",
  };
  return { color: map[status] ?? "var(--base-300)" };
}

// ─── 样式 ────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    height: "100%",
    overflowY: "auto",
    padding: 16,
    backgroundColor: "var(--base-850)",
    color: "var(--base-100)",
    fontFamily: "var(--font-ui), system-ui, sans-serif",
  },
  title: {
    margin: "0 0 4px 0",
    fontSize: 18,
    color: "var(--info)",
  },
  hint: {
    margin: "0 0 16px 0",
    fontSize: 11,
    color: "var(--base-400)",
  },
  summaryRow: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
  },
  summaryBox: {
    padding: 12,
    border: "1px solid var(--base-500)",
    borderRadius: 4,
    minWidth: 90,
    textAlign: "center" as const,
    backgroundColor: "var(--base-800)",
  },
  summaryNum: {
    fontSize: 24,
    fontWeight: "bold",
    color: "var(--base-100)",
  },
  summaryLabel: {
    fontSize: 10,
    color: "var(--base-400)",
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  h3: {
    margin: "0 0 8px 0",
    fontSize: 14,
    color: "var(--info)",
    borderBottom: "1px solid var(--base-500)",
    paddingBottom: 4,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 12,
  },
  th: {
    textAlign: "left" as const,
    padding: "6px 8px",
    borderBottom: "1px solid var(--base-500)",
    color: "var(--base-300)",
    fontSize: 11,
    fontWeight: "bold",
  },
  tr: {
    borderBottom: "1px solid var(--base-700)",
  },
  td: {
    padding: "4px 8px",
    color: "var(--base-100)",
    fontSize: 11,
    verticalAlign: "top" as const,
  },
  roomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 8,
  },
  roomCard: {
    padding: 8,
    border: "1px solid var(--base-500)",
    borderRadius: 4,
    backgroundColor: "var(--base-800)",
  },
  roomName: {
    fontSize: 13,
    fontWeight: "bold",
    color: "var(--base-100)",
  },
  roomType: {
    fontSize: 10,
    color: "var(--base-400)",
    marginTop: 2,
  },
  roomAgents: {
    fontSize: 10,
    color: "var(--base-300)",
    marginTop: 4,
  },
};
