/**
 * Protocol 扩展测试 — 验证 3 个新 artifact 事件的 reducer 行为。
 * 对应 AC6。
 */
import { describe, it, expect } from "vitest";
import { reduceEvent, createEmptySnapshot } from "./reducer.js";
import {
  EventType,
  type DomainEvent,
  type ArtifactDraftedPayload,
  type ArtifactReviewRequestedPayload,
  type ArtifactDeliveredPayload,
  type ArtifactClosedPayload,
  type TaskCreatedPayload,
} from "@agent-office/protocol";
import type { RuntimeSnapshot } from "@agent-office/protocol";

function makeEvent<P>(
  type: string,
  payload: P,
  sequence: number,
  occurredAt = "2026-01-01T00:00:00Z"
): DomainEvent<P> {
  return {
    eventId: `evt-test-${sequence}`,
    runtimeId: "test-runtime",
    sequence,
    schemaVersion: "1.0",
    type,
    occurredAt,
    receivedAt: occurredAt,
    correlationId: "corr-test",
    causationId: null,
    traceId: "trace-test",
    payload,
  };
}

describe("Protocol extension: artifact.drafted / review_requested / delivered / closed", () => {
  function setupTaskAndArtifact(): RuntimeSnapshot {
    const empty = createEmptySnapshot("test-runtime");
    const taskPayload: TaskCreatedPayload = {
      taskId: "gh-pr-task-1",
      title: "PR #1 task",
      description: "task for PR 1",
      priority: "normal",
      parentTaskId: null,
    };
    const taskEvent = makeEvent(EventType.TASK_CREATED, taskPayload, 1);
    const r1 = reduceEvent(empty, taskEvent);
    return r1.snapshot;
  }

  it("artifact.drafted 创建 status=draft 的 artifact 并关联 task.artifactIds", () => {
    let snap = setupTaskAndArtifact();
    const payload: ArtifactDraftedPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: null,
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    const event = makeEvent(EventType.ARTIFACT_DRAFTED, payload, 2);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact).toBeDefined();
    expect(artifact!.status).toBe("draft");
    expect(artifact!.taskId).toBe("gh-pr-task-1");
    expect(artifact!.producerAgentId).toBe("");
    const task = result.snapshot.tasks.find((t) => t.taskId === "gh-pr-task-1");
    expect(task!.artifactIds).toContain("gh-pr-1");
  });

  it("artifact.review_requested 将 draft artifact 转为 under_review", () => {
    let snap = setupTaskAndArtifact();
    const draftPayload: ArtifactDraftedPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: null,
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_DRAFTED, draftPayload, 2)).snapshot;

    const reviewReqPayload: ArtifactReviewRequestedPayload = {
      artifactId: "gh-pr-1",
      reviewerIds: ["octocat"],
    };
    const event = makeEvent(EventType.ARTIFACT_REVIEW_REQUESTED, reviewReqPayload, 3);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("under_review");
  });

  it("artifact.review_requested 对 generated artifact 也能转为 under_review", () => {
    let snap = setupTaskAndArtifact();
    // 先创建 generated artifact（通过 ARTIFACT_CREATED）
    const createdPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: "",
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_CREATED, createdPayload, 2)).snapshot;

    const reviewReqPayload: ArtifactReviewRequestedPayload = {
      artifactId: "gh-pr-1",
      reviewerIds: ["octocat"],
    };
    const event = makeEvent(EventType.ARTIFACT_REVIEW_REQUESTED, reviewReqPayload, 3);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("under_review");
  });

  it("artifact.review_requested 对不存在的 artifact 返回 entity_not_found", () => {
    const snap = setupTaskAndArtifact();
    const payload: ArtifactReviewRequestedPayload = {
      artifactId: "nonexistent",
      reviewerIds: ["octocat"],
    };
    const event = makeEvent(EventType.ARTIFACT_REVIEW_REQUESTED, payload, 2);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("entity_not_found");
  });

  it("artifact.delivered 将 artifact 转为 delivered 且关联 task 转为 completed", () => {
    let snap = setupTaskAndArtifact();
    const createdPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: "",
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_CREATED, createdPayload, 2)).snapshot;

    const deliveredPayload: ArtifactDeliveredPayload = {
      artifactId: "gh-pr-1",
      mergeCommitSha: "abc123",
      mergedBy: "octocat",
    };
    const event = makeEvent(EventType.ARTIFACT_DELIVERED, deliveredPayload, 3);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("delivered");
    const task = result.snapshot.tasks.find((t) => t.taskId === "gh-pr-task-1");
    expect(task!.status).toBe("completed");
    expect(task!.completedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("artifact.delivered 对不存在的 artifact 返回 entity_not_found", () => {
    const snap = setupTaskAndArtifact();
    const payload: ArtifactDeliveredPayload = {
      artifactId: "nonexistent",
      mergeCommitSha: "abc123",
      mergedBy: "octocat",
    };
    const event = makeEvent(EventType.ARTIFACT_DELIVERED, payload, 2);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("entity_not_found");
  });

  it("artifact.delivered 将 under_review artifact 直接转为 delivered", () => {
    let snap = setupTaskAndArtifact();
    const createdPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: "",
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_CREATED, createdPayload, 2)).snapshot;
    const reviewReqPayload: ArtifactReviewRequestedPayload = {
      artifactId: "gh-pr-1",
      reviewerIds: ["octocat"],
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_REVIEW_REQUESTED, reviewReqPayload, 3)).snapshot;

    const deliveredPayload: ArtifactDeliveredPayload = {
      artifactId: "gh-pr-1",
      mergeCommitSha: "abc123",
      mergedBy: "octocat",
    };
    const event = makeEvent(EventType.ARTIFACT_DELIVERED, deliveredPayload, 4);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("delivered");
  });

  // ─── artifact.closed ───────────────────────────────────────

  it("artifact.closed 将 generated artifact 转为 rejected（zero-review closed-unmerged）", () => {
    let snap = setupTaskAndArtifact();
    const createdPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: "",
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_CREATED, createdPayload, 2)).snapshot;

    const closedPayload: ArtifactClosedPayload = {
      artifactId: "gh-pr-1",
      closedBy: null,
      reason: "closed-unmerged",
    };
    const event = makeEvent(EventType.ARTIFACT_CLOSED, closedPayload, 3);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("rejected");
  });

  it("artifact.closed 对不存在的 artifact 返回 entity_not_found", () => {
    const snap = setupTaskAndArtifact();
    const payload: ArtifactClosedPayload = {
      artifactId: "nonexistent",
      closedBy: null,
      reason: "closed-unmerged",
    };
    const event = makeEvent(EventType.ARTIFACT_CLOSED, payload, 2);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("entity_not_found");
  });
});
