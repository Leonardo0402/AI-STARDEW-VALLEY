import type { GitHubFixtures } from "../types.js";
import { ISSUE_OPEN } from "./issue-open.js";
import { ISSUE_CLOSED_COMPLETED } from "./issue-closed-completed.js";
import { ISSUE_CLOSED_NOT_PLANNED } from "./issue-closed-not-planned.js";
import { ISSUE_BLOCKED } from "./issue-blocked.js";
import { ISSUE_CLOSED_BLOCKED } from "./issue-closed-blocked.js";
import { PR_OPEN } from "./pr-open.js";
import { PR_DRAFT } from "./pr-draft.js";
import { PR_REVIEW_REQUESTED } from "./pr-review-requested.js";
import { PR_CHANGES_REQUESTED } from "./pr-changes-requested.js";
import { PR_APPROVED } from "./pr-approved.js";
import { PR_MERGED } from "./pr-merged.js";
import { PR_CLOSED_UNMERGED } from "./pr-closed-unmerged.js";
import { PR_CLOSED_UNMERGED_NO_REVIEW } from "./pr-closed-unmerged-no-review.js";

export {
  ISSUE_OPEN,
  ISSUE_CLOSED_COMPLETED,
  ISSUE_CLOSED_NOT_PLANNED,
  ISSUE_BLOCKED,
  ISSUE_CLOSED_BLOCKED,
  PR_OPEN,
  PR_DRAFT,
  PR_REVIEW_REQUESTED,
  PR_CHANGES_REQUESTED,
  PR_APPROVED,
  PR_MERGED,
  PR_CLOSED_UNMERGED,
  PR_CLOSED_UNMERGED_NO_REVIEW,
};

/**
 * 聚合 fixture 集合 — 包含所有 issue 与 PR fixture。
 * 用于 determinism.test.ts 和集成测试。
 */
export const SAMPLE_FIXTURES: GitHubFixtures = {
  repo: { owner: "owner", name: "repo" },
  issues: [
    ISSUE_OPEN,
    ISSUE_CLOSED_COMPLETED,
    ISSUE_CLOSED_NOT_PLANNED,
    ISSUE_BLOCKED,
    ISSUE_CLOSED_BLOCKED,
  ],
  pulls: [
    PR_OPEN,
    PR_DRAFT,
    PR_REVIEW_REQUESTED,
    PR_CHANGES_REQUESTED,
    PR_APPROVED,
    PR_MERGED,
    PR_CLOSED_UNMERGED,
    PR_CLOSED_UNMERGED_NO_REVIEW,
  ],
};
