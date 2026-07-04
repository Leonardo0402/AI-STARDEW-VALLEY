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
  RuntimeStreamObserver,
  RuntimeStreamState,
  RuntimeSubscription,
  RuntimeStreamError,
  ReconnectPolicy,
} from "@agent-office/protocol";
import { defaultReconnectPolicy } from "@agent-office/protocol";
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
  | "disconnect_failed"
  | "reconnect_failed";

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
  /** 累计重连次数（含成功/失败），永不重置 */
  reconnectCount: number;
  /** 当前是否持有活跃订阅 */
  hasActiveSubscription: boolean;
  /** 当前活跃订阅的 afterSequence 游标；无订阅时为 null */
  activeSubscriptionCursor: number | null;
}

export interface RuntimeSessionOptions {
  /** 重同步时是否自动恢复订阅消费，默认 true */
  autoResume?: boolean;
  /** 重连退避策略；不传使用 defaultReconnectPolicy */
  reconnectPolicy?: ReconnectPolicy;
}

export class RuntimeSession {
  private adapter: RuntimeAdapter;
  private store: SnapshotStore;
  private gateway: CommandGateway;
  private options: Required<Omit<RuntimeSessionOptions, "reconnectPolicy">>;

  private state: SessionState = "disconnected";
  private stateListeners = new Set<SessionStateListener>();
  private acceptedEventListeners = new Set<AcceptedEventListener>();

  private subscription: RuntimeSubscription | null = null;
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
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Single-flight: in-flight reconnect Promise. scheduleReconnect() checks BOTH timer AND this. */
  private reconnectPromise: Promise<void> | null = null;
  /** Current backoff counter (resets to 0 on successful reconnect). */
  private reconnectAttempts = 0;
  private reconnectPolicy: ReconnectPolicy;
  /** 当前活跃订阅的 afterSequence 游标；无订阅时为 null。 */
  private activeSubscriptionCursor: number | null = null;
  private diagnostics: SessionDiagnostics = {
    state: "disconnected",
    lastSequence: 0,
    lastError: null,
    lastGap: null,
    resyncCount: 0,
    reconnectCount: 0,
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
    this.reconnectPolicy = options.reconnectPolicy ?? defaultReconnectPolicy;
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
      let subscription: RuntimeSubscription;
      try {
        subscription = this.installSubscription(snapshot.sequence);
      } catch (err) {
        throw this.makeSessionError(
          "subscribe_failed",
          err instanceof Error ? err.message : String(err)
        );
      }

      // 等待流就绪（replay 完成）后才进入 connected
      try {
        await subscription.ready;
      } catch (err) {
        // close the failed subscription before throwing
        await this.removeSubscription();
        throw this.makeSessionError(
          "subscribe_failed",
          err instanceof Error ? err.message : String(err)
        );
      }

      // epoch check: disconnect may have happened during await ready
      if (this.epoch !== myEpoch) {
        await this.removeSubscription();
        return;
      }
      // subscription may have been replaced by a concurrent resync
      if (this.subscription !== subscription) {
        return;
      }
      // state may have changed (e.g. resync triggered by replay gap)
      if (
        this.state === "degraded" ||
        this.state === "resynchronizing" ||
        this.state === "failed"
      ) {
        return;
      }
      this.setState("connected");
    } catch (err) {
      // 若是 disconnect 引发的 epoch 变化，不再写入错误
      if (this.epoch !== myEpoch) return;
      // bootstrap 失败（snapshot / subscribe）且 adapter 已连接 — best-effort 清理
      await this.removeSubscription();
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
    // 订阅已拆除 — 丢弃延迟到达的事件（async close 窗口）
    if (!this.subscription) {
      return;
    }
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
        this.triggerResync();
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
    this.resyncPromise = this.resynchronizeOrThrow();
    try {
      await this.resyncPromise;
    } catch (err) {
      // Swallow — Plan 1 compat. State already set to failed inside resynchronizeOrThrow.
      void err;
    } finally {
      this.resyncPromise = null;
    }
  }

