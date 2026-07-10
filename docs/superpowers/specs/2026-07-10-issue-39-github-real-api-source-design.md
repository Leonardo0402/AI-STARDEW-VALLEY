# Phase 2.2: Real GitHub Read Source — 设计文档

- **Issue**: #39 — Phase 2.2: Real GitHub Read Source — 接入真实 GitHub API
- **Date**: 2026-07-10
- **Approach**: A — API client → fixture types → 现有 projection
- **Status**: Approved (pending spec review)

## 1. 目标

将 GitHubRuntimeAdapter 从 fixture 模式升级为实时 API 模式，接入真实 GitHub REST API。

- 实现 `GitHubApiClient` 类（fetch wrapper + 鉴权 + 分页 + rate limit）
- 在 `GitHubRuntimeAdapter` 上新增 `syncFromApi(client, owner, repo)` 方法
- 保持现有 `syncFromFixtures()` 和全部 projection 逻辑不变
- 测试：msw 拦截 fetch 测 API client；现有 fixture 测试保持

## 2. 架构

```
┌──────────────────────────────────────────────────────────┐
│ packages/adapters/github/src/                            │
│                                                          │
│  github-adapter.ts          [现有 projection 不改]        │
│   ├── syncFromFixtures()    [现有]                       │
│   └── syncFromApi(client, owner, repo)  [新增]            │
│        → client.fetchIssues() + client.fetchPRs()        │
│        → 组装 GitHubFixtures                              │
│        → 委托 this.syncFromFixtures(fixtures)             │
│                                                          │
│  github-api-client.ts       [新增]                        │
│   └── class GitHubApiClient                               │
│        constructor({ token, baseUrl? })                  │
│        fetchIssues(owner, repo) → GitHubIssueFixture[]    │
│        fetchPRs(owner, repo) → GitHubPRFixture[]          │
│        private fetchComments(owner, repo, number)        │
│        private fetchReviews(owner, repo, number)         │
│        private paginate<T>(url) → T[]                     │
│        private waitForRateLimit(headers)                  │
│        private parseLinkHeader(linkHeader) → {next?}      │
│                                                          │
│  types.ts                   [现有，不改]                  │
│  fixtures/                  [现有，不改]                  │
│  api-client.test.ts         [新增 — msw 测 API client]    │
└──────────────────────────────────────────────────────────┘
```

### 组件职责

| 组件 | 职责 | 依赖 |
|---|---|---|
| `GitHubApiClient` | 调 GitHub REST API，分页消费，rate limit 感知，raw JSON → `GitHubIssueFixture`/`GitHubPRFixture` | 原生 `fetch`，types.ts |
| `GitHubRuntimeAdapter.syncFromApi()` | 调用 client 获取 fixtures，委托给 `syncFromFixtures()` | `GitHubApiClient` |
| 现有 projection (`processIssue`/`processPR`/`reduceEvent`) | 不改 | — |

### 关键设计决策

1. **client 独立可测**：`GitHubApiClient` 是独立类，不依赖 `GitHubRuntimeAdapter`，可单独用 msw 测试。

2. **client 注入**：`syncFromApi(client: GitHubApiClient, owner: string, repo: string): Promise<void>` — adapter 不持有 client，测试时可注入 mock client，生产时由调用方构造并注入。

3. **token 必填但允许空字符串**：`constructor({ token, baseUrl? }: { token: string; baseUrl?: string })` — 测试传 `token: ""`（msw 不校验 header），生产从 `process.env.GITHUB_TOKEN` 读。adapter 不读环境变量，由调用方负责传 token。

4. **comments/reviews private**：`fetchComments` / `fetchReviews` 是 client 内部 N+1 细节，不对外暴露。对外只有 `fetchIssues` 和 `fetchPRs`。

5. **分页返回完整列表**：`fetchIssues` / `fetchPRs` 返回完整列表（已消费所有分页），不是 iterator。`syncFromApi` 不关心分页，client 全包。

6. **fixture 组装顺序**：`syncFromApi` 里 issues 先于 PRs 处理，与 `syncFromFixtures` 一致。`syncFromFixtures` 已按 number 升序排序，`syncFromApi` 不需要重复排序。

7. **零新依赖**：用原生 `fetch`（Node 18+ / 浏览器内置），与 http-sse adapter 一致。不引入 octokit。

## 3. 数据流

