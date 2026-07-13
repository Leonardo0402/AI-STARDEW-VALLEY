/**
 * ReviewStrategy — pure function interface for agent review verdict generation.
 *
 * Phase 2.6 uses RuleBasedReviewStrategy (deterministic rules).
 * Phase 3 will replace with LLM-driven implementation.
 */
import type { ArtifactSnapshot } from "@agent-office/protocol";

export interface ReviewContext {
  targetKind: "pr" | "issue";
  targetNumber: number;
  artifact?: ArtifactSnapshot;
}

export interface ReviewResult {
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
}

export interface ReviewStrategy {
  review(ctx: ReviewContext): ReviewResult;
}

/**
 * RuleBasedReviewStrategy — default stub implementation.
 *
 * Rules (in order):
 * 1. artifact not found → rejected
 * 2. artifact rejected → revision_required (needs revision before approval)
 * 3. artifact approved → approved (idempotent)
 * 4. artifact draft → revision_required (incomplete)
 * 5. default (generated/under_review/revision_required/delivered) → approved
 */
export class RuleBasedReviewStrategy implements ReviewStrategy {
  review(ctx: ReviewContext): ReviewResult {
    if (!ctx.artifact) {
      return {
        verdict: "rejected",
        comment: `Cannot review ${ctx.targetKind} #${ctx.targetNumber}: artifact not found in snapshot.`,
      };
    }

    if (ctx.artifact.status === "rejected") {
      return {
        verdict: "revision_required",
        comment: `Artifact ${ctx.artifact.artifactId} was previously rejected; revision required before approval.`,
      };
    }

    if (ctx.artifact.status === "approved") {
      return {
        verdict: "approved",
        comment: `Artifact ${ctx.artifact.artifactId} already approved.`,
      };
    }

    if (ctx.artifact.status === "draft") {
      return {
        verdict: "revision_required",
        comment: `Artifact ${ctx.artifact.artifactId} is still in draft; complete work before requesting review.`,
      };
    }

    return {
      verdict: "approved",
      comment: `Automated review: artifact ${ctx.artifact.artifactId} passed automated checks.`,
    };
  }
}
