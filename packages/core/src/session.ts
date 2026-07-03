/**
 * RuntimeSession — 框架无关的运行时会话生命周期 owner。
 *
 * 拥有完整链路：
 *   connect adapter
 *   → 建立事件订阅（snapshot-first，afterSequence = checkpoint.sequence）
 *   → 拉取并安装 snapshot checkpoint
 *   → 消费增量事件
 *   → 更新 CommandGateway snapshot
 *   → 暴露连接/会话状态
 *   → sequence gap 自动重同步
 *   → 干净断开
 *
 * React Hook 不再直接实现 adapter 恢复行为，全部委托给 RuntimeSession。
 *
 * Bootstrap 顺序（snapshot-first）：
 *   1. adapter.connect()
 *   2. adapter.getSnapshot() → store.setSnapshot()（安装 checkpoint）
 *   3. adapter.subscribe(handler, { afterSequence: snapshot.sequence })
 *
 * Adapter 契约保证：subscribe(afterSequence=N) 必须重放所有 sequence > N 的事件。
 * Mock 同步实现天然满足；真实 SSE adapter 在订阅时携带 Last-Event-ID 等价语义。
 *
 * Gap 恢复：
 *   applyEvent 返回 sequence_gap 时 → 状态转 resynchronizing →
 *   拉取新 snapshot → 安装为新 checkpoint → 恢复消费。
 *   并发 gap 不发起并发 resync（用 resyncing 标志位串行化）。
 */
import type {
  RuntimeAdapter,
  DomainEvent,
} from "@agent-office/protocol";
import type { SnapshotStore } from "./store.js";
import type { CommandGateway } from "./gateway.js";

export type SessionState =
  | "disconnected"
  | "connecting"
  | "synchronizing"
  | "connected"
  | "resynchronizing"
  | "degraded"
  | "failed";

export interface SessionStateListener {
  (state: SessionState, diagnostics: SessionDiagnostics): void;
}

export interface AcceptedEventListener {
  (event: DomainEvent): void;
}

export interface GapDiagnostic {
  /** 触发 gap 的事件 sequence */
  receivedSequence: number;
  /** 当时期望的 sequence */
  expectedSequence: number;
  /** gap 发生时间 ISO 8601 */
  at: string;
  /** 重同步使用的 checkpoint sequence */
  resyncedToSequence?: number;
}

export interface SessionDiagnostics {
  state: SessionState;
  lastSequence: number;
  /** runtime mismatch 错误（不可恢复） */
  runtimeMismatchError: string | null;
  /** 最近一次 gap 诊断 */
  lastGap: GapDiagnostic | null;
  /** 已发起的 resync 次数 */
  resyncCount: number;
}

export interface RuntimeSessionOptions {
  /** 重同步时是否自动恢复订阅消费，默认 true */
  autoResume?: boolean;
}

export class RuntimeSession {
  private adapter: RuntimeAdapter;
  private store: SnapshotStore;
  private gateway: CommandGateway;
  private options: Required<RuntimeSessionOptions>;

  private state: SessionState = "disconnected";
  private stateListeners = new Set<SessionStateListener>();
  private acceptedEventListeners = new Set<AcceptedEventListener>();

  private unsubscribeAdapter: (() => void) | null = null;
  private resyncing = false;
  private diagnostics: SessionDiagnostics = {
    state: "disconnected",
    lastSequence: 0,
    runtimeMismatchError: null,
    lastGap: null,
    resyncCount: 0,
  };

  constructor(
    adapter: RuntimeAdapter,
    store: SnapshotStore,
    gateway: CommandGateway,
    options: RuntimeSessionOptions = {}
  ) {
    this.adapter = adapter;
    this.store = store;
    this.gateway = gateway;
    this.options = { autoResume: true, ...options };
  }

  /** 当前会话状态 */
  getState(): SessionState {
    return this.state;
  }

  /** 当前诊断信息 */
  getDiagnostics(): SessionDiagnostics {
    return { ...this.diagnostics, state: this.state };
  }

