// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitHubRuntimeAdapter } from "@agent-office/adapter-github";
import {
  AgentReviewOrchestrator,
  RuleBasedReviewStrategy,
  SnapshotStore,
} from "@agent-office/core";
import {
  CommandType,
  EventType,
  type OfficeCommand,
  type Id,
  type DomainEvent,
  type ReviewAssignedPayload,
  type ReviewSubmittedPayload,
  type ArtifactReviewedPayload,
  type AuditNoteAddedPayload,
} from "@agent-office/protocol";
import type {
  IssueQueueItem,
  PullRequestQueueItem,
  AuditNoteView,
} from "./types.js";

const RUNTIME_ID = "rt-production-test";
const BASE_TIMESTAMP = "2026-01-01T00:00:00Z";

function makeCommand(
  commandType: string,
  actorId: Id,
  payload: unknown
): OfficeCommand {
  return {
    commandId: `cmd-${commandType}-${actorId}`,
    commandType,
    timestamp: BASE_TIMESTAMP,
    source: "user",
    actorId,
    runtimeId: RUNTIME_ID,
    targetId: null,
    payload,
  };
}

function makeFixtures() {
  return {
    repo: { owner: "test-owner", name: "test-repo" },
    issues: [
      {
        number: 1,
        url: "https://github.com/test-owner/test-repo/issues/1",
        title: "Issue for production test",
        body: "Body of issue #1.",
        state: "open" as const,
        labels: [
          { name: "priority:high" },
          { name: "feature" },
        ],
        assignees: [{ login: "assignee-1" }],
        createdAt: BASE_TIMESTAMP,
        closedAt: null,
        comments: [],
      },
    ],
    pulls: [
      {
        number: 2,
        url: "https://github.com/test-owner/test-repo/pull/2",
        title: "PR for production test",
        body: "Closes #1.",
        state: "open" as const,
        draft: false,
        merged: false,
        mergedAt: null,
        mergedBy: null,
        mergeCommitSha: null,
        headRef: "feature/production-test",
        baseRef: "main",
        labels: [{ name: "review" }],
        requestedReviewers: [{ login: "reviewer-1" }],
        reviews: [],
        comments: [],
        createdAt: BASE_TIMESTAMP,
        closedAt: null,
      },
    ],
  };
}

