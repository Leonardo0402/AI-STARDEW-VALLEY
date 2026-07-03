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
import type { SnapshotStore } from "@agent-office/core";

interface DemoControlsProps {
  adapter: MockRuntimeAdapter;
  store: SnapshotStore;
}

export const DemoControls: FC<DemoControlsProps> = ({ adapter, store }) => {
  const handleReset = () => {
    adapter.reset();
    store.reset();
    adapter.getSnapshot().then((snap) => {
      store.setSnapshot(snap);
    });
  };

  const handleReplay = () => {
    store.rebuildFromLog();
  };

  return (
    <div style={styles.section}>
      <h3 style={styles.h3}>运行演示（Mock 专用）</h3>
      <div style={styles.buttonRow}>
        <button style={styles.button} onClick={() => adapter.playNormalFlow()}>
          正常流程
        </button>
        <button style={styles.button} onClick={() => adapter.playErrorFlow()}>
          异常: 阻塞
        </button>
        <button style={styles.button} onClick={() => adapter.playRevisionFlow()}>
          异常: 返工
        </button>
        <button style={styles.button} onClick={handleReset}>
          重置
        </button>
        <button style={styles.button} onClick={handleReplay}>
          回放事件
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  section: {
    borderBottom: "1px solid #333",
    paddingBottom: 12,
  },
  h3: {
    margin: "0 0 8px 0",
    fontSize: 14,
    color: "#88ccff",
  },
  buttonRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
    marginTop: 6,
  },
  button: {
    padding: "4px 12px",
    backgroundColor: "#333355",
    color: "#cccccc",
    border: "1px solid #555577",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "monospace",
  },
};
