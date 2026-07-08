# Issue #14 — Phase 3: Swarm Office V1.1 Closure Audit

> Scope: `apps/demo-office` visual/UX evidence pass for Swarm Office V1.1.
> PR context: Issue #27 Task 4. Refs #14.

## 1. #14 验收标准原文

来自 [`docs/superpowers/plans/2026-07-07-issue-14-phase3-swarm-office-v1.1.md`](../../superpowers/plans/2026-07-07-issue-14-phase3-swarm-office-v1.1.md)：

| # | 标准 |
|---|---|
| A | 所有 8 个必要状态都被捕获为 baseline 截图。 |
| B | 每个 baseline 都有对应的 annotated comparison。 |
| C | `gap-audit.md` 包含一份已排优先级、可执行的缺口清单。 |
| D | 创建 PR，附上设计产物和实现计划。 |

## 2. 证据映射

### 2.1 必要状态截图（baseline）

原始 8 个状态 + Issue #27 真实状态扩展，统一使用 3 分辨率 canonical set：

| 状态 | Baseline 路径（示例 1440×900） | 说明 |
|---|---|---|
| 01 Idle office | `baseline/1440x900/01-idle-office.png` | 默认 Pixel view，非白屏 |
| 02 Active task execution | `baseline/1440x900/02-active-task-execution.png` | 正常流程触发 |
| 03 Artifact under review | `baseline/1440x900/03-artifact-under-review.png` | 审查中 artifact |
| 04 Pending approval | `baseline/1440x900/04-pending-approval.png` | 待审批 + 服务铃提示 |
| 05 Blocked task / agent | `baseline/1440x900/05-blocked-task-agent.png` | 阻塞状态 |
| 06 Revision / rework required | `baseline/1440x900/06-revision-required.png` | 返工场景 |
| 07 Focus mode | `baseline/1440x900/07-focus-mode.png` | 专注模式 |
| 08 Debrief mode | `baseline/1440x900/08-debrief-mode.png` | 会话总结 |
| 09 Selected agent | `baseline/1440x900/09-selected-agent.png` | 画布/面板双向选中 |
| 10 Selected task card | `baseline/1440x900/10-selected-task-card.png` | 任务卡片联动 |
| 11 Runtime failed | `baseline/1440x900/11-runtime-failed.png` | #27 Task 0 真实失败状态 |
| 12 Artifact unavailable | `baseline/1440x900/12-artifact-unavailable.png` | `uri: null` 真实产物 |
| 13 Artifact failed open | `baseline/1440x900/13-artifact-failed-open.png` | 打开失败真实产物 |
| 14 Artifact unsupported open | `baseline/1440x900/14-artifact-unsupported-open.png` | MIME 类型不支持 |

完整三分辨率目录：

- `docs/design/swarm-office-v1.1/baseline/1366x768/`
- `docs/design/swarm-office-v1.1/baseline/1440x900/`
- `docs/design/swarm-office-v1.1/baseline/1920x1080/`

### 2.2 Annotated comparisons

每个状态对应一份标注图：

- `docs/design/swarm-office-v1.1/annotated-comparisons/01-idle-office-annotated.png`
- ... 至 `14-artifact-unsupported-open-annotated.png`

生成命令：

```bash
node scripts/generate-annotated-comparisons.mjs
```

### 2.3 Gap audit

- 文件：`docs/design/swarm-office-v1.1/gap-audit.md`
- 包含：历史 V1.0 → V1.1 已解决缺口、当前状态缺口、跳过的不可达状态及原因、分辨率验证表。
- 关键结论：
  - 原始 8 个状态均已基线化。
  - 不可真实产生的状态已明确跳过：`metadata-only` artifact、`persistent runtime-degraded`。

### 2.4 相关 PR

| PR | 作用 | 与 #14 关系 |
|---|---|---|
| #24 | Swarm Office V1.1 视觉/交互升级首次实现 | 实现 #14 提出的升级计划 |
| #25 | 关联选中、artifact 真实状态、多分辨率视觉 QA 加固 | 继续 #14 交互硬化 |
| #28 | 修复默认 Pixel view 白屏，增加回归断言 | 保证默认启动即可渲染 |
| #27（本 PR） | 真实失败状态、 accessibility / performance 证据、#14 关闭审计 | 最终验收 #14 |

## 3. 逐项 verdict

| 标准 | 状态 | 理由 |
|---|---|---|
| A — 8 个必要状态 baseline 截图 | **已满足** | 01–08 全部捕获，且 #27 扩展到 14 个真实状态，每状态 3 分辨率。 |
| B — 每个 baseline 有 annotated comparison | **已满足** | 01–14 均生成 annotated comparison。 |
| C — `gap-audit.md` 有可执行缺口清单 | **已满足** | `gap-audit.md` 列出当前缺口、优先级、跳过原因和分辨率验证。 |
| D — 创建 PR 附设计产物和实现计划 | **已满足** | #24 已合并实现升级；#25/#27/#28 继续交付并修复问题。 |

## 4. 总体 verdict

**关闭 #14。**

Swarm Office V1.1 的视觉/UX evidence pass 已完成：

- 所有原始 8 个状态均已 baseline 化并生成 annotated comparison。
- `gap-audit.md` 记录了已解决和剩余的缺口。
- 实现计划已通过 #24 落地，后续 #25、#28、#27 进一步完成交互硬化、白屏修复和真实状态扩展。
- 剩余未解决的缺口（如 canvas 键盘访问、aria-live 区域）已在 `accessibility-notes.md` 和 `gap-audit.md` 中明确列出，不影响 #14 的验收范围。

## 5. 验证命令

```bash
npm test              # 668/668 passed
npm run build         # success
node scripts/capture-demo-office-screenshots.mjs   # 14 states × 3 resolutions
node scripts/generate-annotated-comparisons.mjs    # 14 annotated comparisons
```

## 6. 相关文件

- `docs/design/swarm-office-v1.1/gap-audit.md`
- `docs/design/swarm-office-v1.1/accessibility-notes.md`
- `docs/design/swarm-office-v1.1/performance-lifecycle-notes.md`
- `docs/design/swarm-office-v1.1/issue-14-closure-audit.md`
- `scripts/capture-demo-office-screenshots.mjs`
- `scripts/generate-annotated-comparisons.mjs`
- `apps/demo-office/src/integration.test.ts`
