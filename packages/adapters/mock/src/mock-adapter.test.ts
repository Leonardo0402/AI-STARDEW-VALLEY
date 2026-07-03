/**
 * MockRuntimeAdapter 测试 — 覆盖完整链路和异常流程。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import {
  SnapshotStore,
  CommandGateway,
  projectSnapshot,
} from "@agent-office/core";
import {
  EventType,
  CommandType,
  type DomainEvent,
  type OfficeCommand,
} from "@agent-office/protocol";

describe("MockRuntimeAdapter", () => {
  let adapter: MockRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;

  beforeEach(async () => {
    adapter = new MockRuntimeAdapter({ eventDelayMs: 0 });
    store = new SnapshotStore("mock-runtime-001");
    gateway = new CommandGateway(adapter);

    await adapter.connect();

    // 订阅 adapter 事件，应用到 store
    adapter.subscribe((event) => {
      store.applyEvent(event);
      gateway.updateSnapshot(store.getSnapshot());
    });

    // 初始 snapshot
    const snap = await adapter.getSnapshot();
    store.setSnapshot(snap);
    gateway.updateSnapshot(snap);
  });

  function makeCommand(
    type: string,
    payload: unknown,
    targetId: string | null = null
  ): OfficeCommand {
    return {
      commandId: `cmd-${Date.now()}-${Math.random()}`,
      commandType: type,
      timestamp: new Date().toISOString(),
      source: "user",
      actorId: "user-1",
      runtimeId: "mock-runtime-001",
      targetId,
      payload,
    };
  }

  it("should return initial snapshot with 4 agents and 4 rooms", async () => {
    const snap = await adapter.getSnapshot();
    expect(snap.agents).toHaveLength(4);
    expect(snap.rooms).toHaveLength(4);
    expect(snap.agents.map((a) => a.role)).toContain("orchestrator");
    expect(snap.agents.filter((a) => a.role === "worker")).toHaveLength(2);
    expect(snap.agents.filter((a) => a.role === "reviewer")).toHaveLength(1);
  });

  it("should return correct capabilities", () => {
    const caps = adapter.getCapabilities();
    expect(caps.features.snapshot).toBe(true);
    expect(caps.features.commandExecution).toBe(true);
    expect(caps.supportedCommands.length).toBe(7);
    expect(caps.supportedEvents.length).toBe(13);
  });

  it("should handle task.create command", async () => {
    const cmd = makeCommand(CommandType.TASK_CREATE, {
      title: "Test Task",
      description: "Test Description",
    });
    const result = await gateway.execute(cmd);
    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds).toHaveLength(1);

    const snap = store.getSnapshot();
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].title).toBe("Test Task");
    expect(snap.tasks[0].status).toBe("created");
  });

  it("should handle task.assign command", async () => {
    // create task first
    const createCmd = makeCommand(CommandType.TASK_CREATE, {
      title: "Test Task",
      description: "desc",
    });
    const createResult = await gateway.execute(createCmd);
    expect(createResult.status).toBe("accepted");

    const snap1 = store.getSnapshot();
    const taskId = snap1.tasks[0].taskId;
    const workerId = snap1.agents.find((a) => a.role === "worker")!.agentId;

    // assign task
    const assignCmd = makeCommand(
      CommandType.TASK_ASSIGN,
      { taskId, agentId: workerId },
      taskId
    );
    const result = await gateway.execute(assignCmd);
    expect(result.status).toBe("accepted");

    const snap2 = store.getSnapshot();
    expect(snap2.tasks[0].assigneeId).toBe(workerId);
    expect(snap2.tasks[0].status).toBe("assigned");
  });

  it("should handle agent.pause and agent.resume", async () => {
    const snap = store.getSnapshot();
    const workerId = snap.agents.find((a) => a.role === "worker")!.agentId;

    const pauseCmd = makeCommand(CommandType.AGENT_PAUSE, { agentId: workerId });
    const pauseResult = await gateway.execute(pauseCmd);
    expect(pauseResult.status).toBe("accepted");

    const snap2 = store.getSnapshot();
    expect(snap2.agents.find((a) => a.agentId === workerId)!.status).toBe("paused");

    const resumeCmd = makeCommand(CommandType.AGENT_RESUME, { agentId: workerId });
    const resumeResult = await gateway.execute(resumeCmd);
    expect(resumeResult.status).toBe("accepted");

    const snap3 = store.getSnapshot();
    expect(snap3.agents.find((a) => a.agentId === workerId)!.status).toBe("idle");
  });

  it("should handle artifact.open command", async () => {
    // play normal flow to create artifact
    adapter.playNormalFlow();
    // wait for events to process (synchronous with delay 0)
    await new Promise((r) => setTimeout(r, 100));

    const snap = store.getSnapshot();
    expect(snap.artifacts.length).toBeGreaterThan(0);
    const artifactId = snap.artifacts[0].artifactId;

    const cmd = makeCommand(CommandType.ARTIFACT_OPEN, { artifactId }, artifactId);
    const result = await gateway.execute(cmd);
    expect(result.status).toBe("accepted");
  });

  it("should handle approval.accept and complete task", async () => {
    adapter.playNormalFlow();
    await new Promise((r) => setTimeout(r, 200));

    const snap = store.getSnapshot();
    expect(snap.approvals.length).toBeGreaterThan(0);
    const approvalId = snap.approvals[0].approvalId;
    expect(snap.approvals[0].status).toBe("requested");

    const cmd = makeCommand(CommandType.APPROVAL_ACCEPT, { approvalId }, approvalId);
    const result = await gateway.execute(cmd);
    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds.length).toBeGreaterThanOrEqual(2);

    const snap2 = store.getSnapshot();
    expect(snap2.approvals[0].status).toBe("approved");
    // task should be completed
    expect(snap2.tasks[0].status).toBe("completed");
  });

  it("should handle approval.reject and prevent task completion", async () => {
    adapter.playNormalFlow();
    await new Promise((r) => setTimeout(r, 200));

    const snap = store.getSnapshot();
    const approvalId = snap.approvals[0].approvalId;

    const cmd = makeCommand(
      CommandType.APPROVAL_REJECT,
      { approvalId, reason: "Not good enough" },
      approvalId
    );
    const result = await gateway.execute(cmd);
    expect(result.status).toBe("accepted");

    const snap2 = store.getSnapshot();
    expect(snap2.approvals[0].status).toBe("rejected");
    // task should NOT be completed
    expect(snap2.tasks[0].status).not.toBe("completed");
  });

  it("should return rejected for non-existent agent", async () => {
    const cmd = makeCommand(CommandType.AGENT_PAUSE, { agentId: "non-existent" });
    const result = await gateway.execute(cmd);
    expect(result.status).toBe("rejected");
  });

  it("should return rejected for already-resolved approval", async () => {
    adapter.playNormalFlow();
    await new Promise((r) => setTimeout(r, 200));

    const snap = store.getSnapshot();
    const approvalId = snap.approvals[0].approvalId;

    // accept first
    const acceptCmd = makeCommand(CommandType.APPROVAL_ACCEPT, { approvalId }, approvalId);
    await gateway.execute(acceptCmd);

    // try to accept again
    const acceptCmd2 = makeCommand(CommandType.APPROVAL_ACCEPT, { approvalId }, approvalId);
    const result = await gateway.execute(acceptCmd2);
    expect(result.status).toBe("rejected");
  });

  it("should play error flow (Worker blocked)", async () => {
    adapter.playErrorFlow();
    await new Promise((r) => setTimeout(r, 200));

    const snap = store.getSnapshot();
    const blockedTask = snap.tasks.find((t) => t.status === "blocked");
    expect(blockedTask).toBeDefined();
    expect(blockedTask!.blockedReason).toContain("数据源");

    const blockedAgent = snap.agents.find((a) => a.status === "blocked");
    expect(blockedAgent).toBeDefined();
  });

  it("should play revision flow (Reviewer returns revision_required)", async () => {
    adapter.playRevisionFlow();
    await new Promise((r) => setTimeout(r, 200));

    const snap = store.getSnapshot();
    const revisionArtifact = snap.artifacts.find(
      (a) => a.status === "revision_required"
    );
    expect(revisionArtifact).toBeDefined();
    expect(revisionArtifact!.reviewResult?.verdict).toBe("revision_required");
  });

  it("should reset to initial state", async () => {
    adapter.playNormalFlow();
    await new Promise((r) => setTimeout(r, 200));

    expect(store.getSnapshot().tasks.length).toBeGreaterThan(0);

    adapter.reset();

    // re-subscribe because reset clears internal state
    const snap = await adapter.getSnapshot();
    store.setSnapshot(snap);

    expect(snap.tasks).toHaveLength(0);
    expect(snap.artifacts).toHaveLength(0);
    expect(snap.approvals).toHaveLength(0);
    expect(snap.agents).toHaveLength(4);
  });

  it("should continue running after UI disconnects", async () => {
    // Simulate UI disconnect by unsubscribing
    const events: DomainEvent[] = [];
    const unsub = adapter.subscribe((e) => events.push(e));

    // create a task
    const cmd = makeCommand(CommandType.TASK_CREATE, {
      title: "Test",
      description: "desc",
    });
    await gateway.execute(cmd);

    // unsubscribe (simulate UI disconnect)
    unsub();

    // create another task
    const cmd2 = makeCommand(CommandType.TASK_CREATE, {
      title: "Test 2",
      description: "desc 2",
    });
    await gateway.execute(cmd2);

    // adapter should still have both tasks
    const snap = await adapter.getSnapshot();
    expect(snap.tasks).toHaveLength(2);
    // but events array should only have 1 (after unsubscribe)
    expect(events).toHaveLength(1);
  });

  it("should reject unsupported command type", async () => {
    const cmd = makeCommand("nonexistent.command", {});
    const result = await gateway.execute(cmd);
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
  });

  it("should maintain event log as append-only", async () => {
    const cmd = makeCommand(CommandType.TASK_CREATE, {
      title: "Test",
      description: "desc",
    });
    await gateway.execute(cmd);

    const log1 = adapter.getEventLog();
    const len1 = log1.length;

    // execute another command
    const cmd2 = makeCommand(CommandType.TASK_CREATE, {
      title: "Test 2",
      description: "desc 2",
    });
    await gateway.execute(cmd2);

    const log2 = adapter.getEventLog();
    expect(log2.length).toBeGreaterThan(len1);
    // earlier events should still be present
    expect(log2.slice(0, len1)).toEqual(log1);
  });
});
