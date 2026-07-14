// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EvidencePanel } from "./EvidencePanel.js";
import type { AuditNoteView } from "@agent-office/control-ui/integration";

describe("EvidencePanel", () => {
  it("renders audit notes", () => {
    const notes: AuditNoteView[] = [
      { auditId: "n1", taskId: "t1", body: "Evidence note", author: "agent-1", createdAt: "2026-01-01T00:00:00Z" },
    ];
    render(<EvidencePanel auditNotes={notes} />);
    expect(screen.getByText("Evidence note")).toBeInTheDocument();
    expect(screen.getByText("agent-1")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<EvidencePanel auditNotes={[]} />);
    expect(screen.getByText("No audit notes.")).toBeInTheDocument();
  });

  it("expands and collapses a note on click", () => {
    const notes: AuditNoteView[] = [
      { auditId: "n1", taskId: "t1", body: "Long evidence note body", author: "agent-1", createdAt: "2026-01-01T00:00:00Z" },
    ];
    render(<EvidencePanel auditNotes={notes} />);
    const card = screen.getByText("Long evidence note body").closest(".card");
    expect(card).not.toBeNull();
    expect(screen.getByText("Long evidence note body")).toHaveClass("truncate");
    fireEvent.click(card!);
    expect(screen.getByText("Long evidence note body")).not.toHaveClass("truncate");
    fireEvent.click(card!);
    expect(screen.getByText("Long evidence note body")).toHaveClass("truncate");
  });
});
