// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ControlPanel, type ExperienceMode } from "./ControlPanel.js";
import { CommandType } from "@agent-office/protocol";
import type { OfficeProjection, DomainEvent, AdapterCapabilities } from "@agent-office/protocol";

const capabilities: AdapterCapabilities = {
  supportedEvents: [],
  supportedCommands: Object.values(CommandType),
  features: {
    snapshot: true,
    sse: false,
    websocket: false,
    commandExecution: true,
    softMapping: false,
    hardOrchestration: false,
  },
};

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
      name: "Worker-1",
      role: "worker",
      status: "idle",
      currentTaskId: null,
      currentRoomId: "room-2",
      blockedReason: null,
    },
    {
      agentId: "agent-3",
      name: "Worker-2",
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
      title: "Write Q3 report",
      description: "Draft Q3 report",
      status: "running",
      priority: "high",
      assigneeId: "agent-2",
      roomId: "room-2",
      artifactIds: [],
      approvalId: null,
      blockedReason: null,
    },
    {
      taskId: "task-2",
      title: "Review code",
      description: "Review PR",
      status: "created",
      priority: "normal",
      assigneeId: null,
      roomId: null,
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
      title: "Q3-report-v2.md",
      status: "generated",
      version: 2,
      reviewResult: null,
    },
  ],
  approvals: [],
  rooms: [],
  pendingApprovals: [],
  blockedTasks: [],
  errors: [],
};

const baseEvent: DomainEvent = {
  eventId: "evt-1",
  runtimeId: "runtime-001",
  sequence: 842,
  schemaVersion: "1",
  type: "artifact.reviewed",
  occurredAt: "2026-07-05T12:04:18.000Z",
  receivedAt: "2026-07-05T12:04:18.000Z",
  correlationId: "corr-1",
  causationId: null,
  traceId: "trace-1",
  payload: {},
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof ControlPanel>> = {}
) {
  const props: React.ComponentProps<typeof ControlPanel> = {
    projection: baseProjection,
    eventLog: [baseEvent],
    errors: [],
    mode: "command" as ExperienceMode,
    onModeChange: vi.fn(),
    onSendCommand: vi.fn().mockResolvedValue(undefined),
    capabilities,
    ...overrides,
  };
  return { ...render(<ControlPanel {...props} />), props };
}

