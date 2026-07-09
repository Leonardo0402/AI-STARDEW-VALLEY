# Phase 2.1 — GitHub Runtime Adapter v0 设计

- **Issue:** [#34 — Phase 2.1：GitHub Runtime Adapter v0](https://github.com/Leonardo0402/AI-STARDEW-VALLEY/issues/34)
- **Phase:** Phase 2 — Command Agent Work Integration（前半段：GitHub → Runtime Event → Snapshot）
- **Date:** 2026-07-09
- **Status:** Design approved, ready for implementation plan

## 1. 目标与范围

### 1.1 目标

实现 GitHub Runtime Adapter v0，使 Agent Office 能够从 GitHub 仓库状态中确定性地生成 Runtime-backed Snapshot / Event：

- GitHub Issue 表示为 Office Task；
- GitHub PR 表示为 Artifact / Review Item；
- GitHub label / state / comment / review status 表示为显式 adapter evidence 或 Runtime Event；
- UI 或像素表现层不得凭空伪造 GitHub 业务状态。

v0 只做 Issue #34 目标链路的前半段：

```text
GitHub Issue / PR → Runtime Event → Agent Office Snapshot
```

不包含 Command Gateway 写操作链路（后续单独 Issue）。

### 1.2 关键设计决策（已与用户对齐）

1. **事件映射策略**：github.* 事件概念翻译为现有 office 事件 + adapter evidence。github.* 不作为新 DomainEvent 类型进入事件日志，仅作为 adapter 内部 sync 概念与 evidence 命名空间。零协议改动于 github.* 侧。
2. **Agent/Assignee 表达**：GitHub adapter 不自建 office agents/rooms。snapshot 中 `agents=[] rooms=[]`，GitHub assignees/reviewers/commenters 作为 external actor evidence。真实 office agents/rooms 须由 MockRuntimeAdapter、QclawRuntime 或其他真实 Agent Runtime 提供。
3. **PR 状态协议缺口**：最小协议扩展，新增 3 个 artifact 事件（`artifact.drafted` / `artifact.review_requested` / `artifact.delivered`），以准确表达 draft PR、review requested、merged PR 状态。adapter 先产生 github.pr.* adapter evidence，再由 reducer 映射为通用 artifact 事件。禁止 adapter 绕过 reducer 直接写 snapshot。

### 1.3 Out of Scope

明确不实现：

- PR merge、branch delete、issue 自动 close、PR 自动 approve 等任何破坏性或高风险 GitHub 写操作；
- UI 直接修改 Runtime Snapshot；
- 像素层直接推断 GitHub 状态；
- Command Gateway 完整写操作链路；
- 接真实 GitHub API（v0 用 fixture，但数据结构贴近真实 GitHub 概念以便后续替换）；
- 视觉 polish、pixel renderer / canvas / layout / sprite / animation / screenshot baseline 修改；
- Godot / Cocos / 渲染器迁移；
- LLM 自由修改世界状态。

## 2. 架构与数据流

### 2.1 核心定位

GitHub Runtime Adapter v0 是一个**只读投影 adapter**：消费 GitHub fixture（issue/PR 数据），产出标准 office `DomainEvent` 序列，经现有 `reduceEvent` reducer 生成 `RuntimeSnapshot`。

### 2.2 数据流

```text
GitHub Fixtures (issue / pr fixture)
        │
        ▼
GitHubRuntimeAdapter.syncFromFixtures()
        │
        ├──▶ 1. 记录 github.* adapter evidence（内部 provenance 映射）
        │      （issue 号 / url / labels / comments / assignees / reviewers / raw state）
        │
        ├──▶ 2. 发射标准 office DomainEvent 序列（确定性排序）
        │      task.created / artifact.drafted / artifact.created /
        │      artifact.review_requested / artifact.reviewed /
        │      artifact.delivered / task.completed …
        │
        ▼
reduceEvent()  ──复用现有 reducer + 3 个新事件分支──▶  RuntimeSnapshot
                                                          │
                                                          ▼
                              projectSnapshot() → OfficeProjection（未来 UI 消费）
```

### 2.3 关键架构原则

1. **adapter 不绕过 reducer**：snapshot 由 `replayEvents(events)` 产出，adapter 内部维护 eventLog，snapshot 是 reducer 的产物（与 MockRuntimeAdapter `applyEventInternal` 模式一致）。
2. **github.* 是 evidence 命名空间，不是事件类型**：`github.issue.opened` 等是 adapter 内部 sync 概念，对应一条 adapter evidence 记录 + 一条或多条 office 事件。
3. **agents/rooms 数组为空**：snapshot 中 `agents=[] rooms=[]`，GitHub assignees/reviewers/commenters 只作为 external actor evidence。
4. **确定性**：相同 fixture 输入 → 相同 event 序列（稳定 ID、排序、无 `Date.now()`、无随机）。
5. **只读**：`execute()` 对所有写命令返回 rejected；不实现 merge/close/approve/delete。

### 2.4 Adapter 实现 RuntimeAdapter 接口

与 MockRuntimeAdapter 同构（drop-in）：`connect / disconnect / getSnapshot / subscribe / execute / getCapabilities`。`getCapabilities()` 声明 `commandExecution: false`、`hardOrchestration: false`、`softMapping: false`。

## 3. 包结构与类型定义

### 3.1 包结构

新包 `packages/adapters/github/`，与现有 `mock` / `http-sse` / `qclaw-swarm` 同构：

```text
packages/adapters/github/
├── package.json              # @agent-office/github-adapter
├── tsconfig.json
└── src/
    ├── index.ts              # 公共导出
    ├── types.ts              # GitHub fixture / evidence 类型（adapter 私有，不进 protocol）
    ├── fixtures/
    │   ├── index.ts              # fixture 聚合导出
    │   ├── issue-open.ts         # open issue
    │   ├── issue-closed-completed.ts
    │   ├── issue-closed-not-planned.ts
    │   ├── issue-blocked.ts      # 带 "blocked" label 的 issue
    │   ├── pr-open.ts            # open PR（无 review）
    │   ├── pr-draft.ts           # draft PR
    │   ├── pr-review-requested.ts
    │   ├── pr-changes-requested.ts
    │   ├── pr-approved.ts
    │   ├── pr-merged.ts
    │   └── pr-closed-unmerged.ts
    ├── github-adapter.ts         # GitHubRuntimeAdapter implements RuntimeAdapter
    ├── github-adapter.test.ts
    ├── projection.test.ts        # issue/PR → snapshot 投影测试
    ├── determinism.test.ts       # 相同 fixture → 相同 snapshot/event 序列
    ├── label-mapping.test.ts     # label → priority/status 映射
    └── destructive-guard.test.ts # 写命令被拒绝
```

### 3.2 Protocol 最小扩展

在 `packages/protocol/src/index.ts` 新增 3 个 EventType 常量 + 3 个 payload。无新 CommandType（v0 只读）。

```typescript
// 新增事件类型常量
export const EventType = {
  // ...现有...
  ARTIFACT_DRAFTED: "artifact.drafted",                 // draft PR → artifact.status=draft
  ARTIFACT_REVIEW_REQUESTED: "artifact.review_requested", // PR review requested → under_review
  ARTIFACT_DELIVERED: "artifact.delivered",             // PR merged → delivered
} as const;

// 新增 payload
export interface ArtifactDraftedPayload {
  artifactId: Id;
  taskId: Id;
  producerAgentId: Id | null;   // GitHub 无 office agent，用 null + evidence
  type: string;                  // "github_pr"
  title: string;
  uri: string | null;            // PR url
  version: number;
}

export interface ArtifactReviewRequestedPayload {
  artifactId: Id;
  reviewerIds: Id[];             // GitHub login 列表（external actor refs）
}

export interface ArtifactDeliveredPayload {
  artifactId: Id;
  mergeCommitSha: string | null;
  mergedBy: Id;                   // GitHub login（external actor ref）
}
```

`ALL_EVENT_TYPES` 自动包含新增类型（`Object.values(EventType)`）。

### 3.3 Reducer 扩展

在 `packages/core/src/reducer.ts` 新增 3 个 case 分支，复用现有 `isValidArtifactTransition`：

- `ARTIFACT_DRAFTED`：创建 artifact（status=`draft`），关联 task.artifactIds。
- `ARTIFACT_REVIEW_REQUESTED`：找到 artifact，校验 `generated/draft → under_review` 合法转换后置 `under_review`；artifact 不存在则 `entity_not_found`。
- `ARTIFACT_DELIVERED`：artifact.status → `delivered`；关联 task 若存在且可转换则置 `completed`（completedAt=事件 occurredAt）。

### 3.4 状态机扩展

在 `packages/core/src/state-machine.ts` 的 `isValidArtifactTransition` 增补合法路径（若尚未存在）：

- `generated → under_review`
- `draft → under_review`
- `generated → delivered`
- `under_review → delivered`
- `approved → delivered`
- `revision_required → under_review`（返工后重新请求 review）
- `rejected → under_review`（rejected PR 重新请求 review）

注：`artifact.drafted` 创建新 artifact（初始 status=draft），不转换已存在 artifact，因此无需 `generated → draft` 转换路径。

### 3.5 GitHub fixture / evidence 类型（adapter 私有）

定义于 `packages/adapters/github/src/types.ts`，贴近 GitHub REST API payload 形状：

```typescript
export interface GitHubIssueFixture {
  number: number;
  url: string;
  title: string;
  body: string;
  state: "open" | "closed";
  stateReason?: "completed" | "not_planned" | "reopened";
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  createdAt: string;
  closedAt: string | null;
  comments: GitHubComment[];
}

export interface GitHubPRFixture {
  number: number;
  url: string;
  title: string;
  body: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: GitHubUser | null;
  mergeCommitSha: string | null;
  headRef: string;
  baseRef: string;
  labels: GitHubLabel[];
  requestedReviewers: GitHubUser[];
  reviews: GitHubReview[];
  comments: GitHubComment[];
  createdAt: string;
  closedAt: string | null;
}

export interface GitHubLabel { name: string; color?: string; }
export interface GitHubUser { login: string; url?: string; }
export interface GitHubComment { author: GitHubUser; body: string; createdAt: string; }
export interface GitHubReview {
  author: GitHubUser;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body: string;
  submittedAt: string;
}

// adapter evidence：office entity → GitHub provenance
export interface GitHubSourceRef {
  kind: "issue" | "pr";
  number: number;
  url: string;
  rawState: string;             // GitHub 原生 state 字符串
  labels: string[];
  assignees: string[];           // GitHub logins
  reviewers?: string[];
  comments: { author: string; body: string; createdAt: string }[];
  refsIssueNumbers?: number[];  // PR body 中 Closes #X / Refs #X 解析出的关联 issue 号
}

export interface GitHubAdapterEvidence {
  tasks: Record<Id, GitHubSourceRef>;      // taskId → issue provenance
  artifacts: Record<Id, GitHubSourceRef>;  // artifactId → PR provenance
}

export interface GitHubFixtures {
  issues: GitHubIssueFixture[];
  pulls: GitHubPRFixture[];
  repo: { owner: string; name: string };
}
```

## 4. GitHub → Office 映射表

### 4.1 Issue → Task 映射

| GitHub Issue 状态 | office Task 状态 | 触发的 office 事件 | evidence |
|---|---|---|---|
| open issue | `queued` | `task.created`（priority 由 label 推导，status 落到 queued） | issue number / url / labels / assignees / comments |
| open + label `blocked` | `blocked` | `task.created` 后追加 `task.blocked`（reason="GitHub label: blocked"） | label 集合 |
| open + label `review-needed` | `queued`（保持） | `task.created`；review-needed 仅作 evidence | label 集合 |
| closed + stateReason `completed` | `completed` | `task.created` + `task.completed`（completedAt=issue.closedAt） | closedAt / stateReason |
| closed + stateReason `not_planned` | `completed` | `task.created` + `task.completed`；evidence 标记 stateReason=not_planned 表示取消语义 | closedAt / stateReason |

**closed not_planned 决策**：现有事件无 `task.cancelled`。`task.failed` 语义不符（非失败）。最小扩展原则下，closed not_planned 用 `task.completed` + evidence 标记 stateReason=not_planned 表达取消原因。若后续需精确区分 cancelled 与 completed，再补 `task.cancelled` 事件。v0 不扩展 task 事件。

### 4.2 Label → Priority / Status 映射

| GitHub label | 映射 | 说明 |
|---|---|---|
| `priority:urgent` / `P0` | Priority=`urgent` | 影响 task.created 的 priority 字段 |
| `priority:high` / `P1` | Priority=`high` | |
| `priority:low` | Priority=`low` | |
| 无 priority label | Priority=`normal`（默认） | |
| 其他 label | 不映射 priority | 进入 evidence.labels |
| `blocked` | task.status=`blocked`（发 `task.blocked` 事件） | |
| `review-needed` | evidence only（task 保持 queued） | review 是 PR 语义 |
| `wontfix` | evidence only | |

### 4.3 PR → Artifact / Review Item 映射（核心）

每个 GitHub PR → 1 个 office Artifact（type=`github_pr`，uri=PR url）+ 1 个 Task（承载 PR 工作）。PR review 状态映射到 artifact.status + review 事件。

| GitHub PR 状态 | office Artifact 状态 | office 事件序列 | Task 联动 |
|---|---|---|---|
| open PR（已 ready，无 review） | `generated` | `task.created` + `artifact.created` | task `queued` |
| draft PR | `draft` | `task.created` + `artifact.drafted` | task `queued`（非 ready） |
| open + review requested（无 review 提交） | `under_review` | `task.created` + `artifact.created` + `artifact.review_requested` | task 保持 `queued` |
| open + review APPROVED | `approved` | `…` + `artifact.reviewed`(verdict=approved) | task 保持 `queued`（approval 语义由 artifact 承载） |
| open + review CHANGES_REQUESTED | `revision_required` | `…` + `artifact.reviewed`(verdict=revision_required) | task `revision_required` |
| open + review COMMENTED | `generated`（保持） | `…`（无 artifact 事件，evidence 记录 COMMENTED） | 不变 |
| merged PR | `delivered` | `…` + `artifact.delivered`(mergeCommitSha) | task `completed` |
| closed unmerged | `rejected` | `…` + `artifact.reviewed`(verdict=rejected) | task `completed`（evidence 标记 closed-unmerged） |

### 4.4 多 review 处理与 review_requested 的 Task 联动决策

**多 review 处理**：一个 PR 可能有多条 review 记录。adapter 按 `submittedAt` 升序处理 reviews，对每条 review 发射对应 `artifact.reviewed` 事件。为避免非法状态转换（如 approved → revision_required），v0 fixture 设计原则：

- 每个 PR fixture 最多携带 1 条已提交 review（APPROVED / CHANGES_REQUESTED / COMMENTED 之一），代表该 PR 的最终 review 结论；
- `requestedReviewers` 字段表达 "已请求但未提交" 的 review，映射到 `artifact.review_requested` 事件（artifact → under_review），不产生 `artifact.reviewed`；
- 已提交 review 与 requestedReviewers 互斥表达：有已提交 review 时不发 `artifact.review_requested`。

review 状态优先级（当 fixture 同时存在 requestedReviewers 与 reviews 时，以已提交 review 为准）：已提交 review 覆盖 requested 状态。

**review_requested 的 Task 联动决策**：`artifact.review_requested` 后，关联 task 保持 `queued`，artifact 进入 `under_review`。理由：task 进入 `reviewing` 需 office agent 语义（谁在 review），而 GitHub adapter 不持有 office agent。review 状态由 artifact 承载，避免无 agent 的 reviewing 状态语义混乱。evidence 记录 requested reviewers。

### 4.5 Closes #X / Refs #X 处理

PR body 中的 `Closes #X` / `Refs #X` 解析为**关联 evidence**（`GitHubSourceRef.refsIssueNumbers`），**不**直接触发 issue 的 close 事件或替代 acceptance criteria 判断。仅当 GitHub fixture 中该 issue 的 state 实际为 closed 时，才发 `task.completed`。

### 4.6 事件确定性排序规则

adapter 内部按以下顺序生成事件，保证相同 fixture → 相同序列：

1. 按 issue number 升序遍历 issues → 发对应 task.* 事件；
2. 按 PR number 升序遍历 PRs → 发对应 task.* + artifact.* 事件；
3. 每个实体内部按其生命周期时间戳排序（createdAt < closedAt < mergedAt）。

事件 ID 使用稳定格式 `evt-gh-{seq}-{entityKind}-{entityNumber}`（无 `Date.now()`），sequence 单调递增。

## 5. Adapter Evidence 模型与公共 API

### 5.1 Evidence 存储与暴露

Evidence 是 **adapter 侧伴随结构**，不进 `RuntimeSnapshot`（保持 protocol 中 RuntimeSnapshot 纯 office 类型，仅在 reducer 侧新增 3 个事件分支）。adapter 通过额外方法暴露：

```typescript
export class GitHubRuntimeAdapter implements RuntimeAdapter {
  // RuntimeAdapter 接口实现
  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async getSnapshot(): Promise<RuntimeSnapshot>;   // reducer 产出，agents/rooms=[]
  subscribe(observer, options?): RuntimeSubscription;
  async execute(command): Promise<CommandResult>;   // 所有写命令 rejected
  getCapabilities(): AdapterCapabilities;

  // GitHub adapter 专属（不在 RuntimeAdapter 接口内）
  getGitHubEvidence(): GitHubAdapterEvidence;        // 同步，确定性
  syncFromFixtures(fixtures: GitHubFixtures): void; // 重新投影，幂等
  getEventLog(): DomainEvent[];                      // 内部事件日志副本
}
```

### 5.2 Evidence ↔ Event ↔ Snapshot 三者关系

```text
GitHubFixtures
     │ syncFromFixtures()
     ▼
┌─────────────────────────────────────────┐
│ GitHubRuntimeAdapter                    │
│  eventLog: DomainEvent[]   ◀── 确定性排序 │
│  evidence: GitHubAdapterEvidence         │
│    tasks[taskId] = GitHubSourceRef       │
│    artifacts[artifactId] = GitHubSourceRef│
└─────────────────────────────────────────┘
     │                              │
     ▼ getSnapshot()                ▼ getGitHubEvidence()
  replayEvents()                  GitHubAdapterEvidence
     │
     ▼
  RuntimeSnapshot
   tasks[]: 来自 issue
   artifacts[]: 来自 PR
   agents=[], rooms=[]
```

### 5.3 ID 映射规则（确定性）

| GitHub 实体 | office ID | 说明 |
|---|---|---|
| Issue #N | `gh-issue-{N}` | taskId |
| PR #N 的 task | `gh-pr-task-{N}` | 承载 PR 工作的 task |
| PR #N 的 artifact | `gh-pr-{N}` | artifactId，artifact.taskId = `gh-pr-task-{N}` |

### 5.4 Truth Boundary 强制规则

1. snapshot 中每个 task/artifact 都能通过 `getGitHubEvidence()` 找到对应 GitHubSourceRef —— **无 evidence 则不存在**。
2. adapter 不接受 UI/外部注入 task/artifact（`execute()` 全部 rejected）。
3. `Closes #X` 不触发 issue close 事件 —— 只有 fixture 中 issue.state=closed 才发 `task.completed`。
4. 测试断言：snapshot.tasks/artifacts 数量 == evidence 记录数 == fixture 中 issue/PR 数量。

### 5.5 v0 不支持（明确拒绝）

`execute()` 对所有命令返回 `rejected`（error.code=`UNSUPPORTED_COMMAND`，message 含 "GitHub Runtime Adapter v0 is read-only"）。包括 `task.create/assign`、`approval.accept/reject`、`artifact.open` 等 —— 全部拒绝。adapter 是**纯投影源**，不接受任何写操作。

## 6. 测试与文档策略

### 6.1 测试覆盖矩阵（对应 Acceptance Criteria）

| 测试文件 | 覆盖项 | 对应验收标准 |
|---|---|---|
| `projection.test.ts` | issue fixture → task projection；PR fixture → artifact/review item projection | AC1, AC2 |
| `projection.test.ts` | label/state/comment/review status 通过 evidence 或 Runtime Event 进入 | AC3 |
| `determinism.test.ts` | 相同 fixture → 相同 Snapshot + 相同 event 序列（ID/sequence/payload 逐字段比对） | AC4 |
| `projection.test.ts` | 断言 agents=[] rooms=[]；通过 projectSnapshot 校验无 GitHub 状态被捏造 | AC5 |
| `projection.test.ts` | issue closed / draft PR / merged PR / closed unmerged PR / review requested / approved / changes requested 状态映射 | AC7 |
| `label-mapping.test.ts` | blocked / review-needed / priority label 映射 | AC7 |
| `destructive-guard.test.ts` | 所有写命令返回 rejected；adapter 无 merge/close/approve 能力 | AC8 |
| `protocol-extension.test.ts`（core 包） | 3 个新事件 reducer 行为：artifact.drafted→draft、artifact.review_requested→under_review、artifact.delivered→delivered+task.completed | AC6 |

### 6.2 关键测试断言样例

```typescript
// determinism.test.ts
test("相同 fixture 产生相同 snapshot 与 event 序列", () => {
  const a = new GitHubRuntimeAdapter();
  a.syncFromFixtures(SAMPLE_FIXTURES);
  const snapA = a.getSnapshot();
  const eventsA = a.getEventLog();

  const b = new GitHubRuntimeAdapter();
  b.syncFromFixtures(SAMPLE_FIXTURES);
  const snapB = b.getSnapshot();
  const eventsB = b.getEventLog();

  expect(eventsA.map(e => e.eventId)).toEqual(eventsB.map(e => e.eventId));
  expect(snapA.tasks).toEqual(snapB.tasks);
  expect(snapA.artifacts).toEqual(snapB.artifacts);
});

// destructive-guard.test.ts
test("v0 拒绝所有写命令", async () => {
  const adapter = new GitHubRuntimeAdapter();
  await adapter.connect();
  const result = await adapter.execute({
    commandId: "cmd-1", commandType: CommandType.TASK_CREATE,
    timestamp: new Date().toISOString(), source: "user",
    actorId: "x", runtimeId: "gh-runtime", targetId: null, payload: {...},
  });
  expect(result.status).toBe("rejected");
  expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
});
```

### 6.3 确定性时间戳策略

adapter 内部不调用 `new Date()` / `Date.now()`。所有 `occurredAt` / `receivedAt` / `createdAt` 使用 fixture 提供的时间戳（`issue.createdAt` / `pr.mergedAt` 等），或 adapter 构造时注入的固定 `baseTimestamp`（默认 `"2026-01-01T00:00:00Z"`）。这保证跨运行 snapshot 完全可重放。

### 6.4 文档

新建文档目录 `docs/integrations/github-adapter/`：

```text
docs/integrations/github-adapter/
├── README.md                  # v0 目标、支持的映射、不支持的命令、truth boundary
├── mapping-table.md           # 完整 GitHub → office 映射表（Section 4 内容）
└── v0-limitations.md          # 为何不实现 merge/delete/approve/close；如何衔接 Command Gateway v0
```

文档需说明：

- GitHub Runtime Adapter v0 的目标（只读投影）；
- 支持的 GitHub → Office 映射（issue→task, PR→artifact, label/state/comment/review→evidence/event）；
- 不支持的命令（全部写操作）；
- Runtime truth boundary（无 evidence 则不存在；adapter 不接受写；Closes #X 不替代 acceptance）；
- 为何 v0 不实现破坏性写操作（Phase 2.1 只做前半段；写操作留给 Command Gateway v0 单独 Issue）；
- 后续如何衔接 Command Gateway v0（adapter 作为投影源，Command Gateway 作为写链路，二者通过 RuntimeSession 组合）。

## 7. Acceptance Criteria 映射

| AC | 实现方式 | 测试文件 |
|---|---|---|
| GitHub Issue → Runtime-backed Office Task | `task.created` 事件 + reducer + evidence | projection.test.ts |
| GitHub PR → Runtime-backed Artifact / Review Item | `artifact.created/drafted/review_requested/reviewed/delivered` 事件 + reducer + evidence | projection.test.ts |
| label/state/comment/review status 通过 evidence 或 Runtime Event | label→priority/status 映射；comment→evidence；review→artifact 事件 | projection.test.ts, label-mapping.test.ts |
| 相同 fixture → 确定性 Snapshot / Event 序列 | 稳定 ID + 排序 + 固定时间戳 | determinism.test.ts |
| Projection/reducer/UI 不得伪造 GitHub 业务状态 | agents/rooms=[]；projectSnapshot 校验；无 evidence 则不存在 | projection.test.ts |
| 测试覆盖 Issue projection、PR projection、事件映射、关键状态转换 | 全部映射测试 | projection.test.ts |
| 测试覆盖 draft PR、merged PR、closed issue、review requested/approved/changes requested | 每个状态独立 fixture + 断言 | projection.test.ts |
| v0 不实现破坏性命令 | execute() 全 rejected | destructive-guard.test.ts |
| 文档说明 adapter 边界、truth boundary、v0 限制 | docs/integrations/github-adapter/ | 文档审查 |
| 不含无关视觉 polish | Out of Scope 明确；不改 pixel/canvas/UI | 代码审查 |

## 8. PR Relationship

- 若 PR 完整满足全部 Acceptance Criteria，使用 `Closes #34`。
- 若 PR 仅添加 scaffold / fixture / 文档或部分映射，使用 `Refs #34`。
- reviewer 按 `skills/project-reviewer-gate/SKILL.md` 执行审查。
- 任一 AC 仍为 partial 时禁止 approve，禁止 `Closes #34`。
