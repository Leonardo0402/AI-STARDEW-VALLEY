# Real GitHub Read Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GitHubApiClient` and `GitHubRuntimeAdapter.syncFromApi()` to fetch real GitHub REST API data and project it through the existing fixture-based projection pipeline.

**Architecture:** A new `GitHubApiClient` class wraps GitHub REST API calls (auth, pagination, rate limit, N+1 comments/reviews), returning existing `GitHubIssueFixture`/`GitHubPRFixture` types. `GitHubRuntimeAdapter.syncFromApi(client, owner, repo)` fetches via the injected client and delegates to the existing `syncFromFixtures()` — projection logic stays untouched.

**Tech Stack:** TypeScript ES2022 + ESNext module + bundler moduleResolution, vitest, msw (Mock Service Worker) for fetch interception, native `fetch` (Node 18+).

## Global Constraints

- **Zero new runtime dependencies except msw** (devDependency only). Use native `fetch`, no octokit.
- **projection logic must not change** — `syncFromApi` delegates to `syncFromFixtures`.
- **`GitHubApiClient` is independent** — does not import `GitHubRuntimeAdapter`.
- **token is required** (`string`), but empty string is allowed for msw tests (no `Authorization` header sent).
- **comments/reviews are private methods** on `GitHubApiClient` — only `fetchIssues`/`fetchPRs` are public.
- **pagination returns complete arrays** (all pages consumed), not iterators.
- **fixture assembly order**: issues before PRs, matching `syncFromFixtures`.
- **`syncFromFixtures` already sorts by number ascending** — `syncFromApi` must NOT re-sort.
- **Existing tests must stay green** — do not modify projection/determinism/label-mapping/destructive-guard tests.
- **Test command:** `npm test`
- **Build command:** `npm run build` (runs `tsc -b`)
- **File naming:** kebab-case for files, PascalCase for classes.
- **Existing fixture types are in `packages/adapters/github/src/types.ts`** — reuse `GitHubIssueFixture`, `GitHubPRFixture`, `GitHubComment`, `GitHubReview`, `GitHubLabel`, `GitHubUser`.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `packages/adapters/github/src/github-api-client.ts` | `GitHubApiClient` class + `GitHubApiError` + `GitHubApiClientOptions` | Create |
| `packages/adapters/github/src/github-api-client.test.ts` | msw-based unit tests for API client | Create |
| `packages/adapters/github/src/github-adapter.ts` | Add `syncFromApi()` method | Modify |
| `packages/adapters/github/src/index.ts` | Export `GitHubApiClient`, `GitHubApiError`, `GitHubApiClientOptions` | Modify |
| `packages/adapters/github/package.json` | Add `msw` devDependency | Modify |
| `docs/integrations/github-adapter/README.md` | Add API mode usage example | Modify |
| `docs/integrations/github-adapter/v0-limitations.md` | Note API mode is still read-only, rate limit strategy | Modify |
| `docs/integrations/github-adapter/api-client.md` | API client usage guide | Create |

---

## Task 1: Add msw devDependency and scaffold GitHubApiClient types

**Files:**
- Modify: `packages/adapters/github/package.json`
- Create: `packages/adapters/github/src/github-api-client.ts`

**Interfaces:**
- Produces: `GitHubApiClientOptions` interface, `GitHubApiError` class, `GitHubApiClient` class (constructor only, methods throw `Error("not implemented")`)

- [ ] **Step 1: Add msw as devDependency**

Run from repo root:

```bash
npm install --save-dev msw -w packages/adapters/github
```

Expected: `package.json` of `packages/adapters/github` gains `"msw": "^2.7.0"` (or latest 2.x) under `devDependencies`, root `package-lock.json` updates.

- [ ] **Step 2: Verify msw installed**

Run:

```bash
node -e "require('msw'); console.log('msw ok')"
```

Expected: prints `msw ok` with no error.

- [ ] **Step 3: Create github-api-client.ts with types and stub class**

