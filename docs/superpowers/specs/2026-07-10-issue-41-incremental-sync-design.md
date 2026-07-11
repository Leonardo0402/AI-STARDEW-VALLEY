# Phase 2.3: Incremental Sync Reliability — Design Spec

**Issue:** #41
**Branch:** (to be created) `feat/github-incremental-sync-issue-41`
**Date:** 2026-07-10
**Depends on:** Phase 2.2 (PR #40, merged) — `GitHubApiClient` + `syncFromApi`

## 1. Overview

Phase 2.2 delivered full-sync (`syncFromApi`) that fetches all issues + PRs and re-emits the complete event log on every call. Phase 2.3 upgrades the adapter to **incremental sync**: only fetch entities changed since the last sync, and only emit events for actual state transitions — not the full lifecycle on every poll.

Three new capabilities:
1. **Cursor-based incremental fetch** (`fetchSince` methods on `GitHubApiClient`)
2. **Entity-level delta emit** (`syncIncremental` on `GitHubRuntimeAdapter` — keeps eventLog, emits only state-transition events)
3. **Polling daemon with resync** (`GitHubSyncScheduler` — configurable interval, failure → full resync)

## 2. Architecture

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│ GitHubSyncScheduler │ ───→ │ GitHubRuntimeAdapter │ ───→ │  SnapshotStore      │
│ (polling daemon)    │      │ (delta emit + cursor)│      │  (dedup, downstream) │
└─────────┬───────────┘      └─────────┬────────────┘      └─────────────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────┐      ┌──────────────────────┐
│ GitHubApiClient     │      │ in-memory cursor     │
│ (fetchSince + full) │      │ lastUpdatedAt: string │
└─────────────────────┘      └──────────────────────┘
```

**Layer separation:**
- **`GitHubApiClient`** (stateless HTTP) — adds `fetchIssuesSince` / `fetchPRsSince`
- **`GitHubRuntimeAdapter`** (stateful projection) — adds `syncIncremental` + private cursor + delta emit logic
- **`GitHubSyncScheduler`** (polling daemon) — owns the interval, drives syncIncremental, triggers resync on failure

**Key invariants:**
- Adapter stays passive — it does not know about polling, only exposes `syncIncremental` + `syncFromApi`
- Cursor is adapter-private in-memory state (no persistence)
- Full resync reuses the existing destructive `syncFromFixtures` path (wipe + re-emit all)
- Downstream dedup relies on stable eventId format `evt-gh-${seq}-${kind}-${number}`

## 3. API Client Extensions

File: `packages/adapters/github/src/github-api-client.ts`

### 3.1 `fetchIssuesSince(owner, repo, since)`

GitHub issues endpoint natively supports the `since` query parameter:

```
GET /repos/{owner}/{repo}/issues?state=all&per_page=100&since={ISO8601}
```

- Returns issues with `updated_at > since`
- Reuses existing `paginate()` + `fetchComments()` + `mapIssue()` — no new pagination/mapping logic
- Reuses existing `rawGet()` rate-limit / error / auth handling
- **Empty `since` ("")** → fallback to `fetchIssues(owner, repo)` full fetch (avoids GitHub returning all data when `since` is empty)

### 3.2 `fetchPRsSince(owner, repo, since)`

GitHub pulls endpoint does **not** support `since`. Strategy: sort by `updated_at` desc + early termination:

```
GET /repos/{owner}/{repo}/pulls?state=all&per_page=100&sort=updated&direction=desc
```

- Paginate descending by `updated_at`
- **Early stop:** when a PR with `updated_at <= since` is encountered, stop paginating; all prior PRs in the result set are the increment
- **Empty `since` ("")** → fallback to `fetchPRs(owner, repo)` full fetch
- Reuses existing `fetchReviews()` + `fetchComments()` + `mapPR()`

**Why `sort=updated&direction=desc` instead of `sort=created`:** updated-sort enables the `updated_at <= since` early-stop; created-sort cannot (an old PR may have just been updated).

### 3.3 Public surface

```typescript
class GitHubApiClient {
  // existing
  fetchIssues(owner: string, repo: string): Promise<GitHubIssueFixture[]>;
  fetchPRs(owner: string, repo: string): Promise<GitHubPRFixture[]>;

  // new (Phase 2.3)
  fetchIssuesSince(owner: string, repo: string, since: string): Promise<GitHubIssueFixture[]>;
  fetchPRsSince(owner: string, repo: string, since: string): Promise<GitHubPRFixture[]>;
}
```

## 4. Adapter Delta Emit

File: `packages/adapters/github/src/github-adapter.ts`

### 4.1 New private state

```typescript
private lastUpdatedAt: string = "";  // cursor; empty = first sync / after resync
```

### 4.2 `syncIncremental(client, owner, repo)`

```typescript
async syncIncremental(client: GitHubApiClient, owner: string, repo: string): Promise<void>
```

**Flow:**
1. If `this.lastUpdatedAt === ""` → call `syncFromApi(client, owner, repo)` (full first sync), then set cursor and return
2. Else: fetch increments via `client.fetchIssuesSince(owner, repo, this.lastUpdatedAt)` + `client.fetchPRsSince(owner, repo, this.lastUpdatedAt)` (parallel `Promise.all`)
3. For each entity, run diff (§4.3)
4. Update cursor: `this.lastUpdatedAt = max(updated_at of all fetched entities)`; if no entities fetched, cursor unchanged

**Critical: does NOT clear eventLog / evidence / sequence.** This is the incremental path; history is preserved.

### 4.3 Diff rules (entity-level delta emit)

For each fetched entity, compare against existing evidence entry (`this.evidence.tasks[id]` / `this.evidence.artifacts[id]`):

| Entity state change | Action | Events emitted |
|---|---|---|
| **New issue** (evidence has no such number) | `processIssue(fixture)` (full lifecycle) | `task.created` + maybe `task.blocked` |
| **New PR** (evidence has no such number) | `processPR(fixture)` (full lifecycle) | `task.created` + `artifact.created` + maybe review events |
| **issue open→closed** (`stateReason=completed`) | `emitIssueDelta` | `task.completed` |
| **issue open→closed** (`stateReason=not_planned`) | `emitIssueDelta` | `task.completed` (reason=not_planned) |
| **issue closed→reopened** | `emitIssueDelta` | **No event** (v0 — `task.reopened` EventType does not exist in protocol; see §4.4) |
| **PR open→merged** | `emitPRDelta` | `artifact.delivered` + `task.completed` |
| **PR open→closed-unmerged** | `emitPRDelta` | `artifact.closed` + `task.completed` |
| **No change** (rawState + stateReason identical) | skip | none |
| **Label/assignee/review changed but state unchanged** | update evidence only | none (v0 simplification — avoids new EventTypes) |

### 4.4 Reopened issue handling (v0 boundary)

The protocol's `EventType` enum ([protocol/src/index.ts:328-346](file:///e:/agent/AI%20STARDEW%20VALLEY/packages/protocol/src/index.ts#L328-346)) has no `task.reopened`. For Phase 2.3:
- A reopened issue updates evidence to reflect `state: "open"` + `stateReason: undefined`
- **No event is emitted** (cannot represent the transition without a new EventType)
- The issue will appear as `open` in `getSnapshot()` — but since no `task.created` was re-emitted, the downstream snapshot retains the prior `completed` state
- **Known limitation:** a reopened issue's `task` entity in `getSnapshot()` retains its prior `completed` state (no event to flip it back to `open`). The evidence entry IS updated to `state: "open"`, so the next diff baseline is correct — but the projection shows stale state until a full resync (which re-emits `task.created` with `state: "open"`). Documented as v0 limitation. Phase 2.4 may add `TASK_REOPENED` EventType.

### 4.5 Evidence update

After emitting delta events, `syncIncremental` **replaces** the corresponding evidence entry with the new fixture's data (labels, assignees, comments, reviews fully replaced). This ensures the next diff baseline is correct.

### 4.6 New private methods

- `emitIssueDelta(oldEvidence: GitHubSourceRef, newFixture: GitHubIssueFixture): void`
- `emitPRDelta(oldEvidence: GitHubSourceRef, newFixture: GitHubPRFixture): void`

These methods inspect the state transition and emit only the delta events (per §4.3 table). They do NOT call `processIssue`/`processPR` (which emit full lifecycles).

### 4.7 EventId stability

Incremental events use the existing `evt-gh-${seq}-${kind}-${number}` format where `seq` continues incrementing from the current `this.sequence` value (never reused). Because seq is monotonically increasing, incremental event IDs never collide with historical ones, and downstream `SnapshotStore` dedup by eventId works naturally.

### 4.8 `rebuildFromLog` decision

Issue #41 mentions "existing rebuildFromLog already verified," but that method lives on `SnapshotStore` ([core/src/store.ts](file:///e:/agent/AI%20STARDEW%20VALLEY/packages/core/src/store.ts)), not on the adapter. **The adapter does NOT add `rebuildFromLog`.** Phase 2.3 only verifies that `getSnapshot()` (which inlines replay) works correctly on an incremental eventLog — asserted via `getLastReplayErrors()` returning empty.

## 5. GitHubSyncScheduler

New file: `packages/adapters/github/src/github-sync-scheduler.ts`

### 5.1 Interface

```typescript
export interface GitHubSyncSchedulerOptions {
  intervalMs?: number;   // default 60000
  owner: string;
  repo: string;
}

export interface GitHubSyncSchedulerCallbacks {
  onSyncSuccess?(timestamp: string): void;
  onSyncFailure?(error: Error, willResync: boolean): void;
  onResync?(): void;
}

export class GitHubSyncScheduler {
  constructor(
    adapter: GitHubRuntimeAdapter,
    client: GitHubApiClient,
    options: GitHubSyncSchedulerOptions,
    callbacks?: GitHubSyncSchedulerCallbacks,
  );
  start(): void;
  stop(): void;
  syncOnce(): Promise<void>;
  isRunning(): boolean;
}
```

### 5.2 Behavior

**`start()`:**
- If already running → no-op
- Immediately call `syncOnce()` (don't wait for first interval)
- `setInterval(() => this.syncOnce(), intervalMs)`

**`syncOnce()`:**
```
if (lastSyncFailed):
  await adapter.syncFromApi(client, owner, repo)  // full resync, destructive reset
  adapter.resetCursor()                            // private method; sets lastUpdatedAt = ""
  lastSyncFailed = false
  callbacks.onResync?()
else:
  try:
    await adapter.syncIncremental(client, owner, repo)
    callbacks.onSyncSuccess?(adapter.getCursor())
  catch (err):
    lastSyncFailed = true
    callbacks.onSyncFailure?(err, true)  // willResync = true
```

**`stop()`:**
- `clearInterval(timer)`
- Does NOT reset cursor / lastSyncFailed — next `start()` resumes from prior state (matches "interrupt recovery" semantics)

### 5.3 Resync trigger

Single trigger: `lastSyncFailed === true` at next `syncOnce()` invocation.
1. `syncIncremental` throws (network / rate-limit / 5xx) → `lastSyncFailed = true`
2. Next `syncOnce` detects → calls `syncFromApi` (full)

**Does NOT trigger resync:**
- `syncIncremental` succeeds with empty result (no changes) → normal, cursor unchanged
- `syncIncremental` succeeds with 0 events emitted → normal

**Resync also fails:** `onSyncFailure(err, false)`, `lastSyncFailed` stays `true`, next `syncOnce` retries resync.

### 5.4 Adapter additions for scheduler

The scheduler needs to read/reset the cursor. Add minimal public accessors on the adapter:
```typescript
getCursor(): string { return this.lastUpdatedAt; }
resetCursor(): void { this.lastUpdatedAt = ""; }
```

### 5.5 Non-goals (YAGNI)

- No cron expressions — fixed interval in ms
- No concurrency lock — `setInterval` doesn't await; v0 assumes sync completes within interval. Overruns handled by resync fallback.
- No backoff — failed sync retries at next interval; resync is the safety net

## 6. Error Handling Matrix

| Error | Source | Behavior | Resync? |
|---|---|---|---|
| Network interruption (fetch reject) | `rawGet` | `syncIncremental` throws → scheduler sets `lastSyncFailed` | Next `syncOnce` |
| Rate limit reset > 60s | `waitForRateLimit` | `GitHubApiError` thrown → same | Next `syncOnce` |
| HTTP 401/403/404 | `rawGet` | `GitHubApiError` thrown → same | Next `syncOnce` |
| HTTP 5xx | `rawGet` | `GitHubApiError` thrown → same | Next `syncOnce` |
| `syncIncremental` internal diff error | adapter | Bubbles to scheduler → same | Next `syncOnce` |
| Full resync also fails | `syncFromApi` | `onSyncFailure(err, false)`, `lastSyncFailed` stays `true` | Next `syncOnce` retries resync |

**Key semantic:** cursor only advances on `syncIncremental` **complete success**. Any failure → cursor unchanged → next sync retries from same point / resyncs.

## 7. Testing Strategy

### 7.1 API client layer (`github-api-client.test.ts` extension, msw)

- `fetchIssuesSince` returns only issues with `updated_at > since`
- `fetchIssuesSince` with empty string → equivalent to `fetchIssues` full fetch
- `fetchPRsSince` returns PRs sorted by `updated_at` desc, stops at early-termination boundary
- `fetchPRsSince` with empty string → equivalent to `fetchPRs` full fetch

### 7.2 Adapter layer (`sync-incremental.test.ts` new, msw)

- First `syncIncremental` (empty cursor) → fallback to full `syncFromApi`
- New issue → emits `task.created`, evidence updated, cursor advances
- Issue open→closed → emits only `task.completed` (no re-emit of `task.created`)
- PR open→merged → emits `artifact.delivered` + `task.completed`
- Unchanged entity → no emit, cursor unchanged
- Delta eventLog → `getSnapshot()` → `getLastReplayErrors()` empty
- Incremental after incremental → multi-round cursor advances correctly

### 7.3 Scheduler layer (`github-sync-scheduler.test.ts` new, fake timers)

- `start` → immediate `syncOnce`, then interval triggers
- `stop` → clearInterval, `isRunning === false`
- `syncIncremental` throws → `onSyncFailure(err, true)`, `lastSyncFailed = true`
- Next `syncOnce` (lastSyncFailed) → calls `syncFromApi`, `onResync`, `lastSyncFailed = false`
- Resync also fails → `onSyncFailure(err, false)`, `lastSyncFailed` stays true

### 7.4 Not testing

- Auth/pagination/error handling (Phase 2.2 covered)
- Real GitHub API (msw suffices)

## 8. Acceptance Criteria Mapping

| AC (Issue #41) | Implementation |
|---|---|
| Cursor (lastUpdatedAt) | Adapter private field, `syncIncremental` advances |
| ETag | **Excluded (v0)** — §10 explicit exclusion |
| Configurable interval, default 60s | `GitHubSyncSchedulerOptions.intervalMs` default 60000 |
| Reuse existing dedup | Stable eventId format + downstream SnapshotStore dedup (adapter itself doesn't dedup) |
| Gap detection → full syncFromApi fallback | `lastSyncFailed` → next `syncOnce` → `syncFromApi` |
| Network interruption recovery, no lost events | Cursor only advances on success; failure → resync rebuilds from scratch |
| rebuildFromLog | Adapter doesn't add it; verify `getSnapshot()` replays incremental eventLog correctly |
| Projection consistency | Delta eventLog → `getSnapshot()` → `getLastReplayErrors()` empty |
| Tests | Three-layer tests (§7) with msw + fake timers |
| Documentation | Update README + v0-limitations + api-client.md |

## 9. Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/adapters/github/src/github-api-client.ts` | Modify | Add `fetchIssuesSince` + `fetchPRsSince` |
| `packages/adapters/github/src/github-api-client.test.ts` | Modify | Add `fetchSince` tests |
| `packages/adapters/github/src/github-adapter.ts` | Modify | Add `syncIncremental` + cursor + delta emit + `getCursor`/`resetCursor` |
| `packages/adapters/github/src/sync-incremental.test.ts` | Create | Adapter delta emit tests |
| `packages/adapters/github/src/github-sync-scheduler.ts` | Create | New scheduler class |
| `packages/adapters/github/src/github-sync-scheduler.test.ts` | Create | Scheduler tests |
| `packages/adapters/github/src/index.ts` | Modify | Export `GitHubSyncScheduler` + types |
| `docs/integrations/github-adapter/README.md` | Modify | Add incremental sync usage |
| `docs/integrations/github-adapter/v0-limitations.md` | Modify | Add Phase 2.3 limitations |
| `docs/integrations/github-adapter/api-client.md` | Modify | Document `fetchSince` methods |

## 10. Explicit v0 Exclusions

- **ETag / 304 fast path** — Approach A choice; leaves ~1 HTTP request per poll even when nothing changed. Acceptable at 60s default interval (~1440 req/day, well under 5000/hr limit).
- **Webhook / SSE real-time push** — Phase 2.3 remains polling.
- **Cross-process cursor persistence** — In-memory only; restart → first sync is full fetch.
- **Incremental events for label/assignee/review changes** — v0 only emits state transitions; non-state changes update evidence silently.
- **`task.reopened` EventType** — Protocol doesn't have it; reopened issues don't emit an event in v0 (known snapshot staleness until resync).
- **Concurrency lock on scheduler** — `setInterval` not awaited; v0 assumes sync < interval; overruns handled by resync.
- **Backoff on failure** — Retries at next fixed interval; resync is the safety net.
