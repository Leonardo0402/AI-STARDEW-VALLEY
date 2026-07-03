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
 *
 * 硬化保证（Issue #4）：
 *   - 共享 in-flight Promise：并发 connect / resynchronize 复用同一个 Promise，真正单飞。
 *   - Epoch race safety：disconnect 递增 epoch，延迟操作在每个 await 后校验 epoch 是否变化，
 *     变化即 bail out，避免延迟的 connect/resync 在 disconnect 之后安装 snapshot 或重建订阅。
 *   - 事务性 reducer 提交：reducer 出错时 store 不替换 snapshot（store 内部保证），session 仍推进
 *     sequence / 入 log / 记录 dedup，并把 reducerErrors 透传给 accepted listener。
 *   - 结构化 diagnostics：lastError 取代 runtimeMismatchError，按错误类型分类；hasActiveSubscription
 *     / activeSubscriptionCursor 暴露当前订阅状态。
 */
import type {
  RuntimeAdapter,
  DomainEvent,
  EventApplyResult,
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

/** 结构化错误分类 */
export type SessionErrorCode =
  | "runtime_mismatch"
  | "connect_failed"
  | "snapshot_failed"
  | "subscribe_failed"
  | "resync_failed"
  | "disconnect_failed";

export interface SessionError {
  code: SessionErrorCode;
  message: string;
  at: string;
}

export interface SessionStateListener {
  (state: SessionState, diagnostics: SessionDiagnostics): void;
}

export interface AcceptedEventListener {
  (event: DomainEvent, result: EventApplyResult): void;
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
  /**
   * 最近一次会话级错误，按错误类型分类。
   * 取代旧版 runtimeMismatchError 字段（仅能承载 runtime_mismatch 一类）。
   */
  lastError: SessionError | null;
  /** 最近一次 gap 诊断 */
  lastGap: GapDiagnostic | null;
  /** 已发起的 resync 次数 */
  resyncCount: number;
  /** 当前是否持有活跃订阅 */
  hasActiveSubscription: boolean;
  /** 当前活跃订阅的 afterSequence 游标；无订阅时为 null */
  activeSubscriptionCursor: number | null;
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
  /**
   * Epoch token：每次 disconnect 递增。
   * 延迟操作（connect / resync）在每个 await 后校验自己的 epoch 是否仍为当前值，
   * 不一致即 bail out，避免在 disconnect 之后继续安装 snapshot / 重建订阅。
   */
  private epoch = 0;
  /** 共享 in-flight Promise：并发的 connect() 复用同一个 Promise，真正单飞。 */
  private connectPromise: Promise<void> | null = null;
  /** 共享 in-flight Promise：并发的 resynchronize() 复用同一个 Promise，真正单飞。 */
  private resyncPromise: Promise<void> | null = null;
  /** 当前活跃订阅的 afterSequence 游标；无订阅时为 null。 */
  private activeSubscriptionCursor: number | null = null;
  private diagnostics: SessionDiagnostics = {
    state: "disconnected",
    lastSequence: 0,
    lastError: null,
    lastGap: null,
    resyncCount: 0,
    hasActiveSubscription: false,
    activeSubscriptionCursor: null,
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
   *
   * 硬化语义（Issue #4）：
   *   - 共享 in-flight Promise：并发调用复用同一个 connectPromise，真正单飞。
   *   - epoch race safety：doConnect 在每个 await 后校验 epoch；disconnect 之后延迟到达的
   *     snapshot / subscribe 不会污染已断开的 session。
   *   - 失败分类：connect 失败 / snapshot 失败 / subscribe 失败分别记录为对应 SessionErrorCode。
   *
   * 幂等：已连接/连接中时直接返回同一个 Promise。
   */
  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    if (this.state !== "disconnected" && this.state !== "failed") {
      return;
    }
    this.connectPromise = this.doConnect();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async doConnect(): Promise<void> {
    const myEpoch = this.epoch;
    let adapterConnected = false;
    try {
      this.setState("connecting");
      try {
        await this.adapter.connect();
      } catch (err) {
        throw this.makeSessionError(
          "connect_failed",
          err instanceof Error ? err.message : String(err)
        );
      }
      adapterConnected = true;
      if (this.epoch !== myEpoch) {
        // disconnect 已发生 — best-effort 清理 adapter 连接
        try {
          await this.adapter.disconnect();
        } catch {
          /* best-effort */
        }
        return;
      }

      this.setState("synchronizing");
      // 1. 拉取完整 snapshot 作为 checkpoint
      let snapshot;
      try {
        snapshot = await this.adapter.getSnapshot();
      } catch (err) {
        throw this.makeSessionError(
          "snapshot_failed",
          err instanceof Error ? err.message : String(err)
        );
      }
      if (this.epoch !== myEpoch) return; // disconnect 已发生

      const installResult = this.store.setSnapshot(snapshot);
      if (!installResult.ok) {
        throw this.makeSessionError(
          "snapshot_failed",
          `Failed to install checkpoint: ${installResult.reason}`
        );
      }
      this.gateway.updateSnapshot(this.store.getSnapshot());
      this.diagnostics.lastSequence = snapshot.sequence;

      // 2. 订阅增量事件，从 checkpoint.sequence 之后开始
      try {
        this.installSubscription(snapshot.sequence);
      } catch (err) {
        throw this.makeSessionError(
          "subscribe_failed",
          err instanceof Error ? err.message : String(err)
        );
      }

      this.setState("connected");
    } catch (err) {
      // 若是 disconnect 引发的 epoch 变化，不再写入错误
      if (this.epoch !== myEpoch) return;
      // bootstrap 失败（snapshot / subscribe）且 adapter 已连接 — best-effort 清理
      if (adapterConnected) {
        try {
          await this.adapter.disconnect();
        } catch {
          /* best-effort */
        }
      }
      this.recordError(err);
      this.setState("failed");
      throw err;
    }
  }

  /** 处理来自 adapter 的增量事件 */
  private handleEvent(event: DomainEvent): void {
    // resync 期间忽略增量事件：避免在旧订阅尚未拆除时混入与 checkpoint 不一致的事件。
    if (this.state === "resynchronizing") {
      return;
    }
    const result = this.store.applyEvent(event);

    switch (result.code) {
      case "applied":
      case "reducer_rejected":
        // 两者都推进了 sequence 并入 log（reducer_rejected 仅状态未变 — 事务性提交保证）
        this.gateway.updateSnapshot(this.store.getSnapshot());
        this.diagnostics.lastSequence = event.sequence;
        this.notifyAccepted(event, result);
        break;

      case "duplicate":
      case "stale_sequence":
        // 静默丢弃，不触发 resync
        break;

      case "runtime_mismatch":
        // 不可恢复：surface 为结构化 SessionError，store 不被修改
        this.recordError(
          this.makeSessionError(
            "runtime_mismatch",
            result.reason ?? "runtime mismatch"
          )
        );
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
   *
   * 硬化语义（Issue #4）：
   *   - 共享 in-flight Promise：并发的 resynchronize() 复用同一个 resyncPromise，真正单飞。
   *     旧版用 resyncing boolean 标志位无法让并发调用方 await 同一个 Promise。
   *   - epoch race safety：doResynchronize 在每个 await 后校验 epoch；disconnect 之后延迟到达的
   *     snapshot 不会污染已断开的 session；resync 失败时不留活跃订阅。
   *   - 先拆旧订阅：进入 resynchronizing 后立即 removeSubscription，避免在等待 snapshot 期间
   *     旧订阅继续推送事件造成混乱。
   *   - resync 失败：状态转 failed，不再保留订阅，lastError = resync_failed。
   *
   * 公开方法：DemoControls 的 reset 等场景在重置 adapter 后可手动调用以重新安装 checkpoint。
   */
  async resynchronize(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    if (this.resyncPromise) return this.resyncPromise;
    this.resyncPromise = this.doResynchronize();
    try {
      await this.resyncPromise;
    } finally {
      this.resyncPromise = null;
    }
  }

  private async doResynchronize(): Promise<void> {
    const myEpoch = this.epoch;
    // 立即转 resynchronizing + 拆旧订阅，避免旧订阅在等待 snapshot 期间继续推送
    this.setState("resynchronizing");
    this.removeSubscription();

    try {
      const snapshot = await this.adapter.getSnapshot();
      if (this.epoch !== myEpoch) return; // disconnect 已发生

      const installResult = this.store.setSnapshot(snapshot);
      if (!installResult.ok) {
        throw this.makeSessionError(
          "resync_failed",
          `Resync checkpoint rejected: ${installResult.reason}`
        );
      }
      this.gateway.updateSnapshot(this.store.getSnapshot());
      this.diagnostics.lastSequence = snapshot.sequence;
      this.diagnostics.resyncCount += 1;
      if (this.diagnostics.lastGap) {
        this.diagnostics.lastGap.resyncedToSequence = snapshot.sequence;
      }

      if (this.options.autoResume) {
        // 重新建立订阅，从新 checkpoint 之后开始
        if (this.epoch !== myEpoch) return; // disconnect 已发生
        try {
          this.installSubscription(snapshot.sequence);
        } catch (err) {
          throw this.makeSessionError(
            "subscribe_failed",
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      this.setState("connected");
    } catch (err) {
      if (this.epoch !== myEpoch) return;
      // resync 失败：不留活跃订阅，避免错误状态下继续消费
      this.removeSubscription();
      this.recordError(
        this.isSessionError(err)
          ? err
          : this.makeSessionError(
              "resync_failed",
              err instanceof Error ? err.message : String(err)
            )
      );
      this.setState("failed");
    }
  }

  /**
   * 干净断开：取消订阅 + 断开 adapter。
   *
   * 硬化语义（Issue #4）：
   *   - 递增 epoch：让正在 in-flight 的 connect / resync 在下一次 await 后感知到 disconnect
   *     并 bail out，避免延迟到达的 snapshot / subscribe 污染已断开的 session。
   *   - 先 removeSubscription：立即停止向 handleEvent 投递事件。
   *   - disconnect 失败也记录为 disconnect_failed SessionError，但状态仍转 disconnected。
   */
  async disconnect(): Promise<void> {
    this.epoch += 1;
    this.removeSubscription();
    try {
      await this.adapter.disconnect();
    } catch (err) {
      this.recordError(
        this.makeSessionError(
          "disconnect_failed",
          err instanceof Error ? err.message : String(err)
        )
      );
      this.setState("disconnected");
      return;
    }
    this.setState("disconnected");
  }

  /** 安装新订阅并刷新 activeSubscriptionCursor / diagnostics */
  private installSubscription(afterSequence: number): void {
    this.unsubscribeAdapter = this.adapter.subscribe(
      (event) => this.handleEvent(event),
      { afterSequence }
    );
    this.activeSubscriptionCursor = afterSequence;
    this.diagnostics.hasActiveSubscription = true;
    this.diagnostics.activeSubscriptionCursor = afterSequence;
  }

  /**
   * 拆除当前订阅（如有），并清空订阅相关的 diagnostics。
   * 集中化以便 disconnect / resync 失败 / resync 开始前复用。
   */
  private removeSubscription(): void {
    if (this.unsubscribeAdapter) {
      this.unsubscribeAdapter();
      this.unsubscribeAdapter = null;
    }
    this.activeSubscriptionCursor = null;
    this.diagnostics.hasActiveSubscription = false;
    this.diagnostics.activeSubscriptionCursor = null;
  }

  /** 构造结构化 SessionError */
  private makeSessionError(code: SessionErrorCode, message: string): SessionError {
    return { code, message, at: new Date().toISOString() };
  }

  /** 判断抛出的错误是否已经是结构化 SessionError */
  private isSessionError(err: unknown): err is SessionError {
    return (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      "message" in err &&
      "at" in err
    );
  }

  /** 记录错误到 diagnostics.lastError */
  private recordError(err: unknown): void {
    if (this.isSessionError(err)) {
      this.diagnostics.lastError = err;
      return;
    }
    // doConnect 中抛出的原始错误需要按发生阶段分类
    const message = err instanceof Error ? err.message : String(err);
    // 启发式分类：connect 阶段抛错通常来自 adapter.connect()，归为 connect_failed。
    // 其它路径（snapshot / subscribe）若已用 makeSessionError 包装则走上面分支。
    const code: SessionErrorCode =
      this.state === "connecting" ? "connect_failed" : "subscribe_failed";
    this.diagnostics.lastError = this.makeSessionError(code, message);
  }

  private setState(state: SessionState): void {
    this.state = state;
    this.diagnostics.state = state;
    const diag = this.getDiagnostics();
    for (const listener of this.stateListeners) {
      listener(state, diag);
    }
  }

  private notifyAccepted(event: DomainEvent, result: EventApplyResult): void {
    for (const listener of this.acceptedEventListeners) {
      listener(event, result);
    }
  }
}
