/**
 * SnapshotStore — checkpoint 感知的事件溯源存储。
 *
 * 持有：
 * - baseSnapshot：最近一次可信的完整快照（checkpoint）；
 * - snapshot：当前物化状态（baseSnapshot + 增量事件）；
 * - eventLog：仅包含 baseSnapshot.sequence 之后被接受的事件。
 *
 * 核心规则：
 * - 外部不能直接修改 snapshot；
 * - 所有状态变更必须通过 applyEvent；
 * - 事件先经过 runtimeId / dedup / sequence 校验；
 * - 安装新 checkpoint（setSnapshot）原子地重置 base + current + log + dedup；
 * - rebuildFromLog 从 baseSnapshot 克隆开始重放 post-checkpoint 事件。
 */
import type {
  RuntimeSnapshot,
  DomainEvent,
  EventApplyResult,
  ReducerError,
} from "@agent-office/protocol";
import { reduceEvent } from "./reducer.js";
import { EventDeduplicator } from "./dedup.js";

export interface SnapshotStoreListener {
  (snapshot: RuntimeSnapshot): void;
}

/** 安装 checkpoint 的结构化结果。 */
export interface InstallCheckpointResult {
  ok: boolean;
  code: "installed" | "runtime_mismatch";
  reason?: string;
}

