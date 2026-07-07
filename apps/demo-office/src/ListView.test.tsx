// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListView } from "./ListView.js";
import type { OfficeProjection } from "@agent-office/protocol";
import type { OfficeSelection } from "@agent-office/pixel-office";

const baseProjection: OfficeProjection = {
  agents: [
    {
      agentId: "agent-1",
      name: "Orchestrator",
      role: "orchestrator",
      status: "idle",
      currentTaskId: null,
      currentRoomId: "room-1",
      blockedReason: null,
    },
    {
      agentId: "agent-2",
      name: "Worker",
      role: "worker",
      status: "working",
      currentTaskId: "task-1",
      currentRoomId: "room-2",
      blockedReason: null,
    },
  ],
  tasks: [
    {
      taskId: "task-1",
      title: "Write report",
      description: "",
      status: "running",
      priority: "high",
      assigneeId: "agent-2",
      roomId: "room-2",
      artifactIds: [],
      approvalId: null,
      blockedReason: null,
    },
  ],
  artifacts: [
    {
      artifactId: "art-1",
      taskId: "task-1",
      producerAgentId: "agent-2",
      type: "document",
      title: "report.md",
      status: "generated",
      version: 1,
      reviewResult: null,
    },
  ],
  approvals: [
    {
      approvalId: "approval-1",
      taskId: "task-1",
      kind: "artifact_delivery",
      status: "requested",
      requestedBy: "agent-2",
      reason: "Deliver report",
    },
  ],
  rooms: [
    {
      roomId: "room-1",
      name: "Command",
      type: "command",
      bounds: { x: 0, y: 0, width: 200, height: 150 },
      activeAgentIds: ["agent-1"],
    },
    {
      roomId: "room-2",
      name: "Execution",
      type: "execution",
      bounds: { x: 220, y: 0, width: 200, height: 150 },
      activeAgentIds: ["agent-2"],
    },
  ],
  pendingApprovals: [
    {
      approvalId: "approval-1",
      taskId: "task-1",
      kind: "artifact_delivery",
      status: "requested",
      requestedBy: "agent-2",
      reason: "Deliver report",
    },
  ],
  blockedTasks: [],
  errors: [],
};

function renderListView(
  overrides: Partial<React.ComponentProps<typeof ListView>> = {}
) {
  const props: React.ComponentProps<typeof ListView> = {
    projection: baseProjection,
    selection: null,
    onSelect: vi.fn(),
    ...overrides,
  };
  return { ...render(<ListView {...props} />), props };
}

describe("ListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders agents, tasks, artifacts, approvals and rooms", () => {
    renderListView();
    expect(screen.getByText("Orchestrator")).toBeInTheDocument();
    expect(screen.getByText("Write report")).toBeInTheDocument();
    expect(screen.getByText("report.md")).toBeInTheDocument();
    expect(screen.getByText("approval-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select room Command" })).toBeInTheDocument();
  });

  it("calls onSelect when clicking an agent row", () => {
    const { props } = renderListView();
    const row = screen.getByText("Orchestrator").closest("tr");
    expect(row).toBeInTheDocument();
    fireEvent.click(row!);
    expect(props.onSelect).toHaveBeenCalledWith({
      kind: "agent",
      id: "agent-1",
    });
  });

  it("calls onSelect when clicking a task row", () => {
    const { props } = renderListView();
    const row = screen.getByText("Write report").closest("tr");
    fireEvent.click(row!);
    expect(props.onSelect).toHaveBeenCalledWith({
      kind: "task",
      id: "task-1",
    });
  });

  it("calls onSelect when clicking an artifact row", () => {
    const { props } = renderListView();
    const row = screen.getByText("report.md").closest("tr");
    fireEvent.click(row!);
    expect(props.onSelect).toHaveBeenCalledWith({
      kind: "artifact",
      id: "art-1",
    });
  });

  it("calls onSelect when clicking an approval row", () => {
    const { props } = renderListView();
    const row = screen.getByText("approval-1").closest("tr");
    fireEvent.click(row!);
    expect(props.onSelect).toHaveBeenCalledWith({
      kind: "approval",
      id: "approval-1",
    });
  });

  it("calls onSelect when clicking a room card", () => {
    const { props } = renderListView();
    const card = screen.getByRole("button", { name: "Select room Command" });
    fireEvent.click(card);
    expect(props.onSelect).toHaveBeenCalledWith({
      kind: "room",
      id: "room-1",
    });
  });

  it("marks the selected row with highlight attributes", () => {
    const selection: OfficeSelection = { kind: "agent", id: "agent-1" };
    renderListView({ selection });
    const row = screen.getByText("Orchestrator").closest("tr");
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(row?.classList.contains("list-view__row--selected")).toBe(true);
  });

  it("supports Enter key selection on a focused row", () => {
    const { props } = renderListView();
    const row = screen.getByText("Worker").closest("tr");
    row!.focus();
    fireEvent.keyDown(row!, { key: "Enter" });
    expect(props.onSelect).toHaveBeenCalledWith({
      kind: "agent",
      id: "agent-2",
    });
  });

  it("supports Space key selection on a focused row", () => {
    const { props } = renderListView();
    const row = screen.getByText("Write report").closest("tr");
    row!.focus();
    fireEvent.keyDown(row!, { key: " " });
    expect(props.onSelect).toHaveBeenCalledWith({
      kind: "task",
      id: "task-1",
    });
  });
});
