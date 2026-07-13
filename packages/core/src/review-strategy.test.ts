import { describe, it, expect } from "vitest";
import type { ArtifactSnapshot } from "@agent-office/protocol";
import { RuleBasedReviewStrategy } from "./review-strategy.js";

function makeArtifact(status: ArtifactSnapshot["status"]): ArtifactSnapshot {
  return {
    artifactId: "art-1",
    runtimeId: "rt-1",
    taskId: "task-1",
    producerAgentId: "agent-1",
    type: "pr",
    title: "Test PR",
    status,
    uri: "https://github.com/owner/repo/pull/42",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    reviewResult: null,
  };
}

describe("RuleBasedReviewStrategy", () => {
  const strategy = new RuleBasedReviewStrategy();

  it("returns rejected when artifact is not found", () => {
    const result = strategy.review({
      targetKind: "pr",
      targetNumber: 42,
      artifact: undefined,
    });
    expect(result.verdict).toBe("rejected");
    expect(result.comment).toContain("artifact not found");
  });

  it("returns revision_required when artifact status is rejected", () => {
    const result = strategy.review({
      targetKind: "pr",
      targetNumber: 42,
      artifact: makeArtifact("rejected"),
    });
    expect(result.verdict).toBe("revision_required");
    expect(result.comment).toContain("previously rejected");
  });

  it("returns approved when artifact status is approved (idempotent)", () => {
    const result = strategy.review({
      targetKind: "pr",
      targetNumber: 42,
      artifact: makeArtifact("approved"),
    });
    expect(result.verdict).toBe("approved");
    expect(result.comment).toContain("already approved");
  });

  it("returns revision_required when artifact status is draft", () => {
    const result = strategy.review({
      targetKind: "pr",
      targetNumber: 42,
      artifact: makeArtifact("draft"),
    });
    expect(result.verdict).toBe("revision_required");
    expect(result.comment).toContain("still in draft");
  });

  it("returns approved when artifact status is generated (default pass)", () => {
    const result = strategy.review({
      targetKind: "pr",
      targetNumber: 42,
      artifact: makeArtifact("generated"),
    });
    expect(result.verdict).toBe("approved");
    expect(result.comment).toContain("passed automated checks");
  });
});
