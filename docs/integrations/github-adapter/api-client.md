# GitHubApiClient 使用指南

`GitHubApiClient` 是 GitHub REST API 的只读客户端，将 raw API JSON 转换为 `GitHubIssueFixture` / `GitHubPRFixture` 类型供 `GitHubRuntimeAdapter` 使用。

## 构造

```typescript
import { GitHubApiClient } from "@agent-office/adapter-github";

const client = new GitHubApiClient({
  token: process.env.GITHUB_TOKEN,  // 必填，空字符串用于测试
  baseUrl: "https://api.github.com", // 可选，默认值
  userAgent: "agent-office-github-adapter", // 可选
  timeoutMs: 30000, // 可选
});
```

## 鉴权

- `token` 非空时，每个请求附加 `Authorization: Bearer {token}` header
- `token` 为空字符串时，不附加 `Authorization` header（用于 msw 测试）
- 生产环境从 `process.env.GITHUB_TOKEN` 读取

## 分页

- 使用 `per_page=100` 减少调用次数
- 解析 `Link` response header 中的 `rel="next"` URL
- 循环拉取直到无 `next`，返回完整数组

## Rate Limit

每次请求后检查 `X-RateLimit-Remaining` header：
- `> 0`：继续
- `= 0`：计算 `X-RateLimit-Reset - now`
  - `≤ 60 秒`：`setTimeout` 等待后继续
  - `> 60 秒`：抛 `GitHubApiError`（避免无限等待）

## 错误处理

| HTTP 状态 | 行为 |
|---|---|
| 200 | 正常返回 |
| 401 / 403 | 抛 `GitHubApiError`（鉴权失败或 rate limit） |
| 404 | 抛 `GitHubApiError`（repo 不存在或无权限） |
| 429 | 抛 `GitHubApiError`（secondary rate limit） |
| 5xx | 抛 `GitHubApiError`（服务器错误，v0 不重试） |

`GitHubApiError` 包含 `status`、`rateLimitRemaining`、`rateLimitReset` 字段，便于上层处理。

## API 端点

| 方法 | 端点 |
|---|---|
| `fetchIssues(owner, repo)` | `GET /repos/{owner}/{repo}/issues?state=all&per_page=100` |
| `fetchPRs(owner, repo)` | `GET /repos/{owner}/{repo}/pulls?state=all&per_page=100` |
| (内部) comments | `GET /repos/{owner}/{repo}/issues/{n}/comments` |
| (内部) reviews | `GET /repos/{owner}/{repo}/pulls/{n}/reviews` |

`fetchIssues` 自动过滤 issues endpoint 返回的 PR（有 `pull_request` 字段的条目）。

## 增量拉取（Phase 2.3）

`fetchIssuesSince` 和 `fetchPRsSince` 支持基于 `since` cursor 的增量拉取：

| 方法 | 端点 | 策略 |
|---|---|---|
| `fetchIssuesSince(owner, repo, since)` | `GET /repos/{owner}/{repo}/issues?state=all&per_page=100&since={ISO8601}` | GitHub 原生 `since` 参数过滤 |
| `fetchPRsSince(owner, repo, since)` | `GET /repos/{owner}/{repo}/pulls?state=all&per_page=100&sort=updated&direction=desc` | 降序分页 + early-stop（`updated_at <= since` 时停止） |

- `since` 为空字符串时，两个方法都 fallback 到全量 `fetchIssues` / `fetchPRs`
- 返回的 fixture 包含 `updatedAt` 字段，adapter 用它推进 cursor
