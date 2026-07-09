# GitHub Runtime Adapter v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 GitHub Runtime Adapter v0，使 GitHub Issue/PR 能作为 Runtime-backed Task/Artifact 进入 Agent Office，通过确定性投影生成 Snapshot/Event，且不接受任何写操作。

**Architecture:** GitHubRuntimeAdapter 是只读投影 adapter，消费 GitHub fixture，产出标准 office DomainEvent 序列，经现有 `reduceEvent` reducer 生成 `RuntimeSnapshot`。adapter 不自建 agents/rooms（snapshot 中 agents=[] rooms=[]），GitHub 用户作为 external actor evidence。Protocol 最小扩展新增 3 个 artifact 事件（`artifact.drafted` / `artifact.review_requested` / `artifact.delivered`）以准确表达 PR 状态。

**Tech Stack:** TypeScript ES2022 + ESNext module + bundler moduleResolution，npm workspaces，vitest 测试框架，纯函数 reducer + 事件溯源。

## Global Constraints

- **Runtime Truth Boundary**：adapter 不绕过 reducer 直接写 snapshot；snapshot 由 `replayEvents(events)` 产出；UI 不得凭空伪造 GitHub 业务状态。
- **确定性**：相同 fixture 输入 → 相同 event 序列（稳定 ID `evt-gh-{seq}-{entityKind}-{entityNumber}`、固定时间戳、无 `Date.now()`、无随机）。baseTimestamp 默认 `"2026-01-01T00:00:00Z"`。
- **只读**：`execute()` 对所有写命令返回 `rejected`（error.code=`UNSUPPORTED_COMMAND`，message 含 "GitHub Runtime Adapter v0 is read-only"）。
- **agents/rooms 为空**：snapshot 中 `agents=[] rooms=[]`，GitHub assignees/reviewers/commenters 只作为 external actor evidence。
- **v0 禁止破坏性写操作**：不实现 merge/delete/approve/close。
- **Closes #X 不替代 acceptance**：仅作 evidence，只有 fixture 中 issue.state=closed 才发 `task.completed`。
- **package 命名**：`@agent-office/adapter-github`，与 `@agent-office/adapter-mock` 同构。
- **TS 配置**：`extends: "../../../tsconfig.base.json"`，`composite: true`，references 指向 `../../protocol` 和 `../../core`。
- **测试命令**：`npx vitest run`（root），单文件 `npx vitest run <path>`。
- **提交风格**：`feat:` / `test:` / `docs:` / `chore:` 前缀，每个 task 末尾提交。

---

## File Structure

```text
packages/protocol/src/index.ts                                    # MODIFY: +3 EventType, +3 payload
packages/core/src/state-machine.ts                                # MODIFY: artifactTransitions 增补路径
packages/core/src/reducer.ts                                      # MODIFY: +3 case 分支
packages/core/src/protocol-extension.test.ts                      # CREATE: 新事件 reducer 行为测试

packages/adapters/github/
├── package.json                                                   # CREATE: @agent-office/adapter-github
├── tsconfig.json                                                  # CREATE
└── src/
    ├── index.ts                                                   # CREATE: 公共导出
    ├── types.ts                                                   # CREATE: GitHub fixture / evidence 类型
    ├── fixtures/
    │   ├── index.ts                                               # CREATE: fixture 聚合导出
    │   ├── issue-open.ts                                          # CREATE
    │   ├── issue-closed-completed.ts                              # CREATE
    │   ├── issue-closed-not-planned.ts                           # CREATE
    │   ├── issue-blocked.ts                                       # CREATE
    │   ├── pr-open.ts                                              # CREATE
    │   ├── pr-draft.ts                                            # CREATE
    │   ├── pr-review-requested.ts                                 # CREATE
    │   ├── pr-changes-requested.ts                                # CREATE
    │   ├── pr-approved.ts                                         # CREATE
    │   ├── pr-merged.ts                                           # CREATE
    │   └── pr-closed-unmerged.ts                                  # CREATE
    ├── github-adapter.ts                                          # CREATE: GitHubRuntimeAdapter 实现
    ├── github-adapter.test.ts                                     # CREATE: 基础生命周期测试
    ├── projection.test.ts                                         # CREATE: issue/PR → snapshot 投影
    ├── determinism.test.ts                                        # CREATE: 确定性测试
    ├── label-mapping.test.ts                                      # CREATE: label → priority/status 映射
    └── destructive-guard.test.ts                                  # CREATE: 写命令拒绝测试

docs/integrations/github-adapter/
├── README.md                                                      # CREATE
├── mapping-table.md                                               # CREATE
└── v0-limitations.md                                              # CREATE
```

**职责边界：**
- `types.ts`：adapter 私有类型，不进 protocol。定义 GitHub fixture 形状（贴近 REST API）和 evidence 结构。
- `fixtures/`：每个文件导出一个确定性 fixture（稳定时间戳、稳定 number），`index.ts` 聚合导出 `SAMPLE_FIXTURES` 和按类别导出。
- `github-adapter.ts`：实现 `RuntimeAdapter` 接口 + adapter 专属方法（`syncFromFixtures` / `getGitHubEvidence` / `getEventLog`）。内部维护 eventLog + evidence，通过 `replayEvents` 产出 snapshot。
- 测试文件各自独立，覆盖 spec Section 6.1 的测试矩阵。

---

## Task 1: Protocol 扩展 — 新增 3 个 Artifact 事件类型

**Files:**
- Modify: `packages/protocol/src/index.ts:301-317`（EventType 常量）和 `packages/protocol/src/index.ts:261-276`（payload 接口区域）
- Test: `packages/core/src/protocol-extension.test.ts`（在 Task 3 创建）

**Interfaces:**
- Produces: `EventType.ARTIFACT_DRAFTED` / `EventType.ARTIFACT_REVIEW_REQUESTED` / `EventType.ARTIFACT_DELIVERED` 常量；`ArtifactDraftedPayload` / `ArtifactReviewRequestedPayload` / `ArtifactDeliveredPayload` 接口。Task 3 的 reducer 和 Task 6 的 adapter 依赖这些类型。

- [ ] **Step 1: 在 EventType 常量对象中新增 3 个事件类型**

在 `packages/protocol/src/index.ts` 的 `EventType` 对象中，在 `APPROVAL_RESOLVED` 之后、`ERROR_RAISED` 之前新增 3 个常量。

修改 `packages/protocol/src/index.ts`，将：

```typescript
export const EventType = {
  AGENT_SPAWNED: "agent.spawned",
  AGENT_STATUS_CHANGED: "agent.status_changed",
  TASK_CREATED: "task.created",
  TASK_ASSIGNED: "task.assigned",
  TASK_STARTED: "task.started",
  TASK_BLOCKED: "task.blocked",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  ARTIFACT_CREATED: "artifact.created",
  ARTIFACT_REVIEWED: "artifact.reviewed",
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_RESOLVED: "approval.resolved",
  ERROR_RAISED: "error.raised",
} as const;
```

替换为：

```typescript
export const EventType = {
  AGENT_SPAWNED: "agent.spawned",
  AGENT_STATUS_CHANGED: "agent.status_changed",
  TASK_CREATED: "task.created",
  TASK_ASSIGNED: "task.assigned",
  TASK_STARTED: "task.started",
  TASK_BLOCKED: "task.blocked",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  ARTIFACT_CREATED: "artifact.created",
  ARTIFACT_DRAFTED: "artifact.drafted",
  ARTIFACT_REVIEW_REQUESTED: "artifact.review_requested",
  ARTIFACT_REVIEWED: "artifact.reviewed",
  ARTIFACT_DELIVERED: "artifact.delivered",
  APPROVAL_REQUESTED: "approval.requested",
  APPROVAL_RESOLVED: "approval.resolved",
  ERROR_RAISED: "error.raised",
} as const;
```

- [ ] **Step 2: 在 payload 接口区域新增 3 个 payload 接口**

在 `packages/protocol/src/index.ts` 中，在 `ArtifactReviewedPayload` 接口之后（`ApprovalRequestedPayload` 之前）新增 3 个 payload 接口。

在 `ArtifactReviewedPayload` 之后插入：

```typescript
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

- [ ] **Step 3: 验证 TypeScript 编译通过**

Run: `npx tsc -b packages/protocol`
Expected: 无错误退出，`ALL_EVENT_TYPES` 自动包含新增的 3 个类型（`Object.values(EventType)`）。

- [ ] **Step 4: 运行全量测试确保无回归**

Run: `npx vitest run`
Expected: 所有现有测试通过（无测试引用这 3 个新事件，因此不应有回归）。

- [ ] **Step 5: 提交**

```bash
git add packages/protocol/src/index.ts
git commit -m "feat(protocol): add 3 artifact events for GitHub adapter v0" -m "新增 ARTIFACT_DRAFTED / ARTIFACT_REVIEW_REQUESTED / ARTIFACT_DELIVERED 事件类型与 payload，支持 GitHub PR 状态投影。" -m "Refs #34"
```

---

## Task 2: State Machine 扩展 — artifactTransitions + taskTransitions 增补路径

**Files:**
- Modify: `packages/core/src/state-machine.ts:24-47`（taskTransitions + artifactTransitions）
- Test: `packages/core/src/protocol-extension.test.ts`（在 Task 3 创建）

**Interfaces:**
- Consumes: Task 1 的 `ArtifactStatus` / `TaskStatus` 类型（已存在于 protocol）。
- Produces: 扩展后的 `isValidArtifactTransition` + `isValidTaskTransition`。artifact 路径支持 `draft → under_review`、`generated → delivered`、`under_review → delivered`、`revision_required → under_review`、`rejected → under_review`。task 路径支持 `created → completed`、`created → blocked` 和 `created → revision_required`（GitHub adapter 中 issue 可能创建后立即 closed/blocked，PR 可能创建后即被 review 为 revision_required，无需经过 queued）。Task 3 的 reducer 和 Task 6 的 adapter 依赖这些合法转换。

**注意**：现有 reducer 中 `TASK_CREATED` 创建 status=`created`（非 `queued`），且 GitHub adapter 不发 `TASK_ASSIGNED` 事件。因此 GitHub adapter 产出的 task 初始状态为 `created`。closed issue 需要从 `created → completed`，blocked issue 需要从 `created → blocked`，PR 带 CHANGES_REQUESTED review 时需要从 `created → revision_required`（reducer 的 ARTIFACT_REVIEWED case 在 verdict=revision_required 时会联动转换 task）。这三个路径在现有 taskTransitions 中不合法，必须在此 Task 补充。

- [ ] **Step 1: 扩展 taskTransitions 和 artifactTransitions 增补合法路径**

修改 `packages/core/src/state-machine.ts`。

首先，将 taskTransitions 中 `created` 行：

```typescript
  created: ["queued", "assigned", "cancelled"],
```

替换为：

```typescript
  created: ["queued", "assigned", "cancelled", "completed", "blocked", "revision_required"],
