// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FocusModeIndicator } from "./FocusModeIndicator.js";
import type { ComposedOfficeProjection } from "@agent-office/control-ui/life-sim";

function makeProjection(
  partial: Partial<ComposedOfficeProjection> = {}
): ComposedOfficeProjection {
  return {
    agents: [],
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [],
    pendingApprovals: [],
    blockedTasks: [],
    errors: [],
    lifeSim: {
      world: {
        day: 0,
        dayOfWeek: 1,
        minuteOfDay: 0,
        phase: "dawn",
        status: "not_started",
        speed: 0,
      },
      agents: [],
      nextTransition: null,
      previousDaySummaries: [],
      capabilities: {
        world: {
          startDay: true,
          pause: false,
          resume: false,
          endDay: false,
          advanceTime: false,
          runToEndOfDay: false,
        },
        schedule: { override: false, clearOverride: false },
        clock: { mode: "manual", maxSpeed: 0 },
      },
      truncated: false,
      lostRuntimeRange: null,
    },
    ...partial,
  } as ComposedOfficeProjection;
}

describe("FocusModeIndicator", () => {
  it("renders the focus mode title and hint", () => {
    render(<FocusModeIndicator projection={makeProjection()} />);
    expect(screen.getByText("Focus Mode")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Agents continue working in the background; events queue quietly."
      )
    ).toBeInTheDocument();
  });

  it("does not duplicate pending/blocked/failed counts from the urgent panel", () => {
    const projection = makeProjection({
      pendingApprovals: [{ approvalId: "a1" }, { approvalId: "a2" }] as any,
      blockedTasks: [{ taskId: "t1" }] as any,
      agents: [{ status: "failed" }] as any,
      tasks: [{ status: "failed" }, { status: "working" }] as any,
    });

    render(<FocusModeIndicator projection={projection} />);

    expect(screen.queryByTestId("focus-indicator-count")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });
});
