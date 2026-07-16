# demo-office Runbook

本文档描述如何配置、启动、截图验证与排错 `apps/demo-office` 的 Office UI 集成环境。

## 1. GitHub mode 配置

`demo-office` 支持三种运行时模式：`mock`（默认）、`http-sse`、`github`。要使用 GitHub 作为运行时数据源：

1. 复制 `apps/demo-office/.env.example` 为 `apps/demo-office/.env.local`。
2. 设置以下变量：

```bash
VITE_RUNTIME_MODE=github
VITE_RUNTIME_ID=github-runtime-001
VITE_GITHUB_OWNER=your-org
VITE_GITHUB_REPO=your-repo
VITE_GITHUB_TOKEN=ghp_xxxxxxxx
```

| 变量 | 说明 |
|------|------|
| `VITE_RUNTIME_MODE` | 必须为 `github`。 |
| `VITE_RUNTIME_ID` | 运行时标识符，必填。 |
| `VITE_GITHUB_OWNER` | GitHub 仓库所有者。缺少时仅支持本地命令，网络写命令会被拒绝。 |
| `VITE_GITHUB_REPO` | GitHub 仓库名。缺少时仅支持本地命令。 |
| `VITE_GITHUB_TOKEN` | GitHub Personal Access Token。仅在使用网络写命令（如 `issue.add_comment`、`pr.request_review` 等）时需要。 |

启动命令：

```bash
npm run dev --workspace=apps/demo-office
```

或：

```bash
VITE_RUNTIME_MODE=github VITE_RUNTIME_ID=github-runtime-001 VITE_GITHUB_OWNER=your-org VITE_GITHUB_REPO=your-repo npm run dev:ui
```

> 注意：`GitHubRuntimeAdapter` 在 v0 阶段默认是只读投影源。`AgentReviewOrchestrator` 包装后支持本地评审命令；需要网络写命令时，必须配置 `VITE_GITHUB_OWNER`、`VITE_GITHUB_REPO` 和 `VITE_GITHUB_TOKEN`。

## 2. LifeSim 同源配置

`VITE_LIFE_SIM_BASE_URL` 控制 LifeSim HTTP 客户端请求的基地址。`apps/demo-office/.env.example` 中的默认值为：

```bash
VITE_LIFE_SIM_BASE_URL=/
```

这表示使用**同源根路径**。Vite 开发插件 `createLifeSimDevPlugin("default")` 会在 Vite dev server 上挂载 LifeSim 路由：

```
/life-sim/default/snapshot
/life-sim/default/command
/life-sim/default/events
```

LifeSim 客户端会把 `/life-sim/default/...` 拼接到 `VITE_LIFE_SIM_BASE_URL` 后，因此 `VITE_LIFE_SIM_BASE_URL=/` 会命中 Vite 插件托管的端点，无需额外启动 LifeSim 服务。

**仅在以下场景才需要覆盖：**

- 你单独启动了独立的 LifeSim 服务器（例如 `http://localhost:3001`）。
- Vite dev server 与 LifeSim 不在同一端口/进程。

覆盖示例：

```bash
VITE_LIFE_SIM_BASE_URL=http://localhost:3001 npm run dev:ui
```

> 如果环境变量未设置，代码会回退到 `http://localhost:3001`；但推荐通过 `.env.local` 显式指定，避免与 `.env.example` 的默认值不一致。

## 3. Screenshot Gate

Screenshot Gate 用于生成 Issue #49 集成 UI 的基线截图与标注对比图。

### 前置条件

- Node.js 22
- 已执行 `npm install`
- 已安装 Playwright Chromium：

```bash
npx playwright install chromium
```

- Vite dev server 已启动并运行在 `http://localhost:5173/`（默认）。

### 生成基线截图

从仓库根目录执行：

```bash
node apps/demo-office/scripts/capture-demo-office-screenshots.mjs
```

可通过环境变量指定应用地址：

```bash
DEMO_OFFICE_URL=http://localhost:5173/ node apps/demo-office/scripts/capture-demo-office-screenshots.mjs
```

也可指定输出目录：

```bash
node apps/demo-office/scripts/capture-demo-office-screenshots.mjs ./my-baseline
```

**生成内容：**

- 目录：`docs/design/swarm-office-v1.1/baseline/{1366x768,1440x900,1920x1080}/`
- 每个分辨率下 18 张 PNG 基线：
  - `01-idle-office.png` ~ `18-timeline-visible.png`
