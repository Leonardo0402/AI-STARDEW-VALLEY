/**
 * Destructive Guard 测试 — v0 拒绝所有写命令。
 * 覆盖 AC8。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { CommandType, type OfficeCommand } from "@agent-office/protocol";
import { SAMPLE_FIXTURES } from "./fixtures/index.js";

function makeCommand(
  commandType: string,
  payload: unknown,
  targetId: string | null = null
): OfficeCommand {
  return {
    commandId: `cmd-test-${commandType}`,
    commandType,
    timestamp: "2026-01-01T00:00:00Z",
    source: "user",
    actorId: "user-1",
    runtimeId: "github-runtime-001",
    targetId,
    payload,
  };
}

describe("GitHub adapter destructive guard: v0 rejects all write commands", () => {
  let adapter: GitHubRuntimeAdapter;

  beforeEach(async () => {
    adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
  });

  const writeCommands: Array<{ name: string; commandType: string; payload: unknown; targetId?: string }> = [
    {
      name: "task.create",
      commandType: CommandType.TASK_CREATE,
      payload: { title: "injected", description: "should fail" },
    },
    {
      name: "task.assign",
      commandType: CommandType.TASK_ASSIGN,
      payload: { taskId: "gh-issue-10", agentId: "agent-1" },
      targetId: "gh-issue-10",
    },
    {
      name: "agent.pause",
      commandType: CommandType.AGENT_PAUSE,
      payload: { agentId: "agent-1" },
    },
    {
      name: "agent.resume",
      commandType: CommandType.AGENT_RESUME,
      payload: { agentId: "agent-1" },
    },
    {
      name: "approval.accept",
      commandType: CommandType.APPROVAL_ACCEPT,
      payload: { approvalId: "approval-1" },
      targetId: "approval-1",
    },
    {
      name: "approval.reject",
      commandType: CommandType.APPROVAL_REJECT,
      payload: { approvalId: "approval-1", reason: "no" },
      targetId: "approval-1",
    },
    {
      name: "artifact.open",
      commandType: CommandType.ARTIFACT_OPEN,
      payload: { artifactId: "gh-pr-20" },
      targetId: "gh-pr-20",
    },
  ];

  for (const { name, commandType, payload, targetId } of writeCommands) {
    it(`rejects ${name} with UNSUPPORTED_COMMAND`, async () => {
      const cmd = makeCommand(commandType, payload, targetId ?? null);
      const result = await adapter.execute(cmd);
      expect(result.status).toBe("rejected");
      expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
      expect(result.error?.message).toContain("read-only");
      expect(result.affectedEventIds).toHaveLength(0);
    });
  }

  it("rejects unknown command type with UNSUPPORTED_COMMAND", async () => {
    const cmd = makeCommand("github.merge", { prNumber: 20 });
    const result = await adapter.execute(cmd);
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
  });

  it("getCapabilities 声明 7 个本地命令（无写能力）", () => {
    const caps = adapter.getCapabilities();
    expect(caps.supportedCommands).toHaveLength(7);
    expect(caps.supportedCommands).toContain(CommandType.ISSUE_DRAFT);
    expect(caps.supportedCommands).toContain(CommandType.COMMENT_DRAFT);
    expect(caps.supportedCommands).toContain(CommandType.DRAFT_DISCARD);
    expect(caps.supportedCommands).toContain(CommandType.AUDIT_NOTE);
    expect(caps.supportedCommands).toContain(CommandType.REVIEW_ASSIGN);
    expect(caps.supportedCommands).toContain(CommandType.REVIEW_SUBMIT);
    expect(caps.supportedCommands).toContain(CommandType.REVIEW_FINALIZE);
    expect(caps.features.commandExecution).toBe(false);
  });

  it("execute rejected 后 snapshot 不变（无副作用）", async () => {
    const snapBefore = await adapter.getSnapshot();
    const cmd = makeCommand(CommandType.TASK_CREATE, { title: "injected", description: "fail" });
    await adapter.execute(cmd);
    const snapAfter = await adapter.getSnapshot();
    expect(snapAfter.tasks).toEqual(snapBefore.tasks);
    expect(snapAfter.artifacts).toEqual(snapBefore.artifacts);
  });

  it("execute rejected 后 eventLog 不变（无事件注入）", async () => {
    const logBefore = adapter.getEventLog();
    const cmd = makeCommand(CommandType.TASK_CREATE, { title: "injected", description: "fail" });
    await adapter.execute(cmd);
    const logAfter = adapter.getEventLog();
    expect(logAfter.length).toBe(logBefore.length);
  });
});
