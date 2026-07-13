import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitHubPolicy } from "./github-policy.js";
import { CommandType, type OfficeCommand } from "@agent-office/protocol";

function makeCommand(
  commandType: string,
  actorId: string,
  payload: unknown
): OfficeCommand {
  return {
    commandId: "cmd-1",
    commandType,
    timestamp: "2026-07-11T10:00:00Z",
    source: "user",
    actorId,
    runtimeId: "rt-1",
    targetId: null,
    payload,
  };
}

describe("GitHubPolicy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("command type allowlist", () => {
    it("allows the 4 supported command types", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const payloads: Record<string, unknown> = {
        [CommandType.ISSUE_ADD_COMMENT]: { issueNumber: 1, body: "hi" },
        [CommandType.ISSUE_ADD_LABEL]: { issueNumber: 1, label: "bug" },
        [CommandType.ISSUE_REMOVE_LABEL]: { issueNumber: 1, label: "bug" },
        [CommandType.PR_REQUEST_REVIEW]: { prNumber: 1, reviewers: ["a"] },
      };
      for (const ct of Object.keys(payloads)) {
        const verdict = policy.validate(makeCommand(ct, "u1", payloads[ct]));
        expect(verdict.allowed).toBe(true);
      }
    });

    it("rejects unsupported command types", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(makeCommand("merge", "u1", {}));
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("UNSUPPORTED_COMMAND_TYPE");
    });
  });

  describe("actor authorization", () => {
    it("rejects actors not in allowedActors", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u2", { issueNumber: 1, body: "hi" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("ACTOR_NOT_AUTHORIZED");
    });
  });

  describe("payload validation", () => {
    it("rejects issue.add_comment with empty body", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects issue.add_label with empty label", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.ISSUE_ADD_LABEL, "u1", { issueNumber: 1, label: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects pr.request_review with empty reviewers array", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.PR_REQUEST_REVIEW, "u1", { prNumber: 1, reviewers: [] })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });
  });

  describe("rate limit", () => {
    it("allows up to N commands per minute, rejects N+1", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 3 });
      for (let i = 0; i < 3; i++) {
        const v = policy.validate(
          makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: `c${i}` })
        );
        expect(v.allowed).toBe(true);
      }
      const v = policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "c4" })
      );
      expect(v.allowed).toBe(false);
      expect(v.reason).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("resets counter after 60 seconds", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 1 });
      expect(policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "a" })
      ).allowed).toBe(true);
      expect(policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "b" })
      ).allowed).toBe(false);
      // advance 61 seconds
      vi.advanceTimersByTime(61 * 1000);
      expect(policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "c" })
      ).allowed).toBe(true);
    });
  });

  describe("Phase 2.5 commands", () => {
    it("allows the 5 new command types with valid payloads", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const payloads: Record<string, unknown> = {
        [CommandType.ISSUE_DRAFT]: { title: "New issue", body: "body" },
        [CommandType.COMMENT_DRAFT]: { issueNumber: 1, body: "comment" },
        [CommandType.DRAFT_SUBMIT]: { draftId: "draft-1" },
        [CommandType.DRAFT_DISCARD]: { draftId: "draft-1" },
        [CommandType.AUDIT_NOTE]: { taskId: "t1", body: "audit" },
      };
      for (const ct of Object.keys(payloads)) {
        const verdict = policy.validate(makeCommand(ct, "u1", payloads[ct]));
        expect(verdict.allowed).toBe(true);
      }
    });

    it("allows audit_note without taskId (runtime-level audit)", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.AUDIT_NOTE, "u1", { body: "runtime audit" })
      );
      expect(verdict.allowed).toBe(true);
    });

    it("rejects issue.draft with empty title", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.ISSUE_DRAFT, "u1", { title: "", body: "body" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects comment.draft with empty body", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.COMMENT_DRAFT, "u1", { issueNumber: 1, body: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects comment.draft with non-positive issueNumber", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.COMMENT_DRAFT, "u1", { issueNumber: 0, body: "hi" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects draft.submit with empty draftId", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.DRAFT_SUBMIT, "u1", { draftId: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects draft.discard with empty draftId", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.DRAFT_DISCARD, "u1", { draftId: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects audit_note with empty body", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.AUDIT_NOTE, "u1", { taskId: "t1", body: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });
  });

  describe("GitHubPolicy review commands", () => {
    const policy = new GitHubPolicy({
      allowedActors: ["user1", "agent-reviewer-1"],
      rateLimitPerMinute: 100,
    });

    it("allows REVIEW_ASSIGN with valid payload", () => {
      const verdict = policy.validate({
        commandId: "cmd-1",
        commandType: CommandType.REVIEW_ASSIGN,
        timestamp: "2026-01-01T00:00:00Z",
        source: "user",
        actorId: "user1",
        runtimeId: "rt-1",
        targetId: null,
        payload: { targetKind: "pr", targetNumber: 42, agentId: "agent-reviewer-1" },
      });
      expect(verdict.allowed).toBe(true);
    });

    it("rejects REVIEW_ASSIGN with invalid targetKind", () => {
      const verdict = policy.validate({
        commandId: "cmd-2",
        commandType: CommandType.REVIEW_ASSIGN,
        timestamp: "2026-01-01T00:00:00Z",
        source: "user",
        actorId: "user1",
        runtimeId: "rt-1",
        targetId: null,
        payload: { targetKind: "commit", targetNumber: 42, agentId: "agent-reviewer-1" },
      });
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects REVIEW_SUBMIT with invalid verdict value", () => {
      const verdict = policy.validate({
        commandId: "cmd-3",
        commandType: CommandType.REVIEW_SUBMIT,
        timestamp: "2026-01-01T00:00:00Z",
        source: "user",
        actorId: "agent-reviewer-1",
        runtimeId: "rt-1",
        targetId: null,
        payload: { reviewId: "review-1", verdict: "maybe", comment: "Not sure" },
      });
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("allows REVIEW_FINALIZE with valid payload", () => {
      const verdict = policy.validate({
        commandId: "cmd-4",
        commandType: CommandType.REVIEW_FINALIZE,
        timestamp: "2026-01-01T00:00:00Z",
        source: "system",
        actorId: "user1",
        runtimeId: "rt-1",
        targetId: null,
        payload: {
          targetKind: "pr",
          targetNumber: 42,
          verdict: "approved",
          comment: "LGTM",
          reviewerId: "agent-reviewer-1",
        },
      });
      expect(verdict.allowed).toBe(true);
    });

    it("rejects REVIEW_FINALIZE with missing reviewerId", () => {
      const verdict = policy.validate({
        commandId: "cmd-5",
        commandType: CommandType.REVIEW_FINALIZE,
        timestamp: "2026-01-01T00:00:00Z",
        source: "system",
        actorId: "user1",
        runtimeId: "rt-1",
        targetId: null,
        payload: {
          targetKind: "pr",
          targetNumber: 42,
          verdict: "approved",
          comment: "LGTM",
          reviewerId: "",
        },
      });
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects when actor is not in allowedActors", () => {
      const verdict = policy.validate({
        commandId: "cmd-6",
        commandType: CommandType.REVIEW_SUBMIT,
        timestamp: "2026-01-01T00:00:00Z",
        source: "user",
        actorId: "unknown-agent",
        runtimeId: "rt-1",
        targetId: null,
        payload: { reviewId: "review-1", verdict: "approved", comment: "LGTM" },
      });
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("ACTOR_NOT_AUTHORIZED");
    });
  });
});
