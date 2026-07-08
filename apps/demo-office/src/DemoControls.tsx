/**
 * DemoControls — 演示脚本控制。
 *
 * 此组件属于 demo-office（演示装配层），不属于 control-ui 包。
 * 它直接持有 MockRuntimeAdapter 引用，调用 Mock 专用的脚本方法。
 * control-ui 包中的 ControlPanel 不依赖任何 Mock 专用方法。
 *
 * 这里的操作（playNormalFlow / reset / replay 等）是演示辅助工具，
 * 不是通过 Command Gateway 发出的业务命令，因此不经过 Policy 校验。
 * 在真实 Runtime 接入后，这些按钮将被移除或替换为 Runtime 管理操作。
 */
import type { FC } from "react";
import type { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import type { SnapshotStore, RuntimeSession } from "@agent-office/core";

interface DemoControlsProps {
  adapter: MockRuntimeAdapter;
  store: SnapshotStore;
  session: RuntimeSession;
  /** Called after the adapter and store have been reset. */
  onReset?: () => void;
}

export const DemoControls: FC<DemoControlsProps> = ({ adapter, store, session, onReset }) => {
  const handleReset = () => {
    adapter.reset();
    store.reset();
    onReset?.();
    // 重新安装 checkpoint 并恢复订阅（由 session 统一管理）
    session.resynchronize().catch((err) => {
      console.error("[DemoControls] resynchronize 失败：", err);
    });
  };

  const handleReplay = () => {
    store.rebuildFromLog();
  };

  return (
    <div className="demo-controls panel-card">
      <h3 className="demo-controls__title">运行演示（Mock 专用）</h3>
      <div className="demo-controls__row">
        <button className="demo-controls__btn" onClick={() => adapter.playNormalFlow()}>
          正常流程
        </button>
        <button className="demo-controls__btn" onClick={() => adapter.playErrorFlow()}>
          异常: 阻塞
        </button>
        <button className="demo-controls__btn" onClick={() => adapter.playRevisionFlow()}>
          异常: 返工
        </button>
        <button className="demo-controls__btn" onClick={() => adapter.playRuntimeFailureFlow()}>
          异常: 任务失败
        </button>
        <button className="demo-controls__btn" onClick={() => adapter.playRuntimeDegradedFlow()}>
          异常: 运行降级
        </button>
        <button className="demo-controls__btn" onClick={() => adapter.playArtifactUnavailableFlow()}>
          异常: 工件不可用
        </button>
        <button className="demo-controls__btn" onClick={() => adapter.playArtifactFailedOpenFlow()}>
          异常: 打开失败
        </button>
        <button className="demo-controls__btn" onClick={handleReset}>
          重置
        </button>
        <button className="demo-controls__btn" onClick={handleReplay}>
          回放事件
        </button>
      </div>
    </div>
  );
};
