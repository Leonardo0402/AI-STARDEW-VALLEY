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
