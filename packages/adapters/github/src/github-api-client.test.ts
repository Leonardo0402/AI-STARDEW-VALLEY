import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { GitHubApiClient, GitHubApiError } from "./github-api-client.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GitHubApiClient rawGet (via fetchIssues stub)", () => {
  it("sends Authorization Bearer header when token is non-empty", async () => {
    let receivedAuth: string | null = null;
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", ({ request }) => {
        receivedAuth = request.headers.get("authorization");
        return HttpResponse.json([], { headers: { link: "" } });
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test123" });
    // fetchIssues not yet implemented; test rawGet via a temporary public method
    // We'll test through fetchIssues once implemented; for now test header building
    // by calling a minimal path
    await client.fetchIssues("owner", "repo").catch(() => {});

    expect(receivedAuth).toBe("Bearer ghp_test123");
  });

  it("does not send Authorization header when token is empty string", async () => {
    let receivedAuth: string | null = null;
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", ({ request }) => {
        receivedAuth = request.headers.get("authorization");
        return HttpResponse.json([], { headers: { link: "" } });
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    await client.fetchIssues("owner", "repo").catch(() => {});

    expect(receivedAuth).toBe(null);
  });
});

describe("GitHubApiClient.fetchIssues", () => {
  it("fetches issues with pagination, comments, and maps to fixture type", async () => {
    // Page 1: 2 issues (one is a PR to be filtered), Link header to page 2
    // Page 2: 1 real issue
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "1";
        if (page === "1") {
          return HttpResponse.json(
            [
              {
                number: 10,
                html_url: "https://github.com/owner/repo/issues/10",
                title: "Implement login",
                body: "Need login page",
                state: "open",
                state_reason: null,
                labels: [{ name: "priority:high" }],
                assignees: [{ login: "octocat", url: "https://github.com/octocat" }],
                created_at: "2026-01-02T08:00:00Z",
                closed_at: null,
              },
              {
                number: 20,
                html_url: "https://github.com/owner/repo/pull/20",
                title: "Add login component",
                body: "Implements login",
                state: "open",
                state_reason: null,
                labels: [],
                assignees: [],
                created_at: "2026-01-09T08:00:00Z",
                closed_at: null,
                pull_request: { url: "https://api.github.com/repos/owner/repo/pulls/20" },
              },
            ],
            {
              headers: {
                link: '<https://api.github.com/repos/owner/repo/issues?state=all&per_page=100&page=2>; rel="next"',
              },
            },
          );
        }
        return HttpResponse.json([
          {
            number: 11,
            html_url: "https://github.com/owner/repo/issues/11",
            title: "Closed issue",
            body: "Done",
            state: "closed",
            state_reason: "completed",
            labels: [],
            assignees: [],
            created_at: "2026-01-05T08:00:00Z",
            closed_at: "2026-01-06T10:00:00Z",
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json([
          {
            user: { login: "dev1", url: "https://github.com/dev1" },
            body: "Started",
            created_at: "2026-01-03T09:00:00Z",
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/11/comments", () => {
        return HttpResponse.json([]);
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    const issues = await client.fetchIssues("owner", "repo");

    // PR (#20) filtered out, only issues #10 and #11
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.number)).toEqual([10, 11]);

    // JSON → fixture mapping
    expect(issues[0].url).toBe("https://github.com/owner/repo/issues/10");
    expect(issues[0].title).toBe("Implement login");
    expect(issues[0].state).toBe("open");
    expect(issues[0].labels[0].name).toBe("priority:high");
    expect(issues[0].assignees[0].login).toBe("octocat");
    expect(issues[0].createdAt).toBe("2026-01-02T08:00:00Z");

    // N+1 comments fetched
    expect(issues[0].comments).toHaveLength(1);
    expect(issues[0].comments[0].author.login).toBe("dev1");
    expect(issues[0].comments[0].body).toBe("Started");
    expect(issues[0].comments[0].createdAt).toBe("2026-01-03T09:00:00Z");

    // stateReason preserved
    expect(issues[1].stateReason).toBe("completed");
    expect(issues[1].closedAt).toBe("2026-01-06T10:00:00Z");
  });
});

describe("GitHubApiClient.fetchPRs", () => {
  it("fetches PRs with reviews and maps to fixture type", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/pulls", ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "1";
        if (page === "1") {
          return HttpResponse.json(
            [
              {
                number: 25,
                html_url: "https://github.com/owner/repo/pull/25",
                title: "Merged PR",
                body: "Closes #11",
                state: "closed",
                draft: false,
                merged: true,
                merged_at: "2026-01-15T12:00:00Z",
                merged_by: { login: "octocat", url: "https://github.com/octocat" },
                merge_commit_sha: "abc123",
                head: { ref: "feature/login" },
                base: { ref: "main" },
                labels: [],
                requested_reviewers: [],
                created_at: "2026-01-09T08:00:00Z",
                closed_at: "2026-01-15T12:00:00Z",
              },
            ],
            { headers: { link: "" } },
          );
        }
        return HttpResponse.json([]);
      }),
      http.get("https://api.github.com/repos/owner/repo/pulls/25/reviews", () => {
        return HttpResponse.json([
          {
            user: { login: "reviewer1", url: "https://github.com/reviewer1" },
            state: "APPROVED",
            body: "Looks good",
            submitted_at: "2026-01-14T10:00:00Z",
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/25/comments", () => {
        return HttpResponse.json([]);
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    const prs = await client.fetchPRs("owner", "repo");

    expect(prs).toHaveLength(1);
    const pr = prs[0];
    expect(pr.number).toBe(25);
    expect(pr.url).toBe("https://github.com/owner/repo/pull/25");
    expect(pr.merged).toBe(true);
    expect(pr.mergedAt).toBe("2026-01-15T12:00:00Z");
    expect(pr.mergedBy!.login).toBe("octocat");
    expect(pr.mergeCommitSha).toBe("abc123");
    expect(pr.headRef).toBe("feature/login");
    expect(pr.baseRef).toBe("main");

    // N+1 reviews fetched
    expect(pr.reviews).toHaveLength(1);
    expect(pr.reviews[0].author.login).toBe("reviewer1");
    expect(pr.reviews[0].state).toBe("APPROVED");
    expect(pr.reviews[0].body).toBe("Looks good");
    expect(pr.reviews[0].submittedAt).toBe("2026-01-14T10:00:00Z");
  });
});
