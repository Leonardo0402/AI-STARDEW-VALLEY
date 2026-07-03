/**
 * demo-office 入口。
 *
 * 装配：
 * - MockRuntimeAdapter（模拟 Runtime）
 * - SnapshotStore（checkpoint 感知 + 事件去重 + 序号校验）
 * - CommandGateway（命令校验 + 路由）
 * - RuntimeSession（拥有 bootstrap / 订阅 / gap 恢复 / 断开生命周期）
 * - useOfficeState（React Hook 订阅 Store + Session）
 * - PixelOfficeScene（PixiJS 渲染层）
 * - ControlPanel（React DOM 控制面板）
 *
 * 数据流：
 *   UI → CommandGateway → MockRuntimeAdapter → DomainEvent
 *      → RuntimeSession.handleEvent → SnapshotStore → OfficeProjection → UI
 *
 * RuntimeSession 在模块级创建（单例），React StrictMode mount/unmount 不会重建 session，
 * 也不会产生重复 adapter 订阅。Pixel 视图卸载不影响 session 连接。
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import { SnapshotStore, CommandGateway, RuntimeSession } from "@agent-office/core";
import { App } from "./App.js";
import { DemoControls } from "./DemoControls.js";

// ─── 装配运行时（模块级单例）──────────────────────────────────
const RUNTIME_ID = "mock-runtime-001";
const adapter = new MockRuntimeAdapter({ eventDelayMs: 250 });
const store = new SnapshotStore(RUNTIME_ID);
const gateway = new CommandGateway(adapter);
const session = new RuntimeSession(adapter, store, gateway);

// 启动会话：connect → snapshot checkpoint → subscribe(afterSequence)
// bootstrap 完全由 session 拥有，React 不再重复实现。
session.connect().catch((err) => {
  console.error("[demo-office] RuntimeSession 启动失败：", err);
});

// ─── 渲染 ────────────────────────────────────────────────────
const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App
      session={session}
      store={store}
      gateway={gateway}
      runtimeId={RUNTIME_ID}
      demoControls={<DemoControls adapter={adapter} store={store} session={session} />}
    />
  </React.StrictMode>
);
