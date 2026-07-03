/**
 * Policy Evaluator — 简化的权限评估器。
 * MVP 只使用 CapabilityGrant: allow / deny / require_approval。
 * 不实现 RBAC、ABAC 或外部策略引擎。
 */
import type {
  OfficeCommand,
  CapabilityGrant,
  RuntimeSnapshot,
  CommandResult,
} from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

/**
 * 评估命令是否被策略允许。
 * MVP 策略非常简单：
 * - task.create: 任何用户来源的命令都允许
 * - task.assign: 任何用户来源的命令都允许
 * - agent.pause / agent.resume: 任何用户来源的命令都允许
 * - approval.accept / approval.reject: 任何用户来源的命令都允许
 * - artifact.open: 任何来源都允许（只读操作）
 *
 * Agent 的 capability grant 主要用于限制 Agent 能做什么（如使用工具），
 * 不限制用户对系统的控制命令。
 */
export function evaluateCommand(
  command: OfficeCommand,
  snapshot: RuntimeSnapshot
): PolicyDecision {
  // 用户命令默认允许
  if (command.source === "user") {
    // 检查目标对象是否存在
    switch (command.commandType) {
      case CommandType.TASK_ASSIGN: {
        const p = command.payload as { taskId: string; agentId: string };
        const task = snapshot.tasks.find((t) => t.taskId === p.taskId);
        if (!task) {
          return { allowed: false, requiresApproval: false, reason: `Task ${p.taskId} not found` };
        }
        const agent = snapshot.agents.find((a) => a.agentId === p.agentId);
        if (!agent) {
          return { allowed: false, requiresApproval: false, reason: `Agent ${p.agentId} not found` };
        }
        return { allowed: true, requiresApproval: false };
      }
      case CommandType.AGENT_PAUSE:
      case CommandType.AGENT_RESUME: {
        const p = command.payload as { agentId: string };
        const agent = snapshot.agents.find((a) => a.agentId === p.agentId);
        if (!agent) {
          return { allowed: false, requiresApproval: false, reason: `Agent ${p.agentId} not found` };
        }
        return { allowed: true, requiresApproval: false };
      }
      case CommandType.APPROVAL_ACCEPT:
      case CommandType.APPROVAL_REJECT: {
        const p = command.payload as { approvalId: string };
        const approval = snapshot.approvals.find((a) => a.approvalId === p.approvalId);
        if (!approval) {
          return { allowed: false, requiresApproval: false, reason: `Approval ${p.approvalId} not found` };
        }
        if (approval.status !== "requested") {
          return { allowed: false, requiresApproval: false, reason: `Approval ${p.approvalId} already ${approval.status}` };
        }
        return { allowed: true, requiresApproval: false };
      }
      case CommandType.TASK_CREATE:
      case CommandType.ARTIFACT_OPEN:
        return { allowed: true, requiresApproval: false };
      default:
        return { allowed: true, requiresApproval: false };
    }
  }

  // 系统命令默认允许
  return { allowed: true, requiresApproval: false };
}

/**
 * 检查 Agent 是否拥有某项 capability。
 * 用于 Mock Adapter 内部校验 Agent 能否使用工具。
 */
export function hasCapability(
  grants: CapabilityGrant[],
  capability: string
): PolicyDecision {
  for (const grant of grants) {
    if (grant.state !== "active") continue;
    if (grant.capability !== capability) continue;
    if (grant.effect === "allow") {
      return { allowed: true, requiresApproval: false };
    }
    if (grant.effect === "deny") {
      return { allowed: false, requiresApproval: false, reason: `Denied by grant ${grant.grantId}` };
    }
    if (grant.effect === "require_approval") {
      return { allowed: false, requiresApproval: true, reason: `Requires approval for ${capability}` };
    }
  }
  // 默认拒绝
  return { allowed: false, requiresApproval: false, reason: `No grant for ${capability}` };
}

/**
 * 构造拒绝结果
 */
export function rejectedResult(commandId: string, reason: string): CommandResult {
  return {
    commandId,
    status: "rejected",
    error: { code: "POLICY_DENIED", message: reason },
    affectedEventIds: [],
  };
}
