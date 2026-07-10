/**
 * GitHubRuntimeAdapter — 只读投影 adapter。
 *
 * 消费 GitHub fixture，产出标准 office DomainEvent 序列，
 * 经现有 reduceEvent reducer 生成 RuntimeSnapshot。
 *
 * 核心特性：
 * - 只读：execute() 对所有写命令返回 rejected
 * - 确定性：相同 fixture → 相同 event 序列（稳定 ID、固定时间戳、无 Date.now()）
 * - 不自建 agents/rooms：snapshot 中 agents=[] rooms=[]
 * - GitHub 用户作为 external actor evidence
 */
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  DomainEvent,
  OfficeCommand,
  CommandResult,
  AdapterCapabilities,
  RuntimeStreamObserver,
  RuntimeSubscription,
  RuntimeStreamError,
  SubscribeOptions,
  Id,
  Priority,
} from "@agent-office/protocol";
import { EventType, ALL_EVENT_TYPES } from "@agent-office/protocol";
import type { ReducerError } from "@agent-office/protocol";
import { reduceEvent, createEmptySnapshot } from "@agent-office/core";
import type {
  GitHubFixtures,
  GitHubIssueFixture,
  GitHubPRFixture,
  GitHubSourceRef,
  GitHubAdapterEvidence,
  GitHubLabel,
} from "./types.js";
import type { GitHubApiClient } from "./github-api-client.js";

const DEFAULT_RUNTIME_ID = "github-runtime-001";
const DEFAULT_BASE_TIMESTAMP = "2026-01-01T00:00:00Z";

export interface GitHubAdapterOptions {
  runtimeId?: string;
  baseTimestamp?: string;
}

export class GitHubRuntimeAdapter implements RuntimeAdapter {
  private connected = false;
  private subscribers = new Set<RuntimeStreamObserver>();
  private sequence = 0;
  private eventLog: DomainEvent[] = [];
  private evidence: GitHubAdapterEvidence = { tasks: {}, artifacts: {} };
  private runtimeId: string;
  private baseTimestamp: string;
  private correlationId = "corr-gh-001";
  private traceId = "trace-gh-001";
  private lastReplayErrors: ReducerError[] = [];
  private lastUpdatedAt: string = "";

  constructor(options: GitHubAdapterOptions = {}) {
    this.runtimeId = options.runtimeId ?? DEFAULT_RUNTIME_ID;
    this.baseTimestamp = options.baseTimestamp ?? DEFAULT_BASE_TIMESTAMP;
  }

