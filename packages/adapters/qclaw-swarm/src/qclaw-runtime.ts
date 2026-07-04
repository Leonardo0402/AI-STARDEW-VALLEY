import http from "node:http";
import type {
  RuntimeSnapshot,
  DomainEvent,
  AdapterCapabilities,
  AgentSnapshot,
  TaskSnapshot,
  ArtifactSnapshot,
  ApprovalSnapshot,
  RoomSnapshot,
  ExecutionProfile,
  RoomBinding,
  CapabilityGrant,
  AgentRole,
  OfficeCommand,
  CommandResult,
  Priority,
  Id,
} from "@agent-office/protocol";
import { CommandType, EventType, ALL_EVENT_TYPES } from "@agent-office/protocol";
import { reduceEvent } from "@agent-office/core";

const RUNTIME_ID = "qclaw-swarm-runtime-001";

// ─── 房间 ID ────────────────────────────────────────────────
const QCLAW_ROOM_COMMAND = "qclaw-room-command";
const QCLAW_ROOM_EXECUTION = "qclaw-room-execution";
const QCLAW_ROOM_REVIEW = "qclaw-room-review";
const QCLAW_ROOM_DELIVERY = "qclaw-room-delivery";

// ─── Agent ID ───────────────────────────────────────────────
const QCLAW_AGENT_ORCHESTRATOR = "qclaw-agent-orchestrator";
const QCLAW_AGENT_WORKER_1 = "qclaw-agent-worker-1";
const QCLAW_AGENT_WORKER_2 = "qclaw-agent-worker-2";
const QCLAW_AGENT_REVIEWER = "qclaw-agent-reviewer";