```

新增路径说明：
- `created → completed`：GitHub issue 创建时已 closed（closed-completed / closed-not-planned），或 PR merged/closed-unmerged
- `created → blocked`：GitHub issue 创建时已带 `blocked` label
- `created → revision_required`：GitHub PR 创建后即被 review 为 CHANGES_REQUESTED（reducer ARTIFACT_REVIEWED 联动转换）

然后，将 artifactTransitions：

```typescript
const artifactTransitions: Record<ArtifactStatus, ArtifactStatus[]> = {
  draft: ["generated"],
  generated: ["under_review", "approved", "revision_required", "rejected"],
  under_review: ["approved", "revision_required", "rejected"],
  revision_required: ["generated"],
  approved: ["delivered"],
  rejected: [],
  delivered: [],
};
```

替换为：

```typescript
const artifactTransitions: Record<ArtifactStatus, ArtifactStatus[]> = {
  draft: ["generated", "under_review"],
  generated: ["under_review", "approved", "revision_required", "rejected", "delivered"],
  under_review: ["approved", "revision_required", "rejected", "delivered"],
  revision_required: ["generated", "under_review"],
  approved: ["delivered"],
  rejected: ["under_review"],
  delivered: [],
};
```

新增 artifact 路径说明：
- `draft → under_review`：draft PR 请求 review
- `generated → delivered`：open PR 直接 merge
- `under_review → delivered`：review 中 merge
- `revision_required → under_review`：返工后重新请求 review
- `rejected → under_review`：rejected PR 重新请求 review

- [ ] **Step 2: 验证 TypeScript 编译通过**

Run: `npx tsc -b packages/core`
Expected: 无错误退出。

- [ ] **Step 3: 运行全量测试确保无回归**

Run: `npx vitest run`
Expected: 所有现有测试通过（新增路径是合法转换的超集，不影响现有非法转换断言。现有测试不涉及 `created → completed` 或 `created → blocked` 的非法断言）。

- [ ] **Step 4: 提交**

```bash
git add packages/core/src/state-machine.ts
git commit -m "feat(core): extend task/artifact transitions for GitHub adapter" -m "taskTransitions: created→completed/blocked（GitHub issue 创建时已 closed/blocked）。artifactTransitions: draft→under_review、generated→delivered、under_review→delivered、revision_required→under_review、rejected→under_review。" -m "Refs #34"
```

---

## Task 3: Reducer 扩展 + Protocol Extension 测试（TDD）

**Files:**
- Modify: `packages/core/src/reducer.ts:326-348`（ARTIFACT_CREATED case 之后新增 3 个 case）和 import 区域
- Test: `packages/core/src/protocol-extension.test.ts`

**Interfaces:**
- Consumes: Task 1 的 3 个新 EventType 常量 + 3 个 payload 接口；Task 2 的扩展状态机。
- Produces: reducer 能处理 `ARTIFACT_DRAFTED`（创建 artifact status=draft）、`ARTIFACT_REVIEW_REQUESTED`（artifact → under_review）、`ARTIFACT_DELIVERED`（artifact → delivered + 关联 task → completed）。Task 6 的 adapter 依赖 reducer 正确处理这些事件。

- [ ] **Step 1: 编写失败的测试文件**

创建 `packages/core/src/protocol-extension.test.ts`：

```typescript
/**
 * Protocol 扩展测试 — 验证 3 个新 artifact 事件的 reducer 行为。
 * 对应 AC6。
 */
import { describe, it, expect } from "vitest";
import { reduceEvent, createEmptySnapshot } from "./reducer.js";
import {
  EventType,
  type DomainEvent,
  type ArtifactDraftedPayload,
  type ArtifactReviewRequestedPayload,
  type ArtifactDeliveredPayload,
  type TaskCreatedPayload,
} from "@agent-office/protocol";
import type { RuntimeSnapshot } from "@agent-office/protocol";

function makeEvent<P>(
  type: string,
  payload: P,
  sequence: number,
  occurredAt = "2026-01-01T00:00:00Z"
): DomainEvent<P> {
  return {
    eventId: `evt-test-${sequence}`,
    runtimeId: "test-runtime",
    sequence,
    schemaVersion: "1.0",
    type,
    occurredAt,
    receivedAt: occurredAt,
    correlationId: "corr-test",
    causationId: null,
    traceId: "trace-test",
    payload,
  };
}

