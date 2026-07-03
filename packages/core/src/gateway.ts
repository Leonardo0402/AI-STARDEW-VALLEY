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

/** 已完成命令结果的 LRU 缓存上限 */
const COMPLETED_CACHE_MAX = 1000;

export class CommandGateway {
  private adapter: RuntimeAdapter;
  private pendingCommands = new Set<string>();
  private completedResults = new Map<string, CommandResult>();
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
    // 幂等校验 1：同一 commandId 正在执行中（pending duplicate）
    if (this.pendingCommands.has(command.commandId)) {
      return {
        commandId: command.commandId,
        status: "rejected",
        error: { code: "DUPLICATE_COMMAND", message: "Command already pending" },
        affectedEventIds: [],
      };
    }

    // 幂等校验 2：同一 commandId 已完成（completed duplicate），直接返回原结果，不调用 Adapter
    const cached = this.completedResults.get(command.commandId);
    if (cached) {
      // LRU 刷新：删除再重新插入，使其成为最新
      this.completedResults.delete(command.commandId);
      this.completedResults.set(command.commandId, cached);
      return cached;
    }

    // 检查 Adapter 是否支持此命令
    const caps = this.adapter.getCapabilities();
    if (!caps.supportedCommands.includes(command.commandType)) {
      const result: CommandResult = {
        commandId: command.commandId,
        status: "rejected",
        error: {
          code: "UNSUPPORTED_COMMAND",
          message: `Command ${command.commandType} not supported by adapter`,
        },
        affectedEventIds: [],
      };
      this.cacheResult(result);
      return result;
    }

    // Policy 校验
    if (this.lastSnapshot) {
      const decision = evaluateCommand(command, this.lastSnapshot);
      if (!decision.allowed) {
        const result = rejectedResult(command.commandId, decision.reason ?? "Policy denied");
        this.cacheResult(result);
        return result;
      }
    }

    this.pendingCommands.add(command.commandId);
    try {
      const result = await this.adapter.execute(command);
      this.cacheResult(result);
      return result;
    } finally {
      this.pendingCommands.delete(command.commandId);
    }
  }

  /** 缓存已完成命令结果，达到上限时淘汰最旧条目 */
  private cacheResult(result: CommandResult): void {
    this.completedResults.set(result.commandId, result);
    if (this.completedResults.size > COMPLETED_CACHE_MAX) {
      const oldest = this.completedResults.keys().next().value;
      if (oldest !== undefined) {
        this.completedResults.delete(oldest);
      }
    }
  }

  /** 获取 Adapter capabilities */
  getCapabilities() {
    return this.adapter.getCapabilities();
  }
}
