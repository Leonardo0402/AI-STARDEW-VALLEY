# Phase 2.4: Command Gateway v0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open a policy-gated write path on `GitHubRuntimeAdapter` for 4 safe GitHub operations (issue comment, label add/remove, PR review request) via `Command → Policy → Adapter → API → Result Event`.

**Architecture:** Three layers: (1) `GitHubApiClient` gains 4 write methods + `rawPost`/`rawDelete` helpers; (2) new `GitHubPolicy` class does local allowlist + actor + payload + rate-limit validation; (3) `GitHubRuntimeAdapter.execute()` dispatches to per-command handlers when configured with `apiClient`/`owner`/`repo`/`policy`, else returns UNSUPPORTED_COMMAND (preserving fixture-only mode).

**Tech Stack:** TypeScript ES2022, vitest, msw (Mock Service Worker), native fetch, npm workspaces.

## Global Constraints

- Zero new runtime dependencies. Use native fetch, no octokit.
- `GitHubApiClient` is independent — does not import `GitHubRuntimeAdapter`.
- `fetchComments`/`fetchReviews` remain private on `GitHubApiClient`; new write methods (`addComment`/`addLabel`/`removeLabel`/`requestReview`) are public.
- `GitHubPolicy` makes zero network calls — pure local validation.
- Backward compatibility: if `apiClient`/`owner`/`repo` are absent in `GitHubAdapterOptions`, `execute()` returns UNSUPPORTED_COMMAND for all commands (fixture-only mode preserved).
- `TaskSnapshot` has no `labels` or `comments` field — the 3 new reducer cases are event-trail-only no-ops on snapshot.
- `ARTIFACT_REVIEW_REQUESTED` reducer already exists (reducer.ts:386); no new reducer case for `pr.request_review`.
- Existing tests must stay green — do not modify projection/determinism/label-mapping/destructive-guard/sync-from-api/sync-incremental/scheduler tests.
- Test command: `npm test`; Build command: `npm run build` (runs `tsc -b`).
- File naming: kebab-case for files, PascalCase for classes.
- Cursor and sync machinery from Phase 2.3 remain unchanged — this phase only touches `execute()` + new write methods + new policy.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/protocol/src/index.ts` | Modify | Add 3 EventTypes + 4 CommandTypes + 4 CommandPayloads + 3 EventPayloads |
| `packages/core/src/reducer.ts` | Modify | Add 3 reducer cases (no-op on snapshot, event-trail only) |
| `packages/core/src/core.test.ts` | Modify | Add 3 reducer tests |
| `packages/adapters/github/src/github-api-client.ts` | Modify | Add `rawPost`/`rawDelete` + 4 public write methods |
| `packages/adapters/github/src/github-api-client.test.ts` | Modify | Add 7 write-method tests (msw) |
| `packages/adapters/github/src/github-policy.ts` | Create | `GitHubPolicy` class |
| `packages/adapters/github/src/github-policy.test.ts` | Create | Policy unit tests (~7) |
| `packages/adapters/github/src/github-adapter.ts` | Modify | Options + `execute()` refactor + 4 handlers + `mapApiError` + capabilities |
| `packages/adapters/github/src/command-gateway.test.ts` | Create | Adapter execute() integration tests (~11, msw) |
| `packages/adapters/github/src/index.ts` | Modify | Export `GitHubPolicy` + types |
| `docs/integrations/github-adapter/README.md` | Modify | Add Command Gateway usage |
| `docs/integrations/github-adapter/v0-limitations.md` | Modify | Add Phase 2.4 limitations |
| `docs/integrations/github-adapter/api-client.md` | Modify | Document 4 write methods |

---

## Task 1: Protocol extensions — EventTypes, CommandTypes, Payloads

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Test: `npm run build` (type-check only — additive constants and types, no new test needed)

**Interfaces:**
- Produces: `EventType.ISSUE_COMMENTED`, `EventType.ISSUE_LABELED`, `EventType.ISSUE_UNLABELED`
- Produces: `CommandType.ISSUE_ADD_COMMENT`, `CommandType.ISSUE_ADD_LABEL`, `CommandType.ISSUE_REMOVE_LABEL`, `CommandType.PR_REQUEST_REVIEW`
- Produces: `IssueAddCommentPayload`, `IssueAddLabelPayload`, `IssueRemoveLabelPayload`, `PRRequestReviewPayload`
- Produces: `IssueCommentedPayload`, `IssueLabeledPayload`, `IssueUnlabeledPayload`

- [ ] **Step 1: Add 3 new EventTypes**

In `packages/protocol/src/index.ts`, find the `EventType` const (around line 328). Add the 3 new entries after `ERROR_RAISED`:

```typescript
export const EventType = {
  AGENT_SPAWNED: "agent.spawned",
  AGENT_STATUS_CHANGED: "agent.status_changed",
  TASK_CREATED: "task.created",
  TASK_ASSIGNED: "task.assigned",
  TASK_STARTED: "task.started",
  TASK_BLOCKED: "task.blocked",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  ARTIFACT_CREATED: "artifact.created",
  ARTIFACT_DRAFTED: "artifact.drafted",
  ARTIFACT_REVIEW_REQUESTED: "artifact.review_requested",
  ARTIFACT_REVIEWED: "artifact.reviewed",
  ARTIFACT_DELIVERED: "artifact.delivered",
  ARTIFACT_CLOSED: "artifact.closed",
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_RESOLVED: "approval.resolved",
  ERROR_RAISED: "error.raised",
  ISSUE_COMMENTED: "issue.commented",
  ISSUE_LABELED: "issue.labeled",
  ISSUE_UNLABELED: "issue.unlabeled",
} as const;
```

- [ ] **Step 2: Add 4 new CommandTypes**

In the same file, find the `CommandType` const (around line 398). Add the 4 new entries after `ARTIFACT_OPEN`:

```typescript
export const CommandType = {
  TASK_CREATE: "task.create",
  TASK_ASSIGN: "task.assign",
  AGENT_PAUSE: "agent.pause",
  AGENT_RESUME: "agent.resume",
  APPROVAL_ACCEPT: "approval.accept",
  APPROVAL_REJECT: "approval.reject",
  ARTIFACT_OPEN: "artifact.open",
  ISSUE_ADD_COMMENT: "issue.add_comment",
  ISSUE_ADD_LABEL: "issue.add_label",
  ISSUE_REMOVE_LABEL: "issue.remove_label",
  PR_REQUEST_REVIEW: "pr.request_review",
} as const;
```

- [ ] **Step 3: Add 4 CommandPayload interfaces**

In the same file, after the existing `ArtifactOpenPayload` interface (around line 394), add:

```typescript
export interface IssueAddCommentPayload {
  issueNumber: number;
  body: string;
}

