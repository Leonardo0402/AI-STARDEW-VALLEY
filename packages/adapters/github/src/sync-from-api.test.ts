import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { GitHubRuntimeAdapter } from "./index.js";
import { GitHubApiClient } from "./github-api-client.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GitHubRuntimeAdapter.syncFromApi", () => {
  it("fetches issues and PRs via client, projects to snapshot", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json([
          {
            number: 10,
            html_url: "https://github.com/owner/repo/issues/10",
            title: "Implement login",
            body: "Need login",
            state: "open",
            state_reason: null,
            labels: [{ name: "priority:high" }],
            assignees: [{ login: "octocat" }],
            created_at: "2026-01-02T08:00:00Z",
            closed_at: null,
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json([]);
      }),
      http.get("https://api.github.com/repos/owner/repo/pulls", () => {
        return HttpResponse.json([
          {
            number: 20,
            html_url: "https://github.com/owner/repo/pull/20",
            title: "Add login component",
            body: "Implements login",
            state: "open",
            draft: false,
            merged: false,
            merged_at: null,
            merged_by: null,
            merge_commit_sha: null,
            head: { ref: "feature/login" },
            base: { ref: "main" },
            labels: [],
            requested_reviewers: [],
            created_at: "2026-01-09T08:00:00Z",
            closed_at: null,
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/pulls/20/reviews", () => {
        return HttpResponse.json([]);
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/20/comments", () => {
        return HttpResponse.json([]);
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    const adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
    await adapter.syncFromApi(client, "owner", "repo");

    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);

    // 1 issue task + 1 PR task
    expect(snap.tasks).toHaveLength(2);
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-issue-10");
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-pr-task-20");

    // 1 artifact for the PR
    expect(snap.artifacts).toHaveLength(1);
    expect(snap.artifacts[0].artifactId).toBe("gh-pr-20");

    // evidence preserved
    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-10"]).toBeDefined();
    expect(evidence.artifacts["gh-pr-20"]).toBeDefined();
  });
});
