/**
 * 集成测试 — 验证完整链路：
 * 用户命令 → CommandGateway → MockRuntimeAdapter → DomainEvent
 *          → SnapshotStore → OfficeProjection
 *
 * 这一层测试跨包协作，但不涉及 React/PixiJS（避免 DOM 依赖）。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import {
  SnapshotStore,
  CommandGateway,
  projectSnapshot,
} from "@agent-office/core";
import type { OfficeCommand, DomainEvent } from "@agent-office/protocol";
import { CommandType, EventType } from "@agent-office/protocol";

describe("集成测试: 完整链路", () => {
  let adapter: MockRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let receivedEvents: DomainEvent[];

  beforeEach(async () => {
    adapter = new MockRuntimeAdapter({ eventDelayMs: 0 });
    store = new SnapshotStore("mock-runtime-001");
    gateway = new CommandGateway(adapter);
    receivedEvents = [];

    await adapter.connect();
    const snap = await adapter.getSnapshot();
    store.setSnapshot(snap);
    gateway.updateSnapshot(snap);

    adapter.subscribe({
      onEvent: (event) => {
        receivedEvents.push(event);
        store.applyEvent(event);
        // 关键：同步更新 gateway 持有的 snapshot，否则 policy 校验会用到旧 snapshot
        gateway.updateSnapshot(store.getSnapshot());
      },
    });
  });

  it("完整链路：task.create 命令 → 事件 → snapshot 变更 → projection 反映", async () => {
    const beforeCount = store.getSnapshot().tasks.length;

    const command: OfficeCommand = {
      commandId: "cmd-int-1",
      commandType: CommandType.TASK_CREATE,
      timestamp: new Date().toISOString(),
      source: "user",
      actorId: "user-1",
      runtimeId: "mock-runtime-001",
      targetId: null,
      payload: { title: "集成测试任务", description: "验证完整链路", priority: "high" },
    };

    const result = await gateway.execute(command);

    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds.length).toBe(1);

    // 事件被推送到订阅者
    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].type).toBe(EventType.TASK_CREATED);

    // Snapshot 更新
    const snap = store.getSnapshot();
    expect(snap.tasks.length).toBe(beforeCount + 1);
    expect(snap.tasks[snap.tasks.length - 1].title).toBe("集成测试任务");

    // Projection 反映
    const proj = projectSnapshot(snap);
    const task = proj.tasks.find((t) => t.title === "集成测试任务");
    expect(task).toBeDefined();
    expect(task!.status).toBe("created");
  });

  it("完整链路：正常流程脚本 → 审批请求 → 用户批准 → 任务完成", async () => {
    // 播放正常流程（同步执行，eventDelayMs=0）
    adapter.playNormalFlow();

    // 等待所有事件处理（脚本有 12 步，每步通过 setTimeout(0) 调度）
    await new Promise((resolve) => setTimeout(resolve, 300));

    const snapBeforeApprove = store.getSnapshot();
    const pendingApprovals = snapBeforeApprove.approvals.filter(
      (a) => a.status === "requested"
    );
    expect(pendingApprovals.length).toBe(1);

    // 用户批准
    const approveCmd: OfficeCommand = {
      commandId: "cmd-int-approve",
      commandType: CommandType.APPROVAL_ACCEPT,
      timestamp: new Date().toISOString(),
      source: "user",
      actorId: "user-1",
      runtimeId: "mock-runtime-001",
      targetId: pendingApprovals[0].approvalId,
      payload: { approvalId: pendingApprovals[0].approvalId },
    };

    const result = await gateway.execute(approveCmd);
    expect(result.status).toBe("accepted");

    const snapAfterApprove = store.getSnapshot();
    const approval = snapAfterApprove.approvals.find(
      (a) => a.approvalId === pendingApprovals[0].approvalId
    );
    expect(approval?.status).toBe("approved");

    // 任务应该完成
    const completedTasks = snapAfterApprove.tasks.filter(
      (t) => t.status === "completed"
    );
    expect(completedTasks.length).toBeGreaterThan(0);
  });

  it("完整链路：用户拒绝审批 → 任务进入 revision_required", async () => {
    adapter.playNormalFlow();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const snap = store.getSnapshot();
    const pendingApproval = snap.approvals.find((a) => a.status === "requested");
    expect(pendingApproval).toBeDefined();

    const rejectCmd: OfficeCommand = {
      commandId: "cmd-int-reject",
      commandType: CommandType.APPROVAL_REJECT,
      timestamp: new Date().toISOString(),
      source: "user",
      actorId: "user-1",
      runtimeId: "mock-runtime-001",
      targetId: pendingApproval!.approvalId,
      payload: { approvalId: pendingApproval!.approvalId, reason: "测试拒绝" },
    };

    const result = await gateway.execute(rejectCmd);
    expect(result.status).toBe("accepted");

    const snapAfter = store.getSnapshot();
    const approval = snapAfter.approvals.find(
      (a) => a.approvalId === pendingApproval!.approvalId
    );
    expect(approval?.status).toBe("rejected");

    // 关联任务应该不是 completed
    const task = snapAfter.tasks.find(
      (t) => t.approvalId === pendingApproval!.approvalId
    );
    expect(task).toBeDefined();
    expect(task!.status).not.toBe("completed");
  });

  it("完整链路：返工 → 新版本 Artifact → 重新审查通过 → 审批 → 任务完成", async () => {
    // 播放返工流程（包含完整返工周期：拒绝 → 返工 → v2 Artifact → 重新审查通过 → 审批请求）
    adapter.playRevisionFlow();
    // 返工流程步骤较多（约 20 步），等待稍长
    await new Promise((resolve) => setTimeout(resolve, 500));

    const snapBeforeApprove = store.getSnapshot();

    // 1. 应存在两个 Artifact：v1（revision_required）和 v2（approved）
    const artifacts = snapBeforeApprove.artifacts;
    expect(artifacts.length).toBe(2);
    const v1 = artifacts.find((a) => a.version === 1);
    const v2 = artifacts.find((a) => a.version === 2);
    expect(v1).toBeDefined();
    expect(v2).toBeDefined();
    expect(v1!.status).toBe("revision_required");
    expect(v2!.status).toBe("approved");

    // 2. 应存在一个 pending 审批（返工完成后重新请求）
    const pendingApprovals = snapBeforeApprove.approvals.filter(
      (a) => a.status === "requested"
    );
    expect(pendingApprovals.length).toBe(1);

    // 3. 关联任务应处于 waiting_approval
    const approvalTask = snapBeforeApprove.tasks.find(
      (t) => t.approvalId === pendingApprovals[0].approvalId
    );
    expect(approvalTask).toBeDefined();
    expect(approvalTask!.status).toBe("waiting_approval");

    // 4. 用户批准 → 任务完成
    const approveCmd: OfficeCommand = {
      commandId: "cmd-int-rework-approve",
      commandType: CommandType.APPROVAL_ACCEPT,
      timestamp: new Date().toISOString(),
      source: "user",
      actorId: "user-1",
      runtimeId: "mock-runtime-001",
      targetId: pendingApprovals[0].approvalId,
      payload: { approvalId: pendingApprovals[0].approvalId },
    };

    const result = await gateway.execute(approveCmd);
    expect(result.status).toBe("accepted");

    const snapAfterApprove = store.getSnapshot();
    const approval = snapAfterApprove.approvals.find(
      (a) => a.approvalId === pendingApprovals[0].approvalId
    );
    expect(approval?.status).toBe("approved");

    // 任务应该完成
    const completedTask = snapAfterApprove.tasks.find(
      (t) => t.taskId === approvalTask!.taskId
    );
    expect(completedTask!.status).toBe("completed");
  });

  it("完整链路：Adapter 重置后 Store 也可重置", async () => {
    adapter.playNormalFlow();
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(store.getSnapshot().tasks.length).toBeGreaterThan(0);

    adapter.reset();
    store.reset();
    const freshSnap = await adapter.getSnapshot();
    store.setSnapshot(freshSnap);

    expect(store.getSnapshot().tasks.length).toBe(0);
    expect(store.getSnapshot().agents.length).toBe(4); // 4 个初始 agents
    expect(store.getEventLog().length).toBe(0);
  });

  it("完整链路：replay 后 snapshot 一致（事件可重建部分）", async () => {
    adapter.playNormalFlow();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const before = store.getSnapshot();

    store.rebuildFromLog();
    const after = store.getSnapshot();

    // agents 和 rooms 来自初始 snapshot（非事件创建），replay 后会丢失
    // 只比较事件可重建的部分：tasks、artifacts、approvals
    // 忽略动态字段 createdAt、reviewedAt、startedAt、lastEventAt
    const normalize = (items: any[]) =>
      items.map((item) => {
        const { createdAt, startedAt, completedAt, reviewedAt, lastEventAt, ...rest } = item;
        return rest;
      });

    expect(normalize(after.tasks)).toEqual(normalize(before.tasks));
    expect(normalize(after.artifacts)).toEqual(normalize(before.artifacts));
    expect(normalize(after.approvals)).toEqual(normalize(before.approvals));
  });

  it("完整链路：UI 断开（取消订阅）不影响 Runtime 继续工作", async () => {
    // 取消订阅（模拟 UI 卸载）
    const sub = adapter.subscribe({ onEvent: () => {} });
    await sub.ready;
    await Promise.resolve(sub.close());

    // Adapter 仍然可以执行命令
    const cmd: OfficeCommand = {
      commandId: "cmd-int-disconnect",
      commandType: CommandType.TASK_CREATE,
      timestamp: new Date().toISOString(),
      source: "user",
      actorId: "user-1",
      runtimeId: "mock-runtime-001",
      targetId: null,
      payload: { title: "断链测试", description: "UI 断开后命令仍可执行" },
    };

    const result = await gateway.execute(cmd);
    expect(result.status).toBe("accepted");

    // Adapter 自身状态更新了
    const snap = await adapter.getSnapshot();
    expect(snap.tasks.some((t) => t.title === "断链测试")).toBe(true);
  });
});
