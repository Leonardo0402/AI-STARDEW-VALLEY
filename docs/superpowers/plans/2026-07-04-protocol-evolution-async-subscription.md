# Protocol Evolution: Async Subscription Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the `RuntimeAdapter.subscribe` contract from synchronous `subscribe(handler): Unsubscribe` to an async lifecycle (`RuntimeStreamObserver` + `RuntimeSubscription` with `ready`/`close`), add typed stream errors, and migrate all existing adapters, RuntimeSession, and tests to the new contract — keeping the full suite green and adding 6+ lifecycle edge-case tests.

**Architecture:** Pure protocol refactor — no new transport. The new `RuntimeSubscription.ready` Promise lets the session await stream readiness (replay completion) before transitioning to `connected`; `close()` replaces `Unsubscribe` and may return a Promise. Mock/TestAdapter replay is deferred to a microtask (not synchronous) so the session can save the subscription reference before events arrive — this is required for the `handleEvent` guard to work and matches the async nature of the future HTTP/SSE adapter.

**Tech Stack:** TypeScript, Vitest, npm workspaces (`@agent-office/protocol`, `@agent-office/core`, `@agent-office/mock-adapter`, `apps/demo-office`).

## Global Constraints

- **Branch:** `feat/async-subscription-lifecycle-issue-6` off `main` (currently `9789950`, includes PR #5).
- **Session MUST await `subscription.ready`:** `doConnect()` and `doResynchronize()` must not call `setState("connected")` until `await subscription.ready` resolves. On rejection, throw `subscribe_failed` SessionError.
- **No synchronous replay before `subscribe()` returns:** Mock/TestAdapter must defer replay to at least one microtask (`Promise.resolve().then(...)`). This is required because `handleEvent` has a `if (!this.subscription) return;` guard — if replay happened synchronously inside `subscribe()`, `this.subscription = adapter.subscribe(...)` wouldn't have completed assignment yet and all replay events would be dropped.
- **`removeSubscription()` MUST be async and await `close()`:** `close()` may return a Promise (HTTP/SSE adapter aborts a fetch stream). The session must await it to guarantee "no old stream may remain active after resync" (Issue #6). All call sites (`disconnect`, `doResynchronize`, `doConnect` cleanup) must `await this.removeSubscription()`.
- **`handleEvent` MUST bail when no active subscription:** After `removeSubscription`, stale events from a not-yet-closed async stream must not be processed. Add `if (!this.subscription) return;` as the first check.
- **`close()` is idempotent:** Calling it twice is a no-op (second call does nothing).
- **`close()` return type is `Promise<void> | void`:** Mock/TestAdapter return `void` (sync, but wrapped in `Promise.resolve()` by the session for uniformity); the future HTTP/SSE adapter will return `Promise<void>`.
- **Epoch race safety must be preserved:** after `await subscription.ready`, the session must check `this.epoch !== myEpoch` AND `this.subscription !== subscription` AND state checks before transitioning to `connected`.
- **`useOfficeState.ts` must NOT change:** it only talks to `RuntimeSession` and `SnapshotStore`, never to the adapter.
- **`CommandGateway` must NOT change:** it doesn't touch `subscribe`.
- **No new dependencies.** No new packages. This plan modifies only existing files.
- **TDD:** every code change is preceded by a failing test. For pure type additions (Task 1), the test is a compile-time type check using `satisfies` in a `.typecheck.ts` file.
- **Commit message style:** `feat(protocol): ...`, `fix(core): ...`, `test(...): ...`, `docs: ...` — match existing repo style.

## Stream Lifecycle Protocol (locked semantics)

This section defines the exact ordering rules for `ready` / `onError` / `onState`. Implementors (Mock, Test, future HTTP/SSE) MUST follow these rules.

### `RuntimeStreamState` (no `reconnecting` — Session owns reconnect)

```ts
type RuntimeStreamState =
  | "opening"        // subscribe returned, replay/stream-open in progress
  | "ready"          // stream open, replay complete, live events flowing
  | "reset_required" // replay history trimmed, session must re-checkpoint
  | "error"          // stream error (fatal or non-fatal)
  | "closed";        // subscription closed (terminal)
```

**Why no `reconnecting`:** Issue #6 decides that `RuntimeSession` owns reconnect/resync, not the adapter. The adapter only owns one stream lifecycle. If the adapter also tried to reconnect, responsibilities would overlap. The session has `resynchronizing` / `degraded` states for this purpose.

### Ordering rules

**1. Ready success (replay complete, stream open):**
```
[replay events via onEvent] → onState("ready") → ready.resolve()
```
- `onState("opening")` MAY be called at the start of the ready microtask (before replay). It is informational.
- Replay events are delivered via `onEvent` BEFORE `onState("ready")`.
- `ready.resolve()` happens AFTER `onState("ready")`.

**2. Ready failure (stream open failed, e.g. HTTP 401):**
```
ready.reject(RuntimeStreamError)   // ONLY this — no onError, no onState before resolve
```
- Before `ready` settles, the ONLY observable side effect is the rejection. No `onError`, no `onState("error")`.
- This is the simpler of the two options (avoids double error handling). The session treats `ready` rejection as `subscribe_failed`.

**3. Close before ready (subscription closed during replay/stream-open):**
```
ready.reject({ code: "aborted", message: "...", recoverable: false })
```
- `close()` sets `closed = true` synchronously.
- The ready microtask sees `closed` and rejects with `aborted`.
- `onState("closed")` is called by `close()` AFTER the ready microtask has settled (or immediately if ready already resolved).

**4. Ready succeeded, then stream error (live event stream broke):**
```
onError(error) → onState("error" | "reset_required")
```
- `onError` is called first, then `onState` with the appropriate state.
- `reset_required` means the event log was trimmed; the session must re-fetch a checkpoint.
- `error` means a non-recoverable stream error.

**5. Close after ready (normal shutdown):**
```
onState("closed")   // ready already resolved, no ready rejection
```

### `RuntimeStreamError` shape

```ts
interface RuntimeStreamError {
  code: RuntimeErrorCode;
  message: string;
  recoverable: boolean;
  status?: number;  // HTTP status if applicable
}
```

`RuntimeErrorCode` includes `"aborted"` for close-before-ready.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `packages/protocol/src/index.ts` | Protocol types (zero-dep) | **Modify** — add stream types, change `subscribe` signature |
| `packages/protocol/src/types.typecheck.ts` | Compile-time type tests | **Create** — `satisfies`-based type assertions |
| `packages/adapters/mock/src/mock-adapter.ts` | Demo adapter | **Modify** — implement new `subscribe` with microtask-deferred replay |
| `packages/core/src/test-adapter.ts` | Test adapter with injection | **Modify** — implement new `subscribe`, add `subscribeReadyDelayMs`/`subscribeReadyError`/`closeDelayMs` fields |
| `packages/core/src/session.ts` | Session lifecycle owner | **Modify** — `installSubscription` returns `RuntimeSubscription`, `removeSubscription` is async, await `ready`/`close`, add `handleEvent` guard |
| `packages/core/src/index.ts` | Core re-exports | **Modify** — re-export new stream types |
| `packages/adapters/mock/src/mock-adapter.test.ts` | Mock tests | **Modify** — adapt subscribe call sites to observer pattern |
| `packages/core/src/session.test.ts` | Session tests | **Modify** — adapt subscribe call sites |
| `packages/core/src/session-hardening.test.ts` | Hardening tests | **Modify** — adapt assertions (await async removeSubscription) |
| `packages/core/src/core.test.ts` | Core tests | **Modify** — update fake adapter mock |
| `apps/demo-office/src/integration.test.ts` | Integration tests | **Modify** — adapt subscribe call sites |
| `packages/core/src/subscription-lifecycle.test.ts` | New lifecycle tests | **Create** — 11 tests covering ready delay/reject, replay gap/mismatch, async close, close-before-ready |
| `docs/protocol/runtime-contract.md` | Wire/protocol contract | **Modify** — Section 4.1 async lifecycle + protocol rules |

---

### Task 1: Add stream lifecycle types to protocol (additive, no breakage)

**Files:**
- Modify: `packages/protocol/src/index.ts` (append after line 399, after `SubscribeOptions`)
- Create: `packages/protocol/src/types.typecheck.ts`

**Interfaces:**
- Produces: `RuntimeStreamState`, `RuntimeErrorCode`, `RuntimeStreamError`, `RuntimeStreamObserver`, `RuntimeSubscription`

- [ ] **Step 1: Write a compile-time type test using `satisfies`**

Create `packages/protocol/src/types.typecheck.ts`:

```ts
import type {
  RuntimeStreamState,
  RuntimeErrorCode,
  RuntimeStreamError,
  RuntimeStreamObserver,
  RuntimeSubscription,
  DomainEvent,
} from "./index.js";

// RuntimeStreamState covers all lifecycle phases (no "reconnecting" — Session owns reconnect)
const state = "opening" satisfies RuntimeStreamState;
const state2 = "ready" satisfies RuntimeStreamState;
const state3 = "reset_required" satisfies RuntimeStreamState;
const state4 = "error" satisfies RuntimeStreamState;
const state5 = "closed" satisfies RuntimeStreamState;

// RuntimeErrorCode covers all typed remote errors
const code = "http_error" satisfies RuntimeErrorCode;
const code2 = "authentication_failed" satisfies RuntimeErrorCode;
const code3 = "snapshot_invalid" satisfies RuntimeErrorCode;
const code4 = "capabilities_invalid" satisfies RuntimeErrorCode;
const code5 = "stream_open_failed" satisfies RuntimeErrorCode;
const code6 = "stream_protocol_error" satisfies RuntimeErrorCode;
const code7 = "event_invalid" satisfies RuntimeErrorCode;
const code8 = "event_log_trimmed" satisfies RuntimeErrorCode;
const code9 = "command_rejected" satisfies RuntimeErrorCode;
const code10 = "command_response_invalid" satisfies RuntimeErrorCode;
const code11 = "aborted" satisfies RuntimeErrorCode;

// RuntimeStreamError shape (status is optional)
const err = {
  code: "http_error",
  message: "bad gateway",
  recoverable: false,
  status: 502,
} satisfies RuntimeStreamError;
const errNoStatus = {
  code: "aborted",
  message: "closed before ready",
  recoverable: false,
} satisfies RuntimeStreamError;

// RuntimeStreamObserver: onEvent required, onState/onError optional
const observer = {
  onEvent: (_e: DomainEvent) => {},
} satisfies RuntimeStreamObserver;
const observerFull = {
  onEvent: (_e: DomainEvent) => {},
  onState: (_s: RuntimeStreamState) => {},
  onError: (_e: RuntimeStreamError) => {},
} satisfies RuntimeStreamObserver;

// RuntimeSubscription: ready is a Promise, close returns void|Promise
const subscription = {
  ready: Promise.resolve(),
  close: () => {},
} satisfies RuntimeSubscription;
const subscriptionAsyncClose = {
  ready: Promise.resolve(),
  close: async () => {},
} satisfies RuntimeSubscription;

// Suppress unused-variable warnings
void state; void state2; void state3; void state4; void state5;
void code; void code2; void code3; void code4; void code5;
void code6; void code7; void code8; void code9; void code10; void code11;
void err; void errNoStatus;
void observer; void observerFull;
void subscription; void subscriptionAsyncClose;
```

- [ ] **Step 2: Run type test to verify it fails (types not defined)**

Run: `npx tsc --noEmit -p packages/protocol/tsconfig.json`
Expected: FAIL — `Cannot find name 'RuntimeStreamState'` etc.

- [ ] **Step 3: Add the types to `packages/protocol/src/index.ts`**

Insert after the existing `SubscribeOptions` interface (after line 399), before the `EventApplyResult` section:

```ts
// ─── Async Subscription Lifecycle (Issue #6) ───────────────

/**
 * 流订阅状态机。
 *
 * 注意：没有 "reconnecting" 状态 — RuntimeSession 拥有重连/resync 职责，
 * adapter 只负责一次 Stream 建立和一次 Stream 生命周期。
 * Session 通过 resynchronizing / degraded 状态表达重连。
 *
 * - opening: subscribe 已返回，流尚未 ready（正在建立连接 / 重放）
 * - ready: 流已开放，重放完成，正在投递实时事件
 * - reset_required: 重放历史已修剪，需要重新拉取 checkpoint
 * - error: 流错误（可恢复或致命）
 * - closed: 订阅已关闭（终态）
 */
export type RuntimeStreamState =
  | "opening"
  | "ready"
  | "reset_required"
  | "error"
  | "closed";

/**
 * 远程传输错误分类（Issue #6 P1 错误模型）。
 *
 * - aborted: close 发生在 ready 之前（订阅被取消）
 * - 其他 code: HTTP/SSE 传输层错误（Plan 2 使用）
 */
export type RuntimeErrorCode =
  | "http_error"
  | "authentication_failed"
  | "snapshot_invalid"
  | "capabilities_invalid"
  | "stream_open_failed"
  | "stream_protocol_error"
  | "event_invalid"
  | "event_log_trimmed"
  | "command_rejected"
  | "command_response_invalid"
  | "aborted";

/**
 * 结构化流错误。
 *
 * recoverable=true 时 session 可尝试 resync；false 时为致命错误。
 * status: HTTP status code（仅 HTTP/SSE adapter 使用）。
 */
export interface RuntimeStreamError {
  code: RuntimeErrorCode;
  message: string;
  recoverable: boolean;
  status?: number;
}

/**
 * 流观察者。onEvent 必需；onState/onError 可选。
 *
 * 调用顺序契约见 docs/protocol/runtime-contract.md §4.1.1。
 * 简要：
 *   - ready 之前失败：只 reject ready，不调用 onError。
 *   - ready 成功：replay → onState("ready") → ready.resolve()。
 *   - ready 之后失败：onError(error) → onState("error" | "reset_required")。
 *   - close 之前 ready 未 resolve：ready.reject({ code: "aborted" })。
 */
export interface RuntimeStreamObserver {
  onEvent(event: DomainEvent): void;
  onState?(state: RuntimeStreamState): void;
  onError?(error: RuntimeStreamError): void;
}

/**
 * 异步订阅句柄。
 *
 * ready: 流已开放且游标重放完成时 resolve；流建立失败或 close-before-ready 时 reject。
 * close: 关闭流，幂等。同步 adapter 返回 void；HTTP/SSE adapter 返回 Promise<void>（abort fetch）。
 *
 * 协议：subscribe() 返回 RuntimeSubscription 之前不得同步调用 observer。
 * Replay 必须至少延迟到一个 microtask 中执行，让调用方先保存 subscription 引用。
 */
export interface RuntimeSubscription {
  ready: Promise<void>;
  close(): Promise<void> | void;
}
```

- [ ] **Step 4: Run type test to verify it passes**

Run: `npx tsc --noEmit -p packages/protocol/tsconfig.json`
Expected: PASS (no errors)

- [ ] **Step 5: Run full suite to verify no regressions**

Run: `npm test`
Expected: PASS — 106/106 (additive types don't affect runtime; the `.typecheck.ts` file is compiled but has no runtime side effects)

- [ ] **Step 6: Commit**

```bash
git add packages/protocol/src/index.ts packages/protocol/src/types.typecheck.ts
git commit -m "feat(protocol): add async subscription lifecycle and stream error types (#6)"
```

---

### Task 2: Migrate RuntimeAdapter.subscribe signature + all implementors + consumers + tests (atomic)

This is the breaking change. The signature changes, and all implementors (Mock, Test) and consumers (Session) and test files must be updated in one atomic commit so the build never breaks on the branch.

**Critical requirements for this task:**
1. Mock/TestAdapter replay MUST be deferred to a microtask (`Promise.resolve().then(...)`), NOT synchronous.
2. `installSubscription()` MUST return `RuntimeSubscription` so callers can `await subscription.ready`.
3. `removeSubscription()` MUST be `async` and `await Promise.resolve(subscription.close())`.
4. `handleEvent` MUST have `if (!this.subscription) return;` as the first guard.
5. `doConnect()` and `doResynchronize()` MUST `await subscription.ready` with epoch/subscription/state checks before `setState("connected")`.
6. All `removeSubscription()` call sites MUST `await` it.

**Files:**
- Modify: `packages/protocol/src/index.ts` (change `RuntimeAdapter.subscribe` signature)
- Modify: `packages/adapters/mock/src/mock-adapter.ts` (implement new signature with microtask replay)
- Modify: `packages/core/src/test-adapter.ts` (implement new signature, add injection fields)
- Modify: `packages/core/src/session.ts` (use `RuntimeSubscription`, await `ready`/`close`)
- Modify: `packages/core/src/index.ts` (re-export new types)
- Modify: `packages/adapters/mock/src/mock-adapter.test.ts` (adapt call sites)
- Modify: `packages/core/src/session.test.ts` (adapt call sites)
- Modify: `packages/core/src/session-hardening.test.ts` (adapt assertions)
- Modify: `packages/core/src/core.test.ts` (update fake adapter)
- Modify: `apps/demo-office/src/integration.test.ts` (adapt call sites)

**Interfaces:**
- Consumes: `RuntimeStreamObserver`, `RuntimeSubscription` from Task 1
- Produces: updated `RuntimeAdapter` with `subscribe(observer, options?): RuntimeSubscription`

- [ ] **Step 1: Change `RuntimeAdapter.subscribe` signature in protocol**

In `packages/protocol/src/index.ts`, replace the `RuntimeAdapter` interface (lines 464-474):

Before:
```ts
export interface RuntimeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): Promise<RuntimeSnapshot>;
  subscribe(
    handler: DomainEventHandler,
    options?: SubscribeOptions
  ): Unsubscribe;
  execute(command: OfficeCommand): Promise<CommandResult>;
  getCapabilities(): AdapterCapabilities;
}
```

After:
```ts
export interface RuntimeAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): Promise<RuntimeSnapshot>;
  subscribe(
    observer: RuntimeStreamObserver,
    options?: SubscribeOptions
  ): RuntimeSubscription;
  execute(command: OfficeCommand): Promise<CommandResult>;
  getCapabilities(): AdapterCapabilities;
}
```

Keep `DomainEventHandler` and `Unsubscribe` type aliases in the file (they may be used internally by adapters as handler wrappers), but they are no longer part of the public adapter interface.

- [ ] **Step 2: Update `MockRuntimeAdapter.subscribe` in `packages/adapters/mock/src/mock-adapter.ts`**

First, update imports at the top of the file. Add `RuntimeStreamObserver`, `RuntimeSubscription`, `RuntimeStreamError` to the import from `@agent-office/protocol`. Keep `DomainEventHandler` (no longer needed — remove if it becomes unused).

Find the existing `subscribe` method (around line 206-219). Also find the `subscribers` field declaration (search for `private subscribers`).

Change the field type from `Set<DomainEventHandler>` to `Set<RuntimeStreamObserver>`:

Before:
```ts
private subscribers = new Set<DomainEventHandler>();
```

After:
```ts
private subscribers = new Set<RuntimeStreamObserver>();
```

Replace the `subscribe` method:

Before:
```ts
subscribe(
  handler: DomainEventHandler,
  options?: SubscribeOptions
): Unsubscribe {
  if (options?.afterSequence !== undefined) {
    for (const event of this.eventLog) {
      if (event.sequence > options.afterSequence) {
        handler(event);
      }
    }
  }
  this.subscribers.add(handler);
  return () => this.subscribers.delete(handler);
}
```

After (microtask-deferred replay — NOT synchronous):
```ts
subscribe(
  observer: RuntimeStreamObserver,
  options?: SubscribeOptions
): RuntimeSubscription {
  let closed = false;
  const cursor = options?.afterSequence;

  // Replay MUST be deferred to a microtask so the caller can save the
  // subscription reference before events arrive. If replay happened
  // synchronously inside subscribe(), the session's handleEvent guard
  // (if (!this.subscription) return;) would drop all replay events
  // because this.subscription = adapter.subscribe(...) hasn't completed.
  const ready = Promise.resolve().then(() => {
    if (closed) {
      throw {
        code: "aborted",
        message: "closed before ready",
        recoverable: false,
      } satisfies RuntimeStreamError;
    }
    observer.onState?.("opening");

    if (cursor !== undefined) {
      for (const event of this.eventLog) {
        if (closed) {
          throw {
            code: "aborted",
            message: "closed during replay",
            recoverable: false,
          } satisfies RuntimeStreamError;
        }
        if (event.sequence > cursor) {
          observer.onEvent(event);
        }
      }
    }

    if (closed) {
      throw {
        code: "aborted",
        message: "closed before ready",
        recoverable: false,
      } satisfies RuntimeStreamError;
    }
    this.subscribers.add(observer);
    observer.onState?.("ready");
  });

  return {
    ready,
    close: () => {
      if (closed) return;
      closed = true;
      this.subscribers.delete(observer);
      observer.onState?.("closed");
    },
  };
}
```

Update the `emit` method (find `for (const handler of this.subscribers) { handler(event); }`):

Before:
```ts
for (const handler of this.subscribers) {
  handler(event);
}
```

After:
```ts
for (const observer of this.subscribers) {
  observer.onEvent(event);
}
```

- [ ] **Step 3: Update `TestRuntimeAdapter.subscribe` in `packages/core/src/test-adapter.ts`**

First, update imports. Add `RuntimeStreamObserver`, `RuntimeSubscription`, `RuntimeStreamError` to the import from `@agent-office/protocol`. Keep `DomainEventHandler` only if still used (it won't be — remove it from imports).

Add new injection fields to the class (after the existing public fields, around line 61):

```ts
  /** subscribe ready 延迟 ms（用于测试 session 等待 ready） */
  public subscribeReadyDelayMs = 0;
  /** subscribe ready reject 的错误（用于测试 ready 失败） */
  public subscribeReadyError: RuntimeStreamError | null = null;
  /** close 延迟 ms（用于测试 async close） */
  public closeDelayMs = 0;
```

Add `RuntimeStreamError` to the type import at the top of the file.

Change the `subscribers` field type (line 48):

Before:
```ts
private subscribers = new Set<DomainEventHandler>();
```

After:
```ts
private subscribers = new Set<RuntimeStreamObserver>();
```

Replace the `subscribe` method (lines 116-142):

Before:
```ts
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
```

After (microtask-deferred replay with injection points):
```ts
subscribe(
  observer: RuntimeStreamObserver,
  options?: SubscribeOptions
): RuntimeSubscription {
  if (this.subscribeError) {
    throw this.subscribeError;
  }
  const cursor = options?.afterSequence;
  this.subscribeCalls.push({
    cursor,
    timestamp: new Date().toISOString(),
  });

  let closed = false;
  // Replay deferred to microtask — see MockRuntimeAdapter for rationale.
  const ready = Promise.resolve().then(async () => {
    if (closed) {
      throw {
        code: "aborted",
        message: "closed before ready",
        recoverable: false,
      } satisfies RuntimeStreamError;
    }
    observer.onState?.("opening");

    // Optional ready delay (for testing session awaits ready)
    if (this.subscribeReadyDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.subscribeReadyDelayMs));
    }

    if (closed) {
      throw {
        code: "aborted",
        message: "closed during ready delay",
        recoverable: false,
      } satisfies RuntimeStreamError;
    }

    // Optional ready error injection
    if (this.subscribeReadyError) {
      throw this.subscribeReadyError;
    }

    // cursor-aware replay
    if (cursor !== undefined) {
      for (const event of this.eventLog) {
        if (closed) {
          throw {
            code: "aborted",
            message: "closed during replay",
            recoverable: false,
          } satisfies RuntimeStreamError;
        }
        if (event.sequence > cursor) {
          observer.onEvent(event);
        }
      }
    }

    if (closed) {
      throw {
        code: "aborted",
        message: "closed before ready",
        recoverable: false,
      } satisfies RuntimeStreamError;
    }
    this.subscribers.add(observer);
    observer.onState?.("ready");
  });

  const closeFn = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    this.subscribers.delete(observer);
    this.unsubscribeCount += 1;
    if (this.closeDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.closeDelayMs));
    }
    observer.onState?.("closed");
  };

  return {
    ready,
    close: closeFn,
  };
}
```

Update the `emit` method (around line 171-181):

Before:
```ts
emit(event: DomainEvent): void {
  this.eventLog.push(event);
  if (event.sequence > this.snapshot.sequence) {
    this.snapshot.sequence = event.sequence;
    this.snapshot.lastEventId = event.eventId;
  }
  for (const handler of this.subscribers) {
    handler(event);
  }
}
```

After:
```ts
emit(event: DomainEvent): void {
  this.eventLog.push(event);
  if (event.sequence > this.snapshot.sequence) {
    this.snapshot.sequence = event.sequence;
    this.snapshot.lastEventId = event.eventId;
  }
  for (const observer of this.subscribers) {
    observer.onEvent(event);
  }
}
```

Update the `reset` method to reset new fields (around line 204-214). Add after `this.subscribeError = null;`:

```ts
this.subscribeReadyDelayMs = 0;
this.subscribeReadyError = null;
this.closeDelayMs = 0;
```

- [ ] **Step 4: Update `RuntimeSession` in `packages/core/src/session.ts`**

4a. Update imports (line 37-41). Add `RuntimeStreamObserver` and `RuntimeSubscription` to the type import:

Before:
```ts
import type {
  RuntimeAdapter,
  DomainEvent,
  EventApplyResult,
} from "@agent-office/protocol";
```

After:
```ts
import type {
  RuntimeAdapter,
  DomainEvent,
  EventApplyResult,
  RuntimeStreamObserver,
  RuntimeSubscription,
} from "@agent-office/protocol";
```

4b. Change the field type (line 121):

Before:
```ts
private unsubscribeAdapter: (() => void) | null = null;
```

After:
```ts
private subscription: RuntimeSubscription | null = null;
```

4c. Rewrite `installSubscription` (lines 433-442) to return the subscription:

Before:
```ts
private installSubscription(afterSequence: number): void {
  this.unsubscribeAdapter = this.adapter.subscribe(
    (event) => this.handleEvent(event),
    { afterSequence }
  );
  this.activeSubscriptionCursor = afterSequence;
  this.diagnostics.hasActiveSubscription = true;
  this.diagnostics.activeSubscriptionCursor = afterSequence;
}
```

After:
```ts
private installSubscription(afterSequence: number): RuntimeSubscription {
  const observer: RuntimeStreamObserver = {
    onEvent: (event) => this.handleEvent(event),
  };
  const subscription = this.adapter.subscribe(observer, { afterSequence });
  this.subscription = subscription;
  this.activeSubscriptionCursor = afterSequence;
  this.diagnostics.hasActiveSubscription = true;
  this.diagnostics.activeSubscriptionCursor = afterSequence;
  return subscription;
}
```

4d. Rewrite `removeSubscription` (lines 448-456) to be async and await `close()`:

Before:
```ts
private removeSubscription(): void {
  if (this.unsubscribeAdapter) {
    this.unsubscribeAdapter();
    this.unsubscribeAdapter = null;
  }
  this.activeSubscriptionCursor = null;
  this.diagnostics.hasActiveSubscription = false;
  this.diagnostics.activeSubscriptionCursor = null;
}
```

After:
```ts
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
```

4e. Add subscription guard to `handleEvent` (line 278). Insert as the FIRST check:

Before:
```ts
private handleEvent(event: DomainEvent): void {
  // resync 期间忽略增量事件：避免在旧订阅尚未拆除时混入与 checkpoint 不一致的事件。
  if (this.state === "resynchronizing") {
    return;
  }
```

After:
```ts
private handleEvent(event: DomainEvent): void {
  // 订阅已拆除 — 丢弃延迟到达的事件（async close 窗口）
  if (!this.subscription) {
    return;
  }
  // resync 期间忽略增量事件：避免在旧订阅尚未拆除时混入与 checkpoint 不一致的事件。
  if (this.state === "resynchronizing") {
    return;
  }
```

4f. Rewrite `doConnect()` (lines 202-275) to await `subscription.ready`:

Before (lines 249-274):
```ts
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
```

After:
```ts
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
```

4g. Rewrite `doResynchronize()` (lines 352-404) to await `removeSubscription` and `subscription.ready`:

Before (lines 352-404):
```ts
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
```

After:
```ts
  private async doResynchronize(): Promise<void> {
    const myEpoch = this.epoch;
    // 立即转 resynchronizing + 拆旧订阅，避免旧订阅在等待 snapshot 期间继续推送
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
          this.state === "resynchronizing" ||
          this.state === "failed"
        ) {
          return;
        }
      }

      this.setState("connected");
    } catch (err) {
      if (this.epoch !== myEpoch) return;
      // resync 失败：不留活跃订阅，避免错误状态下继续消费
      await this.removeSubscription();
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
```

4h. Update `disconnect()` (lines 415-431) to await `removeSubscription`:

Before:
```ts
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
```

After:
```ts
  async disconnect(): Promise<void> {
    this.epoch += 1;
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
```

- [ ] **Step 5: Update `packages/core/src/index.ts` re-exports**

Add to the re-exports from protocol (after the existing `ReducerError` re-export around line 9):

```ts
export type {
  RuntimeStreamState,
  RuntimeErrorCode,
  RuntimeStreamError,
  RuntimeStreamObserver,
  RuntimeSubscription,
} from "@agent-office/protocol";
```

- [ ] **Step 6: Update `packages/adapters/mock/src/mock-adapter.test.ts`**

Find all `adapter.subscribe(...)` call sites (lines ~31, ~262).

Line ~31 (beforeEach setup):
Before:
```ts
adapter.subscribe((event) => {
  store.applyEvent(event);
  gateway.updateSnapshot(store.getSnapshot());
});
```

After:
```ts
adapter.subscribe({
  onEvent: (event) => {
    store.applyEvent(event);
    gateway.updateSnapshot(store.getSnapshot());
  },
});
```

Line ~262:
Before:
```ts
const unsub = adapter.subscribe((e) => events.push(e));
// ... later:
unsub();
```

After:
```ts
const sub = adapter.subscribe({ onEvent: (e) => events.push(e) });
await sub.ready; // wait for replay to complete
// ... later:
await Promise.resolve(sub.close());
```

- [ ] **Step 7: Update `packages/core/src/session.test.ts`**

Find `adapter.subscribe(...)` call sites (lines ~227, ~240). These tests use `MockRuntimeAdapter` directly (not through the session).

Before (line ~227):
```ts
adapter.subscribe((e) => replayed.push(e), { afterSequence: checkpointSeq })
```

After:
```ts
const sub = adapter.subscribe({ onEvent: (e) => replayed.push(e) }, { afterSequence: checkpointSeq })
await sub.ready;
```

Before (line ~240):
```ts
adapter.subscribe((e) => replayed.push(e), { afterSequence: 0 })
```

After:
```ts
const sub2 = adapter.subscribe({ onEvent: (e) => replayed.push(e) }, { afterSequence: 0 })
await sub2.ready;
```

- [ ] **Step 8: Update `packages/core/src/session-hardening.test.ts`**

This file uses `TestRuntimeAdapter` through the session (no direct `adapter.subscribe` calls in the test). The assertions on `adapter.subscribeCalls` and `adapter.unsubscribeCount` still work.

However, some tests may have timing assertions that assumed synchronous subscription. Since replay is now microtask-deferred, tests that emit events immediately after `session.connect()` may need a microtask flush.

Search for any direct `adapter.subscribe` calls — if found, adapt to observer pattern per Step 6. If tests only use `session.connect()` / `session.resynchronize()`, no changes needed beyond verifying compilation.

Key check: the test "真实 gap 触发恰好一次 resync" (line ~132) calls `adapter.emit(gapEvent)` immediately after `await session.connect()`. Since `connect()` now awaits `subscription.ready`, the subscription is fully established when `connect()` returns. The emit will deliver the event synchronously to the observer. This should still work.

- [ ] **Step 9: Update `packages/core/src/core.test.ts`**

Find the fake adapter mock (line ~838). Update the `subscribe` mock:

Before:
```ts
subscribe: vi.fn(() => () => {}),
```

After:
```ts
subscribe: vi.fn(() => ({ ready: Promise.resolve(), close: () => {} })),
```

- [ ] **Step 10: Update `apps/demo-office/src/integration.test.ts`**

Find `adapter.subscribe(...)` call sites (lines ~35, ~255).

Line ~35:
Before:
```ts
adapter.subscribe((event) => {
  receivedEvents.push(event);
  store.applyEvent(event);
  gateway.updateSnapshot(store.getSnapshot());
});
```

After:
```ts
adapter.subscribe({
  onEvent: (event) => {
    receivedEvents.push(event);
    store.applyEvent(event);
    gateway.updateSnapshot(store.getSnapshot());
  },
});
```

Line ~255:
Before:
```ts
const unsub = adapter.subscribe(() => {});
unsub();
```

After:
```ts
const sub = adapter.subscribe({ onEvent: () => {} });
await sub.ready;
await Promise.resolve(sub.close());
```

- [ ] **Step 11: Build to verify compilation**

Run: `npm run build`
Expected: exit 0 — all packages compile.

- [ ] **Step 12: Run full test suite**

Run: `npm test`
Expected: PASS — 106/106 (all existing tests pass with adapted call sites; replay is now microtask-deferred but `session.connect()` awaits `ready` so tests that emit after `connect()` still work).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(core): migrate RuntimeAdapter.subscribe to async RuntimeSubscription (#6)

- Session awaits subscription.ready before setState('connected')
- removeSubscription is async, awaits close()
- Mock/TestAdapter replay deferred to microtask (no sync callbacks)
- handleEvent guards against null subscription (async close window)
- All call sites adapted to observer pattern"
```

---

### Task 3: Add subscription lifecycle edge-case tests

Now that the contract is async, add tests proving the new guarantees. These tests use `TestRuntimeAdapter`'s new injection fields (`subscribeReadyDelayMs`, `subscribeReadyError`, `closeDelayMs`) to exercise edge cases.

**Files:**
- Create: `packages/core/src/subscription-lifecycle.test.ts`

**Interfaces:**
- Consumes: `TestRuntimeAdapter` (with new fields), `RuntimeSession`, `SnapshotStore`, `CommandGateway`
- Real API signatures (verified):
  - `new TestRuntimeAdapter(options: TestAdapterOptions = {})` — takes options object
  - `new CommandGateway(adapter: RuntimeAdapter)` — takes ONLY adapter (no store)
  - `new RuntimeSession(adapter, store, gateway, options?)`
  - `new SnapshotStore(runtimeId: string)`
  - `adapter.unsubscribeCount` — public field (not a method)
  - `adapter.subscribeCalls` — public field
  - `store.getLastSequence()` — method (not `getDiagnostics()`)
  - `session.getDiagnostics()` — returns `SessionDiagnostics` with `hasActiveSubscription`, `activeSubscriptionCursor`, `lastError`, `lastSequence`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/subscription-lifecycle.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { TestRuntimeAdapter } from "./test-adapter.js";
import { RuntimeSession } from "./session.js";
import { SnapshotStore } from "./store.js";
import { CommandGateway } from "./gateway.js";
import {
  EventType,
  type DomainEvent,
  type RuntimeSnapshot,
  type RuntimeStreamError,
} from "@agent-office/protocol";

const RUNTIME_ID = "rt-lifecycle";

function makeSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID,
    snapshotId: `snap-${seq}`,
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

function makeEvent(seq: number, runtimeId = RUNTIME_ID): DomainEvent {
  return {
    eventId: `evt-${seq}`,
    runtimeId,
    sequence: seq,
    schemaVersion: "1.0",
    type: EventType.TASK_CREATED,
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    correlationId: `corr-${seq}`,
    causationId: null,
    traceId: `trace-${seq}`,
    payload: {
      taskId: `t-${seq}`,
      title: `Task ${seq}`,
      description: "",
      priority: "normal",
      parentTaskId: null,
    },
  };
}

describe("subscription lifecycle (async)", () => {
  let adapter: TestRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;

  beforeEach(() => {
    adapter = new TestRuntimeAdapter({ initialSnapshot: makeSnapshot() });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);
  });

  // ─── Basic contract tests ─────────────────────────────────

  it("handleEvent drops events after removeSubscription (async close window)", async () => {
    await session.connect();
    const seqBefore = store.getLastSequence();

    // Simulate: session disconnects (removes subscription), then a delayed event arrives
    await session.disconnect();
    adapter.emit(makeEvent(seqBefore + 1));

    // Store should not have processed the event (no subscription active)
    expect(store.getLastSequence()).toBe(seqBefore);
  });

  it("RuntimeSubscription.close() is idempotent", async () => {
    const sub = adapter.subscribe({ onEvent: () => {} });
    await sub.ready;
    await Promise.resolve(sub.close());
    await Promise.resolve(sub.close()); // second call must not throw
    expect(adapter.unsubscribeCount).toBe(1);
  });

  it("RuntimeSubscription.ready resolves after microtask-deferred replay", async () => {
    // Pre-load an event into adapter log
    adapter.emit(makeEvent(1));

    const sub = adapter.subscribe(
      { onEvent: () => {} },
      { afterSequence: 0 }
    );
    await sub.ready;
    // ready resolved — replay completed
    expect(sub.ready).resolves.toBeUndefined();
  });

  it("session transitions to connected only after subscription.ready", async () => {
    const states: string[] = [];
    session.onStateChange((s) => states.push(s));
    await session.connect();
    expect(states[states.length - 1]).toBe("connected");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(true);
  });

  it("disconnect clears subscription diagnostics", async () => {
    await session.connect();
    expect(session.getDiagnostics().hasActiveSubscription).toBe(true);
    await session.disconnect();
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
    expect(session.getDiagnostics().activeSubscriptionCursor).toBeNull();
  });

  // ─── Issue #6 critical edge cases ─────────────────────────

  it("session awaits subscription.ready (delayed ready — not connected until ready resolves)", async () => {
    // Use an adapter with delayed ready
    const slowAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(),
    });
    slowAdapter.subscribeReadyDelayMs = 50;
    const slowSession = new RuntimeSession(
      slowAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(slowAdapter)
    );

    let connected = false;
    slowSession.onStateChange((s) => {
      if (s === "connected") connected = true;
    });

    // Start connect — should NOT reach connected until ready resolves
    const connectP = slowSession.connect();
    // Let microtasks run but ready is still pending (50ms delay)
    await new Promise((r) => setTimeout(r, 10));
    expect(slowSession.getState()).not.toBe("connected");
    expect(connected).toBe(false);

    await connectP;
    expect(connected).toBe(true);
    expect(slowSession.getState()).toBe("connected");
  });

  it("ready rejection — session enters failed, subscription closed, error is subscribe_failed", async () => {
    const failAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(),
    });
    const readyError: RuntimeStreamError = {
      code: "stream_open_failed",
      message: "stream rejected",
      recoverable: false,
    };
    failAdapter.subscribeReadyError = readyError;
    const failSession = new RuntimeSession(
      failAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(failAdapter)
    );

    await expect(failSession.connect()).rejects.toThrow();
    expect(failSession.getState()).toBe("failed");
    expect(failSession.getDiagnostics().lastError).not.toBeNull();
    expect(failSession.getDiagnostics().lastError!.code).toBe("subscribe_failed");
    expect(failSession.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  it("replay-time gap — session does not enter connected immediately, triggers resync", async () => {
    // Set up: adapter has event seq=5 in log, but snapshot at seq=0.
    // emit() updates both eventLog AND snapshot.seq, so we reset snapshot after.
    const gapAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(0),
    });
    gapAdapter.emit(makeEvent(5)); // eventLog has seq=5, snapshot.seq=5
    gapAdapter.setSnapshot(makeSnapshot(0)); // reset snapshot to seq=0

    // On resync's getSnapshot (2nd call), return seq=5 to stop resync loop.
    // Without this, resync would re-replay seq=5, detect gap again, loop forever.
    let getSnapshotCount = 0;
    const realGetSnapshot = gapAdapter.getSnapshot.bind(gapAdapter);
    gapAdapter.getSnapshot = async () => {
      getSnapshotCount++;
      if (getSnapshotCount >= 2) {
        gapAdapter.setSnapshot(makeSnapshot(5));
      }
      return realGetSnapshot();
    };

    const gapSession = new RuntimeSession(
      gapAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(gapAdapter)
    );

    await gapSession.connect();
    // connect() returns, but session is NOT "connected" — gap triggered resync.
    // doConnect bailed out because this.subscription !== subscription (resync
    // removed it). Wait for resync to complete.
    await new Promise((r) => setTimeout(r, 100));

    const diag = gapSession.getDiagnostics();
    expect(diag.resyncCount).toBeGreaterThanOrEqual(1);
    expect(diag.lastGap).not.toBeNull();
    expect(diag.lastGap!.receivedSequence).toBe(5);
  });

  it("replay-time runtime mismatch — session enters degraded, not connected", async () => {
    // Set up: adapter has mismatched event in log, snapshot at seq=0.
    const mismatchAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(0),
    });
    mismatchAdapter.emit(makeEvent(1, "other-runtime")); // eventLog + snapshot.seq=1
    mismatchAdapter.setSnapshot(makeSnapshot(0)); // reset snapshot to seq=0

    const mismatchSession = new RuntimeSession(
      mismatchAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(mismatchAdapter)
    );

    await mismatchSession.connect();
    // Replay delivered mismatched event → store.applyEvent returns runtime_mismatch
    // → session enters degraded (not connected)
    expect(mismatchSession.getState()).toBe("degraded");
    expect(mismatchSession.getDiagnostics().lastError).not.toBeNull();
    expect(mismatchSession.getDiagnostics().lastError!.code).toBe(
      "runtime_mismatch"
    );
  });

  it("async close — new subscription not established before old close completes", async () => {
    const slowCloseAdapter = new TestRuntimeAdapter({
      initialSnapshot: makeSnapshot(),
    });
    slowCloseAdapter.closeDelayMs = 50;
    const slowCloseSession = new RuntimeSession(
      slowCloseAdapter,
      new SnapshotStore(RUNTIME_ID),
      new CommandGateway(slowCloseAdapter)
    );

    await slowCloseSession.connect();
    expect(slowCloseSession.getDiagnostics().hasActiveSubscription).toBe(true);

    // disconnect must wait for close() to complete
    const disconnectStart = Date.now();
    await slowCloseSession.disconnect();
    const elapsed = Date.now() - disconnectStart;
    expect(elapsed).toBeGreaterThanOrEqual(40); // close delay was 50ms
    expect(slowCloseSession.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  it("close-before-ready — ready rejects with aborted, no dangling Promise", async () => {
    const sub = adapter.subscribe({ onEvent: () => {} });
    // Close before awaiting ready (microtask hasn't run yet)
    await Promise.resolve(sub.close());

    // ready must settle (reject) with aborted
    await expect(sub.ready).rejects.toMatchObject({ code: "aborted" });
  });

  it("session resync re-establishes subscription after gap recovery", async () => {
    await session.connect();
    expect(adapter.subscribeCalls).toHaveLength(1);

    // Trigger a gap
    const gapEvent = makeEvent(store.getLastSequence() + 5);
    adapter.emit(gapEvent);

    // Wait for resync to complete
    await new Promise((r) => setTimeout(r, 50));
    expect(session.getDiagnostics().resyncCount).toBe(1);
    expect(adapter.subscribeCalls).toHaveLength(2);
    expect(session.getDiagnostics().hasActiveSubscription).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/subscription-lifecycle.test.ts`
Expected: Most tests PASS immediately (behavior was implemented in Task 2). Some may fail if there are subtle bugs in the Task 2 implementation — fix the implementation, not the tests.

If any test fails, follow the systematic-debugging skill: read the error, reproduce, trace the root cause, fix the implementation. Do NOT weaken the tests.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/subscription-lifecycle.test.ts`
Expected: PASS — 11/11

- [ ] **Step 4: Run full suite**

Run: `npm test`
Expected: PASS — 117/117 (106 existing + 11 new)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/subscription-lifecycle.test.ts
git commit -m "test(core): add subscription lifecycle edge-case tests (#6)

Tests: ready delay, ready rejection, replay gap/mismatch,
async close, close-before-ready, resync re-establish"
```

---

### Task 4: Update runtime-contract.md with async lifecycle documentation

**Files:**
- Modify: `docs/protocol/runtime-contract.md` (Section 4.1 — adapter interface and subscription contract)

- [ ] **Step 1: Read the current Section 4.1**

Read `docs/protocol/runtime-contract.md` and find Section 4.1 (around lines 340-420). Note the current synchronous subscribe contract documentation.

- [ ] **Step 2: Update Section 4.1 to document the async lifecycle**

Replace the subscribe contract subsection (around lines 366-382) with:

```markdown
### 4.1.1 Async Subscription Lifecycle

The `subscribe` method returns a `RuntimeSubscription` instead of a synchronous `Unsubscribe`:

```ts
interface RuntimeStreamObserver {
  onEvent(event: DomainEvent): void;
  onState?(state: RuntimeStreamState): void;
  onError?(error: RuntimeStreamError): void;
}

interface RuntimeSubscription {
  ready: Promise<void>;
  close(): Promise<void> | void;
}

type RuntimeStreamState =
  | "opening"
  | "ready"
  | "reset_required"
  | "error"
  | "closed";
```

**No `reconnecting` state:** `RuntimeSession` owns reconnect/resync (via `resynchronizing` / `degraded` session states). The adapter only owns one stream lifecycle. This prevents responsibility overlap.

**Protocol: `subscribe()` must NOT synchronously call `observer` before returning.** Replay must be deferred to at least one microtask. This lets the caller save the `RuntimeSubscription` reference before events arrive — required for the session's `handleEvent` guard (`if (!this.subscription) return;`) to work.

**Lifecycle ordering rules:**

1. **Ready success:** `[replay via onEvent] → onState("ready") → ready.resolve()`
2. **Ready failure (stream open failed):** `ready.reject(RuntimeStreamError)` — ONLY this. No `onError`, no `onState` before rejection. The session treats rejection as `subscribe_failed`.
3. **Close before ready:** `ready.reject({ code: "aborted", recoverable: false })` — no dangling Promise.
4. **Ready succeeded, then stream error:** `onError(error) → onState("error" | "reset_required")`
5. **Close after ready (normal shutdown):** `onState("closed")`

**Session contract:**
- `RuntimeSession` calls `installSubscription()` which saves the subscription, then `await subscription.ready` before transitioning to `connected`.
- After `await ready`, the session checks: epoch unchanged, subscription identity unchanged, state not degraded/resynchronizing/failed.
- `handleEvent` has a `if (!this.subscription) return;` guard — stale events from an async-closed stream are discarded.
- `removeSubscription()` is async and `await`s `subscription.close()` to guarantee "no old stream may remain active after resync" (Issue #6).

**Mock/TestAdapter behavior:** replay is microtask-deferred (`Promise.resolve().then(...)`). `ready` resolves immediately after replay. `close()` is async (TestAdapter supports `closeDelayMs` for testing). TestAdapter also supports `subscribeReadyDelayMs` and `subscribeReadyError` for edge-case testing.

**Replay validation (Plan 2):** For remote transports, `ready` rejects on non-contiguous replay or trimmed history. The session treats `ready` rejection as a `subscribe_failed` error and triggers checkpoint resynchronization.
```

Also update the `RuntimeAdapter` interface listing in Section 4.1 to show the new `subscribe` signature.

- [ ] **Step 3: Verify build still passes (docs change shouldn't break)**

Run: `npm run build && npm test`
Expected: PASS — 117/117

- [ ] **Step 4: Commit**

```bash
git add docs/protocol/runtime-contract.md
git commit -m "docs: document async subscription lifecycle in runtime-contract (#6)"
```

---

## Self-Review

**1. Spec coverage:** Issue #6's "P0 — Async subscription lifecycle" section requires:
- ready/open acknowledgement ✓ (Task 1 types + Task 2 await ready)
- stream error notification ✓ (Task 1 types, RuntimeStreamError)
- reset/checkpoint-required signal ✓ (RuntimeStreamState includes `reset_required`)
- deterministic close/abort ✓ (Task 2 async removeSubscription + Task 3 close-before-ready test)
- no `reconnecting` state (Session owns reconnect) ✓ (Task 1 type definition)
- update Mock/Test/Session/docs/tests ✓ (Task 2 migration + Task 3 tests + Task 4 docs)
- no old stream active after resync ✓ (Task 2 async removeSubscription awaits close)

The remaining P0 sections (HTTP transport, SSE parser, cursor-safe bootstrap for remote, RuntimeSession integration with HTTP, auth) are Plan 2.

**2. Placeholder scan:** No TBD/TODO. All code blocks are complete. Every test uses verified API signatures:
- `new TestRuntimeAdapter({ initialSnapshot: ... })` ✓ (constructor takes options object)
- `new CommandGateway(adapter)` ✓ (constructor takes only adapter)
- `new SnapshotStore(runtimeId)` ✓ (constructor takes string)
- `adapter.unsubscribeCount` ✓ (public field, not method)
- `store.getLastSequence()` ✓ (method exists)
- `session.getDiagnostics()` ✓ (returns SessionDiagnostics)

**3. Type consistency:**
- `RuntimeStreamObserver` and `RuntimeSubscription` defined in Task 1, used identically in Task 2.
- `RuntimeSubscription.close()` signature matches across all implementors (`Promise<void> | void`).
- `this.subscription` field name consistent across session.ts changes (4b, 4c, 4d, 4e, 4f, 4g, 4h).
- `installSubscription` returns `RuntimeSubscription` in 4c, consumed via `await subscription.ready` in 4f and 4g.
- `removeSubscription` is `async` in 4d, awaited in 4f (doConnect cleanup), 4g (doResynchronize start + catch), 4h (disconnect).
- TestRuntimeAdapter new fields (`subscribeReadyDelayMs`, `subscribeReadyError`, `closeDelayMs`) defined in Step 3, used in Task 3 tests.
- `RuntimeStreamError` satisfies checks in adapter implementations match the interface in Task 1.

**4. Issue-by-issue verification (user's 7 critical issues):**

| # | Issue | Fix |
|---|-------|-----|
| 1 | Session doesn't await `subscription.ready` | Task 2 Step 4f/4g: `installSubscription` returns `RuntimeSubscription`, callers `await subscription.ready` with epoch/subscription/state checks before `setState("connected")` |
| 2 | Sync replay conflicts with handleEvent guard | Task 2 Step 2/3: Mock/TestAdapter replay deferred to `Promise.resolve().then(...)` — no synchronous observer callbacks before `subscribe()` returns |
| 3 | `close()` returns Promise but not awaited | Task 2 Step 4d: `removeSubscription()` is `async`, `await Promise.resolve(subscription.close())`. All call sites (4f, 4g, 4h) `await this.removeSubscription()` |
| 4 | ready/onError/onState semantics undefined | "Stream Lifecycle Protocol" section at top of plan + Task 4 docs. `RuntimeStreamState` drops `reconnecting`. Explicit ordering rules for all 5 scenarios. |
| 5 | `.test-d.ts` fails (ambient context) | Task 1 Step 1: `types.typecheck.ts` with `satisfies` operator — regular `.ts` file, no ambient context issues |
| 6 | Task 3 test API mismatch | Task 3 Step 1: all test code uses verified real API (`TestRuntimeAdapter({initialSnapshot})`, `CommandGateway(adapter)`, `adapter.unsubscribeCount` field, `store.getLastSequence()` method) |
| 7 | Need more tests | Task 3: 11 tests total — includes ready delay, ready rejection, replay gap, replay mismatch, async close, close-before-ready (all 6 user-required cases + 5 basic contract tests) |

**5. All 7 user-mandated pre-start fixes are addressed:**
- ✅ Session MUST await `subscription.ready`
- ✅ Mock/Test Replay not synchronous before `subscribe()` returns
- ✅ `removeSubscription()` is async and awaits `close()`
- ✅ Explicit ready/onError/onState semantics
- ✅ `.typecheck.ts` with `satisfies` (not `.test-d.ts`)
- ✅ Task 3 test code uses correct repo API
- ✅ 6+ new tests (ready delay/reject, replay gap/mismatch, async close, close-before-ready)
