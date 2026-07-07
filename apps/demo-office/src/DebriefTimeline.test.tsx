// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DebriefTimeline } from "./DebriefTimeline.js";
import { EventType } from "@agent-office/protocol";
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
  it("renders the session summary title", () => {
    render(<DebriefTimeline events={[]} />);
    expect(screen.getByText("Session Summary")).toBeInTheDocument();
  });

  it("shows empty state when there are no events", () => {
    render(<DebriefTimeline events={[]} />);
    expect(screen.getByText("No events recorded")).toBeInTheDocument();
  });

  it("summarizes tasks completed, approvals resolved, artifacts delivered, and total events", () => {
    const events = [
      makeEvent(EventType.TASK_CREATED, 1),
      makeEvent(EventType.TASK_COMPLETED, 2),
      makeEvent(EventType.APPROVAL_REQUESTED, 3),
      makeEvent(EventType.APPROVAL_RESOLVED, 4, { status: "approved" }),
      makeEvent(EventType.ARTIFACT_CREATED, 5),
      makeEvent(EventType.ARTIFACT_REVIEWED, 6, { verdict: "approved" }),
      makeEvent(EventType.ARTIFACT_REVIEWED, 7, { verdict: "revision_required" }),
    ];

    render(<DebriefTimeline events={events} />);

    expect(screen.getByTestId("summary-tasks-completed").textContent).toBe("1");
    expect(screen.getByTestId("summary-approvals-resolved").textContent).toBe("1");
    expect(screen.getByTestId("summary-artifacts-delivered").textContent).toBe("1");
    expect(screen.getByTestId("summary-events-count").textContent).toBe("7");
  });

  it("renders milestone events including task.blocked in the key timeline", () => {
    const events = [
      makeEvent(EventType.TASK_CREATED, 1),
      makeEvent(EventType.TASK_COMPLETED, 2),
      makeEvent(EventType.TASK_BLOCKED, 3),
      makeEvent(EventType.APPROVAL_REQUESTED, 4),
      makeEvent(EventType.APPROVAL_RESOLVED, 5, { status: "approved" }),
      makeEvent(EventType.ARTIFACT_CREATED, 6),
      makeEvent(EventType.ARTIFACT_REVIEWED, 7, { verdict: "approved" }),
      makeEvent(EventType.ARTIFACT_REVIEWED, 8, { verdict: "revision_required" }),
      makeEvent(EventType.TASK_FAILED, 9),
    ];

    render(<DebriefTimeline events={events} />);

    const rows = screen.getAllByTestId("debrief-timeline-row");
    expect(rows).toHaveLength(6);

    expect(screen.getByText(EventType.TASK_COMPLETED)).toBeInTheDocument();
    expect(screen.getByText(EventType.TASK_BLOCKED)).toBeInTheDocument();
    expect(screen.getByText(EventType.APPROVAL_RESOLVED)).toBeInTheDocument();
    expect(screen.getAllByText(EventType.ARTIFACT_REVIEWED)).toHaveLength(2);
    expect(screen.getByText(EventType.TASK_FAILED)).toBeInTheDocument();

    expect(screen.queryByText(EventType.TASK_CREATED)).not.toBeInTheDocument();
    expect(screen.queryByText(EventType.APPROVAL_REQUESTED)).not.toBeInTheDocument();
    expect(screen.queryByText(EventType.ARTIFACT_CREATED)).not.toBeInTheDocument();
  });

  it("displays outcome badges for terminal event types", () => {
    render(
      <DebriefTimeline
        events={[
          makeEvent(EventType.TASK_COMPLETED, 1),
          makeEvent(EventType.APPROVAL_RESOLVED, 2, { status: "rejected" }),
          makeEvent(EventType.TASK_BLOCKED, 3),
          makeEvent(EventType.ARTIFACT_REVIEWED, 4, { verdict: "revision_required" }),
          makeEvent(EventType.TASK_FAILED, 5),
        ]}
      />
    );

    expect(screen.getByText("completed")).toHaveClass(
      "debrief-timeline__outcome--success"
    );
    expect(screen.getByText("rejected")).toHaveClass(
      "debrief-timeline__outcome--failure"
    );
    expect(screen.getByText("blocked")).toHaveClass(
      "debrief-timeline__outcome--failure"
    );
    expect(screen.getByText("revision required")).toHaveClass(
      "debrief-timeline__outcome--warning"
    );
    expect(screen.getByText("failed")).toHaveClass(
      "debrief-timeline__outcome--failure"
    );
  });
});
