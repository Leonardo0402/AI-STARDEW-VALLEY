/**
 * Projection 测试 — issue/PR fixture → snapshot 投影。
 * 覆盖 AC1, AC2, AC3, AC5, AC7。
 *
 * 每个 fixture replay 测试都断言 reducer errors === []（Fix 6）。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { projectSnapshot } from "@agent-office/core";
import {
  ISSUE_OPEN,
  ISSUE_CLOSED_COMPLETED,
  ISSUE_CLOSED_NOT_PLANNED,
  ISSUE_BLOCKED,
  ISSUE_CLOSED_BLOCKED,
  PR_OPEN,
  PR_DRAFT,
  PR_REVIEW_REQUESTED,
  PR_CHANGES_REQUESTED,
  PR_APPROVED,
  PR_MERGED,
  PR_CLOSED_UNMERGED,
  PR_CLOSED_UNMERGED_NO_REVIEW,
} from "./fixtures/index.js";

describe("GitHub projection: issue/PR → snapshot", () => {
  let adapter: GitHubRuntimeAdapter;

  beforeEach(async () => {
    adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
  });

  function syncFixtures(issues: any[], pulls: any[]): void {
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues,
      pulls,
    });
  }

  // ─── AC1: GitHub Issue → Runtime-backed Office Task ───────────

  it("open issue → task.status=created + evidence", async () => {
    syncFixtures([ISSUE_OPEN], []);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].taskId).toBe("gh-issue-10");
    expect(snap.tasks[0].status).toBe("created");
    expect(snap.tasks[0].title).toBe("Implement login page");
    expect(snap.tasks[0].priority).toBe("high");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-10"]).toBeDefined();
    expect(evidence.tasks["gh-issue-10"].kind).toBe("issue");
    expect(evidence.tasks["gh-issue-10"].number).toBe(10);
  });

  it("closed-completed issue → task.status=completed + evidence.stateReason=completed", async () => {
    syncFixtures([ISSUE_CLOSED_COMPLETED], []);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.tasks[0].status).toBe("completed");
    expect(snap.tasks[0].completedAt).toBe("2026-01-06T10:00:00Z");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-11"].stateReason).toBe("completed");
    expect(evidence.tasks["gh-issue-11"].closedAt).toBe("2026-01-06T10:00:00Z");
  });

  it("closed-not-planned issue → task.status=completed + evidence.stateReason=not_planned", async () => {
    syncFixtures([ISSUE_CLOSED_NOT_PLANNED], []);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.tasks[0].status).toBe("completed");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-12"].rawState).toBe("closed");
    expect(evidence.tasks["gh-issue-12"].stateReason).toBe("not_planned");
    expect(evidence.tasks["gh-issue-12"].closedAt).toBe("2026-01-07T10:00:00Z");
  });

  it("open blocked issue → task.status=blocked", async () => {
    syncFixtures([ISSUE_BLOCKED], []);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.tasks[0].status).toBe("blocked");
    expect(snap.tasks[0].blockedReason).toBe("GitHub label: blocked");
  });

  it("closed+blocked issue → task.status=completed (blocked 只适用于 open)", async () => {
    syncFixtures([ISSUE_CLOSED_BLOCKED], []);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.tasks[0].status).toBe("completed");
    expect(snap.tasks[0].blockedReason).toBe(null);
    expect(snap.tasks[0].completedAt).toBe("2026-01-10T10:00:00Z");
  });

  // ─── AC2: GitHub PR → Runtime-backed Artifact ────────────────

  it("open PR → artifact.status=generated", async () => {
    syncFixtures([], [PR_OPEN]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.artifacts).toHaveLength(1);
    expect(snap.artifacts[0].artifactId).toBe("gh-pr-20");
    expect(snap.artifacts[0].status).toBe("generated");
    expect(snap.artifacts[0].type).toBe("github_pr");
    expect(snap.artifacts[0].uri).toBe("https://github.com/owner/repo/pull/20");
  });

  it("draft PR → artifact.status=draft", async () => {
    syncFixtures([], [PR_DRAFT]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.artifacts[0].status).toBe("draft");
  });

  it("review-requested PR → artifact.status=under_review", async () => {
    syncFixtures([], [PR_REVIEW_REQUESTED]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.artifacts[0].status).toBe("under_review");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.artifacts["gh-pr-22"].reviewers).toEqual(["reviewer1", "reviewer2"]);
  });

  it("changes-requested PR → artifact.status=revision_required + task.status=revision_required", async () => {
    syncFixtures([], [PR_CHANGES_REQUESTED]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.artifacts[0].status).toBe("revision_required");
    expect(snap.artifacts[0].reviewResult?.verdict).toBe("revision_required");
    expect(snap.tasks[0].status).toBe("revision_required");
  });

  it("approved PR → artifact.status=approved", async () => {
    syncFixtures([], [PR_APPROVED]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.artifacts[0].status).toBe("approved");
    expect(snap.artifacts[0].reviewResult?.verdict).toBe("approved");
  });

  it("merged PR → artifact.status=delivered + task.completed", async () => {
    syncFixtures([], [PR_MERGED]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.artifacts[0].status).toBe("delivered");

    const task = snap.tasks.find((t) => t.taskId === "gh-pr-task-25");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");
  });

  it("closed-unmerged PR with review → artifact.status=rejected + task.completed", async () => {
    syncFixtures([], [PR_CLOSED_UNMERGED]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.artifacts[0].status).toBe("rejected");

    const task = snap.tasks.find((t) => t.taskId === "gh-pr-task-26");
    expect(task!.status).toBe("completed");
  });

  it("closed-unmerged PR without reviews → artifact.status=rejected (artifact.closed, no faked reviewer)", async () => {
    syncFixtures([], [PR_CLOSED_UNMERGED_NO_REVIEW]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.artifacts).toHaveLength(1);
    expect(snap.artifacts[0].status).toBe("rejected");
    // 不应有 reviewResult（未伪造 reviewer）
    expect(snap.artifacts[0].reviewResult).toBe(null);

    const task = snap.tasks.find((t) => t.taskId === "gh-pr-task-27");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.artifacts["gh-pr-27"].stateReason).toBe("closed-unmerged");
    expect(evidence.artifacts["gh-pr-27"].closedAt).toBe("2026-01-16T12:00:00Z");
  });

  // ─── AC3: label/state/comment/review status 通过 evidence 或 Event ──

  it("comments 进入 evidence", async () => {
    syncFixtures([ISSUE_OPEN], []);
    await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-10"].comments).toHaveLength(1);
    expect(evidence.tasks["gh-issue-10"].comments[0].author).toBe("dev1");
  });

  it("labels 进入 evidence", async () => {
    syncFixtures([ISSUE_OPEN], []);
    await adapter.getSnapshot();
    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-10"].labels).toContain("priority:high");
    expect(evidence.tasks["gh-issue-10"].labels).toContain("feature");
  });

  // ─── AC5: agents=[] rooms=[]，无伪造 ─────────────────────────

  it("snapshot 中 agents=[] rooms=[]（无 office agent/room 伪造）", async () => {
    syncFixtures([ISSUE_OPEN], [PR_OPEN]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.agents).toHaveLength(0);
    expect(snap.rooms).toHaveLength(0);
  });

  it("projectSnapshot 不伪造 GitHub 业务状态", async () => {
    syncFixtures([ISSUE_OPEN], [PR_OPEN]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    const projection = projectSnapshot(snap);
    expect(projection.agents).toHaveLength(0);
    expect(projection.rooms).toHaveLength(0);
    expect(projection.tasks).toHaveLength(2);
    expect(projection.artifacts).toHaveLength(1);
  });

  // ─── AC5 续：无 evidence 则不存在 ────────────────────────────

  it("snapshot.tasks 数量 == evidence.tasks 数量 == fixture issue 数量", async () => {
    syncFixtures([ISSUE_OPEN, ISSUE_CLOSED_COMPLETED], []);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    const evidence = adapter.getGitHubEvidence();
    expect(snap.tasks).toHaveLength(2);
    expect(Object.keys(evidence.tasks)).toHaveLength(2);
  });

  it("snapshot.artifacts 数量 == evidence.artifacts 数量 == fixture PR 数量", async () => {
    syncFixtures([], [PR_OPEN, PR_DRAFT]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    const evidence = adapter.getGitHubEvidence();
    expect(snap.artifacts).toHaveLength(2);
    expect(Object.keys(evidence.artifacts)).toHaveLength(2);
  });

  // ─── 每个 PR 产出 1 个 task + 1 个 artifact ─────────────────

  it("每个 PR 产出 1 个 task（gh-pr-task-{N}）+ 1 个 artifact（gh-pr-{N}）", async () => {
    syncFixtures([], [PR_OPEN, PR_DRAFT, PR_MERGED]);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.tasks).toHaveLength(3);
    expect(snap.artifacts).toHaveLength(3);
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-pr-task-20");
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-pr-task-21");
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-pr-task-25");
    expect(snap.artifacts.map((a) => a.artifactId)).toContain("gh-pr-20");
    expect(snap.artifacts.map((a) => a.artifactId)).toContain("gh-pr-21");
    expect(snap.artifacts.map((a) => a.artifactId)).toContain("gh-pr-25");
  });

  // ─── Closes #X 仅作 evidence，不触发 issue close ──────────────

  it("PR body 中 Closes #X 仅作 evidence，不替代 acceptance", async () => {
    syncFixtures([], [PR_MERGED]); // PR_MERGED body 含 "Closes #11"
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    const evidence = adapter.getGitHubEvidence();
    expect(evidence.artifacts["gh-pr-25"].refsIssueNumbers).toContain(11);
    // PR 自身已 merged → task.completed，但这不是因为 Closes #11
    expect(snap.tasks[0].status).toBe("completed");
  });

  // ─── 全量 fixture replay：reducer errors 必须为空 ───────────

  it("全量 SAMPLE_FIXTURES replay 无 reducer errors", async () => {
    const { SAMPLE_FIXTURES } = await import("./fixtures/index.js");
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(snap.tasks.length).toBeGreaterThan(0);
    expect(snap.artifacts.length).toBeGreaterThan(0);
  });
});