describe("Protocol extension: artifact.drafted / review_requested / delivered", () => {
  function setupTaskAndArtifact(): RuntimeSnapshot {
    const empty = createEmptySnapshot("test-runtime");
    const taskPayload: TaskCreatedPayload = {
      taskId: "gh-pr-task-1",
      title: "PR #1 task",
      description: "task for PR 1",
      priority: "normal",
      parentTaskId: null,
    };
    const taskEvent = makeEvent(EventType.TASK_CREATED, taskPayload, 1);
    const r1 = reduceEvent(empty, taskEvent);
    return r1.snapshot;
  }

  it("artifact.drafted 创建 status=draft 的 artifact 并关联 task.artifactIds", () => {
    let snap = setupTaskAndArtifact();
    const payload: ArtifactDraftedPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: null,
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    const event = makeEvent(EventType.ARTIFACT_DRAFTED, payload, 2);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact).toBeDefined();
    expect(artifact!.status).toBe("draft");
    expect(artifact!.taskId).toBe("gh-pr-task-1");
    expect(artifact!.producerAgentId).toBe("");
    const task = result.snapshot.tasks.find((t) => t.taskId === "gh-pr-task-1");
    expect(task!.artifactIds).toContain("gh-pr-1");
  });

  it("artifact.review_requested 将 draft artifact 转为 under_review", () => {
    let snap = setupTaskAndArtifact();
    const draftPayload: ArtifactDraftedPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: null,
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_DRAFTED, draftPayload, 2)).snapshot;

    const reviewReqPayload: ArtifactReviewRequestedPayload = {
      artifactId: "gh-pr-1",
      reviewerIds: ["octocat"],
    };
    const event = makeEvent(EventType.ARTIFACT_REVIEW_REQUESTED, reviewReqPayload, 3);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("under_review");
  });

  it("artifact.review_requested 对 generated artifact 也能转为 under_review", () => {
    let snap = setupTaskAndArtifact();
    // 先创建 generated artifact（通过 ARTIFACT_CREATED）
    const createdPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: "",
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_CREATED, createdPayload, 2)).snapshot;

    const reviewReqPayload: ArtifactReviewRequestedPayload = {
      artifactId: "gh-pr-1",
      reviewerIds: ["octocat"],
    };
    const event = makeEvent(EventType.ARTIFACT_REVIEW_REQUESTED, reviewReqPayload, 3);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("under_review");
  });

  it("artifact.review_requested 对不存在的 artifact 返回 entity_not_found", () => {
    const snap = setupTaskAndArtifact();
    const payload: ArtifactReviewRequestedPayload = {
      artifactId: "nonexistent",
      reviewerIds: ["octocat"],
    };
    const event = makeEvent(EventType.ARTIFACT_REVIEW_REQUESTED, payload, 2);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("entity_not_found");
  });

  it("artifact.delivered 将 artifact 转为 delivered 且关联 task 转为 completed", () => {
    let snap = setupTaskAndArtifact();
    const createdPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: "",
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_CREATED, createdPayload, 2)).snapshot;

    const deliveredPayload: ArtifactDeliveredPayload = {
      artifactId: "gh-pr-1",
      mergeCommitSha: "abc123",
      mergedBy: "octocat",
    };
    const event = makeEvent(EventType.ARTIFACT_DELIVERED, deliveredPayload, 3);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("delivered");
    const task = result.snapshot.tasks.find((t) => t.taskId === "gh-pr-task-1");
    expect(task!.status).toBe("completed");
    expect(task!.completedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("artifact.delivered 对不存在的 artifact 返回 entity_not_found", () => {
    const snap = setupTaskAndArtifact();
    const payload: ArtifactDeliveredPayload = {
      artifactId: "nonexistent",
      mergeCommitSha: "abc123",
      mergedBy: "octocat",
    };
    const event = makeEvent(EventType.ARTIFACT_DELIVERED, payload, 2);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("entity_not_found");
  });

  it("artifact.delivered 将 under_review artifact 直接转为 delivered", () => {
    let snap = setupTaskAndArtifact();
    const createdPayload = {
      artifactId: "gh-pr-1",
      taskId: "gh-pr-task-1",
      producerAgentId: "",
      type: "github_pr",
      title: "PR #1",
      uri: "https://github.com/owner/repo/pull/1",
      version: 1,
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_CREATED, createdPayload, 2)).snapshot;
    const reviewReqPayload: ArtifactReviewRequestedPayload = {
      artifactId: "gh-pr-1",
      reviewerIds: ["octocat"],
    };
    snap = reduceEvent(snap, makeEvent(EventType.ARTIFACT_REVIEW_REQUESTED, reviewReqPayload, 3)).snapshot;

    const deliveredPayload: ArtifactDeliveredPayload = {
      artifactId: "gh-pr-1",
      mergeCommitSha: "abc123",
      mergedBy: "octocat",
    };
    const event = makeEvent(EventType.ARTIFACT_DELIVERED, deliveredPayload, 4);
    const result = reduceEvent(snap, event);

    expect(result.errors).toHaveLength(0);
    const artifact = result.snapshot.artifacts.find((a) => a.artifactId === "gh-pr-1");
    expect(artifact!.status).toBe("delivered");
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run packages/core/src/protocol-extension.test.ts`
Expected: FAIL — 测试失败，因为 reducer 尚未处理 `ARTIFACT_DRAFTED` / `ARTIFACT_REVIEW_REQUESTED` / `ARTIFACT_DELIVERED` 事件，reducer 会返回 `validation_error`（未知事件类型）。

- [ ] **Step 3: 在 reducer 中新增 3 个 case 分支**

修改 `packages/core/src/reducer.ts`。

首先在 import 区域，将：

```typescript
import type {
  RuntimeSnapshot,
  DomainEvent,
  AgentSnapshot,
  TaskSnapshot,
  ArtifactSnapshot,
  ApprovalSnapshot,
  RoomSnapshot,
  AgentStatusChangedPayload,
  TaskCreatedPayload,
  TaskAssignedPayload,
  TaskStartedPayload,
  TaskBlockedPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
  ArtifactCreatedPayload,
  ArtifactReviewedPayload,
  ApprovalRequestedPayload,
  ApprovalResolvedPayload,
  ErrorRaisedPayload,
  AgentSpawnedPayload,
  ReducerError,
} from "@agent-office/protocol";
```

替换为：

```typescript
import type {
  RuntimeSnapshot,
  DomainEvent,
  AgentSnapshot,
  TaskSnapshot,
  ArtifactSnapshot,
  ApprovalSnapshot,
  RoomSnapshot,
  AgentStatusChangedPayload,
  TaskCreatedPayload,
  TaskAssignedPayload,
  TaskStartedPayload,
  TaskBlockedPayload,
  TaskCompletedPayload,
  TaskFailedPayload,
  ArtifactCreatedPayload,
  ArtifactDraftedPayload,
  ArtifactReviewRequestedPayload,
  ArtifactDeliveredPayload,
  ArtifactReviewedPayload,
  ApprovalRequestedPayload,
  ApprovalResolvedPayload,
  ErrorRaisedPayload,
  AgentSpawnedPayload,
  ReducerError,
} from "@agent-office/protocol";
```

然后在 `ARTIFACT_CREATED` case 之后（`ARTIFACT_REVIEWED` case 之前）新增 3 个 case 分支。

在 `case EventType.ARTIFACT_CREATED:` 的 `break;` 之后插入：

```typescript
    case EventType.ARTIFACT_DRAFTED: {
      const p = event.payload as ArtifactDraftedPayload;
      const existing = s.artifacts.find((a) => a.artifactId === p.artifactId);
      if (existing) {
        errors.push({
          code: "constraint_violation",
          message: `Artifact ${p.artifactId} already exists`,
          entityPath: `artifacts:${p.artifactId}`,
        });
        break;
      }
      const artifact: ArtifactSnapshot = {
        artifactId: p.artifactId,
        runtimeId: s.runtimeId,
        taskId: p.taskId,
        producerAgentId: p.producerAgentId ?? "",
        type: p.type,
        title: p.title,
        status: "draft",
        uri: p.uri,
        version: p.version,
        createdAt: event.occurredAt,
        reviewResult: null,
      };
      s.artifacts.push(artifact);
      const task = s.tasks.find((t) => t.taskId === p.taskId);
      if (task && !task.artifactIds.includes(p.artifactId)) {
        task.artifactIds.push(p.artifactId);
      }
      break;
    }

    case EventType.ARTIFACT_REVIEW_REQUESTED: {
      const p = event.payload as ArtifactReviewRequestedPayload;
      const artifact = s.artifacts.find((a) => a.artifactId === p.artifactId);
      if (!artifact) {
        errors.push({
          code: "entity_not_found",
          message: `Artifact ${p.artifactId} not found for review request`,
          entityPath: `artifacts:${p.artifactId}`,
        });
        break;
      }
      if (!isValidArtifactTransition(artifact.status, "under_review")) {
        errors.push({
          code: "invalid_transition",
          message: `Invalid artifact transition: ${artifact.status} → under_review for ${p.artifactId}`,
          entityPath: `artifacts:${p.artifactId}`,
        });
        break;
      }
      artifact.status = "under_review";
      break;
    }

    case EventType.ARTIFACT_DELIVERED: {
      const p = event.payload as ArtifactDeliveredPayload;
      const artifact = s.artifacts.find((a) => a.artifactId === p.artifactId);
      if (!artifact) {
        errors.push({
          code: "entity_not_found",
          message: `Artifact ${p.artifactId} not found for delivery`,
          entityPath: `artifacts:${p.artifactId}`,
        });
        break;
      }
      if (!isValidArtifactTransition(artifact.status, "delivered")) {
        errors.push({
          code: "invalid_transition",
          message: `Invalid artifact transition: ${artifact.status} → delivered for ${p.artifactId}`,
          entityPath: `artifacts:${p.artifactId}`,
        });
        break;
      }
      artifact.status = "delivered";
      // 关联 task 若存在且可转换则置 completed
      const task = s.tasks.find((t) => t.taskId === artifact.taskId);
      if (task) {
        if (isValidTaskTransition(task.status, "completed")) {
          task.status = "completed";
          task.completedAt = event.occurredAt;
        } else {
          errors.push({
            code: "invalid_transition",
            message: `Invalid task transition: ${task.status} → completed for ${task.taskId} (artifact ${p.artifactId} delivered but task state unchanged)`,
            entityPath: `tasks:${task.taskId}`,
          });
        }
      }
      break;
    }
```

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run packages/core/src/protocol-extension.test.ts`
Expected: PASS — 全部 7 个测试用例通过。

- [ ] **Step 5: 运行全量测试确保无回归**

Run: `npx vitest run`
Expected: 所有测试通过（含新增的 7 个 + 现有全部测试）。

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/reducer.ts packages/core/src/protocol-extension.test.ts
git commit -m "feat(core): reducer handles 3 new artifact events" -m "新增 ARTIFACT_DRAFTED / ARTIFACT_REVIEW_REQUESTED / ARTIFACT_DELIVERED case 分支，含 7 个 TDD 测试验证状态转换与错误分类。" -m "Refs #34"
```

---

## Task 4: GitHub Adapter 包结构 + types.ts

**Files:**
- Create: `packages/adapters/github/package.json`
- Create: `packages/adapters/github/tsconfig.json`
- Create: `packages/adapters/github/src/index.ts`
- Create: `packages/adapters/github/src/types.ts`

**Interfaces:**
- Consumes: Task 1-3 的 protocol 扩展。
- Produces: `@agent-office/adapter-github` 包，导出 `GitHubRuntimeAdapter`、`GitHubFixtures`、`GitHubSourceRef`、`GitHubAdapterEvidence` 等类型。Task 5-10 依赖此包结构。

- [ ] **Step 1: 创建 package.json**

创建 `packages/adapters/github/package.json`：

```json
{
  "name": "@agent-office/adapter-github",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "@agent-office/protocol": "1.0.0",
    "@agent-office/core": "1.0.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

创建 `packages/adapters/github/tsconfig.json`：

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"],
  "references": [
    { "path": "../../protocol" },
    { "path": "../../core" }
  ]
}
```

- [ ] **Step 3: 创建 types.ts（adapter 私有类型）**

创建 `packages/adapters/github/src/types.ts`：

```typescript
/**
 * GitHub Runtime Adapter 私有类型 — 不进 protocol。
 * 贴近 GitHub REST API payload 形状，便于后续替换为真实 API。
 */
import type { Id } from "@agent-office/protocol";

// ─── GitHub Fixture 类型（输入） ────────────────────────────

export interface GitHubLabel {
  name: string;
  color?: string;
}

export interface GitHubUser {
  login: string;
  url?: string;
}

export interface GitHubComment {
  author: GitHubUser;
  body: string;
  createdAt: string;
}

export interface GitHubReview {
  author: GitHubUser;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body: string;
  submittedAt: string;
}

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

export interface GitHubFixtures {
  issues: GitHubIssueFixture[];
  pulls: GitHubPRFixture[];
  repo: { owner: string; name: string };
}

// ─── Adapter Evidence 类型（输出） ──────────────────────────

/**
 * office entity → GitHub provenance 映射。
 * Evidence 是 adapter 侧伴随结构，不进 RuntimeSnapshot。
 */
export interface GitHubSourceRef {
  kind: "issue" | "pr";
  number: number;
  url: string;
  rawState: string;
  labels: string[];
  assignees: string[];
  reviewers?: string[];
  comments: { author: string; body: string; createdAt: string }[];
  refsIssueNumbers?: number[];
}

export interface GitHubAdapterEvidence {
  tasks: Record<Id, GitHubSourceRef>;
  artifacts: Record<Id, GitHubSourceRef>;
}
```

- [ ] **Step 4: 创建 index.ts（公共导出，占位 GitHubRuntimeAdapter）**

创建 `packages/adapters/github/src/index.ts`：

```typescript
export { GitHubRuntimeAdapter } from "./github-adapter.js";
export type { GitHubAdapterOptions } from "./github-adapter.js";
export type {
  GitHubFixtures,
  GitHubIssueFixture,
  GitHubPRFixture,
  GitHubLabel,
  GitHubUser,
  GitHubComment,
  GitHubReview,
  GitHubSourceRef,
  GitHubAdapterEvidence,
} from "./types.js";
export {
  SAMPLE_FIXTURES,
  ISSUE_OPEN,
  ISSUE_CLOSED_COMPLETED,
  ISSUE_CLOSED_NOT_PLANNED,
  ISSUE_BLOCKED,
  PR_OPEN,
  PR_DRAFT,
  PR_REVIEW_REQUESTED,
  PR_CHANGES_REQUESTED,
  PR_APPROVED,
  PR_MERGED,
  PR_CLOSED_UNMERGED,
} from "./fixtures/index.js";
```

注意：此文件引用了 `github-adapter.js` 和 `fixtures/index.js`，它们将在 Task 5 和 Task 6 创建。此时 TypeScript 编译会报错，这是预期的——Step 5 验证时会确认这些模块尚不存在。在 Task 5 和 Task 6 完成后编译将通过。

- [ ] **Step 5: 暂时验证 types.ts 编译（跳过 index.ts）**

由于 index.ts 引用尚未创建的文件，先单独验证 types.ts：

Run: `npx tsc --noEmit --skipLibCheck packages/adapters/github/src/types.ts`
Expected: 无错误（types.ts 只依赖 protocol 的 `Id` 类型，已存在）。

- [ ] **Step 6: 提交（包含占位 index.ts，后续 Task 会补全引用的文件）**

```bash
git add packages/adapters/github/package.json packages/adapters/github/tsconfig.json packages/adapters/github/src/types.ts packages/adapters/github/src/index.ts
git commit -m "chore(github-adapter): scaffold package structure and types" -m "创建 @agent-office/adapter-github 包，定义 GitHub fixture/evidence 类型。index.ts 引用的 adapter 和 fixtures 将在后续 Task 补全。" -m "Refs #34"
```

---

## Task 5: GitHub Fixtures

**Files:**
- Create: `packages/adapters/github/src/fixtures/issue-open.ts`
- Create: `packages/adapters/github/src/fixtures/issue-closed-completed.ts`
- Create: `packages/adapters/github/src/fixtures/issue-closed-not-planned.ts`
- Create: `packages/adapters/github/src/fixtures/issue-blocked.ts`
- Create: `packages/adapters/github/src/fixtures/pr-open.ts`
- Create: `packages/adapters/github/src/fixtures/pr-draft.ts`
- Create: `packages/adapters/github/src/fixtures/pr-review-requested.ts`
- Create: `packages/adapters/github/src/fixtures/pr-changes-requested.ts`
- Create: `packages/adapters/github/src/fixtures/pr-approved.ts`
- Create: `packages/adapters/github/src/fixtures/pr-merged.ts`
- Create: `packages/adapters/github/src/fixtures/pr-closed-unmerged.ts`
- Create: `packages/adapters/github/src/fixtures/index.ts`

**Interfaces:**
- Consumes: Task 4 的 `GitHubIssueFixture` / `GitHubPRFixture` / `GitHubFixtures` 类型。
- Produces: 11 个确定性 fixture + `SAMPLE_FIXTURES` 聚合。Task 6-10 的测试依赖这些 fixture。每个 fixture 使用稳定时间戳（`2026-01-0X` 系列），无 `Date.now()`。

- [ ] **Step 1: 创建 issue-open.ts**

创建 `packages/adapters/github/src/fixtures/issue-open.ts`：

```typescript
import type { GitHubIssueFixture } from "../types.js";

export const ISSUE_OPEN: GitHubIssueFixture = {
  number: 10,
  url: "https://github.com/owner/repo/issues/10",
  title: "Implement login page",
  body: "Need a login page with OAuth support.",
  state: "open",
  labels: [{ name: "priority:high" }, { name: "feature" }],
  assignees: [{ login: "octocat" }],
  createdAt: "2026-01-02T08:00:00Z",
  closedAt: null,
  comments: [
    {
      author: { login: "dev1" },
      body: "Started working on this.",
      createdAt: "2026-01-03T09:00:00Z",
    },
  ],
};
```

- [ ] **Step 2: 创建 issue-closed-completed.ts**

创建 `packages/adapters/github/src/fixtures/issue-closed-completed.ts`：

```typescript
import type { GitHubIssueFixture } from "../types.js";

export const ISSUE_CLOSED_COMPLETED: GitHubIssueFixture = {
  number: 11,
  url: "https://github.com/owner/repo/issues/11",
  title: "Fix navigation bug",
  body: "Navigation bar disappears on mobile.",
  state: "closed",
  stateReason: "completed",
  labels: [{ name: "bug" }],
  assignees: [{ login: "octocat" }],
  createdAt: "2026-01-04T08:00:00Z",
  closedAt: "2026-01-06T10:00:00Z",
  comments: [],
};
```

- [ ] **Step 3: 创建 issue-closed-not-planned.ts**

创建 `packages/adapters/github/src/fixtures/issue-closed-not-planned.ts`：

```typescript
import type { GitHubIssueFixture } from "../types.js";

export const ISSUE_CLOSED_NOT_PLANNED: GitHubIssueFixture = {
  number: 12,
  url: "https://github.com/owner/repo/issues/12",
  title: "Add support for legacy browser",
  body: "Support IE11.",
  state: "closed",
  stateReason: "not_planned",
  labels: [{ name: "wontfix" }],
  assignees: [],
  createdAt: "2026-01-05T08:00:00Z",
  closedAt: "2026-01-07T10:00:00Z",
  comments: [],
};
```

- [ ] **Step 4: 创建 issue-blocked.ts**

创建 `packages/adapters/github/src/fixtures/issue-blocked.ts`：

```typescript
import type { GitHubIssueFixture } from "../types.js";

export const ISSUE_BLOCKED: GitHubIssueFixture = {
  number: 13,
  url: "https://github.com/owner/repo/issues/13",
  title: "Integrate payment gateway",
  body: "Waiting on API credentials from provider.",
  state: "open",
  labels: [{ name: "blocked" }, { name: "priority:urgent" }],
  assignees: [{ login: "octocat" }],
  createdAt: "2026-01-08T08:00:00Z",
  closedAt: null,
  comments: [],
};
```

- [ ] **Step 5: 创建 pr-open.ts**

创建 `packages/adapters/github/src/fixtures/pr-open.ts`：

```typescript
import type { GitHubPRFixture } from "../types.js";

export const PR_OPEN: GitHubPRFixture = {
  number: 20,
  url: "https://github.com/owner/repo/pull/20",
  title: "Add login page component",
  body: "Implements login UI. Closes #10.",
  state: "open",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/login",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [],
  comments: [],
  createdAt: "2026-01-09T08:00:00Z",
  closedAt: null,
};
```

- [ ] **Step 6: 创建 pr-draft.ts**

创建 `packages/adapters/github/src/fixtures/pr-draft.ts`：

```typescript
import type { GitHubPRFixture } from "../types.js";

export const PR_DRAFT: GitHubPRFixture = {
  number: 21,
  url: "https://github.com/owner/repo/pull/21",
  title: "WIP: refactor auth module",
  body: "Draft PR for auth refactor.",
  state: "open",
  draft: true,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/auth-refactor",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [],
  comments: [],
  createdAt: "2026-01-10T08:00:00Z",
  closedAt: null,
};
```

- [ ] **Step 7: 创建 pr-review-requested.ts**

创建 `packages/adapters/github/src/fixtures/pr-review-requested.ts`：

```typescript
import type { GitHubPRFixture } from "../types.js";

export const PR_REVIEW_REQUESTED: GitHubPRFixture = {
  number: 22,
  url: "https://github.com/owner/repo/pull/22",
  title: "Add dashboard widget",
  body: "Adds a new dashboard widget.",
  state: "open",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/widget",
  baseRef: "main",
  labels: [],
  requestedReviewers: [{ login: "reviewer1" }, { login: "reviewer2" }],
  reviews: [],
  comments: [],
  createdAt: "2026-01-11T08:00:00Z",
  closedAt: null,
};
```

- [ ] **Step 8: 创建 pr-changes-requested.ts**

创建 `packages/adapters/github/src/fixtures/pr-changes-requested.ts`：

```typescript
import type { GitHubPRFixture } from "../types.js";

export const PR_CHANGES_REQUESTED: GitHubPRFixture = {
  number: 23,
  url: "https://github.com/owner/repo/pull/23",
  title: "Add analytics tracking",
  body: "Adds analytics events.",
  state: "open",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "feature/analytics",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [
    {
      author: { login: "reviewer1" },
      state: "CHANGES_REQUESTED",
      body: "Please add tests for the analytics module.",
      submittedAt: "2026-01-12T10:00:00Z",
    },
  ],
  comments: [],
  createdAt: "2026-01-12T08:00:00Z",
  closedAt: null,
};
```

- [ ] **Step 9: 创建 pr-approved.ts**

创建 `packages/adapters/github/src/fixtures/pr-approved.ts`：

```typescript
import type { GitHubPRFixture } from "../types.js";

export const PR_APPROVED: GitHubPRFixture = {
  number: 24,
  url: "https://github.com/owner/repo/pull/24",
  title: "Update README",
  body: "Updates documentation.",
  state: "open",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "docs/readme-update",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [
    {
      author: { login: "reviewer1" },
      state: "APPROVED",
      body: "Looks good!",
      submittedAt: "2026-01-13T10:00:00Z",
    },
  ],
  comments: [],
  createdAt: "2026-01-13T08:00:00Z",
  closedAt: null,
};
```

- [ ] **Step 10: 创建 pr-merged.ts**

创建 `packages/adapters/github/src/fixtures/pr-merged.ts`：

```typescript
import type { GitHubPRFixture } from "../types.js";

export const PR_MERGED: GitHubPRFixture = {
  number: 25,
  url: "https://github.com/owner/repo/pull/25",
  title: "Fix typo in config",
  body: "Fixes config typo. Closes #11.",
  state: "closed",
  draft: false,
  merged: true,
  mergedAt: "2026-01-14T12:00:00Z",
  mergedBy: { login: "octocat" },
  mergeCommitSha: "abc123def456",
  headRef: "fix/config-typo",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [
    {
      author: { login: "reviewer1" },
      state: "APPROVED",
      body: "LGTM",
      submittedAt: "2026-01-14T10:00:00Z",
    },
  ],
  comments: [],
  createdAt: "2026-01-14T08:00:00Z",
  closedAt: "2026-01-14T12:00:00Z",
};
```

- [ ] **Step 11: 创建 pr-closed-unmerged.ts**

创建 `packages/adapters/github/src/fixtures/pr-closed-unmerged.ts`：

```typescript
import type { GitHubPRFixture } from "../types.js";

export const PR_CLOSED_UNMERGED: GitHubPRFixture = {
  number: 26,
  url: "https://github.com/owner/repo/pull/26",
  title: "Experimental feature",
  body: "Closing this, not needed anymore.",
  state: "closed",
  draft: false,
  merged: false,
  mergedAt: null,
  mergedBy: null,
  mergeCommitSha: null,
  headRef: "experimental/feature",
  baseRef: "main",
  labels: [],
  requestedReviewers: [],
  reviews: [
    {
      author: { login: "reviewer1" },
      state: "CHANGES_REQUESTED",
      body: "This approach won't work.",
      submittedAt: "2026-01-15T10:00:00Z",
    },
  ],
  comments: [],
  createdAt: "2026-01-15T08:00:00Z",
  closedAt: "2026-01-15T12:00:00Z",
};
```

- [ ] **Step 12: 创建 fixtures/index.ts（聚合导出）**

创建 `packages/adapters/github/src/fixtures/index.ts`：

```typescript
import type { GitHubFixtures } from "../types.js";
import { ISSUE_OPEN } from "./issue-open.js";
import { ISSUE_CLOSED_COMPLETED } from "./issue-closed-completed.js";
import { ISSUE_CLOSED_NOT_PLANNED } from "./issue-closed-not-planned.js";
import { ISSUE_BLOCKED } from "./issue-blocked.js";
import { PR_OPEN } from "./pr-open.js";
import { PR_DRAFT } from "./pr-draft.js";
import { PR_REVIEW_REQUESTED } from "./pr-review-requested.js";
import { PR_CHANGES_REQUESTED } from "./pr-changes-requested.js";
import { PR_APPROVED } from "./pr-approved.js";
import { PR_MERGED } from "./pr-merged.js";
import { PR_CLOSED_UNMERGED } from "./pr-closed-unmerged.js";

export {
  ISSUE_OPEN,
  ISSUE_CLOSED_COMPLETED,
  ISSUE_CLOSED_NOT_PLANNED,
  ISSUE_BLOCKED,
  PR_OPEN,
  PR_DRAFT,
  PR_REVIEW_REQUESTED,
  PR_CHANGES_REQUESTED,
  PR_APPROVED,
  PR_MERGED,
  PR_CLOSED_UNMERGED,
};

/**
 * 聚合 fixture 集合 — 包含所有 issue 与 PR fixture。
 * 用于 determinism.test.ts 和集成测试。
 */
export const SAMPLE_FIXTURES: GitHubFixtures = {
  repo: { owner: "owner", name: "repo" },
  issues: [
    ISSUE_OPEN,
    ISSUE_CLOSED_COMPLETED,
    ISSUE_CLOSED_NOT_PLANNED,
    ISSUE_BLOCKED,
  ],
  pulls: [
    PR_OPEN,
    PR_DRAFT,
    PR_REVIEW_REQUESTED,
    PR_CHANGES_REQUESTED,
    PR_APPROVED,
    PR_MERGED,
    PR_CLOSED_UNMERGED,
  ],
};
```

- [ ] **Step 13: 验证 fixtures 编译通过**

Run: `npx tsc --noEmit --skipLibCheck packages/adapters/github/src/fixtures/index.ts`
Expected: 无错误。

- [ ] **Step 14: 提交**

```bash
git add packages/adapters/github/src/fixtures/
git commit -m "test(github-adapter): add 11 deterministic GitHub fixtures" -m "4 个 issue fixture（open/closed-completed/closed-not-planned/blocked）+ 7 个 PR fixture（open/draft/review-requested/changes-requested/approved/merged/closed-unmerged），使用稳定时间戳。" -m "Refs #34"
```

---

## Task 6: GitHubRuntimeAdapter 实现

**Files:**
- Create: `packages/adapters/github/src/github-adapter.ts`
- Create: `packages/adapters/github/src/github-adapter.test.ts`

**Interfaces:**
- Consumes: Task 1-3 的 protocol/reducer 扩展；Task 4 的包结构与 types.ts；Task 5 的 fixtures。
- Produces: `GitHubRuntimeAdapter` 类，实现 `RuntimeAdapter` 接口 + adapter 专属方法（`syncFromFixtures` / `getGitHubEvidence` / `getEventLog`）。Task 7-10 的测试依赖此实现。

- [ ] **Step 1: 编写基础生命周期测试（失败测试）**

创建 `packages/adapters/github/src/github-adapter.test.ts`：

```typescript
/**
 * GitHubRuntimeAdapter 基础生命周期测试。
 * 覆盖 connect/disconnect/getSnapshot/subscribe/execute/getCapabilities。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { CommandType, type OfficeCommand } from "@agent-office/protocol";

function makeCommand(commandType: string, payload: unknown): OfficeCommand {
  return {
    commandId: "cmd-test-1",
    commandType,
    timestamp: "2026-01-01T00:00:00Z",
    source: "user",
    actorId: "user-1",
    runtimeId: "github-runtime-001",
    targetId: null,
    payload,
  };
}

describe("GitHubRuntimeAdapter basic lifecycle", () => {
  let adapter: GitHubRuntimeAdapter;

  beforeEach(() => {
    adapter = new GitHubRuntimeAdapter();
  });

  it("connect/disconnect 切换 connected 状态", async () => {
    await adapter.connect();
    // getSnapshot 不应抛异常
    const snap = await adapter.getSnapshot();
    expect(snap.runtimeId).toBe("github-runtime-001");
    await adapter.disconnect();
  });

  it("初始 snapshot 中 agents=[] rooms=[] tasks=[] artifacts=[]", async () => {
    await adapter.connect();
    const snap = await adapter.getSnapshot();
    expect(snap.agents).toHaveLength(0);
    expect(snap.rooms).toHaveLength(0);
    expect(snap.tasks).toHaveLength(0);
    expect(snap.artifacts).toHaveLength(0);
  });

  it("getCapabilities 声明只读：commandExecution=false", () => {
    const caps = adapter.getCapabilities();
    expect(caps.features.snapshot).toBe(true);
    expect(caps.features.commandExecution).toBe(false);
    expect(caps.features.hardOrchestration).toBe(false);
    expect(caps.features.softMapping).toBe(false);
    expect(caps.supportedCommands).toHaveLength(0);
  });

  it("execute 对所有写命令返回 rejected + UNSUPPORTED_COMMAND", async () => {
    await adapter.connect();
    const cmd = makeCommand(CommandType.TASK_CREATE, { title: "test", description: "desc" });
    const result = await adapter.execute(cmd);
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
    expect(result.error?.message).toContain("read-only");
  });

  it("syncFromFixtures 生成 eventLog 且 getSnapshot 返回投影结果", async () => {
    await adapter.connect();
    const { ISSUE_OPEN } = await import("./fixtures/index.js");
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues: [ISSUE_OPEN],
      pulls: [],
    });
    const snap = await adapter.getSnapshot();
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].taskId).toBe("gh-issue-10");
    expect(snap.tasks[0].status).toBe("created");
    expect(snap.agents).toHaveLength(0);
    expect(snap.rooms).toHaveLength(0);
  });

  it("getGitHubEvidence 返回 task provenance", async () => {
    await adapter.connect();
    const { ISSUE_OPEN } = await import("./fixtures/index.js");
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues: [ISSUE_OPEN],
      pulls: [],
    });
    const evidence = adapter.getGitHubEvidence();
    expect(Object.keys(evidence.tasks)).toContain("gh-issue-10");
    expect(evidence.tasks["gh-issue-10"].kind).toBe("issue");
    expect(evidence.tasks["gh-issue-10"].number).toBe(10);
  });

  it("getEventLog 返回事件日志副本", async () => {
    await adapter.connect();
    const { ISSUE_OPEN } = await import("./fixtures/index.js");
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues: [ISSUE_OPEN],
      pulls: [],
    });
    const log = adapter.getEventLog();
    expect(log.length).toBeGreaterThan(0);
    // 验证事件 ID 格式
    expect(log[0].eventId).toMatch(/^evt-gh-\d+-issue-\d+$/);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `npx vitest run packages/adapters/github/src/github-adapter.test.ts`
Expected: FAIL — `GitHubRuntimeAdapter` 未定义（`github-adapter.ts` 尚未创建）。

- [ ] **Step 3: 实现 GitHubRuntimeAdapter**

创建 `packages/adapters/github/src/github-adapter.ts`：

```typescript
/**
 * GitHubRuntimeAdapter — 只读投影 adapter。
 *
 * 消费 GitHub fixture，产出标准 office DomainEvent 序列，
 * 经现有 reduceEvent reducer 生成 RuntimeSnapshot。
 *
 * 核心特性：
 * - 只读：execute() 对所有写命令返回 rejected
 * - 确定性：相同 fixture → 相同 event 序列（稳定 ID、固定时间戳、无 Date.now()）
 * - 不自建 agents/rooms：snapshot 中 agents=[] rooms=[]
 * - GitHub 用户作为 external actor evidence
 */
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  DomainEvent,
  OfficeCommand,
  CommandResult,
  AdapterCapabilities,
  RuntimeStreamObserver,
  RuntimeSubscription,
  RuntimeStreamError,
  SubscribeOptions,
  Id,
  Priority,
} from "@agent-office/protocol";
import { EventType, ALL_EVENT_TYPES } from "@agent-office/protocol";
import { reduceEvent, createEmptySnapshot } from "@agent-office/core";
import type {
  GitHubFixtures,
  GitHubIssueFixture,
  GitHubPRFixture,
  GitHubSourceRef,
  GitHubAdapterEvidence,
  GitHubLabel,
} from "./types.js";

const DEFAULT_RUNTIME_ID = "github-runtime-001";
const DEFAULT_BASE_TIMESTAMP = "2026-01-01T00:00:00Z";

export interface GitHubAdapterOptions {
  runtimeId?: string;
  baseTimestamp?: string;
}

export class GitHubRuntimeAdapter implements RuntimeAdapter {
  private connected = false;
  private subscribers = new Set<RuntimeStreamObserver>();
  private sequence = 0;
  private eventLog: DomainEvent[] = [];
  private evidence: GitHubAdapterEvidence = { tasks: {}, artifacts: {} };
  private runtimeId: string;
  private baseTimestamp: string;
  private correlationId = "corr-gh-001";
  private traceId = "trace-gh-001";

  constructor(options: GitHubAdapterOptions = {}) {
    this.runtimeId = options.runtimeId ?? DEFAULT_RUNTIME_ID;
    this.baseTimestamp = options.baseTimestamp ?? DEFAULT_BASE_TIMESTAMP;
  }

  // ─── RuntimeAdapter 接口实现 ───────────────────────────────

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.subscribers.clear();
  }

  async getSnapshot(): Promise<RuntimeSnapshot> {
    let snapshot = createEmptySnapshot(this.runtimeId);
    // createEmptySnapshot 使用 Date.now()，需覆盖为确定性值
    snapshot.createdAt = this.baseTimestamp;
    snapshot.snapshotId = `snap-gh-${this.sequence}`;

    for (const event of this.eventLog) {
      const result = reduceEvent(snapshot, event);
      snapshot = result.snapshot;
    }
    snapshot.lastEventId = this.eventLog.length > 0
      ? this.eventLog[this.eventLog.length - 1].eventId
      : "";
    snapshot.sequence = this.sequence;
    return snapshot;
  }

  subscribe(
    observer: RuntimeStreamObserver,
    options?: SubscribeOptions
  ): RuntimeSubscription {
    let closed = false;
    const cursor = options?.afterSequence;

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
          if (closed) return;
          if (event.sequence > cursor) {
            observer.onEvent(event);
          }
        }
      }

      if (closed) return;
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

  async execute(command: OfficeCommand): Promise<CommandResult> {
    return {
      commandId: command.commandId,
      status: "rejected",
      error: {
        code: "UNSUPPORTED_COMMAND",
        message: "GitHub Runtime Adapter v0 is read-only; no commands are supported",
      },
      affectedEventIds: [],
    };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportedEvents: [...ALL_EVENT_TYPES],
      supportedCommands: [],
      features: {
        snapshot: true,
        sse: true,
        websocket: false,
        commandExecution: false,
        softMapping: false,
        hardOrchestration: false,
      },
    };
  }

  // ─── GitHub adapter 专属方法 ───────────────────────────────

  /**
   * 从 GitHub fixtures 重新投影，幂等。
   * 清空 eventLog 和 evidence，按确定性顺序重新生成事件。
   */
  syncFromFixtures(fixtures: GitHubFixtures): void {
    // 重置状态
    this.sequence = 0;
    this.eventLog = [];
    this.evidence = { tasks: {}, artifacts: {} };

    // 按 number 升序处理 issues
    const sortedIssues = [...fixtures.issues].sort((a, b) => a.number - b.number);
    for (const issue of sortedIssues) {
      this.processIssue(issue);
    }

    // 按 number 升序处理 PRs
    const sortedPRs = [...fixtures.pulls].sort((a, b) => a.number - b.number);
    for (const pr of sortedPRs) {
      this.processPR(pr);
    }
  }

  getGitHubEvidence(): GitHubAdapterEvidence {
    return {
      tasks: { ...this.evidence.tasks },
      artifacts: { ...this.evidence.artifacts },
    };
  }

  getEventLog(): DomainEvent[] {
    return [...this.eventLog];
  }

  // ─── 内部：Issue 处理 ─────────────────────────────────────

  private processIssue(issue: GitHubIssueFixture): void {
    const taskId: Id = `gh-issue-${issue.number}`;
    const priority = this.derivePriority(issue.labels);
    const isBlocked = issue.labels.some((l) => l.name === "blocked");

    // 记录 evidence
    this.evidence.tasks[taskId] = this.buildIssueEvidence(issue);

    // task.created
    this.emit(EventType.TASK_CREATED, {
      taskId,
      title: issue.title,
      description: issue.body,
      priority,
      parentTaskId: null,
    }, "issue", issue.number, issue.createdAt);

    // 如果 blocked label 存在，发 task.blocked
    if (isBlocked) {
      this.emit(EventType.TASK_BLOCKED, {
        taskId,
        reason: "GitHub label: blocked",
      }, "issue", issue.number, issue.createdAt);
    }

    // 如果 issue 已 closed，发 task.completed
    if (issue.state === "closed" && issue.closedAt) {
      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "issue", issue.number, issue.closedAt);
    }
  }

  // ─── 内部：PR 处理 ────────────────────────────────────────

  private processPR(pr: GitHubPRFixture): void {
    const taskId: Id = `gh-pr-task-${pr.number}`;
    const artifactId: Id = `gh-pr-${pr.number}`;
    const priority = this.derivePriority(pr.labels);

    // 记录 evidence
    this.evidence.tasks[taskId] = this.buildPREvidence(pr);
    this.evidence.artifacts[artifactId] = this.buildPREvidence(pr);

    // task.created（PR task）
    this.emit(EventType.TASK_CREATED, {
      taskId,
      title: pr.title,
      description: pr.body,
      priority,
      parentTaskId: null,
    }, "pr", pr.number, pr.createdAt);

    // 根据 PR 状态发射 artifact 事件
    if (pr.merged) {
      // merged PR：artifact.created → artifact.delivered
      this.emit(EventType.ARTIFACT_CREATED, {
        artifactId,
        taskId,
        producerAgentId: "",
        type: "github_pr",
        title: pr.title,
        uri: pr.url,
        version: 1,
      }, "pr", pr.number, pr.createdAt);

      this.emit(EventType.ARTIFACT_DELIVERED, {
        artifactId,
        mergeCommitSha: pr.mergeCommitSha,
        mergedBy: pr.mergedBy?.login ?? "unknown",
      }, "pr", pr.number, pr.mergedAt ?? pr.closedAt ?? pr.createdAt);

      // task.completed
      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "pr", pr.number, pr.mergedAt ?? pr.closedAt ?? pr.createdAt);

    } else if (pr.state === "closed" && !pr.merged) {
      // closed unmerged PR：artifact.created → artifact.reviewed(rejected)
      this.emit(EventType.ARTIFACT_CREATED, {
        artifactId,
        taskId,
        producerAgentId: "",
        type: "github_pr",
        title: pr.title,
        uri: pr.url,
        version: 1,
      }, "pr", pr.number, pr.createdAt);

      if (pr.reviews.length > 0) {
        const review = pr.reviews[0];
        this.emit(EventType.ARTIFACT_REVIEWED, {
          artifactId,
          reviewerId: review.author.login,
          verdict: "rejected" as const,
          comment: review.body,
        }, "pr", pr.number, review.submittedAt);
      }

      // task.completed（closed-unmerged 也算完成，evidence 标记）
      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "pr", pr.number, pr.closedAt ?? pr.createdAt);

    } else if (pr.draft) {
      // draft PR：artifact.drafted
      this.emit(EventType.ARTIFACT_DRAFTED, {
        artifactId,
        taskId,
        producerAgentId: null,
        type: "github_pr",
        title: pr.title,
        uri: pr.url,
        version: 1,
      }, "pr", pr.number, pr.createdAt);

    } else {
      // open PR（ready）
      this.emit(EventType.ARTIFACT_CREATED, {
        artifactId,
        taskId,
        producerAgentId: "",
        type: "github_pr",
        title: pr.title,
        uri: pr.url,
        version: 1,
      }, "pr", pr.number, pr.createdAt);

      if (pr.reviews.length > 0) {
        // 有已提交 review
        const review = pr.reviews[0];
        const verdict = review.state === "APPROVED" ? "approved" as const
          : review.state === "CHANGES_REQUESTED" ? "revision_required" as const
          : null;

        if (verdict !== null) {
          this.emit(EventType.ARTIFACT_REVIEWED, {
            artifactId,
            reviewerId: review.author.login,
            verdict,
            comment: review.body,
          }, "pr", pr.number, review.submittedAt);
        }
        // COMMENTED review 不产生 artifact 事件（evidence only）
      } else if (pr.requestedReviewers.length > 0) {
        // review requested（无已提交 review）
        this.emit(EventType.ARTIFACT_REVIEW_REQUESTED, {
          artifactId,
          reviewerIds: pr.requestedReviewers.map((r) => r.login),
        }, "pr", pr.number, pr.createdAt);
      }
    }
  }

  // ─── 内部：Label → Priority 映射 ──────────────────────────

  private derivePriority(labels: GitHubLabel[]): Priority {
    const names = labels.map((l) => l.name.toLowerCase());
    if (names.includes("priority:urgent") || names.includes("p0")) return "urgent";
    if (names.includes("priority:high") || names.includes("p1")) return "high";
    if (names.includes("priority:low")) return "low";
    return "normal";
  }

  // ─── 内部：Evidence 构建 ───────────────────────────────────

  private buildIssueEvidence(issue: GitHubIssueFixture): GitHubSourceRef {
    return {
      kind: "issue",
      number: issue.number,
      url: issue.url,
      rawState: issue.state,
      labels: issue.labels.map((l) => l.name),
      assignees: issue.assignees.map((a) => a.login),
      comments: issue.comments.map((c) => ({
        author: c.author.login,
        body: c.body,
        createdAt: c.createdAt,
      })),
    };
  }

  private buildPREvidence(pr: GitHubPRFixture): GitHubSourceRef {
    return {
      kind: "pr",
      number: pr.number,
      url: pr.url,
      rawState: pr.merged ? "merged" : pr.state,
      labels: pr.labels.map((l) => l.name),
      assignees: [],
      reviewers: pr.requestedReviewers.map((r) => r.login),
      comments: pr.comments.map((c) => ({
        author: c.author.login,
        body: c.body,
        createdAt: c.createdAt,
      })),
      refsIssueNumbers: this.parseRefsIssueNumbers(pr.body),
    };
  }

  private parseRefsIssueNumbers(body: string): number[] {
    const regex = /(?:closes?|refs?)\s+#(\d+)/gi;
    const numbers: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
      numbers.push(parseInt(match[1], 10));
    }
    return numbers;
  }

  // ─── 内部：事件发射 ────────────────────────────────────────

  private emit<P>(
    type: string,
    payload: P,
    entityKind: "issue" | "pr",
    entityNumber: number,
    occurredAt: string
  ): void {
    const seq = ++this.sequence;
    const event: DomainEvent<P> = {
      eventId: `evt-gh-${seq}-${entityKind}-${entityNumber}`,
      runtimeId: this.runtimeId,
      sequence: seq,
      schemaVersion: "1.0",
      type,
      occurredAt,
      receivedAt: occurredAt,
      correlationId: this.correlationId,
      causationId: this.eventLog.length > 0
        ? this.eventLog[this.eventLog.length - 1].eventId
        : null,
      traceId: this.traceId,
      payload,
    };
    this.eventLog.push(event);
    // 推送给订阅者（同步，与 MockRuntimeAdapter delay=0 一致）
    for (const observer of this.subscribers) {
      observer.onEvent(event);
    }
  }
}
```

- [ ] **Step 4: 运行基础测试验证通过**

Run: `npx vitest run packages/adapters/github/src/github-adapter.test.ts`
Expected: PASS — 全部 7 个测试用例通过。

- [ ] **Step 5: 验证全包 TypeScript 编译**

Run: `npx tsc -b packages/adapters/github`
Expected: 无错误退出（index.ts 引用的所有模块已创建）。

- [ ] **Step 6: 运行全量测试确保无回归**

Run: `npx vitest run`
Expected: 所有测试通过（含新增 + 现有）。

- [ ] **Step 7: 提交**

```bash
git add packages/adapters/github/src/github-adapter.ts packages/adapters/github/src/github-adapter.test.ts
git commit -m "feat(github-adapter): implement GitHubRuntimeAdapter read-only projection" -m "实现只读投影 adapter：syncFromFixtures 生成确定性事件序列，getSnapshot 通过 replayEvents 产出，execute 全部 rejected，agents/rooms=[]。" -m "Refs #34"
```

---

## Task 7: Projection 测试

**Files:**
- Create: `packages/adapters/github/src/projection.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `GitHubRuntimeAdapter` + Task 5 的 fixtures。
- Produces: 验证 AC1, AC2, AC3, AC5, AC7 — issue/PR → snapshot 投影、evidence 完整性、agents/rooms=[]。

