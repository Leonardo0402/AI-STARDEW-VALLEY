/**
 * Partial-cascade transactional tests（Task 5 / P0-3）。
 *
 * 验证 reducer 在检测到 cascade failure 之前对 candidate snapshot 做的 partial
 * mutations 不会被 SnapshotStore 提交（事务性提交，源自 Task 1）。
 *
 * Reducer 行为（reducer.ts）：
 *   - APPROVAL_REQUESTED：先 push approval + 设置 task.approvalId，再检查 task 转换
 *   - ARTIFACT_REVIEWED(revision_required)：先改 artifact.status + reviewResult，再检查 task 转换
 *   - APPROVAL_RESOLVED(rejected)：先改 approval.status + resolvedBy/resolvedAt，再检查 task 转换
 *
 * 当 task 转换非法时，candidate snapshot 已含 partial mutations。store 的 applyEvent
 * 必须不采用该 candidate snapshot，但 transport cursor（sequence / lastEventId）仍推进。
 *
 * 每个 scenario 验证：
 *   1. result.code === "reducer_rejected"，reducerErrors 恰好 1 条 invalid_transition
 *   2. snapshot 中无 partial mutation（domain entities 未变）
 *   3. sequence / event log 推进（transport 已接受）
 *   4. rebuildFromLog 重放后状态一致（replay consistency）
 */
import { describe, it, expect } from "vitest";
import { SnapshotStore } from "./store.js";
import {
  EventType,
  type DomainEvent,
  type RuntimeSnapshot,
  type TaskSnapshot,
  type ArtifactSnapshot,
  type ApprovalSnapshot,
} from "@agent-office/protocol";

const RUNTIME_ID = "test-runtime-cascade";

