# Issue #45 — Phase 2.5: Safe GitHub Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 safe GitHub actions (issue.draft / comment.draft / draft.submit / draft.discard / audit_note) with local draft storage and zero-notification audit notes.

**Architecture:** Extend the existing `GitHubRuntimeAdapter` dispatch (Phase 2.4 pattern). Drafts live in an adapter-private `Map<Id, Draft>`; submit triggers real GitHub API calls; audit_note records to local evidence only (no API). 5 new CommandTypes, 2 new EventTypes (`ISSUE_CREATED`, `AUDIT_NOTE_ADDED`), both reducer no-ops.

**Tech Stack:** TypeScript ES2022, vitest, msw (Mock Service Worker), npm workspaces, `npm run build` = `tsc -b`.

## Global Constraints

- TypeScript strict mode; `npm run build` must pass (type checks are part of build).
- No new files for adapter logic — extend existing files (方案 A).
- PowerShell host — no bash heredoc; use `git commit -F <file>` for multi-line messages.
- `ISSUE_CREATED` and `AUDIT_NOTE_ADDED` reducer cases are event-trail-only no-ops (only `break;`).
- `issue.draft` / `comment.draft` / `draft.discard` / `audit_note` do NOT require apiClient (work in unconfigured mode).
- `draft.submit` DOES require apiClient (returns `UNSUPPORTED_COMMAND` when unconfigured).
- Tests live in `packages/adapters/github/src/command-gateway.test.ts`, `github-policy.test.ts`, `github-api-client.test.ts`, and `packages/core/src/core.test.ts`.
- Mock adapter capability count assertions must be updated: commands 11→16, events 20→22.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/protocol/src/index.ts` | Protocol types: +5 CommandType, +2 EventType, +5 CommandPayload, +2 EventPayload |
| `packages/core/src/reducer.ts` | +2 no-op reducer cases (ISSUE_CREATED, AUDIT_NOTE_ADDED) |
| `packages/core/src/core.test.ts` | +2 reducer no-op tests |
| `packages/adapters/github/src/types.ts` | +Draft/DraftKind/IssueDraft/CommentDraft/AuditNote types, evidence.auditNotes |
| `packages/adapters/github/src/github-api-client.ts` | +createIssue method |
| `packages/adapters/github/src/github-api-client.test.ts` | +3 createIssue tests |
| `packages/adapters/github/src/github-policy.ts` | supported +5, payload validation for 5 new commands |
| `packages/adapters/github/src/github-policy.test.ts` | +8 policy tests for new commands |
| `packages/adapters/github/src/github-adapter.ts` | drafts Map, 5 handlers, dispatch switch +5, COMMANDS_REQUIRING_API, getCapabilities, getDraft(s) helpers |
| `packages/adapters/github/src/command-gateway.test.ts` | +12 integration tests |
| `packages/adapters/mock/src/mock-adapter.test.ts` | capability count 11→16, 20→22 |

---

### Task 1: Protocol types extension

**Files:**
- Modify: `packages/protocol/src/index.ts` (after existing `PRRequestReviewPayload` ~line 437, and in `EventType`/`CommandType` const blocks)
- Modify: `packages/adapters/mock/src/mock-adapter.test.ts:75-76`

**Interfaces:**
- Produces: `CommandType.ISSUE_DRAFT`, `CommandType.COMMENT_DRAFT`, `CommandType.DRAFT_SUBMIT`, `CommandType.DRAFT_DISCARD`, `CommandType.AUDIT_NOTE`; `EventType.ISSUE_CREATED`, `EventType.AUDIT_NOTE_ADDED`; payloads `IssueDraftPayload`, `CommentDraftPayload`, `DraftSubmitPayload`, `DraftDiscardPayload`, `AuditNotePayload`, `IssueCreatedPayload`, `AuditNoteAddedPayload`.

- [ ] **Step 1: Add 5 new CommandPayload interfaces**

In `packages/protocol/src/index.ts`, after the `PRRequestReviewPayload` interface (around line 437), add:

```typescript
export interface IssueDraftPayload {
  title: string;
  body: string;
}

export interface CommentDraftPayload {
  issueNumber: number;
  body: string;
}

export interface DraftSubmitPayload {
  draftId: Id;
}

export interface DraftDiscardPayload {
  draftId: Id;
}

export interface AuditNotePayload {
  taskId?: Id;
  body: string;
}
```

- [ ] **Step 2: Add 2 new EventPayload interfaces**

In `packages/protocol/src/index.ts`, after the `IssueUnlabeledPayload` interface (around line 323), add:

```typescript
export interface IssueCreatedPayload {
  taskId: Id;
  issueNumber: number;
  title: string;
  body: string;
  author: Id;
  createdAt: string;
}

export interface AuditNoteAddedPayload {
  taskId: Id | null;
  body: string;
  author: Id;
  createdAt: string;
}
```

- [ ] **Step 3: Add 2 new EventType entries**

In `packages/protocol/src/index.ts`, in the `EventType` const block, after `ISSUE_UNLABELED: "issue.unlabeled",` (line 368), add:

```typescript
  ISSUE_CREATED: "issue.created",
  AUDIT_NOTE_ADDED: "audit.note_added",