Create `packages/adapters/github/src/github-api-client.ts`:

```typescript
/**
 * GitHubApiClient — 调用 GitHub REST API，返回 fixture 类型。
 *
 * 职责：
 * - 鉴权（Bearer token）
 * - 分页（Link header）
 * - rate limit 感知（X-RateLimit-* headers）
 * - N+1 comments / reviews 拉取
 * - raw GitHub JSON → GitHubIssueFixture / GitHubPRFixture
 *
 * 不依赖 GitHubRuntimeAdapter，可独立测试。
 */
import type {
  GitHubIssueFixture,
  GitHubPRFixture,
  GitHubComment,
  GitHubReview,
  GitHubLabel,
  GitHubUser,
} from "./types.js";

export interface GitHubApiClientOptions {
  /** 必填。生产从 process.env.GITHUB_TOKEN 读；测试传 ""（不发 Authorization header）。 */
  token: string;
  /** 默认 "https://api.github.com"。测试可指向 msw server。 */
  baseUrl?: string;
  /** 默认 "agent-office-github-adapter"。 */
  userAgent?: string;
  /** 默认 30000。 */
  timeoutMs?: number;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimitRemaining?: number,
    public readonly rateLimitReset?: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class GitHubApiClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;

  constructor(options: GitHubApiClientOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? "https://api.github.com";
    this.userAgent = options.userAgent ?? "agent-office-github-adapter";
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async fetchIssues(owner: string, repo: string): Promise<GitHubIssueFixture[]> {
    throw new Error("not implemented");
  }

  async fetchPRs(owner: string, repo: string): Promise<GitHubPRFixture[]> {
    throw new Error("not implemented");
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:

```bash
npm run build 2>&1 | Select-String -Pattern "error|Error" | Select-Object -First 5
```

Expected: no output (no errors). If errors appear, fix them before continuing.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/github/package.json packages/adapters/github/src/github-api-client.ts package-lock.json
git commit -m "feat(github-adapter): scaffold GitHubApiClient types and msw dependency"
```

---

## Task 2: Implement rawGet + parseLinkHeader + auth headers

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts`
- Create: `packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Produces: `GitHubApiClient` with private `rawGet()` and `parseLinkHeader()` methods (tested indirectly via msw)
- Produces: test file with msw server setup pattern that later tasks extend

- [ ] **Step 1: Write failing test for rawGet (auth headers + JSON parsing)**

Create `packages/adapters/github/src/github-api-client.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run packages/adapters/github/src/github-api-client.test.ts 2>&1 | Select-Object -Last 20
```

Expected: FAIL — `fetchIssues` throws `Error("not implemented")` so auth header never sent; `receivedAuth` stays `null`.

- [ ] **Step 3: Implement rawGet, parseLinkHeader, and minimal fetchIssues**

Replace the entire `github-api-client.ts` with:

```typescript
/**
 * GitHubApiClient — 调用 GitHub REST API，返回 fixture 类型。
 *
 * 职责：
 * - 鉴权（Bearer token）
 * - 分页（Link header）
 * - rate limit 感知（X-RateLimit-* headers）
 * - N+1 comments / reviews 拉取
 * - raw GitHub JSON → GitHubIssueFixture / GitHubPRFixture
 *
 * 不依赖 GitHubRuntimeAdapter，可独立测试。
 */
import type {
  GitHubIssueFixture,
  GitHubPRFixture,
  GitHubComment,
  GitHubReview,
  GitHubLabel,
  GitHubUser,
} from "./types.js";

export interface GitHubApiClientOptions {
  token: string;
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimitRemaining?: number,
    public readonly rateLimitReset?: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

interface RawGetResult {
  body: unknown;
  headers: Headers;
  status: number;
}

export class GitHubApiClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;

  constructor(options: GitHubApiClientOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? "https://api.github.com";
    this.userAgent = options.userAgent ?? "agent-office-github-adapter";
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async fetchIssues(owner: string, repo: string): Promise<GitHubIssueFixture[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues?state=all&per_page=100`;
    const pages = await this.paginate<unknown>(url);
    // 过滤掉 PR（issues endpoint 也返回 PR，有 pull_request 字段）
    const issueJsons = pages.filter((j) => !(j as { pull_request?: unknown }).pull_request);
    const issues: GitHubIssueFixture[] = [];
    for (const json of issueJsons) {
      const issue = this.mapIssue(json as RawIssue);
      const comments = await this.fetchComments(owner, repo, issue.number);
      issue.comments = comments;
      issues.push(issue);
    }
    return issues;
  }

  async fetchPRs(owner: string, repo: string): Promise<GitHubPRFixture[]> {
    throw new Error("not implemented");
  }

  // ─── 私有方法 ───────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": this.userAgent,
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async rawGet(url: string): Promise<RawGetResult> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
        signal: ac.signal,
      });
      const text = await resp.text();
      let body: unknown = text;
      const ct = resp.headers.get("content-type") ?? "";
      if (ct.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
        try {
          body = JSON.parse(text);
        } catch {
          // keep body as text
        }
      }
      if (!resp.ok) {
        const remaining = resp.headers.get("x-ratelimit-remaining");
        const reset = resp.headers.get("x-ratelimit-reset");
        throw new GitHubApiError(
          `GitHub API error: HTTP ${resp.status} for ${url}`,
          resp.status,
          remaining !== null ? parseInt(remaining, 10) : undefined,
          reset !== null ? parseInt(reset, 10) : undefined,
        );
      }
      return { body, headers: resp.headers, status: resp.status };
    } catch (err) {
      if (err instanceof GitHubApiError) throw err;
      if (ac.signal.aborted) {
        throw new GitHubApiError(
          `Request timed out after ${this.timeoutMs}ms: ${url}`,
          0,
        );
      }
      throw new GitHubApiError(
        err instanceof Error ? err.message : String(err),
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private parseLinkHeader(link: string | null): { next?: string } {
    if (!link) return {};
    const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/);
    return nextMatch ? { next: nextMatch[1] } : {};
  }

  private async paginate<T>(url: string): Promise<T[]> {
    const all: T[] = [];
    let currentUrl: string | undefined = url;
    while (currentUrl) {
      const result = await this.rawGet(currentUrl);
      const items = result.body as T[];
      if (Array.isArray(items)) {
        all.push(...items);
      }
      const link = result.headers.get("link");
      currentUrl = this.parseLinkHeader(link).next;
    }
    return all;
  }

  private async fetchComments(owner: string, repo: string, number: number): Promise<GitHubComment[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`;
    const pages = await this.paginate<RawComment>(url);
    return pages.map((c) => this.mapComment(c));
  }

  private async fetchReviews(owner: string, repo: string, number: number): Promise<GitHubReview[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`;
    const pages = await this.paginate<RawReview>(url);
    return pages.map((r) => this.mapReview(r));
  }

  // ─── JSON 映射 ─────────────────────────────────────────

  private mapIssue(j: RawIssue): GitHubIssueFixture {
    return {
      number: j.number,
      url: j.html_url,
      title: j.title,
      body: j.body ?? "",
      state: j.state as "open" | "closed",
      stateReason: j.state_reason as GitHubIssueFixture["stateReason"],
      labels: (j.labels ?? []).map((l) => ({ name: l.name, color: l.color })),
      assignees: (j.assignees ?? []).map((a) => ({ login: a.login, url: a.url })),
      createdAt: j.created_at,
      closedAt: j.closed_at,
      comments: [],
    };
  }

  private mapPR(j: RawPR): GitHubPRFixture {
    return {
      number: j.number,
      url: j.html_url,
      title: j.title,
      body: j.body ?? "",
      state: j.state as "open" | "closed",
      draft: j.draft ?? false,
      merged: j.merged ?? false,
      mergedAt: j.merged_at,
      mergedBy: j.merged_by ? { login: j.merged_by.login, url: j.merged_by.url } : null,
      mergeCommitSha: j.merge_commit_sha,
      headRef: j.head?.ref ?? "",
      baseRef: j.base?.ref ?? "",
      labels: (j.labels ?? []).map((l) => ({ name: l.name, color: l.color })),
      requestedReviewers: (j.requested_reviewers ?? []).map((r) => ({ login: r.login, url: r.url })),
      reviews: [],
      comments: [],
      createdAt: j.created_at,
      closedAt: j.closed_at,
    };
  }

  private mapComment(j: RawComment): GitHubComment {
    return {
      author: { login: j.user.login, url: j.user.url },
      body: j.body ?? "",
      createdAt: j.created_at,
    };
  }

  private mapReview(j: RawReview): GitHubReview {
    return {
      author: { login: j.user.login, url: j.user.url },
      state: j.state as GitHubReview["state"],
      body: j.body ?? "",
      submittedAt: j.submitted_at,
    };
  }
}

