/**
 * AgentReviewOrchestrator — core layer component wrapping a RuntimeAdapter.
 *
 * Intercepts 4 review commands (REVIEW_ASSIGN, REVIEW_SUBMIT, REVIEW_APPROVE,
 * REVIEW_REJECT) and manages review state (assignments + drafts).
 * Delegates event emission to the wrapped adapter via REVIEW_FINALIZE
 * (internal command) for ARTIFACT_REVIEWED emission.
 *
 * Agent cannot directly merge/close — only human REVIEW_APPROVE triggers
 * ARTIFACT_REVIEWED. This is the core safety boundary.
 */
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  OfficeCommand,
  CommandResult,
  AdapterCapabilities,
  RuntimeStreamObserver,
  RuntimeSubscription,
  SubscribeOptions,
  Id,
  ReviewAssignPayload,
  ReviewSubmitPayload,
  ReviewApprovePayload,
  ReviewRejectPayload,
  ReviewFinalizePayload,
} from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";
import type { ReviewStrategy } from "./review-strategy.js";
import { RuleBasedReviewStrategy } from "./review-strategy.js";
import { GitHubRuntimeAdapter } from "@agent-office/adapter-github";
import type { GitHubAdapterEvidence } from "@agent-office/adapter-github";

export interface OrchestratorOptions {
  strategy?: ReviewStrategy;
}

export interface ReviewAssignment {
  reviewId: Id;
  targetKind: "pr" | "issue";
  targetNumber: number;
  agentId: Id;
  assignedAt: string;
}

export interface ReviewDraft {
  reviewId: Id;
  agentId: Id;
  verdict: "approved" | "revision_required" | "rejected";
  comment: string;
  targetKind: "pr" | "issue";
  targetNumber: number;
  submittedAt: string;
}

export class AgentReviewOrchestrator implements RuntimeAdapter {
  private assignedReviews = new Map<Id, ReviewAssignment>();
  private submittedReviews = new Map<Id, ReviewDraft>();
  readonly strategy: ReviewStrategy;

  constructor(
    private readonly inner: RuntimeAdapter,
    options: OrchestratorOptions = {}
  ) {
    this.strategy = options.strategy ?? new RuleBasedReviewStrategy();
  }

  // ─── RuntimeAdapter: connect/disconnect ────────────────────

  async connect(): Promise<void> {
    await this.inner.connect();
  }

  async disconnect(): Promise<void> {
    await this.inner.disconnect();
  }

  // ─── RuntimeAdapter: execute ──────────────────────────────

  async execute(command: OfficeCommand): Promise<CommandResult> {
    switch (command.commandType) {
      case CommandType.REVIEW_ASSIGN:
        return this.executeReviewAssign(command as OfficeCommand<ReviewAssignPayload>);
      case CommandType.REVIEW_SUBMIT:
        return this.executeReviewSubmit(command as OfficeCommand<ReviewSubmitPayload>);
      case CommandType.REVIEW_APPROVE:
        return this.executeReviewApprove(command as OfficeCommand<ReviewApprovePayload>);
      case CommandType.REVIEW_REJECT:
        return this.executeReviewReject(command as OfficeCommand<ReviewRejectPayload>);
      case CommandType.REVIEW_FINALIZE:
        return this.reject(
          command,
          "FORBIDDEN",
          "REVIEW_FINALIZE can only be called internally by the orchestrator"
        );
      default:
        return this.inner.execute(command);
    }
  }

  // ─── Review command handlers ───────────────────────────────

  private async executeReviewAssign(
    command: OfficeCommand<ReviewAssignPayload>
  ): Promise<CommandResult> {
    // Payload validation
    const p = command.payload;
    if (p.targetKind !== "pr" && p.targetKind !== "issue") {
      return this.reject(command, "INVALID_PAYLOAD", `Invalid targetKind: ${p.targetKind}`);
    }
    if (typeof p.targetNumber !== "number" || p.targetNumber <= 0) {
      return this.reject(command, "INVALID_PAYLOAD", `Invalid targetNumber: ${p.targetNumber}`);
    }
    if (typeof p.agentId !== "string" || p.agentId.length === 0) {
      return this.reject(command, "INVALID_PAYLOAD", "agentId is required");
    }

    // Delegate to inner adapter — it generates reviewId and emits REVIEW_ASSIGNED
    const result = await this.inner.execute(command);
    if (result.status !== "accepted") {
      return result;
    }

    const reviewId = result.affectedEventIds[0];

    // Store assignment
    this.assignedReviews.set(reviewId, {
      reviewId,
      targetKind: p.targetKind,
      targetNumber: p.targetNumber,
      agentId: p.agentId,
      assignedAt: new Date().toISOString(),
    });

    return result;
  }

