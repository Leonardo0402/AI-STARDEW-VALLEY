/**
 * MockRuntimeAdapter — 模拟 Runtime，用于第一版垂直切片验证。
 *
 * 核心特性：
 * - 维护内存中的 Agent、Task、Artifact、Approval 状态
 * - 实现 RuntimeAdapter 接口
 * - 支持脚本化事件注入（演示流程）
 * - 不接真实 LLM，不接 OpenClaw
 * - 命令执行同步产生事件
 * - 事件通过 subscribe 回调推送（等价于 SSE）
 */
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  DomainEvent,
  OfficeCommand,
  CommandResult,
  AdapterCapabilities,
  DomainEventHandler,
  Unsubscribe,
  AgentSnapshot,
  TaskSnapshot,
  ArtifactSnapshot,
  ApprovalSnapshot,
  RoomSnapshot,
  ExecutionProfile,
  RoomBinding,
  CapabilityGrant,
  AgentRole,
  Priority,
  Id,
} from "@agent-office/protocol";
import { EventType, CommandType, ALL_EVENT_TYPES, ALL_COMMAND_TYPES } from "@agent-office/protocol";
import { reduceEvent } from "@agent-office/core";

const RUNTIME_ID = "mock-runtime-001";

// ─── 房间 ID ────────────────────────────────────────────────
const ROOM_COMMAND = "room-command";
const ROOM_EXECUTION = "room-execution";
const ROOM_REVIEW = "room-review";
const ROOM_DELIVERY = "room-delivery";

// ─── Agent ID ───────────────────────────────────────────────
const AGENT_ORCHESTRATOR = "agent-orchestrator";
const AGENT_WORKER_1 = "agent-worker-1";
const AGENT_WORKER_2 = "agent-worker-2";
const AGENT_REVIEWER = "agent-reviewer";

// ─── ExecutionProfile ───────────────────────────────────────
const PROFILES: Record<string, ExecutionProfile> = {
  "profile-command": {
    profileId: "profile-command",
    name: "Command Profile",
    toolAllowlist: [],
    toolDenylist: [],
    permissionScopes: ["task:create", "task:assign"],
    contextScopes: ["global"],
    workspaceRef: null,
    tokenBudget: null,
    timeBudgetSec: null,
    networkPolicy: "none",
    approvalPolicy: "none",
    inputArtifactTypes: [],
    outputArtifactTypes: ["task_spec"],
    maxConcurrency: 1,
  },
  "profile-execution": {
    profileId: "profile-execution",
    name: "Execution Profile",
    toolAllowlist: ["tool:web.search", "tool:code.read", "tool:code.write"],
    toolDenylist: [],
    permissionScopes: ["artifact:write"],
    contextScopes: ["workspace"],
    workspaceRef: "ws://local/workspace-1",
    tokenBudget: 10000,
    timeBudgetSec: 300,
    networkPolicy: "limited",
    approvalPolicy: "on_external_effect",
    inputArtifactTypes: ["task_spec"],
    outputArtifactTypes: ["report", "code_patch", "data"],
    maxConcurrency: 2,
  },
  "profile-review": {
    profileId: "profile-review",
    name: "Review Profile",
    toolAllowlist: ["tool:artifact.read", "tool:comment.write"],
    toolDenylist: ["tool:code.write"],
    permissionScopes: ["artifact:review"],
    contextScopes: ["review"],
    workspaceRef: null,
    tokenBudget: 5000,
    timeBudgetSec: 120,
    networkPolicy: "none",
    approvalPolicy: "none",
    inputArtifactTypes: ["report", "code_patch", "data"],
    outputArtifactTypes: ["review_comment"],
    maxConcurrency: 1,
  },
  "profile-delivery": {
    profileId: "profile-delivery",
    name: "Delivery Profile",
    toolAllowlist: [],
    toolDenylist: [],
    permissionScopes: ["approval:request"],
    contextScopes: ["delivery"],
    workspaceRef: null,
    tokenBudget: null,
    timeBudgetSec: null,
    networkPolicy: "none",
    approvalPolicy: "always",
    inputArtifactTypes: ["review_comment"],
    outputArtifactTypes: [],
    maxConcurrency: 1,
  },
};

