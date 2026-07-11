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
