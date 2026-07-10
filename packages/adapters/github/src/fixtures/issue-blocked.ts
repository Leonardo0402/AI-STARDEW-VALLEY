import type { GitHubIssueFixture } from "../types.js";

export const ISSUE_BLOCKED: GitHubIssueFixture = {
  number: 13,
  url: "https://github.com/owner/repo/issues/13",
  title: "Integrate payment gateway",
  body: "Waiting on API credentials from provider.",
  state: "open",
  labels: [{ name: "blocked" }, { name: "priority:urgent" }],
  assignees: [{ login: "octocat" }],
  createdAt: "2026-01-08T08:00:00Z",
  closedAt: null,
  comments: [],
};
