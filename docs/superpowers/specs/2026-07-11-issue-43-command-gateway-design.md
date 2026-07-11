# Phase 2.4: Command Gateway v0 — Design Spec

**Issue:** #43
**Branch:** (to be created) `feat/github-command-gateway-issue-43`
**Date:** 2026-07-11
**Depends on:** Phase 2.3 (PR #42, merged) — `GitHubApiClient` + `syncIncremental` + `GitHubSyncScheduler`

## 1. Overview

Phase 2.3 completed the read-only projection chain (fixture → real API → incremental sync). The current `GitHubRuntimeAdapter.execute()` returns `UNSUPPORTED_COMMAND` for all commands. Phase 2.4 opens a limited, policy-gated write path so the office can execute 4 safe GitHub operations through the standard `Command → Policy → Adapter → API → Result Event` flow.

Four supported commands:
1. `issue.add_comment` — POST a comment to an issue
2. `issue.add_label` — POST a label to an issue
3. `issue.remove_label` — DELETE a label from an issue
4. `pr.request_review` — POST requested reviewers to a PR

Dangerous operations (merge / close / delete / force-push) continue returning `UNSUPPORTED_COMMAND`, deferred to Phase 2.5.

## 2. Architecture

```
OfficeCommand
  → GitHubPolicy.validate(command)          // allowlist + actor + payload + local rate limit
    → rejected? return CommandResult{status:"rejected"}
    → accepted? dispatch to handler:
        executeAddComment()    → client.addComment()    → emit ISSUE_COMMENTED            → update evidence
        executeAddLabel()      → client.addLabel()      → emit ISSUE_LABELED              → update evidence
        executeRemoveLabel()   → client.removeLabel()   → emit ISSUE_UNLABELED            → update evidence
        executeRequestReview() → client.requestReview() → emit ARTIFACT_REVIEW_REQUESTED  → update evidence
  → return CommandResult{status:"accepted", affectedEventIds:[eventId]}
```

**Layer separation:**
- **`GitHubApiClient`** (stateless HTTP) — adds 4 write methods + `rawPost`/`rawDelete` private helpers
- **`GitHubRuntimeAdapter`** (stateful projection) — gains optional `apiClient`/`owner`/`repo`/`policy` in options; `execute()` dispatches to per-command handlers when configured, else returns UNSUPPORTED_COMMAND
- **`GitHubPolicy`** (new, pure local validation) — command-type allowlist + actor whitelist + payload schema + local rate limiter (no GitHub API calls)

**Key invariants:**
- Backward compatibility: if `apiClient` / `owner` / `repo` are absent in options, `execute()` returns UNSUPPORTED_COMMAND for all commands (same as today) — existing fixture tests unaffected
- Policy is pure local validation — no network calls, no GitHub rate_limit query
- Each handler follows: API call → emit event → update evidence → return eventId
- `ARTIFACT_REVIEW_REQUESTED` reducer already exists (reducer.ts:386); no new reducer case needed for it
- `TaskSnapshot` has no `labels` or `comments` field — the 3 new events (ISSUE_COMMENTED / ISSUE_LABELED / ISSUE_UNLABELED) emit to eventLog and update adapter evidence, but the reducer is a no-op on snapshot (preserves event trail without schema change)

## 3. Protocol Extensions

### 3.1 New EventTypes (3 new + 1 reuse)

In `packages/protocol/src/index.ts`:

```typescript
export const EventType = {
  // ... existing ...
  ISSUE_COMMENTED: "issue.commented",
  ISSUE_LABELED: "issue.labeled",
  ISSUE_UNLABELED: "issue.unlabeled",
  // pr.request_review reuses existing ARTIFACT_REVIEW_REQUESTED: "artifact.review_requested"
} as const;
```

### 3.2 New CommandTypes (4 new)

```typescript
export const CommandType = {
  // ... existing ...
  ISSUE_ADD_COMMENT: "issue.add_comment",
  ISSUE_ADD_LABEL: "issue.add_label",
  ISSUE_REMOVE_LABEL: "issue.remove_label",
  PR_REQUEST_REVIEW: "pr.request_review",
} as const;
```

### 3.3 New Command Payload types

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
  reviewers: string[];   // GitHub logins
}
```

### 3.4 New Event Payload types

```typescript
export interface IssueCommentedPayload {
  taskId: Id;
  commentId: string;
  author: Id;            // command.actorId (office-side actor)
  body: string;
  createdAt: string;     // from GitHub API response
}

export interface IssueLabeledPayload {
  taskId: Id;
  label: string;
  addedBy: Id;           // command.actorId
}

export interface IssueUnlabeledPayload {
  taskId: Id;
  label: string;
  removedBy: Id;        // command.actorId
}

