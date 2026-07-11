# Issue #45 — Phase 2.5: Safe GitHub Actions Design

**Date:** 2026-07-11
**Issue:** #45
**Phase:** 2.5
**Status:** Design approved (8 sections)

## Context

Phase 2.4 (Issue #43) 为 `GitHubRuntimeAdapter` 开启了有限的、策略控制的写路径（4 个安全操作：`issue.add_comment` / `issue.add_label` / `issue.remove_label` / `pr.request_review`）。

Phase 2.5 在此基础上增加 **Draft 机制** 和 **审计注释**：

- 5 个新操作：`issue.draft` / `comment.draft` / `draft.submit` / `draft.discard` / `audit_note`
- Draft 机制：草稿先存本地（adapter 内存 Map），不调 GitHub API；submit 时才真正执行
- `audit_note`：不触发 GitHub notification 的审计注释（本地 evidence 记录）
- 危险操作继续 `UNSUPPORTED_COMMAND`

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Draft 存储 | Adapter 内存 Map | 最简单，与现有模式一致，草稿是临时态可接受重启丢失 |
| Draft 语义 | `issue.draft`=新issue, `comment.draft`=评论 | issue.draft 草拟待创建的新 issue，comment.draft 草拟对现有 issue 的评论 |
| 事件模型 | 仅 submit 发射事件 | draft 创建/丢弃是本地状态变更，不进入事件流；submit 产生真实效果才发射 |
| `audit_note` 实现 | 本地 evidence 记录 | GitHub REST API 无原生 silent 选项，本地记录真正零 notification |
| Draft 生命周期 | submit/discard 后移除 | 一次性消费，提交后记录由 DomainEvent 承担 |
| 架构方案 | 方案 A：扩展现有 dispatch | 与 Phase 2.4 模式一致，无新文件，draft Map 是 adapter 私有字段 |

## §1. Protocol 变更

`packages/protocol/src/index.ts` 新增：

### 5 个新 CommandType

```typescript
ISSUE_DRAFT: "issue.draft",
COMMENT_DRAFT: "comment.draft",
DRAFT_SUBMIT: "draft.submit",
DRAFT_DISCARD: "draft.discard",
AUDIT_NOTE: "audit_note",
```

### 2 个新 EventType

```typescript
ISSUE_CREATED: "issue.created",       // draft.submit(issue) 时发射
AUDIT_NOTE_ADDED: "audit.note_added", // audit_note 时发射
```

注：`draft.submit(comment)` 复用现有 `ISSUE_COMMENTED`。`issue.draft` / `comment.draft` / `draft.discard` 不发射事件（本地状态变更）。

### 5 个新 CommandPayload

```typescript
export interface IssueDraftPayload {
  title: string;
  body: string;
}

export interface CommentDraftPayload {
  issueNumber: number;
  body: string;
}

export interface DraftSubmitPayload {
  draftId: Id;
}

export interface DraftDiscardPayload {
  draftId: Id;
}

export interface AuditNotePayload {
  taskId?: Id;
  body: string;
}
```

### 2 个新 EventPayload

```typescript
export interface IssueCreatedPayload {
  taskId: Id;
  issueNumber: number;
  title: string;
  body: string;
  author: Id;
  createdAt: string;
}

export interface AuditNoteAddedPayload {
  taskId: Id | null;
  body: string;
  author: Id;
  createdAt: string;
}
```

### 2 个新 reducer case（event-trail-only no-ops）

`ISSUE_CREATED` 和 `AUDIT_NOTE_ADDED` 在 reducer 中只 `break`，不修改 snapshot。与 Phase 2.4 的 `ISSUE_COMMENTED` 等一致——evidence 在 adapter 侧维护，snapshot 通过下次 sync 反映。

## §2. 数据结构

### Draft 类型（adapter 私有，不进 protocol）

`packages/adapters/github/src/types.ts` 新增：

```typescript
export type DraftKind = "issue" | "comment";

export interface IssueDraft {
  draftId: Id;
  kind: "issue";
  title: string;
  body: string;
  createdBy: Id;
  createdAt: string;
}

export interface CommentDraft {
  draftId: Id;
  kind: "comment";
  issueNumber: number;
  body: string;
  createdBy: Id;
  createdAt: string;
}

export type Draft = IssueDraft | CommentDraft;

export interface AuditNote {
  auditId: Id;
  taskId: Id | null;
  body: string;
  author: Id;
  createdAt: string;
}
```

### Evidence 扩展

```typescript
export interface GitHubAdapterEvidence {
  tasks: Record<Id, GitHubSourceRef>;
  artifacts: Record<Id, GitHubSourceRef>;
  auditNotes: AuditNote[];  // 新增
}
```

Drafts **不进** evidence。evidence 是"已发生事实的伴随结构"，draft 是"未执行意图"，语义不符。drafts 仅存在于 adapter 私有 `Map<Id, Draft>` 字段。auditNotes 进 evidence，因为它代表已添加的审计记录（虽然不调 GitHub API，但是一个持久化的本地事实）。

### adapter 新增字段

```typescript
private drafts = new Map<Id, Draft>();
```

## §3. API Client 扩展

`GitHubApiClient` 新增 1 个写方法（`comment.draft.submit` 复用现有 `addComment`）：

```typescript
async createIssue(owner: string, repo: string, title: string, body: string): Promise<{
  issueNumber: number;
  url: string;
  createdAt: string;
}> {
  const result = await this.rawPost(`/repos/${owner}/${repo}/issues`, { title, body });
  return {
    issueNumber: result.number,
    url: result.html_url,
    createdAt: result.created_at,
  };
}
```

### 映射关系

- `draft.submit(issue)` → `apiClient.createIssue()` → POST /repos/{owner}/{repo}/issues
- `draft.submit(comment)` → `apiClient.addComment()`（已存在）→ POST /repos/{owner}/{repo}/issues/{number}/comments
- `audit_note` → **不调 API**（本地 evidence 记录）

### Policy 扩展

- `supported` 数组增加 5 个 CommandType
- payload validation 规则：
  - `issue.draft`: title 非空，body 可空
  - `comment.draft`: issueNumber 正整数，body 非空
  - `draft.submit`: draftId 非空
  - `draft.discard`: draftId 非空
  - `audit_note`: body 非空，taskId 可空
- rate limit 复用现有机制

## §4. Handler 行为

adapter `execute()` switch 增加 5 个 case，dispatch 到 5 个新 handler。

### 4.1 `executeIssueDraft` — 纯本地，不调 API

```typescript
private async executeIssueDraft(command: OfficeCommand<IssueDraftPayload>): Promise<Id> {
  const draftId = `draft-${this.sequence + 1}`;
  const draft: IssueDraft = {
    draftId,
    kind: "issue",
    title: command.payload.title,
    body: command.payload.body,
    createdBy: command.actorId,
    createdAt: this.baseTimestamp,
  };
  this.drafts.set(draftId, draft);
  // 不发射事件（本地状态变更）
  return draftId;
}
```

返回 `draftId`，不发射 DomainEvent。`CommandResult.affectedEventIds` 存 draftId（非 eventId，但符合字段语义"受影响的标识"）。

### 4.2 `executeCommentDraft` — 纯本地

```typescript
private async executeCommentDraft(command: OfficeCommand<CommentDraftPayload>): Promise<Id> {
  const draftId = `draft-${this.sequence + 1}`;
  const draft: CommentDraft = {
    draftId,
    kind: "comment",
    issueNumber: command.payload.issueNumber,
    body: command.payload.body,
    createdBy: command.actorId,
    createdAt: this.baseTimestamp,
  };
  this.drafts.set(draftId, draft);
  return draftId;
}
```

### 4.3 `executeDraftSubmit` — 调用真实 API，发射 DomainEvent

```typescript
private async executeDraftSubmit(command: OfficeCommand<DraftSubmitPayload>): Promise<Id> {
  const draft = this.drafts.get(command.payload.draftId);
  if (!draft) {
    throw new GitHubApiError(404, `Draft not found: ${command.payload.draftId}`);
  }

  if (draft.kind === "issue") {
    const result = await this.apiClient!.createIssue(this.owner!, this.repo!, draft.title, draft.body);
    this.drafts.delete(draft.draftId);
    const taskId: Id = `gh-issue-${result.issueNumber}`;
    return this.emit(
      EventType.ISSUE_CREATED,
      { taskId, issueNumber: result.issueNumber, title: draft.title, body: draft.body, author: draft.createdBy, createdAt: result.createdAt },
      "issue", result.issueNumber, result.createdAt
    );
  } else {
    // comment draft → 复用 addComment
    const result = await this.apiClient!.addComment(this.owner!, this.repo!, draft.issueNumber, draft.body);
    this.drafts.delete(draft.draftId);
    const taskId: Id = `gh-issue-${draft.issueNumber}`;
    return this.emit(
      EventType.ISSUE_COMMENTED,
      { taskId, commentId: String(result.commentId), author: draft.createdBy, body: draft.body, createdAt: result.createdAt },
      "issue", draft.issueNumber, result.createdAt
    );
  }
}
```

### 4.4 `executeDraftDiscard` — 纯本地

```typescript
private async executeDraftDiscard(command: OfficeCommand<DraftDiscardPayload>): Promise<Id> {
  const draft = this.drafts.get(command.payload.draftId);
  this.drafts.delete(command.payload.draftId);
  return draft?.draftId ?? command.payload.draftId;
}
```

### 4.5 `executeAuditNote` — 纯本地，不调 API，发射 DomainEvent

```typescript
private async executeAuditNote(command: OfficeCommand<AuditNotePayload>): Promise<Id> {
  const auditId = `audit-${this.sequence + 1}`;
  const note: AuditNote = {
    auditId,
    taskId: command.payload.taskId ?? null,
    body: command.payload.body,
    author: command.actorId,
    createdAt: this.baseTimestamp,
  };
  this.evidence.auditNotes.push(note);
  return this.emit(
    EventType.AUDIT_NOTE_ADDED,
    { taskId: note.taskId, body: note.body, author: note.author, createdAt: note.createdAt },
    "issue", 0, note.createdAt  // entityKind/number 仅用于 eventId 生成
  );
}
```

audit_note 虽然不调 GitHub API，但发射 `AUDIT_NOTE_ADDED` 事件（与 §1 一致——"事件=真实效果"，audit_note 产生了本地审计记录，是真实效果）。entityNumber 用 0（无对应 GitHub entity）。

## §5. 错误处理与向后兼容

### 5.1 Unconfigured 模式（无 apiClient）

Phase 2.5 区分需要 API 的命令与纯本地命令：

- `issue.draft` / `comment.draft` / `draft.discard` / `audit_note` — 纯本地操作，**不需要 apiClient**。即使 unconfigured 也正常工作。
- `draft.submit` — 需要调 API，unconfigured 时返回 `UNSUPPORTED_COMMAND`。

**修订后的 `execute()` 早期返回逻辑：**

```typescript
const COMMANDS_REQUIRING_API = new Set<string>([
  CommandType.ISSUE_ADD_COMMENT,
  CommandType.ISSUE_ADD_LABEL,
  CommandType.ISSUE_REMOVE_LABEL,
  CommandType.PR_REQUEST_REVIEW,
  CommandType.DRAFT_SUBMIT,
]);

async execute(command: OfficeCommand): Promise<CommandResult> {
  const needsApi = COMMANDS_REQUIRING_API.has(command.commandType);
  if (needsApi && (!this.apiClient || !this.owner || !this.repo)) {
    return { /* UNSUPPORTED_COMMAND */ };
  }
  // policy + dispatch...
}
```

`issue.draft` / `comment.draft` / `draft.discard` / `audit_note` 不需要 API，无 apiClient 时也正常执行。

### 5.2 Draft 不存在错误

`draft.submit` / `draft.discard` 时 draftId 在 Map 中不存在 → 抛 `GitHubApiError(404, ...)`，由 `mapApiError` 映射为 `{ code: "NOT_FOUND", message }`，`CommandResult.status = "error"`。

### 5.3 Policy 未配置时的行为

与 Phase 2.4 一致：`this.policy` 为 undefined 时跳过 policy 校验，直接 dispatch。测试场景下可注入 policy。

### 5.4 `getCapabilities()` 更新

```typescript
getCapabilities(): AdapterCapabilities {
  const writeConfigured = !!(this.apiClient && this.owner && this.repo);
  const alwaysSupported = [
    CommandType.ISSUE_DRAFT,
    CommandType.COMMENT_DRAFT,
    CommandType.DRAFT_DISCARD,
    CommandType.AUDIT_NOTE,
  ];
  const writeOnly = [
    CommandType.ISSUE_ADD_COMMENT,
    CommandType.ISSUE_ADD_LABEL,
    CommandType.ISSUE_REMOVE_LABEL,
    CommandType.PR_REQUEST_REVIEW,
    CommandType.DRAFT_SUBMIT,
  ];
  return {
    supportedEvents: [...ALL_EVENT_TYPES],
    supportedCommands: writeConfigured
      ? [...alwaysSupported, ...writeOnly]
      : alwaysSupported,
    features: {
      snapshot: true,
      sse: true,
      websocket: false,
      commandExecution: writeConfigured,
      softMapping: false,
      hardOrchestration: false,
    },
  };
}
```

### 5.5 Mock adapter 能力计数

`mock-adapter.test.ts` 的能力断言需更新：
- commands: 11 → 16 (11 + 5)
- events: 20 → 22 (20 + 2)

## §6. 测试策略

延续 Phase 2.4 模式，集中测试在 `command-gateway.test.ts` 续写。

### 6.1 新增测试用例（约 12 个）

**Draft 生命周期：**
1. `issue.draft` 成功 → 返回 draftId，不发射事件，draft 存入 Map
2. `comment.draft` 成功 → 返回 draftId，不发射事件，draft 存入 Map
3. `draft.discard` 成功 → draft 从 Map 移除，不发射事件
4. `draft.discard` 不存在的 draftId → `NOT_FOUND` error

**Draft submit：**
5. `draft.submit(issue)` 成功 → 调 `createIssue`，发射 `ISSUE_CREATED`，draft 从 Map 移除
6. `draft.submit(comment)` 成功 → 调 `addComment`，发射 `ISSUE_COMMENTED`，draft 从 Map 移除
7. `draft.submit` 不存在的 draftId → `NOT_FOUND` error
8. `draft.submit(issue)` API 失败 → `CommandResult.status = "error"`，draft **保留**在 Map（未成功提交，可重试）

**Audit note：**
9. `audit_note` 带 taskId → 发射 `AUDIT_NOTE_ADDED`，note 存入 evidence.auditNotes
10. `audit_note` 不带 taskId（runtime 级）→ 发射 `AUDIT_NOTE_ADDED`，taskId = null
11. `audit_note` 不调 GitHub API（msw 无匹配 handler，验证不发起请求）

**Unconfigured 模式：**
12. unconfigured 时 `issue.draft` / `comment.draft` / `draft.discard` / `audit_note` 正常工作；`draft.submit` 返回 `UNSUPPORTED_COMMAND`

### 6.2 Policy 测试扩展

`github-policy.test.ts` 增加：
- 5 个新命令的 allow/deny 场景
- payload validation（空 title、空 body、非法 issueNumber）
- rate limit 复用现有机制

### 6.3 API client 测试

`github-api-client.test.ts` 增加：
- `createIssue` 成功 → POST /repos/{owner}/{repo}/issues，返回 issueNumber/url/createdAt
- `createIssue` 422 validation error
- `createIssue` 401 unauthorized

### 6.4 Reducer no-op 验证

`reducer.test.ts` 增加：
- `ISSUE_CREATED` 应用到 snapshot → snapshot 不变（no-op）
- `AUDIT_NOTE_ADDED` 应用到 snapshot → snapshot 不变（no-op）
- `lastEventId` 更新（事件进入 eventLog，但 snapshot 结构不变）

### 6.5 Mock adapter 能力计数

`mock-adapter.test.ts` 更新断言：
- commands: 11 → 16
- events: 20 → 22

### 6.6 msw handler 配置

```typescript
// command-gateway.test.ts 中
http.post("https://api.github.com/repos/:owner/:repo/issues", () => {
  return HttpResponse.json({ number: 100, html_url: "...", created_at: "..." });
});
```

## §7. 实现顺序与文件清单

### 7.1 实现顺序（TDD，与 Phase 2.4 一致）

```
Task 1: protocol 类型扩展
  → 新增 5 CommandType, 2 EventType, 5 CommandPayload, 2 EventPayload
  → 更新 mock-adapter.test.ts 能力计数断言 (11→16, 20→22)
  → verify: npm test

Task 2: reducer no-op case
  → 新增 ISSUE_CREATED, AUDIT_NOTE_ADDED 的 break case
  → reducer.test.ts 新增 2 个 no-op 测试
  → verify: npm test

Task 3: Draft/AuditNote 类型 + Evidence 扩展
  → types.ts 新增 DraftKind, IssueDraft, CommentDraft, Draft, AuditNote
  → GitHubAdapterEvidence 增加 auditNotes 字段
  → verify: npm run build (类型检查)

Task 4: GitHubApiClient.createIssue
  → 新增 createIssue 方法
  → github-api-client.test.ts 新增 3 个测试 (成功/422/401)
  → verify: npm test

Task 5: GitHubPolicy 扩展
  → supported 数组 +5 CommandType
  → payload validation 规则
  → github-policy.test.ts 新增 ~8 个测试
  → verify: npm test

Task 6: adapter handlers 实现
  → drafts Map 字段
  → executeIssueDraft, executeCommentDraft, executeDraftSubmit,
    executeDraftDiscard, executeAuditNote
  → execute() switch +5 case
  → COMMANDS_REQUIRING_API 常量
  → getCapabilities() 更新
  → verify: npm run build

Task 7: command-gateway 集成测试
  → 新增 ~12 个测试用例 (见 §6.1)
  → verify: npm test

Task 8: 最终验证
  → npm test (全量)
  → npm run build
  → getEventLog/getGitHubEvidence 可访问新状态 (若需暴露 draft 列表，新增 getter)
```

### 7.2 文件变更清单

| 文件 | 变更类型 |
|------|---------|
| `packages/protocol/src/index.ts` | 修改：+5 CommandType, +2 EventType, +5 Payload, +2 EventPayload |
| `packages/core/src/reducer.ts` | 修改：+2 no-op case |
| `packages/core/src/reducer.test.ts` | 修改：+2 测试 |
| `packages/adapters/github/src/types.ts` | 修改：+Draft/AuditNote 类型, evidence 扩展 |
| `packages/adapters/github/src/github-api-client.ts` | 修改：+createIssue 方法 |
| `packages/adapters/github/src/github-api-client.test.ts` | 修改：+3 测试 |
| `packages/adapters/github/src/github-policy.ts` | 修改：supported +5, validation 规则 |
| `packages/adapters/github/src/github-policy.test.ts` | 修改：+~8 测试 |
| `packages/adapters/github/src/github-adapter.ts` | 修改：drafts Map, 5 handler, dispatch, capabilities |
| `packages/adapters/github/src/command-gateway.test.ts` | 修改：+~12 集成测试 |
| `packages/adapters/mock/src/mock-adapter.test.ts` | 修改：能力断言 11→16, 20→22 |

### 7.3 不需要的文件

- 无新文件（方案 A：扩展现有 dispatch）
- 无新 spec/plan 文件（spec 即本设计文档）

### 7.4 可选的 draft 查询接口

若测试需要验证 draft 存入 Map，可新增：

```typescript
// github-adapter.ts
getDrafts(): Draft[] { return [...this.drafts.values()]; }
getDraft(draftId: Id): Draft | undefined { return this.drafts.get(draftId); }
```

仅测试使用，不进公开 API。在 Task 6 中按需添加。

## §8. 范围边界与 YAGNI

### 8.1 In scope（本 Issue 实现）

- 5 个新 CommandType 的完整生命周期
- Draft 本地暂存 + submit 调真实 API
- audit_note 本地 evidence 记录
- policy 校验扩展
- 全量 TDD 测试覆盖

### 8.2 Out of scope（明确不做）

| 排除项 | 理由 |
|--------|------|
| Draft 持久化到磁盘/数据库 | 用户已确认"Adapter 内存 Map"，重启丢失可接受 |
| Draft 过期自动清理 | YAGNI；v0 不预设 TTL，调用方主动 discard |
| Draft 列表查询公开 API | 仅测试用 getter，不进 RuntimeAdapter 接口 |
| audit_note 调 GitHub API | 用户已确认"本地 evidence 记录"，零 notification |
| audit_note 搜索/过滤 | YAGNI；evidence.auditNotes 是数组，调用方可自行遍历 |
| issue.draft 支持 labels/assignees | YAGNI；v0 只支持 title+body，需时再加 |
| comment.draft 编辑/更新 | YAGNI；discard 后重新 draft 即可 |
| draft.submit 重试机制 | YAGNI；API 失败时 draft 保留，调用方可手动重试 |
| Draft 权限分级（谁能 submit） | 复用现有 policy 的 actor authorization |
| `ISSUE_CREATED` reducer 修改 snapshot | event-trail-only no-op，与 Phase 2.4 一致 |

### 8.3 危险操作继续 UNSUPPORTED_COMMAND

与 Phase 2.4 保持一致。以下操作在任何情况下都返回 `UNSUPPORTED_COMMAND`：
- issue.close / issue.reopen
- pr.merge / pr.close
- branch.delete
- force push
- 任何 delete/destructive 操作

### 8.4 向后兼容

- 现有 4 个 Phase 2.4 写命令行为不变
- unconfigured 模式下 `execute()` 对 Phase 2.4 命令仍返回 `UNSUPPORTED_COMMAND`
- `getCapabilities()` 在 unconfigured 模式下返回 `alwaysSupported` 4 个命令（issue.draft / comment.draft / draft.discard / audit_note），这是**新增能力**，不破坏现有契约
- 现有测试中 `getCapabilities().supportedCommands` 的断言需更新（fixture-only 模式下从 `[]` 变为 4 个命令）

### 8.5 风险点

1. **fixture-only 模式能力变化** — unconfigured 时 `supportedCommands` 从 `[]` 变为 4 个命令。若有测试硬编码 `expect(capabilities.supportedCommands).toEqual([])`，会失败。Task 1 会一并更新。

2. **`emit()` 的 entityNumber=0** — audit_note 无对应 GitHub entity，用 0 作为 eventId 的一部分。需确认不与真实 issue number=0 冲突（GitHub issue number 从 1 开始，0 安全）。
