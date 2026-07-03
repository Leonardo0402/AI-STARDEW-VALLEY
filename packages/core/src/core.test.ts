/**
 * Core 包测试 — 覆盖 Reducer、Dedup、StateMachine、Store、Policy、Gateway、Projection。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SnapshotStore,
  EventDeduplicator,
  CommandGateway,
  reduceEvent,
  replayEvents,
  createEmptySnapshot,
  projectSnapshot,
  isValidAgentTransition,
  isValidTaskTransition,
  isValidArtifactTransition,
  isValidApprovalTransition,
} from "@agent-office/core";
import {
  EventType,
  CommandType,
  type DomainEvent,
  type RuntimeSnapshot,
  type OfficeCommand,
  type CommandResult,
  type AgentStatusChangedPayload,
  type TaskCreatedPayload,
  type TaskAssignedPayload,
  type TaskStartedPayload,
  type TaskBlockedPayload,
  type TaskCompletedPayload,
  type ArtifactCreatedPayload,
  type ArtifactReviewedPayload,
  type ApprovalRequestedPayload,
  type ApprovalResolvedPayload,
  type ErrorRaisedPayload,
} from "@agent-office/protocol";

const RUNTIME_ID = "test-runtime";

function makeEvent<P>(
  seq: number,
  type: string,
  payload: P,
  overrides: Partial<DomainEvent<P>> = {}
): DomainEvent<P> {
  const now = new Date().toISOString();
  return {
    eventId: `evt-${seq}`,
    runtimeId: RUNTIME_ID,
    sequence: seq,
    schemaVersion: "1.0",
    type,
    occurredAt: now,
    receivedAt: now,
    correlationId: "corr-1",
    causationId: null,
    traceId: "trace-1",
    payload,
    ...overrides,
  };
}

describe("EventDeduplicator", () => {
  it("should detect duplicate eventIds", () => {
    const dedup = new EventDeduplicator(100);
    expect(dedup.checkAndMark("evt-1")).toBe(false);
    expect(dedup.checkAndMark("evt-1")).toBe(true);
    expect(dedup.checkAndMark("evt-2")).toBe(false);
  });

  it("should evict old entries when over maxSize", () => {
    const dedup = new EventDeduplicator(3);
    dedup.checkAndMark("a");
    dedup.checkAndMark("b");
    dedup.checkAndMark("c");
    dedup.checkAndMark("d");
    // "a" should be evicted
    expect(dedup.checkAndMark("a")).toBe(false);
    // "d" should still be there
    expect(dedup.checkAndMark("d")).toBe(true);
  });
});

describe("State Machine", () => {
  it("should allow valid agent transitions", () => {
    expect(isValidAgentTransition("offline", "idle")).toBe(true);
    expect(isValidAgentTransition("idle", "working")).toBe(true);
    expect(isValidAgentTransition("working", "blocked")).toBe(true);
    expect(isValidAgentTransition("working", "paused")).toBe(true);
    expect(isValidAgentTransition("paused", "working")).toBe(true);
  });

  it("should reject invalid agent transitions", () => {
    expect(isValidAgentTransition("offline", "working")).toBe(false);
    expect(isValidAgentTransition("idle", "offline")).toBe(false);
    expect(isValidAgentTransition("completed" as never, "idle")).toBe(false);
  });

  it("should allow valid task transitions", () => {
    expect(isValidTaskTransition("created", "assigned")).toBe(true);
    expect(isValidTaskTransition("assigned", "running")).toBe(true);
    expect(isValidTaskTransition("running", "blocked")).toBe(true);
    expect(isValidTaskTransition("blocked", "running")).toBe(true);
    expect(isValidTaskTransition("running", "completed")).toBe(true);
  });

  it("should reject invalid task transitions", () => {
    expect(isValidTaskTransition("created", "running")).toBe(false);
    expect(isValidTaskTransition("completed", "running")).toBe(false);
    expect(isValidTaskTransition("cancelled", "running")).toBe(false);
  });

  it("should allow valid artifact transitions", () => {
    expect(isValidArtifactTransition("generated", "under_review")).toBe(true);
    expect(isValidArtifactTransition("under_review", "approved")).toBe(true);
    expect(isValidArtifactTransition("revision_required", "generated")).toBe(true);
  });

  it("should reject invalid artifact transitions", () => {
    expect(isValidArtifactTransition("draft", "approved")).toBe(false);
    expect(isValidArtifactTransition("rejected", "approved")).toBe(false);
  });

  it("should allow valid approval transitions", () => {
    expect(isValidApprovalTransition("requested", "approved")).toBe(true);
    expect(isValidApprovalTransition("requested", "rejected")).toBe(true);
  });

  it("should reject invalid approval transitions", () => {
    expect(isValidApprovalTransition("approved", "rejected")).toBe(false);
    expect(isValidApprovalTransition("rejected", "approved")).toBe(false);
  });
});

describe("Reducer", () => {
  it("should handle agent.spawned", () => {
    const snap = createEmptySnapshot(RUNTIME_ID);
    const event = makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "a1",
      name: "Worker-1",
      role: "worker" as const,
    });
    const result = reduceEvent(snap, event);
    expect(result.snapshot.agents).toHaveLength(1);
    expect(result.snapshot.agents[0].agentId).toBe("a1");
    expect(result.snapshot.agents[0].status).toBe("idle");
  });

  it("should handle task lifecycle events", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    // spawn agent
    snap = reduceEvent(snap, makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    })).snapshot;
    // create task
    snap = reduceEvent(snap, makeEvent(2, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test Task", description: "desc",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].status).toBe("created");
    // assign task
    snap = reduceEvent(snap, makeEvent(3, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    })).snapshot;
    expect(snap.tasks[0].status).toBe("assigned");
    expect(snap.tasks[0].assigneeId).toBe("w1");
    // start task
    snap = reduceEvent(snap, makeEvent(4, EventType.TASK_STARTED, {
      taskId: "t1", agentId: "w1",
    })).snapshot;
    expect(snap.tasks[0].status).toBe("running");
    // complete task
    snap = reduceEvent(snap, makeEvent(5, EventType.TASK_COMPLETED, {
      taskId: "t1",
    })).snapshot;
    expect(snap.tasks[0].status).toBe("completed");
  });

  it("should reject invalid state transitions and keep original state", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    // try to complete a "created" task (invalid)
    const result = reduceEvent(snap, makeEvent(2, EventType.TASK_COMPLETED, {
      taskId: "t1",
    }));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.snapshot.tasks[0].status).toBe("created"); // unchanged
  });

  it("should prevent task completion when approval is not approved", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    // create and run task
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(2, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(3, EventType.TASK_STARTED, {
      taskId: "t1", agentId: "w1",
    })).snapshot;
    // request approval
    snap = reduceEvent(snap, makeEvent(4, EventType.APPROVAL_REQUESTED, {
      approvalId: "ap1", taskId: "t1",
      kind: "artifact_delivery" as const,
      requestedBy: "r1", reason: "review",
    })).snapshot;
    expect(snap.tasks[0].status).toBe("waiting_approval");
    // try to complete (should fail - approval not approved)
    const result = reduceEvent(snap, makeEvent(5, EventType.TASK_COMPLETED, {
      taskId: "t1",
    }));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.snapshot.tasks[0].status).toBe("waiting_approval"); // unchanged
  });

  it("should allow task completion when approval is approved", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(2, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(3, EventType.TASK_STARTED, {
      taskId: "t1", agentId: "w1",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(4, EventType.APPROVAL_REQUESTED, {
      approvalId: "ap1", taskId: "t1",
      kind: "artifact_delivery" as const,
      requestedBy: "r1", reason: "review",
    })).snapshot;
    // approve
    snap = reduceEvent(snap, makeEvent(5, EventType.APPROVAL_RESOLVED, {
      approvalId: "ap1", status: "approved" as const, resolvedBy: "user-1",
    })).snapshot;
    expect(snap.approvals[0].status).toBe("approved");
    // now complete should work — task is in waiting_approval
    // need reviewing → completed, but waiting_approval → completed is allowed
    snap = reduceEvent(snap, makeEvent(6, EventType.TASK_COMPLETED, {
      taskId: "t1",
    })).snapshot;
    expect(snap.tasks[0].status).toBe("completed");
  });

  it("should handle artifact review revision_required", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(2, EventType.ARTIFACT_CREATED, {
      artifactId: "art1", taskId: "t1", producerAgentId: "w1",
      type: "report", title: "Report", uri: null, version: 1,
    })).snapshot;
    // review as revision_required
    snap = reduceEvent(snap, makeEvent(3, EventType.ARTIFACT_REVIEWED, {
      artifactId: "art1", reviewerId: "r1",
      verdict: "revision_required" as const, comment: "fix it",
    })).snapshot;
    expect(snap.artifacts[0].status).toBe("revision_required");
    expect(snap.artifacts[0].reviewResult?.verdict).toBe("revision_required");
  });

  it("should handle approval rejection → task revision_required", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(2, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(3, EventType.TASK_STARTED, {
      taskId: "t1", agentId: "w1",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(4, EventType.APPROVAL_REQUESTED, {
      approvalId: "ap1", taskId: "t1",
      kind: "artifact_delivery" as const,
      requestedBy: "r1", reason: "review",
    })).snapshot;
    // reject approval
    snap = reduceEvent(snap, makeEvent(5, EventType.APPROVAL_RESOLVED, {
      approvalId: "ap1", status: "rejected" as const, resolvedBy: "user-1",
    })).snapshot;
    expect(snap.approvals[0].status).toBe("rejected");
    // 断言：审批被拒绝后，Task 必须进入 revision_required
    expect(snap.tasks[0].status).toBe("revision_required");
  });

  it("should move task to revision_required when artifact review verdict is revision_required", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(2, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(3, EventType.TASK_STARTED, {
      taskId: "t1", agentId: "w1",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(4, EventType.ARTIFACT_CREATED, {
      artifactId: "art1", taskId: "t1", producerAgentId: "w1",
      type: "report", title: "Report", uri: null, version: 1,
    })).snapshot;
    // 审查要求返工
    snap = reduceEvent(snap, makeEvent(5, EventType.ARTIFACT_REVIEWED, {
      artifactId: "art1", reviewerId: "r1",
      verdict: "revision_required" as const, comment: "fix it",
    })).snapshot;
    // 断言：artifact 进入 revision_required
    expect(snap.artifacts[0].status).toBe("revision_required");
    // 断言：关联 Task 必须进入 revision_required
    expect(snap.tasks[0].status).toBe("revision_required");
  });

  it("should prevent task completion when approval is requested", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(2, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(3, EventType.TASK_STARTED, {
      taskId: "t1", agentId: "w1",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(4, EventType.APPROVAL_REQUESTED, {
      approvalId: "ap1", taskId: "t1",
      kind: "artifact_delivery" as const,
      requestedBy: "r1", reason: "review",
    })).snapshot;
    // 审批处于 requested 状态时，Task 不得完成
    const result = reduceEvent(snap, makeEvent(5, EventType.TASK_COMPLETED, {
      taskId: "t1",
    }));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.snapshot.tasks[0].status).toBe("waiting_approval");
  });

  it("should prevent task completion when approval is rejected", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    snap = reduceEvent(snap, makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(2, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(3, EventType.TASK_STARTED, {
      taskId: "t1", agentId: "w1",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(4, EventType.APPROVAL_REQUESTED, {
      approvalId: "ap1", taskId: "t1",
      kind: "artifact_delivery" as const,
      requestedBy: "r1", reason: "review",
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(5, EventType.APPROVAL_RESOLVED, {
      approvalId: "ap1", status: "rejected" as const, resolvedBy: "user-1",
    })).snapshot;
    // 审批被拒绝后，Task 处于 revision_required，不得完成
    const result = reduceEvent(snap, makeEvent(6, EventType.TASK_COMPLETED, {
      taskId: "t1",
    }));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.snapshot.tasks[0].status).toBe("revision_required");
  });

  it("should clean up old assignee on task reassignment (Worker → Reviewer)", () => {
    let snap = createEmptySnapshot(RUNTIME_ID);
    // 初始化两个 agent
    snap = reduceEvent(snap, makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(2, EventType.AGENT_SPAWNED, {
      agentId: "r1", name: "Reviewer-1", role: "reviewer" as const,
    })).snapshot;
    // 预设两个 room（Room 是初始数据，不通过事件创建）
    snap.rooms.push(
      { roomId: "room-exec", runtimeId: RUNTIME_ID, name: "Execution", type: "execution", bounds: { x: 0, y: 0, width: 100, height: 100 }, activeAgentIds: [], visualState: {} },
      { roomId: "room-review", runtimeId: RUNTIME_ID, name: "Review", type: "review", bounds: { x: 0, y: 0, width: 100, height: 100 }, activeAgentIds: [], visualState: {} },
    );
    // 创建任务并分配给 Worker-1
    snap = reduceEvent(snap, makeEvent(3, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    })).snapshot;
    snap = reduceEvent(snap, makeEvent(4, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    })).snapshot;
    expect(snap.tasks[0].assigneeId).toBe("w1");
    expect(snap.agents.find((a) => a.agentId === "w1")!.currentTaskId).toBe("t1");
    expect(snap.rooms.find((r) => r.roomId === "room-exec")!.activeAgentIds).toContain("w1");
    // 转交给 Reviewer-1（新 room）
    snap = reduceEvent(snap, makeEvent(5, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "r1", roomId: "room-review",
    })).snapshot;
    // 断言：新 assignee 是 r1
    expect(snap.tasks[0].assigneeId).toBe("r1");
    expect(snap.tasks[0].roomId).toBe("room-review");
    // 断言：旧 Worker 不再持有此 Task
    expect(snap.agents.find((a) => a.agentId === "w1")!.currentTaskId).toBeNull();
    // 断言：旧 Worker 已从旧 Room 移除
    expect(snap.rooms.find((r) => r.roomId === "room-exec")!.activeAgentIds).not.toContain("w1");
    // 断言：新 Reviewer 持有此 Task
    expect(snap.agents.find((a) => a.agentId === "r1")!.currentTaskId).toBe("t1");
    // 断言：新 Reviewer 在新 Room
    expect(snap.rooms.find((r) => r.roomId === "room-review")!.activeAgentIds).toContain("r1");
  });
});

describe("replayEvents", () => {
  it("should produce the same snapshot when replayed", () => {
    const events: DomainEvent[] = [
      makeEvent(1, EventType.AGENT_SPAWNED, {
        agentId: "w1", name: "Worker-1", role: "worker" as const,
      }),
      makeEvent(2, EventType.TASK_CREATED, {
        taskId: "t1", title: "Test", description: "desc",
        priority: "normal" as const, parentTaskId: null,
      }),
      makeEvent(3, EventType.TASK_ASSIGNED, {
        taskId: "t1", agentId: "w1", roomId: "room-exec",
      }),
      makeEvent(4, EventType.TASK_STARTED, {
        taskId: "t1", agentId: "w1",
      }),
      makeEvent(5, EventType.TASK_COMPLETED, {
        taskId: "t1",
      }),
    ];

    // First pass
    const result1 = replayEvents(events, RUNTIME_ID);
    // Second pass
    const result2 = replayEvents(events, RUNTIME_ID);

    // Compare without dynamic fields (createdAt, snapshotId)
    const { createdAt: _c1, snapshotId: _s1, ...snap1 } = result1.snapshot;
    const { createdAt: _c2, snapshotId: _s2, ...snap2 } = result2.snapshot;
    expect(snap1).toEqual(snap2);
    expect(result1.snapshot.tasks[0].status).toBe("completed");
    expect(result1.snapshot.agents).toHaveLength(1);
  });
});

describe("SnapshotStore", () => {
  it("should apply events and notify listeners", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    let notifyCount = 0;
    store.subscribe(() => notifyCount++);

    store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }));

    expect(notifyCount).toBe(1);
    expect(store.getSnapshot().agents).toHaveLength(1);
  });

  it("should deduplicate events by eventId", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    const event = makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    });

    const r1 = store.applyEvent(event);
    const r2 = store.applyEvent(event);

    expect(r1.applied).toBe(true);
    expect(r2.applied).toBe(false);
    expect(r2.reason).toContain("duplicate");
  });

  it("should reject stale sequence numbers", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }));
    // 相同 sequence（等于 lastSequence），用不同 eventId 避免先被 dedup 拦截
    const r = store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w2", name: "Worker-2", role: "worker" as const,
    }, { eventId: "evt-1b" }));
    expect(r.applied).toBe(false);
    expect(r.reason).toContain("stale sequence");
  });

  it("should reject runtime mismatch", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    const r = store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }, { runtimeId: "other-runtime" }));
    expect(r.applied).toBe(false);
    expect(r.reason).toContain("runtime mismatch");
    // 被拒绝的事件不应进入 snapshot
    expect(store.getSnapshot().agents).toHaveLength(0);
  });

  it("should reject sequence gap", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }));
    // seq=3 跳过了 seq=2
    const r = store.applyEvent(makeEvent(3, EventType.AGENT_SPAWNED, {
      agentId: "w2", name: "Worker-2", role: "worker" as const,
    }, { eventId: "evt-3" }));
    expect(r.applied).toBe(false);
    expect(r.reason).toContain("sequence gap");
  });

  it("should not write rejected events to dedup or event log", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    // 被拒绝的事件（gap）
    const rejected = makeEvent(5, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }, { eventId: "evt-rejected" });
    const r = store.applyEvent(rejected);
    expect(r.applied).toBe(false);
    // event log 为空
    expect(store.getEventLog()).toHaveLength(0);
    // 同一 eventId 再次提交不应被当作 duplicate（说明未被写入 dedup）
    // 用合法 sequence 重新提交同一 eventId
    const r2 = store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }, { eventId: "evt-rejected" }));
    expect(r2.applied).toBe(true);
  });

  it("should rebuild from event log", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }));
    store.applyEvent(makeEvent(2, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    }));

    const before = store.getSnapshot();
    store.rebuildFromLog();
    const after = store.getSnapshot();

    expect(after.agents).toEqual(before.agents);
    expect(after.tasks).toEqual(before.tasks);
  });

  it("should preserve event log count after rebuild", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }));
    store.applyEvent(makeEvent(2, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    }));

    const logCountBefore = store.getEventLog().length;
    expect(logCountBefore).toBe(2);

    store.rebuildFromLog();
    const logCountAfter = store.getEventLog().length;
    expect(logCountAfter).toBe(logCountBefore);
  });

  it("should produce consistent results on consecutive replays", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }));
    store.applyEvent(makeEvent(2, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    }));
    store.applyEvent(makeEvent(3, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    }));

    store.rebuildFromLog();
    const snap1 = store.getSnapshot();

    store.rebuildFromLog();
    const snap2 = store.getSnapshot();

    // 忽略动态字段
    const { createdAt: _c1, snapshotId: _s1, ...rest1 } = snap1;
    const { createdAt: _c2, snapshotId: _s2, ...rest2 } = snap2;
    expect(rest1).toEqual(rest2);
  });

  it("should rebuild dedup index after replay (rejected duplicate stays rejected)", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    const event = makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    });
    store.applyEvent(event);
    // replay 重建 dedup
    store.rebuildFromLog();
    // 同一 eventId 再次提交应被 dedup 拦截（说明 dedup 已重建）
    const r = store.applyEvent(event);
    expect(r.applied).toBe(false);
    expect(r.reason).toContain("duplicate");
  });

  it("should not allow direct snapshot modification", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }));
    const snap1 = store.getSnapshot();
    // try to modify the returned snapshot
    snap1.agents[0].name = "HACKED";
    // store's internal snapshot should be unaffected
    const snap2 = store.getSnapshot();
    expect(snap2.agents[0].name).toBe("Worker-1");
  });
});

describe("Projection", () => {
  it("should project snapshot to UI view", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    store.applyEvent(makeEvent(1, EventType.AGENT_SPAWNED, {
      agentId: "w1", name: "Worker-1", role: "worker" as const,
    }));
    store.applyEvent(makeEvent(2, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    }));

    const snap = store.getSnapshot();
    const projection = projectSnapshot(snap);

    expect(projection.agents).toHaveLength(1);
    expect(projection.tasks).toHaveLength(1);
    expect(projection.agents[0].name).toBe("Worker-1");
    expect(projection.tasks[0].title).toBe("Test");
  });

  it("should compute pendingApprovals and blockedTasks", () => {
    const store = new SnapshotStore(RUNTIME_ID);
    store.applyEvent(makeEvent(1, EventType.TASK_CREATED, {
      taskId: "t1", title: "Test", description: "",
      priority: "normal" as const, parentTaskId: null,
    }));
    store.applyEvent(makeEvent(2, EventType.TASK_ASSIGNED, {
      taskId: "t1", agentId: "w1", roomId: "room-exec",
    }));
    store.applyEvent(makeEvent(3, EventType.TASK_STARTED, {
      taskId: "t1", agentId: "w1",
    }));
    store.applyEvent(makeEvent(4, EventType.TASK_BLOCKED, {
      taskId: "t1", reason: "data missing",
    }));
    store.applyEvent(makeEvent(5, EventType.APPROVAL_REQUESTED, {
      approvalId: "ap1", taskId: "t1",
      kind: "artifact_delivery" as const,
      requestedBy: "r1", reason: "review",
    }));

    const snap = store.getSnapshot();
    const projection = projectSnapshot(snap);
    // task is blocked
    expect(projection.blockedTasks.length).toBeGreaterThanOrEqual(1);
  });
});

describe("CommandGateway", () => {
  function makeCommand(id: string, type: string = CommandType.TASK_CREATE): OfficeCommand {
    return {
      commandId: id,
      commandType: type,
      timestamp: new Date().toISOString(),
      source: "user",
      actorId: "user-1",
      runtimeId: RUNTIME_ID,
      targetId: null,
      payload: {},
    };
  }

  function makeFakeAdapter(executeImpl?: (cmd: OfficeCommand) => Promise<CommandResult>) {
    let resolveFn: ((v: CommandResult) => void) | null = null;
    const execute = vi.fn(async (cmd: OfficeCommand): Promise<CommandResult> => {
      if (executeImpl) return executeImpl(cmd);
      // 默认返回一个可控的 pending Promise（用于 pending duplicate 测试）
      return new Promise<CommandResult>((resolve) => {
        resolveFn = resolve;
      });
    });
    return {
      adapter: {
        connect: vi.fn(async () => {}),
        disconnect: vi.fn(async () => {}),
        getSnapshot: vi.fn(async () => createEmptySnapshot(RUNTIME_ID)),
        subscribe: vi.fn(() => () => {}),
        execute,
        getCapabilities: vi.fn(() => ({
          supportedEvents: [],
          supportedCommands: Object.values(CommandType),
          features: {
            snapshot: true,
            sse: false,
            websocket: false,
            commandExecution: true,
            softMapping: false,
            hardOrchestration: false,
          },
        })),
      },
      // 手动 resolve 第一个 pending execute
      resolve: (r: CommandResult) => {
        resolveFn?.(r);
      },
      execute,
    };
  }

  it("should return DUPLICATE_COMMAND for pending duplicate (same commandId, adapter called once)", async () => {
    const { adapter, resolve, execute } = makeFakeAdapter();
    const gateway = new CommandGateway(adapter);
    const cmd = makeCommand("cmd-pending-1");

    // 第一次 execute（不 await，让其保持 pending）
    const p1 = gateway.execute(cmd);
    // 第二次相同 commandId（pending duplicate）
    const r2 = await gateway.execute(cmd);
    expect(r2.status).toBe("rejected");
    expect(r2.error?.code).toBe("DUPLICATE_COMMAND");

    // resolve 第一次
    resolve({
      commandId: "cmd-pending-1",
      status: "accepted",
      affectedEventIds: ["evt-1"],
    });
    const r1 = await p1;
    expect(r1.status).toBe("accepted");

    // 断言：adapter.execute 只被调用一次（第二次未到达 adapter）
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("should return cached result for completed duplicate (adapter called once)", async () => {
    const { adapter, execute } = makeFakeAdapter(async (cmd) => ({
      commandId: cmd.commandId,
      status: "accepted",
      affectedEventIds: [`evt-${cmd.commandId}`],
    }));
    const gateway = new CommandGateway(adapter);
    const cmd = makeCommand("cmd-completed-1");

    // 第一次 execute（完成）
    const r1 = await gateway.execute(cmd);
    expect(r1.status).toBe("accepted");
    expect(r1.affectedEventIds).toEqual(["evt-cmd-completed-1"]);

    // 第二次相同 commandId（completed duplicate）
    const r2 = await gateway.execute(cmd);
    expect(r2.status).toBe("accepted");
    expect(r2.affectedEventIds).toEqual(["evt-cmd-completed-1"]);

    // 断言：adapter.execute 只被调用一次
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
