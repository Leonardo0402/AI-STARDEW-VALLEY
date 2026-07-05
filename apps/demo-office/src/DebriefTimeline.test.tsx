// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DebriefTimeline } from "./DebriefTimeline.js";
import type { DomainEvent } from "@agent-office/protocol";

function makeEvent(type: string, sequence: number, payload: Record<string, unknown> = {}): DomainEvent {
  return {
    eventId: `evt-${sequence}`,
    runtimeId: "runtime-001",
    sequence,
    schemaVersion: "1",
    type,
    occurredAt: new Date(Date.UTC(2024, 0, 1, 0, 0, sequence)).toISOString(),
    receivedAt: new Date().toISOString(),
    correlationId: "corr-1",
    causationId: null,
    traceId: "trace-1",
    payload,
  };
}

describe("DebriefTimeline", () => {
  it("renders event type and sequence", () => {
    render(<DebriefTimeline events={[makeEvent("task.created", 1)]} />);
    expect(screen.getByText("task.created")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("shows empty state when there are no events", () => {
    render(<DebriefTimeline events={[]} />);
    expect(screen.getByText("No events recorded")).toBeInTheDocument();
  });

  it("displays outcome badges for terminal event types", () => {
    render(
      <DebriefTimeline
        events={[
          makeEvent("task.completed", 1),
          makeEvent("approval.resolved", 2, { status: "rejected" }),
          makeEvent("task.created", 3),
        ]}
      />
    );

    expect(screen.getByText("completed")).toHaveClass(
      "debrief-timeline__outcome--success"
    );
    expect(screen.getByText("rejected")).toHaveClass(
      "debrief-timeline__outcome--failure"
    );
    const createdRow = screen.getByText("task.created").closest(".debrief-timeline__row");
    expect(createdRow?.querySelector(".debrief-timeline__outcome")).not.toBeInTheDocument();
  });
});
