/**
 * Label Mapping 测试 — label → priority/status 映射。
 * 覆盖 AC7。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { ISSUE_BLOCKED, ISSUE_OPEN } from "./fixtures/index.js";
import type { GitHubFixtures, GitHubIssueFixture } from "./types.js";

describe("GitHub label mapping", () => {
  let adapter: GitHubRuntimeAdapter;

  beforeEach(async () => {
    adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
  });

  function makeIssue(overrides: Partial<GitHubIssueFixture>): GitHubIssueFixture {
    return {
      number: 100,
      url: "https://github.com/owner/repo/issues/100",
      title: "test issue",
      body: "test body",
      state: "open",
      labels: [],
      assignees: [],
      createdAt: "2026-01-01T00:00:00Z",
      closedAt: null,
      comments: [],
      ...overrides,
    };
  }

  function syncIssue(issue: GitHubIssueFixture): void {
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues: [issue],
      pulls: [],
    });
  }

  // ─── Priority label → task.priority ──────────────────────────

  it("priority:urgent → task.priority=urgent", async () => {
    syncIssue(makeIssue({ labels: [{ name: "priority:urgent" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("urgent");
  });

  it("P0 → task.priority=urgent", async () => {
    syncIssue(makeIssue({ labels: [{ name: "P0" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("urgent");
  });

  it("priority:high → task.priority=high", async () => {
    syncIssue(makeIssue({ labels: [{ name: "priority:high" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("high");
  });

  it("P1 → task.priority=high", async () => {
    syncIssue(makeIssue({ labels: [{ name: "P1" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("high");
  });

  it("priority:low → task.priority=low", async () => {
    syncIssue(makeIssue({ labels: [{ name: "priority:low" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("low");
  });

  it("无 priority label → task.priority=normal（默认）", async () => {
    syncIssue(makeIssue({ labels: [{ name: "feature" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("normal");
  });

  // ─── blocked label → task.status=blocked ────────────────────

  it("blocked label → task.status=blocked + blockedReason", async () => {
    syncIssue(ISSUE_BLOCKED);
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("blocked");
    expect(snap.tasks[0].blockedReason).toBe("GitHub label: blocked");
  });

  // ─── 其他 label → evidence only ─────────────────────────────

  it("review-needed label → evidence only（task 保持 created）", async () => {
    syncIssue(makeIssue({ labels: [{ name: "review-needed" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("created");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-100"].labels).toContain("review-needed");
  });

  it("wontfix label → evidence only", async () => {
    syncIssue(makeIssue({ labels: [{ name: "wontfix" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("created");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-100"].labels).toContain("wontfix");
  });

  // ─── 大小写不敏感 ───────────────────────────────────────────

  it("label 大小写不敏感：PRIORITY:URGENT → urgent", async () => {
    syncIssue(makeIssue({ labels: [{ name: "PRIORITY:URGENT" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("urgent");
  });
});
