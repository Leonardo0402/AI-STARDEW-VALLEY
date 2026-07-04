import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite 配置 — demo-office 应用。
 *
 * 由于所有 workspace 包都以源码形式消费（main 指向 src/index.ts），
 * Vite 直接编译 TS 源码，无需预构建。
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  // 让 workspace 包被 Vite 处理（不预构建）
  optimizeDeps: {
    exclude: [
      "@agent-office/protocol",
      "@agent-office/core",
      "@agent-office/adapter-mock",
      "@agent-office/adapter-http-sse",
      "@agent-office/pixel-office",
      "@agent-office/control-ui",
    ],
  },
});
