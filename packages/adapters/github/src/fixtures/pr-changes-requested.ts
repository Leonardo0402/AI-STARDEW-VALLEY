import type { GitHubPRFixture } from "../types.js";

export const PR_CHANGES_REQUESTED: GitHubPRFixture = {
  number: 23,
  url: "https://github.com/owner/repo/pull/23",
  title: "Add analytics tracking",
  body: "Adds analytics events.",
  state: "open",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/analytics",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [
    {
      author: { login: "reviewer1" },
      state: "CHANGES_REQUESTED",
      body: "Please add tests for the analytics module.",
      submittedAt: "2026-01-12T10:00:00Z",
    },
  ],
  comments: [],
  createdAt: "2026-01-12T08:00:00Z",
  closedAt: null,
};
