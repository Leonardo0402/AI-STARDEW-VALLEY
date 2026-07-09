import type { GitHubIssueFixture } from "../types.js";

export const ISSUE_CLOSED_NOT_PLANNED: GitHubIssueFixture = {
  number: 12,
  url: "https://github.com/owner/repo/issues/12",
  title: "Add support for legacy browser",
  body: "Support IE11.",
  state: "closed",
  stateReason: "not_planned",
  labels: [{ name: "wontfix" }],
  assignees: [],
  createdAt: "2026-01-05T08:00:00Z",
  closedAt: "2026-01-07T10:00:00Z",
  comments: [],
};
