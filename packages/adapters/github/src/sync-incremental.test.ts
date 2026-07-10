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

describe("GitHubRuntimeAdapter.syncIncremental — new entity", () => {
  it("emits full lifecycle for a new issue discovered in incremental sync", async () => {
    // First sync: 1 issue
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", ({ request }) => {
        const since = new URL(request.url).searchParams.get("since");
        if (!since) {
          return HttpResponse.json([
            {
              number: 10,
              html_url: "https://github.com/owner/repo/issues/10",
              title: "Existing issue",
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
        }
        // Incremental: issue #10 unchanged + new issue #11
        return HttpResponse.json([
          {
            number: 10,
            html_url: "https://github.com/owner/repo/issues/10",
            title: "Existing issue",
            body: "",
            state: "open",
            state_reason: null,
            labels: [],
            assignees: [],
            created_at: "2026-01-02T08:00:00Z",
            updated_at: "2026-01-02T08:00:00Z",
            closed_at: null,
          },
          {
            number: 11,
            html_url: "https://github.com/owner/repo/issues/11",
            title: "New issue",
            body: "New",
            state: "open",
            state_reason: null,
            labels: [],
            assignees: [],
            created_at: "2026-01-06T08:00:00Z",
            updated_at: "2026-01-06T08:00:00Z",
            closed_at: null,
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/10/comments", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/issues/11/comments", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/pulls", () => HttpResponse.json([])),
    );

    const client = new GitHubApiClient({ token: "" });
    const adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
    await adapter.syncIncremental(client, "owner", "repo");

    const eventsBefore = adapter.getEventLog().length;

    // Second sync: incremental
    await adapter.syncIncremental(client, "owner", "repo");

    const eventsAfter = adapter.getEventLog().length;
    const newEvents = eventsAfter - eventsBefore;

    // New issue #11 → task.created emitted; existing #10 unchanged → no events
    expect(newEvents).toBe(1);

    const snap = await adapter.getSnapshot();
    expect(snap.tasks).toHaveLength(2);
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-issue-11");
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(adapter.getCursor()).toBe("2026-01-06T08:00:00Z");
  });
});