  private async executeReviewSubmit(
    command: OfficeCommand<ReviewSubmitPayload>
  ): Promise<CommandResult> {
    const p = command.payload;
    if (typeof p.reviewId !== "string" || p.reviewId.length === 0) {
      return this.reject(command, "INVALID_PAYLOAD", "reviewId is required");
    }
    if (p.verdict !== "approved" && p.verdict !== "revision_required" && p.verdict !== "rejected") {
      return this.reject(command, "INVALID_PAYLOAD", `Invalid verdict: ${p.verdict}`);
    }
    if (typeof p.comment !== "string" || p.comment.length === 0) {
      return this.reject(command, "INVALID_PAYLOAD", "comment is required");
    }

    // Check assignment exists
    const assignment = this.assignedReviews.get(p.reviewId);
    if (!assignment) {
      return this.reject(command, "NOT_FOUND", `Review not found: ${p.reviewId}`);
    }

    // Check actor is the assigned agent
    if (command.actorId !== assignment.agentId) {
      return this.reject(command, "FORBIDDEN", `Actor ${command.actorId} is not the assigned reviewer ${assignment.agentId}`);
    }

    // Delegate to inner adapter — emits REVIEW_SUBMITTED
    const result = await this.inner.execute(command);
    if (result.status !== "accepted") {
      return result;
    }

    // Store draft (overwrites if re-submitted)
    this.submittedReviews.set(p.reviewId, {
      reviewId: p.reviewId,
      agentId: command.actorId,
      verdict: p.verdict,
      comment: p.comment,
      targetKind: assignment.targetKind,
      targetNumber: assignment.targetNumber,
      submittedAt: new Date().toISOString(),
    });

    return result;
  }

