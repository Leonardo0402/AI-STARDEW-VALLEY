/**
 * GitHub Runtime Adapter 私有类型 — 不进 protocol。
 * 贴近 GitHub REST API payload 形状，便于后续替换为真实 API。
 */
import type { Id } from "@agent-office/protocol";

// ─── GitHub Fixture 类型（输入） ────────────────────────────

export interface GitHubLabel {
  name: string;
  color?: string;
}

export interface GitHubUser {
  login: string;
  url?: string;
}

export interface GitHubComment {
  author: GitHubUser;
  body: string;
  createdAt: string;
}

export interface GitHubReview {
  author: GitHubUser;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body: string;
  submittedAt: string;
}

export interface GitHubIssueFixture {
  number: number;
  url: string;
  title: string;
  body: string;
  state: "open" | "closed";
  stateReason?: "completed" | "not_planned" | "reopened";
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  createdAt: string;
  closedAt: string | null;
  comments: GitHubComment[];
}

export interface GitHubPRFixture {
  number: number;
  url: string;
  title: string;
  body: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: GitHubUser | null;
  mergeCommitSha: string | null;
  headRef: string;
  baseRef: string;
  labels: GitHubLabel[];
  requestedReviewers: GitHubUser[];
  reviews: GitHubReview[];
  comments: GitHubComment[];
  createdAt: string;
  closedAt: string | null;
}

export interface GitHubFixtures {
  issues: GitHubIssueFixture[];
  pulls: GitHubPRFixture[];
  repo: { owner: string; name: string };
}

// ─── Adapter Evidence 类型（输出） ──────────────────────────

/**
 * office entity → GitHub provenance 映射。
 * Evidence 是 adapter 侧伴随结构，不进 RuntimeSnapshot。
 */
export interface GitHubSourceRef {
  kind: "issue" | "pr";
  number: number;
  url: string;
  rawState: string;
  stateReason?: string;
  closedAt?: string | null;
  labels: string[];
  assignees: string[];
  reviewers?: string[];
  comments: { author: string; body: string; createdAt: string }[];
  refsIssueNumbers?: number[];
}

export interface GitHubAdapterEvidence {
  tasks: Record<Id, GitHubSourceRef>;
  artifacts: Record<Id, GitHubSourceRef>;
}