// pr.request_review reuses existing ArtifactReviewRequestedPayload:
//   { artifactId: Id; reviewerIds: Id[] }
```

### 3.5 Reducer changes

In `packages/core/src/reducer.ts`, add 3 new cases. Since `TaskSnapshot` has no `labels` or `comments` field, these cases are **event-trail-only no-ops on snapshot** — they do not modify the snapshot state, but they allow the event to pass through `reduceEvent` without being flagged as an unknown type:

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

`ARTIFACT_REVIEW_REQUESTED` reducer already exists (reducer.ts:386) and transitions artifact status to `under_review` — no change needed.

## 4. GitHubApiClient Write Methods

In `packages/adapters/github/src/github-api-client.ts`:

### 4.1 New private helpers

```typescript
private async rawPost(url: string, body: unknown): Promise<RawPostResult> {
  // POST with JSON body, reuse timeout/error/rate-limit logic from rawGet
  // Returns { body, headers, status }
}

private async rawDelete(url: string): Promise<RawDeleteResult> {
  // DELETE, reuse timeout/error/rate-limit logic from rawGet
  // Returns { headers, status }
}
```

### 4.2 Public write methods

```typescript
// POST /repos/{owner}/{repo}/issues/{number}/comments
async addComment(
  owner: string, repo: string, issueNumber: number, body: string
): Promise<{ commentId: number; createdAt: string }>

// POST /repos/{owner}/{repo}/issues/{number}/labels
async addLabel(
  owner: string, repo: string, issueNumber: number, label: string
): Promise<void>

// DELETE /repos/{owner}/{repo}/issues/{number}/labels/{name}
async removeLabel(
  owner: string, repo: string, issueNumber: number, label: string
): Promise<void>

// POST /repos/{owner}/{repo}/pulls/{number}/requested_reviewers
async requestReview(
  owner: string, repo: string, prNumber: number, reviewers: string[]
): Promise<void>
```

**Error mapping:** All methods throw `GitHubApiError` on non-2xx:
- HTTP 401 → `GitHubApiError(status:401)` — invalid token
- HTTP 403 → `GitHubApiError(status:403)` — forbidden or rate limit exhausted
- HTTP 404 → `GitHubApiError(status:404)` — issue/PR not found
- HTTP 422 → `GitHubApiError(status:422)` — validation failure (e.g. invalid label, invalid reviewer)
- Network/timeout → `GitHubApiError(status:0)`

**No new dependencies:** continues using native `fetch`.

## 5. GitHubPolicy

New file `packages/adapters/github/src/github-policy.ts`:

```typescript
export interface GitHubPolicyOptions {
  allowedActors: string[];
  rateLimitPerMinute: number;   // default 30
}

export interface PolicyVerdict {
  allowed: boolean;
  reason?: string;
}

export class GitHubPolicy {
  private counters: Map<Id, { count: number; windowStart: number }> = new Map();

  constructor(options: GitHubPolicyOptions)

