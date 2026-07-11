import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
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

describe("GitHubApiClient rate limit handling", () => {
  it("waits when X-RateLimit-Remaining is 0 and reset is within 60s", async () => {
    const now = Math.floor(Date.now() / 1000);
    const resetSec = now + 2; // 2 seconds in the future
    let callCount = 0;

    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", ({ request }) => {
        callCount++;
        const remaining = callCount === 1 ? "0" : "100";
        return HttpResponse.json([], {
          headers: {
            "x-ratelimit-remaining": remaining,
            "x-ratelimit-reset": String(resetSec),
            link: "",
          },
        });
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/*/comments", () => {
        return HttpResponse.json([]);
      }),
    );

    const sleepSpy = vi.spyOn(global, "setTimeout");
    const client = new GitHubApiClient({ token: "" });
    await client.fetchIssues("owner", "repo");

    // waitForRateLimit should have been called (setTimeout with positive delay).
    // setTimeout signature is (callback, delay) — extract delay at index 1.
    // rawGet's AbortController timeout (30000ms) is also captured; filter for the rate-limit wait.
    const delays = sleepSpy.mock.calls.map((c) => c[1] as number).filter((d) => d > 0);
    expect(delays.length).toBeGreaterThan(0);
    const rateLimitDelays = delays.filter((d) => d <= 3000);
    expect(rateLimitDelays.length).toBeGreaterThan(0);
    expect(rateLimitDelays[0]).toBeLessThanOrEqual(3000);
  });

  it("throws GitHubApiError when reset is more than 60s away", async () => {
    const now = Math.floor(Date.now() / 1000);
    const resetSec = now + 120; // 120 seconds in the future

    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json([], {
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(resetSec),
            link: "",
          },
        });
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    await expect(client.fetchIssues("owner", "repo")).rejects.toThrow(GitHubApiError);
    await expect(client.fetchIssues("owner", "repo")).rejects.toThrow(/rate limit/i);
  });
});

describe("GitHubApiClient error handling", () => {
  it("throws GitHubApiError with status 401 for unauthorized", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json(
          { message: "Bad credentials" },
          { status: 401 },
        );
      }),
    );

    const client = new GitHubApiClient({ token: "invalid" });
    await expect(client.fetchIssues("owner", "repo")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 401,
    });
  });

  it("throws GitHubApiError with status 404 for missing repo", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json(
          { message: "Not Found" },
          { status: 404 },
        );
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    await expect(client.fetchIssues("owner", "repo")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 404,
    });
  });

  it("throws GitHubApiError with status 500 for server error", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json(
          { message: "Internal Server Error" },
          { status: 500 },
        );
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    await expect(client.fetchIssues("owner", "repo")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 500,
    });
  });

  it("includes rateLimitRemaining and rateLimitReset in error when present", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json(
          { message: "Rate limit exceeded" },
          {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1690000000",
            },
          },
        );
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    const err = (await client.fetchIssues("owner", "repo").catch((e) => e as GitHubApiError)) as GitHubApiError;
    expect(err).toBeInstanceOf(GitHubApiError);
    expect(err.rateLimitRemaining).toBe(0);
    expect(err.rateLimitReset).toBe(1690000000);
  });
});

describe("GitHubApiClient.fetchIssuesSince", () => {
  it("fetches only issues updated after the since cursor", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", ({ request }) => {
        const since = new URL(request.url).searchParams.get("since");
        expect(since).toBe("2026-01-05T00:00:00Z");
        return HttpResponse.json(
          [
            {
              number: 10,
              html_url: "https://github.com/owner/repo/issues/10",
              title: "Updated issue",
              body: "Changed",
              state: "open",
              state_reason: null,
              labels: [],
              assignees: [],
              created_at: "2026-01-02T08:00:00Z",
              updated_at: "2026-01-06T08:00:00Z",
              closed_at: null,
            },
          ],
          { headers: { link: "" } },
        );
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json([]);
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    const issues = await client.fetchIssuesSince("owner", "repo", "2026-01-05T00:00:00Z");

    expect(issues).toHaveLength(1);
    expect(issues[0].number).toBe(10);
    expect(issues[0].updatedAt).toBe("2026-01-06T08:00:00Z");
  });

  it("falls back to full fetchIssues when since is empty string", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", ({ request }) => {
        const since = new URL(request.url).searchParams.get("since");
        expect(since).toBeNull();
        return HttpResponse.json([], { headers: { link: "" } });
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    const issues = await client.fetchIssuesSince("owner", "repo", "");
    expect(issues).toEqual([]);
  });
});

describe("GitHubApiClient.fetchPRsSince", () => {
  it("fetches PRs sorted by updated desc and stops at early-termination boundary", async () => {
    let page1Requested = false;
    let page2Requested = false;

    server.use(
      http.get("https://api.github.com/repos/owner/repo/pulls", ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "1";
        const sort = new URL(request.url).searchParams.get("sort");
        const direction = new URL(request.url).searchParams.get("direction");
        expect(sort).toBe("updated");
        expect(direction).toBe("desc");

        if (page === "1") {
          page1Requested = true;
          return HttpResponse.json(
            [
              {
                number: 30,
                html_url: "https://github.com/owner/repo/pull/30",
                title: "Recent PR",
                body: "",
                state: "open",
                draft: false,
                merged: false,
                merged_at: null,
                merged_by: null,
                merge_commit_sha: null,
                head: { ref: "feature/a" },
                base: { ref: "main" },
                labels: [],
                requested_reviewers: [],
                created_at: "2026-01-08T08:00:00Z",
                updated_at: "2026-01-10T08:00:00Z",
                closed_at: null,
              },
              {
                number: 20,
                html_url: "https://github.com/owner/repo/pull/20",
                title: "Old PR at boundary",
                body: "",
                state: "open",
                draft: false,
                merged: false,
                merged_at: null,
                merged_by: null,
                merge_commit_sha: null,
                head: { ref: "feature/b" },
                base: { ref: "main" },
                labels: [],
                requested_reviewers: [],
                created_at: "2026-01-01T08:00:00Z",
                updated_at: "2026-01-04T08:00:00Z",
                closed_at: null,
              },
            ],
            {
              headers: {
                link: '<https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100&sort=updated&direction=desc&page=2>; rel="next"',
              },
            },
          );
        }
        page2Requested = true;
        return HttpResponse.json([]);
      }),
      http.get("https://api.github.com/repos/owner/repo/pulls/30/reviews", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/pulls/20/reviews", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/issues/30/comments", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/issues/20/comments", () => HttpResponse.json([])),
    );

    const client = new GitHubApiClient({ token: "" });
    const prs = await client.fetchPRsSince("owner", "repo", "2026-01-05T00:00:00Z");

    // PR #30 (updated 2026-01-10 > since) is included
    // PR #20 (updated 2026-01-04 <= since) triggers early stop, excluded
    expect(prs).toHaveLength(1);
    expect(prs[0].number).toBe(30);
    expect(page1Requested).toBe(true);
    expect(page2Requested).toBe(false);
  });

  it("falls back to full fetchPRs when since is empty string", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/pulls", ({ request }) => {
        const sort = new URL(request.url).searchParams.get("sort");
        expect(sort).toBeNull();
        return HttpResponse.json([], { headers: { link: "" } });
      }),
    );

    const client = new GitHubApiClient({ token: "" });
    const prs = await client.fetchPRsSince("owner", "repo", "");
    expect(prs).toEqual([]);
  });
});

describe("GitHubApiClient.addComment", () => {
  it("posts a comment and returns {commentId, createdAt}", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/comments", async ({ request }) => {
        const body = (await request.json()) as { body: string };
        expect(body.body).toBe("Nice work");
        return HttpResponse.json({
          id: 12345,
          created_at: "2026-07-11T10:00:00Z",
        });
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    const result = await client.addComment("owner", "repo", 10, "Nice work");

    expect(result.commentId).toBe(12345);
    expect(result.createdAt).toBe("2026-07-11T10:00:00Z");
  });

  it("throws GitHubApiError(404) when issue does not exist", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/999/comments", () => {
        return HttpResponse.json(
          { message: "Not Found" },
          { status: 404 },
        );
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    await expect(client.addComment("owner", "repo", 999, "hi")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 404,
    });
  });
});

describe("GitHubApiClient.addLabel", () => {
  it("posts a label and returns void on success", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/labels", async ({ request }) => {
        const body = (await request.json()) as string[];
        expect(body).toEqual(["bug"]);
        return HttpResponse.json([{ name: "bug" }]);
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    const result = await client.addLabel("owner", "repo", 10, "bug");
    expect(result).toBeUndefined();
  });
});

describe("GitHubApiClient.removeLabel", () => {
  it("deletes a label and returns void on success", async () => {
    server.use(
      http.delete("https://api.github.com/repos/owner/repo/issues/10/labels/bug", () => {
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    const result = await client.removeLabel("owner", "repo", 10, "bug");
    expect(result).toBeUndefined();
  });

  it("throws GitHubApiError(404) when label does not exist", async () => {
    server.use(
      http.delete("https://api.github.com/repos/owner/repo/issues/10/labels/nonexistent", () => {
        return HttpResponse.json({ message: "Not Found" }, { status: 404 });
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    await expect(client.removeLabel("owner", "repo", 10, "nonexistent")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 404,
    });
  });
});
