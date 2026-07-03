# ADR-0002: 事务性 reducer 提交与 RuntimeSession 硬化

- **状态**: Accepted
- **日期**: 2026-07-03
- **关联 Issue**: #4 — Harden RuntimeSession and make reducer rejection transactional

## 背景

Issue #3 引入的 RuntimeSession 已具备 checkpoint 感知与自动重同步能力，
但在审查中暴露出若干硬化缺口：

1. **reducer_rejected 时仍替换 snapshot**：reducer 在非法转换时会返回一个"best-effort"
   的候选 snapshot（可能仅部分字段被修改）。旧版 store 无条件采用这个候选 snapshot，
   导致 transport 层面已接受事件、但 domain 层面状态可能损坏。
2. **并发不安全**：旧版用 `resyncing: boolean` 标志串行化 resync，但调用方无法 await
   同一个 Promise；并发 `connect()` 没有共享 in-flight Promise。
3. **disconnect 竞态**：延迟的 `connect` / `resync` 在 disconnect 之后仍可能安装 snapshot
   或重建订阅，污染已断开的 session。
4. **错误信息单薄**：`runtimeMismatchError: string | null` 只能承载 runtime_mismatch 一类，
   无法区分 connect / snapshot / subscribe / resync / disconnect 失败。
5. **resync 期间旧订阅未拆除**：旧版在拉取新 snapshot 之后才拆除旧订阅，
   等待 snapshot 期间旧订阅可能继续推送事件造成混乱。
6. **测试不可验证**：MockRuntimeAdapter 没有公开 emit，无法构造真实 gap / mismatch 场景，
   现有测试只能间接验证 resync 行为。

## 决策

### 1. 事务性 reducer 提交（transport 接受 vs domain 提交分离）

`SnapshotStore.applyEvent` 把 **transport 接受** 与 **domain 提交** 分离：

- **transport 接受**：sequence 推进 + 入 log + 标记 dedup（与 Runtime 单调一致）
- **domain 提交**：仅当 `reducer.errors.length === 0` 时才采用 `result.snapshot`；
  errors 非空时 **snapshot 保持原状态不变**

`EventApplyResult` 新增 `reducerErrors?: string[]` 字段，让上层（session / UI）
能展示完整的 reducer 拒绝原因列表。`rebuildFromLog` 遵循同一逻辑，保证重放幂等一致。

### 2. 共享 in-flight Promise（单飞）

新增 `connectPromise` / `resyncPromise` 字段。并发的 `connect()` / `resynchronize()`
调用复用同一个 Promise，真正单飞。Promise 落定后字段被清空。

取代旧版的 `resyncing: boolean` 标志（只能阻止并发，无法让调用方 await 同一个 Promise）。

### 3. Epoch race safety

新增 `epoch: number` token。`disconnect()` 递增 epoch。
延迟的 `doConnect` / `doResynchronize` 在每个 `await` 后校验 `this.epoch !== myEpoch`，
不一致即静默 bail out（不抛错、不写 lastError），避免在 disconnect 之后安装 snapshot 或重建订阅。

### 4. 结构化 SessionError

```ts
type SessionErrorCode =
  | "runtime_mismatch"
  | "connect_failed"
  | "snapshot_failed"
  | "subscribe_failed"
  | "resync_failed"
  | "disconnect_failed";

interface SessionError {
  code: SessionErrorCode;
  message: string;
  at: string;
}
```

`SessionDiagnostics.lastError: SessionError | null` 取代旧版的 `runtimeMismatchError: string | null`。
新增 `hasActiveSubscription: boolean` 与 `activeSubscriptionCursor: number | null` 暴露当前订阅状态。

### 5. resync 先拆旧订阅

`doResynchronize` 进入 `resynchronizing` 状态后**立即** `removeSubscription`，
再 `await adapter.getSnapshot()`。避免在等待 snapshot 期间旧订阅继续推送事件。
`handleEvent` 增加 resynchronizing 守卫，期间收到的事件直接 return。

resync 失败时也调用 `removeSubscription`，确保不留活跃订阅。

### 6. TestRuntimeAdapter

新增 `packages/core/src/test-adapter.ts`（不导出到 index.ts，仅测试文件直接 import）：

- 公开 `emit(event)`：向所有当前订阅者推送任意事件
- 可注入 `connectDelayMs` / `connectError` / `snapshotDelayMs` / `snapshotError` / `subscribeError`
- 记录所有 `subscribe` 调用及其 cursor（`subscribeCalls`）与 unsubscribe 次数（`unsubscribeCount`）
- 维护内部 eventLog 支持 cursor-aware replay
- 可手动设置 snapshot（`setSnapshot`）模拟远程 checkpoint 变化

## 理由

### 为什么不采用 reducer 的候选 snapshot？

reducer 在非法转换时仍会返回一个 snapshot（可能仅部分字段被修改）。若采用：
- transport 层面已接受事件（sequence 推进、入 log）
- 但 domain 层面状态可能损坏（部分字段已改、部分未改）
- 后续事件基于损坏状态计算，错误会传播

事务性提交保证 **要么全部应用，要么完全不动**。reducer errors 通过 `reducerErrors`
字段透传给 UI 展示，用户能看到完整的拒绝原因。

### 为什么用 epoch 而不是 AbortController？

- AbortController 需要 adapter 支持 AbortSignal，增加 adapter 契约复杂度
- epoch 是 session 内部 token，不需要 adapter 配合
- epoch 校验是纯比较操作，零开销
- 满足需求：延迟操作感知 disconnect 并 bail out

### 为什么先拆旧订阅再拉 snapshot？

若不先拆：
- 等待 snapshot 期间旧订阅继续推送事件
- 这些事件可能基于旧 checkpoint，与即将安装的新 checkpoint 不一致
- 即使有 resynchronizing 守卫丢弃事件，旧订阅仍占用资源

先拆订阅是更保守、更可预测的策略。

## 后果

### 正面

- 状态一致性：reducer 出错时 snapshot 不被部分修改
- 并发安全：共享 Promise + epoch 消除竞态
- 可观测性：结构化 lastError + 订阅状态暴露
- 可测试性：TestRuntimeAdapter 让真实 gap / mismatch / 失败路径可被测试覆盖

### 负面

- session.ts 复杂度增加（epoch / Promise / 错误分类）
  - 缓解：每个机制有独立测试覆盖（17 个硬化测试）
- TestRuntimeAdapter 是额外测试设施
  - 缓解：不导出到 index.ts，仅测试文件使用

## 备选方案

### A. reducer 出错时抛异常而非返回 errors

否决：reducer 是纯函数，不应抛异常。且抛异常会中断 event log 处理，
无法保持与 Runtime 的单调一致性。

### B. 用 AbortController 取消延迟操作

否决：增加 adapter 契约复杂度，且 AbortController 无法让调用方 await 同一个 Promise。

### C. 保留 resyncing boolean 但加 connectPromise

否决：boolean 标志无法让并发调用方 await 同一个 Promise。共享 Promise 同时解决
"串行化"和"await 复用"两个问题。

## 引用

- `docs/protocol/runtime-contract.md` §5.3、§5.5、§8.3、§8.4、§8.6
- `packages/core/src/session.ts`
- `packages/core/src/store.ts`
- `packages/core/src/test-adapter.ts`
- `packages/core/src/session-hardening.test.ts`
- GitHub Issue #4
- 前序 ADR-0001