// ─── ExecutionProfile ───────────────────────────────────────
const PROFILES: Record<string, ExecutionProfile> = {
  "qclaw-profile-command": {
    profileId: "qclaw-profile-command",
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
  "qclaw-profile-execution": {
    profileId: "qclaw-profile-execution",
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
  "qclaw-profile-review": {
    profileId: "qclaw-profile-review",
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
  "qclaw-profile-delivery": {
    profileId: "qclaw-profile-delivery",
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
  { bindingId: "qclaw-bind-1", roomId: QCLAW_ROOM_COMMAND, profileId: "qclaw-profile-command", overrides: {} },
  { bindingId: "qclaw-bind-2", roomId: QCLAW_ROOM_EXECUTION, profileId: "qclaw-profile-execution", overrides: {} },
  { bindingId: "qclaw-bind-3", roomId: QCLAW_ROOM_REVIEW, profileId: "qclaw-profile-review", overrides: {} },
  { bindingId: "qclaw-bind-4", roomId: QCLAW_ROOM_DELIVERY, profileId: "qclaw-profile-delivery", overrides: {} },
];

export interface QclawRuntimeOptions {
  port?: number;
}

/**
 * QClaw/Swarm-style test runtime. Exposes the generic HTTP/SSE wire protocol
 * (runtime-contract.md §4.3) with QClaw-style execution semantics.
 *
 * Endpoints:
 *   GET  /runtime/snapshot
 *   GET  /runtime/capabilities
 *   GET  /runtime/events?afterSequence=N
 *   POST /runtime/commands
 */
export class QclawTestRuntime {
  private server: http.Server;
  private port: number;
  private capabilities: AdapterCapabilities;

  // 内存状态
  private agents: Map<string, AgentSnapshot> = new Map();
  private tasks: Map<string, TaskSnapshot> = new Map();
  private artifacts: Map<string, ArtifactSnapshot> = new Map();
  private approvals: Map<string, ApprovalSnapshot> = new Map();
  private rooms: Map<string, RoomSnapshot> = new Map();
  private bindings: RoomBinding[] = BINDINGS;
  private profiles: Record<string, ExecutionProfile> = PROFILES;
  private eventLog: DomainEvent[] = [];
  private liveClients: Array<{ res: http.ServerResponse; afterSequence: number }> = [];
  private sequence = 0;
  private correlationId = "";
  private traceId = "";
  private taskCounter = 0;
  private artifactCounter = 0;
  private approvalCounter = 0;
  private grantCounter = 0;

  constructor(opts: QclawRuntimeOptions = {}) {
    this.port = opts.port ?? 0;
    this.correlationId = "corr-qclaw-init";
    this.traceId = "trace-qclaw-init";
    this.capabilities = {
      supportedEvents: [...ALL_EVENT_TYPES],
      supportedCommands: Object.values(CommandType),
      features: {
        snapshot: true,
        sse: true,
        websocket: false,
        commandExecution: true,
        softMapping: true,
        hardOrchestration: false,
      },
    };
    this.initRooms();
    this.initAgents();
    this.server = http.createServer((req, res) => this.handle(req, res));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        const addr = this.server.address();
        if (addr && typeof addr === "object") this.port = addr.port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.liveClients) {
      try { client.res.end(); } catch { /* best-effort */ }
    }
    this.liveClients = [];
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  getSnapshot(): RuntimeSnapshot {
    return this.buildInternalSnapshot();
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? "";

    if (req.method === "GET" && url.endsWith("/runtime/snapshot")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.getSnapshot()));
      return;
    }

    if (req.method === "GET" && url.endsWith("/runtime/capabilities")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.capabilities));
      return;
    }

    // GET /runtime/events?afterSequence=N — SSE stream with replay + replay-complete + live push
    if (req.method === "GET" && url.includes("/runtime/events")) {
      const afterSeq = parseInt(new URL(`http://x${url}`).searchParams.get("afterSequence") ?? "0", 10);
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      // Replay phase: send all events with sequence > afterSeq
      let lastReplayedSeq = afterSeq;
      for (const ev of this.eventLog) {
        if (ev.sequence > afterSeq) {
          res.write(`event: domain-event\nid: ${ev.sequence}\ndata: ${JSON.stringify(ev)}\n\n`);
          lastReplayedSeq = ev.sequence;
        }
      }

      // Send replay-complete control frame
      res.write(`event: replay-complete\nid: ${lastReplayedSeq}\ndata: {"lastSequence":${lastReplayedSeq}}\n\n`);

      // Register as live client for subsequent pushEvent calls
      const clientEntry = { res, afterSequence: afterSeq };
      this.liveClients.push(clientEntry);
      res.on("close", () => {
        const idx = this.liveClients.indexOf(clientEntry);
        if (idx >= 0) this.liveClients.splice(idx, 1);
      });
      return;
    }

    if (req.method === "POST" && url.endsWith("/runtime/commands")) {
      const body = await this.readRequestBody(req);
      let cmd: OfficeCommand;
      try {
        cmd = JSON.parse(body) as OfficeCommand;
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({
          commandId: "unknown",
          status: "error",
          error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
          affectedEventIds: [],
        }));
        return;
      }
      const result = this.executeCommand(cmd);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    // Demo-only endpoints (for golden workflow script)
    if (req.method === "POST" && url.endsWith("/runtime/demo/trigger-artifact-review")) {
      this.triggerArtifactAndReviewForTest();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (req.method === "GET" && url.endsWith("/runtime/demo/event-log")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.eventLog));
      return;
    }

    res.writeHead(404);
    res.end("not found");
  }

  private readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  // ─── 命令分发 ──────────────────────────────────────────────

  private executeCommand(cmd: OfficeCommand): CommandResult {
    switch (cmd.commandType) {
      case CommandType.TASK_CREATE:
        return this.handleTaskCreate(cmd);
      case CommandType.TASK_ASSIGN:
        return this.handleTaskAssign(cmd);
      case CommandType.AGENT_PAUSE:
        return this.handleAgentPause(cmd);
      case CommandType.AGENT_RESUME:
        return this.handleAgentResume(cmd);
      case CommandType.APPROVAL_ACCEPT:
        return this.handleApprovalAccept(cmd);
      case CommandType.APPROVAL_REJECT:
        return this.handleApprovalReject(cmd);
      case CommandType.ARTIFACT_OPEN:
        return { commandId: cmd.commandId, status: "accepted" as const, affectedEventIds: [] };
      default:
        return {
          commandId: cmd.commandId,
          status: "rejected" as const,
          error: { code: "UNSUPPORTED_COMMAND", message: `Command ${cmd.commandType} not supported` },
          affectedEventIds: [],
        };
    }
  }

  // ─── 命令处理 (QClaw 语义) ─────────────────────────────────

  private handleTaskCreate(cmd: OfficeCommand): CommandResult {
    const p = cmd.payload as {
      title: string;
      description: string;
      priority?: Priority;
      parentTaskId?: Id | null;
    };
    const worker = this.findAvailableWorker();
    if (!worker) {
      return this.rejectCommand(cmd, "No available worker to dispatch task");
    }
    const taskId = `qclaw-task-${++this.taskCounter}`;

    const created = this.createEvent(EventType.TASK_CREATED, {
      taskId,
      title: p.title,
      description: p.description,
      priority: p.priority ?? "normal",
      parentTaskId: p.parentTaskId ?? null,
    });
    this.emit(created);

    const assigned = this.createEvent(EventType.TASK_ASSIGNED, {
      taskId,
      agentId: worker.agentId,
      roomId: QCLAW_ROOM_EXECUTION,
    });
    this.emit(assigned);

    const started = this.createEvent(EventType.TASK_STARTED, {
      taskId,
      agentId: worker.agentId,
    });
    this.emit(started);

    return {
      commandId: cmd.commandId,
      status: "accepted" as const,
      affectedEventIds: [created.eventId, assigned.eventId, started.eventId],
    };
  }

  private handleTaskAssign(cmd: OfficeCommand): CommandResult {
    const p = cmd.payload as { taskId: Id; agentId: Id };
    const agent = this.agents.get(p.agentId);
    if (!agent) {
      return this.rejectCommand(cmd, `Agent ${p.agentId} not found`);
    }
    const assigned = this.createEvent(EventType.TASK_ASSIGNED, {
      taskId: p.taskId,
      agentId: p.agentId,
      roomId: QCLAW_ROOM_EXECUTION,
    });
    this.emit(assigned);

    const started = this.createEvent(EventType.TASK_STARTED, {
      taskId: p.taskId,
      agentId: p.agentId,
    });
    this.emit(started);

    return {
      commandId: cmd.commandId,
      status: "accepted" as const,
      affectedEventIds: [assigned.eventId, started.eventId],
    };
  }

  private handleAgentPause(cmd: OfficeCommand): CommandResult {
    const p = cmd.payload as { agentId: Id };
    const agent = this.agents.get(p.agentId);
    if (!agent) {
      return this.rejectCommand(cmd, `Agent ${p.agentId} not found`);
    }
    const oldStatus = agent.status;
    const event = this.createEvent(EventType.AGENT_STATUS_CHANGED, {
      agentId: p.agentId,
      oldStatus,
      newStatus: "paused",
    });
    this.emit(event);
    return {
      commandId: cmd.commandId,
      status: "accepted" as const,
      affectedEventIds: [event.eventId],
    };
  }

  private handleAgentResume(cmd: OfficeCommand): CommandResult {
    const p = cmd.payload as { agentId: Id };
    const agent = this.agents.get(p.agentId);
    if (!agent) {
      return this.rejectCommand(cmd, `Agent ${p.agentId} not found`);
    }
    const oldStatus = agent.status;
    const newStatus = agent.currentTaskId ? "working" : "idle";
    const event = this.createEvent(EventType.AGENT_STATUS_CHANGED, {
      agentId: p.agentId,
      oldStatus,
      newStatus,
    });
    this.emit(event);
    return {
      commandId: cmd.commandId,
      status: "accepted" as const,
      affectedEventIds: [event.eventId],
    };
  }

  private handleApprovalAccept(cmd: OfficeCommand): CommandResult {
    const p = cmd.payload as { approvalId: Id };
    const approval = this.approvals.get(p.approvalId);
    if (!approval) {
      return this.rejectCommand(cmd, `Approval ${p.approvalId} not found`);
    }
    if (approval.status !== "requested") {
      return this.rejectCommand(cmd, `Approval ${p.approvalId} already ${approval.status}`);
    }
    const resolveEvent = this.createEvent(EventType.APPROVAL_RESOLVED, {
      approvalId: p.approvalId,
      status: "approved" as const,
      resolvedBy: cmd.actorId,
    });
    this.emit(resolveEvent);

    const task = this.findTaskByApproval(p.approvalId);
    if (task) {
      const completeEvent = this.createEvent(EventType.TASK_COMPLETED, {
        taskId: task.taskId,
      });
      this.emit(completeEvent);
      return {
        commandId: cmd.commandId,
        status: "accepted" as const,
        affectedEventIds: [resolveEvent.eventId, completeEvent.eventId],
      };
    }

    return {
      commandId: cmd.commandId,
      status: "accepted" as const,
      affectedEventIds: [resolveEvent.eventId],
    };
  }

  private handleApprovalReject(cmd: OfficeCommand): CommandResult {
    const p = cmd.payload as { approvalId: Id; reason: string };
    const approval = this.approvals.get(p.approvalId);
    if (!approval) {
      return this.rejectCommand(cmd, `Approval ${p.approvalId} not found`);
    }
    if (approval.status !== "requested") {
      return this.rejectCommand(cmd, `Approval ${p.approvalId} already ${approval.status}`);
    }
    const resolveEvent = this.createEvent(EventType.APPROVAL_RESOLVED, {
      approvalId: p.approvalId,
      status: "rejected" as const,
      resolvedBy: cmd.actorId,
    });
    this.emit(resolveEvent);

    const task = this.findTaskByApproval(p.approvalId);
    if (task) {
      const blockEvent = this.createEvent(EventType.TASK_BLOCKED, {
        taskId: task.taskId,
        reason: p.reason,
      });
      this.emit(blockEvent);
      return {
        commandId: cmd.commandId,
        status: "accepted" as const,
        affectedEventIds: [resolveEvent.eventId, blockEvent.eventId],
      };
    }

    return {
      commandId: cmd.commandId,
      status: "accepted" as const,
      affectedEventIds: [resolveEvent.eventId],
    };
  }

  // ─── 辅助方法 ──────────────────────────────────────────────

  private findAvailableWorker(): AgentSnapshot | undefined {
    for (const agent of this.agents.values()) {
      if (agent.role === "worker" && agent.status === "idle") return agent;
    }
    return undefined;
  }

  private findTaskByApproval(approvalId: string): TaskSnapshot | undefined {
    for (const task of this.tasks.values()) {
      if (task.approvalId === approvalId) return task;
    }
    return undefined;
  }

  private rejectCommand(cmd: OfficeCommand, message: string): CommandResult {
    return {
      commandId: cmd.commandId,
      status: "rejected" as const,
      error: { code: "QCLAW_ERROR", message },
      affectedEventIds: [],
    };
  }

  // TEST-ONLY: 直接发射事件以驱动 runtime 进入 approval.requested 等待状态，
  // 用于测试 approval.accept / approval.reject 的自动完成/自动阻塞语义。
  public driveToApprovalRequestedForTest(): void {
    const worker = QCLAW_AGENT_WORKER_1;
    const taskId = `qclaw-task-${++this.taskCounter}`;

    const created = this.createEvent(EventType.TASK_CREATED, {
      taskId,
      title: "Test task awaiting approval",
      description: "Driven by driveToApprovalRequestedForTest",
      priority: "normal",
      parentTaskId: null,
    });
    this.emit(created);

    const assigned = this.createEvent(EventType.TASK_ASSIGNED, {
      taskId,
      agentId: worker,
      roomId: QCLAW_ROOM_EXECUTION,
    });
    this.emit(assigned);

    const started = this.createEvent(EventType.TASK_STARTED, {
      taskId,
      agentId: worker,
    });
    this.emit(started);

    const artifactId = `qclaw-artifact-${++this.artifactCounter}`;
    const artifactCreated = this.createEvent(EventType.ARTIFACT_CREATED, {
      artifactId,
      taskId,
      producerAgentId: worker,
      type: "report",
      title: "Demo artifact",
      uri: null,
      version: 1,
    });
    this.emit(artifactCreated);

    const artifactReviewed = this.createEvent(EventType.ARTIFACT_REVIEWED, {
      artifactId,
      reviewerId: QCLAW_AGENT_REVIEWER,
      verdict: "approved",
      comment: "Approved",
    });
    this.emit(artifactReviewed);

    const approvalId = `qclaw-approval-${++this.approvalCounter}`;
    const approvalRequested = this.createEvent(EventType.APPROVAL_REQUESTED, {
      approvalId,
      taskId,
      kind: "artifact_delivery",
      requestedBy: QCLAW_AGENT_REVIEWER,
      reason: "Artifact approved, request delivery approval",
    });
    this.emit(approvalRequested);
  }

  // TEST-ONLY: Simulates the worker producing an artifact and the reviewer approving it.
  // In a real runtime, these would be agent-driven actions.
  public triggerArtifactAndReviewForTest(): void {
    // Find the current running task
    let task: TaskSnapshot | undefined;
    for (const t of this.tasks.values()) {
      if (t.status === "running") {
        task = t;
        break;
      }
    }
    if (!task) {
      throw new Error("No running task found — call task.create first");
    }

    const artifactId = `qclaw-artifact-${++this.artifactCounter}`;
    const approvalId = `qclaw-approval-${++this.approvalCounter}`;

    // Emit artifact.created (producer = the assigned worker)
    this.emit(this.createEvent(EventType.ARTIFACT_CREATED, {
      artifactId,
      taskId: task.taskId,
      producerAgentId: task.assigneeId!,
      type: "report",
      title: "Demo artifact",
      uri: null,
      version: 1,
    }));

    // Emit artifact.reviewed (reviewer = qclaw-agent-reviewer, verdict = approved)
    this.emit(this.createEvent(EventType.ARTIFACT_REVIEWED, {
      artifactId,
      reviewerId: QCLAW_AGENT_REVIEWER,
      verdict: "approved",
      comment: "Artifact approved by reviewer",
    }));

    // Emit approval.requested
    this.emit(this.createEvent(EventType.APPROVAL_REQUESTED, {
      approvalId,
      taskId: task.taskId,
      kind: "artifact_delivery",
      requestedBy: QCLAW_AGENT_REVIEWER,
      reason: "Artifact approved, requesting delivery approval",
    }));
  }

  // ─── 内部方法 ──────────────────────────────────────────────

  private initRooms(): void {
    const rooms: Array<[string, string, RoomSnapshot["type"]]> = [
      [QCLAW_ROOM_COMMAND, "指挥区", "command"],
      [QCLAW_ROOM_EXECUTION, "执行区", "execution"],
      [QCLAW_ROOM_REVIEW, "审查区", "review"],
      [QCLAW_ROOM_DELIVERY, "审批与交付区", "approval_delivery"],
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
      [QCLAW_AGENT_ORCHESTRATOR, "Orchestrator", "orchestrator"],
      [QCLAW_AGENT_WORKER_1, "Worker-1", "worker"],
      [QCLAW_AGENT_WORKER_2, "Worker-2", "worker"],
      [QCLAW_AGENT_REVIEWER, "Reviewer", "reviewer"],
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
        currentRoomId: role === "orchestrator" ? QCLAW_ROOM_COMMAND : null,
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
    this.applyEventInternal(event);
    this.pushEvent(event);
  }

  private pushEvent(event: DomainEvent): void {
    for (const client of this.liveClients) {
      if (event.sequence > client.afterSequence) {
        try {
          client.res.write(`event: domain-event\nid: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);
        } catch {
          // best-effort — client may have disconnected
        }
      }
    }
  }

  private applyEventInternal(event: DomainEvent): void {
    const currentSnapshot = this.buildInternalSnapshot();
    const result = reduceEvent(currentSnapshot, event);
    this.syncFromSnapshot(result.snapshot);
  }

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

  private syncFromSnapshot(snap: RuntimeSnapshot): void {
    this.agents = new Map(snap.agents.map((a) => [a.agentId, a]));
    this.tasks = new Map(snap.tasks.map((t) => [t.taskId, t]));
    this.artifacts = new Map(snap.artifacts.map((a) => [a.artifactId, a]));
    this.approvals = new Map(snap.approvals.map((a) => [a.approvalId, a]));
    this.rooms = new Map(snap.rooms.map((r) => [r.roomId, r]));
  }
}
