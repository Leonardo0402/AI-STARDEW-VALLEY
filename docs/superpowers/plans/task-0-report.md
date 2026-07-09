# Task 0 报告：Current-state evidence cleanup

## 状态

DONE

## 提交

- `7bc21f8` — `docs(swarm-office): update gap-audit and annotation labels for Issue #25 Task 0`

## 修改文件

- `docs/design/swarm-office-v1.1/gap-audit.md`
  - 将 PR #24 之前的历史缺口移入 “Historical V1.0 → V1.1 delta” 表格。
  - 新增 “Current-state audit”：画布/面板联动选择、artifact 真实状态边界、多分辨率布局加固、选中/悬停状态截图缺失、mock adapter 无法触发真实 runtime failed/degraded。
  - 新增 “Accepted deviations” 明确说明 mock adapter 不能独立触发 genuine runtime failed / runtime-error / degraded 状态。
  - 规范截图路径为 `baseline/{1366x768,1440x900,1920x1080}/`，确认旧 flat `baseline/` 文件已清理。
  - 保留并校准 “V1.1 verification” 与当前代码一致。
- `scripts/generate-annotated-comparisons.mjs`
  - 8 个基线状态的标注文案全部替换为 Issue #25 当前缺口。
  - 仍以 1440×900 为源图。
- `docs/design/swarm-office-v1.1/annotated-comparisons/`
  - 重新生成了 8 张带标注 PNG 与对应 HTML。

## 验证结果

- `npm test`：58 个测试文件，598 个测试全部通过。
- `npm run build`：TypeScript 与 demo-office Vite 构建均通过（仅有大于 500kB chunk 的常规警告）。
- `node scripts/generate-annotated-comparisons.mjs`：8 张标注对比图全部成功生成，无字体/权限警告。

## 注意事项

- 本次任务仅修改文档与标注脚本，未触碰协议、reducer、LifeSimEngine、RuntimeSession 或 UI 组件逻辑。
- 未提交 `.superpowers/` 与 `docs/superpowers/plans/` 下的其他未跟踪计划文件；仅提交与 Task 0 直接相关的文件。
- 未执行 `git push`。
