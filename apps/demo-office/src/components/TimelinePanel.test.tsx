// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelinePanel } from "./TimelinePanel.js";
import { EventType, type DomainEvent } from "@agent-office/protocol";

function makeEvent(
  overrides: Partial<DomainEvent> & { eventId: string; type: string; sequence: number }
): DomainEvent {
  return {
    runtimeId: "r",
    schemaVersion: "1.0",
    occurredAt: "2026-01-01T00:00:00Z",
    receivedAt: "2026-01-01T00:00:00Z",
    correlationId: "c",
    causationId: null,
    traceId: "t",
    payload: {},
    ...overrides,
  } as DomainEvent;
}

describe("TimelinePanel", () => {
  it("renders filtered events in sequence order", () => {
    const events = [
      makeEvent({ eventId: "e2", type: EventType.REVIEW_ASSIGNED, sequence: 2, payload: { agentId: "a1" } }),
      makeEvent({ eventId: "e1", type: EventType.TASK_CREATED, sequence: 1, payload: { taskId: "t1" } }),
      makeEvent({ eventId: "e3", type: EventType.AGENT_STATUS_CHANGED, sequence: 3, payload: {} }),
    ];
    const { container } = render(<TimelinePanel events={events} />);

    expect(screen.getByText(EventType.TASK_CREATED)).toBeInTheDocument();
    expect(screen.getByText(EventType.REVIEW_ASSIGNED)).toBeInTheDocument();
    expect(screen.queryByText(EventType.AGENT_STATUS_CHANGED)).not.toBeInTheDocument();

    const typeCells = container.querySelectorAll(".timeline-type");
    expect(typeCells).toHaveLength(2);
    expect(typeCells[0].textContent).toBe(EventType.TASK_CREATED);
    expect(typeCells[1].textContent).toBe(EventType.REVIEW_ASSIGNED);
  });

  it("shows empty state", () => {
    render(<TimelinePanel events={[]} />);
    expect(screen.getByText("No relevant events.")).toBeInTheDocument();
  });

  it("summarizes task and review events", () => {
    const events = [
      makeEvent({ eventId: "e1", type: EventType.TASK_CREATED, sequence: 1, payload: { taskId: "t1" } }),
      makeEvent({ eventId: "e2", type: EventType.REVIEW_ASSIGNED, sequence: 2, payload: { agentId: "a1" } }),
      makeEvent({ eventId: "e3", type: EventType.AUDIT_NOTE_ADDED, sequence: 3, payload: { author: "auditor-1" } }),
    ];
    render(<TimelinePanel events={events} />);
    expect(screen.getByText("Task t1")).toBeInTheDocument();
    expect(screen.getByText("Review assigned to a1")).toBeInTheDocument();
    expect(screen.getByText("Audit note by auditor-1")).toBeInTheDocument();
  });
});