// ─── Raw GitHub JSON 类型（仅内部用） ────────────────────

interface RawLabel { name: string; color?: string; }
interface RawUser { login: string; url?: string; }
interface RawComment { user: RawUser; body?: string; created_at: string; }
interface RawReview { user: RawUser; state: string; body?: string; submitted_at: string; }

interface RawIssue {
  number: number;
  html_url: string;
  title: string;
  body?: string;
  state: string;
  state_reason?: string;
  labels?: RawLabel[];
  assignees?: RawUser[];
  created_at: string;
  closed_at: string | null;
  pull_request?: unknown;
}

interface RawPR {
  number: number;
  html_url: string;
  title: string;
  body?: string;
  state: string;
  draft?: boolean;
  merged?: boolean;
  merged_at: string | null;
  merged_by?: RawUser | null;
  merge_commit_sha: string | null;
  head?: { ref: string };
  base?: { ref: string };
  labels?: RawLabel[];
  requested_reviewers?: RawUser[];
  created_at: string;
  closed_at: string | null;
}
```

- [ ] **Step 4: Run test to verify auth header tests pass**

Run:

```bash
npx vitest run packages/adapters/github/src/github-api-client.test.ts 2>&1 | Select-Object -Last 20
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-adapter): implement GitHubApiClient rawGet, pagination, auth headers"
```

---

## Task 3: Implement fetchIssues fully (with N+1 comments + JSON mapping test)

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Consumes: `GitHubApiClient` from Task 2 with `rawGet`, `paginate`, `fetchComments`, `mapIssue` already implemented
- Produces: test coverage for `fetchIssues` end-to-end (pagination + N+1 + JSON mapping + PR filtering)

- [ ] **Step 1: Write failing tests for fetchIssues**

Append to `packages/adapters/github/src/github-api-client.test.ts` (inside a new describe block, after the existing one):

```typescript
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
```

- [ ] **Step 2: Run test to verify it passes (fetchIssues already implemented in Task 2)**

Run:

```bash
npx vitest run packages/adapters/github/src/github-api-client.test.ts 2>&1 | Select-Object -Last 20
```

Expected: 3 tests PASS (2 from Task 2 + 1 new).

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/github/src/github-api-client.test.ts
git commit -m "test(github-adapter): fetchIssues pagination, N+1 comments, PR filtering"
```

---

## Task 4: Implement fetchPRs (with N+1 reviews + JSON mapping test)

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts`
- Modify: `packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Consumes: `paginate`, `fetchReviews`, `mapPR` (mapPR already implemented in Task 2, fetchReviews already implemented in Task 2)
- Produces: `fetchPRs` fully implemented and tested

- [ ] **Step 1: Write failing test for fetchPRs**

Append to `packages/adapters/github/src/github-api-client.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run packages/adapters/github/src/github-api-client.test.ts -t "fetchPRs" 2>&1 | Select-Object -Last 20
```

Expected: FAIL — `fetchPRs` throws `Error("not implemented")`.

- [ ] **Step 3: Implement fetchPRs**

