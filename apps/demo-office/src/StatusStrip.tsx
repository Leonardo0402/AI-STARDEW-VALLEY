/**
 * StatusStrip — functional instrumentation for runtime connection state.
 *
 * Displays: mode, runtimeId, session state, last sequence, resync/reconnect
 * counts, last error, and a reconnect button when recovery is allowed.
 *
 * This is NOT visual polish — it's a diagnostic surface. Minimal inline styles.
 */
import type { FC } from "react";
import type { SessionState, SessionDiagnostics } from "@agent-office/core";

interface StatusStripProps {
  mode: string;
  runtimeId: string;
  sessionState: SessionState;
  diagnostics: SessionDiagnostics;
  lastError: string | null;
  onReconnect: () => void;
}

const STATE_COLORS: Record<SessionState, string> = {
  connected: "#4caf50",
  connecting: "#ff9800",
  synchronizing: "#ff9800",
  resynchronizing: "#ff9800",
  degraded: "#ff9800",
  disconnected: "#666",
  failed: "#f44336",
};

export const StatusStrip: FC<StatusStripProps> = ({
  mode,
  runtimeId,
  sessionState,
  diagnostics,
  lastError,
  onReconnect,
}) => {
  const color = STATE_COLORS[sessionState] ?? "#666";
  const canReconnect =
    sessionState === "failed" || sessionState === "disconnected" || sessionState === "degraded";

  return (
    <div style={styles.strip}>
      <span style={styles.badge(color)}>{sessionState}</span>
      <span style={styles.label}>mode: <strong>{mode}</strong></span>
      <span style={styles.label}>id: <code>{runtimeId}</code></span>
      <span style={styles.label}>seq: {diagnostics.lastSequence}</span>
      <span style={styles.label}>resync: {diagnostics.resyncCount}</span>
      <span style={styles.label}>reconnect: {diagnostics.reconnectCount}</span>
      {lastError && (
        <span style={styles.error} title={lastError}>err: {lastError.slice(0, 40)}</span>
      )}
      {canReconnect && (
        <button style={styles.button} onClick={onReconnect}>
          Reconnect
        </button>
      )}
    </div>
  );
};

const styles: Record<string, any> = {
  strip: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "4px 12px",
    backgroundColor: "#0d0d1a",
    borderBottom: "1px solid #222",
    fontSize: 11,
    fontFamily: "monospace",
    color: "#aaa",
    flexWrap: "wrap" as const,
  },
  badge: (color: string): React.CSSProperties => ({
    backgroundColor: color,
    color: "#fff",
    padding: "2px 8px",
    borderRadius: 3,
    fontWeight: "bold",
    textTransform: "uppercase",
    fontSize: 10,
  }),
  label: { whiteSpace: "nowrap" as const },
  error: { color: "#ff6666", fontStyle: "italic" },
  button: {
    padding: "2px 8px",
    backgroundColor: "#333355",
    color: "#cccccc",
    border: "1px solid #555577",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "monospace",
  },
};
