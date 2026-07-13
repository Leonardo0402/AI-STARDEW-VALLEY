# Issue #47 — Phase 2.6: Agent Review Loop — Design Spec

> **Status:** Approved (all 8 design sections reviewed and confirmed by user)
> **Date:** 2026-07-12
> **Branch:** `feat/github-agent-review-loop-issue-47`
> **Refs:** #45 (reuses draft pattern), #43 (Command Gateway), #41 (Incremental Sync)

## Context

Phase 2.5 completed Safe GitHub Actions — 5 operations (issue.draft / comment.draft / draft.submit / draft.discard / audit_note) establishing a safe GitHub write path. Phase 2.6 introduces Agent Review Loop: AI Agents participate in code review but have no final merge authority.

Current baseline:
- GitHub adapter supports read sync + 9 safe write commands
- Policy validation (actor + rate limit + payload)
- Draft mechanism (local storage, submit-time execution)
- audit_note audit trail
- 818/818 tests passing

## Goal

Build an Agent Review Loop where AI Agents can be assigned review tasks, produce structured review verdicts, and all review results require Human-in-the-loop approval before taking effect.

## Architecture

The Agent Review Loop lives in `packages/core/` as a component layer above adapters. `AgentReviewOrchestrator` wraps a `RuntimeAdapter` (decorator pattern), intercepts 4 review commands, manages review state (assignments + drafts), and delegates event emission to the wrapped adapter. The adapter gets 3 new trivial handlers that emit events — no complex state on the adapter side.

## §1 — Protocol Changes

### 4 New CommandTypes

| Command | Payload | Issuer | Description |
|---------|---------|--------|-------------|
| `REVIEW_ASSIGN` | `ReviewAssignPayload` | user/system | Assigns agent to review a PR/Issue |
| `REVIEW_SUBMIT` | `ReviewSubmitPayload` | agent (actorId = agent) | Agent submits verdict as draft |
| `REVIEW_APPROVE` | `ReviewApprovePayload` | human (actorId = user) | Human approves the draft |
| `REVIEW_REJECT` | `ReviewRejectPayload` | human (actorId = user) | Human rejects the draft |

### 1 Internal CommandType (orchestrator → adapter, not user-facing)

`REVIEW_FINALIZE` — sent by orchestrator to adapter when human approves. Decouples orchestrator state from adapter event emission. Adapter maps `targetKind/targetNumber` to `artifactId` and emits `ARTIFACT_REVIEWED`.

### 2 New EventTypes

| Event | Payload | Emitted On |
|-------|---------|-------------|
| `REVIEW_ASSIGNED` | `ReviewAssignedPayload` | `REVIEW_ASSIGN` |
| `REVIEW_SUBMITTED` | `ReviewSubmittedPayload` | `REVIEW_SUBMIT` |

Note: `REVIEW_APPROVE` triggers the existing `ARTIFACT_REVIEWED` event (already handled by reducer → task `revision_required` cascade). `REVIEW_REJECT` reuses the existing `AUDIT_NOTE` command for audit trail — no new event.

### Payload Interfaces

```typescript
interface ReviewAssignPayload {
  targetKind: "pr" | "issue";
  targetNumber: number;
  agentId: Id;
}

interface ReviewSubmitPayload {
  reviewId: Id;
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
}

interface ReviewApprovePayload {
  reviewId: Id;
}

interface ReviewRejectPayload {
  reviewId: Id;
  reason: string;
}

// Internal (orchestrator → adapter):
interface ReviewFinalizePayload {
  targetKind: "pr" | "issue";
  targetNumber: number;
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
  reviewerId: Id;
}

interface ReviewAssignedPayload {
  reviewId: Id;
  targetKind: "pr" | "issue";
  targetNumber: number;
  agentId: Id;
  assignedAt: string;
}

interface ReviewSubmittedPayload {
  reviewId: Id;
  agentId: Id;
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
  submittedAt: string;
}
```

### Reducer

`REVIEW_ASSIGNED` and `REVIEW_SUBMITTED` are no-ops (event-trail only, same as `ISSUE_COMMENTED`). `ARTIFACT_REVIEWED` is already handled by the reducer (sets `artifact.reviewResult`, triggers task status cascade).

