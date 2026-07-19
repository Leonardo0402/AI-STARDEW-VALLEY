import type { Id } from "@agent-office/protocol";
import type { ReviewAssignment, ReviewDraft } from "@agent-office/core";

export interface IntegrationProjection {
  github: GitHubIntegrationView | null;
  reviews: ReviewIntegrationView | null;
  timeline: TimelineIntegrationView | null;
}

export interface TimelineIntegrationView {
  events: TimelineEventView[];
}

export interface TimelineEventView {
  eventId: Id;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface GitHubIntegrationView {
  issues: IssueQueueItem[];
  pulls: PullRequestQueueItem[];
  auditNotes: AuditNoteView[];
}

export interface ReviewIntegrationView {
  assigned: ReviewAssignment[];
  submitted: ReviewDraft[];
}

export interface IssueQueueItem {
  taskId: Id;
  number: number;
  kind: "issue";
  title: string;
  state: "open" | "closed";
  stateReason?: string;
  closedAt: string | null;
  labels: string[];
  assignees: string[];
  url: string;
}

export interface PullRequestQueueItem {
  taskId: Id;
  artifactId: Id;
  number: number;
  kind: "pr";
  title: string;
  state: "open" | "closed" | "merged";
  draft: boolean;
  labels: string[];
  reviewers: string[];
  url: string;
}

export interface AuditNoteView {
  auditId: Id;
  taskId: Id | null;
  body: string;
  author: Id;
  createdAt: string;
}
