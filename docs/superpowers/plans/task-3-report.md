# Task 3 报告：Visual QA hardening

## 状态

DONE

## 提交

- `1aee6ef` feat(scripts,design): capture selected states, assert dimensions, update gap-audit for Issue #25 Task 3
- `5d8d2ea` docs(superpowers): add Task 3 report for Issue #25

分支：`issue-25-swarm-office-follow-up`
范围：`1aee6ef^..5d8d2ea`

## 测试摘要

- `node scripts/capture-demo-office-screenshots.mjs`：通过，10 个状态 × 3 种分辨率全部捕获，所有截图均通过尺寸与水平溢出断言。
- `node scripts/generate-annotated-comparisons.mjs`：通过，生成 10 张带标注对比图。
- `npm test -- --run`：59 个测试文件，642 个测试全部通过。
- `npm run build`：通过，demo-office 生产构建成功。

## 已完成

1. 更新 `scripts/capture-demo-office-screenshots.mjs`
   - 保留原有 8 个状态。
   - 新增 `09-selected-agent`：点击 Agents 卡片，画布与卡片联动高亮。
   - 新增 `10-selected-task-card`：点击 Tasks 卡片，卡片与画布负责人联动高亮。
   - 每个 PNG 后断言：宽度等于视口宽度 × DPR，高度等于 `scrollHeight × DPR`，且 `scrollWidth <= clientWidth`（无水平溢出）。

2. 更新 `scripts/generate-annotated-comparisons.mjs`
   - 使用当前差距标签（linked selection、artifact truth、resolution hardening）。
   - 为 01–08 更新标注文案，反映已有进展。
   - 新增 09、10 的标注页面与图片。

3. 更新 `docs/design/swarm-office-v1.1/gap-audit.md`
   - 重写“Resolution pass”为实际执行结果。
   - 更新当前状态审计：多分辨率通过、agent/task 联动选择已基线化、剩余未捕获项。
   - 补充 09、10 到 re-captured states 表格。

4. 重新生成基线与标注图
   - `baseline/{1366x768,1440x900,1920x1080}/` 下 10 张 PNG。
   - `annotated-comparisons/` 下 10 张带标注 PNG 与 HTML。

## 跳过的状态及原因

以下状态因当前 `MockRuntimeAdapter` 无法真实产生而被跳过，未伪造：

1. `artifact metadata-only / unavailable / unsupported-open`
   - 原因：Mock 生成的 Artifact 始终带有 URI，且 `ARTIFACT_OPEN` 在 capability 中被标记为支持，没有真实路径产生 metadata-only、uri === null 或 unsupported-open 状态。

2. `runtime-degraded`
   - 原因：MockRuntimeAdapter 没有 API 或脚本场景能独立触发真正的 runtime/session degraded 状态。

3. `runtime-failed`
   - 原因：MockRuntimeAdapter 可产生 blocked agent/task 与 revision_required artifact，但无法独立触发真正的 runtime-failed / runtime-error 状态。

## 注意事项

- 未修改协议类型、reducer、LifeSimEngine、RuntimeSession 或后端传输层。
- 未伪造 Mock 无法真实产生的状态。
- 本次变更保持在 Issue #25 范围内，Refs #14。
- 未将无关的未跟踪文件（如其他 task 的 plan/report）加入提交。
