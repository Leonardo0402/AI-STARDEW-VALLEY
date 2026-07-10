import type { GitHubPRFixture } from "../types.js";

export const PR_REVIEW_REQUESTED: GitHubPRFixture = {
  number: 22,
  url: "https://github.com/owner/repo/pull/22",
  title: "Add dashboard widget",
  body: "Adds a new dashboard widget.",
  state: "open",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/widget",
  baseRef: "main",
  labels: [],
  requestedReviewers: [{ login: "reviewer1" }, { login: "reviewer2" }],
  reviews: [],
  comments: [],
  createdAt: "2026-01-11T08:00:00Z",
  closedAt: null,
};
