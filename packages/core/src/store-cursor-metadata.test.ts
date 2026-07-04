/**
 * SnapshotStore cursor metadata 测试（Task 1 / P0-1）。
 *
 * 验证 reducer_rejected 后 snapshot 的 transport cursor 字段（sequence / lastEventId）
 * 与 lastSequence 单调一致，且 domain entities 保持不变（事务性提交）。
 *
 * 覆盖：
 *   - applyEvent reducer_rejected 分支：cursor 推进 + domain 不变
 *   - rebuildFromLog 重放含 reducer_rejected 事件：cursor 同步推进 + domain 不变
 *   - 混合 applied / reducer_rejected 序列：最终 cursor = lastSequence，domain 仅含已提交事件
 */
import { describe, it, expect } from "vitest";
import { SnapshotStore } from "./store.js";
import {
  EventType,
  type DomainEvent,
  type RuntimeSnapshot,
} from "@agent-office/protocol";

const RUNTIME_ID = "test-runtime-cursor";

function makeEvent<P>(
  seq: number,
  type: string,
  payload: P,
  overrides: Partial<DomainEvent<P>> = {}
): DomainEvent<P> {
  const now = new Date().toISOString();
  return {
    eventId: `evt-${seq}-${Math.random().toString(36).slice(2, 8)}`,
    runtimeId: RUNTIME_ID,
    sequence: seq,
    schemaVersion: "1.0",
    type,
    occurredAt: now,
    receivedAt: now,
    correlationId: "corr-cursor",
    causationId: null,
    traceId: "trace-cursor",
    payload,
    ...overrides,
  };
}

function makeTaskCreatedEvent(seq: number, taskId: string): DomainEvent {
  return makeEvent(seq, EventType.TASK_CREATED, {
    taskId,
    title: `Task ${taskId}`,
    description: "",
    priority: "normal" as const,
    parentTaskId: null,
  });
}

function makeTaskStartedEvent(seq: number, taskId: string): DomainEvent {
  return makeEvent(seq, EventType.TASK_STARTED, {
    taskId,
    agentId: "agent-1",
  });
}

/** 构造一个含 2 agents + 2 rooms 的 base checkpoint。 */
function makeCheckpoint(sequence: number): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID,
    snapshotId: `snap-cp-${sequence}`,
    sequence,
    schemaVersion: "1.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastEventId: `evt-cp-${sequence}`,
    agents: [
      {
        agentId: "agent-1",
        runtimeId: RUNTIME_ID,
        name: "Worker-1",
        role: "worker",
        status: "idle",
        currentTaskId: null,
        currentRoomId: "room-exec",
        capabilityGrants: [],
        lastEventAt: "",
        blockedReason: null,
      },
    ],
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [
      {
        roomId: "room-exec",
        runtimeId: RUNTIME_ID,
        name: "Execution",
        type: "execution",
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        activeAgentIds: ["agent-1"],
        visualState: {},
      },
    ],
  };
}