  // ─── RuntimeAdapter 接口实现 ───────────────────────────────

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.subscribers.clear();
  }

  async getSnapshot(): Promise<RuntimeSnapshot> {
    let snapshot = createEmptySnapshot(this.runtimeId);
    // createEmptySnapshot 使用 Date.now()，需覆盖为确定性值
    snapshot.createdAt = this.baseTimestamp;
    snapshot.snapshotId = `snap-gh-${this.sequence}`;

    const allErrors: ReducerError[] = [];
    for (const event of this.eventLog) {
      const result = reduceEvent(snapshot, event);
      snapshot = result.snapshot;
      if (result.errors.length > 0) {
        allErrors.push(...result.errors);
      }
    }
    this.lastReplayErrors = allErrors;
    snapshot.lastEventId = this.eventLog.length > 0
      ? this.eventLog[this.eventLog.length - 1].eventId
      : "";
    snapshot.sequence = this.sequence;
    return snapshot;
  }

  /**
   * 返回最近一次 getSnapshot() replay 期间累积的 reducer errors。
   * 测试必须断言此方法返回空数组，以确保 projection 无非法状态转换。
   */
  getLastReplayErrors(): ReducerError[] {
    return [...this.lastReplayErrors];
  }

  subscribe(
    observer: RuntimeStreamObserver,
    options?: SubscribeOptions
  ): RuntimeSubscription {
    let closed = false;
    const cursor = options?.afterSequence;

    const ready = Promise.resolve().then(() => {
      if (closed) {
        throw {
          code: "aborted",
          message: "closed before ready",
          recoverable: false,
        } satisfies RuntimeStreamError;
      }
      observer.onState?.("opening");

      if (cursor !== undefined) {
        for (const event of this.eventLog) {
          if (closed) return;
          if (event.sequence > cursor) {
            observer.onEvent(event);
          }
        }
      }

      if (closed) return;
      this.subscribers.add(observer);
      observer.onState?.("ready");
    });

    return {
      ready,
      close: () => {
        if (closed) return;
        closed = true;
        this.subscribers.delete(observer);
        observer.onState?.("closed");
      },
    };
  }

  async execute(command: OfficeCommand): Promise<CommandResult> {
    return {
      commandId: command.commandId,
      status: "rejected",
      error: {
        code: "UNSUPPORTED_COMMAND",
        message: "GitHub Runtime Adapter v0 is read-only; no commands are supported",
      },
      affectedEventIds: [],
    };
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportedEvents: [...ALL_EVENT_TYPES],
      supportedCommands: [],
      features: {
        snapshot: true,
        sse: true,
        websocket: false,
        commandExecution: false,
        softMapping: false,
        hardOrchestration: false,
      },
    };
  }

  // ─── GitHub adapter 专属方法 ───────────────────────────────

  /**
   * 从 GitHub fixtures 重新投影，幂等。
   * 清空 eventLog 和 evidence，按确定性顺序重新生成事件。
   */
  syncFromFixtures(fixtures: GitHubFixtures): void {
    // 重置状态
    this.sequence = 0;
    this.eventLog = [];
    this.evidence = { tasks: {}, artifacts: {} };

    // 按 number 升序处理 issues
    const sortedIssues = [...fixtures.issues].sort((a, b) => a.number - b.number);
    for (const issue of sortedIssues) {
      this.processIssue(issue);
    }

    // 按 number 升序处理 PRs
    const sortedPRs = [...fixtures.pulls].sort((a, b) => a.number - b.number);
    for (const pr of sortedPRs) {
      this.processPR(pr);
    }
  }

  /**
   * 从真实 GitHub API 拉取并投影。
   * 委托给 GitHubApiClient 获取 fixtures，再调用 syncFromFixtures。
   * adapter 不持有 client，不读环境变量。
   */
  async syncFromApi(client: GitHubApiClient, owner: string, repo: string): Promise<void> {
    const [issues, pulls] = await Promise.all([
      client.fetchIssues(owner, repo),
      client.fetchPRs(owner, repo),
    ]);
    this.syncFromFixtures({ repo: { owner, name: repo }, issues, pulls });
  }

  /**
   * 增量同步：只拉取变更的 entities，只 emit 状态转换事件。
   * 首次调用（空 cursor）→ fallback 到 syncFromApi 全量同步。
   * 不清空 eventLog / evidence。
   */
  async syncIncremental(client: GitHubApiClient, owner: string, repo: string): Promise<void> {
    if (this.lastUpdatedAt === "") {
      await this.syncFromApi(client, owner, repo);
      this.lastUpdatedAt = this.deriveCursorFromEventLog();
      return;
    }

    const [issues, pulls] = await Promise.all([
      client.fetchIssuesSince(owner, repo, this.lastUpdatedAt),
      client.fetchPRsSince(owner, repo, this.lastUpdatedAt),
    ]);

    // Process issue deltas (sorted by number ascending, matching syncFromFixtures)
    for (const issue of issues.sort((a, b) => a.number - b.number)) {
      const taskId: Id = `gh-issue-${issue.number}`;
      const existing = this.evidence.tasks[taskId];
      if (!existing) {
        this.processIssue(issue);
      } else {
        this.emitIssueDelta(existing, issue);
      }
    }

    // Process PR deltas
    for (const pr of pulls.sort((a, b) => a.number - b.number)) {
      const taskId: Id = `gh-pr-task-${pr.number}`;
      const existing = this.evidence.tasks[taskId];
      if (!existing) {
        this.processPR(pr);
      } else {
        this.emitPRDelta(existing, pr);
      }
    }

    // Update cursor
    this.updateCursor(issues, pulls);
  }

  private deriveCursorFromEventLog(): string {
    if (this.eventLog.length === 0) return "";
    return this.eventLog
      .map((e) => e.occurredAt)
      .sort()
      .pop()!;
  }

  private updateCursor(issues: GitHubIssueFixture[], pulls: GitHubPRFixture[]): void {
    const allTimestamps = [
      ...issues.map((i) => i.updatedAt ?? i.createdAt),
      ...pulls.map((p) => p.updatedAt ?? p.createdAt),
    ];
    if (allTimestamps.length > 0) {
      const max = allTimestamps.sort().pop()!;
      if (max > this.lastUpdatedAt) {
        this.lastUpdatedAt = max;
      }
    }
  }

  getGitHubEvidence(): GitHubAdapterEvidence {
    return {
      tasks: { ...this.evidence.tasks },
      artifacts: { ...this.evidence.artifacts },
    };
  }

  getEventLog(): DomainEvent[] {
    return [...this.eventLog];
  }

  getCursor(): string {
    return this.lastUpdatedAt;
  }

  resetCursor(): void {
    this.lastUpdatedAt = "";
  }

  // ─── 内部：Issue 处理 ─────────────────────────────────────

  private processIssue(issue: GitHubIssueFixture): void {
    const taskId: Id = `gh-issue-${issue.number}`;
    const priority = this.derivePriority(issue.labels);
    const isBlocked = issue.labels.some((l) => l.name === "blocked");

    // 记录 evidence
    this.evidence.tasks[taskId] = this.buildIssueEvidence(issue);

    // task.created
    this.emit(EventType.TASK_CREATED, {
      taskId,
      title: issue.title,
      description: issue.body,
      priority,
      parentTaskId: null,
    }, "issue", issue.number, issue.createdAt);

    // 如果 blocked label 存在且 issue 为 open，发 task.blocked
    // closed issue 即使有 blocked label 也应直接转为 completed
    if (isBlocked && issue.state === "open") {
      this.emit(EventType.TASK_BLOCKED, {
        taskId,
        reason: "GitHub label: blocked",
      }, "issue", issue.number, issue.createdAt);
    }

    // 如果 issue 已 closed，发 task.completed
    if (issue.state === "closed" && issue.closedAt) {
      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "issue", issue.number, issue.closedAt);
    }
  }

  // ─── 内部：PR 处理 ────────────────────────────────────────

  private processPR(pr: GitHubPRFixture): void {
    const taskId: Id = `gh-pr-task-${pr.number}`;
    const artifactId: Id = `gh-pr-${pr.number}`;
    const priority = this.derivePriority(pr.labels);

    // 记录 evidence
    this.evidence.tasks[taskId] = this.buildPREvidence(pr);
    this.evidence.artifacts[artifactId] = this.buildPREvidence(pr);

    // task.created（PR task）
    this.emit(EventType.TASK_CREATED, {
      taskId,
      title: pr.title,
      description: pr.body,
      priority,
      parentTaskId: null,
    }, "pr", pr.number, pr.createdAt);

    // 根据 PR 状态发射 artifact 事件
    if (pr.merged) {
      // merged PR：artifact.created → artifact.delivered
      this.emit(EventType.ARTIFACT_CREATED, {
        artifactId,
        taskId,
        producerAgentId: "",
        type: "github_pr",
        title: pr.title,
        uri: pr.url,
        version: 1,
      }, "pr", pr.number, pr.createdAt);

      this.emit(EventType.ARTIFACT_DELIVERED, {
        artifactId,
        mergeCommitSha: pr.mergeCommitSha,
        mergedBy: pr.mergedBy?.login ?? "unknown",
      }, "pr", pr.number, pr.mergedAt ?? pr.closedAt ?? pr.createdAt);

      // task.completed
      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "pr", pr.number, pr.mergedAt ?? pr.closedAt ?? pr.createdAt);

    } else if (pr.state === "closed" && !pr.merged) {
      // closed unmerged PR：artifact.created → (artifact.reviewed(rejected) | artifact.closed) → task.completed
      this.emit(EventType.ARTIFACT_CREATED, {
        artifactId,
        taskId,
        producerAgentId: "",
        type: "github_pr",
        title: pr.title,
        uri: pr.url,
        version: 1,
      }, "pr", pr.number, pr.createdAt);

      if (pr.reviews.length > 0) {
        // 有已提交 review：用真实 reviewerId 发 artifact.reviewed(rejected)
        const review = pr.reviews[0];
        this.emit(EventType.ARTIFACT_REVIEWED, {
          artifactId,
          reviewerId: review.author.login,
          verdict: "rejected" as const,
          comment: review.body,
        }, "pr", pr.number, review.submittedAt);
      } else {
        // 无 review：用 artifact.closed 表达 closure，不伪造 reviewerId
        this.emit(EventType.ARTIFACT_CLOSED, {
          artifactId,
          closedBy: null,
          reason: "closed-unmerged",
        }, "pr", pr.number, pr.closedAt ?? pr.createdAt);
      }

      // task.completed（closed-unmerged 也算完成，evidence 标记）
      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "pr", pr.number, pr.closedAt ?? pr.createdAt);

    } else if (pr.draft) {
      // draft PR：artifact.drafted
      this.emit(EventType.ARTIFACT_DRAFTED, {
        artifactId,
        taskId,
        producerAgentId: null,
        type: "github_pr",
        title: pr.title,
        uri: pr.url,
        version: 1,
      }, "pr", pr.number, pr.createdAt);

    } else {
      // open PR（ready）
      this.emit(EventType.ARTIFACT_CREATED, {
        artifactId,
        taskId,
        producerAgentId: "",
        type: "github_pr",
        title: pr.title,
        uri: pr.url,
        version: 1,
      }, "pr", pr.number, pr.createdAt);

      if (pr.reviews.length > 0) {
        // 有已提交 review
        const review = pr.reviews[0];
        const verdict = review.state === "APPROVED" ? "approved" as const
          : review.state === "CHANGES_REQUESTED" ? "revision_required" as const
          : null;

        if (verdict !== null) {
          this.emit(EventType.ARTIFACT_REVIEWED, {
            artifactId,
            reviewerId: review.author.login,
            verdict,
            comment: review.body,
          }, "pr", pr.number, review.submittedAt);
        }
        // COMMENTED review 不产生 artifact 事件（evidence only）
      } else if (pr.requestedReviewers.length > 0) {
        // review requested（无已提交 review）
        this.emit(EventType.ARTIFACT_REVIEW_REQUESTED, {
          artifactId,
          reviewerIds: pr.requestedReviewers.map((r) => r.login),
        }, "pr", pr.number, pr.createdAt);
      }
    }
  }

  // ─── 内部：Label → Priority 映射 ──────────────────────────

  private derivePriority(labels: GitHubLabel[]): Priority {
    const names = labels.map((l) => l.name.toLowerCase());
    if (names.includes("priority:urgent") || names.includes("p0")) return "urgent";
    if (names.includes("priority:high") || names.includes("p1")) return "high";
    if (names.includes("priority:low")) return "low";
    return "normal";
  }

  // ─── 内部：Evidence 构建 ───────────────────────────────────

  private buildIssueEvidence(issue: GitHubIssueFixture): GitHubSourceRef {
    return {
      kind: "issue",
      number: issue.number,
      url: issue.url,
      rawState: issue.state,
      stateReason: issue.stateReason,
      closedAt: issue.closedAt,
      labels: issue.labels.map((l) => l.name),
      assignees: issue.assignees.map((a) => a.login),
      comments: issue.comments.map((c) => ({
        author: c.author.login,
        body: c.body,
        createdAt: c.createdAt,
      })),
    };
  }

  private buildPREvidence(pr: GitHubPRFixture): GitHubSourceRef {
    return {
      kind: "pr",
      number: pr.number,
      url: pr.url,
      rawState: pr.merged ? "merged" : pr.state,
      stateReason: pr.merged ? "merged" : (pr.state === "closed" ? "closed-unmerged" : undefined),
      closedAt: pr.merged ? pr.mergedAt : pr.closedAt,
      labels: pr.labels.map((l) => l.name),
      assignees: [],
      reviewers: pr.requestedReviewers.map((r) => r.login),
      comments: pr.comments.map((c) => ({
        author: c.author.login,
        body: c.body,
        createdAt: c.createdAt,
      })),
      refsIssueNumbers: this.parseRefsIssueNumbers(pr.body),
    };
  }

  private parseRefsIssueNumbers(body: string): number[] {
    const regex = /(?:closes?|refs?)\s+#(\d+)/gi;
    const numbers: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body)) !== null) {
      numbers.push(parseInt(match[1], 10));
    }
    return numbers;
  }

  // ─── 内部：Delta 发射（Task 5 实现） ─────────────────────

  private emitIssueDelta(oldRef: GitHubSourceRef, newFixture: GitHubIssueFixture): void {
    const taskId: Id = `gh-issue-${newFixture.number}`;

    // Update evidence
    this.evidence.tasks[taskId] = this.buildIssueEvidence(newFixture);

    // State transition: open → closed
    if (oldRef.rawState === "open" && newFixture.state === "closed") {
      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "issue", newFixture.number, newFixture.closedAt ?? newFixture.createdAt);
    }
    // closed → reopened: no event (v0 limitation — no TASK_REOPENED EventType)
    // unchanged: no event
  }

  private emitPRDelta(oldRef: GitHubSourceRef, newFixture: GitHubPRFixture): void {
    const taskId: Id = `gh-pr-task-${newFixture.number}`;
    const artifactId: Id = `gh-pr-${newFixture.number}`;

    // Update evidence
    this.evidence.tasks[taskId] = this.buildPREvidence(newFixture);
    this.evidence.artifacts[artifactId] = this.buildPREvidence(newFixture);

    const oldWasOpen = oldRef.rawState === "open";
    const newIsMerged = newFixture.merged;
    const newIsClosedUnmerged = newFixture.state === "closed" && !newFixture.merged;

    if (oldWasOpen && newIsMerged) {
      // open → merged
      this.emit(EventType.ARTIFACT_DELIVERED, {
        artifactId,
        mergeCommitSha: newFixture.mergeCommitSha,
        mergedBy: newFixture.mergedBy?.login ?? "unknown",
      }, "pr", newFixture.number, newFixture.mergedAt ?? newFixture.closedAt ?? newFixture.createdAt);

      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "pr", newFixture.number, newFixture.mergedAt ?? newFixture.closedAt ?? newFixture.createdAt);
    } else if (oldWasOpen && newIsClosedUnmerged) {
      // open → closed-unmerged
      this.emit(EventType.ARTIFACT_CLOSED, {
        artifactId,
        closedBy: null,
        reason: "closed-unmerged",
      }, "pr", newFixture.number, newFixture.closedAt ?? newFixture.createdAt);

      this.emit(EventType.TASK_COMPLETED, {
        taskId,
      }, "pr", newFixture.number, newFixture.closedAt ?? newFixture.createdAt);
    }
    // unchanged: no event
  }

  // ─── 内部：事件发射 ────────────────────────────────────────

  private emit<P>(
    type: string,
    payload: P,
    entityKind: "issue" | "pr",
    entityNumber: number,
    occurredAt: string
  ): void {
    const seq = ++this.sequence;
    const event: DomainEvent<P> = {
      eventId: `evt-gh-${seq}-${entityKind}-${entityNumber}`,
      runtimeId: this.runtimeId,
      sequence: seq,
      schemaVersion: "1.0",
      type,
      occurredAt,
      receivedAt: occurredAt,
      correlationId: this.correlationId,
      causationId: this.eventLog.length > 0
        ? this.eventLog[this.eventLog.length - 1].eventId
        : null,
      traceId: this.traceId,
      payload,
    };
    this.eventLog.push(event);
    // 推送给订阅者（同步，与 MockRuntimeAdapter delay=0 一致）
    for (const observer of this.subscribers) {
      observer.onEvent(event);
    }
  }
}
