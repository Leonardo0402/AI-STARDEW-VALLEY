import type { GitHubPRFixture } from "../types.js";

export const PR_MERGED: GitHubPRFixture = {
  number: 25,
  url: "https://github.com/owner/repo/pull/25",
  title: "Fix typo in config",
  body: "Fixes config typo. Closes #11.",
  state: "closed",
  draft: false,
  merged: true,
  mergedAt: "2026-01-14T12:00:00Z",
  mergedBy: { login: "octocat" },
  mergeCommitSha: "abc123def456",
  headRef: "fix/config-typo",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [
    {
      author: { login: "reviewer1" },
      state: "APPROVED",
      body: "LGTM",
      submittedAt: "2026-01-14T10:00:00Z",
    },
  ],
  comments: [],
  createdAt: "2026-01-14T08:00:00Z",
  closedAt: "2026-01-14T12:00:00Z",
};