- [ ] **Step 1: 创建 projection.test.ts**

创建 `packages/adapters/github/src/projection.test.ts`：

```typescript
/**
 * Projection 测试 — issue/PR fixture → snapshot 投影。
 * 覆盖 AC1, AC2, AC3, AC5, AC7。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { projectSnapshot } from "@agent-office/core";
import {
  ISSUE_OPEN,
  ISSUE_CLOSED_COMPLETED,
  ISSUE_CLOSED_NOT_PLANNED,
  ISSUE_BLOCKED,
  PR_OPEN,
  PR_DRAFT,
  PR_REVIEW_REQUESTED,
  PR_CHANGES_REQUESTED,
  PR_APPROVED,
  PR_MERGED,
  PR_CLOSED_UNMERGED,
} from "./fixtures/index.js";
import type { GitHubFixtures } from "./types.js";

describe("GitHub projection: issue/PR → snapshot", () => {
  let adapter: GitHubRuntimeAdapter;

  beforeEach(async () => {
    adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
  });

  function syncFixtures(issues: any[], pulls: any[]): void {
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues,
      pulls,
    });
  }

  // ─── AC1: GitHub Issue → Runtime-backed Office Task ───────────

  it("open issue → task.status=created + evidence", async () => {
    syncFixtures([ISSUE_OPEN], []);
    const snap = await adapter.getSnapshot();
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].taskId).toBe("gh-issue-10");
    expect(snap.tasks[0].status).toBe("created");
    expect(snap.tasks[0].title).toBe("Implement login page");
    expect(snap.tasks[0].priority).toBe("high");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-10"]).toBeDefined();
    expect(evidence.tasks["gh-issue-10"].kind).toBe("issue");
    expect(evidence.tasks["gh-issue-10"].number).toBe(10);
  });

  it("closed-completed issue → task.status=completed", async () => {
    syncFixtures([ISSUE_CLOSED_COMPLETED], []);
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("completed");
    expect(snap.tasks[0].completedAt).toBe("2026-01-06T10:00:00Z");
  });

  it("closed-not-planned issue → task.status=completed + evidence stateReason", async () => {
    syncFixtures([ISSUE_CLOSED_NOT_PLANNED], []);
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("completed");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-12"].rawState).toBe("closed");
  });

  it("blocked issue → task.status=blocked", async () => {
    syncFixtures([ISSUE_BLOCKED], []);
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("blocked");
    expect(snap.tasks[0].blockedReason).toBe("GitHub label: blocked");
  });

  // ─── AC2: GitHub PR → Runtime-backed Artifact ────────────────

  it("open PR → artifact.status=generated", async () => {
    syncFixtures([], [PR_OPEN]);
    const snap = await adapter.getSnapshot();
    expect(snap.artifacts).toHaveLength(1);
    expect(snap.artifacts[0].artifactId).toBe("gh-pr-20");
    expect(snap.artifacts[0].status).toBe("generated");
    expect(snap.artifacts[0].type).toBe("github_pr");
    expect(snap.artifacts[0].uri).toBe("https://github.com/owner/repo/pull/20");
  });

  it("draft PR → artifact.status=draft", async () => {
    syncFixtures([], [PR_DRAFT]);
    const snap = await adapter.getSnapshot();
    expect(snap.artifacts[0].status).toBe("draft");
  });

  it("review-requested PR → artifact.status=under_review", async () => {
    syncFixtures([], [PR_REVIEW_REQUESTED]);
    const snap = await adapter.getSnapshot();
    expect(snap.artifacts[0].status).toBe("under_review");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.artifacts["gh-pr-22"].reviewers).toEqual(["reviewer1", "reviewer2"]);
  });

  it("changes-requested PR → artifact.status=revision_required + task.status=revision_required", async () => {
    syncFixtures([], [PR_CHANGES_REQUESTED]);
    const snap = await adapter.getSnapshot();
    expect(snap.artifacts[0].status).toBe("revision_required");
    expect(snap.artifacts[0].reviewResult?.verdict).toBe("revision_required");
    expect(snap.tasks[0].status).toBe("revision_required");
  });

  it("approved PR → artifact.status=approved", async () => {
    syncFixtures([], [PR_APPROVED]);
    const snap = await adapter.getSnapshot();
    expect(snap.artifacts[0].status).toBe("approved");
    expect(snap.artifacts[0].reviewResult?.verdict).toBe("approved");
  });

  it("merged PR → artifact.status=delivered + task.completed", async () => {
    syncFixtures([], [PR_MERGED]);
    const snap = await adapter.getSnapshot();
    expect(snap.artifacts[0].status).toBe("delivered");

    const task = snap.tasks.find((t) => t.taskId === "gh-pr-task-25");
    expect(task).toBeDefined();
    expect(task!.status).toBe("completed");
  });

  it("closed-unmerged PR → artifact.status=rejected + task.completed", async () => {
    syncFixtures([], [PR_CLOSED_UNMERGED]);
    const snap = await adapter.getSnapshot();
    expect(snap.artifacts[0].status).toBe("rejected");

    const task = snap.tasks.find((t) => t.taskId === "gh-pr-task-26");
    expect(task!.status).toBe("completed");
  });

  // ─── AC3: label/state/comment/review status 通过 evidence 或 Event ──

  it("comments 进入 evidence", async () => {
    syncFixtures([ISSUE_OPEN], []);
    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-10"].comments).toHaveLength(1);
    expect(evidence.tasks["gh-issue-10"].comments[0].author).toBe("dev1");
  });

  it("labels 进入 evidence", async () => {
    syncFixtures([ISSUE_OPEN], []);
    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-10"].labels).toContain("priority:high");
    expect(evidence.tasks["gh-issue-10"].labels).toContain("feature");
  });

  // ─── AC5: agents=[] rooms=[]，无伪造 ─────────────────────────

  it("snapshot 中 agents=[] rooms=[]（无 office agent/room 伪造）", async () => {
    syncFixtures([ISSUE_OPEN], [PR_OPEN]);
    const snap = await adapter.getSnapshot();
    expect(snap.agents).toHaveLength(0);
    expect(snap.rooms).toHaveLength(0);
  });

  it("projectSnapshot 不伪造 GitHub 业务状态", async () => {
    syncFixtures([ISSUE_OPEN], [PR_OPEN]);
    const snap = await adapter.getSnapshot();
    const projection = projectSnapshot(snap);
    expect(projection.agents).toHaveLength(0);
    expect(projection.rooms).toHaveLength(0);
    expect(projection.tasks).toHaveLength(2);
    expect(projection.artifacts).toHaveLength(1);
  });

  // ─── AC5 续：无 evidence 则不存在 ────────────────────────────

  it("snapshot.tasks 数量 == evidence.tasks 数量 == fixture issue 数量", async () => {
    syncFixtures([ISSUE_OPEN, ISSUE_CLOSED_COMPLETED], []);
    const snap = await adapter.getSnapshot();
    const evidence = adapter.getGitHubEvidence();
    expect(snap.tasks).toHaveLength(2);
    expect(Object.keys(evidence.tasks)).toHaveLength(2);
  });

  it("snapshot.artifacts 数量 == evidence.artifacts 数量 == fixture PR 数量", async () => {
    syncFixtures([], [PR_OPEN, PR_DRAFT]);
    const snap = await adapter.getSnapshot();
    const evidence = adapter.getGitHubEvidence();
    expect(snap.artifacts).toHaveLength(2);
    expect(Object.keys(evidence.artifacts)).toHaveLength(2);
  });

  // ─── 每个 PR 产出 1 个 task + 1 个 artifact ─────────────────

  it("每个 PR 产出 1 个 task（gh-pr-task-{N}）+ 1 个 artifact（gh-pr-{N}）", async () => {
    syncFixtures([], [PR_OPEN, PR_DRAFT, PR_MERGED]);
    const snap = await adapter.getSnapshot();
    expect(snap.tasks).toHaveLength(3);
    expect(snap.artifacts).toHaveLength(3);
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-pr-task-20");
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-pr-task-21");
    expect(snap.tasks.map((t) => t.taskId)).toContain("gh-pr-task-25");
    expect(snap.artifacts.map((a) => a.artifactId)).toContain("gh-pr-20");
    expect(snap.artifacts.map((a) => a.artifactId)).toContain("gh-pr-21");
    expect(snap.artifacts.map((a) => a.artifactId)).toContain("gh-pr-25");
  });

  // ─── Closes #X 仅作 evidence，不触发 issue close ──────────────

  it("PR body 中 Closes #X 仅作 evidence，不替代 acceptance", async () => {
    syncFixtures([], [PR_MERGED]); // PR_MERGED body 含 "Closes #11"
    const evidence = adapter.getGitHubEvidence();
    expect(evidence.artifacts["gh-pr-25"].refsIssueNumbers).toContain(11);
    // PR 自身已 merged → task.completed，但这不是因为 Closes #11
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("completed");
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npx vitest run packages/adapters/github/src/projection.test.ts`
Expected: PASS — 全部测试用例通过。