describe("ControlPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders agents, tasks, approvals placeholder, and events", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: /Agents/i })).toBeInTheDocument();
    expect(screen.getByText("Orchestrator")).toBeInTheDocument();
    expect(screen.getByText("Worker-1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Tasks/i })).toBeInTheDocument();
    expect(screen.getByText("Write Q3 report")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Event Log/i })).toBeInTheDocument();
    expect(screen.getByText(/artifact.reviewed/)).toBeInTheDocument();
  });

  it("does not render a mode switcher", () => {
    renderPanel();
    expect(screen.queryByRole("tab", { name: "Command" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Focus" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Debrief" })).not.toBeInTheDocument();
  });

  it("emits TASK_CREATE with correct payload when creating a task", async () => {
    const { props } = renderPanel();
    const titleInput = screen.getByPlaceholderText("Task title");
    const priorityInput = screen.getByPlaceholderText("Priority");
    const createBtn = screen.getByRole("button", { name: /Create/i });

    fireEvent.change(titleInput, { target: { value: "New task" } });
    fireEvent.change(priorityInput, { target: { value: "urgent" } });
    fireEvent.click(createBtn);

    expect(props.onSendCommand).toHaveBeenCalledTimes(1);
    expect(props.onSendCommand).toHaveBeenCalledWith(
      CommandType.TASK_CREATE,
      { title: "New task", description: "", priority: "urgent" }
    );
  });

  it("emits TASK_ASSIGN when assigning a created task to an idle worker", async () => {
    const { props } = renderPanel();
    const assignBtn = await screen.findByRole("button", { name: /Assign to Worker-1/i });
    fireEvent.click(assignBtn);

    expect(props.onSendCommand).toHaveBeenCalledWith(
      CommandType.TASK_ASSIGN,
      { taskId: "task-2", agentId: "agent-2" },
      "task-2"
    );
  });

  it("emits AGENT_PAUSE and AGENT_RESUME for pause/resume actions", async () => {
    const { props } = renderPanel();
    const pauseBtns = screen.getAllByRole("button", { name: /Pause/i });
    fireEvent.click(pauseBtns[0]);
    expect(props.onSendCommand).toHaveBeenCalledWith(
      CommandType.AGENT_PAUSE,
      { agentId: "agent-1" },
      "agent-1"
    );

    const pausedAgentProjection: OfficeProjection = {
      ...baseProjection,
      agents: [
        {
          ...baseProjection.agents[1],
          status: "paused",
        },
      ],
    };
    const { props: props2 } = renderPanel({ projection: pausedAgentProjection });
    const resumeBtns = screen.getAllByRole("button", { name: /Resume/i });
    const enabledResume = resumeBtns.find((btn) => !btn.hasAttribute("disabled"));
    if (!enabledResume) throw new Error("No enabled Resume button found");
    fireEvent.click(enabledResume);
    expect(props2.onSendCommand).toHaveBeenCalledWith(
      CommandType.AGENT_RESUME,
      { agentId: "agent-2" },
      "agent-2"
    );
  });

  it("emits APPROVAL_ACCEPT when approving a pending approval", async () => {
    const projection: OfficeProjection = {
      ...baseProjection,
      pendingApprovals: [
        {
          approvalId: "approval-1",
          taskId: "task-1",
          kind: "artifact_delivery",
          status: "requested",
          requestedBy: "agent-2",
          reason: "Deliver Q3 report",
        },
      ],
    };
    const { props } = renderPanel({ projection });
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    fireEvent.click(approveBtn);

    expect(props.onSendCommand).toHaveBeenCalledWith(
      CommandType.APPROVAL_ACCEPT,
      { approvalId: "approval-1" },
      "approval-1"
    );
  });

  it("emits APPROVAL_REJECT when rejecting a pending approval", async () => {
    const projection: OfficeProjection = {
      ...baseProjection,
      pendingApprovals: [
        {
          approvalId: "approval-1",
          taskId: "task-1",
          kind: "artifact_delivery",
          status: "requested",
          requestedBy: "agent-2",
          reason: "Deliver Q3 report",
        },
      ],
    };
    const { props } = renderPanel({ projection });
    const rejectBtn = screen.getByRole("button", { name: /Reject/i });
    fireEvent.click(rejectBtn);

    expect(props.onSendCommand).toHaveBeenCalledWith(
      CommandType.APPROVAL_REJECT,
      { approvalId: "approval-1", reason: "rejected by operator" },
      "approval-1"
    );
  });

  it("disables only Reject when only APPROVAL_ACCEPT is supported", () => {
    const projection: OfficeProjection = {
      ...baseProjection,
      pendingApprovals: [
        {
          approvalId: "approval-1",
          taskId: "task-1",
          kind: "artifact_delivery",
          status: "requested",
          requestedBy: "agent-2",
          reason: "Deliver Q3 report",
        },
      ],
    };
    renderPanel({
      projection,
      capabilities: { ...capabilities, supportedCommands: [CommandType.APPROVAL_ACCEPT] },
    });
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    const rejectBtn = screen.getByRole("button", { name: /Reject/i });
    expect(approveBtn).not.toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });

  it("disables only Approve when only APPROVAL_REJECT is supported", () => {
    const projection: OfficeProjection = {
      ...baseProjection,
      pendingApprovals: [
        {
          approvalId: "approval-1",
          taskId: "task-1",
          kind: "artifact_delivery",
          status: "requested",
          requestedBy: "agent-2",
          reason: "Deliver Q3 report",
        },
      ],
    };
    renderPanel({
      projection,
      capabilities: { ...capabilities, supportedCommands: [CommandType.APPROVAL_REJECT] },
    });
    const approveBtn = screen.getByRole("button", { name: /Approve/i });
    const rejectBtn = screen.getByRole("button", { name: /Reject/i });
    expect(approveBtn).toBeDisabled();
    expect(rejectBtn).not.toBeDisabled();
  });

  it("opens an artifact when clicking View", async () => {
    const { props } = renderPanel();
    const viewBtn = screen.getByRole("button", { name: /View/i });
    fireEvent.click(viewBtn);

    await waitFor(() => {
      expect(props.onSendCommand).toHaveBeenCalledWith(
        CommandType.ARTIFACT_OPEN,
        { artifactId: "art-1" },
        "art-1"
      );
    });
  });

  it("only renders the approval drawer when pendingApprovals is non-empty", () => {
    const { rerender } = renderPanel();
    expect(screen.queryByRole("heading", { name: /Pending Approval/i })).not.toBeInTheDocument();

    const projection: OfficeProjection = {
      ...baseProjection,
      pendingApprovals: [
        {
          approvalId: "approval-1",
          taskId: "task-1",
          kind: "artifact_delivery",
          status: "requested",
          requestedBy: "agent-2",
          reason: "Deliver Q3 report",
        },
      ],
    };
    rerender(<ControlPanel {...({ projection, eventLog: [baseEvent], errors: [], mode: "command", onModeChange: vi.fn(), onSendCommand: vi.fn(), capabilities } as React.ComponentProps<typeof ControlPanel>)} />);
    expect(screen.getByRole("heading", { name: /Pending Approval/i })).toBeInTheDocument();
  });

  it("renders an error banner when errors is non-empty", () => {
    renderPanel({ errors: ["Runtime connection reset"] });
    expect(screen.getByRole("alert")).toHaveTextContent(/Runtime connection reset/i);
  });

  it("renders badges with visible text labels", () => {
    renderPanel();
    const badges = screen.getAllByTestId("badge");
    const labels = badges.map((b) => b.textContent);
    expect(labels).toContain("idle");
    expect(labels).toContain("working");
    expect(labels).toContain("running");
    expect(labels).toContain("created");
    expect(labels).toContain("generated v2");
    labels.forEach((label) => expect(label).not.toBe(""));
  });
});
