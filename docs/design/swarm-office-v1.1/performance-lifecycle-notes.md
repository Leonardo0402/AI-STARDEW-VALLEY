# Swarm Office V1.1 — Performance / Lifecycle Evidence

> Scope: `apps/demo-office` shell, `packages/pixel-office` rendering layer.
> PR context: Issue #27 Task 3. Refs #14.

## 1. PixiJS 生命周期

### 1.1 创建与初始化

`packages/pixel-office/src/office-scene.ts` 中的 `PixelOfficeScene` 在构造函数中只创建空的 PixiJS `Application` 和分层 `Container`：

```ts
this.app = new Application();
this.contentRoot = new Container();
this.roomLayer = new Container();
// ...
this.contentRoot.addChild(this.roomLayer);
```

真正的 GPU/Canvas 初始化延迟到 `init(canvas)`：

```ts
await this.app.init({
  canvas,
  width: canvas.clientWidth || 800,
  height: canvas.clientHeight || 600,
  backgroundColor: 0x161418,
  antialias: false,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
});
```

设置：
- 背景色为设计系统的 `--base-900` 近似值 `#161418`。
- `antialias: false`：像素风场景不需要抗锯齿，降低 GPU 开销。
- `autoDensity: true` + `resolution: devicePixelRatio`：在高 DPR 屏上保持清晰，同时由 PixiJS 自动处理 canvas 像素密度。

### 1.2 React 集成与 StrictMode 安全

`apps/demo-office/src/App.tsx` 通过 `useEffect` 在 `view === "pixel"` 时创建场景：

```ts
const scene = new PixelOfficeScene(canvasRef.current, { reduceMotion });
sceneRef.current = scene;
// ...
scene.init(canvasRef.current).catch((err) => { ... });

return () => {
  scene.destroy();
  sceneRef.current = null;
};
```

清理函数保证 React StrictMode 的双调用不会泄漏：
- 第一次 mount 创建场景。
- unmount 时调用 `scene.destroy()`。
- 第二次 mount 时 `sceneRef.current` 已被清空，重新创建新实例。

`PixelOfficeScene.destroy()` 在 `init()` 异步完成前也可能被调用。为此 `destroy()` 设置 `this.destroyed = true`，并在 `init()` 返回后检查：

```ts
if (this.destroyed) {
  try { this.app.destroy({ removeView: false }); } catch { /* ignore */ }
  return;
}
```

`removeView: false` 保留 `<canvas>` DOM 元素，避免 React unmount 阶段因 DOM 已被移除而抛错。

### 1.3 ResizeObserver 生命周期

`init()` 中为 canvas 父元素创建 `ResizeObserver`：

```ts
this.resizeObserver = new ResizeObserver((entries) => {
  const rect = entries[0]?.contentRect ?? parent.getBoundingClientRect();
  this.fit(rect.width, rect.height);
});
this.resizeObserver.observe(parent);
```

`fit(width, height)` 以 800×600 设计尺寸为基准，等比缩放 `contentRoot` 并居中。

`destroy()` 中 `disconnect()` 并清空引用，防止组件卸载后继续触发 resize 回调。

### 1.4 分层渲染器生命周期

当 `useSpriteRenderer: true`（默认）时，`init()` 实例化：

- `RoomRenderer`
- `PropRenderer`
- `AgentRenderer`
- `EffectRenderer`

它们共享同一个 `AssetLoader` 实例，并在 `updateProjection()` 时按需重新渲染：

```ts
this.roomRenderer.render(layout);
this.propRenderer.render(layout, projection.pendingApprovals.length);
this.agentRenderer.render(projection.agents, layout, projection);
this.effectRenderer.render(projection, layout);
```

渲染器遵循“对象池”风格：
- `AgentRenderer` 的 `sprites` Map 复用现有 Container，仅在 agent 消失时移除。
- `EffectRenderer` 的 `blockedItems`、`sparkleItems`、`bellItems` 等数组复用 Graphics/Text 对象，通过 `hideExtras()` 隐藏多余项。

这种策略在 agent 数量波动时避免频繁创建/销毁 PixiJS 对象，降低 GC 压力。

## 2. Motion toggle

