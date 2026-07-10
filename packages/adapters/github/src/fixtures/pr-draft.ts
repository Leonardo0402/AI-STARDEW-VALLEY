import type { GitHubPRFixture } from "../types.js";

export const PR_DRAFT: GitHubPRFixture = {
  number: 21,
  url: "https://github.com/owner/repo/pull/21",
  title: "WIP: refactor auth module",
  body: "Draft PR for auth refactor.",
  state: "open",
  draft: true,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/auth-refactor",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [],
  comments: [],
  createdAt: "2026-01-10T08:00:00Z",
  closedAt: null,
};
