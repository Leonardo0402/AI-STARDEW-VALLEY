/**
 * TestRuntimeAdapter — 仅用于测试的可控 RuntimeAdapter。
 *
 * 能力：
 * - 公开 emit(event)：向所有当前订阅者推送任意事件
 * - 延迟/失败 connect、getSnapshot、subscribe
 * - 记录所有 subscribe/unsubscribe 调用及其 cursor
 * - 维护内部 eventLog 支持 cursor-aware replay
 * - 可手动设置 snapshot（setSnapshot）模拟远程 checkpoint
 *
 * 不导出到 index.ts（仅测试文件直接 import）。
 */
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  DomainEvent,
  OfficeCommand,
  CommandResult,
  AdapterCapabilities,
  DomainEventHandler,
  Unsubscribe,
  SubscribeOptions,
} from "@agent-office/protocol";
import { ALL_EVENT_TYPES, ALL_COMMAND_TYPES } from "@agent-office/protocol";

export interface TestAdapterOptions {
  /** connect 延迟 ms */
  connectDelayMs?: number;
  /** connect 抛出的错误（若设置） */
  connectError?: Error;
  /** getSnapshot 延迟 ms */
  snapshotDelayMs?: number;
  /** getSnapshot 抛出的错误（若设置） */
  snapshotError?: Error;
  /** 初始 snapshot */
  initialSnapshot?: RuntimeSnapshot;
}

export interface SubscribeCall {
  cursor: number | undefined;
  timestamp: string;
}

export class TestRuntimeAdapter implements RuntimeAdapter {
  private connected = false;
  private snapshot: RuntimeSnapshot;
  private eventLog: DomainEvent[] = [];
  private subscribers = new Set<DomainEventHandler>();
  public connectDelayMs: number;
  public connectError: Error | undefined;

  /** 记录所有 subscribe 调用（cursor + 时间） */
  public subscribeCalls: SubscribeCall[] = [];
  /** 记录已发生的 unsubscribe 调用次数 */
  public unsubscribeCount = 0;
  /** subscribe 调用是否应抛出错误（用于测试 subscribe 失败） */
  public subscribeError: Error | null = null;
  /** getSnapshot 抛出的错误（可运行时修改以测试 resync 阶段失败） */
  public snapshotError: Error | null = null;
  /** getSnapshot 延迟 ms（可运行时修改以测试 resync 期间 disconnect 竞态） */
  public snapshotDelayMs: number;

  constructor(options: TestAdapterOptions = {}) {
    this.connectDelayMs = options.connectDelayMs ?? 0;
    this.connectError = options.connectError;
    this.snapshotDelayMs = options.snapshotDelayMs ?? 0;
    this.snapshotError = options.snapshotError ?? null;
    this.snapshot = structuredClone(
      options.initialSnapshot ?? this.createEmptySnapshot()
    );
  }

  private createEmptySnapshot(): RuntimeSnapshot {
    return {
      runtimeId: "test-runtime",
      snapshotId: "snap-init",
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

  // ─── RuntimeAdapter 接口 ───────────────────────────────────

  async connect(): Promise<void> {
    if (this.connectDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.connectDelayMs));
    }
    if (this.connectError) {
      throw this.connectError;
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.subscribers.clear();
  }

  async getSnapshot(): Promise<RuntimeSnapshot> {
    if (this.snapshotDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.snapshotDelayMs));
    }
    if (this.snapshotError) {
      throw this.snapshotError;
    }
    return structuredClone(this.snapshot);
  }

  subscribe(
    handler: DomainEventHandler,
    options?: SubscribeOptions
  ): Unsubscribe {
    if (this.subscribeError) {
      throw this.subscribeError;
    }
    const cursor = options?.afterSequence;
    this.subscribeCalls.push({
      cursor,
      timestamp: new Date().toISOString(),
    });

    // cursor-aware replay
    if (cursor !== undefined) {
      for (const event of this.eventLog) {
        if (event.sequence > cursor) {
          handler(event);
        }
      }
    }
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
      this.unsubscribeCount += 1;
    };
  }

  async execute(command: OfficeCommand): Promise<CommandResult> {
    return {
      commandId: command.commandId,
      status: "rejected",
      error: { code: "NOT_SUPPORTED", message: "TestAdapter does not execute" },
      affectedEventIds: [],
    };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportedEvents: ALL_EVENT_TYPES,
      supportedCommands: ALL_COMMAND_TYPES,
      features: {
        snapshot: true,
        sse: true,
        websocket: false,
        commandExecution: false,
        softMapping: false,
        hardOrchestration: false,
      },
    };
  }

  // ─── 测试控制方法 ───────────────────────────────────────────

  /** 向所有当前订阅者推送事件，并记入 eventLog（用于 cursor replay） */
  emit(event: DomainEvent): void {
    this.eventLog.push(event);
    // 更新 snapshot sequence 以保持一致
    if (event.sequence > this.snapshot.sequence) {
      this.snapshot.sequence = event.sequence;
      this.snapshot.lastEventId = event.eventId;
    }
    for (const handler of this.subscribers) {
      handler(event);
    }
  }

  /** 手动设置 snapshot（模拟远程 checkpoint 变化） */
  setSnapshot(snapshot: RuntimeSnapshot): void {
    this.snapshot = structuredClone(snapshot);
  }

  /** 获取内部 eventLog 副本 */
  getEventLog(): DomainEvent[] {
    return [...this.eventLog];
  }

  /** 当前活跃订阅者数量 */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /** 是否已连接 */
  isConnected(): boolean {
    return this.connected;
  }

  /** 清理所有状态（测试间重置） */
  reset(initialSnapshot?: RuntimeSnapshot): void {
    this.connected = false;
    this.subscribers.clear();
    this.eventLog = [];
    this.snapshot = structuredClone(initialSnapshot ?? this.createEmptySnapshot());
    this.subscribeCalls = [];
    this.unsubscribeCount = 0;
    this.subscribeError = null;
    this.snapshotError = null;
    this.snapshotDelayMs = 0;
  }
}