function createEmptySnapshot(runtimeId: string, snapshotId: string): RuntimeSnapshot {
  return {
    runtimeId,
    snapshotId,
    sequence: 0,
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

export class SnapshotStore {
  private baseSnapshot: RuntimeSnapshot;
  private snapshot: RuntimeSnapshot;
  private listeners = new Set<SnapshotStoreListener>();
  private dedup: EventDeduplicator;
  private eventLog: DomainEvent[] = [];
  private lastSequence = 0;
  private reducerErrors: ReducerError[] = [];

  constructor(runtimeId: string) {
    this.baseSnapshot = createEmptySnapshot(runtimeId, "snap-init-base");
    this.snapshot = createEmptySnapshot(runtimeId, "snap-init");
    this.dedup = new EventDeduplicator(10000);
  }

  /**
   * 应用事件到 snapshot，处理 runtimeId / dedup / sequence 校验。
   *
   * 校验顺序：runtimeId → duplicate eventId → stale sequence → sequence gap → reducer。
   * 被拒绝的事件（duplicate / runtime_mismatch / stale_sequence / sequence_gap）
   * 不会写入 dedup、event log，也不推进 lastSequence。
   *
   * reducer_rejected：事件通过 transport 校验，但 reducer 拒绝状态转换。
   * 此时 sequence 仍推进、事件仍入 log、dedup 仍标记（保持与 Runtime 单调一致）；
   * 但 **snapshot 状态保持不变**（事务性提交：errors 非空时不采用 reducer 的候选 snapshot），
   * listeners 仍被通知以便 UI 展示错误。
   *
   * 事务性语义：transport 接受 vs domain 提交分离。
   * - transport 接受：sequence 推进 + 入 log + 标记 dedup（与 Runtime 单调一致）
   * - domain 提交：仅当 reducer errors 为空时才采用 result.snapshot
   * replay 时同样逻辑，保证幂等一致。
   */
  applyEvent(event: DomainEvent): EventApplyResult {
    // runtimeId 校验：事件必须属于当前 Runtime
    if (event.runtimeId !== this.snapshot.runtimeId) {
      return {
        applied: false,
        code: "runtime_mismatch",
        reason: `event.runtimeId=${event.runtimeId} ≠ snapshot.runtimeId=${this.snapshot.runtimeId}`,
      };
    }

    // 去重：仅检查，不标记（标记留到 transport 校验通过后）
    if (this.dedup.isDuplicate(event.eventId)) {
      return { applied: false, code: "duplicate", reason: "duplicate eventId" };
    }

    // sequence 校验：严格单调递增，必须是 lastSequence + 1
    if (event.sequence <= this.lastSequence) {
      return {
        applied: false,
        code: "stale_sequence",
        reason: `stale sequence ${event.sequence} <= ${this.lastSequence}`,
        expectedSequence: this.lastSequence + 1,
        receivedSequence: event.sequence,
      };
    }
    if (event.sequence !== this.lastSequence + 1) {
      return {
        applied: false,
        code: "sequence_gap",
        reason: `expected ${this.lastSequence + 1}, got ${event.sequence}`,
        expectedSequence: this.lastSequence + 1,
        receivedSequence: event.sequence,
      };
    }

    // transport 校验全部通过：
    // - sequence 推进、事件入 log、dedup 标记（无论 reducer 是否拒绝）
    // - domain 提交：仅当 reducer errors 为空时才采用 result.snapshot
    const result = reduceEvent(this.snapshot, event);
    this.lastSequence = event.sequence;
    this.dedup.markSeen(event.eventId);
    this.eventLog.push(event);

    if (result.errors.length > 0) {
      // 事务性：不采用 reducer 的候选 snapshot，domain entities 保持不变
      // 但推进 snapshot 的 transport cursor 字段（sequence / lastEventId），
      // 使 snapshot.sequence 与 lastSequence 单调一致（修复 cursor 元数据分歧）。
      this.commitTransportMetadata(event);
      this.reducerErrors.push(...result.errors);
      this.notifyListeners();
      return {
        applied: false,
        code: "reducer_rejected",
        reason: result.errors[0].message,
        reducerErrors: [...result.errors],
      };
    }

    // domain 提交：reducer 无错误，采用新 snapshot
    this.snapshot = result.snapshot;
    this.notifyListeners();
    return { applied: true, code: "applied" };
  }

  /**
   * 安装一个远程完整快照作为新的 checkpoint。
   *
   * 原子地：
   * - 校验 runtimeId（不匹配则拒绝，store 状态完全不变）；
   * - 设置 base 和 current snapshot；
   * - 设置 lastSequence = snapshot.sequence；
   * - 清空增量 event log；
   * - 清空 dedup（post-checkpoint 事件重新开始去重）；
   * - 清空 reducer errors；
   * - 通知订阅者一次。
   *
   * 不保留旧 checkpoint 的增量事件（除非存在显式测试过的合并路径，目前没有）。
   */
  setSnapshot(snapshot: RuntimeSnapshot): InstallCheckpointResult {
    if (snapshot.runtimeId !== this.baseSnapshot.runtimeId) {
      return {
        ok: false,
        code: "runtime_mismatch",
        reason: `checkpoint.runtimeId=${snapshot.runtimeId} ≠ store.runtimeId=${this.baseSnapshot.runtimeId}`,
      };
    }
    this.baseSnapshot = structuredClone(snapshot);
    this.snapshot = structuredClone(snapshot);
    this.lastSequence = snapshot.sequence;
    this.dedup.clear();
    this.eventLog = [];
    this.reducerErrors = [];
    this.notifyListeners();
    return { ok: true, code: "installed" };
  }

  /** 获取当前 snapshot 的只读副本 */
  getSnapshot(): RuntimeSnapshot {
    return structuredClone(this.snapshot);
  }

  /** 获取当前 base checkpoint 的只读副本 */
  getBaseSnapshot(): RuntimeSnapshot {
    return structuredClone(this.baseSnapshot);
  }

  /** 订阅 snapshot 变更 */
  subscribe(listener: SnapshotStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 获取增量事件日志（仅 baseSnapshot 之后被接受的事件） */
  getEventLog(): DomainEvent[] {
    return [...this.eventLog];
  }

  /** 获取 reducer 产生的错误（非法转换等） */
  getErrors(): ReducerError[] {
    return [...this.reducerErrors];
  }

  /** 当前已应用到的 sequence */
  getLastSequence(): number {
    return this.lastSequence;
  }

  /** 重置到初始空状态（同时清空 base checkpoint） */
  reset(): void {
    const runtimeId = this.baseSnapshot.runtimeId;
    this.baseSnapshot = createEmptySnapshot(runtimeId, "snap-reset-base");
    this.snapshot = createEmptySnapshot(runtimeId, "snap-reset");
    this.dedup.clear();
    this.eventLog = [];
    this.lastSequence = 0;
    this.reducerErrors = [];
    this.notifyListeners();
  }

  /**
   * 从 base checkpoint 开始重放 post-checkpoint 事件日志。
   *
   * - 从 baseSnapshot 的克隆开始（保留初始 agents/rooms/approvals/artifacts）；
   * - 仅重放 eventLog 中的事件（已通过 transport 校验的可信事件）；
   * - 重建 snapshot、dedup、lastSequence、reducer errors、event log；
   * - 多次调用结果幂等一致。
   */
  rebuildFromLog(): void {
    // 保存完整 post-checkpoint log
    const events = [...this.eventLog];
    const runtimeId = this.baseSnapshot.runtimeId;

    // 从 base checkpoint 克隆开始重建
    this.snapshot = structuredClone(this.baseSnapshot);
    this.dedup.clear();
    this.eventLog = [];
    this.lastSequence = this.baseSnapshot.sequence;
    this.reducerErrors = [];

    // 重放：重建 snapshot + dedup + event log + lastSequence
    // 事务性：reducer errors 非空时不采用候选 snapshot（与 applyEvent 一致）
    for (const event of events) {
      const result = reduceEvent(this.snapshot, event);
      this.lastSequence = event.sequence;
      this.dedup.markSeen(event.eventId);
      this.eventLog.push(event);
      if (result.errors.length > 0) {
        this.reducerErrors.push(...result.errors);
        // 不采用 result.snapshot，domain entities 保持原状态
        // 但推进 transport cursor 字段（与 applyEvent 一致）
        this.commitTransportMetadata(event);
      } else {
        this.snapshot = result.snapshot;
      }
    }

    this.notifyListeners();
  }

  /**
   * 提交 transport cursor 元数据到当前 snapshot（reducer_rejected 时使用）。
   *
   * 保留所有 domain entities（agents / tasks / artifacts / approvals / rooms）
   * 的引用（浅拷贝），仅推进 transport cursor 字段 `sequence` 与 `lastEventId`，
   * 其他元数据（runtimeId / snapshotId / schemaVersion / createdAt）保持不变。
   *
   * 这保证 `getSnapshot().sequence === getLastSequence()`，使 Snapshot 可作为
   * 接受流位置的可信 cursor（修复 cursor 元数据分歧），不破坏事务性提交原则
   * （domain entities 仍与原引用一致）。
   */
  private commitTransportMetadata(event: DomainEvent): void {
    this.snapshot = {
      ...this.snapshot,
      sequence: event.sequence,
      lastEventId: event.eventId,
    };
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