  validate(command: OfficeCommand): PolicyVerdict
}
```

### 5.1 validate() checks (in order)

1. **Command type allowlist** — only the 4 supported command types pass; others → `{allowed:false, reason:"UNSUPPORTED_COMMAND_TYPE"}`
2. **Actor authorization** — `command.actorId` must be in `allowedActors`; else → `{allowed:false, reason:"ACTOR_NOT_AUTHORIZED"}`
3. **Payload validation** — per commandType:
   - `issue.add_comment`: `issueNumber > 0`, `body` is non-empty string
   - `issue.add_label` / `issue.remove_label`: `issueNumber > 0`, `label` is non-empty string
   - `pr.request_review`: `prNumber > 0`, `reviewers` is non-empty array of non-empty strings
   - Invalid → `{allowed:false, reason:"INVALID_PAYLOAD"}`
4. **Rate limit** — look up `counters.get(actorId)`; if window expired (>60s since windowStart), reset; if count >= `rateLimitPerMinute` → `{allowed:false, reason:"RATE_LIMIT_EXCEEDED"}`; else increment count

**No GitHub API calls** — Policy is pure local validation. GitHub's real rate limit is handled by `GitHubApiClient.waitForRateLimit` (already exists).

## 6. GitHubRuntimeAdapter.execute() Refactor

### 6.1 Options extension

```typescript
export interface GitHubAdapterOptions {
  runtimeId?: string;
  baseTimestamp?: string;
  apiClient?: GitHubApiClient;   // NEW — required for write operations
  owner?: string;                 // NEW
  repo?: string;                  // NEW
  policy?: GitHubPolicy;          // NEW — if absent, no policy check (all commands pass type check only)
}
```

### 6.2 execute() logic

```typescript
async execute(command: OfficeCommand): Promise<CommandResult> {
  // 1. Unconfigured → UNSUPPORTED_COMMAND (fixture-only mode preserved)
  if (!this.apiClient || !this.owner || !this.repo) {
    return { commandId: command.commandId, status: "rejected",
      error: { code: "UNSUPPORTED_COMMAND", message: "GitHub Runtime Adapter v0 write path not configured" },
      affectedEventIds: [] };
  }

  // 2. Policy validation (if configured)
  if (this.policy) {
    const verdict = this.policy.validate(command);
    if (!verdict.allowed) {
      return { commandId: command.commandId, status: "rejected",
        error: { code: verdict.reason!, message: `Command rejected by policy: ${verdict.reason}` },
        affectedEventIds: [] };
    }
  }

  // 3. Dispatch to handler
  try {
    let eventId: Id;
    switch (command.commandType) {
      case CommandType.ISSUE_ADD_COMMENT:    eventId = await this.executeAddComment(command); break;
      case CommandType.ISSUE_ADD_LABEL:      eventId = await this.executeAddLabel(command); break;
      case CommandType.ISSUE_REMOVE_LABEL:   eventId = await this.executeRemoveLabel(command); break;
      case CommandType.PR_REQUEST_REVIEW:    eventId = await this.executeRequestReview(command); break;
      default:
        return { commandId: command.commandId, status: "rejected",
          error: { code: "UNSUPPORTED_COMMAND", message: `Unknown command type: ${command.commandType}` },
          affectedEventIds: [] };
    }
    return { commandId: command.commandId, status: "accepted", affectedEventIds: [eventId] };
  } catch (err) {
    return { commandId: command.commandId, status: "error",
      error: mapApiError(err), affectedEventIds: [] };
  }
}
```

### 6.3 Handler methods (private)

Each handler: API call → emit event → update evidence → return eventId.

```typescript
private async executeAddComment(command: OfficeCommand<IssueAddCommentPayload>): Promise<Id> {
  const { issueNumber, body } = command.payload;
  const result = await this.apiClient!.addComment(this.owner!, this.repo!, issueNumber, body);
  const taskId: Id = `gh-issue-${issueNumber}`;
  const eventId = this.emit(EventType.ISSUE_COMMENTED, {
    taskId, commentId: String(result.commentId),
    author: command.actorId, body, createdAt: result.createdAt
  }, "issue", issueNumber, result.createdAt);
  // Update evidence
  const ref = this.evidence.tasks[taskId];
  if (ref) ref.comments.push({ author: command.actorId, body, createdAt: result.createdAt });
  return eventId;
}

private async executeAddLabel(command: OfficeCommand<IssueAddLabelPayload>): Promise<Id> {
  const { issueNumber, label } = command.payload;
  await this.apiClient!.addLabel(this.owner!, this.repo!, issueNumber, label);
  const taskId: Id = `gh-issue-${issueNumber}`;
  const eventId = this.emit(EventType.ISSUE_LABELED, {
    taskId, label, addedBy: command.actorId
  }, "issue", issueNumber, this.baseTimestamp);
  // Update evidence
  const ref = this.evidence.tasks[taskId];
  if (ref && !ref.labels.includes(label)) ref.labels.push(label);
  return eventId;
}

private async executeRemoveLabel(command: OfficeCommand<IssueRemoveLabelPayload>): Promise<Id> {
  const { issueNumber, label } = command.payload;
  await this.apiClient!.removeLabel(this.owner!, this.repo!, issueNumber, label);
  const taskId: Id = `gh-issue-${issueNumber}`;
  const eventId = this.emit(EventType.ISSUE_UNLABELED, {
    taskId, label, removedBy: command.actorId
  }, "issue", issueNumber, this.baseTimestamp);
  // Update evidence
  const ref = this.evidence.tasks[taskId];
  if (ref) ref.labels = ref.labels.filter((l) => l !== label);
  return eventId;
}