describe("SnapshotStore cursor metadata (Task 1 / P0-1)", () => {
  describe("applyEvent: reducer_rejected 后 cursor 与 lastSequence 一致", () => {
    it("reducer_rejected 后 getSnapshot().sequence === getLastSequence()", () => {
      const store = new SnapshotStore(RUNTIME_ID);

      // 先正常创建任务（seq=1）
      const createEvt = makeTaskCreatedEvent(1, "t-1");
      store.applyEvent(createEvt);
      expect(store.getLastSequence()).toBe(1);
      expect(store.getSnapshot().sequence).toBe(1);
      expect(store.getSnapshot().lastEventId).toBe(createEvt.eventId);

      // reducer 拒绝：对不存在的任务执行 TASK_STARTED
      const rejectEvt = makeTaskStartedEvent(2, "non-existent");
      const result = store.applyEvent(rejectEvt);
      expect(result.code).toBe("reducer_rejected");

      // 关键断言：snapshot 的 cursor 元数据已推进
      expect(store.getLastSequence()).toBe(2);
      expect(store.getSnapshot().sequence).toBe(2);
      expect(store.getSnapshot().lastEventId).toBe(rejectEvt.eventId);
      // 一致性：两个 cursor 不再分歧
      expect(store.getSnapshot().sequence).toBe(store.getLastSequence());
    });

    it("连续多次 reducer_rejected，每次都推进 cursor", () => {
      const store = new SnapshotStore(RUNTIME_ID);

      // 第一次拒绝
      const r1 = store.applyEvent(makeTaskStartedEvent(1, "nope-1"));
      expect(r1.code).toBe("reducer_rejected");
      expect(store.getSnapshot().sequence).toBe(1);
      const evt1 = store.getEventLog()[0];
      expect(store.getSnapshot().lastEventId).toBe(evt1.eventId);

      // 第二次拒绝
      const r2 = store.applyEvent(makeTaskStartedEvent(2, "nope-2"));
      expect(r2.code).toBe("reducer_rejected");
      expect(store.getSnapshot().sequence).toBe(2);
      const evt2 = store.getEventLog()[1];
      expect(store.getSnapshot().lastEventId).toBe(evt2.eventId);

      // 第三次拒绝
      const r3 = store.applyEvent(makeTaskStartedEvent(3, "nope-3"));
      expect(r3.code).toBe("reducer_rejected");
      expect(store.getSnapshot().sequence).toBe(3);
      const evt3 = store.getEventLog()[2];
      expect(store.getSnapshot().lastEventId).toBe(evt3.eventId);

      expect(store.getLastSequence()).toBe(3);
    });

    it("reducer_rejected 后 domain entities 保持不变（事务性）", () => {
      const store = new SnapshotStore(RUNTIME_ID);

      const createEvt = makeTaskCreatedEvent(1, "t-domain");
      store.applyEvent(createEvt);
      const snapAfterCreate = store.getSnapshot();
      const tasksCountBefore = snapAfterCreate.tasks.length;
      const agentsCountBefore = snapAfterCreate.agents.length;

      // reducer 拒绝
      const rejectEvt = makeTaskStartedEvent(2, "non-existent");
      store.applyEvent(rejectEvt);

      const snapAfterReject = store.getSnapshot();
      // domain entities 完全不变
      expect(snapAfterReject.tasks).toHaveLength(tasksCountBefore);
      expect(snapAfterReject.agents).toHaveLength(agentsCountBefore);
      expect(snapAfterReject.artifacts).toHaveLength(0);
      expect(snapAfterReject.approvals).toHaveLength(0);
      expect(snapAfterReject.rooms).toHaveLength(0);
      // task 内容也不变
      expect(snapAfterReject.tasks[0].taskId).toBe("t-domain");
      expect(snapAfterReject.tasks[0].status).toBe("created");
    });

    it("applied 与 reducer_rejected 混合序列：最终 cursor = lastSequence，domain 仅含已提交事件", () => {
      const store = new SnapshotStore(RUNTIME_ID);

      // seq=1: applied (task.created)
      store.applyEvent(makeTaskCreatedEvent(1, "t-applied"));
      // seq=2: reducer_rejected (task.started on non-existent)
      store.applyEvent(makeTaskStartedEvent(2, "nope"));
      // seq=3: applied (another task.created)
      store.applyEvent(makeTaskCreatedEvent(3, "t-applied-2"));
      // seq=4: reducer_rejected
      store.applyEvent(makeTaskStartedEvent(4, "nope-2"));

      const snap = store.getSnapshot();
      expect(store.getLastSequence()).toBe(4);
      // cursor 一致
      expect(snap.sequence).toBe(4);
      expect(snap.lastEventId).toBe(store.getEventLog()[3].eventId);
      // domain 仅含两个已提交的 task
      expect(snap.tasks).toHaveLength(2);
      expect(snap.tasks.map((t) => t.taskId)).toEqual(["t-applied", "t-applied-2"]);
    });
  });

  describe("rebuildFromLog: 重放 reducer_rejected 事件后 cursor 同步推进", () => {
    it("rebuildFromLog 后 snapshot.sequence === lastSequence（含 reducer_rejected）", () => {
      const store = new SnapshotStore(RUNTIME_ID);

      // 构造混合 log
      store.applyEvent(makeTaskCreatedEvent(1, "t-1")); // applied
      store.applyEvent(makeTaskStartedEvent(2, "nope")); // reducer_rejected
      store.applyEvent(makeTaskCreatedEvent(3, "t-2")); // applied
      store.applyEvent(makeTaskStartedEvent(4, "nope-2")); // reducer_rejected

      const before = store.getSnapshot();
      expect(before.sequence).toBe(4);

      // 重放
      store.rebuildFromLog();
      const after = store.getSnapshot();

      // cursor 一致
      expect(store.getLastSequence()).toBe(4);
      expect(after.sequence).toBe(4);
      expect(after.lastEventId).toBe(store.getEventLog()[3].eventId);
    });

    it("rebuildFromLog 后 domain entities 与重放前一致（仅含 applied 事件的结果）", () => {
      const store = new SnapshotStore(RUNTIME_ID);

      store.applyEvent(makeTaskCreatedEvent(1, "t-1"));
      store.applyEvent(makeTaskStartedEvent(2, "nope")); // rejected
      store.applyEvent(makeTaskCreatedEvent(3, "t-2"));
      store.applyEvent(makeTaskStartedEvent(4, "nope-2")); // rejected

      const before = store.getSnapshot();

      store.rebuildFromLog();
      const after = store.getSnapshot();

      // domain 一致
      expect(after.tasks).toEqual(before.tasks);
      expect(after.agents).toEqual(before.agents);
      expect(after.artifacts).toEqual(before.artifacts);
      expect(after.approvals).toEqual(before.approvals);
      expect(after.rooms).toEqual(before.rooms);
      // tasks 数 = 已提交事件数（2）
      expect(after.tasks).toHaveLength(2);
    });

    it("rebuildFromLog 在 base checkpoint 之上重放 reducer_rejected：cursor 从 base 推进", () => {
      const store = new SnapshotStore(RUNTIME_ID);
      const cp = makeCheckpoint(10);
      store.setSnapshot(cp);

      // base 上增量：applied + rejected 混合
      store.applyEvent(makeTaskCreatedEvent(11, "t-cp-1")); // applied
      store.applyEvent(makeTaskStartedEvent(12, "nope")); // reducer_rejected
      store.applyEvent(makeTaskCreatedEvent(13, "t-cp-2")); // applied
      store.applyEvent(makeTaskStartedEvent(14, "nope-2")); // reducer_rejected

      const before = store.getSnapshot();
      expect(before.sequence).toBe(14);

      store.rebuildFromLog();
      const after = store.getSnapshot();

      expect(store.getLastSequence()).toBe(14);
      expect(after.sequence).toBe(14);
      expect(after.lastEventId).toBe(store.getEventLog()[3].eventId);
      // base 上的 agents / rooms 保留
      expect(after.agents).toHaveLength(1);
      expect(after.rooms).toHaveLength(1);
      // 增量 applied 事件的 domain 重建
      expect(after.tasks).toHaveLength(2);
    });

    it("rebuildFromLog 幂等：连续两次重放结果一致（除动态字段外）", () => {
      const store = new SnapshotStore(RUNTIME_ID);
      store.applyEvent(makeTaskCreatedEvent(1, "t-1"));
      store.applyEvent(makeTaskStartedEvent(2, "nope")); // rejected
      store.applyEvent(makeTaskCreatedEvent(3, "t-2"));

      store.rebuildFromLog();
      const snap1 = store.getSnapshot();

      store.rebuildFromLog();
      const snap2 = store.getSnapshot();

      // sequence / lastEventId 一致
      expect(snap2.sequence).toBe(snap1.sequence);
      expect(snap2.lastEventId).toBe(snap1.lastEventId);
      // domain 一致
      expect(snap2.tasks).toEqual(snap1.tasks);
      expect(snap2.agents).toEqual(snap1.agents);
    });
  });

  describe("cursor 元数据不变性：applied 与 transport 拒绝的对比", () => {
    it("transport 拒绝（duplicate / runtime_mismatch / stale_sequence / sequence_gap）不推进 cursor", () => {
      const store = new SnapshotStore(RUNTIME_ID);

      // applied
      const e1 = makeTaskCreatedEvent(1, "t-1");
      store.applyEvent(e1);
      expect(store.getSnapshot().sequence).toBe(1);
      expect(store.getSnapshot().lastEventId).toBe(e1.eventId);

      // duplicate：同一 eventId
      const dup = store.applyEvent(e1);
      expect(dup.code).toBe("duplicate");
      // cursor 未变
      expect(store.getSnapshot().sequence).toBe(1);
      expect(store.getSnapshot().lastEventId).toBe(e1.eventId);
      expect(store.getLastSequence()).toBe(1);

      // stale_sequence：相同 sequence，用不同 eventId 避免先被 dedup 拦截
      const stale = store.applyEvent(makeTaskCreatedEvent(1, "t-stale"));
      expect(stale.code).toBe("stale_sequence");
      expect(store.getSnapshot().sequence).toBe(1);

      // sequence_gap：跳过 seq=2 直接到 seq=5
      const gap = store.applyEvent(makeTaskCreatedEvent(5, "t-gap"));
      expect(gap.code).toBe("sequence_gap");
      expect(store.getSnapshot().sequence).toBe(1);

      // runtime_mismatch：合法 sequence + 不同 runtimeId
      const mismatchEvt = makeEvent(
        2,
        EventType.TASK_CREATED,
        {
          taskId: "t-mm",
          title: "MM",
          description: "",
          priority: "normal" as const,
          parentTaskId: null,
        },
        { runtimeId: "other-runtime" }
      );
      const mismatchResult = store.applyEvent(mismatchEvt);
      expect(mismatchResult.code).toBe("runtime_mismatch");
      expect(store.getSnapshot().sequence).toBe(1);

      // 关键对比：以上 transport 拒绝都不推进 cursor；
      // 但 reducer_rejected 会推进 cursor（因为 transport 已接受）
      const reject = store.applyEvent(makeTaskStartedEvent(2, "non-existent"));
      expect(reject.code).toBe("reducer_rejected");
      expect(store.getSnapshot().sequence).toBe(2);
      expect(store.getLastSequence()).toBe(2);
    });
  });
});
