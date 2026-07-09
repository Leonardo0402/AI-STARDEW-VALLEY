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