```
GitHubApiClient                    GitHubRuntimeAdapter
     │                                     │
     ▼                                     │
GET /repos/{owner}/{repo}/issues           │
     │  per_page=100, state=all            │
     │  Link header → 下一页                │
     ▼                                     │
 对每个 issue:                              │
   GET /repos/{owner}/{repo}/issues/{n}/comments │
     │                                     │
     ▼                                     │
 GitHubIssueFixture[] ──────────────┐      │
                                    │      │
GET /repos/{owner}/{repo}/pulls     │      │
     │  per_page=100, state=all     │      │
     ▼                              │      │
 对每个 PR:                          │      │
   GET /repos/{owner}/{repo}/pulls/{n}/reviews │
     │                                     │
     ▼                                     │
 GitHubPRFixture[] ─────────────────┤      │
                                    ▼      │
                          syncFromApi(client, owner, repo)
                                    │      │
                                    ▼      │
                           组装 GitHubFixtures
                                    │      │
                                    ▼      │
                           this.syncFromFixtures(fixtures)
                                    │      │
                                    ▼      │
                           现有 projection（不改）
                                    │      │
                                    ▼      │
                           RuntimeSnapshot
```

## 4. GitHubApiClient 详细设计

### 4.1 构造函数

```typescript
export interface GitHubApiClientOptions {
  token: string;          // 必填，测试传 ""，生产从 process.env.GITHUB_TOKEN 读
  baseUrl?: string;       // 默认 "https://api.github.com"，测试可指向 msw
  userAgent?: string;    // 默认 "agent-office-github-adapter"
  timeoutMs?: number;     // 默认 30000
}

export class GitHubApiClient {
  constructor(options: GitHubApiClientOptions) { ... }
}
```

### 4.2 公开方法

```typescript
async fetchIssues(owner: string, repo: string): Promise<GitHubIssueFixture[]>;
async fetchPRs(owner: string, repo: string): Promise<GitHubPRFixture[]>;
```

- 调用 `GET /repos/{owner}/{repo}/issues?state=all&per_page=100`（issues endpoint 也返回 PR，需用 `pull_request` 字段过滤）
- 调用 `GET /repos/{owner}/{repo}/pulls?state=all&per_page=100` 拉 PR
- 对每个 entity 调 N+1 拉取 comments / reviews
- 返回完整列表（分页已消费）

### 4.3 私有方法

```typescript
private async fetchComments(owner: string, repo: string, number: number): Promise<GitHubComment[]>;
private async fetchReviews(owner: string, repo: string, number: number): Promise<GitHubReview[]>;
private async paginate<T>(url: string): Promise<T[]>;  // 解析 Link header，循环到无 next
private parseLinkHeader(link: string | null): { next?: string };
private async waitForRateLimit(headers: Headers): Promise<void>;
private async rawGet(url: string): Promise<{ body: unknown; headers: Headers; status: number }>;
```

### 4.4 鉴权

每次请求附加 header：

```
Authorization: Bearer {token}
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
User-Agent: {userAgent}
```

token 为空字符串时不附加 `Authorization` header（msw 测试场景）。

### 4.5 分页

GitHub REST API 用 `Link` response header 表达分页：

```
Link: <https://api.github.com/...?page=2>; rel="next", <...>; rel="last"
```

`parseLinkHeader()` 解析出 `next` URL；`paginate()` 循环调用直到无 `next`。`per_page=100` 减少调用次数。

### 4.6 Rate Limit 处理