### Review ID Generation

Adapter generates `reviewId` (like `draftId` in Phase 2.5) and returns it in `CommandResult.affectedEventIds`. Orchestrator extracts and stores it.

## §2 — AgentReviewOrchestrator Design

**Location:** `packages/core/src/agent-review-orchestrator.ts` — core component, adapter-agnostic.

**Decorator pattern:** Wraps a `RuntimeAdapter`. Intercepts 4 review commands before dispatch; delegates all other commands directly to the wrapped adapter.

```typescript
export class AgentReviewOrchestrator implements RuntimeAdapter {
  private assignedReviews = new Map<Id, ReviewAssignment>();
  private submittedReviews = new Map<Id, ReviewDraft>();
  readonly strategy: ReviewStrategy;

  constructor(
    private readonly inner: RuntimeAdapter,
    private readonly options: OrchestratorOptions
  ) { this.strategy = options.strategy ?? new RuleBasedReviewStrategy(); }
}
```

### State Structures (orchestrator-internal)

```typescript
interface ReviewAssignment {
  reviewId: Id;
  targetKind: "pr" | "issue";
  targetNumber: number;
  agentId: Id;
  assignedAt: string;
}

interface ReviewDraft {
  reviewId: Id;
  agentId: Id;
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
  targetKind: "pr" | "issue";
  targetNumber: number;
  submittedAt: string;
}
```

### Dispatch Logic

```typescript
async execute(command: OfficeCommand): Promise<CommandResult> {
  switch (command.commandType) {
    case CommandType.REVIEW_ASSIGN:    return this.executeReviewAssign(command);
    case CommandType.REVIEW_SUBMIT:    return this.executeReviewSubmit(command);
    case CommandType.REVIEW_APPROVE:   return this.executeReviewApprove(command);
    case CommandType.REVIEW_REJECT:    return this.executeReviewReject(command);
    default:                           return this.inner.execute(command);
  }
}
```

### REVIEW_ASSIGN Flow

1. Validate payload (`targetKind/targetNumber/agentId` non-empty)
2. Delegate to `inner.execute(REVIEW_ASSIGN)` — adapter generates `reviewId` and emits `REVIEW_ASSIGNED`
3. Extract `reviewId` from `result.affectedEventIds[0]`
4. Store `ReviewAssignment` in `assignedReviews`
5. Return `result`

### REVIEW_SUBMIT Flow

1. Lookup `assignedReviews.get(reviewId)` — if missing → `NOT_FOUND` error
2. Validate `command.actorId === assignment.agentId` — if mismatch → `FORBIDDEN`
3. Delegate to `inner.execute(REVIEW_SUBMIT)` — adapter emits `REVIEW_SUBMITTED`
4. Copy `targetKind/targetNumber` from assignment
5. Store as `ReviewDraft` in `submittedReviews`
6. Return `result`

### REVIEW_APPROVE Flow

1. Lookup `submittedReviews.get(reviewId)` — if missing → `NOT_FOUND`
2. Construct internal `REVIEW_FINALIZE` command (source = "system")
3. Delegate to `inner.execute(REVIEW_FINALIZE)` — adapter emits `ARTIFACT_REVIEWED`
4. Delete review from both maps (finalized)
5. Emit `AUDIT_NOTE` for audit trail (via inner delegation)
6. Return `result`

### REVIEW_REJECT Flow

1. Lookup `submittedReviews.get(reviewId)` — if missing → `NOT_FOUND`
2. Delete from `submittedReviews` (draft discarded)
3. Also delete from `assignedReviews` if present
4. Emit `AUDIT_NOTE` recording rejection (with `reason`)
5. Return `accepted`

### Orchestrator Public Methods

```typescript
getAssignedReviews(): ReviewAssignment[]
getSubmittedReviews(): ReviewDraft[]
getReviewDraft(reviewId: Id): ReviewDraft | undefined
```

### Other RuntimeAdapter Methods (pass-through)

`connect/disconnect/syncFromFixtures/syncFromApi/getSnapshot/getEventLog/getCapabilities` — proxy to inner. `getCapabilities()` adds the 4 review commands to the inner's supported commands. Audit trail via inner's `AUDIT_NOTE` command.

### Design Points

