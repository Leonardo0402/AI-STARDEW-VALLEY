# GitHub Runtime Adapter v0 限制

## 为何 v0 不实现破坏性写操作

Phase 2.1（Issue #34）只做目标链路的**前半段**：

```
GitHub Issue / PR → Runtime Event → Agent Office Snapshot
```

破坏性写操作（merge/delete/approve/close）属于**后半段**（Command Gateway 写链路），留给单独的 Issue 实现。v0 聚焦于确定性投影的正确性，确保 Runtime Truth Boundary 不被违反。

## 明确不实现

- PR merge、branch delete、issue 自动 close、PR 自动 approve 等任何破坏性 GitHub 写操作
- UI 直接修改 Runtime Snapshot
- 像素层直接推断 GitHub 状态
- Command Gateway 完整写操作链路
- 接真实 GitHub API（v0 用 fixture，但数据结构贴近真实 GitHub 概念以便后续替换）
- 视觉 polish、pixel renderer / canvas / layout / sprite / animation / screenshot baseline 修改
- LLM 自由修改世界状态

## v0 的只读强制

`execute()` 对所有命令返回 `rejected`：

```typescript
{
  status: "rejected",
  error: {
    code: "UNSUPPORTED_COMMAND",
    message: "GitHub Runtime Adapter v0 is read-only; no commands are supported"
  },
  affectedEventIds: []
}
```

包括 `task.create/assign`、`approval.accept/reject`、`artifact.open` 等 —— 全部拒绝。adapter 是纯投影源，不接受任何写操作。

## 如何衔接 Command Gateway v0

后续 Command Gateway v0（单独 Issue）将作为写链路：

```
Command Gateway v0（写链路）
      │
      ▼
RuntimeSession（组合投影源 + 写链路）
      ├── GitHubRuntimeAdapter（只读投影）
      └── CommandGateway（写操作，通过 RuntimeSession 组合）
```

- GitHubRuntimeAdapter 作为投影源，提供 GitHub → Snapshot 的确定性投影
- Command Gateway 作为写链路，接收 office 命令并转换为 GitHub API 调用
- 二者通过 RuntimeSession 组合，保持 Runtime Truth Boundary

## 确定性保证

- 事件 ID 使用稳定格式 `evt-gh-{seq}-{entityKind}-{entityNumber}`（无 `Date.now()`）
- 时间戳使用 fixture 提供的值或 `baseTimestamp`（默认 `"2026-01-01T00:00:00Z"`）
- 相同 fixture 输入 → 相同 event 序列 → 相同 snapshot

## 关闭语义保存（stateReason / closedAt）

`GitHubSourceRef` 保存 GitHub 原始关闭语义，使 `completed` 与 `not_planned` 在 evidence 中可区分：

| GitHub 实体 | stateReason 取值 | closedAt 取值 |
|---|---|---|
| closed issue（completed） | `"completed"` | issue.closedAt |
| closed issue（not_planned） | `"not_planned"` | issue.closedAt |
| merged PR | `"merged"` | pr.mergedAt |
| closed-unmerged PR | `"closed-unmerged"` | pr.closedAt |
| open issue / open PR | `undefined` | `undefined`/`null` |

测试精确断言 `evidence.tasks[...].stateReason === "not_planned"` 与 `=== "completed"`，二者在 evidence 中可区分。

## closed-unmerged PR 无 review 的语义表达

当 PR 处于 closed-unmerged 且**没有任何已提交 review** 时，v0 不伪造 `reviewerId`，而是发射语义明确的 `artifact.closed` 事件：

```typescript
{ artifactId, closedBy: null, reason: "closed-unmerged" }
```

reducer 将 artifact 状态置为 `rejected`。这与"有 review 但被 rejected"的路径（`artifact.reviewed` + 真实 reviewerId）在 evidence 中可区分：前者 `artifact.reviewResult === null`，后者 `reviewResult.reviewerId` 为真实 GitHub login。

## blocked label 仅适用于 open issue

`task.blocked` 事件只对 **open** issue 发射。closed issue 即使携带 `blocked` label，也直接通过 `task.completed` 转为 `completed`，避免 `created → blocked → completed` 的语义错误路径。

## Projection 完整性

`GitHubRuntimeAdapter.getSnapshot()` 在 replay 期间收集所有 reducer errors，通过 `getLastReplayErrors()` 暴露。所有 fixture replay 测试必须断言 `adapter.getLastReplayErrors()` 返回空数组，确保 projection 无非法状态转换被静默吞掉。

## API 模式限制（Phase 2.2）

API 模式（`syncFromApi`）仍受 v0 只读约束：
- `execute()` 对所有命令返回 `rejected`（与 fixture 模式一致）
- 不实现 merge / close / approve 等写操作
- rate limit 耗尽且 reset 超过 60 秒时抛 `GitHubApiError`（不无限等待）
- HTTP 5xx 错误直接抛错（v0 不重试）
- N+1 拉取：每个 issue 拉 comments，每个 PR 拉 reviews + comments（5000 req/hour 足够中小 repo）
- 不支持 webhook 事件流或 SSE 实时推送（留给 Phase 2.3）

## 增量同步限制（Phase 2.3）

增量同步（`syncIncremental` + `GitHubSyncScheduler`）的 v0 边界：

- **Cursor 是内存的**：进程重启后丢失，首次 sync 自动 fallback 到全量
- **无 ETag / 304 快速路径**：每次 sync 发 HTTP 请求，即使无变更（留给后续优化）
- **reopened issue 不 emit 事件**：protocol 无 `task.reopened` EventType，reopened 只更新 evidence，projection 可能暂时 stale 直到全量 resync
- **label/assignee/review 变化不 emit 事件**：v0 只 emit 状态转换（open→closed / open→merged），非状态变化只更新 evidence
- **无并发锁**：`setInterval` 不 await，假设 sync < interval；超时由 resync 兜底
- **无 backoff**：失败后下次 interval 照常触发，resync 是安全网
- **无 webhook / SSE**：Phase 2.3 仍是 polling

## Phase 2.4: Command Gateway v0

- **Dangerous operations**: merge / close / delete / force-push return `UNSUPPORTED_COMMAND`, deferred to Phase 2.5
- **Approval flow**: no human-in-the-loop approval before command execution (Phase 2.5 or later)
- **Multi-repo**: adapter holds a single `{owner, repo}`, no runtime switching
- **GitHub rate_limit query**: Policy does not call `/rate_limit` API, only local counter
- **Retry / backoff**: API failure does not auto-retry, returns error CommandResult directly
- **Concurrency lock**: `execute()` has no concurrency guard (YAGNI, single-runtime serial assumption)
- **Event rollback**: if API succeeds but emit fails, no rollback of GitHub operation (emit is in-memory, cannot fail)
- **Webhook verification**: does not verify command source is a real GitHub webhook
- **Comment author authenticity**: emitted `author` uses `command.actorId` (office-side actor), not the GitHub API-returned user
- **Label color**: `addLabel` sends label name only; GitHub assigns default color
- **Reducer snapshot mutation**: `ISSUE_COMMENTED` / `ISSUE_LABELED` / `ISSUE_UNLABELED` are event-trail-only no-ops on `TaskSnapshot` (which has no `labels`/`comments` field); evidence is tracked in `GitHubAdapterEvidence` only