// ─── RoomBinding ────────────────────────────────────────────
const BINDINGS: RoomBinding[] = [
  { bindingId: "bind-1", roomId: ROOM_COMMAND, profileId: "profile-command", overrides: {} },
  { bindingId: "bind-2", roomId: ROOM_EXECUTION, profileId: "profile-execution", overrides: {} },
  { bindingId: "bind-3", roomId: ROOM_REVIEW, profileId: "profile-review", overrides: {} },
  { bindingId: "bind-4", roomId: ROOM_DELIVERY, profileId: "profile-delivery", overrides: {} },
];

export interface MockAdapterOptions {
  /** 事件推送延迟（毫秒），默认 0 */
  eventDelayMs?: number;
  /** 是否自动播放演示脚本 */
  autoPlay?: boolean;
}

export class MockRuntimeAdapter implements RuntimeAdapter {
  private connected = false;
  private subscribers = new Set<DomainEventHandler>();
  private sequence = 0;
  private eventLog: DomainEvent[] = [];
  private correlationId = "";
  private traceId = "";
  private paused = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private options: MockAdapterOptions;

  // 内存状态
  private agents: Map<string, AgentSnapshot> = new Map();
  private tasks: Map<string, TaskSnapshot> = new Map();
  private artifacts: Map<string, ArtifactSnapshot> = new Map();
  private approvals: Map<string, ApprovalSnapshot> = new Map();
  private rooms: Map<string, RoomSnapshot> = new Map();
  private bindings: RoomBinding[] = BINDINGS;
  private profiles: Record<string, ExecutionProfile> = PROFILES;

  // 计数器
  private taskCounter = 0;
  private artifactCounter = 0;
  private approvalCounter = 0;
  private grantCounter = 0;

  constructor(options: MockAdapterOptions = {}) {
    this.options = { eventDelayMs: 0, autoPlay: false, ...options };
    this.initRooms();
    this.initAgents();
  }

  // ─── RuntimeAdapter 接口实现 ───────────────────────────────

  async connect(): Promise<void> {
    this.connected = true;
    this.correlationId = `corr-${Date.now()}`;
    this.traceId = `trace-${Date.now()}`;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.subscribers.clear();
  }

  async getSnapshot(): Promise<RuntimeSnapshot> {
    return {
      runtimeId: RUNTIME_ID,
      snapshotId: `snap-${this.sequence}`,
      sequence: this.sequence,
      schemaVersion: "1.0",
      createdAt: new Date().toISOString(),
      lastEventId: this.eventLog.length > 0
        ? this.eventLog[this.eventLog.length - 1].eventId
        : "",
      agents: Array.from(this.agents.values()),
      tasks: Array.from(this.tasks.values()),
      artifacts: Array.from(this.artifacts.values()),
      approvals: Array.from(this.approvals.values()),
      rooms: Array.from(this.rooms.values()),
    };
  }

  subscribe(handler: DomainEventHandler): Unsubscribe {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  async execute(command: OfficeCommand): Promise<CommandResult> {
    if (!this.connected) {
      return {
        commandId: command.commandId,
        status: "error",
        error: { code: "NOT_CONNECTED", message: "Adapter not connected" },
        affectedEventIds: [],
      };
    }

    switch (command.commandType) {
      case CommandType.TASK_CREATE:
        return this.handleTaskCreate(command);
      case CommandType.TASK_ASSIGN:
        return this.handleTaskAssign(command);
      case CommandType.AGENT_PAUSE:
        return this.handleAgentPause(command);
      case CommandType.AGENT_RESUME:
        return this.handleAgentResume(command);
      case CommandType.APPROVAL_ACCEPT:
        return this.handleApprovalAccept(command);
      case CommandType.APPROVAL_REJECT:
        return this.handleApprovalReject(command);
      case CommandType.ARTIFACT_OPEN:
        return this.handleArtifactOpen(command);
      default:
        return {
          commandId: command.commandId,
          status: "rejected",
          error: {
            code: "UNSUPPORTED_COMMAND",
            message: `Command ${command.commandType} not supported`,
          },
          affectedEventIds: [],
        };
    }
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportedEvents: [...ALL_EVENT_TYPES],
      supportedCommands: [...ALL_COMMAND_TYPES],
      features: {
        snapshot: true,
        sse: true,
        websocket: false,
        commandExecution: true,
        softMapping: true,
        hardOrchestration: false,
      },
    };
  }

