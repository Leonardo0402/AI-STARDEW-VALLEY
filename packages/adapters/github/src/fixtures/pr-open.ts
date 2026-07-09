import type { GitHubPRFixture } from "../types.js";

export const PR_OPEN: GitHubPRFixture = {
  number: 20,
  url: "https://github.com/owner/repo/pull/20",
  title: "Add login page component",
  body: "Implements login UI. Closes #10.",
  state: "open",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/login",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [],
  comments: [],
  createdAt: "2026-01-09T08:00:00Z",
  closedAt: null,
};