In `packages/adapters/github/src/github-api-client.ts`, replace the `fetchPRs` stub:

```typescript
  async fetchPRs(owner: string, repo: string): Promise<GitHubPRFixture[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=all&per_page=100`;
    const pages = await this.paginate<RawPR>(url);
    const prs: GitHubPRFixture[] = [];
    for (const json of pages) {
      const pr = this.mapPR(json);
      const reviews = await this.fetchReviews(owner, repo, pr.number);
      pr.reviews = reviews;
      const comments = await this.fetchComments(owner, repo, pr.number);
      pr.comments = comments;
      prs.push(pr);
    }
    return prs;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run packages/adapters/github/src/github-api-client.test.ts 2>&1 | Select-Object -Last 20
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-adapter): implement fetchPRs with N+1 reviews and comments"
```

---

## Task 5: Implement rate limit handling (waitForRateLimit)

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts`
- Modify: `packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Produces: `waitForRateLimit` private method; called inside `rawGet` after every successful response

- [ ] **Step 1: Write failing tests for rate limit handling**

Append to `packages/adapters/github/src/github-api-client.test.ts`:

```typescript
import { vi } from "vitest";

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

    // waitForRateLimit should have been called (setTimeout with positive delay)
    const delays = sleepSpy.mock.calls.map((c) => c[0] as number).filter((d) => d > 0);
    expect(delays.length).toBeGreaterThan(0);
    expect(delays[0]).toBeLessThanOrEqual(3000);
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
    await expect(client.fetchIssues("owner", "repo")).rejects.toThrow(/rate limit/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run packages/adapters/github/src/github-api-client.test.ts -t "rate limit" 2>&1 | Select-Object -Last 20
```

Expected: FAIL — `waitForRateLimit` not implemented, no waiting/error thrown.

- [ ] **Step 3: Implement waitForRateLimit and call it in rawGet**

In `packages/adapters/github/src/github-api-client.ts`, add the private method and modify `rawGet`:

Add this method to the `GitHubApiClient` class (after `parseLinkHeader`):

```typescript
  private async waitForRateLimit(headers: Headers): Promise<void> {
    const remaining = headers.get("x-ratelimit-remaining");
    if (remaining === null) return;
    const remainingNum = parseInt(remaining, 10);
    if (remainingNum > 0) return;

    const reset = headers.get("x-ratelimit-reset");
    if (reset === null) return;
    const resetSec = parseInt(reset, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    const waitSec = resetSec - nowSec;

    if (waitSec > 60) {
      throw new GitHubApiError(
        `Rate limit exhausted; reset in ${waitSec}s (exceeds 60s threshold)`,
        403,
        0,
        resetSec,
      );
    }

    if (waitSec > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitSec * 1000));
    }
  }
```

In `rawGet`, after the `if (!resp.ok)` block (after the error throw), before `return`, add:

```typescript
      await this.waitForRateLimit(resp.headers);
```

So the end of `rawGet` becomes:

```typescript
      if (!resp.ok) {
        const remaining = resp.headers.get("x-ratelimit-remaining");
        const reset = resp.headers.get("x-ratelimit-reset");
        throw new GitHubApiError(
          `GitHub API error: HTTP ${resp.status} for ${url}`,
          resp.status,
          remaining !== null ? parseInt(remaining, 10) : undefined,
          reset !== null ? parseInt(reset, 10) : undefined,
        );
      }
      await this.waitForRateLimit(resp.headers);
      return { body, headers: resp.headers, status: resp.status };
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run packages/adapters/github/src/github-api-client.test.ts -t "rate limit" 2>&1 | Select-Object -Last 20
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-adapter): implement rate limit handling with 60s threshold"
```

---

## Task 6: Implement error handling tests (401/403/404/500)

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Produces: test coverage for HTTP error responses

- [ ] **Step 1: Write error handling tests**

Append to `packages/adapters/github/src/github-api-client.test.ts`:

```typescript
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
    const err = await client.fetchIssues("owner", "repo").catch((e) => e as GitHubApiError);
    expect(err).toBeInstanceOf(GitHubApiError);
    expect(err.rateLimitRemaining).toBe(0);
    expect(err.rateLimitReset).toBe(1690000000);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run:

```bash
npx vitest run packages/adapters/github/src/github-api-client.test.ts -t "error handling" 2>&1 | Select-Object -Last 20
```

Expected: 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/github/src/github-api-client.test.ts
git commit -m "test(github-adapter): HTTP error handling (401/403/404/500) with rate limit info"
```

---

## Task 7: Implement syncFromApi on GitHubRuntimeAdapter

**Files:**
- Modify: `packages/adapters/github/src/github-adapter.ts`
- Modify: `packages/adapters/github/src/index.ts`
- Create: `packages/adapters/github/src/sync-from-api.test.ts`

**Interfaces:**
- Consumes: `GitHubApiClient` from Task 2-6, `syncFromFixtures` from existing `github-adapter.ts`
- Produces: `GitHubRuntimeAdapter.syncFromApi(client, owner, repo)` method, exported `GitHubApiClient` from index

- [ ] **Step 1: Write failing test for syncFromApi**

Create `packages/adapters/github/src/sync-from-api.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run packages/adapters/github/src/sync-from-api.test.ts 2>&1 | Select-Object -Last 20
```

Expected: FAIL — `adapter.syncFromApi is not a function`.

- [ ] **Step 3: Implement syncFromApi on GitHubRuntimeAdapter**

In `packages/adapters/github/src/github-adapter.ts`:

Add import at the top (after existing imports, before the `const DEFAULT_RUNTIME_ID` line):

```typescript
import type { GitHubApiClient } from "./github-api-client.js";
```

Add this method to the `GitHubRuntimeAdapter` class (after `syncFromFixtures`, before `getGitHubEvidence`):

```typescript
  /**
   * 从真实 GitHub API 拉取并投影。
   * 委托给 GitHubApiClient 获取 fixtures，再调用 syncFromFixtures。
   * adapter 不持有 client，不读环境变量。
   */
  async syncFromApi(client: GitHubApiClient, owner: string, repo: string): Promise<void> {
    const [issues, pulls] = await Promise.all([
      client.fetchIssues(owner, repo),
      client.fetchPRs(owner, repo),
    ]);
    this.syncFromFixtures({ repo: { owner, name: repo }, issues, pulls });
  }
```

- [ ] **Step 4: Export GitHubApiClient from index.ts**

In `packages/adapters/github/src/index.ts`, add after the existing exports:

```typescript
export { GitHubApiClient, GitHubApiError } from "./github-api-client.js";
export type { GitHubApiClientOptions } from "./github-api-client.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npx vitest run packages/adapters/github/src/sync-from-api.test.ts 2>&1 | Select-Object -Last 20
```

Expected: 1 test PASS.

- [ ] **Step 6: Run all existing tests to verify no regression**

Run:

```bash
npm test 2>&1 | Select-Object -Last 15
```

Expected: all tests pass (existing 737 + new ~12 = ~749).

- [ ] **Step 7: Commit**

```bash
git add packages/adapters/github/src/github-adapter.ts packages/adapters/github/src/index.ts packages/adapters/github/src/sync-from-api.test.ts
git commit -m "feat(github-adapter): implement syncFromApi for real GitHub API projection"
```

---

## Task 8: Export GitHubApiClient and verify build

**Files:**
- Modify: `packages/adapters/github/src/index.ts` (already done in Task 7 Step 4, verify)
- Verify: `npm run build` compiles the package

**Interfaces:**
- Produces: `GitHubApiClient`, `GitHubApiError`, `GitHubApiClientOptions` exported from package index

- [ ] **Step 1: Verify exports are in index.ts**

Read `packages/adapters/github/src/index.ts` and confirm it contains:

```typescript
export { GitHubApiClient, GitHubApiError } from "./github-api-client.js";
export type { GitHubApiClientOptions } from "./github-api-client.js";
```

If not present (e.g., Task 7 Step 4 was skipped), add them now.

- [ ] **Step 2: Run full build**

Run:

```bash
npm run build 2>&1 | Select-Object -Last 15
```

Expected: `tsc -b` succeeds, `dist/` artifacts generated including `packages/adapters/github/dist/src/github-api-client.js`.

- [ ] **Step 3: Verify github-api-client.js was emitted**

Run:

```bash
Test-Path packages/adapters/github/dist/src/github-api-client.js
```

Expected: `True`.

- [ ] **Step 4: Commit if any changes**

```bash
git add -A
git status
```

If there are changes to commit:

```bash
git commit -m "build(github-adapter): verify GitHubApiClient exports and tsc -b compilation"
```

If no changes, skip.

---

## Task 9: Update documentation

**Files:**
- Modify: `docs/integrations/github-adapter/README.md`
- Modify: `docs/integrations/github-adapter/v0-limitations.md`
- Create: `docs/integrations/github-adapter/api-client.md`

- [ ] **Step 1: Add API mode usage to README.md**

In `docs/integrations/github-adapter/README.md`, add a new section after the existing "使用示例" section:

```markdown
## API 模式（Phase 2.2）