  /**
   * Private resynchronize that RE-THROWS on failure.
   * Used by doReconnect() which needs to know success/failure to decide
   * whether to reset reconnectAttempts or schedule another retry.
   *
   * On failure: sets state to "failed", records error, then THROWS.
   * (Caller decides whether to catch — public resynchronize() catches;
   *  doReconnect() catches to schedule retry.)
   */
  private async resynchronizeOrThrow(): Promise<void> {
    const myEpoch = this.epoch;
    this.setState("resynchronizing");
    await this.removeSubscription();

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
        let subscription: RuntimeSubscription;
        try {
          subscription = this.installSubscription(snapshot.sequence);
        } catch (err) {
          throw this.makeSessionError(
            "subscribe_failed",
            err instanceof Error ? err.message : String(err)
          );
        }

        // 等待流就绪（replay 完成）后才进入 connected
        try {
          await subscription.ready;
        } catch (err) {
          await this.removeSubscription();
          throw this.makeSessionError(
            "subscribe_failed",
            err instanceof Error ? err.message : String(err)
          );
        }

        if (this.epoch !== myEpoch) {
          await this.removeSubscription();
          return;
        }
        if (this.subscription !== subscription) {
          return;
        }
        if (
          this.state === "degraded" ||
          this.state === "failed"
        ) {
          return;
        }
      }