describe("Runtime Truth Review — production chain", () => {
  let adapter: GitHubRuntimeAdapter;
  let orchestrator: AgentReviewOrchestrator;
  let store: SnapshotStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BASE_TIMESTAMP));

    adapter = new GitHubRuntimeAdapter({
      runtimeId: RUNTIME_ID,
      baseTimestamp: BASE_TIMESTAMP,
    });
    orchestrator = new AgentReviewOrchestrator(adapter, {
      strategy: new RuleBasedReviewStrategy(),
    });
    store = new SnapshotStore(RUNTIME_ID);
    await orchestrator.connect();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("projects GitHub fixtures through adapter → orchestrator → snapshot → projection", async () => {
    const fixtures = makeFixtures();
    adapter.syncFromFixtures(fixtures);

    const auditNoteResult = await orchestrator.execute(
      makeCommand(CommandType.AUDIT_NOTE, "auditor-1", {
        taskId: "gh-issue-1",
        body: "Audit note for issue #1",
      })
    );
    expect(auditNoteResult.status).toBe("accepted");

    const snapshot = await orchestrator.getSnapshot();
    store.setSnapshot(snapshot);

    const projection = orchestrator.getIntegrationProjection(store.getSnapshot());

    expect(projection.github).not.toBeNull();
    expect(projection.reviews).not.toBeNull();

    // Issue projection
    expect(projection.github!.issues).toHaveLength(1);
    const issue = projection.github!.issues[0] as IssueQueueItem;
    expect(issue.taskId).toBe("gh-issue-1");
    expect(issue.number).toBe(1);
    expect(issue.kind).toBe("issue");
    expect(issue.title).toBe("Issue for production test");
    expect(issue.state).toBe("open");
    expect(issue.stateReason).toBeUndefined();
    expect(issue.closedAt).toBeNull();
    expect(issue.labels).toEqual(["priority:high", "feature"]);
    expect(issue.assignees).toEqual(["assignee-1"]);
    expect(issue.url).toBe("https://github.com/test-owner/test-repo/issues/1");

    // PR projection
    expect(projection.github!.pulls).toHaveLength(1);
    const pr = projection.github!.pulls[0] as PullRequestQueueItem;
    expect(pr.taskId).toBe("gh-pr-task-2");
    expect(pr.artifactId).toBe("gh-pr-2");
    expect(pr.number).toBe(2);
    expect(pr.kind).toBe("pr");
    expect(pr.title).toBe("PR for production test");
    expect(pr.state).toBe("open");
    expect(pr.draft).toBe(false);
    expect(pr.labels).toEqual(["review"]);
    expect(pr.reviewers).toEqual(["reviewer-1"]);
    expect(pr.url).toBe("https://github.com/test-owner/test-repo/pull/2");

    // Audit note projection
    expect(projection.github!.auditNotes).toHaveLength(1);
    const note = projection.github!.auditNotes[0] as AuditNoteView;
    expect(note.taskId).toBe("gh-issue-1");
    expect(note.body).toBe("Audit note for issue #1");
    expect(note.author).toBe("auditor-1");
    expect(note.createdAt).toBe(BASE_TIMESTAMP);

    // Review state initially empty
    expect(projection.reviews!.assigned).toHaveLength(0);
    expect(projection.reviews!.submitted).toHaveLength(0);

    // No reducer errors from replaying fixture-derived events
    expect(adapter.getLastReplayErrors()).toEqual([]);
  });

  it("adds an assigned review after REVIEW_ASSIGN", async () => {
    adapter.syncFromFixtures(makeFixtures());
    store.setSnapshot(await orchestrator.getSnapshot());

    const result = await orchestrator.execute(
      makeCommand(CommandType.REVIEW_ASSIGN, "user-1", {
        targetKind: "pr",
        targetNumber: 2,
        agentId: "agent-reviewer-1",
      })
    );
    expect(result.status).toBe("accepted");
    const reviewId = result.affectedEventIds[0];

    const projection = orchestrator.getIntegrationProjection(store.getSnapshot());
    expect(projection.reviews!.assigned).toHaveLength(1);
    expect(projection.reviews!.assigned[0]).toMatchObject({
      reviewId,
      targetKind: "pr",
      targetNumber: 2,
      agentId: "agent-reviewer-1",
      assignedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(projection.reviews!.submitted).toHaveLength(0);

    // Runtime source: a REVIEW_ASSIGNED event exists
    const event = adapter
      .getEventLog()
      .find((e) => e.type === EventType.REVIEW_ASSIGNED) as
      | DomainEvent<ReviewAssignedPayload>
      | undefined;
    expect(event).toBeDefined();
    expect(event!.payload.reviewId).toBe(reviewId);
  });

  it("adds a submitted review after REVIEW_SUBMIT", async () => {
    adapter.syncFromFixtures(makeFixtures());
    store.setSnapshot(await orchestrator.getSnapshot());

    const assignResult = await orchestrator.execute(
      makeCommand(CommandType.REVIEW_ASSIGN, "user-1", {
        targetKind: "pr",
        targetNumber: 2,
        agentId: "agent-reviewer-1",
      })
    );
    const reviewId = assignResult.affectedEventIds[0];

    const submitResult = await orchestrator.execute(
      makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
        reviewId,
        verdict: "revision_required",
        comment: "Needs more tests",
      })
    );
    expect(submitResult.status).toBe("accepted");

    const projection = orchestrator.getIntegrationProjection(store.getSnapshot());
    expect(projection.reviews!.assigned).toHaveLength(1);
    expect(projection.reviews!.submitted).toHaveLength(1);
    expect(projection.reviews!.submitted[0]).toMatchObject({
      reviewId,
      agentId: "agent-reviewer-1",
      verdict: "revision_required",
      comment: "Needs more tests",
      targetKind: "pr",
      targetNumber: 2,
      submittedAt: "2026-01-01T00:00:00.000Z",
    });

    const event = adapter
      .getEventLog()
      .find((e) => e.type === EventType.REVIEW_SUBMITTED) as
      | DomainEvent<ReviewSubmittedPayload>
      | undefined;
    expect(event).toBeDefined();
    expect(event!.payload.reviewId).toBe(reviewId);
  });

  it("clears review state after REVIEW_APPROVE and emits ARTIFACT_REVIEWED", async () => {
    adapter.syncFromFixtures(makeFixtures());

    const assignResult = await orchestrator.execute(
      makeCommand(CommandType.REVIEW_ASSIGN, "user-1", {
        targetKind: "pr",
        targetNumber: 2,
        agentId: "agent-reviewer-1",
      })
    );
    const reviewId = assignResult.affectedEventIds[0];

    await orchestrator.execute(
      makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
        reviewId,
        verdict: "approved",
        comment: "LGTM",
      })
    );

    const approveResult = await orchestrator.execute(
      makeCommand(CommandType.REVIEW_APPROVE, "human-approver-1", { reviewId })
    );
    expect(approveResult.status).toBe("accepted");

    const projection = orchestrator.getIntegrationProjection(store.getSnapshot());
    expect(projection.reviews!.assigned).toHaveLength(0);
    expect(projection.reviews!.submitted).toHaveLength(0);

    const reviewedEvent = adapter
      .getEventLog()
      .find((e) => e.type === EventType.ARTIFACT_REVIEWED) as
      | DomainEvent<ArtifactReviewedPayload>
      | undefined;
    expect(reviewedEvent).toBeDefined();
    expect(reviewedEvent!.payload).toMatchObject({
      artifactId: "gh-pr-2",
      reviewerId: "agent-reviewer-1",
      verdict: "approved",
      comment: "LGTM",
    });

    const auditEvent = adapter
      .getEventLog()
      .find((e) => e.type === EventType.AUDIT_NOTE_ADDED) as
      | DomainEvent<AuditNoteAddedPayload>
      | undefined;
    expect(auditEvent).toBeDefined();
    expect(auditEvent!.payload.body).toContain("approved");
  });

  it("clears review state after REVIEW_REJECT without emitting ARTIFACT_REVIEWED", async () => {
    adapter.syncFromFixtures(makeFixtures());

    const assignResult = await orchestrator.execute(
      makeCommand(CommandType.REVIEW_ASSIGN, "user-1", {
        targetKind: "pr",
        targetNumber: 2,
        agentId: "agent-reviewer-1",
      })
    );
    const reviewId = assignResult.affectedEventIds[0];

    await orchestrator.execute(
      makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
        reviewId,
        verdict: "approved",
        comment: "LGTM",
      })
    );

    const rejectResult = await orchestrator.execute(
      makeCommand(CommandType.REVIEW_REJECT, "human-rejector-1", {
        reviewId,
        reason: "Conflict of interest",
      })
    );
    expect(rejectResult.status).toBe("accepted");

    const projection = orchestrator.getIntegrationProjection(store.getSnapshot());
    expect(projection.reviews!.assigned).toHaveLength(0);
    expect(projection.reviews!.submitted).toHaveLength(0);

    const reviewedEvent = adapter
      .getEventLog()
      .find((e) => e.type === EventType.ARTIFACT_REVIEWED);
    expect(reviewedEvent).toBeUndefined();

    const auditEvent = adapter
      .getEventLog()
      .find((e) => e.type === EventType.AUDIT_NOTE_ADDED) as
      | DomainEvent<AuditNoteAddedPayload>
      | undefined;
    expect(auditEvent).toBeDefined();
    expect(auditEvent!.payload.body).toContain("rejected");
  });

  it("traces every UI item back to a runtime source and has no phantom items", async () => {
    const fixtures = makeFixtures();
    adapter.syncFromFixtures(fixtures);

    await orchestrator.execute(
      makeCommand(CommandType.AUDIT_NOTE, "auditor-1", {
        taskId: "gh-issue-1",
        body: "Audit note for issue #1",
      })
    );

    const assignResult = await orchestrator.execute(
      makeCommand(CommandType.REVIEW_ASSIGN, "user-1", {
        targetKind: "pr",
        targetNumber: 2,
        agentId: "agent-reviewer-1",
      })
    );
    const reviewId = assignResult.affectedEventIds[0];

    await orchestrator.execute(
      makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
        reviewId,
        verdict: "approved",
        comment: "LGTM",
      })
    );

    const snapshot = await orchestrator.getSnapshot();
    store.setSnapshot(snapshot);
    const projection = orchestrator.getIntegrationProjection(snapshot);

    const evidence = adapter.getGitHubEvidence();
    const eventLog = adapter.getEventLog();

    // Issues trace to snapshot tasks and adapter evidence
    const issueTaskIds = new Set(snapshot.tasks.map((t) => t.taskId));
    for (const issue of projection.github!.issues as IssueQueueItem[]) {
      expect(issueTaskIds.has(issue.taskId)).toBe(true);
      expect(evidence.tasks[issue.taskId]).toBeDefined();
      expect(evidence.tasks[issue.taskId].kind).toBe("issue");
    }
    expect(projection.github!.issues).toHaveLength(
      Object.values(evidence.tasks).filter((ref) => ref.kind === "issue").length
    );

    // PRs trace to snapshot artifacts and adapter evidence
    const artifactIds = new Set(snapshot.artifacts.map((a) => a.artifactId));
    for (const pr of projection.github!.pulls as PullRequestQueueItem[]) {
      expect(artifactIds.has(pr.artifactId)).toBe(true);
      expect(evidence.artifacts[pr.artifactId]).toBeDefined();
      expect(evidence.artifacts[pr.artifactId].kind).toBe("pr");
    }
    expect(projection.github!.pulls).toHaveLength(
      Object.values(evidence.artifacts).filter((ref) => ref.kind === "pr").length
    );

    // Audit notes trace to adapter evidence and AUDIT_NOTE_ADDED events
    const auditNoteIds = new Set(evidence.auditNotes.map((n) => n.auditId));
    for (const note of projection.github!.auditNotes as AuditNoteView[]) {
      expect(auditNoteIds.has(note.auditId)).toBe(true);
      const event = eventLog.find(
        (e): e is DomainEvent<AuditNoteAddedPayload> =>
          e.type === EventType.AUDIT_NOTE_ADDED &&
          (e as DomainEvent<AuditNoteAddedPayload>).payload.body === note.body
      );
      expect(event).toBeDefined();
    }

    // Assigned/submitted reviews trace to orchestrator state and events
    const assignedEventIds = new Set(
      eventLog
        .filter((e): e is DomainEvent<ReviewAssignedPayload> => e.type === EventType.REVIEW_ASSIGNED)
        .map((e) => e.payload.reviewId)
    );
    for (const assignment of projection.reviews!.assigned) {
      expect(assignedEventIds.has(assignment.reviewId)).toBe(true);
    }

    const submittedEventIds = new Set(
      eventLog
        .filter((e): e is DomainEvent<ReviewSubmittedPayload> => e.type === EventType.REVIEW_SUBMITTED)
        .map((e) => e.payload.reviewId)
    );
    for (const draft of projection.reviews!.submitted) {
      expect(submittedEventIds.has(draft.reviewId)).toBe(true);
    }

    // No reducer errors means snapshot state is internally consistent with events
    expect(adapter.getLastReplayErrors()).toEqual([]);
  });
});
