/**
 * demo-office 入口。
 *
 * 装配：
 * - MockRuntimeAdapter（模拟 Runtime）
 * - SnapshotStore（Snapshot + 事件去重 + 序号校验）
 * - CommandGateway（命令校验 + 路由）
 * - useOfficeState（React Hook 订阅 Store）
 * - PixelOfficeScene（PixiJS 渲染层）
 * - ControlPanel（React DOM 控制面板）
 *
 * 数据流：
 * UI → CommandGateway → MockRuntimeAdapter → DomainEvent
 *    → SnapshotStore → OfficeProjection → UI
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import { SnapshotStore, CommandGateway } from "@agent-office/core";
import { App } from "./App.js";
import { DemoControls } from "./DemoControls.js";

// ─── 装配运行时 ──────────────────────────────────────────────
const RUNTIME_ID = "mock-runtime-001";
const adapter = new MockRuntimeAdapter({ eventDelayMs: 250 });
const store = new SnapshotStore(RUNTIME_ID);
const gateway = new CommandGateway(adapter);

// 启动连接（Mock 是同步的，但接口要求 Promise）
adapter.connect().then(() => {
  return adapter.getSnapshot();
}).then((snap) => {
  store.setSnapshot(snap);
  gateway.updateSnapshot(snap);
}).catch((err) => {
  console.error("[demo-office] Adapter 初始化失败：", err);
});

// ─── 渲染 ────────────────────────────────────────────────────
const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App
      adapter={adapter}
      store={store}
      gateway={gateway}
      runtimeId={RUNTIME_ID}
      demoControls={<DemoControls adapter={adapter} store={store} />}
    />
  </React.StrictMode>
);
