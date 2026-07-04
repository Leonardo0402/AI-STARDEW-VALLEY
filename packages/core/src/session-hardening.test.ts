/**
 * RuntimeSession 硬化测试（Issue #4）。
 *
 * 使用 TestRuntimeAdapter（公开 emit、可注入延迟/失败、记录 subscribe/unsubscribe）
 * 验证：
 *   - 真实 gap 触发恰好一次 resync；duplicate/stale 不触发
 *   - runtime mismatch 体现为结构化 lastError
 *   - resync 先拆旧订阅再安装新 checkpoint
 *   - resync 失败不留活跃订阅
 *   - 并发 connect / resynchronize 共享 in-flight Promise（单飞）
 *   - disconnect 期间延迟的 connect/resync 因 epoch 校验 bail out
 *   - 结构化 diagnostics 分类：connect_failed / snapshot_failed / subscribe_failed
 *   - 事务性 reducer：reducer_rejected 不改 snapshot 但推进 sequence
 *   - accepted 历史仅含 applied + reducer_rejected
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TestRuntimeAdapter } from "./test-adapter.js";
import {
  SnapshotStore,
  CommandGateway,
  RuntimeSession,
} from "./index.js";
import {
  EventType,
  type DomainEvent,
  type RuntimeSnapshot,
} from "@agent-office/protocol";
import type { SessionState } from "./session.js";

const RUNTIME_ID = "test-runtime-001";

function makeInitialSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID,
    snapshotId: `snap-init-${seq}`,
    sequence: seq,
    schemaVersion: "1.0",
    createdAt: new Date().toISOString(),
    lastEventId: "",
    agents: [],
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [],
  };
}

function makeEvent(
  seq: number,
  type: string,
  payload: unknown,
  overrides: Partial<DomainEvent> = {}
): DomainEvent {
  const now = new Date().toISOString();
  return {
    eventId: `evt-${seq}-${Math.random().toString(36).slice(2, 8)}`,
    runtimeId: RUNTIME_ID,
    sequence: seq,
    schemaVersion: "1.0",
    type,
    occurredAt: now,
    receivedAt: now,
    correlationId: "corr-test",
    causationId: null,
    traceId: "trace-test",
    payload,
    ...overrides,
  };
}

function makeTaskCreatedEvent(seq: number, taskId: string): DomainEvent {
  return makeEvent(seq, EventType.TASK_CREATED, {
    taskId,
    title: `Task ${taskId}`,
    description: "",
    priority: "normal",
    parentTaskId: null,
  });
}

function makeTaskStartedEvent(seq: number, taskId: string): DomainEvent {
  return makeEvent(seq, EventType.TASK_STARTED, {
    taskId,
    agentId: "agent-1",
  });
}

/** 等待 session 状态达到目标值（或超时） */
function waitForState(
  session: RuntimeSession,
  target: SessionState,
  timeoutMs = 500
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (session.getState() === target) return resolve();
    const timer = setTimeout(() => {
      unsub();
      reject(
        new Error(
          `Timeout waiting for state "${target}", current="${session.getState()}"`
        )
      );
    }, timeoutMs);
    const unsub = session.onStateChange((s) => {
      if (s === target) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });
}

