import { describe, it, expect, beforeEach } from "vitest";
import { CommandType, EventType, type OfficeCommand, type Id } from "@agent-office/protocol";
import { GitHubRuntimeAdapter } from "@agent-office/adapter-github";
import { createEmptySnapshot } from "@agent-office/core";
import { AgentReviewOrchestrator } from "./agent-review-orchestrator.js";
import { RuleBasedReviewStrategy } from "./review-strategy.js";

function makeCommand(
  commandType: string,
  actorId: Id,
  payload: unknown
): OfficeCommand {
  return {
    commandId: `cmd-${Math.random().toString(36).slice(2, 8)}`,
    commandType,
    timestamp: "2026-01-01T00:00:00Z",
    source: "user",
    actorId,
    runtimeId: "rt-test",
    targetId: null,
    payload,
  };
}

function makeOrchestrator(): AgentReviewOrchestrator {
  const inner = new GitHubRuntimeAdapter();
  return new AgentReviewOrchestrator(inner, {});
}

function makeOrchestratorWithInner(): {
  orchestrator: AgentReviewOrchestrator;
  inner: GitHubRuntimeAdapter;
} {
  const inner = new GitHubRuntimeAdapter();
  return { orchestrator: new AgentReviewOrchestrator(inner, {}), inner };
}

