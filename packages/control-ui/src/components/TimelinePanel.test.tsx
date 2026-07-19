// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelinePanel } from "./TimelinePanel.js";
import { EventType } from "@agent-office/protocol";
import type { TimelineIntegrationView } from "../integration/types.js";

function makeTimeline(events: { eventId: string; sequence: number; type: string; timestamp: string; payload: Record<string, unknown> }[]): TimelineIntegrationView {
  return { events };
}

describe("TimelinePanel", () => {
  it("renders timeline events in order", () => {
    const timeline = makeTimeline([
      { eventId: "e2", sequence: 2, type: EventType.REVIEW_ASSIGNED, timestamp: "2026-01-01T00:01:00Z", payload: { agentId: "a1" } },
      { eventId: "e1", sequence: 1, type: EventType.TASK_CREATED, timestamp: "2026-01-01T00:00:00Z", payload: { taskId: "t1" } },
    ]);
    const { container } = render(<TimelinePanel timeline={timeline} />);

    expect(screen.getByText(EventType.TASK_CREATED)).toBeInTheDocument();
    expect(screen.getByText(EventType.REVIEW_ASSIGNED)).toBeInTheDocument();

    const typeCells = container.querySelectorAll(".timeline-type");
    expect(typeCells).toHaveLength(2);
    expect(typeCells[0].textContent).toBe(EventType.TASK_CREATED);
    expect(typeCells[1].textContent).toBe(EventType.REVIEW_ASSIGNED);
  });

  it("shows empty state when timeline is null", () => {
    render(<TimelinePanel timeline={null} />);
    expect(screen.getByText("No relevant events.")).toBeInTheDocument();
  });

  it("shows empty state when timeline has no events", () => {
    render(<TimelinePanel timeline={makeTimeline([])} />);
    expect(screen.getByText("No relevant events.")).toBeInTheDocument();
  });

  it("summarizes task and review events", () => {
    const timeline = makeTimeline([
      { eventId: "e1", sequence: 1, type: EventType.TASK_CREATED, timestamp: "2026-01-01T00:00:00Z", payload: { taskId: "t1" } },
      { eventId: "e2", sequence: 2, type: EventType.REVIEW_ASSIGNED, timestamp: "2026-01-01T00:01:00Z", payload: { agentId: "a1" } },
      { eventId: "e3", sequence: 3, type: EventType.AUDIT_NOTE_ADDED, timestamp: "2026-01-01T00:02:00Z", payload: { author: "auditor-1" } },
    ]);
    render(<TimelinePanel timeline={timeline} />);
    expect(screen.getByText("Task t1")).toBeInTheDocument();
    expect(screen.getByText("Review assigned to a1")).toBeInTheDocument();
    expect(screen.getByText("Audit note by auditor-1")).toBeInTheDocument();
  });
});
