/**
 * Command Gateway — 命令网关。
 *
 * 核心链路：
 * UI Action → Gateway（校验幂等） → Policy Validation → Runtime Adapter.execute()
 *
 * Gateway 不直接修改 Snapshot。所有状态变更通过 Adapter 产生事件，
 * 事件回到 SnapshotStore.applyEvent。
 */
import type {
  OfficeCommand,
  CommandResult,
  RuntimeAdapter,
  RuntimeSnapshot,
} from "@agent-office/protocol";
import { evaluateCommand, rejectedResult } from "./policy.js";

export class CommandGateway {
  private adapter: RuntimeAdapter;
  private pendingCommands = new Set<string>();
  private lastSnapshot: RuntimeSnapshot | null = null;

  constructor(adapter: RuntimeAdapter) {
    this.adapter = adapter;
  }

  /** 更新 Gateway 持有的 snapshot 副本（用于 Policy 校验） */
  updateSnapshot(snapshot: RuntimeSnapshot): void {
    this.lastSnapshot = structuredClone(snapshot);
  }

  /** 发送命令到 Adapter */
  async execute(command: OfficeCommand): Promise<CommandResult> {
    // 幂等校验：同一 commandId 不重复执行
    if (this.pendingCommands.has(command.commandId)) {
      return {
        commandId: command.commandId,
        status: "rejected",
        error: { code: "DUPLICATE_COMMAND", message: "Command already pending" },
        affectedEventIds: [],
      };
    }

    // 检查 Adapter 是否支持此命令
    const caps = this.adapter.getCapabilities();
    if (!caps.supportedCommands.includes(command.commandType)) {
      return {
        commandId: command.commandId,
        status: "rejected",
        error: {
          code: "UNSUPPORTED_COMMAND",
          message: `Command ${command.commandType} not supported by adapter`,
        },
        affectedEventIds: [],
      };
    }

    // Policy 校验
    if (this.lastSnapshot) {
      const decision = evaluateCommand(command, this.lastSnapshot);
      if (!decision.allowed) {
        return rejectedResult(command.commandId, decision.reason ?? "Policy denied");
      }
    }

    this.pendingCommands.add(command.commandId);
    try {
      const result = await this.adapter.execute(command);
      return result;
    } finally {
      this.pendingCommands.delete(command.commandId);
    }
  }

  /** 获取 Adapter capabilities */
  getCapabilities() {
    return this.adapter.getCapabilities();
  }
}
