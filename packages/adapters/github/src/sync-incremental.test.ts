import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { GitHubRuntimeAdapter } from "./github-adapter.js";
import { GitHubApiClient } from "./github-api-client.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GitHubRuntimeAdapter.syncIncremental — first sync (empty cursor)", () => {
  it("falls back to full syncFromApi when cursor is empty", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json([
          {
            number: 10,
            html_url: "https://github.com/owner/repo/issues/10",
            title: "First issue",
            body: "",
            state: "open",
            state_reason: null,
            labels: [],
            assignees: [],
            created_at: "2026-01-02T08:00:00Z",
            updated_at: "2026-01-02T08:00:00Z",
            closed_at: null,
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/10/comments", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/pulls", () => HttpResponse.json([])),
    );

    const client = new GitHubApiClient({ token: "" });
    const adapter = new GitHubRuntimeAdapter();
    await adapter.connect();

    expect(adapter.getCursor()).toBe("");
    await adapter.syncIncremental(client, "owner", "repo");

    const snap = await adapter.getSnapshot();
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].taskId).toBe("gh-issue-10");
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(adapter.getCursor()).toBe("2026-01-02T08:00:00Z");
  });
});