private async executeRequestReview(command: OfficeCommand<PRRequestReviewPayload>): Promise<Id> {
  const { prNumber, reviewers } = command.payload;
  await this.apiClient!.requestReview(this.owner!, this.repo!, prNumber, reviewers);
  const artifactId: Id = `gh-pr-${prNumber}`;
  const eventId = this.emit(EventType.ARTIFACT_REVIEW_REQUESTED, {
    artifactId, reviewerIds: reviewers
  }, "pr", prNumber, this.baseTimestamp);
  // Update evidence
  const ref = this.evidence.artifacts[artifactId];
  if (ref) {
    for (const r of reviewers) {
      if (!ref.reviewers?.includes(r)) ref.reviewers = [...(ref.reviewers ?? []), r];
    }
  }
  return eventId;
}
```

### 6.4 Error mapping helper

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

### 6.5 getCapabilities() update

When `apiClient` is configured:
- `supportedCommands` changes from `[]` to the 4 command types
- `features.commandExecution` changes from `false` to `true`

When `apiClient` is absent (fixture-only mode): stays `[]` / `false`.

## 7. Testing Strategy

### 7.1 `github-policy.test.ts` (new, unit tests, no msw)
- Command type allowlist — 4 supported pass, others reject
- Actor authorization — whitelisted actor passes, non-whitelisted rejects
- Payload validation — missing/invalid fields reject for each command type
- Rate limit — N commands pass, N+1 rejects
- Rate limit window expiry — after 60s, counter resets
- (Policy-absent path covered by adapter test below)

### 7.2 `github-api-client.test.ts` (extend, msw)
- `addComment` success → returns `{commentId, createdAt}`
- `addComment` 404 → throws `GitHubApiError(404)`
- `addLabel` success → void
- `removeLabel` success → void
- `removeLabel` 404 → throws `GitHubApiError(404)`
- `requestReview` success → void
- `requestReview` 422 (invalid reviewer) → throws `GitHubApiError(422)`

### 7.3 `command-gateway.test.ts` (new, msw + adapter integration)
- `execute("issue.add_comment")` success → `status:"accepted"`, `affectedEventIds` non-empty, eventLog contains `ISSUE_COMMENTED`
- `execute("issue.add_label")` success → emits `ISSUE_LABELED`
- `execute("issue.remove_label")` success → emits `ISSUE_UNLABELED`
- `execute("pr.request_review")` success → emits `ARTIFACT_REVIEW_REQUESTED`
- `execute("merge")` (unsupported) → `status:"rejected"`, `code:"UNSUPPORTED_COMMAND"`
- Unconfigured adapter (no apiClient) → `status:"rejected"`, `code:"UNSUPPORTED_COMMAND"`
- Policy rejects → `status:"rejected"`, `code` matches reason
- API 404 → `status:"error"`, `code:"NOT_FOUND"`
- API 401 → `status:"error"`, `code:"UNAUTHORIZED"`
- Success updates evidence (comments/labels/reviewers)
- Success → `getSnapshot()` replay produces no reducer errors

### 7.4 `core.test.ts` (extend)
- `ISSUE_COMMENTED` reducer — event passes through, no snapshot mutation, no error
- `ISSUE_LABELED` reducer — event passes through, no snapshot mutation, no error
- `ISSUE_UNLABELED` reducer — event passes through, no snapshot mutation, no error

**Existing tests stay green** — no modifications to projection/determinism/label-mapping/destructive-guard/sync-from-api/sync-incremental/scheduler tests.

## 8. Acceptance Criteria Mapping

| AC | Coverage |
|---|---|
| issue.add_comment 成功 → 发射 issue.commented 事件 | §6.3 executeAddComment + §7.3 test |
| issue.add_label / issue.remove_label 成功 → 发射 issue.labeled / issue.unlabeled | §6.3 + §7.3 |
| pr.request_review 成功 → 发射 pr.review_requested | §6.3 + §7.3 (reuses ARTIFACT_REVIEW_REQUESTED) |
| 所有命令经过 Policy 校验（权限、参数、rate limit） | §5 GitHubPolicy + §7.1 |
| 危险命令继续返回 UNSUPPORTED_COMMAND | §6.2 default branch + §7.3 test |
| GitHub API 错误（401/403/404/422）正确映射 | §6.4 mapApiError + §7.2 + §7.3 |
| rate limit 不足时拒绝命令 | §5.1 check 4 + §7.1 |
| 测试覆盖：成功路径、Policy 拒绝、API 错误、rate limit | §7 |
| CI 通过 | npm ci + npm test + npm run build |
| 文档更新 | §9 |

## 9. File List

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

**13 files**, 3 new (github-policy.ts + 2 test files).

## 10. v0 Exclusions

- **Dangerous operations**: merge / close / delete / force-push continue returning `UNSUPPORTED_COMMAND`, deferred to Phase 2.5
- **Approval flow**: no human-in-the-loop approval before command execution (Phase 2.5 or later)
- **Multi-repo**: adapter holds a single `{owner, repo}`, no runtime switching
- **GitHub rate_limit query**: Policy does not call `/rate_limit` API, only local counter
- **Retry / backoff**: API failure does not auto-retry, returns error CommandResult directly
- **Concurrency lock**: `execute()` has no concurrency guard (YAGNI, single-runtime serial assumption)
- **Event rollback**: if API succeeds but emit fails, no rollback of GitHub operation (emit is in-memory, cannot fail)
- **Webhook verification**: does not verify command source is a real GitHub webhook
- **Comment author authenticity**: emitted `author` uses `command.actorId` (office-side actor), not the GitHub API-returned user
- **Label color**: `addLabel` sends label name only; GitHub assigns default color
- **Reducer snapshot mutation**: ISSUE_COMMENTED / ISSUE_LABELED / ISSUE_UNLABELED are event-trail-only no-ops on `TaskSnapshot` (which has no `labels`/`comments` field); evidence is tracked in `GitHubAdapterEvidence` only