### 2.1 应用层状态

`App.tsx` 维护 `reduceMotion` 状态：

```ts
const [reduceMotion, setReduceMotion] = useState(false);
```

UI 按钮显示 “Motion on / Motion off”，并设置 `aria-pressed`：

```tsx
<button
  className={`icon-btn ${reduceMotion ? "icon-btn--active" : ""}`}
  aria-pressed={reduceMotion}
  onClick={() => setReduceMotion((v) => !v)}
>
  {reduceMotion ? "Motion off" : "Motion on"}
</button>
```

根节点 `.app-shell` 在 `reduceMotion` 为 true 时添加 `.reduce-motion` 类，CSS 将所有 `animation-duration` / `transition-duration` 压到 `0.001ms`。

### 2.2 场景层同步

`useEffect` 将状态同步到已存在的 `PixelOfficeScene`：

```ts
useEffect(() => {
  sceneRef.current?.setReduceMotion?.(reduceMotion);
}, [reduceMotion]);
```

`PixelOfficeScene.setReduceMotion(value)` 转发给 `AgentRenderer` 和 `EffectRenderer`；若开启 reduce motion，会重置精灵缩放和位置：

```ts
setReduceMotion(value: boolean): void {
  this.reduceMotion = value;
  this.agentRenderer?.setReduceMotion(value);
  this.effectRenderer?.setReduceMotion(value);
  if (value) {
    for (const sprite of this.agentSprites.values()) {
      sprite.container.scale.set(1, 1);
      sprite.container.y = sprite.currentY;
    }
  }
}
```

### 2.3 Reduced-motion 下的渲染行为

`EffectRenderer.render()` 在 reduce motion 模式下不推进相位计数器：

```ts
if (!this.reduceMotion) {
  this.bellPulsePhase = (this.bellPulsePhase + deltaMS) % BELL_PERIOD_MS;
  this.blockedPulsePhase = (this.blockedPulsePhase + deltaMS) % BLOCKED_PERIOD_MS;
  this.sparklePhase = (this.sparklePhase + deltaMS) % SPARKLE_PERIOD_MS;
}
```

脉冲值固定在中间值（`0.5`），视觉状态仍然存在，只是不再随时间动画。

`AgentRenderer` 同样跳过 idle breathe 和 walking interpolation 的逐帧更新。

### 2.4 媒体查询

`theme.css` 提供 `prefers-reduced-motion: reduce` 兜底，与显式切换类协同工作。

### 2.5 测试覆盖

- `apps/demo-office/src/accessibility.test.tsx`：验证切换 Motion 后 `.reduce-motion` 类与 `aria-pressed` 同步。
- `apps/demo-office/src/App.test.tsx`：验证切换 reduce motion 不会重建 `PixelOfficeScene`。
- `packages/pixel-office/src/__tests__/office-scene.test.ts`：验证 reduce motion 不每帧调用 `EffectRenderer.render()`。

## 3. Asset fallback

### 3.1 AssetLoader 容错加载

`packages/pixel-office/src/asset-loader.ts` 定义了 V1 资产列表（24 项），`loadAll()` 对每个资产单独 try/catch：

```ts
await Promise.all(
  assetNames.map(async (name) => {
    try {
      const url = `${this.basePath}${name}.png`;
      const texture = await Assets.load(url);
      this.textures.set(textureName(name), texture);
      this.loaded++;
    } catch {
      this.failed.push(textureName(name));
    }
  })
);
```

单个资产失败不会阻断整个初始化流程。`getTexture(name)` 在缺失时返回 `null`。

### 3.2 渲染器程序化回退

`AgentRenderer.applyVisual()` 在纹理缺失时绘制程序化角色轮廓：

```ts
const texture = this.assetLoader?.getTexture(textureName) ?? null;
if (texture) {
  // 使用精灵纹理
} else {
  // Fallback: procedural silhouette
  this.setBodyGraphics(sprite, sprite.treatment, visualState, agent);
}
```

`EffectRenderer` 中的 bell、blocked marker、sparkle 同样在未加载纹理时使用 `Graphics` 绘制几何图形。

### 3.3 失败列表用于诊断