- Review IDs generated by adapter (like Phase 2.5's `draftId`), orchestrator extracts from `affectedEventIds`
- `ReviewStrategy` interface held by orchestrator but NOT called inside orchestrator — caller (or future Phase 3 LLM driver) generates verdict via `strategy.review(snapshot, target)` before constructing `REVIEW_SUBMIT` command
- Orchestrator does not touch `this.sequence` or adapter internal state
- Human approve/reject distinguished by `actorId` (not agent)

## §3 — Adapter Extension (GitHub adapter +3 handlers)

**File:** `packages/adapters/github/src/github-adapter.ts`

3 new internal command handlers. `REVIEW_FINALIZE` is an orchestrator-internal command (not user-facing) but also goes through `execute()` dispatch.

### 3.1 New Handler Methods

**executeReviewAssign** (assign review task)

```typescript
private async executeReviewAssign(command: OfficeCommand<ReviewAssignPayload>): Promise<Id> {
  const reviewId = `review-${++this.reviewCounter}`;
  const assignedAt = new Date().toISOString();
  this.emit(EventType.REVIEW_ASSIGNED, {
    reviewId,
    targetKind: command.payload.targetKind,
    targetNumber: command.payload.targetNumber,
    agentId: command.payload.agentId,
    assignedAt,
  }, command.payload.targetKind, command.payload.targetNumber, assignedAt);
  return reviewId;
}
```

**executeReviewSubmit** (agent submits review result)

```typescript
private async executeReviewSubmit(command: OfficeCommand<ReviewSubmitPayload>): Promise<Id> {
  const submittedAt = new Date().toISOString();
  this.emit(EventType.REVIEW_SUBMITTED, {
    reviewId: command.payload.reviewId,
    agentId: command.actorId,
    verdict: command.payload.verdict,
    comment: command.payload.comment,
    submittedAt,
  }, "issue", 0, submittedAt);  // sentinel — orchestrator holds targetKind/targetNumber
  return command.payload.reviewId;
}
```

**executeReviewFinalize** (orchestrator internal → emits `ARTIFACT_REVIEWED`)

```typescript
private async executeReviewFinalize(command: OfficeCommand<ReviewFinalizePayload>): Promise<Id> {
  const artifactId: Id = `gh-${command.payload.targetKind}-${command.payload.targetNumber}`;
  const reviewedAt = new Date().toISOString();
  this.emit(EventType.ARTIFACT_REVIEWED, {
    artifactId,
    reviewerId: command.payload.reviewerId,
    verdict: command.payload.verdict,
    comment: command.payload.comment,
  }, command.payload.targetKind, command.payload.targetNumber, reviewedAt);
  return artifactId;
}
```

### 3.2 Class Field

```typescript
private reviewCounter = 0;
```

Reset in `syncFromFixtures` (alongside `draftCounter`).

### 3.3 execute() Dispatch Switch Extension

3 new cases (after `AUDIT_NOTE`, before `default`):

```typescript
case CommandType.REVIEW_ASSIGN:    return this.executeReviewAssign(command);
case CommandType.REVIEW_SUBMIT:    return this.executeReviewSubmit(command);
case CommandType.REVIEW_FINALIZE:  return this.executeReviewFinalize(command);
```

### 3.4 emit() Signature

`REVIEW_SUBMITTED` uses `"issue"/0` sentinel (same pattern as `AUDIT_NOTE_ADDED` in Phase 2.5). Does NOT modify `emit()` signature — keeps Issue scope minimal.

### 3.5 getCapabilities() Update

```typescript
const alwaysSupported = [
  CommandType.ISSUE_DRAFT,
  CommandType.COMMENT_DRAFT,
  CommandType.DRAFT_DISCARD,
  CommandType.AUDIT_NOTE,
  CommandType.REVIEW_ASSIGN,      // new — pure local
  CommandType.REVIEW_SUBMIT,      // new — pure local
  CommandType.REVIEW_FINALIZE,    // new — pure local
];
```

3 new commands are all pure-local (no GitHub API call), work even when unconfigured. `COMMANDS_REQUIRING_API` unchanged (does not contain review commands).

### 3.6 Policy Extension

`GitHubPolicy.supported` array adds 3 commands:

```typescript
CommandType.REVIEW_ASSIGN,
CommandType.REVIEW_SUBMIT,
CommandType.REVIEW_FINALIZE,
```

`validatePayload` adds 3 cases:

- `REVIEW_ASSIGN`: `targetKind ∈ {"pr", "issue"}`, `targetNumber > 0`, `agentId` non-empty
- `REVIEW_SUBMIT`: `reviewId` non-empty, `verdict ∈ {"approved", "revision_required", "rejected"}`, `comment` non-empty
- `REVIEW_FINALIZE`: `targetKind/targetNumber/verdict/comment/reviewerId` all validated

Note: `REVIEW_APPROVE` and `REVIEW_REJECT` do not go through adapter (orchestrator handles internally), do not need adapter policy registration.

## §4 — ReviewStrategy Interface + Rule-based stub

**Location:** `packages/core/src/review-strategy.ts` — same package as orchestrator, separate file.

### 4.1 Strategy Interface

```typescript
export interface ReviewContext {
  targetKind: "pr" | "issue";
  targetNumber: number;
  artifact?: ArtifactSnapshot;
  evidence?: GitHubAdapterEvidence;
}

export interface ReviewResult {
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
}

export interface ReviewStrategy {
  review(ctx: ReviewContext): ReviewResult;
}
```

Pure function interface — no side effects, no async, no I/O. Phase 3's LLM implementation will replace with async interface, but Phase 2.6 stays sync.

### 4.2 RuleBasedReviewStrategy (default implementation)

```typescript
export class RuleBasedReviewStrategy implements ReviewStrategy {
  review(ctx: ReviewContext): ReviewResult {
    // Rule 1: artifact not found → rejected
    if (!ctx.artifact) {
      return {
        verdict: "rejected",
        comment: `Cannot review ${ctx.targetKind} #${ctx.targetNumber}: artifact not found in snapshot.`
      };
    }

    // Rule 2: artifact rejected → revision_required
    if (ctx.artifact.status === "rejected") {
      return {
        verdict: "revision_required",
        comment: `Artifact ${ctx.artifact.artifactId} was previously rejected; revision required before approval.`
      };
    }

    // Rule 3: artifact approved → approved (idempotent)
    if (ctx.artifact.status === "approved") {
      return {
        verdict: "approved",
        comment: `Artifact ${ctx.artifact.artifactId} already approved.`
      };
    }

    // Rule 4: artifact draft → revision_required
    if (ctx.artifact.status === "draft") {
      return {
        verdict: "revision_required",
        comment: `Artifact ${ctx.artifact.artifactId} is still in draft; complete work before requesting review.`
      };
    }

    // Default: approved (generated / under_review / revision_required / delivered)
    return {
      verdict: "approved",
      comment: `Automated review: artifact ${ctx.artifact.artifactId} passed automated checks.`
    };
  }
}
```

### 4.3 Rule Coverage Matrix

| artifact.status | → verdict | Rationale |
|----------------|----------|-----------|
| not found | rejected | Cannot review non-existent target |
| `rejected` | revision_required | Previously rejected, needs revision |
| `approved` | approved | Already approved (idempotent) |
| `draft` | revision_required | Incomplete |
| `generated` / `under_review` / `revision_required` / `delivered` | approved | Default pass |

### 4.4 Usage Pattern

Strategy is NOT called inside orchestrator. Caller (test or future Phase 3 LLM driver) uses it like:

```typescript
const orchestrator = new AgentReviewOrchestrator(adapter, { strategy: new RuleBasedReviewStrategy() });