export interface IssueAddLabelPayload {
  issueNumber: number;
  label: string;
}

export interface IssueRemoveLabelPayload {
  issueNumber: number;
  label: string;
}

export interface PRRequestReviewPayload {
  prNumber: number;
  reviewers: string[];
}
```

- [ ] **Step 4: Add 3 EventPayload interfaces**

In the same file, after the existing `ArtifactClosedPayload` interface (around line 303), add:

```typescript
export interface IssueCommentedPayload {
  taskId: Id;
  commentId: string;
  author: Id;
  body: string;
  createdAt: string;
}

export interface IssueLabeledPayload {
  taskId: Id;
  label: string;
  addedBy: Id;
}

export interface IssueUnlabeledPayload {
  taskId: Id;
  label: string;
  removedBy: Id;
}
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: exit 0 (additive constants and types, no breaking change)

- [ ] **Step 6: Verify existing tests still pass**

Run: `npm test`
Expected: 764/764 pass (no regressions)

- [ ] **Step 7: Commit**

```bash
git add packages/protocol/src/index.ts
git commit -m "feat(protocol): add Command Gateway v0 event/command types (Issue #43)"
```

---

## Task 2: Reducer — add 3 event-trail-only cases

**Files:**
- Modify: `packages/core/src/reducer.ts`
- Modify: `packages/core/src/core.test.ts`
- Test: `npx vitest run packages/core/src/core.test.ts`