describe("AgentReviewOrchestrator", () => {
  let orchestrator: AgentReviewOrchestrator;

  beforeEach(async () => {
    orchestrator = makeOrchestrator();
    await orchestrator.connect();
  });

  describe("REVIEW_ASSIGN", () => {
    it("returns accepted with reviewId in affectedEventIds", async () => {
      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
          agentId: "agent-reviewer-1",
        })
      );
      expect(result.status).toBe("accepted");
      expect(result.affectedEventIds).toHaveLength(1);
      expect(result.affectedEventIds[0]).toMatch(/^review-\d+$/);
    });

    it("stores assignment in getAssignedReviews()", async () => {
      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
          agentId: "agent-reviewer-1",
        })
      );
      const reviewId = result.affectedEventIds[0];
      const assigned = orchestrator.getAssignedReviews();
      expect(assigned).toHaveLength(1);
      expect(assigned[0].reviewId).toBe(reviewId);
      expect(assigned[0].agentId).toBe("agent-reviewer-1");
      expect(assigned[0].targetNumber).toBe(42);
    });
  });

  describe("REVIEW_SUBMIT", () => {
    it("returns error NOT_FOUND when reviewId not assigned", async () => {
      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
          reviewId: "review-nonexistent",
          verdict: "approved",
          comment: "LGTM",
        })
      );
      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("NOT_FOUND");
    });

    it("returns error FORBIDDEN when actorId is not the assigned agent", async () => {
      const assignResult = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
          agentId: "agent-reviewer-1",
        })
      );
      const reviewId = assignResult.affectedEventIds[0];

      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-2", {
          reviewId,
          verdict: "approved",
          comment: "LGTM",
        })
      );
      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("FORBIDDEN");
    });

    it("returns accepted and stores draft when assigned agent submits", async () => {
      const assignResult = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
          agentId: "agent-reviewer-1",
        })
      );
      const reviewId = assignResult.affectedEventIds[0];

      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
          reviewId,
          verdict: "revision_required",
          comment: "Fix the tests",
        })
      );
      expect(result.status).toBe("accepted");

      const drafts = orchestrator.getSubmittedReviews();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].reviewId).toBe(reviewId);
      expect(drafts[0].verdict).toBe("revision_required");
      expect(drafts[0].comment).toBe("Fix the tests");
      expect(drafts[0].targetNumber).toBe(42);
    });

    it("overwrites draft when same reviewId submitted twice", async () => {
      const assignResult = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
          agentId: "agent-reviewer-1",
        })
      );
      const reviewId = assignResult.affectedEventIds[0];

      await orchestrator.execute(
        makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
          reviewId,
          verdict: "revision_required",
          comment: "First attempt",
        })
      );
      await orchestrator.execute(
        makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
          reviewId,
          verdict: "approved",
          comment: "Second attempt",
        })
      );

      const drafts = orchestrator.getSubmittedReviews();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].verdict).toBe("approved");
      expect(drafts[0].comment).toBe("Second attempt");
    });
  });

  describe("REVIEW_APPROVE", () => {
    it("returns error NOT_FOUND when reviewId not submitted", async () => {
      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_APPROVE, "user1", {
          reviewId: "review-nonexistent",
        })
      );
      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("NOT_FOUND");
    });

    it("returns accepted and clears both maps when approved", async () => {
      const assignResult = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
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

      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_APPROVE, "user1", { reviewId })
      );
      expect(result.status).toBe("accepted");

      expect(orchestrator.getAssignedReviews()).toHaveLength(0);
      expect(orchestrator.getSubmittedReviews()).toHaveLength(0);
    });

    it("returns NOT_FOUND on second approve (already finalized)", async () => {
      const assignResult = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
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
      await orchestrator.execute(
        makeCommand(CommandType.REVIEW_APPROVE, "user1", { reviewId })
      );

      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_APPROVE, "user1", { reviewId })
      );
      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("REVIEW_REJECT", () => {
    it("returns error NOT_FOUND when reviewId not submitted", async () => {
      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_REJECT, "user1", {
          reviewId: "review-nonexistent",
          reason: "Bad review",
        })
      );
      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("NOT_FOUND");
    });

    it("returns accepted and clears submittedReviews when rejected", async () => {
      const assignResult = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
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

      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_REJECT, "user1", {
          reviewId,
          reason: "Review is invalid",
        })
      );
      expect(result.status).toBe("accepted");
      expect(orchestrator.getSubmittedReviews()).toHaveLength(0);
    });

    it("does not emit ARTIFACT_REVIEWED when rejected", async () => {
      const { orchestrator: orch, inner } = makeOrchestratorWithInner();
      await orch.connect();

      const assignResult = await orch.execute(
        makeCommand(CommandType.REVIEW_ASSIGN, "user1", {
          targetKind: "pr",
          targetNumber: 42,
          agentId: "agent-reviewer-1",
        })
      );
      const reviewId = assignResult.affectedEventIds[0];

      await orch.execute(
        makeCommand(CommandType.REVIEW_SUBMIT, "agent-reviewer-1", {
          reviewId,
          verdict: "approved",
          comment: "LGTM",
        })
      );

      await orch.execute(
        makeCommand(CommandType.REVIEW_REJECT, "user1", {
          reviewId,
          reason: "Review is invalid",
        })
      );

      // Verify no ARTIFACT_REVIEWED event was emitted
      const events = inner.getEventLog();
      const artifactReviewed = events.find((e) => e.type === EventType.ARTIFACT_REVIEWED);
      expect(artifactReviewed).toBeUndefined();
    });
  });

  describe("pass-through", () => {
    it("delegates non-review commands to inner adapter", async () => {
      const result = await orchestrator.execute(
        makeCommand(CommandType.TASK_CREATE, "user1", {
          title: "Test task",
          description: "Test description",
        })
      );
      // Inner adapter (GitHubRuntimeAdapter) will reject TASK_CREATE as unsupported
      expect(result.status).toBe("rejected");
      expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
    });

    it("rejects REVIEW_FINALIZE as FORBIDDEN (safety boundary)", async () => {
      const result = await orchestrator.execute(
        makeCommand(CommandType.REVIEW_FINALIZE, "agent-reviewer-1", {
          targetKind: "pr",
          targetNumber: 42,
          verdict: "approved",
          comment: "Trying to bypass approval",
          reviewerId: "agent-reviewer-1",
        })
      );
      expect(result.status).toBe("error");
      expect(result.error?.code).toBe("FORBIDDEN");
    });
  });
});

describe("getIntegrationProjection", () => {
  it("returns reviews state", async () => {
    const inner = new GitHubRuntimeAdapter();
    const orch = new AgentReviewOrchestrator(inner);
    await orch.connect();
    await orch.execute({
      commandId: "c1",
      commandType: CommandType.REVIEW_ASSIGN,
      timestamp: "2026-01-01T00:00:00Z",
      source: "user",
      actorId: "user-1",
      runtimeId: "r",
      targetId: null,
      payload: { targetKind: "issue", targetNumber: 1, agentId: "agent-1" },
    });
    const snapshot = createEmptySnapshot("r");
    const proj = orch.getIntegrationProjection(snapshot);
    expect(proj.reviews?.assigned).toHaveLength(1);
    expect(proj.reviews?.assigned[0].targetNumber).toBe(1);
  });
});
