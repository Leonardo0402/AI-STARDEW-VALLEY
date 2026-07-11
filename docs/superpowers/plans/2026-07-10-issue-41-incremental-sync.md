# Phase 2.3: Incremental Sync Reliability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade GitHubRuntimeAdapter from full-sync-only to incremental sync — only fetch changed entities, only emit state-transition events, with a polling daemon that auto-resyncs on failure.

**Architecture:** Three layers: (1) `GitHubApiClient` gains `fetchIssuesSince`/`fetchPRsSince` using GitHub's `since` param (issues) or `sort=updated&direction=desc` + early-stop (PRs); (2) `GitHubRuntimeAdapter` gains `syncIncremental` with entity-level delta emit — keeps eventLog intact, only emits events for new entities or state transitions; (3) new `GitHubSyncScheduler` class drives polling with configurable interval and failure→resync.

**Tech Stack:** TypeScript ES2022, vitest, msw (Mock Service Worker), native fetch, npm workspaces.

## Global Constraints

- Zero new runtime dependencies except msw (devDependency only). Use native fetch, no octokit.
- projection logic must not change — `syncIncremental` delegates to `processIssue`/`processPR` for new entities; delta emit uses the same `emit()` method.
- `GitHubApiClient` is independent — does not import `GitHubRuntimeAdapter`.
- token is required (`string`), but empty string is allowed for msw tests (no `Authorization` header sent).
- comments/reviews are private methods on `GitHubApiClient` — only `fetchIssues`/`fetchPRs`/`fetchIssuesSince`/`fetchPRsSince` are public.
- pagination returns complete arrays (all pages consumed or early-stopped), not iterators.
- fixture assembly order: issues before PRs, matching `syncFromFixtures`.
- `syncFromFixtures` already sorts by number ascending — `syncIncremental` must NOT re-sort globally (sort per-entity-type only, matching existing pattern).
- Existing tests must stay green — do not modify projection/determinism/label-mapping/destructive-guard/sync-from-api tests.
- Test command: `npm test`; Build command: `npm run build` (runs `tsc -b`)
- File naming: kebab-case for files, PascalCase for classes.
- Existing fixture types are in `packages/adapters/github/src/types.ts` — reuse `GitHubIssueFixture`, `GitHubPRFixture`, `GitHubComment`, `GitHubReview`, `GitHubLabel`, `GitHubUser`.
- Cursor is in-memory only (no persistence); `lastUpdatedAt` is a string (ISO8601), empty string = first sync.
- No ETag / 304 handling (v0 exclusion).
- No `task.reopened` EventType (protocol doesn't have it; reopened issues update evidence only, no event emitted).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/adapters/github/src/types.ts` | Modify | Add optional `updatedAt` to `GitHubIssueFixture` + `GitHubPRFixture` |
| `packages/adapters/github/src/github-api-client.ts` | Modify | Add `fetchIssuesSince` + `fetchPRsSince` + `updated_at` to raw types + mapping |
| `packages/adapters/github/src/github-api-client.test.ts` | Modify | Add `fetchSince` tests |
| `packages/adapters/github/src/github-adapter.ts` | Modify | Add `lastUpdatedAt` cursor + `syncIncremental` + delta emit + `getCursor`/`resetCursor` |
| `packages/adapters/github/src/sync-incremental.test.ts` | Create | Adapter delta emit tests (msw) |
| `packages/adapters/github/src/github-sync-scheduler.ts` | Create | New scheduler class |
| `packages/adapters/github/src/github-sync-scheduler.test.ts` | Create | Scheduler tests (fake timers) |
| `packages/adapters/github/src/index.ts` | Modify | Export `GitHubSyncScheduler` + types |
| `docs/integrations/github-adapter/README.md` | Modify | Add incremental sync usage |
| `docs/integrations/github-adapter/v0-limitations.md` | Modify | Add Phase 2.3 limitations |
| `docs/integrations/github-adapter/api-client.md` | Modify | Document `fetchSince` methods |

---

## Task 1: Add `updatedAt` to fixture types + raw types + mapping

**Files:**
- Modify: `packages/adapters/github/src/types.ts` (add `updatedAt?: string` to `GitHubIssueFixture` + `GitHubPRFixture`)
- Modify: `packages/adapters/github/src/github-api-client.ts` (add `updated_at` to `RawIssue` + `RawPR`, map in `mapIssue` + `mapPR`)
- Test: `npm run build` (type-check only — additive field, no new test needed)

**Interfaces:**
- Produces: `GitHubIssueFixture.updatedAt?: string`, `GitHubPRFixture.updatedAt?: string` — optional so existing fixtures don't break

- [ ] **Step 1: Add `updatedAt` to fixture types**

In `packages/adapters/github/src/types.ts`, add `updatedAt?: string;` to both `GitHubIssueFixture` and `GitHubPRFixture`:

```typescript
export interface GitHubIssueFixture {
  number: number;
  url: string;
  title: string;
  body: string;
  state: "open" | "closed";
  stateReason?: "completed" | "not_planned" | "reopened";
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  createdAt: string;
  updatedAt?: string;
  closedAt: string | null;
  comments: GitHubComment[];
}

export interface GitHubPRFixture {
  number: number;
  url: string;
  title: string;
  body: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: GitHubUser | null;
  mergeCommitSha: string | null;
  headRef: string;
  baseRef: string;
  labels: GitHubLabel[];
  requestedReviewers: GitHubUser[];
  reviews: GitHubReview[];
  comments: GitHubComment[];
  createdAt: string;
  updatedAt?: string;
  closedAt: string | null;
}
```

- [ ] **Step 2: Add `updated_at` to raw types**

In `packages/adapters/github/src/github-api-client.ts`, add `updated_at: string;` to `RawIssue` and `RawPR`:

```typescript
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
  updated_at: string;
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
  updated_at: string;
  closed_at: string | null;
}
```

- [ ] **Step 3: Map `updatedAt` in `mapIssue` and `mapPR`**

In `github-api-client.ts`, add `updatedAt: j.updated_at,` to both `mapIssue` and `mapPR` return objects:

```typescript
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
      updatedAt: j.updated_at,
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
      updatedAt: j.updated_at,
      closedAt: j.closed_at,
    };
  }
```

- [ ] **Step 4: Verify build + existing tests pass**

Run: `npm run build`
Expected: exit 0 (additive optional field, no breaking change)

Run: `npm test`
Expected: 748/748 pass (no regressions)

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/github/src/types.ts packages/adapters/github/src/github-api-client.ts
git commit -m "feat(github-adapter): add updatedAt to fixture types and API mapping"
```

---

## Task 2: `fetchIssuesSince` — API client incremental fetch for issues

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts` (add `fetchIssuesSince` method)
- Modify: `packages/adapters/github/src/github-api-client.test.ts` (add tests)
- Test: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Produces: `GitHubApiClient.fetchIssuesSince(owner: string, repo: string, since: string): Promise<GitHubIssueFixture[]>`

- [ ] **Step 1: Write the failing tests**

Append to `github-api-client.test.ts` (after the last `describe` block, before EOF):

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: FAIL — `client.fetchIssuesSince is not a function`

- [ ] **Step 3: Implement `fetchIssuesSince`**

In `github-api-client.ts`, add this method after the existing `fetchIssues` method (before `fetchPRs`):

```typescript
  async fetchIssuesSince(owner: string, repo: string, since: string): Promise<GitHubIssueFixture[]> {
    if (!since) return this.fetchIssues(owner, repo);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues?state=all&per_page=100&since=${encodeURIComponent(since)}`;
    const pages = await this.paginate<unknown>(url);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: PASS (all tests including new ones)

- [ ] **Step 5: Run full suite to verify no regression**

Run: `npm test`
Expected: 750/750 pass (748 existing + 2 new)

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-adapter): implement fetchIssuesSince for incremental issue fetch"
```

---

## Task 3: `fetchPRsSince` — API client incremental fetch for PRs with early-stop

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts` (add `fetchPRsSince` method)
- Modify: `packages/adapters/github/src/github-api-client.test.ts` (add tests)
- Test: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Produces: `GitHubApiClient.fetchPRsSince(owner: string, repo: string, since: string): Promise<GitHubPRFixture[]>`
- Consumes: `RawPR.updated_at` (added in Task 1)