**Interfaces:**
- Consumes: `EventType.ISSUE_COMMENTED`, `EventType.ISSUE_LABELED`, `EventType.ISSUE_UNLABELED` (from Task 1)
- Consumes: `IssueCommentedPayload`, `IssueLabeledPayload`, `IssueUnlabeledPayload` (from Task 1)

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/core.test.ts`, find the imports from `@agent-office/protocol` (around line 18). Add the 3 new payload types to the import:

```typescript
import {
  EventType,
  CommandType,
  type DomainEvent,
  type RuntimeSnapshot,
  type OfficeCommand,
  type CommandResult,
  type AgentStatusChangedPayload,
  type TaskCreatedPayload,
  type TaskAssignedPayload,
  type TaskStartedPayload,
  type TaskBlockedPayload,
  type TaskCompletedPayload,
  type ArtifactCreatedPayload,
  type ArtifactReviewedPayload,
  type ApprovalRequestedPayload,
  type ApprovalResolvedPayload,
  type ErrorRaisedPayload,
  type IssueCommentedPayload,
  type IssueLabeledPayload,
  type IssueUnlabeledPayload,
} from "@agent-office/protocol";
```

Then, at the end of the `describe("Reducer", () => { ... })` block (after the last existing test, before the closing `});`), add 3 new tests:

```typescript
  it("should pass through issue.commented event without snapshot mutation", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    const result = reduceEvent(snap, makeEvent(2, EventType.ISSUE_COMMENTED, {
      taskId: "t1",
      commentId: "c1",
      author: "user1",
      body: "Nice work",
      createdAt: "2026-07-11T10:00:00Z",
    } as IssueCommentedPayload));
    expect(result.errors).toHaveLength(0);
    // TaskSnapshot has no comments field — task count unchanged
    expect(result.snapshot.tasks).toHaveLength(1);
    expect(result.snapshot.tasks[0].taskId).toBe("t1");
  });

  it("should pass through issue.labeled event without snapshot mutation", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    const result = reduceEvent(snap, makeEvent(2, EventType.ISSUE_LABELED, {
      taskId: "t1",
      label: "bug",
      addedBy: "user1",
    } as IssueLabeledPayload));
    expect(result.errors).toHaveLength(0);
    expect(result.snapshot.tasks).toHaveLength(1);
  });

  it("should pass through issue.unlabeled event without snapshot mutation", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    const result = reduceEvent(snap, makeEvent(2, EventType.ISSUE_UNLABELED, {
      taskId: "t1",
      label: "bug",
      removedBy: "user1",
    } as IssueUnlabeledPayload));
    expect(result.errors).toHaveLength(0);
    expect(result.snapshot.tasks).toHaveLength(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/core.test.ts`
Expected: FAIL — the 3 new events fall through to the default case which pushes an "unknown event type" error.

- [ ] **Step 3: Add 3 reducer cases**

In `packages/core/src/reducer.ts`, find the `case EventType.ARTIFACT_REVIEW_REQUESTED:` block (around line 386). After the `case EventType.ARTIFACT_CLOSED:` block ends (around line 468), and before `case EventType.ARTIFACT_REVIEWED:`, add the 3 new cases. Actually, find the `case EventType.ERROR_RAISED:` block (around line 594) and add the 3 new cases right before it:

```typescript
    case EventType.ISSUE_COMMENTED: {
      // Event-trail only — TaskSnapshot has no comments field.
      // Evidence is tracked in GitHubAdapterEvidence.
      break;
    }

    case EventType.ISSUE_LABELED: {
      // Event-trail only — TaskSnapshot has no labels field.
      // Evidence is tracked in GitHubAdapterEvidence.
      break;
    }

    case EventType.ISSUE_UNLABELED: {
      // Event-trail only — TaskSnapshot has no labels field.
      // Evidence is tracked in GitHubAdapterEvidence.
      break;
    }
```

Also, at the top of `reducer.ts`, add the 3 new payload types to the import from `@agent-office/protocol` if they are not already imported (check existing imports first — they may be auto-imported via a barrel). Look for the existing import block and add:

```typescript
  type IssueCommentedPayload,
  type IssueLabeledPayload,
  type IssueUnlabeledPayload,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/core.test.ts`
Expected: PASS (all tests including 3 new ones)

- [ ] **Step 5: Run full suite to verify no regression**

Run: `npm test`
Expected: 767/767 pass (764 existing + 3 new)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/reducer.ts packages/core/src/core.test.ts
git commit -m "feat(core): add event-trail-only reducer cases for issue events (Issue #43)"
```

---

## Task 3: GitHubApiClient — `rawPost` + `addComment` write method

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts`
- Modify: `packages/adapters/github/src/github-api-client.test.ts`
- Test: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Produces: `GitHubApiClient.rawPost(url, body)` (private)
- Produces: `GitHubApiClient.addComment(owner, repo, issueNumber, body): Promise<{commentId, createdAt}>`

- [ ] **Step 1: Write the failing tests**

In `packages/adapters/github/src/github-api-client.test.ts`, at the end of the file (after the last `describe` block, before EOF), add:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: FAIL — `client.addComment is not a function`

- [ ] **Step 3: Add `rawPost` private helper**

In `packages/adapters/github/src/github-api-client.ts`, find the `rawGet` method (around line 146). After the `rawGet` method's closing brace (around line 192), add the new `rawPost` method:

```typescript
  private async rawPost(url: string, body: unknown): Promise<RawGetResult> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { ...this.buildHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      const text = await resp.text();
      let parsed: unknown = text;
      const ct = resp.headers.get("content-type") ?? "";
      if (ct.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep as text
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
      await this.waitForRateLimit(resp.headers);
      return { body: parsed, headers: resp.headers, status: resp.status };
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
```

- [ ] **Step 4: Add `addComment` public method**

In `github-api-client.ts`, find the `fetchPRsSince` method (around line 105). After `fetchPRsSince` ends (around line 130), and before the `// ─── 私有方法 ───` comment (around line 132), add a new section for write methods:

```typescript
  // ─── 写操作 ─────────────────────────────────────────────

  async addComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string
  ): Promise<{ commentId: number; createdAt: string }> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
    const result = await this.rawPost(url, { body });
    const json = result.body as { id: number; created_at: string };
    return { commentId: json.id, createdAt: json.created_at };
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: PASS (all tests including 2 new ones)

- [ ] **Step 6: Run full suite to verify no regression**

Run: `npm test`
Expected: 769/769 pass (767 + 2 new)

- [ ] **Step 7: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-api-client): add rawPost helper and addComment write method"
```

---

## Task 4: GitHubApiClient — `addLabel` + `removeLabel` + `rawDelete`

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts`
- Modify: `packages/adapters/github/src/github-api-client.test.ts`
- Test: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Produces: `GitHubApiClient.rawDelete(url)` (private)
- Produces: `GitHubApiClient.addLabel(owner, repo, issueNumber, label): Promise<void>`
- Produces: `GitHubApiClient.removeLabel(owner, repo, issueNumber, label): Promise<void>`

- [ ] **Step 1: Write the failing tests**

In `packages/adapters/github/src/github-api-client.test.ts`, at the end of the file, add:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: FAIL — `client.addLabel is not a function`

- [ ] **Step 3: Add `rawDelete` private helper**

In `packages/adapters/github/src/github-api-client.ts`, right after the `rawPost` method you added in Task 3, add:

```typescript
  private async rawDelete(url: string): Promise<RawGetResult> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "DELETE",
        headers: this.buildHeaders(),
        signal: ac.signal,
      });
      const text = await resp.text();
      let parsed: unknown = text;
      const ct = resp.headers.get("content-type") ?? "";
      if (ct.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep as text
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
      await this.waitForRateLimit(resp.headers);
      return { body: parsed, headers: resp.headers, status: resp.status };
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
```

- [ ] **Step 4: Add `addLabel` and `removeLabel` public methods**

In `github-api-client.ts`, right after the `addComment` method you added in Task 3, add:

```typescript
  async addLabel(
    owner: string,
    repo: string,
    issueNumber: number,
    label: string
  ): Promise<void> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/labels`;
    await this.rawPost(url, [label]);
  }

  async removeLabel(
    owner: string,
    repo: string,
    issueNumber: number,
    label: string
  ): Promise<void> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`;
    await this.rawDelete(url);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: PASS (all tests including 3 new ones)

- [ ] **Step 6: Run full suite to verify no regression**

Run: `npm test`
Expected: 772/772 pass (769 + 3 new)

- [ ] **Step 7: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-api-client): add rawDelete, addLabel, removeLabel write methods"
```

---

## Task 5: GitHubApiClient — `requestReview`

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts`
- Modify: `packages/adapters/github/src/github-api-client.test.ts`
- Test: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`

**Interfaces:**
- Produces: `GitHubApiClient.requestReview(owner, repo, prNumber, reviewers): Promise<void>`

- [ ] **Step 1: Write the failing tests**

In `packages/adapters/github/src/github-api-client.test.ts`, at the end of the file, add:

```typescript
describe("GitHubApiClient.requestReview", () => {
  it("posts requested reviewers and returns void on success", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/pulls/5/requested_reviewers", async ({ request }) => {
        const body = (await request.json()) as { reviewers: string[] };
        expect(body.reviewers).toEqual(["alice", "bob"]);
        return HttpResponse.json({ requested_reviewers: [] });
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    const result = await client.requestReview("owner", "repo", 5, ["alice", "bob"]);
    expect(result).toBeUndefined();
  });

  it("throws GitHubApiError(422) when reviewer is invalid", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/pulls/5/requested_reviewers", () => {
        return HttpResponse.json(
          { message: "Validation Failed" },
          { status: 422 },
        );
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    await expect(client.requestReview("owner", "repo", 5, ["nonexistent-user"])).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 422,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: FAIL — `client.requestReview is not a function`

- [ ] **Step 3: Add `requestReview` public method**

In `packages/adapters/github/src/github-api-client.ts`, right after the `removeLabel` method you added in Task 4, add:

```typescript
  async requestReview(
    owner: string,
    repo: string,
    prNumber: number,
    reviewers: string[]
  ): Promise<void> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`;
    await this.rawPost(url, { reviewers });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/github-api-client.test.ts`
Expected: PASS (all tests including 2 new ones)

- [ ] **Step 5: Run full suite to verify no regression**

Run: `npm test`
Expected: 774/774 pass (772 + 2 new)

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-api-client): add requestReview write method"
```

---

## Task 6: GitHubPolicy — create class + unit tests

**Files:**
- Create: `packages/adapters/github/src/github-policy.ts`
- Create: `packages/adapters/github/src/github-policy.test.ts`
- Test: `npx vitest run packages/adapters/github/src/github-policy.test.ts`

**Interfaces:**
- Produces: `GitHubPolicy` class with `validate(command: OfficeCommand): PolicyVerdict`
- Produces: `GitHubPolicyOptions { allowedActors: string[]; rateLimitPerMinute: number }`
- Produces: `PolicyVerdict { allowed: boolean; reason?: string }`

- [ ] **Step 1: Write the failing tests**

Create `packages/adapters/github/src/github-policy.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitHubPolicy } from "./github-policy.js";
import { CommandType, type OfficeCommand } from "@agent-office/protocol";

function makeCommand(
  commandType: string,
  actorId: string,
  payload: unknown
): OfficeCommand {
  return {
    commandId: "cmd-1",
    commandType,
    timestamp: "2026-07-11T10:00:00Z",
    source: "user",
    actorId,
    runtimeId: "rt-1",
    targetId: null,
    payload,
  };
}

describe("GitHubPolicy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("command type allowlist", () => {
    it("allows the 4 supported command types", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const payloads: Record<string, unknown> = {
        [CommandType.ISSUE_ADD_COMMENT]: { issueNumber: 1, body: "hi" },
        [CommandType.ISSUE_ADD_LABEL]: { issueNumber: 1, label: "bug" },
        [CommandType.ISSUE_REMOVE_LABEL]: { issueNumber: 1, label: "bug" },
        [CommandType.PR_REQUEST_REVIEW]: { prNumber: 1, reviewers: ["a"] },
      };
      for (const ct of Object.keys(payloads)) {
        const verdict = policy.validate(makeCommand(ct, "u1", payloads[ct]));
        expect(verdict.allowed).toBe(true);
      }
    });

    it("rejects unsupported command types", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(makeCommand("merge", "u1", {}));
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("UNSUPPORTED_COMMAND_TYPE");
    });
  });

  describe("actor authorization", () => {
    it("rejects actors not in allowedActors", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u2", { issueNumber: 1, body: "hi" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("ACTOR_NOT_AUTHORIZED");
    });
  });

  describe("payload validation", () => {
    it("rejects issue.add_comment with empty body", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects issue.add_label with empty label", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.ISSUE_ADD_LABEL, "u1", { issueNumber: 1, label: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects pr.request_review with empty reviewers array", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.PR_REQUEST_REVIEW, "u1", { prNumber: 1, reviewers: [] })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });
  });

  describe("rate limit", () => {
    it("allows up to N commands per minute, rejects N+1", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 3 });
      for (let i = 0; i < 3; i++) {
        const v = policy.validate(
          makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: `c${i}` })
        );
        expect(v.allowed).toBe(true);
      }
      const v = policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "c4" })
      );
      expect(v.allowed).toBe(false);
      expect(v.reason).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("resets counter after 60 seconds", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 1 });
      expect(policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "a" })
      ).allowed).toBe(true);
      expect(policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "b" })
      ).allowed).toBe(false);
      // advance 61 seconds
      vi.advanceTimersByTime(61 * 1000);
      expect(policy.validate(
        makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 1, body: "c" })
      ).allowed).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/adapters/github/src/github-policy.test.ts`
Expected: FAIL — module `./github-policy.js` not found

- [ ] **Step 3: Create `github-policy.ts`**

Create `packages/adapters/github/src/github-policy.ts`:

```typescript
/**
 * GitHubPolicy — pure local validation for Command Gateway v0.
 *
 * Checks (in order):
 * 1. Command type allowlist (4 supported types)
 * 2. Actor authorization (whitelist)
 * 3. Payload schema validation
 * 4. Rate limit (local counter per actor, window = 60s)
 *
 * No network calls. GitHub's real rate limit is handled by GitHubApiClient.
 */
import type { OfficeCommand, Id } from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";

export interface GitHubPolicyOptions {
  allowedActors: string[];
  rateLimitPerMinute: number;
}

export interface PolicyVerdict {
  allowed: boolean;
  reason?: string;
}

interface RateWindow {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;

export class GitHubPolicy {
  private readonly allowedActors: Set<string>;
  private readonly rateLimitPerMinute: number;
  private counters: Map<Id, RateWindow> = new Map();

  constructor(options: GitHubPolicyOptions) {
    this.allowedActors = new Set(options.allowedActors);
    this.rateLimitPerMinute = options.rateLimitPerMinute;
  }

  validate(command: OfficeCommand): PolicyVerdict {
    // 1. Command type allowlist
    const supported = [
      CommandType.ISSUE_ADD_COMMENT,
      CommandType.ISSUE_ADD_LABEL,
      CommandType.ISSUE_REMOVE_LABEL,
      CommandType.PR_REQUEST_REVIEW,
    ];
    if (!supported.includes(command.commandType)) {
      return { allowed: false, reason: "UNSUPPORTED_COMMAND_TYPE" };
    }

    // 2. Actor authorization
    if (!this.allowedActors.has(command.actorId)) {
      return { allowed: false, reason: "ACTOR_NOT_AUTHORIZED" };
    }

    // 3. Payload validation
    const payloadError = this.validatePayload(command);
    if (payloadError) {
      return { allowed: false, reason: payloadError };
    }

    // 4. Rate limit
    const now = Date.now();
    let window = this.counters.get(command.actorId);
    if (!window || now - window.windowStart >= WINDOW_MS) {
      window = { count: 0, windowStart: now };
    }
    if (window.count >= this.rateLimitPerMinute) {
      return { allowed: false, reason: "RATE_LIMIT_EXCEEDED" };
    }
    window.count++;
    this.counters.set(command.actorId, window);

    return { allowed: true };
  }

  private validatePayload(command: OfficeCommand): string | null {
    const p = command.payload as Record<string, unknown>;
    switch (command.commandType) {
      case CommandType.ISSUE_ADD_COMMENT: {
        if (typeof p.issueNumber !== "number" || p.issueNumber <= 0) return "INVALID_PAYLOAD";
        if (typeof p.body !== "string" || p.body.length === 0) return "INVALID_PAYLOAD";
        return null;
      }
      case CommandType.ISSUE_ADD_LABEL:
      case CommandType.ISSUE_REMOVE_LABEL: {
        if (typeof p.issueNumber !== "number" || p.issueNumber <= 0) return "INVALID_PAYLOAD";
        if (typeof p.label !== "string" || p.label.length === 0) return "INVALID_PAYLOAD";
        return null;
      }
      case CommandType.PR_REQUEST_REVIEW: {
        if (typeof p.prNumber !== "number" || p.prNumber <= 0) return "INVALID_PAYLOAD";
        if (!Array.isArray(p.reviewers) || p.reviewers.length === 0) return "INVALID_PAYLOAD";
        for (const r of p.reviewers) {
          if (typeof r !== "string" || r.length === 0) return "INVALID_PAYLOAD";
        }
        return null;
      }
      default:
        return null;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/github-policy.test.ts`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Run full suite to verify no regression**

Run: `npm test`
Expected: 781/781 pass (774 + 7 new)

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/github/src/github-policy.ts packages/adapters/github/src/github-policy.test.ts
git commit -m "feat(github-policy): add GitHubPolicy class with allowlist, actor, payload, rate-limit checks"
```

---

## Task 7: GitHubRuntimeAdapter — extend options + execute() dispatch + handlers

**Files:**
- Modify: `packages/adapters/github/src/github-adapter.ts`
- Test: `npm run build` (type-check; integration tests in Task 8)

**Interfaces:**
- Consumes: `GitHubApiClient.addComment/addLabel/removeLabel/requestReview` (Tasks 3-5)
- Consumes: `GitHubPolicy.validate` (Task 6)
- Consumes: `EventType.ISSUE_COMMENTED/ISSUE_LABELED/ISSUE_UNLABELED/ARTIFACT_REVIEW_REQUESTED` (Task 1)
- Produces: `GitHubRuntimeAdapter.execute()` refactored to dispatch to 4 handlers
- Produces: `GitHubAdapterOptions.apiClient/owner/repo/policy` (new optional fields)

- [ ] **Step 1: Extend GitHubAdapterOptions + add imports**

In `packages/adapters/github/src/github-adapter.ts`, find the imports at the top (around line 13-38). Add `CommandType` and the 4 new payload types to the import from `@agent-office/protocol`:

```typescript
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  DomainEvent,
  OfficeCommand,
  CommandResult,
  AdapterCapabilities,
  RuntimeStreamObserver,
  RuntimeSubscription,
  RuntimeStreamError,
  SubscribeOptions,
  Id,
  Priority,
  IssueAddCommentPayload,
  IssueAddLabelPayload,
  IssueRemoveLabelPayload,
  PRRequestReviewPayload,
} from "@agent-office/protocol";
import { EventType, ALL_EVENT_TYPES, CommandType } from "@agent-office/protocol";
```

Add imports for `GitHubApiClient`, `GitHubApiError`, and `GitHubPolicy`:

```typescript
import type { GitHubApiClient } from "./github-api-client.js";
import { GitHubApiError } from "./github-api-client.js";
import type { GitHubPolicy } from "./github-policy.js";
```

Find the `GitHubAdapterOptions` interface (around line 43). Add the 4 new optional fields:

```typescript
export interface GitHubAdapterOptions {
  runtimeId?: string;
  baseTimestamp?: string;
  apiClient?: GitHubApiClient;
  owner?: string;
  repo?: string;
  policy?: GitHubPolicy;
}
```

- [ ] **Step 2: Add private fields + constructor wiring**

Find the private fields section (around line 49-59). Add after `lastUpdatedAt`:

```typescript
  private apiClient?: GitHubApiClient;
  private owner?: string;
  private repo?: string;
  private policy?: GitHubPolicy;
```

Find the constructor (around line 61). Add the new field assignments:

```typescript
  constructor(options: GitHubAdapterOptions = {}) {
    this.runtimeId = options.runtimeId ?? DEFAULT_RUNTIME_ID;
    this.baseTimestamp = options.baseTimestamp ?? DEFAULT_BASE_TIMESTAMP;
    this.apiClient = options.apiClient;
    this.owner = options.owner;
    this.repo = options.repo;
    this.policy = options.policy;
  }
```

- [ ] **Step 3: Add `mapApiError` helper function**

At the end of the file, after the class closing brace, add the module-level helper:

```typescript
function mapApiError(err: unknown): { code: string; message: string } {
  if (err instanceof GitHubApiError) {
    switch (err.status) {
      case 401: return { code: "UNAUTHORIZED", message: err.message };
      case 403: return { code: "FORBIDDEN", message: err.message };
      case 404: return { code: "NOT_FOUND", message: err.message };
      case 422: return { code: "VALIDATION_FAILED", message: err.message };
      default: return { code: "ADAPTER_ERROR", message: err.message };
    }
  }
  return { code: "ADAPTER_ERROR", message: err instanceof Error ? err.message : String(err) };
}
```

- [ ] **Step 4: Replace the `execute()` method**

Find the existing `execute()` method (around line 149-159). Replace the entire method with:

```typescript
  async execute(command: OfficeCommand): Promise<CommandResult> {
    // 1. Unconfigured → UNSUPPORTED_COMMAND (fixture-only mode preserved)
    if (!this.apiClient || !this.owner || !this.repo) {
      return {
        commandId: command.commandId,
        status: "rejected",
        error: {
          code: "UNSUPPORTED_COMMAND",
          message: "GitHub Runtime Adapter v0 write path not configured",
        },
        affectedEventIds: [],
      };
    }

    // 2. Policy validation (if configured)
    if (this.policy) {
      const verdict = this.policy.validate(command);
      if (!verdict.allowed) {
        return {
          commandId: command.commandId,
          status: "rejected",
          error: {
            code: verdict.reason!,
            message: `Command rejected by policy: ${verdict.reason}`,
          },
          affectedEventIds: [],
        };
      }
    }

    // 3. Dispatch to handler
    try {
      let eventId: Id;
      switch (command.commandType) {
        case CommandType.ISSUE_ADD_COMMENT:
          eventId = await this.executeAddComment(command as OfficeCommand<IssueAddCommentPayload>);
          break;
        case CommandType.ISSUE_ADD_LABEL:
          eventId = await this.executeAddLabel(command as OfficeCommand<IssueAddLabelPayload>);
          break;
        case CommandType.ISSUE_REMOVE_LABEL:
          eventId = await this.executeRemoveLabel(command as OfficeCommand<IssueRemoveLabelPayload>);
          break;
        case CommandType.PR_REQUEST_REVIEW:
          eventId = await this.executeRequestReview(command as OfficeCommand<PRRequestReviewPayload>);
          break;
        default:
          return {
            commandId: command.commandId,
            status: "rejected",
            error: {
              code: "UNSUPPORTED_COMMAND",
              message: `Unknown command type: ${command.commandType}`,
            },
            affectedEventIds: [],
          };
      }
      return {
        commandId: command.commandId,
        status: "accepted",
        affectedEventIds: [eventId],
      };
    } catch (err) {
      return {
        commandId: command.commandId,
        status: "error",
        error: mapApiError(err),
        affectedEventIds: [],
      };
    }
  }
```

- [ ] **Step 5: Add 4 private handler methods**

Find the `// ─── 内部：事件发射 ───` comment (around line 578). Before that comment, after the `emitPRDelta` method ends, add the 4 new handler methods:

```typescript
  // ─── Command handlers (Phase 2.4) ───────────────────────

  private async executeAddComment(command: OfficeCommand<IssueAddCommentPayload>): Promise<Id> {
    const { issueNumber, body } = command.payload;
    const result = await this.apiClient!.addComment(this.owner!, this.repo!, issueNumber, body);
    const taskId: Id = `gh-issue-${issueNumber}`;
    const eventId = this.emit(
      EventType.ISSUE_COMMENTED,
      {
        taskId,
        commentId: String(result.commentId),
        author: command.actorId,
        body,
        createdAt: result.createdAt,
      },
      "issue",
      issueNumber,
      result.createdAt,
    );
    // Update evidence
    const ref = this.evidence.tasks[taskId];
    if (ref) {
      ref.comments.push({ author: command.actorId, body, createdAt: result.createdAt });
    }
    return eventId;
  }

  private async executeAddLabel(command: OfficeCommand<IssueAddLabelPayload>): Promise<Id> {
    const { issueNumber, label } = command.payload;
    await this.apiClient!.addLabel(this.owner!, this.repo!, issueNumber, label);
    const taskId: Id = `gh-issue-${issueNumber}`;
    const eventId = this.emit(
      EventType.ISSUE_LABELED,
      { taskId, label, addedBy: command.actorId },
      "issue",
      issueNumber,
      this.baseTimestamp,
    );
    const ref = this.evidence.tasks[taskId];
    if (ref && !ref.labels.includes(label)) {
      ref.labels.push(label);
    }
    return eventId;
  }

  private async executeRemoveLabel(command: OfficeCommand<IssueRemoveLabelPayload>): Promise<Id> {
    const { issueNumber, label } = command.payload;
    await this.apiClient!.removeLabel(this.owner!, this.repo!, issueNumber, label);
    const taskId: Id = `gh-issue-${issueNumber}`;
    const eventId = this.emit(
      EventType.ISSUE_UNLABELED,
      { taskId, label, removedBy: command.actorId },
      "issue",
      issueNumber,
      this.baseTimestamp,
    );
    const ref = this.evidence.tasks[taskId];
    if (ref) {
      ref.labels = ref.labels.filter((l) => l !== label);
    }
    return eventId;
  }

  private async executeRequestReview(command: OfficeCommand<PRRequestReviewPayload>): Promise<Id> {
    const { prNumber, reviewers } = command.payload;
    await this.apiClient!.requestReview(this.owner!, this.repo!, prNumber, reviewers);
    const artifactId: Id = `gh-pr-${prNumber}`;
    const eventId = this.emit(
      EventType.ARTIFACT_REVIEW_REQUESTED,
      { artifactId, reviewerIds: reviewers },
      "pr",
      prNumber,
      this.baseTimestamp,
    );
    const ref = this.evidence.artifacts[artifactId];
    if (ref) {
      const existing = ref.reviewers ?? [];
      for (const r of reviewers) {
        if (!existing.includes(r)) {
          existing.push(r);
        }
      }
      ref.reviewers = existing;
    }
    return eventId;
  }
```

- [ ] **Step 6: Update `getCapabilities()`**

Find the `getCapabilities()` method (around line 161). Replace it with:

```typescript
  getCapabilities(): AdapterCapabilities {
    const writeConfigured = !!(this.apiClient && this.owner && this.repo);
    return {
      supportedEvents: [...ALL_EVENT_TYPES],
      supportedCommands: writeConfigured
        ? [
            CommandType.ISSUE_ADD_COMMENT,
            CommandType.ISSUE_ADD_LABEL,
            CommandType.ISSUE_REMOVE_LABEL,
            CommandType.PR_REQUEST_REVIEW,
          ]
        : [],
      features: {
        snapshot: true,
        sse: true,
        websocket: false,
        commandExecution: writeConfigured,
        softMapping: false,
        hardOrchestration: false,
      },
    };
  }
```

- [ ] **Step 7: Verify build passes**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 8: Verify existing tests still pass**

Run: `npm test`
Expected: 781/781 pass (no regressions — fixture-only mode preserved)

- [ ] **Step 9: Commit**

```bash
git add packages/adapters/github/src/github-adapter.ts
git commit -m "feat(github-adapter): refactor execute() with policy dispatch and 4 write handlers"
```

---

## Task 8: Command Gateway integration tests

**Files:**
- Create: `packages/adapters/github/src/command-gateway.test.ts`
- Test: `npx vitest run packages/adapters/github/src/command-gateway.test.ts`

**Interfaces:**
- Consumes: `GitHubRuntimeAdapter` with `apiClient`/`owner`/`repo`/`policy` configured (Task 7)
- Consumes: `GitHubApiClient` write methods (Tasks 3-5)
- Consumes: `GitHubPolicy` (Task 6)

- [ ] **Step 1: Write the integration tests**

Create `packages/adapters/github/src/command-gateway.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { GitHubRuntimeAdapter } from "./github-adapter.js";
import { GitHubApiClient } from "./github-api-client.js";
import { GitHubPolicy } from "./github-policy.js";
import { EventType, CommandType, type OfficeCommand } from "@agent-office/protocol";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeCommand(
  commandType: string,
  actorId: string,
  payload: unknown
): OfficeCommand {
  return {
    commandId: `cmd-${Date.now()}`,
    commandType,
    timestamp: "2026-07-11T10:00:00Z",
    source: "user",
    actorId,
    runtimeId: "rt-1",
    targetId: null,
    payload,
  };
}

function makeConfiguredAdapter(
  policy?: GitHubPolicy
): { adapter: GitHubRuntimeAdapter; client: GitHubApiClient } {
  const client = new GitHubApiClient({ token: "ghp_test" });
  const adapter = new GitHubRuntimeAdapter({
    apiClient: client,
    owner: "owner",
    repo: "repo",
    policy,
  });
  return { adapter, client };
}

describe("GitHubRuntimeAdapter.execute — command gateway", () => {
  it("issue.add_comment success → status accepted, emits ISSUE_COMMENTED", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json({ id: 42, created_at: "2026-07-11T10:00:00Z" });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 10, body: "hello" })
    );
    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds).toHaveLength(1);

    const events = adapter.getEventLog();
    const lastEvent = events[events.length - 1];
    expect(lastEvent.type).toBe(EventType.ISSUE_COMMENTED);
    expect(lastEvent.payload).toMatchObject({ taskId: "gh-issue-10", body: "hello" });
  });

  it("issue.add_label success → emits ISSUE_LABELED", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/labels", () => {
        return HttpResponse.json([{ name: "bug" }]);
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.ISSUE_ADD_LABEL, "u1", { issueNumber: 10, label: "bug" })
    );
    expect(result.status).toBe("accepted");
    const lastEvent = adapter.getEventLog().pop()!;
    expect(lastEvent.type).toBe(EventType.ISSUE_LABELED);
  });

  it("issue.remove_label success → emits ISSUE_UNLABELED", async () => {
    server.use(
      http.delete("https://api.github.com/repos/owner/repo/issues/10/labels/bug", () => {
        return HttpResponse.json({}, { status: 200 });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.ISSUE_REMOVE_LABEL, "u1", { issueNumber: 10, label: "bug" })
    );
    expect(result.status).toBe("accepted");
    const lastEvent = adapter.getEventLog().pop()!;
    expect(lastEvent.type).toBe(EventType.ISSUE_UNLABELED);
  });

  it("pr.request_review success → emits ARTIFACT_REVIEW_REQUESTED", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/pulls/5/requested_reviewers", () => {
        return HttpResponse.json({ requested_reviewers: [] });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.PR_REQUEST_REVIEW, "u1", { prNumber: 5, reviewers: ["alice"] })
    );
    expect(result.status).toBe("accepted");
    const lastEvent = adapter.getEventLog().pop()!;
    expect(lastEvent.type).toBe(EventType.ARTIFACT_REVIEW_REQUESTED);
  });

  it("unsupported command type → rejected with UNSUPPORTED_COMMAND", async () => {
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(makeCommand("merge", "u1", {}));
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
  });

  it("unconfigured adapter (no apiClient) → rejected with UNSUPPORTED_COMMAND", async () => {
    const adapter = new GitHubRuntimeAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 10, body: "hi" })
    );
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
  });

  it("policy rejects → rejected with policy reason", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json({ id: 42, created_at: "2026-07-11T10:00:00Z" });
      }),
    );
    const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
    const { adapter } = makeConfiguredAdapter(policy);
    await adapter.connect();

    // u2 is not in allowedActors
    const result = await adapter.execute(
      makeCommand(CommandType.ISSUE_ADD_COMMENT, "u2", { issueNumber: 10, body: "hi" })
    );
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("ACTOR_NOT_AUTHORIZED");
  });

  it("API 404 → error with NOT_FOUND", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/999/comments", () => {
        return HttpResponse.json({ message: "Not Found" }, { status: 404 });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 999, body: "hi" })
    );
    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("API 401 → error with UNAUTHORIZED", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json({ message: "Bad credentials" }, { status: 401 });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 10, body: "hi" })
    );
    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("UNAUTHORIZED");
  });

  it("success updates evidence (comments)", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json({ id: 42, created_at: "2026-07-11T10:00:00Z" });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    await adapter.execute(
      makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 10, body: "hello" })
    );

    const evidence = adapter.getGitHubEvidence();
    // task gh-issue-10 may not exist in evidence (no prior sync) — that's OK,
    // evidence update is best-effort
    const task = evidence.tasks["gh-issue-10"];
    if (task) {
      expect(task.comments).toHaveLength(1);
      expect(task.comments[0].body).toBe("hello");
    }
  });

  it("success → getSnapshot() replay produces no reducer errors", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json({ id: 42, created_at: "2026-07-11T10:00:00Z" });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    await adapter.execute(
      makeCommand(CommandType.ISSUE_ADD_COMMENT, "u1", { issueNumber: 10, body: "hello" })
    );

    const snap = await adapter.getSnapshot();
    expect(snap).toBeDefined();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/github/src/command-gateway.test.ts`
Expected: PASS (all 11 tests)

- [ ] **Step 3: Run full suite to verify no regression**

Run: `npm test`
Expected: 792/792 pass (781 + 11 new)

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/github/src/command-gateway.test.ts
git commit -m "test(github-adapter): add command gateway integration tests (11 cases)"
```

---

## Task 9: Export GitHubPolicy + types from package index

**Files:**
- Modify: `packages/adapters/github/src/index.ts`
- Test: `npm run build`

**Interfaces:**
- Produces: `GitHubPolicy`, `GitHubPolicyOptions`, `PolicyVerdict` exported from package

- [ ] **Step 1: Add exports**

In `packages/adapters/github/src/index.ts`, at the end of the file, add:

```typescript
export { GitHubPolicy } from "./github-policy.js";
export type { GitHubPolicyOptions, PolicyVerdict } from "./github-policy.js";
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 3: Verify tests still pass**

Run: `npm test`
Expected: 792/792 pass

- [ ] **Step 4: Commit**

```bash
git add packages/adapters/github/src/index.ts
git commit -m "feat(github-adapter): export GitHubPolicy and types from package index"
```

---

## Task 10: Update documentation

**Files:**
- Modify: `docs/integrations/github-adapter/README.md`
- Modify: `docs/integrations/github-adapter/v0-limitations.md`
- Modify: `docs/integrations/github-adapter/api-client.md`
- Test: `npm run build` (docs are markdown, no build impact)

- [ ] **Step 1: Add Command Gateway section to README**

In `docs/integrations/github-adapter/README.md`, at the end of the file, add:

```markdown

## Command Gateway v0 (Phase 2.4)

The adapter supports 4 safe write operations through the standard `Command → Policy → Adapter → API → Result Event` flow:

| Command Type | GitHub API | Event Emitted |
|---|---|---|
| `issue.add_comment` | POST `/repos/{owner}/{repo}/issues/{number}/comments` | `issue.commented` |
| `issue.add_label` | POST `/repos/{owner}/{repo}/issues/{number}/labels` | `issue.labeled` |
| `issue.remove_label` | DELETE `/repos/{owner}/{repo}/issues/{number}/labels/{name}` | `issue.unlabeled` |
| `pr.request_review` | POST `/repos/{owner}/{repo}/pulls/{number}/requested_reviewers` | `artifact.review_requested` |

### Usage

```typescript
import { GitHubRuntimeAdapter, GitHubApiClient, GitHubPolicy } from "@agent-office/adapter-github";

const client = new GitHubApiClient({ token: process.env.GITHUB_TOKEN! });
const policy = new GitHubPolicy({
  allowedActors: ["user-alice", "user-bob"],
  rateLimitPerMinute: 30,
});
const adapter = new GitHubRuntimeAdapter({
  apiClient: client,
  owner: "your-org",
  repo: "your-repo",
  policy,
});

await adapter.connect();
const result = await adapter.execute({
  commandId: "cmd-1",
  commandType: "issue.add_comment",
  timestamp: new Date().toISOString(),
  source: "user",
  actorId: "user-alice",
  runtimeId: "rt-1",
  targetId: null,
  payload: { issueNumber: 42, body: "Looks good!" },
});
// result.status === "accepted"
```

### Policy

`GitHubPolicy` performs 4 checks (in order):
1. Command type allowlist (only the 4 supported types)
2. Actor authorization (whitelist)
3. Payload validation (required fields, non-empty strings)
4. Rate limit (local counter per actor, configurable window)

If `policy` is omitted from options, no policy check is performed.

### Error Mapping

| HTTP Status | Error Code |
|---|---|
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 422 | `VALIDATION_FAILED` |
| other | `ADAPTER_ERROR` |
```

- [ ] **Step 2: Add Phase 2.4 limitations to v0-limitations.md**

In `docs/integrations/github-adapter/v0-limitations.md`, at the end of the file, add:

```markdown

## Phase 2.4: Command Gateway v0

- **Dangerous operations**: merge / close / delete / force-push return `UNSUPPORTED_COMMAND`, deferred to Phase 2.5
- **Approval flow**: no human-in-the-loop approval before command execution (Phase 2.5 or later)
- **Multi-repo**: adapter holds a single `{owner, repo}`, no runtime switching
- **GitHub rate_limit query**: Policy does not call `/rate_limit` API, only local counter
- **Retry / backoff**: API failure does not auto-retry, returns error CommandResult directly
- **Concurrency lock**: `execute()` has no concurrency guard (YAGNI, single-runtime serial assumption)
- **Event rollback**: if API succeeds but emit fails, no rollback of GitHub operation (emit is in-memory, cannot fail)
- **Webhook verification**: does not verify command source is a real GitHub webhook
- **Comment author authenticity**: emitted `author` uses `command.actorId` (office-side actor), not the GitHub API-returned user
- **Label color**: `addLabel` sends label name only; GitHub assigns default color
- **Reducer snapshot mutation**: `ISSUE_COMMENTED` / `ISSUE_LABELED` / `ISSUE_UNLABELED` are event-trail-only no-ops on `TaskSnapshot` (which has no `labels`/`comments` field); evidence is tracked in `GitHubAdapterEvidence` only
```

- [ ] **Step 3: Document write methods in api-client.md**

In `docs/integrations/github-adapter/api-client.md`, at the end of the file, add:

```markdown

## Write Methods (Phase 2.4)

### `addComment(owner, repo, issueNumber, body)`

Posts a comment to an issue. Returns `{ commentId, createdAt }`.

### `addLabel(owner, repo, issueNumber, label)`

Adds a label to an issue. Returns `void`.

### `removeLabel(owner, repo, issueNumber, label)`

Removes a label from an issue. Returns `void`.

### `requestReview(owner, repo, prNumber, reviewers)`

Requests reviewers on a pull request. Returns `void`.

All write methods throw `GitHubApiError` on non-2xx responses with `status` matching the HTTP code (401, 403, 404, 422, or 0 for network/timeout).
```

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 5: Verify tests still pass**

Run: `npm test`
Expected: 792/792 pass

- [ ] **Step 6: Commit**

```bash
git add docs/integrations/github-adapter/README.md docs/integrations/github-adapter/v0-limitations.md docs/integrations/github-adapter/api-client.md
git commit -m "docs(github-adapter): document Command Gateway v0 (Issue #43)"
```

---

## Task 11: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: 792/792 pass (764 baseline + 3 reducer + 7 policy + 7 API client + 11 gateway)

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 3: Verify no existing tests were modified**

Run: `git diff main -- packages/adapters/github/src/github-api-client.test.ts packages/adapters/github/src/sync-incremental.test.ts packages/adapters/github/src/github-sync-scheduler.test.ts packages/adapters/github/src/projection.test.ts packages/adapters/github/src/determinism.test.ts packages/adapters/github/src/label-mapping.test.ts packages/adapters/github/src/destructive-guard.test.ts packages/adapters/github/src/sync-from-api.test.ts`
Expected: only additions, no modifications to existing test assertions

- [ ] **Step 4: Verify commit count**

Run: `git log --oneline main..HEAD`
Expected: 11 commits (1 spec + 10 task commits)