GitHub API rate limit header：

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 1690000000
```

`waitForRateLimit(headers)` 策略：
- `X-RateLimit-Remaining` 为 0 时，计算 `reset - now`，用 `setTimeout` 等待（但不超过 `timeoutMs` 上限）
- 等待期间不可中断（v0 简单实现；未来可加 AbortSignal）
- 如果剩余时间超过 60 秒，抛 `GitHubApiError`（而非无限等待）

### 4.7 错误模型

```typescript
export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimitRemaining?: number,
    public readonly rateLimitReset?: number,
  ) { super(message); this.name = "GitHubApiError"; }
}
```

- HTTP 401/403 → 鉴权错误，不可重试
- HTTP 404 → repo 不存在或无权限
- HTTP 429 → secondary rate limit，可等待后重试（v0 直接抛错，不重试）
- HTTP 5xx → 服务器错误，可重试（v0 直接抛错，不重试）
- 网络错误 / timeout → `GitHubApiError` 包裹

### 4.8 GitHub REST API JSON → Fixture 类型映射

| GitHub REST API 字段 | Fixture 字段 |
|---|---|
| `number` | `number` |
| `html_url` | `url` |
| `title` | `title` |
| `body` | `body` |
| `state` | `state` |
| `state_reason` | `stateReason` |
| `labels[].{name,color}` | `labels[].{name,color}` |
| `assignees[].{login,url}` | `assignees[].{login,url}` |
| `created_at` | `createdAt` |
| `closed_at` | `closedAt` |
| comments API → `[]` | `comments[]` |
| — | — |
| `pull_request` field (issues endpoint) | 用于过滤：issue endpoint 返回的 PR 跳过 |
| `draft` | `draft` |
| `merged` | `merged` |
| `merged_at` | `mergedAt` |
| `merged_by.login` | `mergedBy.{login}` |
| `merge_commit_sha` | `mergeCommitSha` |
| `head.ref` | `headRef` |
| `base.ref` | `baseRef` |
| `requested_reviewers[].login` | `requestedReviewers[].{login}` |
| reviews API → `[]` | `reviews[]` |

## 5. syncFromApi 设计

```typescript
// github-adapter.ts 新增方法
syncFromApi(client: GitHubApiClient, owner: string, repo: string): Promise<void> {
  const [issues, pulls] = await Promise.all([
    client.fetchIssues(owner, repo),
    client.fetchPRs(owner, repo),
  ]);
  this.syncFromFixtures({ repo: { owner, name: repo }, issues, pulls });
}
```

- `issues` 和 `pulls` 并行拉取（`Promise.all`）
- 组装后委托给 `syncFromFixtures`，复用现有排序 + projection 逻辑
- adapter 不持有 client，不读环境变量

## 6. 测试策略

| 测试层 | 工具 | 覆盖什么 |
|---|---|---|
| API client 单元测试 | msw (mock fetch) | 鉴权、分页、rate limit、错误处理、JSON → fixture 映射 |
| Projection 集成测试 | fixture（现有） | 事件映射、snapshot 一致性（不改） |
| 确定性 replay 测试 | fixture（现有） | 相同输入 → 相同输出（不改） |

### 6.1 msw 测试用例

- **鉴权**：token 非空时请求带 `Authorization: Bearer {token}`；token 空时不带
- **分页**：100+ issues 时正确消费 Link header 拉取所有页
- **rate limit**：`X-RateLimit-Remaining: 0` 时等待（用 fake timer）；reset 超过 60s 时抛错
- **错误**：401/403/404/429/500 各自抛 `GitHubApiError` 且 status 正确
- **N+1**：每个 issue 拉取 comments，每个 PR 拉取 reviews
- **JSON 映射**：raw API JSON 正确转换为 `GitHubIssueFixture`/`GitHubPRFixture`
- **issues endpoint 过滤**：issue endpoint 返回的 PR（有 `pull_request` 字段）被跳过
- **syncFromApi**：注入 mock client，验证最终调用 `syncFromFixtures` 且 snapshot 正确

### 6.2 现有测试保持不变

- `projection.test.ts` — 28 tests
- `determinism.test.ts` — 6 tests
- `label-mapping.test.ts` — 11 tests
- `destructive-guard.test.ts` — 5 tests
- `github-adapter.test.ts` — 7 tests
- `protocol-extension.test.ts` — 9 tests

## 7. 文档更新

- `docs/integrations/github-adapter/README.md` — 添加 API 模式使用示例
- `docs/integrations/github-adapter/v0-limitations.md` — 更新：API 模式仍只读，rate limit 策略
- 新增 `docs/integrations/github-adapter/api-client.md` — API client 使用指南（鉴权、分页、rate limit、错误处理）

## 8. 不在范围内

- 写操作（merge/close/approve）— Phase 2.5
- 实时 SSE 推送 — Phase 2.3
- 多 repo 支持
- 视觉 UI 改动
- octokit 或其他 GitHub SDK 依赖
- webhook 事件流（polling 作为 fallback）— 留给后续

## 9. 验收标准对应

| Issue #39 AC | 设计覆盖 |
|---|---|
| 支持 GITHUB_TOKEN 鉴权 | §4.4 — token 必填，`Authorization: Bearer {token}` |
| 能拉取真实 repo 的 issues 和 PRs | §4.2 — `fetchIssues`/`fetchPRs` |
| 分页正确处理（100+ issues） | §4.5 — Link header 分页，per_page=100 |
| rate limit 接近时能等待或报错 | §4.6 — waitForRateLimit + 60s 上限抛错 |
| 测试可用 mock server 或 fixture fallback 运行 | §6 — msw 测 API client，fixture 测 projection |
| projection 结果与 fixture 模式一致 | §5 — syncFromApi 委托给 syncFromFixtures |
| CI 通过 | npm test + npm run build |
| 文档更新 | §7 |
