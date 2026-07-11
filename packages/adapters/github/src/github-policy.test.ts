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
});
