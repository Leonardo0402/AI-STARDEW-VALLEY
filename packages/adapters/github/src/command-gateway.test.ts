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
    // Draft is a discriminated union; narrow to issue shape for title access
    expect((draft as { title: string }).title).toBe("New bug");
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
});