除了 fixture 模式，`GitHubRuntimeAdapter` 支持直接从 GitHub REST API 拉取数据：

```typescript
import { GitHubRuntimeAdapter, GitHubApiClient } from "@agent-office/adapter-github";

const client = new GitHubApiClient({
  token: process.env.GITHUB_TOKEN!,  // 必填，从环境变量读
});
const adapter = new GitHubRuntimeAdapter();
await adapter.connect();
await adapter.syncFromApi(client, "Leonardo0402", "AI-STARDEW-VALLEY");

const snapshot = await adapter.getSnapshot();
```

`GitHubApiClient` 负责：
- Bearer token 鉴权
- 分页（Link header，per_page=100）
- rate limit 感知（剩余为 0 时等待，超过 60s 抛错）
- N+1 comments / reviews 拉取
- raw GitHub JSON → fixture 类型映射

详见 [api-client.md](./api-client.md)。
```

- [ ] **Step 2: Update v0-limitations.md with API mode notes**

In `docs/integrations/github-adapter/v0-limitations.md`, add a new section at the end:

```markdown
## API 模式限制（Phase 2.2）

API 模式（`syncFromApi`）仍受 v0 只读约束：
- `execute()` 对所有命令返回 `rejected`（与 fixture 模式一致）
- 不实现 merge / close / approve 等写操作
- rate limit 耗尽且 reset 超过 60 秒时抛 `GitHubApiError`（不无限等待）
- HTTP 5xx 错误直接抛错（v0 不重试）
- N+1 拉取：每个 issue 拉 comments，每个 PR 拉 reviews + comments（5000 req/hour 足够中小 repo）
- 不支持 webhook 事件流或 SSE 实时推送（留给 Phase 2.3）
```

- [ ] **Step 3: Create api-client.md**

Create `docs/integrations/github-adapter/api-client.md`:

```markdown
# GitHubApiClient 使用指南

`GitHubApiClient` 是 GitHub REST API 的只读客户端，将 raw API JSON 转换为 `GitHubIssueFixture` / `GitHubPRFixture` 类型供 `GitHubRuntimeAdapter` 使用。

## 构造

```typescript
import { GitHubApiClient } from "@agent-office/adapter-github";

const client = new GitHubApiClient({
  token: process.env.GITHUB_TOKEN,  // 必填，空字符串用于测试
  baseUrl: "https://api.github.com", // 可选，默认值
  userAgent: "agent-office-github-adapter", // 可选
  timeoutMs: 30000, // 可选
});
```

## 鉴权

- `token` 非空时，每个请求附加 `Authorization: Bearer {token}` header
- `token` 为空字符串时，不附加 `Authorization` header（用于 msw 测试）
- 生产环境从 `process.env.GITHUB_TOKEN` 读取

