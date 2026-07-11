# GitHub Runtime Adapter v0

## 目标

GitHub Runtime Adapter v0 是一个**只读投影 adapter**，使 Agent Office 能够从 GitHub 仓库状态中确定性地生成 Runtime-backed Snapshot / Event。

- GitHub Issue 表示为 Office Task
- GitHub PR 表示为 Artifact / Review Item
- GitHub label / state / comment / review status 表示为 adapter evidence 或 Runtime Event
- UI 不得凭空伪造 GitHub 业务状态

## 数据流

```
GitHub Fixtures (issue / pr fixture)
      │
      ▼
GitHubRuntimeAdapter.syncFromFixtures()
      │
      ├──▶ adapter evidence（issue 号 / url / labels / comments / assignees / reviewers）
      ├──▶ office DomainEvent 序列（task.created / artifact.drafted / artifact.delivered / artifact.closed …）
      │
      ▼
reduceEvent()  ──▶  RuntimeSnapshot
                        │
                        ▼
              projectSnapshot() → OfficeProjection
```

## 支持的映射

详见 [mapping-table.md](./mapping-table.md)。

## 不支持的命令

v0 是纯投影源，**不接受任何写操作**。`execute()` 对所有命令返回 `rejected`（error.code=`UNSUPPORTED_COMMAND`）。

包括：`task.create`、`task.assign`、`agent.pause`、`agent.resume`、`approval.accept`、`approval.reject`、`artifact.open` —— 全部拒绝。

## Runtime Truth Boundary

1. **无 evidence 则不存在**：snapshot 中每个 task/artifact 都能通过 `getGitHubEvidence()` 找到对应 GitHubSourceRef。
2. **adapter 不接受写**：`execute()` 全部 rejected，UI 无法通过 adapter 注入 task/artifact。
3. **Closes #X 不替代 acceptance**：PR body 中的 `Closes #X` 仅作 evidence，只有 fixture 中 issue.state=closed 才发 `task.completed`。
4. **agents/rooms 为空**：GitHub adapter 不自建 office agents/rooms，snapshot 中 `agents=[] rooms=[]`。GitHub assignees/reviewers/commenters 只作为 external actor evidence。
5. **Projection 无静默错误**：`getSnapshot()` 收集 replay 期间所有 reducer errors，通过 `getLastReplayErrors()` 暴露；所有 fixture replay 测试断言该返回值为空数组。
6. **关闭语义可区分**：`GitHubSourceRef.stateReason` 保存 `completed` / `not_planned` / `merged` / `closed-unmerged`，`closedAt` 保存关闭时间，二者在 evidence 中可精确断言。

## v0 限制

详见 [v0-limitations.md](./v0-limitations.md)。

## 使用示例

```typescript
import { GitHubRuntimeAdapter, SAMPLE_FIXTURES } from "@agent-office/adapter-github";

const adapter = new GitHubRuntimeAdapter();
await adapter.connect();
adapter.syncFromFixtures(SAMPLE_FIXTURES);

const snapshot = await adapter.getSnapshot();
const evidence = adapter.getGitHubEvidence();
const events = adapter.getEventLog();
```

## API 模式（Phase 2.2）

除了 fixture 模式，`GitHubRuntimeAdapter` 支持直接从 GitHub REST API 拉取数据：

```typescript
import { GitHubRuntimeAdapter, GitHubApiClient } from "@agent-office/adapter-github";

const client = new GitHubApiClient({
  token: process.env.GITHUB_TOKEN!,  // 必填，从环境变量读
});
const adapter = new GitHubRuntimeAdapter();
await adapter.connect();
await adapter.syncFromApi(client, "Leonardo0402", "AI-STARDEW-VALLEY");

const snapshot = await adapter.getSnapshot();
```

`GitHubApiClient` 负责：
- Bearer token 鉴权
- 分页（Link header，per_page=100）
- rate limit 感知（剩余为 0 时等待，超过 60s 抛错）
- N+1 comments / reviews 拉取
- raw GitHub JSON → fixture 类型映射

详见 [api-client.md](./api-client.md)。

## 增量同步（Phase 2.3）

`GitHubSyncScheduler` 提供定时增量同步，自动检测变更并只 emit 状态转换事件：

```typescript
import { GitHubRuntimeAdapter, GitHubApiClient, GitHubSyncScheduler } from "@agent-office/adapter-github";

const client = new GitHubApiClient({ token: process.env.GITHUB_TOKEN! });
const adapter = new GitHubRuntimeAdapter();
await adapter.connect();

const scheduler = new GitHubSyncScheduler(
  adapter,
  client,
  { owner: "Leonardo0402", repo: "AI-STARDEW-VALLEY", intervalMs: 60000 },
  {
    onSyncSuccess: (cursor) => console.log(`Synced up to ${cursor}`),
    onSyncFailure: (err, willResync) => console.error(`Sync failed: ${err.message}, will resync: ${willResync}`),
    onResync: () => console.log("Full resync triggered"),
  },
);

scheduler.start();
// ... later
scheduler.stop();
```

增量同步特性：
- 基于 `lastUpdatedAt` cursor，只拉取变更的 entities
- 对每个 entity diff 旧 evidence vs 新 fixture，只 emit 状态转换事件
- 首次同步（空 cursor）自动 fallback 到全量 `syncFromApi`
- 网络失败时下次自动触发全量 resync