      this.setState("connected");
    } catch (err) {
      // On failure: ensure no stale subscription, set failed, then RE-THROW.
      await this.removeSubscription();
      if (this.epoch !== myEpoch) return; // disconnect caused the failure — don't set failed
      // Wrap non-SessionError throws (e.g. raw getSnapshot errors) as resync_failed,
      // matching Plan 1 doResynchronize behavior. SessionError throws (subscribe_failed
      // from installSubscription/ready, resync_failed from setSnapshot) pass through.
      this.recordError(
        this.isSessionError(err)
          ? err
          : this.makeSessionError(
              "resync_failed",
              err instanceof Error ? err.message : String(err)
            )
      );
      this.setState("failed");
      throw err;
    }
  }

  /**
   * 内部触发重同步：从 handleEvent（replay-time gap）调用。
   *
   * 与 resynchronize() 的区别：跳过 connectPromise 守卫。handleEvent 可能在
   * doConnect 的 replay 期间被调用（subscription.ready 微任务内），此时
   * connectPromise 仍非空，但 replay-time gap 必须立即触发 resync —— 否则
   * 永远不会进入 resync（resyncCount 卡在 0）。
   *
   * 仍保留 resyncPromise 单飞：若已有 resync 进行中，直接返回。
   * 外部调用方仍应使用 resynchronize()（保留 connectPromise 守卫防止
   * in-flight connect 期间外部 resync 造成订阅泄漏）。
   */
  private triggerResync(): void {
    if (this.resyncPromise) return;
    this.resyncPromise = this.resynchronizeOrThrow();
    void this.resyncPromise
      .catch(() => {
        // resynchronizeOrThrow sets state to "failed" and records the error before
        // re-throwing; swallow here to avoid unhandled rejection.
      })
      .finally(() => {
        this.resyncPromise = null;
      });
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
    // 1. Clear reconnect timer (cancels pending backoff).
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // 2. Await in-flight reconnect (with epoch guard — epoch already incremented,
    //    so doReconnectInner will bail out on its epoch check; but we still await
    //    to ensure no post-disconnect state mutation).
    if (this.reconnectPromise) {
      try { await this.reconnectPromise; } catch { /* epoch guard handles */ }
    }
    // 3. Reset backoff counter (reconnectCount stays cumulative in diagnostics).
    this.reconnectAttempts = 0;
    // 4. Remove subscription + disconnect adapter.
    await this.removeSubscription();
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
  private installSubscription(afterSequence: number): RuntimeSubscription {
    const observer: RuntimeStreamObserver = {
      onEvent: (event) => this.handleEvent(event),
      onError: (error) => this.handleStreamError(error),
      onState: (state) => this.handleStreamState(state),
    };
    const subscription = this.adapter.subscribe(observer, { afterSequence });
    this.subscription = subscription;
    this.activeSubscriptionCursor = afterSequence;
    this.diagnostics.hasActiveSubscription = true;
    this.diagnostics.activeSubscriptionCursor = afterSequence;
    return subscription;
  }

  private handleStreamError(error: RuntimeStreamError): void {
    if (!this.subscription) return;
    // event_log_trimmed is paired with onState("reset_required") — route it to
    // the single reset-recovery path, NOT the backoff-reconnect path.
    if (error.code === "event_log_trimmed") {
      // The adapter will also call onState("reset_required") — that triggers
      // triggerResetRecovery(). Just close the subscription here; don't schedule
      // a competing backoff reconnect.
      return;
    }
    if (error.recoverable) {
      // Recoverable: degrade + schedule reconnect (single-flight).
      this.setState("degraded");
      this.scheduleReconnect();
    } else {
      // Non-recoverable: CLOSE SUBSCRIPTION FIRST, then set failed.
      void this.handleNonRecoverableError(error);
    }
  }

  private async handleNonRecoverableError(error: RuntimeStreamError): Promise<void> {
    const myEpoch = this.epoch;
    await this.removeSubscription();
    if (this.epoch !== myEpoch) return; // disconnect won the race
    const sessionCode: SessionErrorCode =
      error.code === "authentication_failed" ? "subscribe_failed" :
      error.code === "stream_protocol_error" ? "subscribe_failed" :
      "subscribe_failed";
    this.recordError(this.makeSessionError(sessionCode, error.message));
    this.setState("failed");
  }

  private handleStreamState(state: RuntimeStreamState): void {
    if (state === "reset_required") {
      // Immediate resync, no backoff. Shares the reconnectPromise lock with
      // backoff reconnect so reset_required and event_log_trimmed can't fire
      // two competing recovery operations.
      void this.triggerResetRecovery();
    }
  }

  /**
   * Single-flight reset recovery. Shares `reconnectPromise` with `doReconnect()`
   * so reset_required (from onState) and event_log_trimmed (from onError) can't
   * fire two competing recovery operations.
   *
   * If a backoff timer is pending, cancel it — reset is immediate, no backoff.
   * If recovery fails, fall back to `scheduleReconnect()` (which may itself
   * give up at maxAttempts via `handleTerminalReconnectFailure`).
   */
  private async triggerResetRecovery(): Promise<void> {
    if (this.reconnectPromise !== null) return; // recovery already in-flight
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.state === "disconnected" || this.state === "failed") return;

    const myEpoch = this.epoch;
    const holder: { promise: Promise<void> | null } = { promise: null };
    holder.promise = (async () => {
      try {
        await this.resynchronizeOrThrow();
        if (this.epoch !== myEpoch) return;
        // Success — reset backoff counter (reconnectCount stays cumulative).
        this.reconnectAttempts = 0;
      } catch (err) {
        if (this.epoch !== myEpoch) return;
        void err;
        // Reset failed — clear the lock BEFORE scheduleReconnect, otherwise the
        // single-flight guard (reconnectPromise !== null) blocks the next retry.
        if (this.reconnectPromise === holder.promise) this.reconnectPromise = null;
        this.setState("degraded");
        this.scheduleReconnect();
      }
    })();
    this.reconnectPromise = holder.promise;
    try {
      await holder.promise;
    } catch {
      // swallow — handled above
    } finally {
      // Only clear if not already cleared by the inner catch.
      if (this.reconnectPromise === holder.promise) this.reconnectPromise = null;
    }
  }

  /**
   * Schedule a reconnect with exponential backoff.
   * Single-flight: checks BOTH reconnectTimer AND reconnectPromise.
   * If either is set, no-op (closes the timer-fire → clear → resync → second-error → new-timer window).
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;   // timer pending
    if (this.reconnectPromise !== null) return; // resync in-flight
    if (this.state === "disconnected" || this.state === "failed") return;

    if (this.reconnectAttempts >= this.reconnectPolicy.maxAttempts) {
      // Max attempts exceeded — terminal.
      void this.handleTerminalReconnectFailure();
      return;
    }
    const policy = this.reconnectPolicy;
    const base = Math.min(policy.maxDelayMs, policy.initialDelayMs * Math.pow(2, this.reconnectAttempts));
    const jitter = base * policy.jitterRatio * (Math.random() * 2 - 1);
    const delay = Math.max(0, base + jitter);
    this.reconnectAttempts += 1;
    this.diagnostics.reconnectCount += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.doReconnect();
    }, delay);
  }

  /**
   * Terminal reconnect failure — max attempts exceeded.
   * Records `reconnect_failed` (SessionErrorCode) and transitions to `failed`.
   * Closes subscription BEFORE failed (no stale stream).
   */
  private async handleTerminalReconnectFailure(): Promise<void> {
    const myEpoch = this.epoch;
    await this.removeSubscription();
    if (this.epoch !== myEpoch) return; // disconnect won the race
    this.recordError(this.makeSessionError(
      "reconnect_failed",
      `Exceeded max reconnect attempts (${this.reconnectPolicy.maxAttempts})`
    ));
    this.setState("failed");
  }

  /**
   * Perform a single backoff reconnect attempt.
   * Uses resynchronizeOrThrow() so failure is visible (re-throws).
   * Sets reconnectPromise at entry, clears in finally (single-flight).
   *
   * CRITICAL: the inner catch MUST clear reconnectPromise BEFORE calling
   * scheduleReconnect(), otherwise the single-flight guard blocks the next retry
   * and the session can only ever attempt one reconnect.
   */
  private async doReconnect(): Promise<void> {
    if (this.reconnectPromise !== null) return; // single-flight
    const myEpoch = this.epoch;
    const holder: { promise: Promise<void> | null } = { promise: null };
    holder.promise = (async () => {
      try {
        await this.resynchronizeOrThrow();
        if (this.epoch !== myEpoch) return; // disconnect
        // Success — reset backoff counter (reconnectCount stays cumulative).
        this.reconnectAttempts = 0;
        // State already set to "connected" inside resynchronizeOrThrow on success.
      } catch (err) {
        if (this.epoch !== myEpoch) return; // disconnect
        void err;
        // Resync failed — clear the lock BEFORE scheduleReconnect, otherwise the
        // single-flight guard blocks the next retry.
        if (this.reconnectPromise === holder.promise) this.reconnectPromise = null;
        // Override the "failed" set by resynchronizeOrThrow — we want to retry,
        // not give up immediately. Only `handleTerminalReconnectFailure` may
        // set `failed` for reconnect exhaustion.
        this.setState("degraded");
        this.scheduleReconnect();
      }
    })();
    this.reconnectPromise = holder.promise;
    try {
      await holder.promise;
    } catch {
      // swallow — handled above
    } finally {
      // Only clear if not already cleared by the inner catch.
      if (this.reconnectPromise === holder.promise) this.reconnectPromise = null;
    }
  }

  /**
   * 拆除当前订阅（如有），并清空订阅相关的 diagnostics。
   * 集中化以便 disconnect / resync 失败 / resync 开始前复用。
   */
  private async removeSubscription(): Promise<void> {
    const subscription = this.subscription;
    this.subscription = null;
    this.activeSubscriptionCursor = null;
    this.diagnostics.hasActiveSubscription = false;
    this.diagnostics.activeSubscriptionCursor = null;
    if (!subscription) return;
    try {
      await Promise.resolve(subscription.close());
    } catch {
      /* best-effort close — error handled by caller context */
    }
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
