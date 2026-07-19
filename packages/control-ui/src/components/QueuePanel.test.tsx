// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueuePanel } from "./QueuePanel.js";
import type { IssueQueueItem, PullRequestQueueItem } from "@agent-office/control-ui/integration";
import type { OfficeSelection } from "@agent-office/pixel-office";

function renderQueuePanel(
  overrides: Partial<React.ComponentProps<typeof QueuePanel>> = {}
) {
  const props: React.ComponentProps<typeof QueuePanel> = {
    issues: [],
    pulls: [],
    selection: null,
    onSelect: vi.fn(),
    ...overrides,
  };
  return { ...render(<QueuePanel {...props} />), props };
}

describe("QueuePanel", () => {
  it("renders issues and pulls", () => {
    const issues: IssueQueueItem[] = [
      { taskId: "i1", number: 1, kind: "issue", title: "Bug", state: "open", closedAt: null, labels: ["bug"], assignees: [], url: "" },
    ];
    const pulls: PullRequestQueueItem[] = [
      { taskId: "t1", artifactId: "a1", number: 2, kind: "pr", title: "Feature", state: "open", draft: false, labels: [], reviewers: ["alice"], url: "" },
    ];
    renderQueuePanel({ issues, pulls });
    expect(screen.getByText("#1 Bug")).toBeInTheDocument();
    expect(screen.getByText("#2 Feature")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    renderQueuePanel();
    expect(screen.getByText("No open items in queue.")).toBeInTheDocument();
  });

  it("calls onSelect when clicking an issue card", () => {
    const issues: IssueQueueItem[] = [
      { taskId: "i1", number: 1, kind: "issue", title: "Bug", state: "open", closedAt: null, labels: ["bug"], assignees: [], url: "" },
    ];
    const { props } = renderQueuePanel({ issues });
    const card = screen.getByRole("button", { name: "Select issue 1" });
    fireEvent.click(card);
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "task", id: "i1" });
  });

  it("calls onSelect when clicking a pull request card", () => {
    const pulls: PullRequestQueueItem[] = [
      { taskId: "t1", artifactId: "a1", number: 2, kind: "pr", title: "Feature", state: "open", draft: false, labels: [], reviewers: ["alice"], url: "" },
    ];
    const { props } = renderQueuePanel({ pulls });
    const card = screen.getByRole("button", { name: "Select pull request 2" });
    fireEvent.click(card);
    expect(props.onSelect).toHaveBeenCalledWith({ kind: "artifact", id: "a1" });
  });

  it("marks the selected card", () => {
    const issues: IssueQueueItem[] = [
      { taskId: "i1", number: 1, kind: "issue", title: "Bug", state: "open", closedAt: null, labels: ["bug"], assignees: [], url: "" },
    ];
    const selection: OfficeSelection = { kind: "task", id: "i1" };
    renderQueuePanel({ issues, selection });
    const card = screen.getByRole("button", { name: "Select issue 1" });
    expect(card).toHaveClass("card--selected");
    expect(card).toHaveAttribute("aria-pressed", "true");
  });
});