  private async executeReviewApprove(
    command: OfficeCommand<ReviewApprovePayload>
  ): Promise<CommandResult> {
    const p = command.payload;
    if (typeof p.reviewId !== "string" || p.reviewId.length === 0) {
      return this.reject(command, "INVALID_PAYLOAD", "reviewId is required");
    }

    // Check draft exists
    const draft = this.submittedReviews.get(p.reviewId);
    if (!draft) {
      return this.reject(command, "NOT_FOUND", `Review draft not found: ${p.reviewId}`);
    }

    // Send REVIEW_FINALIZE to inner adapter — emits ARTIFACT_REVIEWED
    const finalizeCommand: OfficeCommand<ReviewFinalizePayload> = {
      commandId: `cmd-finalize-${p.reviewId}`,
      commandType: CommandType.REVIEW_FINALIZE,
      timestamp: command.timestamp,
      source: "system",
      actorId: command.actorId,
      runtimeId: command.runtimeId,
      targetId: null,
      payload: {
        targetKind: draft.targetKind,
        targetNumber: draft.targetNumber,
        verdict: draft.verdict,
        comment: draft.comment,
        reviewerId: draft.agentId,
      },
    };

    const finalizeResult = await this.inner.execute(finalizeCommand);
    if (finalizeResult.status !== "accepted") {
      return finalizeResult;
    }

    // Emit audit note for approval
    await this.emitAuditNote(
      command.actorId,
      `Review ${p.reviewId} approved by ${command.actorId}. Verdict: ${draft.verdict}.`
    );

    // Clean up both maps
    this.assignedReviews.delete(p.reviewId);
    this.submittedReviews.delete(p.reviewId);

    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [...finalizeResult.affectedEventIds],
    };
  }

  private async executeReviewReject(
    command: OfficeCommand<ReviewRejectPayload>
  ): Promise<CommandResult> {
    const p = command.payload;
    if (typeof p.reviewId !== "string" || p.reviewId.length === 0) {
      return this.reject(command, "INVALID_PAYLOAD", "reviewId is required");
    }
    if (typeof p.reason !== "string" || p.reason.length === 0) {
      return this.reject(command, "INVALID_PAYLOAD", "reason is required");
    }

    // Check draft exists
    const draft = this.submittedReviews.get(p.reviewId);
    if (!draft) {
      return this.reject(command, "NOT_FOUND", `Review draft not found: ${p.reviewId}`);
    }

    // Emit audit note for rejection
    await this.emitAuditNote(
      command.actorId,
      `Review ${p.reviewId} rejected by ${command.actorId}. Reason: ${p.reason}.`
    );

    // Clean up both maps
    this.assignedReviews.delete(p.reviewId);
    this.submittedReviews.delete(p.reviewId);

    return {
      commandId: command.commandId,
      status: "accepted",
      affectedEventIds: [p.reviewId],
    };
  }

  // ─── Public state accessors ───────────────────────────────

  getAssignedReviews(): ReviewAssignment[] {
    return [...this.assignedReviews.values()];
  }

  getSubmittedReviews(): ReviewDraft[] {
    return [...this.submittedReviews.values()];
  }

  getReviewDraft(reviewId: Id): ReviewDraft | undefined {
    return this.submittedReviews.get(reviewId);
  }

  getIntegrationProjection(snapshot: RuntimeSnapshot): {
    github: { issues: unknown[]; pulls: unknown[]; auditNotes: unknown[] } | null;
    reviews: { assigned: ReviewAssignment[]; submitted: ReviewDraft[] };
  } {
    return {
      github:
        this.inner instanceof GitHubRuntimeAdapter
          ? projectGitHubIntegration(this.inner.getGitHubEvidence(), snapshot)
          : null,
      reviews: {
        assigned: this.getAssignedReviews(),
        submitted: this.getSubmittedReviews(),
      },
    };
  }

  // ─── Pass-through methods ──────────────────────────────────

  async getSnapshot(): Promise<RuntimeSnapshot> {
    return this.inner.getSnapshot();
  }

  getCapabilities(): AdapterCapabilities {
    const innerCaps = this.inner.getCapabilities();
    const reviewCommands = [
      CommandType.REVIEW_ASSIGN,
      CommandType.REVIEW_SUBMIT,
      CommandType.REVIEW_APPROVE,
      CommandType.REVIEW_REJECT,
    ];
    return {
      ...innerCaps,
      supportedCommands: [...innerCaps.supportedCommands, ...reviewCommands],
    };
  }

  subscribe(
    observer: RuntimeStreamObserver,
    options?: SubscribeOptions
  ): RuntimeSubscription {
    return this.inner.subscribe(observer, options);
  }

  // ─── Helpers ───────────────────────────────────────────────

  private reject(
    command: OfficeCommand,
    code: string,
    message: string
  ): CommandResult {
    return {
      commandId: command.commandId,
      status: "error",
      error: { code, message },
      affectedEventIds: [],
    };
  }

  private async emitAuditNote(author: Id, body: string): Promise<void> {
    await this.inner.execute({
      commandId: `cmd-audit-${Date.now()}`,
      commandType: CommandType.AUDIT_NOTE,
      timestamp: new Date().toISOString(),
      source: "system",
      actorId: author,
      runtimeId: "rt-orchestrator",
      targetId: null,
      payload: { body },
    });
  }
}

function projectGitHubIntegration(
  evidence: GitHubAdapterEvidence,
  snapshot: RuntimeSnapshot
): { issues: unknown[]; pulls: unknown[]; auditNotes: unknown[] } {
  const issues: unknown[] = [];
  const pulls: unknown[] = [];

  for (const task of snapshot.tasks) {
    const ref = evidence.tasks[task.taskId];
    if (!ref) continue;
    if (ref.kind === "issue") {
      issues.push({
        taskId: task.taskId,
        number: ref.number,
        kind: "issue",
        title: task.title,
        state: ref.rawState as "open" | "closed",
        stateReason: ref.stateReason,
        closedAt: ref.closedAt ?? null,
        labels: ref.labels,
        assignees: ref.assignees,
        url: ref.url,
      });
    }
  }

  for (const art of snapshot.artifacts) {
    const ref = evidence.artifacts[art.artifactId];
    if (!ref || ref.kind !== "pr") continue;
    const task = snapshot.tasks.find((t) => t.taskId === art.taskId);
    pulls.push({
      taskId: task?.taskId ?? art.taskId,
      artifactId: art.artifactId,
      number: ref.number,
      kind: "pr",
      title: art.title,
      state: ref.rawState as "open" | "closed" | "merged",
      draft: art.status === "draft",
      labels: ref.labels,
      reviewers: ref.reviewers ?? [],
      url: ref.url,
    });
  }

  return {
    issues,
    pulls,
    auditNotes: evidence.auditNotes.map((n) => ({
      auditId: n.auditId,
      taskId: n.taskId,
      body: n.body,
      author: n.author,
      createdAt: n.createdAt,
    })),
  };
}