```

- [ ] **Step 4: Add 5 new CommandType entries**

In `packages/protocol/src/index.ts`, in the `CommandType` const block, after `PR_REQUEST_REVIEW: "pr.request_review",` (line 452), add:

```typescript
  ISSUE_DRAFT: "issue.draft",
  COMMENT_DRAFT: "comment.draft",
  DRAFT_SUBMIT: "draft.submit",
  DRAFT_DISCARD: "draft.discard",
  AUDIT_NOTE: "audit_note",
```

- [ ] **Step 5: Update mock-adapter capability count assertions**

In `packages/adapters/mock/src/mock-adapter.test.ts`, change lines 75-76:

```typescript
    expect(caps.supportedCommands.length).toBe(16);
    expect(caps.supportedEvents.length).toBe(22);
```

- [ ] **Step 6: Run tests to verify**

Run: `npm test`
Expected: all tests pass (existing tests unaffected; mock-adapter count assertions updated to match new protocol constants).

- [ ] **Step 7: Commit**

```bash
git add packages/protocol/src/index.ts packages/adapters/mock/src/mock-adapter.test.ts
git commit -m "feat(protocol): add 5 CommandTypes + 2 EventTypes for Issue #45 Safe GitHub Actions

Refs #45"
```

---

### Task 2: Reducer no-op cases

**Files:**
- Modify: `packages/core/src/reducer.ts:33-34` (imports), `:606-610` (after ISSUE_UNLABELED case)
- Modify: `packages/core/src/core.test.ts:36-38` (imports), `:468` (after ISSUE_UNLABELED test)

**Interfaces:**
- Consumes: `EventType.ISSUE_CREATED`, `EventType.AUDIT_NOTE_ADDED`, `IssueCreatedPayload`, `AuditNoteAddedPayload` from Task 1.
- Produces: reducer passes through these events without snapshot mutation.

- [ ] **Step 1: Write the failing test for ISSUE_CREATED no-op**

In `packages/core/src/core.test.ts`, first update the import block (around line 36-38) to add the new payload types:

```typescript
  type IssueCommentedPayload,
  type IssueLabeledPayload,
  type IssueUnlabeledPayload,
  type IssueCreatedPayload,
  type AuditNoteAddedPayload,
} from "@agent-office/protocol";
```

Then, after the `should pass through issue.unlabeled event without snapshot mutation` test (around line 468, before the closing `});` of the describe block), add:

```typescript
  it("should pass through issue.created event without snapshot mutation", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    const result = reduceEvent(snap, makeEvent(2, EventType.ISSUE_CREATED, {
      taskId: "t1",
      issueNumber: 42,
      title: "New issue",
      body: "body text",
      author: "user1",
      createdAt: "2026-07-11T10:00:00Z",
    } as IssueCreatedPayload));
    expect(result.errors).toHaveLength(0);
    expect(result.snapshot.tasks).toHaveLength(1);
    expect(result.snapshot.tasks[0].taskId).toBe("t1");
  });

  it("should pass through audit.note_added event without snapshot mutation", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    const result = reduceEvent(snap, makeEvent(2, EventType.AUDIT_NOTE_ADDED, {
      taskId: "t1",
      body: "audit entry",
      author: "user1",
      createdAt: "2026-07-11T10:00:00Z",
    } as AuditNoteAddedPayload));
    expect(result.errors).toHaveLength(0);
    expect(result.snapshot.tasks).toHaveLength(1);
    expect(result.snapshot.tasks[0].taskId).toBe("t1");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- core.test`
Expected: FAIL — `Unknown event type: issue.created` / `audit.note_added` (reducer default case pushes validation_error).

- [ ] **Step 3: Add reducer no-op cases**

In `packages/core/src/reducer.ts`, first update the import block (around line 33) to add the new payload types:

```typescript
  ErrorRaisedPayload,
  AgentSpawnedPayload,
  IssueCreatedPayload,
  AuditNoteAddedPayload,
  ReducerError,
} from "@agent-office/protocol";
```

Then, after the `ISSUE_UNLABELED` case (around line 610, before the `ERROR_RAISED` case), add:

```typescript
    case EventType.ISSUE_CREATED: {
      // Event-trail only — issue creation tracked in GitHubAdapterEvidence.
      break;
    }

    case EventType.AUDIT_NOTE_ADDED: {
      // Event-trail only — audit notes tracked in GitHubAdapterEvidence.auditNotes.
      break;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- core.test`
Expected: PASS — all tests including the 2 new no-op tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/reducer.ts packages/core/src/core.test.ts
git commit -m "feat(core): add ISSUE_CREATED + AUDIT_NOTE_ADDED reducer no-op cases

Refs #45"
```

---

### Task 3: Draft and AuditNote types + Evidence extension

**Files:**
- Modify: `packages/adapters/github/src/types.ts:93-98` (after GitHubAdapterEvidence)
- Modify: `packages/adapters/github/src/index.ts` (exports)

**Interfaces:**
- Produces: `DraftKind`, `IssueDraft`, `CommentDraft`, `Draft`, `AuditNote` types; `GitHubAdapterEvidence.auditNotes` field.

- [ ] **Step 1: Add Draft and AuditNote types**

In `packages/adapters/github/src/types.ts`, after the `GitHubAdapterEvidence` interface (around line 98), add:

```typescript
// ─── Draft 类型（adapter 私有，不进 protocol） ─────────────

export type DraftKind = "issue" | "comment";

export interface IssueDraft {
  draftId: Id;
  kind: "issue";
  title: string;
  body: string;
  createdBy: Id;
  createdAt: string;
}

export interface CommentDraft {
  draftId: Id;
  kind: "comment";
  issueNumber: number;
  body: string;
  createdBy: Id;
  createdAt: string;
}

export type Draft = IssueDraft | CommentDraft;

export interface AuditNote {
  auditId: Id;
  taskId: Id | null;
  body: string;
  author: Id;
  createdAt: string;
}
```

- [ ] **Step 2: Extend GitHubAdapterEvidence with auditNotes**

In `packages/adapters/github/src/types.ts`, modify the `GitHubAdapterEvidence` interface (around line 95-98):

```typescript
export interface GitHubAdapterEvidence {
  tasks: Record<Id, GitHubSourceRef>;
  artifacts: Record<Id, GitHubSourceRef>;
  auditNotes: AuditNote[];
}
```

- [ ] **Step 3: Update index.ts exports**

In `packages/adapters/github/src/index.ts`, add the new types to the existing type export block (after `GitHubAdapterEvidence,`):

```typescript
export type {
  GitHubFixtures,
  GitHubIssueFixture,
  GitHubPRFixture,
  GitHubLabel,
  GitHubUser,
  GitHubComment,
  GitHubReview,
  GitHubSourceRef,
  GitHubAdapterEvidence,
  DraftKind,
  IssueDraft,
  CommentDraft,
  Draft,
  AuditNote,
} from "./types.js";
```

- [ ] **Step 4: Fix evidence initialization in github-adapter.ts**

In `packages/adapters/github/src/github-adapter.ts`, the `evidence` field (line 63) and `syncFromFixtures` reset (line 272) must include `auditNotes: []`.

Change line 63:
```typescript
  private evidence: GitHubAdapterEvidence = { tasks: {}, artifacts: {}, auditNotes: [] };
```

Change line 272 (inside `syncFromFixtures`):
```typescript
    this.evidence = { tasks: {}, artifacts: {}, auditNotes: [] };
```

Change the `getGitHubEvidence` method (around line 364-369) to include auditNotes:
```typescript
  getGitHubEvidence(): GitHubAdapterEvidence {
    return {
      tasks: { ...this.evidence.tasks },
      artifacts: { ...this.evidence.artifacts },
      auditNotes: [...this.evidence.auditNotes],
    };
  }
```

- [ ] **Step 5: Run build to verify types compile**

Run: `npm run build`
Expected: PASS — no type errors.

- [ ] **Step 6: Run tests to verify nothing broke**

Run: `npm test`
Expected: PASS — all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/adapters/github/src/types.ts packages/adapters/github/src/index.ts packages/adapters/github/src/github-adapter.ts
git commit -m "feat(github-adapter): add Draft + AuditNote types, extend evidence with auditNotes

Refs #45"
```

---

### Task 4: GitHubApiClient.createIssue method

**Files:**
- Modify: `packages/adapters/github/src/github-api-client.ts:174` (after requestReview method)
- Modify: `packages/adapters/github/src/github-api-client.test.ts` (append new describe block)

**Interfaces:**
- Produces: `GitHubApiClient.createIssue(owner, repo, title, body): Promise<{ issueNumber: number; url: string; createdAt: string }>` — POST /repos/{owner}/{repo}/issues.

- [ ] **Step 1: Write failing tests for createIssue**

In `packages/adapters/github/src/github-api-client.test.ts`, append at the end of the file:

```typescript
describe("GitHubApiClient.createIssue", () => {
  it("posts a new issue and returns {issueNumber, url, createdAt}", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues", async ({ request }) => {
        const body = (await request.json()) as { title: string; body: string };
        expect(body.title).toBe("New bug");
        expect(body.body).toBe("something broke");
        return HttpResponse.json({
          number: 100,
          html_url: "https://github.com/owner/repo/issues/100",
          created_at: "2026-07-11T10:00:00Z",
        });
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    const result = await client.createIssue("owner", "repo", "New bug", "something broke");

    expect(result.issueNumber).toBe(100);
    expect(result.url).toBe("https://github.com/owner/repo/issues/100");
    expect(result.createdAt).toBe("2026-07-11T10:00:00Z");
  });

  it("throws GitHubApiError(422) when validation fails", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json(
          { message: "Validation Failed", errors: [{ field: "title", code: "missing" }] },
          { status: 422 },
        );
      }),
    );

    const client = new GitHubApiClient({ token: "ghp_test" });
    await expect(client.createIssue("owner", "repo", "", "")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 422,
    });
  });

  it("throws GitHubApiError(401) when unauthorized", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json({ message: "Bad credentials" }, { status: 401 });
      }),
    );

    const client = new GitHubApiClient({ token: "bad-token" });
    await expect(client.createIssue("owner", "repo", "title", "body")).rejects.toMatchObject({
      name: "GitHubApiError",
      status: 401,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- github-api-client.test`
Expected: FAIL — `client.createIssue is not a function`.

- [ ] **Step 3: Implement createIssue method**

In `packages/adapters/github/src/github-api-client.ts`, after the `requestReview` method (around line 174), add:

```typescript
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string
  ): Promise<{ issueNumber: number; url: string; createdAt: string }> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues`;
    const result = await this.rawPost(url, { title, body });
    const json = result.body as { number: number; html_url: string; created_at: string };
    return {
      issueNumber: json.number,
      url: json.html_url,
      createdAt: json.created_at,
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- github-api-client.test`
Expected: PASS — 3 new createIssue tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/github/src/github-api-client.ts packages/adapters/github/src/github-api-client.test.ts
git commit -m "feat(github-api-client): add createIssue method for POST /issues

Refs #45"
```

---

### Task 5: GitHubPolicy extension for 5 new commands

**Files:**
- Modify: `packages/adapters/github/src/github-policy.ts:44-49` (supported array), `:80-105` (validatePayload switch)
- Modify: `packages/adapters/github/src/github-policy.test.ts` (append new tests)

**Interfaces:**
- Consumes: `CommandType.ISSUE_DRAFT`, `COMMENT_DRAFT`, `DRAFT_SUBMIT`, `DRAFT_DISCARD`, `AUDIT_NOTE` from Task 1.
- Produces: policy validates 5 new commands (type allowlist + payload validation).

- [ ] **Step 1: Write failing tests for 5 new commands**

In `packages/adapters/github/src/github-policy.test.ts`, append before the final closing `});` of the top-level describe (after the `rate limit` describe block, around line 125):

```typescript
  describe("Phase 2.5 commands", () => {
    it("allows the 5 new command types with valid payloads", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const payloads: Record<string, unknown> = {
        [CommandType.ISSUE_DRAFT]: { title: "New issue", body: "body" },
        [CommandType.COMMENT_DRAFT]: { issueNumber: 1, body: "comment" },
        [CommandType.DRAFT_SUBMIT]: { draftId: "draft-1" },
        [CommandType.DRAFT_DISCARD]: { draftId: "draft-1" },
        [CommandType.AUDIT_NOTE]: { taskId: "t1", body: "audit" },
      };
      for (const ct of Object.keys(payloads)) {
        const verdict = policy.validate(makeCommand(ct, "u1", payloads[ct]));
        expect(verdict.allowed).toBe(true);
      }
    });

    it("allows audit_note without taskId (runtime-level audit)", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.AUDIT_NOTE, "u1", { body: "runtime audit" })
      );
      expect(verdict.allowed).toBe(true);
    });

    it("rejects issue.draft with empty title", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.ISSUE_DRAFT, "u1", { title: "", body: "body" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects comment.draft with empty body", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.COMMENT_DRAFT, "u1", { issueNumber: 1, body: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects comment.draft with non-positive issueNumber", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.COMMENT_DRAFT, "u1", { issueNumber: 0, body: "hi" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects draft.submit with empty draftId", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.DRAFT_SUBMIT, "u1", { draftId: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects draft.discard with empty draftId", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.DRAFT_DISCARD, "u1", { draftId: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });

    it("rejects audit_note with empty body", () => {
      const policy = new GitHubPolicy({ allowedActors: ["u1"], rateLimitPerMinute: 30 });
      const verdict = policy.validate(
        makeCommand(CommandType.AUDIT_NOTE, "u1", { taskId: "t1", body: "" })
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe("INVALID_PAYLOAD");
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- github-policy.test`
Expected: FAIL — new commands rejected with `UNSUPPORTED_COMMAND_TYPE` (not yet in supported array).

- [ ] **Step 3: Add 5 new commands to supported array**

In `packages/adapters/github/src/github-policy.ts`, replace the `supported` array (around line 44-49):

```typescript
    const supported: string[] = [
      CommandType.ISSUE_ADD_COMMENT,
      CommandType.ISSUE_ADD_LABEL,
      CommandType.ISSUE_REMOVE_LABEL,
      CommandType.PR_REQUEST_REVIEW,
      CommandType.ISSUE_DRAFT,
      CommandType.COMMENT_DRAFT,
      CommandType.DRAFT_SUBMIT,
      CommandType.DRAFT_DISCARD,
      CommandType.AUDIT_NOTE,
    ];
```

- [ ] **Step 4: Add payload validation for 5 new commands**

In `packages/adapters/github/src/github-policy.ts`, in the `validatePayload` switch, before the `default:` case (around line 101), add:

```typescript
      case CommandType.ISSUE_DRAFT: {
        if (typeof p.title !== "string" || p.title.length === 0) return "INVALID_PAYLOAD";
        // body may be empty
        return null;
      }
      case CommandType.COMMENT_DRAFT: {
        if (typeof p.issueNumber !== "number" || p.issueNumber <= 0) return "INVALID_PAYLOAD";
        if (typeof p.body !== "string" || p.body.length === 0) return "INVALID_PAYLOAD";
        return null;
      }
      case CommandType.DRAFT_SUBMIT:
      case CommandType.DRAFT_DISCARD: {
        if (typeof p.draftId !== "string" || p.draftId.length === 0) return "INVALID_PAYLOAD";
        return null;
      }
      case CommandType.AUDIT_NOTE: {
        if (typeof p.body !== "string" || p.body.length === 0) return "INVALID_PAYLOAD";
        // taskId is optional
        return null;
      }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- github-policy.test`
Expected: PASS — all policy tests including 8 new tests.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/github/src/github-policy.ts packages/adapters/github/src/github-policy.test.ts
git commit -m "feat(github-policy): support 5 new safe action commands with payload validation

Refs #45"
```

---

### Task 6: Adapter handlers + dispatch + capabilities

**Files:**
- Modify: `packages/adapters/github/src/github-adapter.ts` (imports, fields, execute switch, handlers, capabilities)

**Interfaces:**
- Consumes: all protocol types from Task 1, Draft/AuditNote types from Task 3, `createIssue` from Task 4, policy support from Task 5.
- Produces: adapter dispatches 5 new commands; `getDrafts()`, `getDraft(id)` helpers for tests; updated `getCapabilities()`.

- [ ] **Step 1: Update imports in github-adapter.ts**

In `packages/adapters/github/src/github-adapter.ts`, update the protocol import (around line 26-30) to add the 5 new payload types:

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
  IssueDraftPayload,
  CommentDraftPayload,
  DraftSubmitPayload,
  DraftDiscardPayload,
  AuditNotePayload,
} from "@agent-office/protocol";
```

Update the types import (around line 34-41) to add Draft and AuditNote:

```typescript
import type {
  GitHubFixtures,
  GitHubIssueFixture,
  GitHubPRFixture,
  GitHubSourceRef,
  GitHubAdapterEvidence,
  GitHubLabel,
  Draft,
  AuditNote,
} from "./types.js";
```

- [ ] **Step 2: Add drafts Map field and COMMANDS_REQUIRING_API constant**

In `packages/adapters/github/src/github-adapter.ts`, after the module-level constants (around line 47), add:

```typescript
const COMMANDS_REQUIRING_API = new Set<string>([
  CommandType.ISSUE_ADD_COMMENT,
  CommandType.ISSUE_ADD_LABEL,
  CommandType.ISSUE_REMOVE_LABEL,
  CommandType.PR_REQUEST_REVIEW,
  CommandType.DRAFT_SUBMIT,
]);
```

Then in the class fields (around line 73, after `private policy?: GitHubPolicy;`), add:

```typescript
  private drafts = new Map<Id, Draft>();
```

- [ ] **Step 3: Update execute() early-return logic**

In `packages/adapters/github/src/github-adapter.ts`, replace the `execute()` early-return block (around line 168-179). Change:

```typescript
    // 1. Unconfigured → UNSUPPORTED_COMMAND (fixture-only mode preserved)
    if (!this.apiClient || !this.owner || !this.repo) {
      return {
        commandId: command.commandId,
        status: "rejected",
        error: {
          code: "UNSUPPORTED_COMMAND",
          message: "GitHub Runtime Adapter v0 is read-only; write path not configured",
        },
        affectedEventIds: [],
      };
    }
```

to:

```typescript
    // 1. Commands requiring API → UNSUPPORTED_COMMAND when unconfigured
    const needsApi = COMMANDS_REQUIRING_API.has(command.commandType);
    if (needsApi && (!this.apiClient || !this.owner || !this.repo)) {
      return {
        commandId: command.commandId,
        status: "rejected",
        error: {
          code: "UNSUPPORTED_COMMAND",
          message: "GitHub Runtime Adapter v0 is read-only; write path not configured",
        },
        affectedEventIds: [],
      };
    }
```

- [ ] **Step 4: Add 5 new cases to dispatch switch**

In `packages/adapters/github/src/github-adapter.ts`, in the `execute()` switch (around line 200-212), after the `PR_REQUEST_REVIEW` case and before `default:`, add:

```typescript
        case CommandType.ISSUE_DRAFT:
          eventId = await this.executeIssueDraft(command as OfficeCommand<IssueDraftPayload>);
          break;
        case CommandType.COMMENT_DRAFT:
          eventId = await this.executeCommentDraft(command as OfficeCommand<CommentDraftPayload>);
          break;
        case CommandType.DRAFT_SUBMIT:
          eventId = await this.executeDraftSubmit(command as OfficeCommand<DraftSubmitPayload>);
          break;
        case CommandType.DRAFT_DISCARD:
          eventId = await this.executeDraftDiscard(command as OfficeCommand<DraftDiscardPayload>);
          break;
        case CommandType.AUDIT_NOTE:
          eventId = await this.executeAuditNote(command as OfficeCommand<AuditNotePayload>);
          break;
```

- [ ] **Step 5: Implement 5 handler methods**

In `packages/adapters/github/src/github-adapter.ts`, after the `executeRequestReview` method (around line 749, before the `// ─── 内部：事件发射` section), add:

```typescript
  private async executeIssueDraft(command: OfficeCommand<IssueDraftPayload>): Promise<Id> {
    const draftId = `draft-${this.sequence + 1}`;
    const draft: Draft = {
      draftId,
      kind: "issue",
      title: command.payload.title,
      body: command.payload.body,
      createdBy: command.actorId,
      createdAt: this.baseTimestamp,
    };
    this.drafts.set(draftId, draft);
    // 不发射事件（本地状态变更）
    return draftId;
  }

  private async executeCommentDraft(command: OfficeCommand<CommentDraftPayload>): Promise<Id> {
    const draftId = `draft-${this.sequence + 1}`;
    const draft: Draft = {
      draftId,
      kind: "comment",
      issueNumber: command.payload.issueNumber,
      body: command.payload.body,
      createdBy: command.actorId,
      createdAt: this.baseTimestamp,
    };
    this.drafts.set(draftId, draft);
    return draftId;
  }

  private async executeDraftSubmit(command: OfficeCommand<DraftSubmitPayload>): Promise<Id> {
    const draft = this.drafts.get(command.payload.draftId);
    if (!draft) {
      throw new GitHubApiError(404, `Draft not found: ${command.payload.draftId}`);
    }

    if (draft.kind === "issue") {
      const result = await this.apiClient!.createIssue(
        this.owner!, this.repo!, draft.title, draft.body
      );
      this.drafts.delete(draft.draftId);
      const taskId: Id = `gh-issue-${result.issueNumber}`;
      return this.emit(
        EventType.ISSUE_CREATED,
        {
          taskId,
          issueNumber: result.issueNumber,
          title: draft.title,
          body: draft.body,
          author: draft.createdBy,
          createdAt: result.createdAt,
        },
        "issue",
        result.issueNumber,
        result.createdAt,
      );
    } else {
      const result = await this.apiClient!.addComment(
        this.owner!, this.repo!, draft.issueNumber, draft.body
      );
      this.drafts.delete(draft.draftId);
      const taskId: Id = `gh-issue-${draft.issueNumber}`;
      return this.emit(
        EventType.ISSUE_COMMENTED,
        {
          taskId,
          commentId: String(result.commentId),
          author: draft.createdBy,
          body: draft.body,
          createdAt: result.createdAt,
        },
        "issue",
        draft.issueNumber,
        result.createdAt,
      );
    }
  }

  private async executeDraftDiscard(command: OfficeCommand<DraftDiscardPayload>): Promise<Id> {
    const draft = this.drafts.get(command.payload.draftId);
    this.drafts.delete(command.payload.draftId);
    return draft?.draftId ?? command.payload.draftId;
  }

  private async executeAuditNote(command: OfficeCommand<AuditNotePayload>): Promise<Id> {
    const note: AuditNote = {
      auditId: `audit-${this.sequence + 1}`,
      taskId: command.payload.taskId ?? null,
      body: command.payload.body,
      author: command.actorId,
      createdAt: this.baseTimestamp,
    };
    this.evidence.auditNotes.push(note);
    return this.emit(
      EventType.AUDIT_NOTE_ADDED,
      {
        taskId: note.taskId,
        body: note.body,
        author: note.author,
        createdAt: note.createdAt,
      },
      "issue",
      0,
      note.createdAt,
    );
  }
```

- [ ] **Step 6: Add getDrafts/getDraft helpers**

In `packages/adapters/github/src/github-adapter.ts`, after `getEventLog()` (around line 373), add:

```typescript
  getDrafts(): Draft[] {
    return [...this.drafts.values()];
  }

  getDraft(draftId: Id): Draft | undefined {
    return this.drafts.get(draftId);
  }
```

- [ ] **Step 7: Update getCapabilities()**

In `packages/adapters/github/src/github-adapter.ts`, replace the `getCapabilities()` method (around line 239-260):

```typescript
  getCapabilities(): AdapterCapabilities {
    const writeConfigured = !!(this.apiClient && this.owner && this.repo);
    const alwaysSupported = [
      CommandType.ISSUE_DRAFT,
      CommandType.COMMENT_DRAFT,
      CommandType.DRAFT_DISCARD,
      CommandType.AUDIT_NOTE,
    ];
    const writeOnly = [
      CommandType.ISSUE_ADD_COMMENT,
      CommandType.ISSUE_ADD_LABEL,
      CommandType.ISSUE_REMOVE_LABEL,
      CommandType.PR_REQUEST_REVIEW,
      CommandType.DRAFT_SUBMIT,
    ];
    return {
      supportedEvents: [...ALL_EVENT_TYPES],
      supportedCommands: writeConfigured
        ? [...alwaysSupported, ...writeOnly]
        : alwaysSupported,
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

- [ ] **Step 8: Run build to verify types compile**

Run: `npm run build`
Expected: PASS — no type errors.

- [ ] **Step 9: Run tests to verify nothing broke**

Run: `npm test`
Expected: PASS — all existing tests pass (new handlers not yet tested, but existing behavior preserved).

Note: The existing test `unconfigured adapter (no apiClient) → rejected with UNSUPPORTED_COMMAND` uses `ISSUE_ADD_COMMENT` which is in `COMMANDS_REQUIRING_API`, so it still returns `UNSUPPORTED_COMMAND`. No existing test should break.

- [ ] **Step 10: Commit**

```bash
git add packages/adapters/github/src/github-adapter.ts
git commit -m "feat(github-adapter): add 5 draft/audit handlers + dispatch + capabilities

Refs #45"
```

---

### Task 7: Command-gateway integration tests

**Files:**
- Modify: `packages/adapters/github/src/command-gateway.test.ts` (append new tests)

**Interfaces:**
- Consumes: adapter handlers from Task 6, `createIssue` from Task 4.

- [ ] **Step 1: Write 12 integration tests**

In `packages/adapters/github/src/command-gateway.test.ts`, before the final closing `});` of the top-level describe (around line 228), add:

```typescript
  // ─── Phase 2.5: Draft lifecycle ───────────────────────

  it("issue.draft success → returns draftId, no event emitted, draft in Map", async () => {
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.ISSUE_DRAFT, "u1", { title: "New bug", body: "desc" })
    );
    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds).toHaveLength(1);
    const draftId = result.affectedEventIds[0];

    // No event emitted
    expect(adapter.getEventLog()).toHaveLength(0);

    // Draft stored in Map
    const draft = adapter.getDraft(draftId);
    expect(draft).toBeDefined();
    expect(draft!.kind).toBe("issue");
    expect(draft!.title).toBe("New bug");
  });

  it("comment.draft success → returns draftId, no event emitted, draft in Map", async () => {
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.COMMENT_DRAFT, "u1", { issueNumber: 10, body: "comment text" })
    );
    expect(result.status).toBe("accepted");
    const draftId = result.affectedEventIds[0];

    expect(adapter.getEventLog()).toHaveLength(0);

    const draft = adapter.getDraft(draftId);
    expect(draft).toBeDefined();
    expect(draft!.kind).toBe("comment");
  });

  it("draft.discard success → draft removed from Map, no event emitted", async () => {
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const createResult = await adapter.execute(
      makeCommand(CommandType.ISSUE_DRAFT, "u1", { title: "T", body: "B" })
    );
    const draftId = createResult.affectedEventIds[0];
    expect(adapter.getDraft(draftId)).toBeDefined();

    const discardResult = await adapter.execute(
      makeCommand(CommandType.DRAFT_DISCARD, "u1", { draftId })
    );
    expect(discardResult.status).toBe("accepted");
    expect(adapter.getEventLog()).toHaveLength(0);
    expect(adapter.getDraft(draftId)).toBeUndefined();
  });

  it("draft.discard non-existent draftId → error with NOT_FOUND", async () => {
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.DRAFT_DISCARD, "u1", { draftId: "draft-nonexistent" })
    );
    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("draft.submit(issue) success → calls createIssue, emits ISSUE_CREATED, draft removed", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json({
          number: 100,
          html_url: "https://github.com/owner/repo/issues/100",
          created_at: "2026-07-11T10:00:00Z",
        });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const createResult = await adapter.execute(
      makeCommand(CommandType.ISSUE_DRAFT, "u1", { title: "New issue", body: "body" })
    );
    const draftId = createResult.affectedEventIds[0];

    const submitResult = await adapter.execute(
      makeCommand(CommandType.DRAFT_SUBMIT, "u1", { draftId })
    );
    expect(submitResult.status).toBe("accepted");
    expect(submitResult.affectedEventIds).toHaveLength(1);

    const lastEvent = adapter.getEventLog().pop()!;
    expect(lastEvent.type).toBe(EventType.ISSUE_CREATED);
    expect(lastEvent.payload).toMatchObject({
      taskId: "gh-issue-100",
      issueNumber: 100,
      title: "New issue",
    });

    // Draft removed from Map
    expect(adapter.getDraft(draftId)).toBeUndefined();
  });

  it("draft.submit(comment) success → calls addComment, emits ISSUE_COMMENTED, draft removed", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues/10/comments", () => {
        return HttpResponse.json({ id: 42, created_at: "2026-07-11T10:00:00Z" });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const createResult = await adapter.execute(
      makeCommand(CommandType.COMMENT_DRAFT, "u1", { issueNumber: 10, body: "hello" })
    );
    const draftId = createResult.affectedEventIds[0];

    const submitResult = await adapter.execute(
      makeCommand(CommandType.DRAFT_SUBMIT, "u1", { draftId })
    );
    expect(submitResult.status).toBe("accepted");

    const lastEvent = adapter.getEventLog().pop()!;
    expect(lastEvent.type).toBe(EventType.ISSUE_COMMENTED);
    expect(lastEvent.payload).toMatchObject({ taskId: "gh-issue-10", body: "hello" });

    expect(adapter.getDraft(draftId)).toBeUndefined();
  });

  it("draft.submit non-existent draftId → error with NOT_FOUND", async () => {
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.DRAFT_SUBMIT, "u1", { draftId: "draft-nonexistent" })
    );
    expect(result.status).toBe("error");
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("draft.submit(issue) API failure → error status, draft preserved in Map", async () => {
    server.use(
      http.post("https://api.github.com/repos/owner/repo/issues", () => {
        return HttpResponse.json({ message: "Bad credentials" }, { status: 401 });
      }),
    );
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const createResult = await adapter.execute(
      makeCommand(CommandType.ISSUE_DRAFT, "u1", { title: "T", body: "B" })
    );
    const draftId = createResult.affectedEventIds[0];

    const submitResult = await adapter.execute(
      makeCommand(CommandType.DRAFT_SUBMIT, "u1", { draftId })
    );
    expect(submitResult.status).toBe("error");
    expect(submitResult.error?.code).toBe("UNAUTHORIZED");

    // Draft preserved (not deleted on failure)
    expect(adapter.getDraft(draftId)).toBeDefined();
  });

  it("audit_note with taskId → emits AUDIT_NOTE_ADDED, note in evidence", async () => {
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.AUDIT_NOTE, "u1", { taskId: "gh-issue-10", body: "audit entry" })
    );
    expect(result.status).toBe("accepted");

    const lastEvent = adapter.getEventLog().pop()!;
    expect(lastEvent.type).toBe(EventType.AUDIT_NOTE_ADDED);
    expect(lastEvent.payload).toMatchObject({ taskId: "gh-issue-10", body: "audit entry" });

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.auditNotes).toHaveLength(1);
    expect(evidence.auditNotes[0].body).toBe("audit entry");
    expect(evidence.auditNotes[0].taskId).toBe("gh-issue-10");
  });

  it("audit_note without taskId → emits AUDIT_NOTE_ADDED with taskId null", async () => {
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.AUDIT_NOTE, "u1", { body: "runtime audit" })
    );
    expect(result.status).toBe("accepted");

    const lastEvent = adapter.getEventLog().pop()!;
    expect(lastEvent.type).toBe(EventType.AUDIT_NOTE_ADDED);
    expect(lastEvent.payload).toMatchObject({ taskId: null, body: "runtime audit" });
  });

  it("audit_note does not call GitHub API (no msw handler needed)", async () => {
    // onUnhandledRequest: "error" is set in setupServer — if audit_note makes
    // an HTTP call, msw will error. No handler registered = no call expected.
    const { adapter } = makeConfiguredAdapter();
    await adapter.connect();

    const result = await adapter.execute(
      makeCommand(CommandType.AUDIT_NOTE, "u1", { body: "no api call" })
    );
    expect(result.status).toBe("accepted");
    // If we reach here without msw "error" on unhandled request, audit_note
    // did not make an HTTP call.
  });

  it("unconfigured adapter: local commands work, draft.submit returns UNSUPPORTED_COMMAND", async () => {
    const adapter = new GitHubRuntimeAdapter();
    await adapter.connect();

    // issue.draft works without apiClient
    const draftResult = await adapter.execute(
      makeCommand(CommandType.ISSUE_DRAFT, "u1", { title: "T", body: "B" })
    );
    expect(draftResult.status).toBe("accepted");
    const draftId = draftResult.affectedEventIds[0];

    // draft.submit fails without apiClient
    const submitResult = await adapter.execute(
      makeCommand(CommandType.DRAFT_SUBMIT, "u1", { draftId })
    );
    expect(submitResult.status).toBe("rejected");
    expect(submitResult.error?.code).toBe("UNSUPPORTED_COMMAND");

    // audit_note works without apiClient
    const auditResult = await adapter.execute(
      makeCommand(CommandType.AUDIT_NOTE, "u1", { body: "audit" })
    );
    expect(auditResult.status).toBe("accepted");
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- command-gateway.test`
Expected: PASS — all 12 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/github/src/command-gateway.test.ts
git commit -m "test(github-adapter): add 12 integration tests for Phase 2.5 safe actions

Refs #45"
```

---

### Task 8: Final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass (existing + new). Expected count: previous total + ~25 new tests (2 reducer + 3 api-client + 8 policy + 12 gateway).

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS — no type errors, all packages compile.

- [ ] **Step 3: Verify no reducer errors on replay**

The existing test `success → getSnapshot() replay produces no reducer errors` covers Phase 2.4 events. The new `ISSUE_CREATED` and `AUDIT_NOTE_ADDED` events are no-ops, so replay of any sequence including them produces zero reducer errors. This is already covered by the 2 new reducer tests in Task 2.

- [ ] **Step 4: Commit final state if any uncommitted changes**

If `git status` shows clean, skip. Otherwise:

```bash
git add -A
git commit -m "chore: final verification for Issue #45 Phase 2.5"
```

- [ ] **Step 5: Report completion**

All 8 tasks complete. Implementation is ready for branch finishing (merge/PR).

---

## Self-Review

**1. Spec coverage:**
- §1 Protocol changes → Task 1 ✓
- §2 Data structures (Draft/AuditNote/Evidence) → Task 3 ✓
- §3 API client createIssue + policy extension → Task 4 (api) + Task 5 (policy) ✓
- §4 Handler behavior (5 handlers) → Task 6 ✓
- §5 Error handling + backward compat → Task 6 (COMMANDS_REQUIRING_API + capabilities) ✓
- §6 Test strategy → Task 2 (reducer) + Task 4 (api-client) + Task 5 (policy) + Task 7 (gateway) ✓
- §7 Implementation order → Tasks 1-8 follow spec order ✓
- §8 Scope/YAGNI → no out-of-scope items added ✓

**2. Placeholder scan:**
- No TBD/TODO ✓
- All code blocks contain actual implementation ✓
- All test blocks contain actual test code ✓
- All commands have expected output ✓

**3. Type consistency:**
- `Draft` type used consistently in Tasks 3 and 6 ✓
- `AuditNote` type used consistently in Tasks 3 and 6 ✓
- `createIssue` signature: `(owner, repo, title, body) → {issueNumber, url, createdAt}` — consistent between Task 4 (impl) and Task 6 (handler call) ✓
- `getDraft(draftId)` / `getDrafts()` used in Task 7 tests match Task 6 impl ✓
- `COMMANDS_REQUIRING_API` constant used in Task 6 matches spec §5.1 ✓

No issues found. Plan is ready for execution.