- [ ] **Step 3: 提交**

```bash
git add packages/adapters/github/src/projection.test.ts
git commit -m "test(github-adapter): add projection tests for issue/PR mapping" -m "覆盖 AC1/2/3/5/7：issue→task、PR→artifact、label/state/comment→evidence、agents/rooms=[]、无 evidence 则不存在。" -m "Refs #34"
```

---

## Task 8: Determinism 测试

**Files:**
- Create: `packages/adapters/github/src/determinism.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `GitHubRuntimeAdapter` + Task 5 的 `SAMPLE_FIXTURES`。
- Produces: 验证 AC4 — 相同 fixture → 相同 Snapshot + 相同 event 序列。

- [ ] **Step 1: 创建 determinism.test.ts**

创建 `packages/adapters/github/src/determinism.test.ts`：

```typescript
/**
 * Determinism 测试 — 相同 fixture → 相同 snapshot + 相同 event 序列。
 * 覆盖 AC4。
 */
import { describe, it, expect } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { SAMPLE_FIXTURES } from "./fixtures/index.js";

describe("GitHub adapter determinism", () => {
  it("相同 fixture 产生相同 event 序列（eventId + sequence + type）", () => {
    const a = new GitHubRuntimeAdapter();
    a.syncFromFixtures(SAMPLE_FIXTURES);
    const eventsA = a.getEventLog();

    const b = new GitHubRuntimeAdapter();
    b.syncFromFixtures(SAMPLE_FIXTURES);
    const eventsB = b.getEventLog();

    expect(eventsA.length).toBe(eventsB.length);
    for (let i = 0; i < eventsA.length; i++) {
      expect(eventsA[i].eventId).toBe(eventsB[i].eventId);
      expect(eventsA[i].sequence).toBe(eventsB[i].sequence);
      expect(eventsA[i].type).toBe(eventsB[i].type);
      expect(eventsA[i].occurredAt).toBe(eventsB[i].occurredAt);
    }
  });

  it("相同 fixture 产生相同 snapshot（tasks + artifacts 逐字段比对）", async () => {
    const a = new GitHubRuntimeAdapter();
    a.syncFromFixtures(SAMPLE_FIXTURES);
    const snapA = await a.getSnapshot();

    const b = new GitHubRuntimeAdapter();
    b.syncFromFixtures(SAMPLE_FIXTURES);
    const snapB = await b.getSnapshot();

    expect(snapA.tasks).toEqual(snapB.tasks);
    expect(snapA.artifacts).toEqual(snapB.artifacts);
  });

  it("相同 fixture 产生相同 evidence", () => {
    const a = new GitHubRuntimeAdapter();
    a.syncFromFixtures(SAMPLE_FIXTURES);
    const evidenceA = a.getGitHubEvidence();

    const b = new GitHubRuntimeAdapter();
    b.syncFromFixtures(SAMPLE_FIXTURES);
    const evidenceB = b.getGitHubEvidence();

    expect(evidenceA).toEqual(evidenceB);
  });

  it("event ID 格式为 evt-gh-{seq}-{entityKind}-{entityNumber}", () => {
    const adapter = new GitHubRuntimeAdapter();
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const log = adapter.getEventLog();

    for (const event of log) {
      expect(event.eventId).toMatch(/^evt-gh-\d+-(issue|pr)-\d+$/);
    }
  });

  it("无 Date.now() 污染：occurredAt 全部来自 fixture 或 baseTimestamp", () => {
    const adapter = new GitHubRuntimeAdapter({ baseTimestamp: "2026-01-01T00:00:00Z" });
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const log = adapter.getEventLog();

    for (const event of log) {
      // 所有时间戳应以 2026-01 开头（fixture 时间戳或 baseTimestamp）
      expect(event.occurredAt).toMatch(/^2026-01-/);
    }
  });

  it("syncFromFixtures 幂等：重复调用产生相同结果", async () => {
    const adapter = new GitHubRuntimeAdapter();
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const snap1 = await adapter.getSnapshot();
    const log1 = adapter.getEventLog();

    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const snap2 = await adapter.getSnapshot();
    const log2 = adapter.getEventLog();

    expect(snap1.tasks).toEqual(snap2.tasks);
    expect(snap1.artifacts).toEqual(snap2.artifacts);
    expect(log1.length).toBe(log2.length);
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npx vitest run packages/adapters/github/src/determinism.test.ts`
Expected: PASS — 全部 6 个测试用例通过。

- [ ] **Step 3: 提交**

```bash
git add packages/adapters/github/src/determinism.test.ts
git commit -m "test(github-adapter): add determinism tests for stable replay" -m "覆盖 AC4：相同 fixture → 相同 event ID/sequence/type、相同 snapshot、相同 evidence、稳定 ID 格式、幂等 syncFromFixtures。" -m "Refs #34"
```

---

## Task 9: Label Mapping 测试

**Files:**
- Create: `packages/adapters/github/src/label-mapping.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `GitHubRuntimeAdapter` + Task 5 的 fixtures。
- Produces: 验证 AC7 — blocked / review-needed / priority label 映射。

- [ ] **Step 1: 创建 label-mapping.test.ts**

创建 `packages/adapters/github/src/label-mapping.test.ts`：

```typescript
/**
 * Label Mapping 测试 — label → priority/status 映射。
 * 覆盖 AC7。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { ISSUE_BLOCKED, ISSUE_OPEN } from "./fixtures/index.js";
import type { GitHubFixtures, GitHubIssueFixture } from "./types.js";

describe("GitHub label mapping", () => {
  let adapter: GitHubRuntimeAdapter;

  beforeEach(async () => {
    adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
  });

  function makeIssue(overrides: Partial<GitHubIssueFixture>): GitHubIssueFixture {
    return {
      number: 100,
      url: "https://github.com/owner/repo/issues/100",
      title: "test issue",
      body: "test body",
      state: "open",
      labels: [],
      assignees: [],
      createdAt: "2026-01-01T00:00:00Z",
      closedAt: null,
      comments: [],
      ...overrides,
    };
  }

  function syncIssue(issue: GitHubIssueFixture): void {
    adapter.syncFromFixtures({
      repo: { owner: "owner", name: "repo" },
      issues: [issue],
      pulls: [],
    });
  }

  // ─── Priority label → task.priority ──────────────────────────

  it("priority:urgent → task.priority=urgent", async () => {
    syncIssue(makeIssue({ labels: [{ name: "priority:urgent" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("urgent");
  });

  it("P0 → task.priority=urgent", async () => {
    syncIssue(makeIssue({ labels: [{ name: "P0" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("urgent");
  });

  it("priority:high → task.priority=high", async () => {
    syncIssue(makeIssue({ labels: [{ name: "priority:high" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("high");
  });

  it("P1 → task.priority=high", async () => {
    syncIssue(makeIssue({ labels: [{ name: "P1" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("high");
  });

  it("priority:low → task.priority=low", async () => {
    syncIssue(makeIssue({ labels: [{ name: "priority:low" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("low");
  });

  it("无 priority label → task.priority=normal（默认）", async () => {
    syncIssue(makeIssue({ labels: [{ name: "feature" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("normal");
  });

  // ─── blocked label → task.status=blocked ────────────────────

  it("blocked label → task.status=blocked + blockedReason", async () => {
    syncIssue(ISSUE_BLOCKED);
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("blocked");
    expect(snap.tasks[0].blockedReason).toBe("GitHub label: blocked");
  });

  // ─── 其他 label → evidence only ─────────────────────────────

  it("review-needed label → evidence only（task 保持 created）", async () => {
    syncIssue(makeIssue({ labels: [{ name: "review-needed" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("created");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-100"].labels).toContain("review-needed");
  });

  it("wontfix label → evidence only", async () => {
    syncIssue(makeIssue({ labels: [{ name: "wontfix" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].status).toBe("created");

    const evidence = adapter.getGitHubEvidence();
    expect(evidence.tasks["gh-issue-100"].labels).toContain("wontfix");
  });

  // ─── 大小写不敏感 ───────────────────────────────────────────

  it("label 大小写不敏感：PRIORITY:URGENT → urgent", async () => {
    syncIssue(makeIssue({ labels: [{ name: "PRIORITY:URGENT" }] }));
    const snap = await adapter.getSnapshot();
    expect(snap.tasks[0].priority).toBe("urgent");
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npx vitest run packages/adapters/github/src/label-mapping.test.ts`
Expected: PASS — 全部 10 个测试用例通过。

- [ ] **Step 3: 提交**

```bash
git add packages/adapters/github/src/label-mapping.test.ts
git commit -m "test(github-adapter): add label mapping tests for priority/status" -m "覆盖 AC7：priority label → task.priority、blocked → task.status=blocked、review-needed/wontfix → evidence only、大小写不敏感。" -m "Refs #34"
```

---

## Task 10: Destructive Guard 测试

**Files:**
- Create: `packages/adapters/github/src/destructive-guard.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `GitHubRuntimeAdapter` + Task 5 的 `SAMPLE_FIXTURES`。
- Produces: 验证 AC8 — 所有写命令返回 rejected；adapter 无 merge/close/approve 能力。

- [ ] **Step 1: 创建 destructive-guard.test.ts**

创建 `packages/adapters/github/src/destructive-guard.test.ts`：

```typescript
/**
 * Destructive Guard 测试 — v0 拒绝所有写命令。
 * 覆盖 AC8。
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { CommandType, type OfficeCommand } from "@agent-office/protocol";
import { SAMPLE_FIXTURES } from "./fixtures/index.js";

function makeCommand(
  commandType: string,
  payload: unknown,
  targetId: string | null = null
): OfficeCommand {
  return {
    commandId: `cmd-test-${commandType}`,
    commandType,
    timestamp: "2026-01-01T00:00:00Z",
    source: "user",
    actorId: "user-1",
    runtimeId: "github-runtime-001",
    targetId,
    payload,
  };
}

describe("GitHub adapter destructive guard: v0 rejects all write commands", () => {
  let adapter: GitHubRuntimeAdapter;

  beforeEach(async () => {
    adapter = new GitHubRuntimeAdapter();
    await adapter.connect();
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
  });

  const writeCommands: Array<{ name: string; commandType: string; payload: unknown; targetId?: string }> = [
    {
      name: "task.create",
      commandType: CommandType.TASK_CREATE,
      payload: { title: "injected", description: "should fail" },
    },
    {
      name: "task.assign",
      commandType: CommandType.TASK_ASSIGN,
      payload: { taskId: "gh-issue-10", agentId: "agent-1" },
      targetId: "gh-issue-10",
    },
    {
      name: "agent.pause",
      commandType: CommandType.AGENT_PAUSE,
      payload: { agentId: "agent-1" },
    },
    {
      name: "agent.resume",
      commandType: CommandType.AGENT_RESUME,
      payload: { agentId: "agent-1" },
    },
    {
      name: "approval.accept",
      commandType: CommandType.APPROVAL_ACCEPT,
      payload: { approvalId: "approval-1" },
      targetId: "approval-1",
    },
    {
      name: "approval.reject",
      commandType: CommandType.APPROVAL_REJECT,
      payload: { approvalId: "approval-1", reason: "no" },
      targetId: "approval-1",
    },
    {
      name: "artifact.open",
      commandType: CommandType.ARTIFACT_OPEN,
      payload: { artifactId: "gh-pr-20" },
      targetId: "gh-pr-20",
    },
  ];

  for (const { name, commandType, payload, targetId } of writeCommands) {
    it(`rejects ${name} with UNSUPPORTED_COMMAND`, async () => {
      const cmd = makeCommand(commandType, payload, targetId ?? null);
      const result = await adapter.execute(cmd);
      expect(result.status).toBe("rejected");
      expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
      expect(result.error?.message).toContain("read-only");
      expect(result.affectedEventIds).toHaveLength(0);
    });
  }

  it("rejects unknown command type with UNSUPPORTED_COMMAND", async () => {
    const cmd = makeCommand("github.merge", { prNumber: 20 });
    const result = await adapter.execute(cmd);
    expect(result.status).toBe("rejected");
    expect(result.error?.code).toBe("UNSUPPORTED_COMMAND");
  });

  it("getCapabilities 声明 supportedCommands=[]（无写能力）", () => {
    const caps = adapter.getCapabilities();
    expect(caps.supportedCommands).toHaveLength(0);
    expect(caps.features.commandExecution).toBe(false);
  });

  it("execute rejected 后 snapshot 不变（无副作用）", async () => {
    const snapBefore = await adapter.getSnapshot();
    const cmd = makeCommand(CommandType.TASK_CREATE, { title: "injected", description: "fail" });
    await adapter.execute(cmd);
    const snapAfter = await adapter.getSnapshot();
    expect(snapAfter.tasks).toEqual(snapBefore.tasks);
    expect(snapAfter.artifacts).toEqual(snapBefore.artifacts);
  });

  it("execute rejected 后 eventLog 不变（无事件注入）", async () => {
    const logBefore = adapter.getEventLog();
    const cmd = makeCommand(CommandType.TASK_CREATE, { title: "injected", description: "fail" });
    await adapter.execute(cmd);
    const logAfter = adapter.getEventLog();
    expect(logAfter.length).toBe(logBefore.length);
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `npx vitest run packages/adapters/github/src/destructive-guard.test.ts`
Expected: PASS — 全部 11 个测试用例通过（7 个写命令 + 1 个未知命令 + 3 个无副作用断言）。

- [ ] **Step 3: 提交**

```bash
git add packages/adapters/github/src/destructive-guard.test.ts
git commit -m "test(github-adapter): add destructive guard tests for read-only enforcement" -m "覆盖 AC8：所有写命令 rejected + UNSUPPORTED_COMMAND、snapshot/eventLog 无副作用、capabilities 声明无写能力。" -m "Refs #34"
```

---

## Task 11: 文档

**Files:**
- Create: `docs/integrations/github-adapter/README.md`
- Create: `docs/integrations/github-adapter/mapping-table.md`
- Create: `docs/integrations/github-adapter/v0-limitations.md`

**Interfaces:**
- Consumes: Task 1-10 的全部实现。
- Produces: 文档说明 adapter 边界、truth boundary、v0 限制，满足 AC（文档审查）。

- [ ] **Step 1: 创建 README.md**

创建 `docs/integrations/github-adapter/README.md`：

```markdown
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
```

- [ ] **Step 2: 创建 mapping-table.md**

创建 `docs/integrations/github-adapter/mapping-table.md`：

```markdown
# GitHub → Office 映射表

## Issue → Task 映射

| GitHub Issue 状态 | office Task 状态 | 触发的 office 事件 | evidence |
|---|---|---|---|
| open issue | `created` | `task.created`（priority 由 label 推导） | issue number / url / labels / assignees / comments |
| open + label `blocked` | `blocked` | `task.created` + `task.blocked`（reason="GitHub label: blocked"） | label 集合 |
| open + label `review-needed` | `created`（保持） | `task.created`；review-needed 仅作 evidence | label 集合 |
| closed + stateReason `completed` | `completed` | `task.created` + `task.completed`（completedAt=issue.closedAt） | closedAt / stateReason |
| closed + stateReason `not_planned` | `completed` | `task.created` + `task.completed`；evidence 标记 stateReason=not_planned | closedAt / stateReason |

## Label → Priority / Status 映射

| GitHub label | 映射 | 说明 |
|---|---|---|
| `priority:urgent` / `P0` | Priority=`urgent` | 影响 task.created 的 priority 字段 |
| `priority:high` / `P1` | Priority=`high` | |
| `priority:low` | Priority=`low` | |
| 无 priority label | Priority=`normal`（默认） | |
| 其他 label | 不映射 priority | 进入 evidence.labels |
| `blocked` | task.status=`blocked`（发 `task.blocked` 事件） | |
| `review-needed` | evidence only（task 保持 created） | review 是 PR 语义 |
| `wontfix` | evidence only | |

## PR → Artifact / Review Item 映射

每个 GitHub PR → 1 个 office Artifact（type=`github_pr`，uri=PR url）+ 1 个 Task（承载 PR 工作）。

| GitHub PR 状态 | office Artifact 状态 | office 事件序列 | Task 联动 |
|---|---|---|---|
| open PR（已 ready，无 review） | `generated` | `task.created` + `artifact.created` | task `created` |
| draft PR | `draft` | `task.created` + `artifact.drafted` | task `created` |
| open + review requested（无 review 提交） | `under_review` | `task.created` + `artifact.created` + `artifact.review_requested` | task 保持 `created` |
| open + review APPROVED | `approved` | `…` + `artifact.reviewed`(verdict=approved) | task 保持 `created` |
| open + review CHANGES_REQUESTED | `revision_required` | `…` + `artifact.reviewed`(verdict=revision_required) | task `revision_required` |
| open + review COMMENTED | `generated`（保持） | `…`（无 artifact 事件，evidence 记录 COMMENTED） | 不变 |
| merged PR | `delivered` | `…` + `artifact.delivered`(mergeCommitSha) | task `completed` |
| closed unmerged | `rejected` | `…` + `artifact.reviewed`(verdict=rejected) | task `completed`（evidence 标记 closed-unmerged） |

## ID 映射规则

| GitHub 实体 | office ID | 说明 |
|---|---|---|
| Issue #N | `gh-issue-{N}` | taskId |
| PR #N 的 task | `gh-pr-task-{N}` | 承载 PR 工作的 task |
| PR #N 的 artifact | `gh-pr-{N}` | artifactId，artifact.taskId = `gh-pr-task-{N}` |

## 多 review 处理规则

- 每个 PR fixture 最多携带 1 条已提交 review（APPROVED / CHANGES_REQUESTED / COMMENTED 之一）
- `requestedReviewers` 字段表达"已请求但未提交"的 review
- 已提交 review 与 requestedReviewers 互斥：有已提交 review 时不发 `artifact.review_requested`
- 已提交 review 覆盖 requested 状态

## Closes #X / Refs #X 处理

PR body 中的 `Closes #X` / `Refs #X` 解析为关联 evidence（`GitHubSourceRef.refsIssueNumbers`），**不**直接触发 issue 的 close 事件或替代 acceptance criteria 判断。
```

- [ ] **Step 3: 创建 v0-limitations.md**

创建 `docs/integrations/github-adapter/v0-limitations.md`：

```markdown
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
```

- [ ] **Step 4: 提交**

```bash
git add docs/integrations/github-adapter/
git commit -m "docs(github-adapter): add v0 documentation" -m "README（目标/数据流/truth boundary）、mapping-table（完整 GitHub → office 映射表）、v0-limitations（为何不实现破坏性写操作 + 如何衔接 Command Gateway）。" -m "Refs #34"
```

---

## 完成验证

完成全部 11 个 Task 后，执行最终验证：

- [ ] **运行全量测试**

Run: `npx vitest run`
Expected: 全部测试通过，无失败。

- [ ] **运行 TypeScript 编译**

Run: `npx tsc -b`
Expected: 无错误退出。

- [ ] **验证无 Date.now() 污染**

Run: `npx vitest run packages/adapters/github/src/determinism.test.ts`
Expected: "无 Date.now() 污染"测试通过。

- [ ] **创建 PR**

PR 标题：`feat(adapters): GitHub Runtime Adapter v0 (#34)`

PR body 应包含：
- 全部 Acceptance Criteria 的实现与测试映射
- 测试通过证据
- `Closes #34`（若全部 AC 满足）
```<tool_call>TodoWrite<arg_key>todos</arg_key><arg_value>[{"content": "读取 spec 和关键源文件确认代码细节", "id": "1", "priority": "high", "status": "completed"}, {"content": "编写实现计划文档（plan header + file structure + TDD 任务分解）", "id": "2", "priority": "high", "status": "completed"}, {"content": "自审：spec 覆盖 / 占位符扫描 / 类型一致性", "id": "3", "priority": "high", "status": "in_progress"}, {"content": "提交 plan 文档并向用户提供执行选项", "id": "4", "priority": "high", "status": "pending"}]