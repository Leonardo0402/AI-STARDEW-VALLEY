import { describe, it, expect } from "vitest";
import type { IntegrationProjection, IssueQueueItem } from "./types.js";

describe("integration types", () => {
  it("can construct a minimal IntegrationProjection", () => {
    const p: IntegrationProjection = { github: null, reviews: null };
    expect(p.github).toBeNull();
  });

  it("IssueQueueItem has required fields", () => {
    const item: IssueQueueItem = {
      taskId: "gh-issue-1",
      number: 1,
      kind: "issue",
      title: "t",
      state: "open",
      closedAt: null,
      labels: [],
      assignees: [],
      url: "https://github.com/o/r/issues/1",
    };
    expect(item.kind).toBe("issue");
  });
});
