/**
 * GitHubPolicy — pure local validation for Command Gateway v0.
 *
 * Checks (in order):
 * 1. Command type allowlist (4 supported types)
 * 2. Actor authorization (whitelist)
 * 3. Payload schema validation
 * 4. Rate limit (local counter per actor, window = 60s)
 *
 * No network calls. GitHub's real rate limit is handled by GitHubApiClient.
 */
import type { OfficeCommand, Id } from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";

export interface GitHubPolicyOptions {
  allowedActors: string[];
  rateLimitPerMinute: number;
}

export interface PolicyVerdict {
  allowed: boolean;
  reason?: string;
}

interface RateWindow {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;

export class GitHubPolicy {
  private readonly allowedActors: Set<string>;
  private readonly rateLimitPerMinute: number;
  private counters: Map<Id, RateWindow> = new Map();

  constructor(options: GitHubPolicyOptions) {
    this.allowedActors = new Set(options.allowedActors);
    this.rateLimitPerMinute = options.rateLimitPerMinute;
  }

  validate(command: OfficeCommand): PolicyVerdict {
    // 1. Command type allowlist
    const supported: string[] = [
      CommandType.ISSUE_ADD_COMMENT,
      CommandType.ISSUE_ADD_LABEL,
      CommandType.ISSUE_REMOVE_LABEL,
      CommandType.PR_REQUEST_REVIEW,
    ];
    if (!supported.includes(command.commandType)) {
      return { allowed: false, reason: "UNSUPPORTED_COMMAND_TYPE" };
    }

    // 2. Actor authorization
    if (!this.allowedActors.has(command.actorId)) {
      return { allowed: false, reason: "ACTOR_NOT_AUTHORIZED" };
    }

    // 3. Payload validation
    const payloadError = this.validatePayload(command);
    if (payloadError) {
      return { allowed: false, reason: payloadError };
    }

    // 4. Rate limit
    const now = Date.now();
    let window = this.counters.get(command.actorId);
    if (!window || now - window.windowStart >= WINDOW_MS) {
      window = { count: 0, windowStart: now };
    }
    if (window.count >= this.rateLimitPerMinute) {
      return { allowed: false, reason: "RATE_LIMIT_EXCEEDED" };
    }
    window.count++;
    this.counters.set(command.actorId, window);

    return { allowed: true };
  }

  private validatePayload(command: OfficeCommand): string | null {
    const p = command.payload as Record<string, unknown>;
    switch (command.commandType) {
      case CommandType.ISSUE_ADD_COMMENT: {
        if (typeof p.issueNumber !== "number" || p.issueNumber <= 0) return "INVALID_PAYLOAD";
        if (typeof p.body !== "string" || p.body.length === 0) return "INVALID_PAYLOAD";
        return null;
      }
      case CommandType.ISSUE_ADD_LABEL:
      case CommandType.ISSUE_REMOVE_LABEL: {
        if (typeof p.issueNumber !== "number" || p.issueNumber <= 0) return "INVALID_PAYLOAD";
        if (typeof p.label !== "string" || p.label.length === 0) return "INVALID_PAYLOAD";
        return null;
      }
      case CommandType.PR_REQUEST_REVIEW: {
        if (typeof p.prNumber !== "number" || p.prNumber <= 0) return "INVALID_PAYLOAD";
        if (!Array.isArray(p.reviewers) || p.reviewers.length === 0) return "INVALID_PAYLOAD";
        for (const r of p.reviewers) {
          if (typeof r !== "string" || r.length === 0) return "INVALID_PAYLOAD";
        }
        return null;
      }
      default:
        return null;
    }
  }
}