  // ─── 命令处理 ──────────────────────────────────────────────

  private handleTaskCreate(command: OfficeCommand): CommandResult {
    const p = command.payload as {
      title: string;
      description: string;
      priority?: Priority;
      parentTaskId?: Id | null;
    };
    const taskId = `task-${++this.taskCounter}`;
    const event = this.createEvent(EventType.TASK_CREATED, {
      taskId,
      title: p.title,
      description: p.description,
      priority: p.priority ?? "normal",
      parentTaskId: p.parentTaskId ?? null,
    });
    this.emit(event);
    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [event.eventId],
    };
  }

  private handleTaskAssign(command: OfficeCommand): CommandResult {
    const p = command.payload as { taskId: Id; agentId: Id };
    const agent = this.agents.get(p.agentId);
    if (!agent) {
      return this.rejectCommand(command, `Agent ${p.agentId} not found`);
    }
    const roomId = this.getRoomForAgent(agent.role);
    const event = this.createEvent(EventType.TASK_ASSIGNED, {
      taskId: p.taskId,
      agentId: p.agentId,
      roomId,
    });
    this.emit(event);
    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [event.eventId],
    };
  }

  private handleAgentPause(command: OfficeCommand): CommandResult {
    const p = command.payload as { agentId: Id };
    const agent = this.agents.get(p.agentId);
    if (!agent) {
      return this.rejectCommand(command, `Agent ${p.agentId} not found`);
    }
    const oldStatus = agent.status;
    const event = this.createEvent(EventType.AGENT_STATUS_CHANGED, {
      agentId: p.agentId,
      oldStatus,
      newStatus: "paused",
    });
    this.emit(event);
    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [event.eventId],
    };
  }

  private handleAgentResume(command: OfficeCommand): CommandResult {
    const p = command.payload as { agentId: Id };
    const agent = this.agents.get(p.agentId);
    if (!agent) {
      return this.rejectCommand(command, `Agent ${p.agentId} not found`);
    }
    const oldStatus = agent.status;
    // 恢复到 working 或 idle
    const newStatus = agent.currentTaskId ? "working" : "idle";
    const event = this.createEvent(EventType.AGENT_STATUS_CHANGED, {
      agentId: p.agentId,
      oldStatus,
      newStatus,
    });
    this.emit(event);
    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [event.eventId],
    };
  }

  private handleApprovalAccept(command: OfficeCommand): CommandResult {
    const p = command.payload as { approvalId: Id };
    const approval = this.approvals.get(p.approvalId);
    if (!approval) {
      return this.rejectCommand(command, `Approval ${p.approvalId} not found`);
    }
    if (approval.status !== "requested") {
      return this.rejectCommand(command, `Approval ${p.approvalId} already ${approval.status}`);
    }
    const resolveEvent = this.createEvent(EventType.APPROVAL_RESOLVED, {
      approvalId: p.approvalId,
      status: "approved" as const,
      resolvedBy: command.actorId,
    });
    this.emit(resolveEvent);

    // 审批通过后，完成任务
    const task = this.findTaskByApproval(p.approvalId);
    if (task) {
      const completeEvent = this.createEvent(EventType.TASK_COMPLETED, {
        taskId: task.taskId,
      });
      this.emit(completeEvent);
      return {
        commandId: command.commandId,
        status: "accepted",
        affectedEventIds: [resolveEvent.eventId, completeEvent.eventId],
      };
    }

    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [resolveEvent.eventId],
    };
  }

  private handleApprovalReject(command: OfficeCommand): CommandResult {
    const p = command.payload as { approvalId: Id; reason: string };
    const approval = this.approvals.get(p.approvalId);
    if (!approval) {
      return this.rejectCommand(command, `Approval ${p.approvalId} not found`);
    }
    if (approval.status !== "requested") {
      return this.rejectCommand(command, `Approval ${p.approvalId} already ${approval.status}`);
    }
    const event = this.createEvent(EventType.APPROVAL_RESOLVED, {
      approvalId: p.approvalId,
      status: "rejected" as const,
      resolvedBy: command.actorId,
    });
    this.emit(event);
    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [event.eventId],
    };
  }

  private handleArtifactOpen(command: OfficeCommand): CommandResult {
    const p = command.payload as { artifactId: Id };
    const artifact = this.artifacts.get(p.artifactId);
    if (!artifact) {
      return this.rejectCommand(command, `Artifact ${p.artifactId} not found`);
    }
    // artifact.open 是只读命令，不产生事件
    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [],
    };
  }

  // ─── 脚本化场景 ────────────────────────────────────────────

  /**
   * 播放正常流程脚本：
   * task.created → task.assigned → task.started → artifact.created
   * → task.assigned(reviewer) → task.started(reviewer)
   * → artifact.reviewed → approval.requested
   * 然后等待用户审批
   */
  playNormalFlow(): void {
    const steps: Array<() => DomainEvent> = [
      () => {
        const taskId = `task-${++this.taskCounter}`;
        return this.createEvent(EventType.TASK_CREATED, {
          taskId,
          title: "分析项目代码质量",
          description: "扫描代码并生成质量报告",
          priority: "high" as Priority,
          parentTaskId: null,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_ASSIGNED, {
          taskId,
          agentId: AGENT_WORKER_1,
          roomId: ROOM_EXECUTION,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_WORKER_1,
          oldStatus: "idle" as const,
          newStatus: "working" as const,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_STARTED, {
          taskId,
          agentId: AGENT_WORKER_1,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        const artifactId = `artifact-${++this.artifactCounter}`;
        return this.createEvent(EventType.ARTIFACT_CREATED, {
          artifactId,
          taskId,
          producerAgentId: AGENT_WORKER_1,
          type: "report",
          title: "代码质量分析报告 v1",
          uri: `mock://artifacts/${artifactId}`,
          version: 1,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_ASSIGNED, {
          taskId,
          agentId: AGENT_REVIEWER,
          roomId: ROOM_REVIEW,
        });
      },
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_WORKER_1,
          oldStatus: "working" as const,
          newStatus: "idle" as const,
        });
      },
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_REVIEWER,
          oldStatus: "idle" as const,
          newStatus: "reviewing" as const,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_STARTED, {
          taskId,
          agentId: AGENT_REVIEWER,
        });
      },
      () => {
        const artifactId = `artifact-${this.artifactCounter}`;
        return this.createEvent(EventType.ARTIFACT_REVIEWED, {
          artifactId,
          reviewerId: AGENT_REVIEWER,
          verdict: "approved" as const,
          comment: "报告内容充分，质量良好。",
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        const approvalId = `approval-${++this.approvalCounter}`;
        return this.createEvent(EventType.APPROVAL_REQUESTED, {
          approvalId,
          taskId,
          kind: "artifact_delivery" as const,
          requestedBy: AGENT_REVIEWER,
          reason: "请审批最终交付物",
        });
      },
    ];

    this.playScript(steps);
  }

  /**
   * 播放异常流程一：Worker 执行失败
   * task.created → task.assigned → task.started → error.raised → task.blocked
   */
  playErrorFlow(): void {
    const steps: Array<() => DomainEvent> = [
      () => {
        const taskId = `task-${++this.taskCounter}`;
        return this.createEvent(EventType.TASK_CREATED, {
          taskId,
          title: "执行数据采集任务",
          description: "从外部数据源采集数据",
          priority: "high" as Priority,
          parentTaskId: null,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_ASSIGNED, {
          taskId,
          agentId: AGENT_WORKER_2,
          roomId: ROOM_EXECUTION,
        });
      },
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_WORKER_2,
          oldStatus: "idle" as const,
          newStatus: "working" as const,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_STARTED, {
          taskId,
          agentId: AGENT_WORKER_2,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.ERROR_RAISED, {
          taskId,
          agentId: AGENT_WORKER_2,
          message: "数据源连接超时，无法获取数据",
          severity: "error" as const,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_BLOCKED, {
          taskId,
          reason: "依赖数据不足：数据源连接超时",
        });
      },
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_WORKER_2,
          oldStatus: "working" as const,
          newStatus: "blocked" as const,
          reason: "数据源连接超时",
        });
      },
    ];

    this.playScript(steps);
  }

  /**
   * 播放异常流程二：审查不通过 → 返工
   * 在正常流程基础上，Reviewer 标记为 revision_required
   */
  playRevisionFlow(): void {
    const steps: Array<() => DomainEvent> = [
      () => {
        const taskId = `task-${++this.taskCounter}`;
        return this.createEvent(EventType.TASK_CREATED, {
          taskId,
          title: "生成技术文档",
          description: "编写 API 技术文档",
          priority: "normal" as Priority,
          parentTaskId: null,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_ASSIGNED, {
          taskId,
          agentId: AGENT_WORKER_1,
          roomId: ROOM_EXECUTION,
        });
      },
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_WORKER_1,
          oldStatus: "idle" as const,
          newStatus: "working" as const,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_STARTED, {
          taskId,
          agentId: AGENT_WORKER_1,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        const artifactId = `artifact-${++this.artifactCounter}`;
        return this.createEvent(EventType.ARTIFACT_CREATED, {
          artifactId,
          taskId,
          producerAgentId: AGENT_WORKER_1,
          type: "report",
          title: "API 技术文档 v1",
          uri: `mock://artifacts/${artifactId}`,
          version: 1,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_ASSIGNED, {
          taskId,
          agentId: AGENT_REVIEWER,
          roomId: ROOM_REVIEW,
        });
      },
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_WORKER_1,
          oldStatus: "working" as const,
          newStatus: "idle" as const,
        });
      },
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_REVIEWER,
          oldStatus: "idle" as const,
          newStatus: "reviewing" as const,
        });
      },
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_STARTED, {
          taskId,
          agentId: AGENT_REVIEWER,
        });
      },
      // Reviewer 拒绝，要求返工
      () => {
        const artifactId = `artifact-${this.artifactCounter}`;
        return this.createEvent(EventType.ARTIFACT_REVIEWED, {
          artifactId,
          reviewerId: AGENT_REVIEWER,
          verdict: "revision_required" as const,
          comment: "文档缺少错误码说明，请补充。",
        });
      },
      // ── 返工流程：Worker 重新执行 → 新版本 Artifact → Reviewer 重新审查通过 ──
      // Reviewer 回到 idle
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_REVIEWER,
          oldStatus: "reviewing" as const,
          newStatus: "idle" as const,
        });
      },
      // 任务重新分配给 Worker-1（返工）
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_ASSIGNED, {
          taskId,
          agentId: AGENT_WORKER_1,
          roomId: ROOM_EXECUTION,
        });
      },
      // Worker-1 进入执行区
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_WORKER_1,
          oldStatus: "idle" as const,
          newStatus: "working" as const,
        });
      },
      // Worker-1 开始返工
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_STARTED, {
          taskId,
          agentId: AGENT_WORKER_1,
        });
      },
      // Worker-1 完成返工，产生新版本 Artifact
      () => {
        const taskId = `task-${this.taskCounter}`;
        const artifactId = `artifact-${++this.artifactCounter}`;
        return this.createEvent(EventType.ARTIFACT_CREATED, {
          artifactId,
          taskId,
          producerAgentId: AGENT_WORKER_1,
          type: "report",
          title: "API 技术文档 v2",
          uri: `mock://artifacts/${artifactId}`,
          version: 2,
        });
      },
      // 任务重新分配给 Reviewer（重新审查）
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_ASSIGNED, {
          taskId,
          agentId: AGENT_REVIEWER,
          roomId: ROOM_REVIEW,
        });
      },
      // Worker-1 回到 idle
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_WORKER_1,
          oldStatus: "working" as const,
          newStatus: "idle" as const,
        });
      },
      // Reviewer 进入审查区
      () => {
        return this.createEvent(EventType.AGENT_STATUS_CHANGED, {
          agentId: AGENT_REVIEWER,
          oldStatus: "idle" as const,
          newStatus: "reviewing" as const,
        });
      },
      // Reviewer 开始审查新版本
      () => {
        const taskId = `task-${this.taskCounter}`;
        return this.createEvent(EventType.TASK_STARTED, {
          taskId,
          agentId: AGENT_REVIEWER,
        });
      },
      // Reviewer 审查通过（新版本）
      () => {
        const artifactId = `artifact-${this.artifactCounter}`;
        return this.createEvent(EventType.ARTIFACT_REVIEWED, {
          artifactId,
          reviewerId: AGENT_REVIEWER,
          verdict: "approved" as const,
          comment: "文档已补充错误码说明，审查通过。",
        });
      },
      // 请求用户审批
      () => {
        const taskId = `task-${this.taskCounter}`;
        const approvalId = `approval-${++this.approvalCounter}`;
        return this.createEvent(EventType.APPROVAL_REQUESTED, {
          approvalId,
          taskId,
          kind: "artifact_delivery" as const,
          requestedBy: AGENT_REVIEWER,
          reason: "返工完成，请审批最终交付物",
        });
      },
    ];

    this.playScript(steps);
  }

  /**
   * 播放异常流程三：用户拒绝审批
   * 在正常流程基础上，Reviewer 请求审批，等待用户拒绝
   */
  playRejectionFlow(): void {
    // 与正常流程相同，但等待用户拒绝
    this.playNormalFlow();
  }

  /** 暂停脚本播放 */
  pausePlayback(): void {
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** 恢复脚本播放 */
  resumePlayback(): void {
    this.paused = false;
  }

  /** 重置 Mock Runtime 到初始状态 */
  reset(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.sequence = 0;
    this.eventLog = [];
    this.paused = false;
    this.taskCounter = 0;
    this.artifactCounter = 0;
    this.approvalCounter = 0;
    this.grantCounter = 0;
    this.agents.clear();
    this.tasks.clear();
    this.artifacts.clear();
    this.approvals.clear();
    this.initAgents();
  }

  /** 获取事件日志 */
  getEventLog(): DomainEvent[] {
    return [...this.eventLog];
  }

  // ─── 内部方法 ──────────────────────────────────────────────

  private initRooms(): void {
    const rooms: Array<[string, string, RoomSnapshot["type"]]> = [
      [ROOM_COMMAND, "指挥区", "command"],
      [ROOM_EXECUTION, "执行区", "execution"],
      [ROOM_REVIEW, "审查区", "review"],
      [ROOM_DELIVERY, "审批与交付区", "approval_delivery"],
    ];

    for (const [roomId, name, type] of rooms) {
      this.rooms.set(roomId, {
        roomId,
        runtimeId: RUNTIME_ID,
        name,
        type: type as RoomSnapshot["type"],
        bounds: this.getRoomBounds(type as RoomSnapshot["type"]),
        activeAgentIds: [],
        visualState: {},
      });
    }
  }

  private getRoomBounds(type: RoomSnapshot["type"]): { x: number; y: number; width: number; height: number } {
    switch (type) {
      case "command": return { x: 0, y: 0, width: 400, height: 300 };
      case "execution": return { x: 400, y: 0, width: 400, height: 300 };
      case "review": return { x: 0, y: 300, width: 400, height: 300 };
      case "approval_delivery": return { x: 400, y: 300, width: 400, height: 300 };
      default: return { x: 0, y: 0, width: 400, height: 300 };
    }
  }

  private initAgents(): void {
    const agents: Array<[string, string, AgentRole]> = [
      [AGENT_ORCHESTRATOR, "Orchestrator", "orchestrator"],
      [AGENT_WORKER_1, "Worker-1", "worker"],
      [AGENT_WORKER_2, "Worker-2", "worker"],
      [AGENT_REVIEWER, "Reviewer", "reviewer"],
    ];

    for (const [agentId, name, role] of agents) {
      const grants: CapabilityGrant[] = this.getGrantsForRole(role, agentId);
      this.agents.set(agentId, {
        agentId,
        runtimeId: RUNTIME_ID,
        name,
        role,
        status: "idle",
        currentTaskId: null,
        currentRoomId: role === "orchestrator" ? ROOM_COMMAND : null,
        capabilityGrants: grants,
        lastEventAt: new Date().toISOString(),
        blockedReason: null,
      });
    }
  }

  private getGrantsForRole(role: AgentRole, agentId: string): CapabilityGrant[] {
    const baseGrant = (capability: string, effect: CapabilityGrant["effect"]): CapabilityGrant => ({
      grantId: `grant-${++this.grantCounter}`,
      principalId: agentId,
      capability,
      effect,
      scope: {},
      expiresAt: null,
      issuedBy: "system",
      state: "active",
    });

    switch (role) {
      case "orchestrator":
        return [
          baseGrant("task:create", "allow"),
          baseGrant("task:assign", "allow"),
        ];
      case "worker":
        return [
          baseGrant("tool:web.search", "allow"),
          baseGrant("tool:code.read", "allow"),
          baseGrant("tool:code.write", "require_approval"),
          baseGrant("artifact:write", "allow"),
        ];
      case "reviewer":
        return [
          baseGrant("tool:artifact.read", "allow"),
          baseGrant("artifact:review", "allow"),
          baseGrant("approval:request", "allow"),
        ];
    }
  }

  private getRoomForAgent(role: AgentRole): string {
    switch (role) {
      case "orchestrator": return ROOM_COMMAND;
      case "worker": return ROOM_EXECUTION;
      case "reviewer": return ROOM_REVIEW;
    }
  }

  private createEvent<P>(type: string, payload: P): DomainEvent<P> {
    const now = new Date().toISOString();
    return {
      eventId: `evt-${++this.sequence}-${Date.now()}`,
      runtimeId: RUNTIME_ID,
      sequence: this.sequence,
      schemaVersion: "1.0",
      type,
      occurredAt: now,
      receivedAt: now,
      correlationId: this.correlationId,
      causationId: this.eventLog.length > 0
        ? this.eventLog[this.eventLog.length - 1].eventId
        : null,
      traceId: this.traceId,
      payload,
    };
  }

  private emit(event: DomainEvent): void {
    this.eventLog.push(event);
    // 先更新内部状态
    this.applyEventInternal(event);
    // 再推送给订阅者
    const delay = this.options.eventDelayMs ?? 0;
    if (delay > 0) {
      setTimeout(() => {
        for (const handler of this.subscribers) {
          handler(event);
        }
      }, delay);
    } else {
      for (const handler of this.subscribers) {
        handler(event);
      }
    }
  }

  /**
   * 内部状态更新 — 复用 Core 的 reduceEvent，消除重复逻辑。
   * 构建 → reduce → 同步回 Maps，保证 Mock 内部状态与 Core Reducer 完全一致。
   */
  private applyEventInternal(event: DomainEvent): void {
    const currentSnapshot = this.buildInternalSnapshot();
    const result = reduceEvent(currentSnapshot, event);
    this.syncFromSnapshot(result.snapshot);
  }

  /** 从内部 Maps 构建 RuntimeSnapshot */
  private buildInternalSnapshot(): RuntimeSnapshot {
    return {
      runtimeId: RUNTIME_ID,
      snapshotId: `snap-${this.sequence}`,
      sequence: this.sequence,
      schemaVersion: "1.0",
      createdAt: new Date().toISOString(),
      lastEventId: this.eventLog.length > 0
        ? this.eventLog[this.eventLog.length - 1].eventId
        : "",
      agents: Array.from(this.agents.values()),
      tasks: Array.from(this.tasks.values()),
      artifacts: Array.from(this.artifacts.values()),
      approvals: Array.from(this.approvals.values()),
      rooms: Array.from(this.rooms.values()),
    };
  }

  /** 将 reduceEvent 产出的 snapshot 同步回内部 Maps */
  private syncFromSnapshot(snap: RuntimeSnapshot): void {
    this.agents = new Map(snap.agents.map((a) => [a.agentId, a]));
    this.tasks = new Map(snap.tasks.map((t) => [t.taskId, t]));
    this.artifacts = new Map(snap.artifacts.map((a) => [a.artifactId, a]));
    this.approvals = new Map(snap.approvals.map((a) => [a.approvalId, a]));
    this.rooms = new Map(snap.rooms.map((r) => [r.roomId, r]));
  }

  private findTaskByApproval(approvalId: string): TaskSnapshot | undefined {
    for (const task of this.tasks.values()) {
      if (task.approvalId === approvalId) return task;
    }
    return undefined;
  }

  private rejectCommand(command: OfficeCommand, message: string): CommandResult {
    return {
      commandId: command.commandId,
      status: "rejected",
      error: { code: "MOCK_ERROR", message },
      affectedEventIds: [],
    };
  }

  private playScript(steps: Array<() => DomainEvent>): void {
    let index = 0;
    const delay = this.options.eventDelayMs ?? 200;

    const playNext = () => {
      if (this.paused || index >= steps.length) return;
      const event = steps[index]();
      this.emit(event);
      index++;
      if (index < steps.length) {
        this.timer = setTimeout(playNext, delay);
      }
    };

    playNext();
  }
}