  /** 订阅会话状态变更 */
  onStateChange(listener: SessionStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** 订阅已接受事件（已通过 transport 校验并入 store log，含 reducer_rejected）。 */
  onAcceptedEvent(listener: AcceptedEventListener): () => void {
    this.acceptedEventListeners.add(listener);
    return () => this.acceptedEventListeners.delete(listener);
  }

  /**
   * 启动会话：connect → snapshot → subscribe。
   * 幂等：已连接时直接返回。
   */
  async connect(): Promise<void> {
    if (this.state !== "disconnected" && this.state !== "failed") {
      return;
    }
    try {
      this.setState("connecting");
      await this.adapter.connect();

      this.setState("synchronizing");
      // 1. 拉取完整 snapshot 作为 checkpoint
      const snapshot = await this.adapter.getSnapshot();
      const installResult = this.store.setSnapshot(snapshot);
      if (!installResult.ok) {
        throw new Error(
          `Failed to install checkpoint: ${installResult.reason}`
        );
      }
      this.gateway.updateSnapshot(this.store.getSnapshot());
      this.diagnostics.lastSequence = snapshot.sequence;

      // 2. 订阅增量事件，从 checkpoint.sequence 之后开始
      this.unsubscribeAdapter = this.adapter.subscribe(
        (event) => this.handleEvent(event),
        { afterSequence: snapshot.sequence }
      );

      this.setState("connected");
    } catch (err) {
      this.diagnostics.runtimeMismatchError =
        err instanceof Error ? err.message : String(err);
      this.setState("failed");
      throw err;
    }
  }

  /** 处理来自 adapter 的增量事件 */
  private handleEvent(event: DomainEvent): void {
    const result = this.store.applyEvent(event);

    switch (result.code) {
      case "applied":
      case "reducer_rejected":
        // 两者都推进了 sequence 并入 log（reducer_rejected 仅状态未变）
        this.gateway.updateSnapshot(this.store.getSnapshot());
        this.diagnostics.lastSequence = event.sequence;
        this.notifyAccepted(event);
        break;

      case "duplicate":
      case "stale_sequence":
        // 静默丢弃，不触发 resync
        break;

      case "runtime_mismatch":
        // 不可恢复：surface 为会话错误，store 不被修改
        this.diagnostics.runtimeMismatchError =
          result.reason ?? "runtime mismatch";
        this.setState("degraded");
        break;

      case "sequence_gap":
        // 触发重同步
        this.recordGap(event, result.expectedSequence ?? 0);
        void this.resynchronize();
        break;
    }
  }

  /** 记录 gap 诊断 */
  private recordGap(event: DomainEvent, expectedSequence: number): void {
    this.diagnostics.lastGap = {
      receivedSequence: event.sequence,
      expectedSequence,
      at: new Date().toISOString(),
    };
  }

  /**
   * 重同步：拉取新 snapshot 作为新 checkpoint，恢复消费。
   * 用 resyncing 标志串行化，避免并发 gap 发起并发 resync。
   *
   * 公开方法：DemoControls 的 reset 等场景在重置 adapter 后可手动调用以重新安装 checkpoint。
   */
  async resynchronize(): Promise<void> {
    if (this.resyncing) {
      return;
    }
    this.resyncing = true;
    this.setState("resynchronizing");

    try {
      const snapshot = await this.adapter.getSnapshot();
      const installResult = this.store.setSnapshot(snapshot);
      if (!installResult.ok) {
        throw new Error(`Resync checkpoint rejected: ${installResult.reason}`);
      }
      this.gateway.updateSnapshot(this.store.getSnapshot());
      this.diagnostics.lastSequence = snapshot.sequence;
      this.diagnostics.resyncCount += 1;
      if (this.diagnostics.lastGap) {
        this.diagnostics.lastGap.resyncedToSequence = snapshot.sequence;
      }

      if (this.options.autoResume) {
        // 重新建立订阅，从新 checkpoint 之后开始
        if (this.unsubscribeAdapter) {
          this.unsubscribeAdapter();
          this.unsubscribeAdapter = null;
        }
        this.unsubscribeAdapter = this.adapter.subscribe(
          (event) => this.handleEvent(event),
          { afterSequence: snapshot.sequence }
        );
      }

      this.setState("connected");
    } catch (err) {
      this.diagnostics.runtimeMismatchError =
        err instanceof Error ? err.message : String(err);
      this.setState("failed");
    } finally {
      this.resyncing = false;
    }
  }

  /** 干净断开：取消订阅 + 断开 adapter */
  async disconnect(): Promise<void> {
    if (this.unsubscribeAdapter) {
      this.unsubscribeAdapter();
      this.unsubscribeAdapter = null;
    }
    try {
      await this.adapter.disconnect();
    } finally {
      this.setState("disconnected");
    }
  }

  private setState(state: SessionState): void {
    this.state = state;
    this.diagnostics.state = state;
    const diag = this.getDiagnostics();
    for (const listener of this.stateListeners) {
      listener(state, diag);
    }
  }

  private notifyAccepted(event: DomainEvent): void {
    for (const listener of this.acceptedEventListeners) {
      listener(event);
    }
  }
}