describe("RuntimeSession 硬化 (Issue #4)", () => {
  let adapter: TestRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;

  beforeEach(() => {
    adapter = new TestRuntimeAdapter({
      initialSnapshot: makeInitialSnapshot(),
    });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);
  });

  // ─── P0: 可验证的恢复 ───────────────────────────────────────

  describe("可验证的恢复 (verifiable recovery)", () => {
    it("真实 gap 触发恰好一次 resync，新 checkpoint 安装后恢复 connected", async () => {
      await session.connect();
      const baseSeq = store.getLastSequence();
      expect(baseSeq).toBe(0);

      // 构造 gap 事件：sequence = baseSeq + 5
      const gapEvent = makeTaskCreatedEvent(baseSeq + 5, "t-gap");
      adapter.emit(gapEvent);

      // 等待 resync 完成
      await waitForState(session, "connected");
      const diag = session.getDiagnostics();
      expect(diag.resyncCount).toBe(1);
      expect(diag.lastSequence).toBe(baseSeq + 5);
      // 新订阅已建立，cursor = 新 checkpoint sequence
      expect(diag.hasActiveSubscription).toBe(true);
      expect(diag.activeSubscriptionCursor).toBe(baseSeq + 5);
      // subscribe 被调用两次：初始 + resync
      expect(adapter.subscribeCalls).toHaveLength(2);
      expect(adapter.subscribeCalls[0].cursor).toBe(0);
      expect(adapter.subscribeCalls[1].cursor).toBe(baseSeq + 5);
    });

    it("duplicate 事件不触发 resync", async () => {
      await session.connect();
      const baseSeq = store.getLastSequence();

      const evt = makeTaskCreatedEvent(baseSeq + 1, "t-dup");
      adapter.emit(evt);
      // 同一 eventId 再次 emit
      adapter.emit(evt);

      await new Promise((r) => setTimeout(r, 50));
      expect(session.getDiagnostics().resyncCount).toBe(0);
      expect(session.getState()).toBe("connected");
    });

    it("stale sequence 事件不触发 resync", async () => {
      await session.connect();
      const baseSeq = store.getLastSequence();

      const evt1 = makeTaskCreatedEvent(baseSeq + 1, "t-1");
      adapter.emit(evt1);
      // stale：sequence 小于等于已应用
      const evt2 = makeTaskCreatedEvent(baseSeq + 1, "t-stale");
      adapter.emit(evt2);

      await new Promise((r) => setTimeout(r, 50));
      expect(session.getDiagnostics().resyncCount).toBe(0);
    });

    it("runtime mismatch 体现为结构化 lastError，状态转 degraded", async () => {
      await session.connect();
      const snapBefore = store.getSnapshot();

      const mismatchEvent = makeTaskCreatedEvent(
        store.getLastSequence() + 1,
        "t-mismatch"
      );
      mismatchEvent.runtimeId = "other-runtime";
      adapter.emit(mismatchEvent);

      const diag = session.getDiagnostics();
      expect(session.getState()).toBe("degraded");
      expect(diag.lastError).not.toBeNull();
      expect(diag.lastError!.code).toBe("runtime_mismatch");
      // store 未被修改
      expect(store.getSnapshot()).toEqual(snapBefore);
    });

    it("resync 先拆旧订阅再安装新 checkpoint（snapshot 延迟期间验证）", async () => {
      // 用带延迟的新 adapter
      const delayedAdapter = new TestRuntimeAdapter({
        initialSnapshot: makeInitialSnapshot(),
        snapshotDelayMs: 30,
      });
      const delayedSession = new RuntimeSession(
        delayedAdapter,
        new SnapshotStore(RUNTIME_ID),
        new CommandGateway(delayedAdapter)
      );
      await delayedSession.connect();
      const baseSeq = delayedSession.getDiagnostics().lastSequence;

      // 触发 gap → resync 进入，但 getSnapshot 被 30ms 延迟
      const gapEvent = makeTaskCreatedEvent(baseSeq + 5, "t-gap");
      delayedAdapter.emit(gapEvent);

      // 等待 resync 进入 resynchronizing 状态
      await waitForState(delayedSession, "resynchronizing");
      // 在 snapshot 延迟期间：旧订阅应已拆除
      expect(delayedAdapter.unsubscribeCount).toBe(1);
      expect(delayedAdapter.getSubscriberCount()).toBe(0);
      expect(delayedSession.getDiagnostics().hasActiveSubscription).toBe(false);

      // 等待 resync 完成
      await waitForState(delayedSession, "connected");
      expect(delayedAdapter.getSubscriberCount()).toBe(1);
      expect(delayedSession.getDiagnostics().hasActiveSubscription).toBe(true);
    });

    it("resync 失败（getSnapshot 抛错）不留活跃订阅，lastError = resync_failed", async () => {
      await session.connect();
      const baseSeq = store.getLastSequence();

      // 注入 snapshot 错误（仅影响 resync 的 getSnapshot）
      adapter.snapshotError = new Error("snapshot boom");

      const gapEvent = makeTaskCreatedEvent(baseSeq + 5, "t-gap");
      adapter.emit(gapEvent);

      await waitForState(session, "failed");
      const diag = session.getDiagnostics();
      expect(diag.lastError).not.toBeNull();
      expect(diag.lastError!.code).toBe("resync_failed");
      expect(diag.hasActiveSubscription).toBe(false);
      expect(diag.activeSubscriptionCursor).toBeNull();
      expect(adapter.getSubscriberCount()).toBe(0);
    });
  });

  // ─── P0: 共享 in-flight 操作 ───────────────────────────────

  describe("共享 in-flight Promise (single-flight)", () => {
    it("并发 connect 复用同一个 Promise，adapter.connect 仅被调用一次", async () => {
      const slowAdapter = new TestRuntimeAdapter({
        initialSnapshot: makeInitialSnapshot(),
        connectDelayMs: 30,
      });
      const slowSession = new RuntimeSession(
        slowAdapter,
        new SnapshotStore(RUNTIME_ID),
        new CommandGateway(slowAdapter)
      );

      const p1 = slowSession.connect();
      const p2 = slowSession.connect();
      await Promise.all([p1, p2]);

      expect(slowSession.getState()).toBe("connected");
      // subscribe 仅一次（单飞）
      expect(slowAdapter.subscribeCalls).toHaveLength(1);
    });

    it("并发 resynchronize 复用同一个 Promise，resync 仅触发一次", async () => {
      await session.connect();

      const p1 = session.resynchronize();
      const p2 = session.resynchronize();
      await Promise.all([p1, p2]);

      expect(session.getState()).toBe("connected");
      expect(session.getDiagnostics().resyncCount).toBe(1);
      // 仅有一次新的 subscribe（resync 后重建的）
      expect(adapter.subscribeCalls).toHaveLength(2); // 初始 1 + resync 1
    });
  });

  // ─── P1: disconnect 竞态安全 ───────────────────────────────

  describe("disconnect 竞态安全 (epoch race safety)", () => {
    it("disconnect 期间延迟的 connect bail out，不安装 snapshot / 不订阅", async () => {
      const slowAdapter = new TestRuntimeAdapter({
        initialSnapshot: makeInitialSnapshot(),
        connectDelayMs: 50,
      });
      const slowSession = new RuntimeSession(
        slowAdapter,
        new SnapshotStore(RUNTIME_ID),
        new CommandGateway(slowAdapter)
      );

      const connectPromise = slowSession.connect();
      // 立刻 disconnect（在 adapter.connect 延迟期间）
      await slowSession.disconnect();
      // 等待 connect Promise 落定（应静默返回，不抛错）
      await connectPromise;

      expect(slowSession.getState()).toBe("disconnected");
      expect(slowSession.getDiagnostics().hasActiveSubscription).toBe(false);
      // subscribe 从未被调用
      expect(slowAdapter.subscribeCalls).toHaveLength(0);
      // adapter 连接未泄漏：延迟的 connect 成功后因 epoch 校验被 best-effort 清理
      expect(slowAdapter.isConnected()).toBe(false);
    });

    it("disconnect 期间延迟的 resync bail out，不重建订阅", async () => {
      // 先正常连接（无延迟）
      await session.connect();
      const baseSeq = store.getLastSequence();

      // 注入 snapshot 延迟以模拟 resync 期间的窗口
      adapter.snapshotDelayMs = 50;

      // 触发 gap 启动 resync
      const gapEvent = makeTaskCreatedEvent(baseSeq + 5, "t-gap");
      adapter.emit(gapEvent);
      await waitForState(session, "resynchronizing");

      // 在 resync 等待 snapshot 期间 disconnect
      await session.disconnect();

      // 等待任何后续 promise 落定
      await new Promise((r) => setTimeout(r, 100));

      expect(session.getState()).toBe("disconnected");
      // resync bail out 后不应重建订阅
      expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
      // 仅有初始的 1 次 subscribe（resync 的 subscribe 因 epoch 校验未执行）
      // 注意：subscribeCalls 可能为 1（初始）或 2（如果 resync 在 disconnect 之前完成了 subscribe）
      // 关键验证：当前无活跃订阅
      expect(adapter.getSubscriberCount()).toBe(0);
    });
  });

  // ─── P1: 结构化 diagnostics ────────────────────────────────

  describe("结构化 diagnostics (错误分类)", () => {
    it("connect 阶段失败 → lastError.code = connect_failed", async () => {
      const failAdapter = new TestRuntimeAdapter({
        initialSnapshot: makeInitialSnapshot(),
        connectError: new Error("connect boom"),
      });
      const failSession = new RuntimeSession(
        failAdapter,
        new SnapshotStore(RUNTIME_ID),
        new CommandGateway(failAdapter)
      );

      await expect(failSession.connect()).rejects.toThrow("connect boom");
      expect(failSession.getState()).toBe("failed");
      const diag = failSession.getDiagnostics();
      expect(diag.lastError).not.toBeNull();
      expect(diag.lastError!.code).toBe("connect_failed");
      expect(diag.lastError!.message).toContain("connect boom");
    });

    it("snapshot 阶段失败 → lastError.code = snapshot_failed", async () => {
      const failAdapter = new TestRuntimeAdapter({
        initialSnapshot: makeInitialSnapshot(),
        snapshotError: new Error("snapshot boom"),
      });
      const failSession = new RuntimeSession(
        failAdapter,
        new SnapshotStore(RUNTIME_ID),
        new CommandGateway(failAdapter)
      );

      await expect(failSession.connect()).rejects.toThrow("snapshot boom");
      expect(failSession.getState()).toBe("failed");
      const diag = failSession.getDiagnostics();
      expect(diag.lastError).not.toBeNull();
      expect(diag.lastError!.code).toBe("snapshot_failed");
    });

    it("bootstrap 失败后 adapter 被清理", async () => {
      const failAdapter = new TestRuntimeAdapter({
        initialSnapshot: makeInitialSnapshot(),
        snapshotError: new Error("snapshot boom"),
      });
      const failSession = new RuntimeSession(
        failAdapter,
        new SnapshotStore(RUNTIME_ID),
        new CommandGateway(failAdapter)
      );

      await expect(failSession.connect()).rejects.toThrow("snapshot boom");
      expect(failSession.getState()).toBe("failed");
      // adapter 连接被 best-effort 清理，未泄漏
      expect(failAdapter.isConnected()).toBe(false);
    });

    it("subscribe 阶段失败 → lastError.code = subscribe_failed", async () => {
      const failAdapter = new TestRuntimeAdapter({
        initialSnapshot: makeInitialSnapshot(),
      });
      failAdapter.subscribeError = new Error("subscribe boom");
      const failSession = new RuntimeSession(
        failAdapter,
        new SnapshotStore(RUNTIME_ID),
        new CommandGateway(failAdapter)
      );

      await expect(failSession.connect()).rejects.toThrow("subscribe boom");
      expect(failSession.getState()).toBe("failed");
      const diag = failSession.getDiagnostics();
      expect(diag.lastError).not.toBeNull();
      expect(diag.lastError!.code).toBe("subscribe_failed");
    });

    it("disconnect 阶段失败 → lastError.code = disconnect_failed，状态仍 disconnected", async () => {
      await session.connect();

      // 让 adapter.disconnect 抛错
      let disconnectCalled = false;
      adapter.disconnect = async () => {
        disconnectCalled = true;
        throw new Error("disconnect boom");
      };

      await session.disconnect();
      expect(disconnectCalled).toBe(true);
      expect(session.getState()).toBe("disconnected");
      const diag = session.getDiagnostics();
      expect(diag.lastError).not.toBeNull();
      expect(diag.lastError!.code).toBe("disconnect_failed");
    });
  });

  // ─── P0: 事务性 reducer 提交 ───────────────────────────────

  describe("事务性 reducer 提交", () => {
    it("reducer_rejected 不修改 snapshot 但推进 sequence + 入 log", async () => {
      await session.connect();
      const baseSeq = store.getLastSequence();

      // 先正常创建一个任务
      const createEvt = makeTaskCreatedEvent(baseSeq + 1, "t-1");
      adapter.emit(createEvt);
      await new Promise((r) => setTimeout(r, 10));
      expect(store.getSnapshot().tasks).toHaveLength(1);
      const seqAfterCreate = store.getLastSequence();
      expect(seqAfterCreate).toBe(baseSeq + 1);

      // 构造 reducer 拒绝事件：对不存在的任务执行 TASK_STARTED
      const rejectEvt = makeTaskStartedEvent(seqAfterCreate + 1, "non-existent");
      adapter.emit(rejectEvt);
      await new Promise((r) => setTimeout(r, 10));

      // sequence 推进了
      expect(store.getLastSequence()).toBe(seqAfterCreate + 1);
      // 但 snapshot 状态未变（tasks 仍为 1）
      expect(store.getSnapshot().tasks).toHaveLength(1);
      // reducer 错误被记录（结构化 ReducerError[]）
      const errors = store.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[errors.length - 1].message).toContain("non-existent");
      expect(errors[errors.length - 1].code).toBe("entity_not_found");
      expect(errors[errors.length - 1].entityPath).toBe("tasks:non-existent");
      // 事件入 log
      const log = store.getEventLog();
      expect(log.some((e) => e.eventId === rejectEvt.eventId)).toBe(true);
    });

    it("reducer_rejected 事件仍被 onAcceptedEvent 推送（含结构化 result）", async () => {
      await session.connect();
      const accepted: DomainEvent[] = [];
      const results: { code: string; reducerErrors?: unknown }[] = [];
      session.onAcceptedEvent((e, result) => {
        accepted.push(e);
        results.push({
          code: result.code,
          reducerErrors: result.reducerErrors,
        });
      });

      const baseSeq = store.getLastSequence();
      const rejectEvt = makeTaskStartedEvent(baseSeq + 1, "non-existent");
      adapter.emit(rejectEvt);
      await new Promise((r) => setTimeout(r, 10));

      expect(accepted.some((e) => e.eventId === rejectEvt.eventId)).toBe(true);
      // 验证 result 透传：reducer_rejected 事件携带结构化 reducerErrors
      const rejectResult = results.find((r) => r.code === "reducer_rejected");
      expect(rejectResult).toBeDefined();
      expect(rejectResult!.reducerErrors).toBeDefined();
      expect((rejectResult!.reducerErrors as Array<{ message: string }>).length).toBeGreaterThan(0);
    });
  });

  // ─── P1: Listener 契约 ─────────────────────────────────────

  describe("Listener / accepted 历史契约", () => {
    it("accepted 历史仅含 applied + reducer_rejected，不含 transport 拒绝事件", async () => {
      await session.connect();
      const accepted: DomainEvent[] = [];
      session.onAcceptedEvent((e) => accepted.push(e));

      const baseSeq = store.getLastSequence();

      // 1. applied 事件
      const appliedEvt = makeTaskCreatedEvent(baseSeq + 1, "t-applied");
      adapter.emit(appliedEvt);
      await new Promise((r) => setTimeout(r, 10));

      // 2. duplicate 事件（同一 eventId）
      adapter.emit(appliedEvt);
      await new Promise((r) => setTimeout(r, 10));

      // 3. reducer_rejected 事件
      const rejectEvt = makeTaskStartedEvent(baseSeq + 2, "non-existent");
      adapter.emit(rejectEvt);
      await new Promise((r) => setTimeout(r, 10));

      // 4. runtime_mismatch 事件
      const mismatchEvt = makeTaskCreatedEvent(baseSeq + 3, "t-mismatch");
      mismatchEvt.runtimeId = "other-runtime";
      adapter.emit(mismatchEvt);
      await new Promise((r) => setTimeout(r, 10));

      // 5. gap 事件（触发 resync）
      const gapEvt = makeTaskCreatedEvent(baseSeq + 10, "t-gap");
      adapter.emit(gapEvt);
      await waitForState(session, "connected");

      // 验证：accepted 历史仅含 applied + reducer_rejected
      const acceptedIds = accepted.map((e) => e.eventId);
      expect(acceptedIds).toContain(appliedEvt.eventId);
      expect(acceptedIds).toContain(rejectEvt.eventId);
      // duplicate 不应重复出现
      expect(
        acceptedIds.filter((id) => id === appliedEvt.eventId)
      ).toHaveLength(1);
      // runtime_mismatch 不应出现
      expect(acceptedIds).not.toContain(mismatchEvt.eventId);
      // gap 事件不应出现在 accepted（它触发了 resync）
      expect(acceptedIds).not.toContain(gapEvt.eventId);
    });
  });
});
