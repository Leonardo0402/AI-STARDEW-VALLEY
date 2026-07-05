/**
 * StatusStrip — runtime connection and diagnostics surface.
 *
 * Layout (high-fidelity):
 *   left:  connection pill, runtime id, sequence number
 *   right: last event type + timestamp, recovery action when allowed
 *
 * Recovery policy:
 *   - degraded        → Resynchronize
 *   - failed / disconnected with rebuildable composition → Retry
 *   - otherwise       → Reload / Restart Runtime
 */
import type { FC } from "react";
import type { SessionState, SessionDiagnostics } from "@agent-office/core";
import type { DemoRuntimeMode } from "./runtime/types.js";

interface StatusStripProps {
  mode: DemoRuntimeMode;
  runtimeId: string;
  sessionState: SessionState;
  diagnostics: SessionDiagnostics;
  lastError: string | null;
  lastEvent?: { type: string; timestamp: string } | null;
  retryable?: boolean;
  onResync: () => void;
  onReload: () => void;
  onRetry?: () => void;
}

const STRIP_MODIFIERS: Record<SessionState, string> = {
  connected: "",
  connecting: "",
  synchronizing: "",
  resynchronizing: "",
  degraded: "status-strip--urgency",
  disconnected: "status-strip--failure",
  failed: "status-strip--failure",
};

const DOT_CLASSES: Record<SessionState, string> = {
  connected: "status-dot--success",
  connecting: "status-dot--urgency",
  synchronizing: "status-dot--urgency",
  resynchronizing: "status-dot--urgency",
  degraded: "status-dot--urgency",
  disconnected: "status-dot--dim",
  failed: "status-dot--failure",
};

const PILL_LABELS: Record<SessionState, string> = {
  connected: "connected",
  connecting: "connecting",
  synchronizing: "synchronizing",
  resynchronizing: "resyncing",
  degraded: "degraded",
  disconnected: "disconnected",
  failed: "error",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toISOString().slice(11, 19);
}

function classNames(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

export const StatusStrip: FC<StatusStripProps> = ({
  runtimeId,
  sessionState,
  diagnostics,
  lastEvent,
  retryable = false,
  onResync,
  onReload,
  onRetry,
}) => {
  const isFailure = sessionState === "failed" || sessionState === "disconnected";
  const isUrgency = sessionState === "degraded";
  const showErrorDetails = isFailure && diagnostics.lastError;

  let actionButton: JSX.Element | null = null;
  if (sessionState === "degraded") {
    actionButton = (
      <button className="status-action" onClick={onResync}>
        Resynchronize
      </button>
    );
  } else if (isFailure) {
    if (retryable && onRetry) {
      actionButton = (
        <button className="status-action" onClick={onRetry}>
          Retry
        </button>
      );
    } else {
      actionButton = (
        <button className="status-action" onClick={onReload}>
          Reload
        </button>
      );
    }
  }

  return (
    <div
      data-testid="status-strip"
      className={classNames("status-strip", STRIP_MODIFIERS[sessionState])}
    >
      <div className="status-left">
        <span className="status-pill">
          <span className={classNames("status-dot", DOT_CLASSES[sessionState])} />
          {PILL_LABELS[sessionState]}
        </span>
        {showErrorDetails && (
          <>
            <span className="status-error-code">{diagnostics.lastError!.code}</span>
            <span className="status-message">{diagnostics.lastError!.message}</span>
          </>
        )}
        <span className="status-label">runtime: {runtimeId}</span>
        <span className="status-data">seq: {diagnostics.lastSequence}</span>
      </div>
      <div className="status-right">
        {lastEvent ? (
          <>
            <span className="status-label">last event: {lastEvent.type}</span>
            <span className="status-data">{formatTime(lastEvent.timestamp)}</span>
          </>
        ) : (
          <span className="status-label">—</span>
        )}
        {actionButton}
      </div>
    </div>
  );
};
