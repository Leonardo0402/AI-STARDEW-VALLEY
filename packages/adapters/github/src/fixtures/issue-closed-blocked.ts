import type { GitHubIssueFixture } from "../types.js";

/**
 * Closed issue WITH blocked label — blocked 映射只适用于 open issue。
 * 最终状态必须为 completed（不是 blocked），且 reducer errors 必须为空。
 */
export const ISSUE_CLOSED_BLOCKED: GitHubIssueFixture = {
  number: 14,
  url: "https://github.com/owner/repo/issues/14",
  title: "Closed issue that was blocked",
  body: "Was blocked but then closed as completed.",
  state: "closed",
  stateReason: "completed",
  labels: [{ name: "blocked" }, { name: "priority:high" }],
  assignees: [{ login: "octocat" }],
  createdAt: "2026-01-09T08:00:00Z",
  closedAt: "2026-01-10T10:00:00Z",
  comments: [],
};
