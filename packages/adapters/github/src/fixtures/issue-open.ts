import type { GitHubIssueFixture } from "../types.js";

export const ISSUE_OPEN: GitHubIssueFixture = {
  number: 10,
  url: "https://github.com/owner/repo/issues/10",
  title: "Implement login page",
  body: "Need a login page with OAuth support.",
  state: "open",
  labels: [{ name: "priority:high" }, { name: "feature" }],
  assignees: [{ login: "octocat" }],
  createdAt: "2026-01-02T08:00:00Z",
  closedAt: null,
  comments: [
    {
      author: { login: "dev1" },
      body: "Started working on this.",
      createdAt: "2026-01-03T09:00:00Z",
    },
  ],
};
