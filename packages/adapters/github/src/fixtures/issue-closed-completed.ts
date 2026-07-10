import type { GitHubIssueFixture } from "../types.js";

export const ISSUE_CLOSED_COMPLETED: GitHubIssueFixture = {
  number: 11,
  url: "https://github.com/owner/repo/issues/11",
  title: "Fix navigation bug",
  body: "Navigation bar disappears on mobile.",
  state: "closed",
  stateReason: "completed",
  labels: [{ name: "bug" }],
  assignees: [{ login: "octocat" }],
  createdAt: "2026-01-04T08:00:00Z",
  closedAt: "2026-01-06T10:00:00Z",
  comments: [],
};
