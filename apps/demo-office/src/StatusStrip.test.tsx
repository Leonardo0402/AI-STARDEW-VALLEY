// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StatusStrip } from "./StatusStrip.js";
import type { SessionState, SessionDiagnostics } from "@agent-office/core";

const baseDiagnostics: SessionDiagnostics = {
  state: "connected" as SessionState,
  lastSequence: 842,
  lastError: null,
  lastGap: null,
  resyncCount: 1,
  reconnectCount: 0,
  hasActiveSubscription: true,
  activeSubscriptionCursor: 842,
};

function renderStrip(props: Partial<Parameters<typeof StatusStrip>[0]> = {}) {
  const defaults: Parameters<typeof StatusStrip>[0] = {
    runtimeId: "qclaw-swarm-runtime-001",
    sessionState: "connected" as SessionState,
    diagnostics: baseDiagnostics,
    lastEvent: { type: "artifact.reviewed", timestamp: "2026-07-05T12:04:18.000Z" },
    onResync: vi.fn(),
    onReload: vi.fn(),
  };
  return render(<StatusStrip {...defaults} {...props} />);
}

describe("StatusStrip", () => {
  it("renders healthy connection state and last event", () => {
    renderStrip();
    expect(screen.getByText("connected")).toBeInTheDocument();
    expect(screen.getByText(/qclaw-swarm-runtime-001/)).toBeInTheDocument();
    expect(screen.getByText(/842/)).toBeInTheDocument();
    expect(screen.getByText(/artifact.reviewed/)).toBeInTheDocument();
    // formatTime uses the runtime locale; just assert a time string is present.
    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows disconnected state without recovery when not retryable", () => {
    const onReload = vi.fn();
    renderStrip({ sessionState: "disconnected", retryable: false, onReload });
    expect(screen.getByText("disconnected")).toBeInTheDocument();
    const reloadBtn = screen.getByRole("button", { name: /Reload/i });
    fireEvent.click(reloadBtn);
    expect(onReload).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Resynchronize/i })).not.toBeInTheDocument();
  });

  it("shows Retry for failed state when retryable", () => {
    const onRetry = vi.fn();
    const onReload = vi.fn();
    const diagnostics: SessionDiagnostics = {
      ...baseDiagnostics,
      state: "failed",
      lastError: { code: "subscribe_failed", message: "stream closed", at: "2026-07-05T12:04:18.000Z" },
    };
    renderStrip({ sessionState: "failed", retryable: true, onRetry, onReload, diagnostics });
    expect(screen.getByText("subscribe_failed")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
  });

  it("shows Reload for failed state when not retryable", () => {
    const onReload = vi.fn();
    renderStrip({ sessionState: "failed", retryable: false, onReload });
    expect(screen.getByText("failed")).toBeInTheDocument();
    const reloadBtn = screen.getByRole("button", { name: /Reload/i });
    fireEvent.click(reloadBtn);
    expect(onReload).toHaveBeenCalled();
  });

  it("shows Resynchronize only when session is degraded", () => {
    const onResync = vi.fn();
    renderStrip({ sessionState: "degraded", onResync });
    const resyncBtn = screen.getByRole("button", { name: /Resynchronize/i });
    fireEvent.click(resyncBtn);
    expect(onResync).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Retry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reload/i })).not.toBeInTheDocument();
  });

  it("shows failure modifier and projection error code when failedCount is greater than zero", () => {
    renderStrip({
      sessionState: "connected",
      failedCount: 1,
      failedError: { code: "task_failed", message: "agent failed" },
    });
    const strip = screen.getByTestId("status-strip");
    expect(strip.classList.contains("status-strip--failure")).toBe(true);
    expect(screen.getByText("task_failed")).toBeInTheDocument();
    expect(screen.getByText("agent failed")).toBeInTheDocument();
  });

  it("does not show failure modifier when session is healthy and no failed projection items", () => {
    renderStrip({ sessionState: "connected" });
    const strip = screen.getByTestId("status-strip");
    expect(strip.classList.contains("status-strip--failure")).toBe(false);
    expect(strip.classList.contains("status-strip--urgency")).toBe(false);
  });
});
