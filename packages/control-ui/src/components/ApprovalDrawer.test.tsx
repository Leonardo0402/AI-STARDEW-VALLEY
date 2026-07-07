// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ApprovalDrawer } from "./ApprovalDrawer.js";

import type { ApprovalView } from "@agent-office/protocol";

function makeApproval(id: string, kind: ApprovalView["kind"] = "artifact_delivery"): ApprovalView {
  return {
    approvalId: id,
    taskId: `task-${id}`,
    kind,
    status: "requested",
    requestedBy: "agent-1",
    reason: "needs review",
  };
}

describe("ApprovalDrawer", () => {
  it("renders nothing when there are no approvals", () => {
    const { container } = render(
      <ApprovalDrawer approvals={[]} onApprove={vi.fn()} onReject={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("gives Approve and Reject buttons distinct accessible names per approval", () => {
    render(
      <ApprovalDrawer
        approvals={[makeApproval("ap1"), makeApproval("ap2")]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Approve approval ap1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve approval ap2" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reject approval ap1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reject approval ap2" })
    ).toBeInTheDocument();
  });

  it("approves when the Approve button is clicked", () => {
    const onApprove = vi.fn();
    render(
      <ApprovalDrawer
        approvals={[makeApproval("ap1")]}
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );

    const approveBtn = screen.getByRole("button", { name: "Approve approval ap1" });
    fireEvent.click(approveBtn);
    expect(onApprove).toHaveBeenCalledWith("ap1");
  });

  it("moves focus back to the drawer title when Escape is pressed", () => {
    render(
      <ApprovalDrawer
        approvals={[makeApproval("ap1")]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    const title = document.querySelector(".approval-drawer__title");
    const approveBtn = screen.getByRole("button", { name: "Approve approval ap1" });
    approveBtn.focus();
    fireEvent.keyDown(approveBtn, { key: "Escape" });
    expect(title).toHaveFocus();
  });

  it("calls onSelect when clicking an approval card", () => {
    const onSelect = vi.fn();
    render(
      <ApprovalDrawer
        approvals={[makeApproval("ap1")]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        selection={null}
        onSelect={onSelect}
      />
    );

    const card = document.querySelector(".approval-drawer");
    expect(card).toBeInTheDocument();
    fireEvent.click(card!);
    expect(onSelect).toHaveBeenCalledWith({ kind: "approval", id: "ap1" });
  });

  it("marks the selected approval card with highlight attributes", () => {
    render(
      <ApprovalDrawer
        approvals={[makeApproval("ap1")]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        selection={{ kind: "approval", id: "ap1" }}
        onSelect={vi.fn()}
      />
    );

    const card = document.querySelector(".approval-drawer");
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card?.classList.contains("card--selected")).toBe(true);
  });

  it("supports Enter key selection on a focused approval card", () => {
    const onSelect = vi.fn();
    render(
      <ApprovalDrawer
        approvals={[makeApproval("ap1")]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        selection={null}
        onSelect={onSelect}
      />
    );

    const card = document.querySelector(".approval-drawer") as HTMLElement;
    card.focus();
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ kind: "approval", id: "ap1" });
  });
});