function makeEvent<P>(
  seq: number,
  type: string,
  payload: P,
  overrides: Partial<DomainEvent<P>> = {}
): DomainEvent<P> {
  const now = new Date().toISOString();
  return {
    eventId: `evt-${seq}-${Math.random().toString(36).slice(2, 8)}`,
    runtimeId: RUNTIME_ID,
    sequence: seq,
    schemaVersion: "1.0",
    type,
    occurredAt: now,
    receivedAt: now,
    correlationId: "corr-cascade",
    causationId: null,
    traceId: "trace-cascade",
    payload,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    taskId: "t-1",
    runtimeId: RUNTIME_ID,
    title: "Task t-1",
    description: "",
    status: "created",
    priority: "normal",
    parentTaskId: null,
    assigneeId: null,
    roomId: null,
    dependencyIds: [],
    artifactIds: [],
    approvalId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    blockedReason: null,
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<ArtifactSnapshot> = {}): ArtifactSnapshot {
  return {
    artifactId: "a-1",
    runtimeId: RUNTIME_ID,
    taskId: "t-1",
    producerAgentId: "agent-1",
    type: "code",
    title: "Artifact a-1",
    status: "generated",
    uri: null,
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    reviewResult: null,
    ...overrides,
  };
}

function makeApproval(overrides: Partial<ApprovalSnapshot> = {}): ApprovalSnapshot {
  return {
    approvalId: "ap-1",
    runtimeId: RUNTIME_ID,
    taskId: "t-1",
    kind: "artifact_delivery",
    status: "requested",
    requestedBy: "agent-1",
    resolvedBy: null,
    payloadRef: "",
    reason: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    resolvedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

function makeCheckpoint(
  sequence: number,
  opts: {
    tasks?: TaskSnapshot[];
    artifacts?: ArtifactSnapshot[];
    approvals?: ApprovalSnapshot[];
  } = {}
): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID,
    snapshotId: `snap-cp-${sequence}`,
    sequence,
    schemaVersion: "1.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastEventId: `evt-cp-${sequence}`,
    agents: [],
    tasks: opts.tasks ?? [],
    artifacts: opts.artifacts ?? [],
    approvals: opts.approvals ?? [],
    rooms: [],
  };
}

describe("partial-cascade: transactional commit prevents partial mutations (Task 5 / P0-3)", () => {
  // ─── Scenario 1 ───────────────────────────────────────────
  describe("approval.requested appends candidate Approval, then Task cannot enter waiting_approval", () => {
    it("should not commit partial domain mutations", () => {
      const CP_SEQ = 100;
      const store = new SnapshotStore(RUNTIME_ID);
      // checkpoint: task t-1 in "created" state
      // state-machine.ts: created: ["queued", "assigned", "cancelled"] — 不能 → waiting_approval
      const cp = makeCheckpoint(CP_SEQ, {
        tasks: [makeTask({ taskId: "t-1", status: "created" })],
      });
      store.setSnapshot(cp);

      // 触发 cascade：APPROVAL_REQUESTED for t-1
      // reducer 行为：先 push approval + 设 task.approvalId，再检查 task 转换（失败）
      const evt = makeEvent(CP_SEQ + 1, EventType.APPROVAL_REQUESTED, {
        approvalId: "ap-1",
        taskId: "t-1",
        kind: "artifact_delivery",
        requestedBy: "agent-1",
        reason: "need approval",
      });
      const result = store.applyEvent(evt);

      // 1. result：reducer_rejected + 恰好 1 条 invalid_transition
      expect(result.code).toBe("reducer_rejected");
      expect(result.reducerErrors).toHaveLength(1);
      expect(result.reducerErrors![0].code).toBe("invalid_transition");
      expect(result.reducerErrors![0].entityPath).toBe("tasks:t-1");

      // 2. 无 partial mutation：approvals 仍为空，task.approvalId 仍为 null，task.status 仍为 created
      const snap = store.getSnapshot();
      expect(snap.approvals).toHaveLength(0);
      expect(snap.tasks[0].approvalId).toBeNull();
      expect(snap.tasks[0].status).toBe("created");

      // 3. transport 已接受：sequence / log 推进
      expect(store.getLastSequence()).toBe(evt.sequence);
      const log = store.getEventLog();
      expect(log.some((e) => e.eventId === evt.eventId)).toBe(true);

      // 4. replay consistency：rebuildFromLog 后状态一致
      store.rebuildFromLog();
      const replayed = store.getSnapshot();
      expect(replayed.approvals).toHaveLength(0);
      expect(replayed.tasks[0].approvalId).toBeNull();
      expect(replayed.tasks[0].status).toBe("created");
    });
  });

  // ─── Scenario 2 ───────────────────────────────────────────
  describe("artifact.reviewed(revision_required) changes candidate Artifact, then Task cannot enter revision_required", () => {
    it("should not commit partial domain mutations", () => {
      const CP_SEQ = 100;
      const store = new SnapshotStore(RUNTIME_ID);
      // checkpoint: task t-1 in "created" + artifact a-1 linked to t-1 in "generated"
      // state-machine.ts: created: ["queued", "assigned", "cancelled"] — 不能 → revision_required
      // generated: ["under_review", "approved", "revision_required", "rejected"] — artifact 转换合法
      const cp = makeCheckpoint(CP_SEQ, {
        tasks: [makeTask({ taskId: "t-1", status: "created" })],
        artifacts: [
          makeArtifact({ artifactId: "a-1", taskId: "t-1", status: "generated" }),
        ],
      });
      store.setSnapshot(cp);

      // 触发 cascade：ARTIFACT_REVIEWED verdict=revision_required
      // reducer 行为：artifact 转换合法 → 改 artifact.status + reviewResult，再检查 task 转换（失败）
      const evt = makeEvent(CP_SEQ + 1, EventType.ARTIFACT_REVIEWED, {
        artifactId: "a-1",
        reviewerId: "agent-2",
        verdict: "revision_required",
        comment: "needs work",
      });
      const result = store.applyEvent(evt);

      // 1. result：reducer_rejected + 恰好 1 条 invalid_transition
      expect(result.code).toBe("reducer_rejected");
      expect(result.reducerErrors).toHaveLength(1);
      expect(result.reducerErrors![0].code).toBe("invalid_transition");
      expect(result.reducerErrors![0].entityPath).toBe("tasks:t-1");

      // 2. 无 partial mutation：artifact.status 仍为 generated，reviewResult 仍为 null，task.status 仍为 created
      const snap = store.getSnapshot();
      expect(snap.artifacts[0].status).toBe("generated");
      expect(snap.artifacts[0].reviewResult).toBeNull();
      expect(snap.tasks[0].status).toBe("created");

      // 3. transport 已接受：sequence / log 推进
      expect(store.getLastSequence()).toBe(evt.sequence);
      const log = store.getEventLog();
      expect(log.some((e) => e.eventId === evt.eventId)).toBe(true);

      // 4. replay consistency：rebuildFromLog 后状态一致
      store.rebuildFromLog();
      const replayed = store.getSnapshot();
      expect(replayed.artifacts[0].status).toBe("generated");
      expect(replayed.artifacts[0].reviewResult).toBeNull();
      expect(replayed.tasks[0].status).toBe("created");
    });
  });

  // ─── Scenario 3 ───────────────────────────────────────────
  describe("approval.resolved(rejected) changes candidate Approval, then Task cannot enter revision_required", () => {
    it("should not commit partial domain mutations", () => {
      const CP_SEQ = 100;
      const store = new SnapshotStore(RUNTIME_ID);
      // checkpoint: task t-1 in "blocked" + approval ap-1 linked to t-1 in "requested"
      // state-machine.ts: blocked: ["running", "failed", "cancelled"] — 不能 → revision_required
      // requested: ["approved", "rejected", "expired", "cancelled"] — approval 转换合法
      const cp = makeCheckpoint(CP_SEQ, {
        tasks: [makeTask({ taskId: "t-1", status: "blocked" })],
        approvals: [
          makeApproval({ approvalId: "ap-1", taskId: "t-1", status: "requested" }),
        ],
      });
      store.setSnapshot(cp);

      // 触发 cascade：APPROVAL_RESOLVED status=rejected
      // reducer 行为：approval 转换合法 → 改 approval.status + resolvedBy/resolvedAt，
      //   因 status=rejected → 检查 task 转换（blocked → revision_required 失败）
      const evt = makeEvent(CP_SEQ + 1, EventType.APPROVAL_RESOLVED, {
        approvalId: "ap-1",
        status: "rejected",
        resolvedBy: "agent-2",
      });
      const result = store.applyEvent(evt);

      // 1. result：reducer_rejected + 恰好 1 条 invalid_transition
      expect(result.code).toBe("reducer_rejected");
      expect(result.reducerErrors).toHaveLength(1);
      expect(result.reducerErrors![0].code).toBe("invalid_transition");
      expect(result.reducerErrors![0].entityPath).toBe("tasks:t-1");

      // 2. 无 partial mutation：approval.status 仍为 requested，resolvedBy/resolvedAt 仍为 null，task.status 仍为 blocked
      const snap = store.getSnapshot();
      expect(snap.approvals[0].status).toBe("requested");
      expect(snap.approvals[0].resolvedBy).toBeNull();
      expect(snap.approvals[0].resolvedAt).toBeNull();
      expect(snap.tasks[0].status).toBe("blocked");

      // 3. transport 已接受：sequence / log 推进
      expect(store.getLastSequence()).toBe(evt.sequence);
      const log = store.getEventLog();
      expect(log.some((e) => e.eventId === evt.eventId)).toBe(true);

      // 4. replay consistency：rebuildFromLog 后状态一致
      store.rebuildFromLog();
      const replayed = store.getSnapshot();
      expect(replayed.approvals[0].status).toBe("requested");
      expect(replayed.approvals[0].resolvedBy).toBeNull();
      expect(replayed.approvals[0].resolvedAt).toBeNull();
      expect(replayed.tasks[0].status).toBe("blocked");
    });
  });
});
