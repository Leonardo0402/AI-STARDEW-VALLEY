import type { GitHubPRFixture } from "../types.js";

/**
 * Closed-unmerged PR WITHOUT any reviews — 不得伪造 reviewerId。
 * 使用 artifact.closed 事件表达 closure，artifact 最终状态为 rejected。
 */
export const PR_CLOSED_UNMERGED_NO_REVIEW: GitHubPRFixture = {
  number: 27,
  url: "https://github.com/owner/repo/pull/27",
  title: "Abandoned feature branch",
  body: "Closing this, superseded by #25.",
  state: "closed",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/abandoned",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [],
  comments: [],
  createdAt: "2026-01-16T08:00:00Z",
  closedAt: "2026-01-16T12:00:00Z",
};
