/**
 * SnapshotStore — 持有当前 RuntimeSnapshot，应用事件并通知订阅者。
 *
 * 核心规则：
 * - 外部不能直接修改 snapshot
 * - 所有状态变更必须通过 applyEvent
 * - 事件先经过去重和 sequence 校验
 */
import type {
  RuntimeSnapshot,
  DomainEvent,
} from "@agent-office/protocol";
import { reduceEvent } from "./reducer.js";
import { EventDeduplicator } from "./dedup.js";

export interface SnapshotStoreListener {
  (snapshot: RuntimeSnapshot): void;
}

export class SnapshotStore {
  private snapshot: RuntimeSnapshot;
  private listeners = new Set<SnapshotStoreListener>();
  private dedup: EventDeduplicator;
  private eventLog: DomainEvent[] = [];
  private lastSequence = 0;
  private reducerErrors: string[] = [];

  constructor(runtimeId: string) {
    this.snapshot = {
      runtimeId,
      snapshotId: `snap-init`,
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
    this.dedup = new EventDeduplicator(10000);
  }

  /** 应用事件到 snapshot，处理去重和 sequence 校验 */
  applyEvent(event: DomainEvent): { applied: boolean; reason?: string } {
    // 去重
    if (this.dedup.checkAndMark(event.eventId)) {
      return { applied: false, reason: "duplicate eventId" };
    }

    // sequence 校验：严格单调递增，不允许回退或相等
    // （相等由 dedup 按 eventId 拦截；不同 eventId 但相同 sequence 同样非法）
    if (event.sequence <= this.lastSequence) {
      return { applied: false, reason: `stale sequence ${event.sequence} <= ${this.lastSequence}` };
    }

    const result = reduceEvent(this.snapshot, event);
    this.snapshot = result.snapshot;
    this.lastSequence = event.sequence;
    this.eventLog.push(event);
    if (result.errors.length > 0) {
      this.reducerErrors.push(...result.errors);
    }

    this.notifyListeners();
    return { applied: true };
  }

  /** 直接设置 snapshot（用于初始化或断线恢复后全量拉取） */
  setSnapshot(snapshot: RuntimeSnapshot): void {
    this.snapshot = structuredClone(snapshot);
    this.lastSequence = snapshot.sequence;
    this.dedup.clear();
    this.notifyListeners();
  }

  /** 获取当前 snapshot 的只读副本 */
  getSnapshot(): RuntimeSnapshot {
    return structuredClone(this.snapshot);
  }

  /** 订阅 snapshot 变更 */
  subscribe(listener: SnapshotStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 获取事件日志（append-only） */
  getEventLog(): DomainEvent[] {
    return [...this.eventLog];
  }

  /** 获取 reducer 产生的错误（非法转换等） */
  getErrors(): string[] {
    return [...this.reducerErrors];
  }

  /** 重置到初始状态 */
  reset(): void {
    const runtimeId = this.snapshot.runtimeId;
    this.snapshot = {
      runtimeId,
      snapshotId: `snap-reset`,
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
    this.dedup.clear();
    this.eventLog = [];
    this.lastSequence = 0;
    this.reducerErrors = [];
    this.notifyListeners();
  }

  /** 从事件日志重建 snapshot */
  rebuildFromLog(): void {
    const events = [...this.eventLog];
    const runtimeId = this.snapshot.runtimeId;
    this.reset();
    this.dedup.clear();
    for (const event of events) {
      const result = reduceEvent(this.snapshot, event);
      this.snapshot = result.snapshot;
      this.lastSequence = event.sequence;
      if (result.errors.length > 0) {
        this.reducerErrors.push(...result.errors);
      }
    }
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
