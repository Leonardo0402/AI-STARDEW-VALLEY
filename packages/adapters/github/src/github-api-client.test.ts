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
