/**
 * GitHubRuntimeAdapter 基础生命周期测试。
 * 覆盖 connect/disconnect/getSnapshot/subscribe/execute/getCapabilities。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { CommandType, type OfficeCommand } from "@agent-office/protocol";

function makeCommand(commandType: string, payload: unknown): OfficeCommand {
  return {
    commandId: "cmd-test-1",
    commandType,
    timestamp: "2026-01-01T00:00:00Z",
    source: "user",
    actorId: "user-1",
    runtimeId: "github-runtime-001",
    targetId: null,
    payload,
  };
}

describe("GitHubRuntimeAdapter basic lifecycle", () => {
  let adapter: GitHubRuntimeAdapter;

  beforeEach(() => {
    adapter = new GitHubRuntimeAdapter();
  });

  it("connect/disconnect 切换 connected 状态", async () => {
    await adapter.connect();
    // getSnapshot 不应抛异常
    const snap = await adapter.getSnapshot();
    expect(snap.runtimeId).toBe("github-runtime-001");
    await adapter.disconnect();
  });

  it("初始 snapshot 中 agents=[] rooms=[] tasks=[] artifacts=[]", async () => {
    await adapter.connect();
    const snap = await adapter.getSnapshot();
    expect(snap.agents).toHaveLength(0);
    expect(snap.rooms).toHaveLength(0);
    expect(snap.tasks).toHaveLength(0);
    expect(snap.artifacts).toHaveLength(0);
  });

  it("getCapabilities 声明只读：commandExecution=false", () => {
    const caps = adapter.getCapabilities();
    expect(caps.features.snapshot).toBe(true);
    expect(caps.features.commandExecution).toBe(false);
    expect(caps.features.hardOrchestration).toBe(false);
    expect(caps.features.softMapping).toBe(false);
    expect(caps.supportedCommands).toHaveLength(0);
  });

  it("execute 对所有写命令返回 rejected + UNSUPPORTED_COMMAND", async () => {
    await adapter.connect();
    const cmd = makeCommand(CommandType.TASK_CREATE, { title: "test", description: "desc" });
    const result = await adapter.execute(cmd);
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
    expect(result.error?.message).toContain("read-only");
  });

  it("syncFromFixtures 生成 eventLog 且 getSnapshot 返回投影结果", async () => {
    await adapter.connect();
    const { ISSUE_OPEN } = await import("./fixtures/index.js");
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues: [ISSUE_OPEN],
      pulls: [],
    });
    const snap = await adapter.getSnapshot();
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].taskId).toBe("gh-issue-10");
    expect(snap.tasks[0].status).toBe("created");
    expect(snap.agents).toHaveLength(0);
    expect(snap.rooms).toHaveLength(0);
  });

  it("getGitHubEvidence 返回 task provenance", async () => {
    await adapter.connect();
    const { ISSUE_OPEN } = await import("./fixtures/index.js");
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues: [ISSUE_OPEN],
      pulls: [],
    });
    const evidence = adapter.getGitHubEvidence();
    expect(Object.keys(evidence.tasks)).toContain("gh-issue-10");
    expect(evidence.tasks["gh-issue-10"].kind).toBe("issue");
    expect(evidence.tasks["gh-issue-10"].number).toBe(10);
  });

  it("getEventLog 返回事件日志副本", async () => {
    await adapter.connect();
    const { ISSUE_OPEN } = await import("./fixtures/index.js");
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues: [ISSUE_OPEN],
      pulls: [],
    });
    const log = adapter.getEventLog();
    expect(log.length).toBeGreaterThan(0);
    // 验证事件 ID 格式
    expect(log[0].eventId).toMatch(/^evt-gh-\d+-issue-\d+$/);
  });
});
