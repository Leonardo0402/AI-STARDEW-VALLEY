import type { GitHubPRFixture } from "../types.js";

export const PR_CLOSED_UNMERGED: GitHubPRFixture = {
  number: 26,
  url: "https://github.com/owner/repo/pull/26",
  title: "Experimental feature",
  body: "Closing this, not needed anymore.",
  state: "closed",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "experimental/feature",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [
    {
      author: { login: "reviewer1" },
      state: "CHANGES_REQUESTED",
      body: "This approach won't work.",
      submittedAt: "2026-01-15T10:00:00Z",
    },
  ],
  comments: [],
  createdAt: "2026-01-15T08:00:00Z",
  closedAt: "2026-01-15T12:00:00Z",
};