## 分页

- 使用 `per_page=100` 减少调用次数
- 解析 `Link` response header 中的 `rel="next"` URL
- 循环拉取直到无 `next`，返回完整数组

## Rate Limit

每次请求后检查 `X-RateLimit-Remaining` header：
- `> 0`：继续
- `= 0`：计算 `X-RateLimit-Reset - now`
  - `≤ 60 秒`：`setTimeout` 等待后继续
  - `> 60 秒`：抛 `GitHubApiError`（避免无限等待）

## 错误处理

| HTTP 状态 | 行为 |
|---|---|
| 200 | 正常返回 |
| 401 / 403 | 抛 `GitHubApiError`（鉴权失败或 rate limit） |
| 404 | 抛 `GitHubApiError`（repo 不存在或无权限） |
| 429 | 抛 `GitHubApiError`（secondary rate limit） |
| 5xx | 抛 `GitHubApiError`（服务器错误，v0 不重试） |

`GitHubApiError` 包含 `status`、`rateLimitRemaining`、`rateLimitReset` 字段，便于上层处理。

## API 端点

| 方法 | 端点 |
|---|---|
| `fetchIssues(owner, repo)` | `GET /repos/{owner}/{repo}/issues?state=all&per_page=100` |
| `fetchPRs(owner, repo)` | `GET /repos/{owner}/{repo}/pulls?state=all&per_page=100` |
| (内部) comments | `GET /repos/{owner}/{repo}/issues/{n}/comments` |
| (内部) reviews | `GET /repos/{owner}/{repo}/pulls/{n}/reviews` |

`fetchIssues` 自动过滤 issues endpoint 返回的 PR（有 `pull_request` 字段的条目）。
```

- [ ] **Step 4: Commit**

```bash
git add docs/integrations/github-adapter/README.md docs/integrations/github-adapter/v0-limitations.md docs/integrations/github-adapter/api-client.md
git commit -m "docs(github-adapter): add API client documentation for Issue #39"
```

---

## Task 10: Final verification and CI

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test 2>&1 | Select-Object -Last 15
```

Expected: all tests pass, test count > 737 (existing) + new API client tests.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build 2>&1 | Select-Object -Last 10
```

Expected: `tsc -b` succeeds, no errors.

- [ ] **Step 3: Push branch**

```bash
git push origin feat/github-real-api-source-issue-39
```

If the branch doesn't exist yet:

```bash
git checkout -b feat/github-real-api-source-issue-39
git push -u origin feat/github-real-api-source-issue-39
```

- [ ] **Step 4: Create PR**

```bash
gh pr create --title "feat(github-adapter): Real GitHub Read Source (Issue #39)" --body "Closes #39" --base main --head feat/github-real-api-source-issue-39
```

- [ ] **Step 5: Wait for CI and verify green**

Run:

```bash
gh run list --branch feat/github-real-api-source-issue-39 --limit 1
```

Expected: latest run status is `completed` with conclusion `success`.

- [ ] **Step 6: Final commit if any cleanup needed**

If CI found issues, fix and re-push. Otherwise, no commit needed.

---

## Acceptance Criteria Mapping

| Issue #39 AC | Task |
|---|---|
| 支持 GITHUB_TOKEN 鉴权 | Task 2 (buildHeaders) |
| 能拉取真实 repo 的 issues 和 PRs | Task 3 (fetchIssues) + Task 4 (fetchPRs) |
| 分页正确处理（100+ issues） | Task 3 (paginate + Link header test) |
| rate limit 接近时能等待或报错 | Task 5 (waitForRateLimit) |
| 测试可用 mock server 或 fixture fallback 运行 | Task 2-7 (msw) + existing fixture tests unchanged |
| projection 结果与 fixture 模式一致 | Task 7 (syncFromApi delegates to syncFromFixtures) |
| CI 通过 | Task 10 |
| 文档更新 | Task 9 |
