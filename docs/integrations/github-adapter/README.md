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
      ├──▶ office DomainEvent 序列（task.created / artifact.drafted / artifact.delivered …）
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