`AssetLoader.getProgress()` 返回 `{ loaded, total, failed }`。当前演示未在 UI 中展示失败列表，但 API 已暴露，可用于未来在 StatusStrip 或调试面板中提示资产加载问题。

### 3.4 测试覆盖

- `packages/pixel-office/src/__tests__/asset-loader.test.ts`：验证加载失败项被记录到 `failed` 数组。
- `packages/pixel-office/src/__tests__/agent-renderer-sprites.test.ts`：验证纹理缺失时回退到 `Graphics`。

## 4. 代表性负载（4 / 12 / 30 agents）

### 4.1 布局与定位策略

`packages/pixel-office/src/layout.ts` 中的 `getAgentPositionByRoomId` 使用基于 seed 的确定性哈希偏移：

```ts
const hash = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
const offsetX = (hash * 2 - 1) * (room.width * 0.25);
const offsetY = (Math.abs(Math.cos(seed * 78.233)) * 2 - 1) * (room.height * 0.25);
return { x: cx + offsetX, y: cy + offsetY };
```

同一房间内的多个 agent 会被分散到房间中心 ±25% 的椭圆区域内，避免完全重叠。

### 4.2 渲染稳定性

`AgentRenderer.render()` 对 agent 数量是 O(N) 的：
- 遍历现有 sprites 删除已消失的 agent。
- 遍历当前 agents，创建缺失的 sprite 或更新现有 sprite。

`EffectRenderer.render()` 也是 O(N)：
- 分别过滤 `failedAgents`、`blockedAgents`、`workingAgents`。
- 复用 `EffectItem` 对象池。

### 4.3 负载实测结论

我们在单元测试中验证 4 / 12 / 30 个 agent 的投影可以稳定渲染而不抛错：

| Agent 数 | 房间分布 | 观察 |
|---|---|---|
| 4 | 每房间 1 个 | 正常分布，无重叠问题。 |
| 12 | 每房间 3 个 | 轻微聚集，但角色标签可读。 |
| 30 | 每房间 7–8 个 | 超出 V1 四房间布局设计意图，角色会明显重叠；`AgentRenderer` 与 `EffectRenderer` 不抛错，动画仍按 reduce-motion 设置运行。 |

> 注意：30 agents 是压力测试，不是 V1.1 的目标工作负载。V1.1 设计目标是 4–12 个活跃 agent。

### 4.4 负载测试

新增/补充测试见 `packages/pixel-office/src/__tests__/office-scene.test.ts`：

- `renders 4/12/30 agent projections without throwing`：验证不同负载下 `updateProjection` 和 `update(ticker)` 不抛错，sprite 数量正确。
- 配合 `reduceMotion: true` 验证高负载下不触发逐帧 effect 动画。

## 5. 已知限制

- 未实现 GPU 内存上限保护：大量纹理同时驻留时依赖浏览器/PixiJS 的纹理管理。
- 未实现对象数量硬上限：30+ agents 时标签重叠是已知问题，但 renderer 不会崩溃。
- 未做真实 FPS 基准测试：当前仅做稳定性测试；真实帧率受设备 GPU 和 DPR 影响。
- 未做长时间运行内存泄漏测试：单元测试覆盖 destroy 清理，但无法完全模拟数小时运行。

## 6. 相关文件

- `packages/pixel-office/src/office-scene.ts`
- `packages/pixel-office/src/renderer/agent-renderer.ts`
- `packages/pixel-office/src/renderer/effect-renderer.ts`
- `packages/pixel-office/src/renderer/room-renderer.ts`
- `packages/pixel-office/src/renderer/prop-renderer.ts`
- `packages/pixel-office/src/asset-loader.ts`
- `packages/pixel-office/src/layout.ts`
- `packages/pixel-office/src/__tests__/office-scene.test.ts`
- `packages/pixel-office/src/__tests__/asset-loader.test.ts`
- `packages/pixel-office/src/__tests__/agent-renderer-sprites.test.ts`
- `apps/demo-office/src/App.tsx`
- `apps/demo-office/src/App.test.tsx`
- `apps/demo-office/src/accessibility.test.tsx`
- `apps/demo-office/src/theme.css`