- [ ] **Step 1: Write the failing tests**

Append to `github-api-client.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: FAIL — `client.fetchPRsSince is not a function`

- [ ] **Step 3: Implement `fetchPRsSince`**

In `github-api-client.ts`, add this method after the existing `fetchPRs` method (before the private methods section):

```typescript
  async fetchPRsSince(owner: string, repo: string, since: string): Promise<GitHubPRFixture[]> {
    if (!since) return this.fetchPRs(owner, repo);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`;
    const prs: GitHubPRFixture[] = [];
    let currentUrl: string | undefined = url;

    while (currentUrl) {
      const result = await this.rawGet(currentUrl);
      const items = result.body as RawPR[];
      if (!Array.isArray(items)) break;

      for (const json of items) {
        if (json.updated_at <= since) {
          return prs;
        }
        const pr = this.mapPR(json);
        pr.reviews = await this.fetchReviews(owner, repo, pr.number);
        pr.comments = await this.fetchComments(owner, repo, pr.number);
        prs.push(pr);
      }

      const link = result.headers.get("link");
      currentUrl = this.parseLinkHeader(link).next;
    }
    return prs;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: PASS (all tests including new ones)

- [ ] **Step 5: Run full suite to verify no regression**

Run: `npm test`
Expected: 752/752 pass (750 + 2 new)

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-adapter): implement fetchPRsSince with early-stop pagination"
```

---

## Task 4: Adapter cursor + `syncIncremental` first-sync fallback

**Files:**
- Modify: `packages/adapters/github/src/github-adapter.ts` (add `lastUpdatedAt` field + `getCursor`/`resetCursor` + `syncIncremental` skeleton)
- Create: `packages/adapters/github/src/sync-incremental.test.ts`
- Test: `npx vitest run packages/adapters/github/src/sync-incremental.test.ts`

**Interfaces:**
- Produces: `GitHubRuntimeAdapter.syncIncremental(client, owner, repo): Promise<void>`, `getCursor(): string`, `resetCursor(): void`
- Consumes: `GitHubApiClient.fetchIssuesSince`, `GitHubApiClient.fetchPRsSince` (from Tasks 2-3)

- [ ] **Step 1: Write the failing test**

Create `packages/adapters/github/src/sync-incremental.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/github/src/sync-incremental.test.ts`
Expected: FAIL — `adapter.syncIncremental is not a function` or `adapter.getCursor is not a function`

- [ ] **Step 3: Implement cursor + `syncIncremental` skeleton**

In `github-adapter.ts`:

3a. Add `lastUpdatedAt` private field (after `private lastReplayErrors` line):

```typescript
  private lastUpdatedAt: string = "";
```

3b. Add `getCursor` / `resetCursor` public methods (after `getEventLog` method, before the internal section):

```typescript
  getCursor(): string {
    return this.lastUpdatedAt;
  }

  resetCursor(): void {
    this.lastUpdatedAt = "";
  }
```

3c. Add `syncIncremental` method (after `syncFromApi`, before `getGitHubEvidence`):

```typescript
  /**
   * 增量同步：只拉取变更的 entities，只 emit 状态转换事件。
   * 首次调用（空 cursor）→ fallback 到 syncFromApi 全量同步。
   * 不清空 eventLog / evidence。
   */
  async syncIncremental(client: GitHubApiClient, owner: string, repo: string): Promise<void> {
    if (this.lastUpdatedAt === "") {
      await this.syncFromApi(client, owner, repo);
      this.lastUpdatedAt = this.deriveCursorFromEventLog();
      return;
    }

    const [issues, pulls] = await Promise.all([
      client.fetchIssuesSince(owner, repo, this.lastUpdatedAt),
      client.fetchPRsSince(owner, repo, this.lastUpdatedAt),
    ]);

    // Process issue deltas (sorted by number ascending, matching syncFromFixtures)
    for (const issue of issues.sort((a, b) => a.number - b.number)) {
      const taskId: Id = `gh-issue-${issue.number}`;
      const existing = this.evidence.tasks[taskId];
      if (!existing) {
        this.processIssue(issue);
      } else {
        this.emitIssueDelta(existing, issue);
      }
    }

    // Process PR deltas
    for (const pr of pulls.sort((a, b) => a.number - b.number)) {
      const taskId: Id = `gh-pr-task-${pr.number}`;
      const existing = this.evidence.tasks[taskId];
      if (!existing) {
        this.processPR(pr);
      } else {
        this.emitPRDelta(existing, pr);
      }
    }

    // Update cursor
    this.updateCursor(issues, pulls);
  }

  private deriveCursorFromEventLog(): string {
    if (this.eventLog.length === 0) return "";
    return this.eventLog
      .map((e) => e.occurredAt)
      .sort()
      .pop()!;
  }

  private updateCursor(issues: GitHubIssueFixture[], pulls: GitHubPRFixture[]): void {
    const allTimestamps = [
      ...issues.map((i) => i.updatedAt ?? i.createdAt),
      ...pulls.map((p) => p.updatedAt ?? p.createdAt),
    ];
    if (allTimestamps.length > 0) {
      const max = allTimestamps.sort().pop()!;
      if (max > this.lastUpdatedAt) {
        this.lastUpdatedAt = max;
      }
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/adapters/github/src/sync-incremental.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Run full suite + build**

Run: `npm test`
Expected: 753/753 pass (752 + 1 new)

Run: `npm run build`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/github/src/github-adapter.ts packages/adapters/github/src/sync-incremental.test.ts
git commit -m "feat(github-adapter): add syncIncremental skeleton with first-sync fallback"
```

---

## Task 5: Delta emit — new entities + unchanged entities + evidence update

**Files:**
- Modify: `packages/adapters/github/src/github-adapter.ts` (add `emitIssueDelta` + `emitPRDelta` stubs)
- Modify: `packages/adapters/github/src/sync-incremental.test.ts` (add tests)
- Test: `npx vitest run packages/adapters/github/src/sync-incremental.test.ts`

**Interfaces:**
- Produces: `emitIssueDelta(oldRef, newFixture)` + `emitPRDelta(oldRef, newFixture)` private methods

- [ ] **Step 1: Write the failing tests**

Append to `sync-incremental.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/github/src/sync-incremental.test.ts`
Expected: FAIL — `this.emitIssueDelta is not a function`

- [ ] **Step 3: Implement `emitIssueDelta` + `emitPRDelta` stubs**

In `github-adapter.ts`, add these private methods (before the `emit` method, in the internal section):

```typescript
  // ─── 内部：Delta Emit ─────────────────────────────────────

  private emitIssueDelta(oldRef: GitHubSourceRef, newFixture: GitHubIssueFixture): void {
    const taskId: Id = `gh-issue-${newFixture.number}`;

    // Update evidence
    this.evidence.tasks[taskId] = this.buildIssueEvidence(newFixture);

    // State transition: open → closed
    if (oldRef.rawState === "open" && newFixture.state === "closed") {
      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "issue", newFixture.number, newFixture.closedAt ?? newFixture.createdAt);
    }
    // closed → reopened: no event (v0 limitation — no TASK_REOPENED EventType)
    // unchanged: no event
  }

  private emitPRDelta(oldRef: GitHubSourceRef, newFixture: GitHubPRFixture): void {
    const taskId: Id = `gh-pr-task-${newFixture.number}`;
    const artifactId: Id = `gh-pr-${newFixture.number}`;

    // Update evidence
    this.evidence.tasks[taskId] = this.buildPREvidence(newFixture);
    this.evidence.artifacts[artifactId] = this.buildPREvidence(newFixture);

    const oldWasOpen = oldRef.rawState === "open";
    const newIsMerged = newFixture.merged;
    const newIsClosedUnmerged = newFixture.state === "closed" && !newFixture.merged;

    if (oldWasOpen && newIsMerged) {
      // open → merged
      this.emit(EventType.ARTIFACT_DELIVERED, {
        artifactId,
        mergeCommitSha: newFixture.mergeCommitSha,
        mergedBy: newFixture.mergedBy?.login ?? "unknown",
      }, "pr", newFixture.number, newFixture.mergedAt ?? newFixture.closedAt ?? newFixture.createdAt);

      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "pr", newFixture.number, newFixture.mergedAt ?? newFixture.closedAt ?? newFixture.createdAt);
    } else if (oldWasOpen && newIsClosedUnmerged) {
      // open → closed-unmerged
      this.emit(EventType.ARTIFACT_CLOSED, {
        artifactId,
        closedBy: null,
        reason: "closed-unmerged",
      }, "pr", newFixture.number, newFixture.closedAt ?? newFixture.createdAt);

      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "pr", newFixture.number, newFixture.closedAt ?? newFixture.createdAt);
    }
    // unchanged: no event
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/adapters/github/src/sync-incremental.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run full suite + build**

Run: `npm test`
Expected: 754/754 pass

Run: `npm run build`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/github/src/github-adapter.ts packages/adapters/github/src/sync-incremental.test.ts
git commit -m "feat(github-adapter): implement delta emit for new and unchanged entities"
```

---

## Task 6: Delta emit — state transitions (issue open→closed + PR open→merged + PR open→closed-unmerged)

**Files:**
- Modify: `packages/adapters/github/src/sync-incremental.test.ts` (add state-transition tests)
- Test: `npx vitest run packages/adapters/github/src/sync-incremental.test.ts`

**Note:** The `emitIssueDelta` and `emitPRDelta` methods were implemented in Task 5. This task only adds tests to verify the state-transition branches work correctly.

- [ ] **Step 1: Write the failing tests**

Append to `sync-incremental.test.ts`:

```typescript
describe("GitHubRuntimeAdapter.syncIncremental — issue state transition", () => {
  it("emits only task.completed when issue transitions open→closed", async () => {
    let callCount = 0;
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", ({ request }) => {
        callCount++;
        const since = new URL(request.url).searchParams.get("since");
        if (!since) {
          // First sync: issue open
          return HttpResponse.json([
            {
              number: 10,
              html_url: "https://github.com/owner/repo/issues/10",
              title: "Issue",
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
        // Incremental: issue now closed
        return HttpResponse.json([
          {
            number: 10,
            html_url: "https://github.com/owner/repo/issues/10",
            title: "Issue",
            body: "",
            state: "closed",
            state_reason: "completed",
            labels: [],
            assignees: [],
            created_at: "2026-01-02T08:00:00Z",
            updated_at: "2026-01-07T08:00:00Z",
            closed_at: "2026-01-07T08:00:00Z",
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/issues/10/comments", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/pulls", () => HttpResponse.json([])),
    );

    const client = new GitHubApiClient({ token: "" });
    const adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
    await adapter.syncIncremental(client, "owner", "repo");

    const eventsBefore = adapter.getEventLog().length;
    await adapter.syncIncremental(client, "owner", "repo");
    const eventsAfter = adapter.getEventLog().length;

    // Only task.completed emitted (no re-emit of task.created)
    expect(eventsAfter - eventsBefore).toBe(1);
    const lastEvent = adapter.getEventLog()[eventsAfter - 1];
    expect(lastEvent.type).toBe("task.completed");

    const snap = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    expect(adapter.getCursor()).toBe("2026-01-07T08:00:00Z");
  });
});

describe("GitHubRuntimeAdapter.syncIncremental — PR state transitions", () => {
  it("emits artifact.delivered + task.completed when PR transitions open→merged", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/pulls", ({ request }) => {
        const since = new URL(request.url).searchParams.get("since");
        const sort = new URL(request.url).searchParams.get("sort");
        if (!since || !sort) {
          // First sync: PR open
          return HttpResponse.json([
            {
              number: 20,
              html_url: "https://github.com/owner/repo/pull/20",
              title: "PR",
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
              created_at: "2026-01-03T08:00:00Z",
              updated_at: "2026-01-03T08:00:00Z",
              closed_at: null,
            },
          ]);
        }
        // Incremental: PR now merged
        return HttpResponse.json([
          {
            number: 20,
            html_url: "https://github.com/owner/repo/pull/20",
            title: "PR",
            body: "",
            state: "closed",
            draft: false,
            merged: true,
            merged_at: "2026-01-08T12:00:00Z",
            merged_by: { login: "octocat" },
            merge_commit_sha: "abc123",
            head: { ref: "feature/a" },
            base: { ref: "main" },
            labels: [],
            requested_reviewers: [],
            created_at: "2026-01-03T08:00:00Z",
            updated_at: "2026-01-08T12:00:00Z",
            closed_at: "2026-01-08T12:00:00Z",
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/pulls/20/reviews", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/issues/20/comments", () => HttpResponse.json([])),
    );

    const client = new GitHubApiClient({ token: "" });
    const adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
    await adapter.syncIncremental(client, "owner", "repo");

    const eventsBefore = adapter.getEventLog().length;
    await adapter.syncIncremental(client, "owner", "repo");
    const eventsAfter = adapter.getEventLog().length;

    // artifact.delivered + task.completed
    expect(eventsAfter - eventsBefore).toBe(2);
    const newEvents = adapter.getEventLog().slice(eventsBefore);
    expect(newEvents[0].type).toBe("artifact.delivered");
    expect(newEvents[1].type).toBe("task.completed");

    expect(adapter.getLastReplayErrors()).toHaveLength(0);
  });

  it("emits artifact.closed + task.completed when PR transitions open→closed-unmerged", async () => {
    server.use(
      http.get("https://api.github.com/repos/owner/repo/issues", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/pulls", ({ request }) => {
        const since = new URL(request.url).searchParams.get("since");
        const sort = new URL(request.url).searchParams.get("sort");
        if (!since || !sort) {
          return HttpResponse.json([
            {
              number: 20,
              html_url: "https://github.com/owner/repo/pull/20",
              title: "PR",
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
              created_at: "2026-01-03T08:00:00Z",
              updated_at: "2026-01-03T08:00:00Z",
              closed_at: null,
            },
          ]);
        }
        return HttpResponse.json([
          {
            number: 20,
            html_url: "https://github.com/owner/repo/pull/20",
            title: "PR",
            body: "",
            state: "closed",
            draft: false,
            merged: false,
            merged_at: null,
            merged_by: null,
            merge_commit_sha: null,
            head: { ref: "feature/a" },
            base: { ref: "main" },
            labels: [],
            requested_reviewers: [],
            created_at: "2026-01-03T08:00:00Z",
            updated_at: "2026-01-08T12:00:00Z",
            closed_at: "2026-01-08T12:00:00Z",
          },
        ]);
      }),
      http.get("https://api.github.com/repos/owner/repo/pulls/20/reviews", () => HttpResponse.json([])),
      http.get("https://api.github.com/repos/owner/repo/issues/20/comments", () => HttpResponse.json([])),
    );

    const client = new GitHubApiClient({ token: "" });
    const adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
    await adapter.syncIncremental(client, "owner", "repo");

    const eventsBefore = adapter.getEventLog().length;
    await adapter.syncIncremental(client, "owner", "repo");
    const eventsAfter = adapter.getEventLog().length;

    // artifact.closed + task.completed
    expect(eventsAfter - eventsBefore).toBe(2);
    const newEvents = adapter.getEventLog().slice(eventsBefore);
    expect(newEvents[0].type).toBe("artifact.closed");
    expect(newEvents[1].type).toBe("task.completed");

    expect(adapter.getLastReplayErrors()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/sync-incremental.test.ts`
Expected: PASS (5 tests — 2 from Task 4-5 + 3 new)

**Note:** These tests should pass immediately because `emitIssueDelta`/`emitPRDelta` were fully implemented in Task 5. If any test fails, the delta logic needs fixing.

- [ ] **Step 3: Run full suite + build**

Run: `npm test`
Expected: 757/757 pass

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add packages/adapters/github/src/sync-incremental.test.ts
git commit -m "test(github-adapter): verify delta emit for issue and PR state transitions"
```

---

## Task 7: `GitHubSyncScheduler` class — start/stop/syncOnce

**Files:**
- Create: `packages/adapters/github/src/github-sync-scheduler.ts`
- Create: `packages/adapters/github/src/github-sync-scheduler.test.ts`
- Test: `npx vitest run packages/adapters/github/src/github-sync-scheduler.test.ts`

**Interfaces:**
- Produces: `GitHubSyncScheduler` class, `GitHubSyncSchedulerOptions`, `GitHubSyncSchedulerCallbacks`
- Consumes: `GitHubRuntimeAdapter.syncIncremental` / `syncFromApi` / `getCursor` / `resetCursor` (from Task 4), `GitHubApiClient` (from Phase 2.2)

- [ ] **Step 1: Write the failing tests**

Create `packages/adapters/github/src/github-sync-scheduler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubSyncScheduler } from "./github-sync-scheduler.js";
import { GitHubRuntimeAdapter } from "./github-adapter.js";
import { GitHubApiClient } from "./github-api-client.js";