- 每张截图会自动校验：
  - 无横向溢出（`scrollWidth <= clientWidth`）
  - PNG 像素尺寸等于 `viewport × devicePixelRatio`
  - `01-idle-office` 的 canvas 非空白（像素变化量 `variation >= 100`）

### 生成标注对比图

基线截图生成后，执行：

```bash
node apps/demo-office/scripts/generate-annotated-comparisons.mjs
```

**生成内容：**

- 目录：`docs/design/swarm-office-v1.1/annotated-comparisons/`
- 每个状态一张 HTML 和一张 PNG：
  - `{name}.html`
  - `{name}-annotated.png`
- 标注覆盖 15~18 号状态：QueuePanel、ReviewBlocker、EvidencePanel、TimelinePanel，以及对应的 Canvas 道具（Mission Board、Review Desk、Filing Cabinet、Wall Scroll）。

> 标注脚本默认读取 `docs/design/swarm-office-v1.1/baseline/1440x900/` 下的截图，因此必须先跑完 capture 脚本。

## 4. 视觉审查

生成截图后，按以下清单审查：

### 基线截图审查

1. 打开 `docs/design/swarm-office-v1.1/baseline/1440x900/`（或 1366×768 / 1920×1080）。
2. 逐张检查 18 个状态：
   - 布局无截断、无横向滚动条。
   - 文字、徽章、按钮对齐正常。
   - 15~18 号状态中，QueuePanel、ReviewBlocker、EvidencePanel、TimelinePanel 可见且数据正确。
   - Canvas 道具（Mission Board、Review Desk、Filing Cabinet、Wall Scroll）出现时机与状态描述一致。

### 标注对比图审查

1. 打开 `docs/design/swarm-office-v1.1/annotated-comparisons/` 下的 HTML 或 `-annotated.png`。
2. 核对每条标注：
   - 是否指向正确的 UI 组件或 Canvas 区域。
   - 文字说明是否与当前实现一致。
   - 标注不遮挡关键信息。

### Runtime Truth 一致性检查

- 所有截图中的 Issue/PR、评审、审计记录、时间线事件必须能追溯到 `RuntimeSnapshot` 或 `IntegrationProjection`。
- 不允许出现 mock adapter 无法真实产生的状态（如 metadata-only artifact、persistent runtime-degraded），这些状态在 capture 脚本中会被显式跳过并打印 `Skipped state`。

### 风格一致性检查

- 像素风配色、字体、边框圆角与 `packages/pixel-office` 设计系统一致。
- 选中态（selected agent / selected task card）在所有分辨率下可见。
- 错误态（failed、blocked、revision_required）的视觉样式互不混淆。

## 5. 常见启动失败

### 缺少环境变量

**现象：** 浏览器页面显示 `demo-office startup error`。

**处理：**

- `VITE_RUNTIME_ID is required` → 设置 `VITE_RUNTIME_ID`。
- `VITE_RUNTIME_BASE_URL is required when VITE_RUNTIME_MODE=http-sse` → http-sse 模式下必须设置 `VITE_RUNTIME_BASE_URL`。
- GitHub 模式下缺少 `VITE_GITHUB_OWNER` / `VITE_GITHUB_REPO` → 控制台会警告，仅支持本地命令；需要网络写命令时补全。

### LifeSim URL 不匹配

**现象：** `LifeSimSession bootstrap failed` 或 `Snapshot fetch failed: HTTP 404`。

**处理：**

- 确认 `VITE_LIFE_SIM_BASE_URL`：
  - 使用 Vite 插件时保持 `/`。
  - 使用独立 LifeSim 服务器时改为对应地址（如 `http://localhost:3001`）。
- 检查 Vite dev server 是否正常启动，端口是否为 5173。

### 端口冲突

**现象：** `Port 5173 is already in use` 或运行时无法连接。

**处理：**

- Vite 默认端口 5173，QClaw runtime 默认 3456，独立 LifeSim 默认 3001。
- 修改 Vite 端口时，同步调整 `.env.local` 中的 `VITE_RUNTIME_BASE_URL` 和 `--allowed-origins`。

### Playwright / Vite 超时

**现象：** 截图脚本在某些分辨率下失败，或 canvas 检测为空白。

**处理：**

- 低配置机器上，首次启动 Vite 编译较慢，可先运行 `npm run dev` 预热。
- 截图脚本使用固定等待时间，若机器较慢可临时调高脚本中的 `sleep` 值。
- 确保 Playwright 使用 SwiftShader 软件渲染，**不要** 传递 `--disable-gpu` 或 `--disable-software-rasterizer`（capture 脚本已避免）。
- 若 18 个状态一次性跑不完，可临时修改脚本只跑单个分辨率做快速验证。

