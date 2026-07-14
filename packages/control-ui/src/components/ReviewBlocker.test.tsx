// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ReviewBlocker } from "./ReviewBlocker.js";
import type { ReviewAssignment, ReviewDraft } from "@agent-office/core";

describe("ReviewBlocker", () => {
  it("renders assigned and submitted reviews", () => {
    const assigned: ReviewAssignment[] = [
      { reviewId: "r1", targetKind: "issue", targetNumber: 1, agentId: "agent-1", assignedAt: "2026-01-01T00:00:00Z" },
    ];
    const submitted: ReviewDraft[] = [
      { reviewId: "r1", agentId: "agent-1", verdict: "approved", comment: "LGTM", targetKind: "issue", targetNumber: 1, submittedAt: "2026-01-01T00:00:00Z" },
    ];
    render(<ReviewBlocker assigned={assigned} submitted={submitted} onSendCommand={vi.fn()} />);
    expect(screen.getByText("agent-1 reviewing #1")).toBeInTheDocument();
    expect(screen.getByText("approved #1")).toBeInTheDocument();
  });

  it("dispatches REVIEW_APPROVE on Approve click", async () => {
    const onSendCommand = vi.fn().mockResolvedValue(undefined);
    const submitted: ReviewDraft[] = [
      { reviewId: "r1", agentId: "agent-1", verdict: "approved", comment: "LGTM", targetKind: "issue", targetNumber: 1, submittedAt: "2026-01-01T00:00:00Z" },
    ];
    render(<ReviewBlocker assigned={[]} submitted={submitted} onSendCommand={onSendCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(onSendCommand).toHaveBeenCalledWith("REVIEW_APPROVE", { reviewId: "r1" }));
  });

  it("dispatches REVIEW_REJECT on Reject click", async () => {
    const onSendCommand = vi.fn().mockResolvedValue(undefined);
    const submitted: ReviewDraft[] = [
      { reviewId: "r1", agentId: "agent-1", verdict: "approved", comment: "LGTM", targetKind: "issue", targetNumber: 1, submittedAt: "2026-01-01T00:00:00Z" },
    ];
    render(<ReviewBlocker assigned={[]} submitted={submitted} onSendCommand={onSendCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    await waitFor(() => expect(onSendCommand).toHaveBeenCalledWith("REVIEW_REJECT", { reviewId: "r1", reason: "Rejected via UI" }));
  });

  it("shows empty state", () => {
    render(<ReviewBlocker assigned={[]} submitted={[]} onSendCommand={vi.fn()} />);
    expect(screen.getByText("No active reviews.")).toBeInTheDocument();
  });

  it("shows error message when action fails", async () => {
    const onSendCommand = vi.fn().mockRejectedValue(new Error("Network error"));
    const submitted: ReviewDraft[] = [
      { reviewId: "r1", agentId: "agent-1", verdict: "approved", comment: "LGTM", targetKind: "issue", targetNumber: 1, submittedAt: "2026-01-01T00:00:00Z" },
    ];
    render(<ReviewBlocker assigned={[]} submitted={submitted} onSendCommand={onSendCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(screen.getByText("Action failed")).toBeInTheDocument());
  });
});
