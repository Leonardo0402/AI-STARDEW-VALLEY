// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventLogViewer } from "./EventLogViewer.js";
import { EventType } from "@agent-office/protocol";
import type { DomainEvent } from "@agent-office/protocol";

const baseEvent: DomainEvent = {
  eventId: "evt-1",
  runtimeId: "runtime-001",
  sequence: 1,
  schemaVersion: "1",
  type: EventType.TASK_CREATED,
  occurredAt: "2026-07-05T12:00:00.000Z",
  receivedAt: "2026-07-05T12:00:00.000Z",
  correlationId: "corr-1",
  causationId: null,
  traceId: "trace-1",
  payload: { title: "Sample task" },
};

function renderViewer(events: DomainEvent[] = [baseEvent]) {
  return render(<EventLogViewer events={events} />);
}

describe("EventLogViewer accessibility", () => {
  it("renders each event row as a keyboard-focusable toggle", () => {
    renderViewer();
    const row = screen.getByRole("button", { name: /task.created/i });
    expect(row).toHaveAttribute("tabIndex", "0");
    expect(row).toHaveAttribute("aria-expanded", "false");
  });

  it("expands a row on Enter key and shows payload", () => {
    renderViewer();
    const row = screen.getByRole("button", { name: /task.created/i });
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(row).toHaveAttribute("aria-expanded", "true");
    const payload = row.parentElement?.querySelector(".event-payload");
    expect(payload).toBeInTheDocument();
    expect(payload).toHaveTextContent(/Sample task/);
  });

  it("expands a row on Space key", () => {
    renderViewer();
    const row = screen.getByRole("button", { name: /task.created/i });
    row.focus();
    fireEvent.keyDown(row, { key: " " });
    expect(row).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses an expanded row on click", () => {
    renderViewer();
    const row = screen.getByRole("button", { name: /task.created/i });
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "false");
  });
});
