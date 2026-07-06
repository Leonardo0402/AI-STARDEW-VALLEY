// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LifeSimCapabilities, DaySummary } from "@agent-office/life-sim";
import { LifeSimControlPanel } from "./LifeSimControlPanel.js";
import type { LifeSimProjection } from "./projection.js";

const allCapabilities: LifeSimCapabilities = {
  world: {
    startDay: true,
    pause: true,
    resume: true,
    endDay: true,
    advanceTime: true,
    runToEndOfDay: true,
  },
  schedule: { override: true, clearOverride: true },
  clock: { mode: "manual", maxSpeed: 1 },
};

const noCapabilities: LifeSimCapabilities = {
  world: {
    startDay: false,
    pause: false,
    resume: false,
    endDay: false,
    advanceTime: false,
    runToEndOfDay: false,
  },
  schedule: { override: false, clearOverride: false },
  clock: { mode: "manual", maxSpeed: 0 },
};

function makeProjection(overrides: Partial<LifeSimProjection> = {}): LifeSimProjection {
  return {
    world: {
      day: 2,
      dayOfWeek: 2,
      minuteOfDay: 600,
      phase: "morning",
      status: "running",
      speed: 0,
    },
    agents: [],
    nextTransition: null,
    previousDaySummaries: [],
    capabilities: allCapabilities,
    truncated: false,
    lostRuntimeRange: null,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    day: 1,
    startedAtWorldMinute: 480,
    endedAtWorldMinute: 1439,
    truncated: false,
    agentActivities: [],
    taskCounts: { created: 3, completed: 2, blocked: 0, failed: 0 },
    approvalCounts: { requested: 1, approved: 1, rejected: 0 },
    notableEventIds: [],
    ...overrides,
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof LifeSimControlPanel>> = {}) {
  const props: React.ComponentProps<typeof LifeSimControlPanel> = {
    projection: makeProjection(),
    onSendCommand: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { ...render(<LifeSimControlPanel {...props} />), props };
}

describe("LifeSimControlPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders current day, virtual time, phase, and status", () => {
    renderPanel();
    expect(screen.getByText(/Day 2/i)).toBeInTheDocument();
    expect(screen.getByText(/10:00/i)).toBeInTheDocument();
    expect(screen.getByText(/morning/i)).toBeInTheDocument();
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  it("disables buttons when capabilities are false", () => {
    renderPanel({ projection: makeProjection({ capabilities: noCapabilities }) });
    expect(screen.getByRole("button", { name: /Start Day/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Advance 30 min/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Advance 60 min/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Advance 120 min/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Run to EOD/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /End Day/i })).toBeDisabled();
  });

  it("enables buttons when capabilities are true", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /Start Day/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Advance 30 min/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Advance 60 min/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Advance 120 min/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Run to EOD/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /End Day/i })).not.toBeDisabled();
  });

  it("calls onSendCommand with world.start_day when clicking Start Day", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Start Day/i }));
    expect(props.onSendCommand).toHaveBeenCalledTimes(1);
    expect(props.onSendCommand).toHaveBeenCalledWith("world.start_day", {});
  });

  it("calls onSendCommand with correct advance_time payloads", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Advance 30 min/i }));
    fireEvent.click(screen.getByRole("button", { name: /Advance 60 min/i }));
    fireEvent.click(screen.getByRole("button", { name: /Advance 120 min/i }));

    expect(props.onSendCommand).toHaveBeenCalledWith("world.advance_time", { minutes: 30 });
    expect(props.onSendCommand).toHaveBeenCalledWith("world.advance_time", { minutes: 60 });
    expect(props.onSendCommand).toHaveBeenCalledWith("world.advance_time", { minutes: 120 });
  });

  it("calls onSendCommand with world.run_to_end_of_day when clicking Run to EOD", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Run to EOD/i }));
    expect(props.onSendCommand).toHaveBeenCalledWith("world.run_to_end_of_day", {});
  });

  it("calls onSendCommand with world.end_day when clicking End Day", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /End Day/i }));
    expect(props.onSendCommand).toHaveBeenCalledWith("world.end_day", {});
  });

  it("renders truncated-history indicator when projection.truncated is true", () => {
    renderPanel({ projection: makeProjection({ truncated: true }) });
    expect(screen.getByText(/History truncated/i)).toBeInTheDocument();
  });

  it("does not render truncated-history indicator when projection.truncated is false", () => {
    renderPanel();
    expect(screen.queryByText(/History truncated/i)).not.toBeInTheDocument();
  });

  it("displays the most recent day summary with task and approval counts", () => {
    const summaries: DaySummary[] = [
      makeSummary({ day: 1, taskCounts: { created: 3, completed: 2, blocked: 0, failed: 0 } }),
      makeSummary({
        day: 2,
        taskCounts: { created: 5, completed: 4, blocked: 1, failed: 0 },
        approvalCounts: { requested: 2, approved: 1, rejected: 1 },
      }),
    ];
    renderPanel({ projection: makeProjection({ previousDaySummaries: summaries }) });
    expect(screen.getByText(/Day 2 summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Tasks: 5 created, 4 completed, 1 blocked, 0 failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Approvals: 2 requested, 1 approved, 1 rejected/i)).toBeInTheDocument();
  });
});