## 6. Runtime Truth 验证步骤

Runtime Truth 指：UI 上展示的 Issue/PR、评审、审计、时间线等数据必须能从 `RuntimeSnapshot` / `IntegrationProjection` 推导出来，不能凭空伪造。

### 运行相关测试

```bash
# 1. Runtime Truth production chain（最核心的生产链路验证）
#    GitHub fixtures -> adapter -> orchestrator -> snapshot -> IntegrationProjection
npx vitest run packages/control-ui/src/integration/runtime-truth-production.test.ts

# 2. Runtime Truth 核心：验证 useIntegrationState 不调用外部 API，且 projection 完全来自 snapshot
npx vitest run packages/control-ui/src/integration/runtime-truth.test.ts

# 3. projection 集成：验证 IntegrationProjectionProvider 与普通 adapter 的投影行为
npx vitest run packages/control-ui/src/integration/projection.test.ts

# 4. github 模式运行时工厂：验证 mode=github 返回 AgentReviewOrchestrator
npx vitest run apps/demo-office/src/runtime/create-runtime.test.ts

# 5. 完整事件链路：命令 -> gateway -> adapter -> event -> snapshot -> projection
npx vitest run apps/demo-office/src/integration.test.ts

# 6. 远程 golden flow：http-sse 模式下连接 QClaw test runtime 并完成端到端流程
npx vitest run apps/demo-office/src/remote-golden-flow.test.ts
```

也可直接运行全部测试：

```bash
npm test
```

### 各测试断言要点

| 测试文件 | 断言内容 |
|----------|----------|
| `runtime-truth-production.test.ts` | GitHub fixtures 经 `GitHubRuntimeAdapter` → `AgentReviewOrchestrator` → `SnapshotStore` → `IntegrationProjection` 的完整链路正确；`REVIEW_ASSIGN` / `REVIEW_SUBMIT` / `REVIEW_APPROVE` / `REVIEW_REJECT` 的评审生命周期反映到 projection；每个 UI 项都能追溯到 snapshot task/artifact、adapter evidence 或 runtime event；无 reducer error、无 phantom item。 |
| `runtime-truth.test.ts` | `useIntegrationState` 渲染期间不调用 `fetch`；`IntegrationProjection` 完全由 `RuntimeSnapshot` 推导；每个 GitHub 字段都能映射到 snapshot 的对应字段。 |
| `projection.test.ts` | 实现 `IntegrationProjectionProvider` 的 adapter 返回其投影；普通 adapter 返回空投影，UI 可优雅降级。 |
| `create-runtime.test.ts` | `mode: "github"` 构造 `AgentReviewOrchestrator`；`mode: "mock"` 构造 `MockRuntimeAdapter`；`dispose()` 幂等地断开 session。 |
| `integration.test.ts` | `TASK_CREATE` 命令经 gateway 产生事件并更新 snapshot；正常流程、拒绝审批、返工流程均能在 snapshot/projection 中反映；replay 后事件可重建状态；UI 取消订阅不影响 runtime 工作。 |
| `remote-golden-flow.test.ts` | `createRuntime(http-sse)` 连接 QClaw test runtime；golden flow 完成后任务完成、artifact approved、approval approved；projection 管道正常；dispose 后 session 断开。 |

### 截图脚本自身的单元测试

```bash
node --test apps/demo-office/scripts/capture-demo-office-screenshots.test.mjs
node --test apps/demo-office/scripts/generate-annotated-comparisons.test.mjs
node --test apps/demo-office/scripts/screenshot-helpers.test.mjs
```

这些测试断言：

- `getIntegrationScenario` 返回符合 `IntegrationProjection` 形状的 mock 数据。
- `ANNOTATIONS` 覆盖 15~18 号状态、四个面板、四个 Canvas 道具。
- `buildHtml` 生成合法 HTML 并包含标注 SVG。

## 参考

- `apps/demo-office/.env.example`
- `apps/demo-office/src/runtime/config.ts`
- `apps/demo-office/src/runtime/create-runtime.ts`
- `apps/demo-office/src/life-sim-server.ts`
- `apps/demo-office/scripts/capture-demo-office-screenshots.mjs`
- `apps/demo-office/scripts/generate-annotated-comparisons.mjs`
- `docs/integrations/github-adapter/README.md`