describe("GitHubSyncScheduler", () => {
  let adapter: GitHubRuntimeAdapter;
  let client: GitHubApiClient;

  beforeEach(() => {
    adapter = new GitHubRuntimeAdapter();
    client = new GitHubApiClient({ token: "" });
    vi.useFakeTimers();
  });

  it("start triggers immediate syncOnce and schedules interval", async () => {
    const syncIncrementalSpy = vi.spyOn(adapter, "syncIncremental").mockResolvedValue(undefined);

    const scheduler = new GitHubSyncScheduler(adapter, client, {
      owner: "owner",
      repo: "repo",
      intervalMs: 60000,
    });

    scheduler.start();

    // Immediate syncOnce was called
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    // Advance 60s → second sync
    await vi.advanceTimersByTimeAsync(60000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it("stop clears interval and prevents further syncs", async () => {
    const syncIncrementalSpy = vi.spyOn(adapter, "syncIncremental").mockResolvedValue(undefined);

    const scheduler = new GitHubSyncScheduler(adapter, client, {
      owner: "owner",
      repo: "repo",
      intervalMs: 60000,
    });

    scheduler.start();
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    scheduler.stop();

    await vi.advanceTimersByTimeAsync(120000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1); // no additional syncs
  });

  it("default intervalMs is 60000", async () => {
    const syncIncrementalSpy = vi.spyOn(adapter, "syncIncremental").mockResolvedValue(undefined);

    const scheduler = new GitHubSyncScheduler(adapter, client, {
      owner: "owner",
      repo: "repo",
      // no intervalMs — should default to 60000
    });

    scheduler.start();
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    // 59s → no second sync yet
    await vi.advanceTimersByTimeAsync(59000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    // 1 more second → second sync
    await vi.advanceTimersByTimeAsync(1000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it("onSyncSuccess callback is called with cursor timestamp", async () => {
    vi.spyOn(adapter, "syncIncremental").mockImplementation(async () => {
      // Simulate cursor being set
      (adapter as unknown as { lastUpdatedAt: string }).lastUpdatedAt = "2026-01-10T08:00:00Z";
    });
    vi.spyOn(adapter, "getCursor").mockReturnValue("2026-01-10T08:00:00Z");

    let capturedTimestamp = "";
    const scheduler = new GitHubSyncScheduler(
      adapter,
      client,
      { owner: "owner", repo: "repo" },
      { onSyncSuccess: (ts) => { capturedTimestamp = ts; } },
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedTimestamp).toBe("2026-01-10T08:00:00Z");
    scheduler.stop();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/github/src/github-sync-scheduler.test.ts`
Expected: FAIL — `Cannot find module './github-sync-scheduler.js'`

- [ ] **Step 3: Implement `GitHubSyncScheduler`**

Create `packages/adapters/github/src/github-sync-scheduler.ts`:

```typescript
/**
 * GitHubSyncScheduler — polling daemon for incremental GitHub sync.
 *
 * 职责：
 * - 定时驱动 adapter.syncIncremental
 * - 失败时标记 lastSyncFailed，下次 syncOnce 走全量 resync
 * - 可配置 interval（默认 60s）
 *
 * 不持有 cursor —— cursor 在 adapter 上，scheduler 通过 getCursor/resetCursor 访问。
 */
import type { GitHubRuntimeAdapter } from "./github-adapter.js";
import type { GitHubApiClient } from "./github-api-client.js";

export interface GitHubSyncSchedulerOptions {
  intervalMs?: number;
  owner: string;
  repo: string;
}

export interface GitHubSyncSchedulerCallbacks {
  onSyncSuccess?(timestamp: string): void;
  onSyncFailure?(error: Error, willResync: boolean): void;
  onResync?(): void;
}

export class GitHubSyncScheduler {
  private readonly adapter: GitHubRuntimeAdapter;
  private readonly client: GitHubApiClient;
  private readonly owner: string;
  private readonly repo: string;
  private readonly intervalMs: number;
  private readonly callbacks: GitHubSyncSchedulerCallbacks;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSyncFailed = false;

  constructor(
    adapter: GitHubRuntimeAdapter,
    client: GitHubApiClient,
    options: GitHubSyncSchedulerOptions,
    callbacks: GitHubSyncSchedulerCallbacks = {},
  ) {
    this.adapter = adapter;
    this.client = client;
    this.owner = options.owner;
    this.repo = options.repo;
    this.intervalMs = options.intervalMs ?? 60000;
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.timer !== null) return;
    // Immediate sync, then interval
    this.syncOnce();
    this.timer = setInterval(() => this.syncOnce(), this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  async syncOnce(): Promise<void> {
    if (this.lastSyncFailed) {
      try {
        await this.adapter.syncFromApi(this.client, this.owner, this.repo);
        this.adapter.resetCursor();
        this.lastSyncFailed = false;
        this.callbacks.onResync?.();
      } catch (err) {
        this.lastSyncFailed = true;
        this.callbacks.onSyncFailure?.(err as Error, false);
      }
      return;
    }

    try {
      await this.adapter.syncIncremental(this.client, this.owner, this.repo);
      this.callbacks.onSyncSuccess?.(this.adapter.getCursor());
    } catch (err) {
      this.lastSyncFailed = true;
      this.callbacks.onSyncFailure?.(err as Error, true);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/github-sync-scheduler.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run full suite + build**

Run: `npm test`
Expected: 761/761 pass (757 + 4 new)

Run: `npm run build`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/github/src/github-sync-scheduler.ts packages/adapters/github/src/github-sync-scheduler.test.ts
git commit -m "feat(github-adapter): implement GitHubSyncScheduler with start/stop/syncOnce"
```

---

## Task 8: Scheduler resync on failure

**Files:**
- Modify: `packages/adapters/github/src/github-sync-scheduler.test.ts` (add failure + resync tests)
- Test: `npx vitest run packages/adapters/github/src/github-sync-scheduler.test.ts`

**Note:** The resync logic is already implemented in Task 7's `syncOnce`. This task adds tests to verify the failure→resync flow.

- [ ] **Step 1: Write the failing tests**

Append to `github-sync-scheduler.test.ts`:

```typescript
import { GitHubApiError } from "./github-api-client.js";

describe("GitHubSyncScheduler — resync on failure", () => {
  let adapter: GitHubRuntimeAdapter;
  let client: GitHubApiClient;

  beforeEach(() => {
    adapter = new GitHubRuntimeAdapter();
    client = new GitHubApiClient({ token: "" });
    vi.useFakeTimers();
  });

  it("calls onSyncFailure and sets lastSyncFailed when syncIncremental throws", async () => {
    const error = new GitHubApiError("Network error", 0);
    vi.spyOn(adapter, "syncIncremental").mockRejectedValue(error);

    let capturedError: Error | null = null;
    let capturedWillResync = false;

    const scheduler = new GitHubSyncScheduler(
      adapter,
      client,
      { owner: "owner", repo: "repo" },
      {
        onSyncFailure: (err, willResync) => {
          capturedError = err;
          capturedWillResync = willResync;
        },
      },
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedError).toBe(error);
    expect(capturedWillResync).toBe(true);
    scheduler.stop();
  });

  it("next syncOnce after failure calls syncFromApi (resync) + onResync", async () => {
    const error = new GitHubApiError("Network error", 0);
    const syncIncrementalSpy = vi.spyOn(adapter, "syncIncremental").mockRejectedValueOnce(error);
    const syncFromApiSpy = vi.spyOn(adapter, "syncFromApi").mockResolvedValue(undefined);
    const resetCursorSpy = vi.spyOn(adapter, "resetCursor").mockReturnValue(undefined);

    let resyncCalled = false;

    const scheduler = new GitHubSyncScheduler(
      adapter,
      client,
      { owner: "owner", repo: "repo" },
      { onResync: () => { resyncCalled = true; } },
    );

    // First syncOnce: fails
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    // Second syncOnce: resync
    await vi.advanceTimersByTimeAsync(60000);
    expect(syncFromApiSpy).toHaveBeenCalledTimes(1);
    expect(resetCursorSpy).toHaveBeenCalledTimes(1);
    expect(resyncCalled).toBe(true);

    // Third syncOnce: back to normal incremental
    syncIncrementalSpy.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(60000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it("resync failure keeps lastSyncFailed true and calls onSyncFailure with willResync=false", async () => {
    const error = new GitHubApiError("Network error", 0);
    vi.spyOn(adapter, "syncIncremental").mockRejectedValueOnce(error);
    vi.spyOn(adapter, "syncFromApi").mockRejectedValue(error);

    let capturedWillResync = true;

    const scheduler = new GitHubSyncScheduler(
      adapter,
      client,
      { owner: "owner", repo: "repo" },
      {
        onSyncFailure: (_err, willResync) => {
          capturedWillResync = willResync;
        },
      },
    );

    // First: incremental fails
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(capturedWillResync).toBe(true);

    // Second: resync also fails
    capturedWillResync = true;
    await vi.advanceTimersByTimeAsync(60000);
    expect(capturedWillResync).toBe(false);

    scheduler.stop();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/github-sync-scheduler.test.ts`
Expected: PASS (7 tests — 4 from Task 7 + 3 new)

- [ ] **Step 3: Run full suite + build**

Run: `npm test`
Expected: 764/764 pass

Run: `npm run build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add packages/adapters/github/src/github-sync-scheduler.test.ts
git commit -m "test(github-adapter): verify scheduler resync on failure and recovery"
```

---

## Task 9: Export `GitHubSyncScheduler` from package index

**Files:**
- Modify: `packages/adapters/github/src/index.ts`
- Test: `npm run build`

- [ ] **Step 1: Add exports to index.ts**

In `packages/adapters/github/src/index.ts`, append after the existing `GitHubApiClient` exports:

```typescript
export { GitHubSyncScheduler } from "./github-sync-scheduler.js";
export type { GitHubSyncSchedulerOptions, GitHubSyncSchedulerCallbacks } from "./github-sync-scheduler.js";
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: exit 0

Run: `npm test`
Expected: 764/764 pass (no new tests, just export verification)

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/github/src/index.ts
git commit -m "feat(github-adapter): export GitHubSyncScheduler from package index"
```

---

## Task 10: Documentation update + final verification

**Files:**
- Modify: `docs/integrations/github-adapter/README.md`
- Modify: `docs/integrations/github-adapter/v0-limitations.md`
- Modify: `docs/integrations/github-adapter/api-client.md`

- [ ] **Step 1: Add incremental sync section to README.md**

Append to the END of `docs/integrations/github-adapter/README.md`:

```markdown
## 增量同步（Phase 2.3）

`GitHubSyncScheduler` 提供定时增量同步，自动检测变更并只 emit 状态转换事件：

```typescript
import { GitHubRuntimeAdapter, GitHubApiClient, GitHubSyncScheduler } from "@agent-office/adapter-github";

const client = new GitHubApiClient({ token: process.env.GITHUB_TOKEN! });
const adapter = new GitHubRuntimeAdapter();
await adapter.connect();

const scheduler = new GitHubSyncScheduler(
  adapter,
  client,
  { owner: "Leonardo0402", repo: "AI-STARDEW-VALLEY", intervalMs: 60000 },
  {
    onSyncSuccess: (cursor) => console.log(`Synced up to ${cursor}`),
    onSyncFailure: (err, willResync) => console.error(`Sync failed: ${err.message}, will resync: ${willResync}`),
    onResync: () => console.log("Full resync triggered"),
  },
);

scheduler.start();
// ... later
scheduler.stop();
```

增量同步特性：
- 基于 `lastUpdatedAt` cursor，只拉取变更的 entities
- 对每个 entity diff 旧 evidence vs 新 fixture，只 emit 状态转换事件
- 首次同步（空 cursor）自动 fallback 到全量 `syncFromApi`
- 网络失败时下次自动触发全量 resync
```

- [ ] **Step 2: Add Phase 2.3 limitations to v0-limitations.md**

Append to the END of `docs/integrations/github-adapter/v0-limitations.md`:

```markdown
## 增量同步限制（Phase 2.3）

增量同步（`syncIncremental` + `GitHubSyncScheduler`）的 v0 边界：

- **Cursor 是内存的**：进程重启后丢失，首次 sync 自动 fallback 到全量
- **无 ETag / 304 快速路径**：每次 sync 发 HTTP 请求，即使无变更（留给后续优化）
- **reopened issue 不 emit 事件**：protocol 无 `task.reopened` EventType，reopened 只更新 evidence，projection 可能暂时 stale 直到全量 resync
- **label/assignee/review 变化不 emit 事件**：v0 只 emit 状态转换（open→closed / open→merged），非状态变化只更新 evidence
- **无并发锁**：`setInterval` 不 await，假设 sync < interval；超时由 resync 兜底
- **无 backoff**：失败后下次 interval 照常触发，resync 是安全网
- **无 webhook / SSE**：Phase 2.3 仍是 polling
```

- [ ] **Step 3: Add `fetchSince` documentation to api-client.md**

Append to the END of `docs/integrations/github-adapter/api-client.md`:

```markdown
## 增量拉取（Phase 2.3）

`fetchIssuesSince` 和 `fetchPRsSince` 支持基于 `since` cursor 的增量拉取：

| 方法 | 端点 | 策略 |
|---|---|---|
| `fetchIssuesSince(owner, repo, since)` | `GET /repos/{owner}/{repo}/issues?state=all&per_page=100&since={ISO8601}` | GitHub 原生 `since` 参数过滤 |
| `fetchPRsSince(owner, repo, since)` | `GET /repos/{owner}/{repo}/pulls?state=all&per_page=100&sort=updated&direction=desc` | 降序分页 + early-stop（`updated_at <= since` 时停止） |

- `since` 为空字符串时，两个方法都 fallback 到全量 `fetchIssues` / `fetchPRs`
- 返回的 fixture 包含 `updatedAt` 字段，adapter 用它推进 cursor
```

- [ ] **Step 4: Final verification**

Run: `npm run build`
Expected: exit 0

Run: `npm test`
Expected: 764/764 pass

Run: `git log --oneline -10`
Expected: 10 commits for Phase 2.3

- [ ] **Step 5: Commit**

```bash
git add docs/integrations/github-adapter/README.md docs/integrations/github-adapter/v0-limitations.md docs/integrations/github-adapter/api-client.md
git commit -m "docs(github-adapter): document incremental sync and scheduler (Issue #41)"
```