// 1. Assign
const assignResult = await orchestrator.execute(makeCommand(REVIEW_ASSIGN, "user1", {
  targetKind: "pr", targetNumber: 42, agentId: "agent-reviewer-1"
}));
const reviewId = assignResult.affectedEventIds[0];

// 2. Strategy generates verdict (caller's responsibility)
const snapshot = await orchestrator.getSnapshot();
const ctx = { targetKind: "pr", targetNumber: 42, artifact: findArtifact(snapshot, "pr", 42) };
const result = orchestrator.strategy.review(ctx);

// 3. Agent submits
await orchestrator.execute(makeCommand(REVIEW_SUBMIT, "agent-reviewer-1", {
  reviewId, verdict: result.verdict, comment: result.comment
}));

// 4. Human approves
await orchestrator.execute(makeCommand(REVIEW_APPROVE, "user1", { reviewId }));
```

### Design Points

- Strategy is a pure function, easy to test (no adapter mock needed)
- `ReviewContext.artifact` is optional — stub may not have snapshot access (tests can inject fixture)
- `evidence` is optional — not present for non-GitHub adapters
- All 3 verdict paths covered, tests can verify each path

## §5 — Error Handling

### 5.1 Orchestrator Errors

| Scenario | Error Code | CommandResult.status | Notes |
|----------|-----------|----------------------|-------|
| `REVIEW_SUBMIT` `reviewId` not in `assignedReviews` | `NOT_FOUND` | `error` | Not assigned or already finalized |
| `REVIEW_SUBMIT` `actorId` ≠ `assignment.agentId` | `FORBIDDEN` | `error` | Only assigned agent can submit |
| `REVIEW_APPROVE` `reviewId` not in `submittedReviews` | `NOT_FOUND` | `error` | Not submitted or already finalized |
| `REVIEW_REJECT` `reviewId` not in `submittedReviews` | `NOT_FOUND` | `error` | Same as above |
| `REVIEW_APPROVE` inner adapter `ARTIFACT_REVIEWED` emission fails | passthrough adapter error | `error` | Do not swallow errors |
| Payload validation failure | `INVALID_PAYLOAD` | `rejected` | Orchestrator internal validation |

### 5.2 Error Code Constants

Orchestrator returns `CommandResult.error.code` using string constants:

```typescript
const REVIEW_NOT_FOUND = "NOT_FOUND";
const REVIEW_FORBIDDEN = "FORBIDDEN";
const REVIEW_INVALID_PAYLOAD = "INVALID_PAYLOAD";
```

Reuses existing conventions (`NOT_FOUND`/`FORBIDDEN`/`INVALID_PAYLOAD` consistent with adapter).

### 5.3 Adapter Errors

3 new adapter handlers (`executeReviewAssign`/`executeReviewSubmit`/`executeReviewFinalize`) are all pure-local (no GitHub API call), will not throw `GitHubApiError`. Only possible error is `emit()` internal failure (theoretically won't happen).

### 5.4 Policy Rejection

If `GitHubPolicy` is configured with `allowedActors`, agent must be in whitelist to execute `REVIEW_SUBMIT`. `REVIEW_ASSIGN` and `REVIEW_APPROVE`/`REVIEW_REJECT` typically executed by user, must be in user whitelist.

When policy is unconfigured, all commands pass by default — consistent with Phase 2.5.

### 5.5 Unconfigured Mode

3 new adapter handlers are all pure-local (no API call), work in unconfigured mode. `getCapabilities()` already places them in `alwaysSupported` (§3.5).

`REVIEW_APPROVE` and `REVIEW_REJECT` do not go through adapter (orchestrator handles internally), so not affected by unconfigured mode — review loop fully usable even when adapter is unconfigured.

### 5.6 Idempotency

- `REVIEW_ASSIGN` can be called repeatedly for same target (generates new `reviewId`) — allows multiple review assignments
- `REVIEW_SUBMIT` for same `reviewId` repeated → overwrites `submittedReviews` draft — **acceptable** (agent revising review opinion)
- `REVIEW_SUBMIT` does NOT delete from `assignedReviews` (only copies to `submittedReviews`). Records are only deleted from both maps on `REVIEW_APPROVE`/`REVIEW_REJECT` (finalize)

## §6 — Testing Strategy

### 6.1 ReviewStrategy Tests (`packages/core/src/review-strategy.test.ts`)

5 tests covering all verdict paths:

| # | Test | Input | Expected verdict |
|---|------|------|-----------------|
| 1 | artifact not found | `artifact: undefined` | `rejected` |
| 2 | artifact status = rejected | `status: "rejected"` | `revision_required` |
| 3 | artifact status = approved | `status: "approved"` | `approved` |
| 4 | artifact status = draft | `status: "draft"` | `revision_required` |
| 5 | artifact status = generated | `status: "generated"` | `approved` |

Pure unit tests — no adapter, no mock, directly construct `ReviewContext` and call `strategy.review()`.

### 6.2 Orchestrator Tests (`packages/core/src/agent-review-orchestrator.test.ts`)

Using mock adapter (`packages/adapters/mock`) as inner adapter. ~12 tests:

**Assignment stage:**
1. `REVIEW_ASSIGN` → returns `accepted`, `affectedEventIds[0]` is `reviewId`, `getAssignedReviews()` contains new record
2. `REVIEW_ASSIGN` payload missing → `rejected`, `INVALID_PAYLOAD`

**Submit stage:**
3. `REVIEW_SUBMIT` (not assigned) → `error`, `NOT_FOUND`
4. `REVIEW_SUBMIT` (actorId ≠ agentId) → `error`, `FORBIDDEN`
5. `REVIEW_SUBMIT` (assigned) → `accepted`, `getSubmittedReviews()` contains new draft
6. `REVIEW_SUBMIT` repeated (same reviewId) → overwrites draft, `accepted`

**Approval stage:**
7. `REVIEW_APPROVE` (not submitted) → `error`, `NOT_FOUND`
8. `REVIEW_APPROVE` (submitted) → `accepted`, inner adapter receives `REVIEW_FINALIZE` command, both maps cleared
9. `REVIEW_APPROVE` after `REVIEW_APPROVE` → `NOT_FOUND` (already finalized)

**Rejection stage:**
10. `REVIEW_REJECT` (not submitted) → `error`, `NOT_FOUND`
11. `REVIEW_REJECT` (submitted) → `accepted`, `submittedReviews` deleted, `AUDIT_NOTE` via inner adapter

**Pass-through:**
12. Non-review command (e.g. `TASK_CREATE`) → directly delegated to inner adapter, orchestrator does not intercept

### 6.3 Adapter Integration Tests (`packages/adapters/github/src/command-gateway.test.ts`)

~6 tests, using existing MSW + configured adapter:

1. `REVIEW_ASSIGN` → emits `REVIEW_ASSIGNED` event, payload contains `reviewId`/`agentId`/`targetKind`/`targetNumber`
2. `REVIEW_SUBMIT` → emits `REVIEW_SUBMITTED` event, payload contains `verdict`/`comment`/`agentId` (from `actorId`)
3. `REVIEW_FINALIZE` → emits `ARTIFACT_REVIEWED` event, `artifactId = gh-pr-42` format
4. Unconfigured mode: 3 commands all work (in `alwaysSupported`)
5. `REVIEW_ASSIGN` + `REVIEW_SUBMIT` + `REVIEW_FINALIZE` full chain → 3 events in order
6. Reducer integration: `REVIEW_FINALIZE` emitted `ARTIFACT_REVIEWED` → snapshot `artifact.reviewResult` set + task status cascade

### 6.4 Policy Tests (`packages/adapters/github/src/github-policy.test.ts`)

~6 tests:

1. `REVIEW_ASSIGN` payload valid → `allowed: true`
2. `REVIEW_ASSIGN` `targetKind` not `pr`/`issue` → `INVALID_PAYLOAD`
3. `REVIEW_SUBMIT` `verdict` invalid value → `INVALID_PAYLOAD`
4. `REVIEW_FINALIZE` payload valid → `allowed: true`
5. `REVIEW_FINALIZE` missing `reviewerId` → `INVALID_PAYLOAD`
6. Actor not in whitelist → `ACTOR_NOT_AUTHORIZED`

### 6.5 Reducer Tests (`packages/core/src/core.test.ts`)

2 new no-op tests:

1. `REVIEW_ASSIGNED` event → snapshot unchanged (no-op, same as `ISSUE_COMMENTED`)
2. `REVIEW_SUBMITTED` event → snapshot unchanged (no-op)

`ARTIFACT_REVIEWED` already has test coverage (pre-Phase 2.4), no new tests.

### 6.6 Mock Adapter Capability Count (`packages/adapters/mock/src/mock-adapter.test.ts`)

Update assertion: commands 16→19 (+3 review), events 22→24 (+2 review events).

### 6.7 Test Total

- Strategy: 5
- Orchestrator: 12
- Adapter integration: 6
- Policy: 6
- Reducer: 2
- Mock counts: 1 (update assertion)
- **Total ~32 new/updated tests**

## §7 — Implementation Sequence (8 TDD tasks)

| Task | Scope | Files | Depends On |
|------|-------|-------|------------|
| 1 | Protocol extension: 4 CommandTypes + 2 EventTypes + 6 Payloads + REVIEW_FINALIZE | `packages/protocol/src/index.ts` | — |
| 2 | Reducer no-op cases for `REVIEW_ASSIGNED` + `REVIEW_SUBMITTED` | `packages/core/src/reducer.ts` + `core.test.ts` | Task 1 |
| 3 | ReviewStrategy interface + RuleBasedReviewStrategy + tests | `packages/core/src/review-strategy.ts` + `.test.ts` | — |
| 4 | GitHubPolicy extension (3 commands + payload validation) + tests | `packages/adapters/github/src/github-policy.ts` + `.test.ts` | Task 1 |
| 5 | GitHub adapter 3 handlers + dispatch + capabilities + reviewCounter | `packages/adapters/github/src/github-adapter.ts` | Task 1 |
| 6 | Adapter integration tests (6) + mock capability count update | `command-gateway.test.ts` + `mock-adapter.test.ts` | Task 5 |
| 7 | AgentReviewOrchestrator implementation + 12 tests | `packages/core/src/agent-review-orchestrator.ts` + `.test.ts` | Task 1-3, 5 |
| 8 | Final verification: `npm test` + `npm run build` | — | All |

**Key dependency:** Task 7 (orchestrator) depends on Task 3 (strategy) and Task 5 (adapter handlers), because orchestrator tests need inner adapter to actually support `REVIEW_ASSIGN`/`REVIEW_SUBMIT`/`REVIEW_FINALIZE`. Tasks 1-6 can be completed independently.

## §8 — Scope Boundary

### In Scope

- 4 new commands + 2 new events + `REVIEW_FINALIZE` internal command
- `AgentReviewOrchestrator` component (core layer, wraps adapter)
- `ReviewStrategy` interface + `RuleBasedReviewStrategy` stub
- 3 adapter handlers (pure local, emit events)
- GitHubPolicy extension (3 commands + payload validation)
- Reducer 2 no-op cases
- Review draft lifecycle: assign → submit → approve/reject
- Human approval gate: approve → `ARTIFACT_REVIEWED`; reject → draft discarded + `AUDIT_NOTE`
- Audit trail: both approve/reject recorded via `AUDIT_NOTE`
- ~32 new tests

### Out of Scope

- Real LLM inference integration (Phase 3 replaces `ReviewStrategy` implementation)
- Agent autonomous merge/close (core safety boundary — Agent has no final authority)
- Multi-agent collaborative review (one agent assigned at a time)
- Complex review workflows (round-robin, escalation, multi-round review history)
- UI integration (Phase 2.7)
- Review result persistence to GitHub (no `addComment`/`createIssue` call — pure local)
- `emit()` signature modification (use `"issue"/0` sentinel, consistent with `AUDIT_NOTE_ADDED`)
- `ArtifactSnapshot.reviewResult` change to list (keep single-value slot — multi-round review tracked via `AUDIT_NOTE`)
- `hardOrchestration` capability (stays `false`, orchestrator is core component, not adapter capability)

### Safety Boundaries

- Agent cannot directly merge/close — only `REVIEW_APPROVE` (human) triggers `ARTIFACT_REVIEWED`, reducer cascade decides task status
- Agent cannot bypass policy — `REVIEW_SUBMIT` goes through `GitHubPolicy` validation (actor + payload + rate limit)
- Agent cannot approve own review — `REVIEW_APPROVE`/`REVIEW_REJECT` `actorId` must be user (orchestrator does not enforce, but policy `allowedActors` can configure)
- Review results do not take effect directly — must go through human approve to emit `ARTIFACT_REVIEWED`

## References

- Issue #45: Phase 2.5 Safe GitHub Actions (draft pattern reused)
- Issue #43: Phase 2.4 Command Gateway (three-layer architecture)
- Issue #41: Phase 2.3 Incremental Sync Reliability
- Spec: `docs/superpowers/specs/2026-07-11-issue-45-safe-github-actions-design.md`
