import type { GitHubPRFixture } from "../types.js";

export const PR_APPROVED: GitHubPRFixture = {
  number: 24,
  url: "https://github.com/owner/repo/pull/24",
  title: "Update README",
  body: "Updates documentation.",
  state: "open",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "docs/readme-update",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [
    {
      author: { login: "reviewer1" },
      state: "APPROVED",
      body: "Looks good!",
      submittedAt: "2026-01-13T10:00:00Z",
    },
  ],
  comments: [],
  createdAt: "2026-01-13T08:00:00Z",
  closedAt: null,
};
