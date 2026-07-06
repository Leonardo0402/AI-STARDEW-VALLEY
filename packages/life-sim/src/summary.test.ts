import { describe, it, expect } from "vitest";
import { computeDaySummary } from "./summary.js";
import { createEmptySnapshot } from "./store.js";
import type { AgentScheduleEntry, LifeSimEngineConfig, LifeSimEvent } from "./types.js";

const config: LifeSimEngineConfig = {
  worldId: "summary-test",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
};

function base(
  entryId: string,
  agentId: string,
  startMinute: number,
  endMinute: number,
  activity: AgentScheduleEntry["activity"],
  roomId: string | null
): AgentScheduleEntry {
  return { entryId, agentId, startMinute, endMinute, activity, roomId, priority: 1, source: "base" };
}

const sampleDayBaseSchedules: AgentScheduleEntry[] = [
  base("orch-arrive", "orchestrator-1", 480, 510, "arrive", "qclaw-room-command"),
  base("orch-work-am", "orchestrator-1", 510, 720, "work", "qclaw-room-command"),
  base("orch-break", "orchestrator-1", 720, 780, "break", null),
  base("orch-work-pm", "orchestrator-1", 780, 1020, "work", "qclaw-room-command"),
  base("orch-review-pm", "orchestrator-1", 1020, 1080, "review", "qclaw-room-review"),
  base("orch-leave", "orchestrator-1", 1080, 1110, "leave", null),

  base("worker-arrive", "worker-1", 480, 510, "arrive", "qclaw-room-command"),
  base("worker-work-am", "worker-1", 510, 720, "work", "qclaw-room-execution"),
  base("worker-break", "worker-1", 720, 780, "break", null),
  base("worker-work-pm", "worker-1", 780, 1020, "work", "qclaw-room-execution"),
  base("worker-idle", "worker-1", 1020, 1080, "idle", null),
  base("worker-leave", "worker-1", 1080, 1110, "leave", null),

  base("reviewer-arrive", "reviewer-1", 480, 510, "arrive", "qclaw-room-command"),
  base("reviewer-review-am", "reviewer-1", 510, 720, "review", "qclaw-room-review"),
  base("reviewer-break", "reviewer-1", 720, 780, "break", null),
  base("reviewer-review-pm", "reviewer-1", 780, 1020, "review", "qclaw-room-review"),
  base("reviewer-work-pm", "reviewer-1", 1020, 1080, "work", "qclaw-room-review"),
  base("reviewer-leave", "reviewer-1", 1080, 1110, "leave", null),
];

let seq = 0;

function makeEvent(
  type: string,
  worldMinute: number,
  payload: unknown,
  overrides: Partial<LifeSimEvent> = {}
): LifeSimEvent {
  const n = ++seq;
  return {
    eventId: `evt-${n}`,
    worldId: config.worldId,
    lifeSimSequence: n,
    type,
    occurredAt: "2026-07-05T08:00:00Z",
    worldMinute,
    day: 1,
    causationId: null,
    runtimeEventId: null,
    runtimeSequence: null,
    payload,
    ...overrides,
  };
}

function activityStarted(
  agentId: string,
  entryId: string,
  activity: string,
  roomId: string | null,
  worldMinute: number,
  runtimeEventId: string | null = null
): LifeSimEvent {
  return makeEvent(
    "schedule.activity_started",
    worldMinute,
    { agentId, entryId, activity, roomId, startedAtWorldMinute: worldMinute },
    runtimeEventId ? { runtimeEventId } : {}
  );
}

function activityCompleted(agentId: string, entryId: string, worldMinute: number): LifeSimEvent {
  return makeEvent(
    "schedule.activity_completed",
    worldMinute,
    { agentId, entryId, completedAtWorldMinute: worldMinute }
  );
}

function activityInterrupted(
  agentId: string,
  entryId: string,
  interruptedByTaskId: string,
  worldMinute: number,
  runtimeEventId: string
): LifeSimEvent {
  return makeEvent(
    "schedule.activity_interrupted",
    worldMinute,
    { agentId, entryId, interruptedByTaskId, interruptedAtWorldMinute: worldMinute },
    { runtimeEventId }
  );
}

function activityResumed(agentId: string, entryId: string, worldMinute: number): LifeSimEvent {
  return makeEvent("schedule.activity_resumed", worldMinute, {
    agentId,
    entryId,
    resumedAtWorldMinute: worldMinute,
  });
}

function overlayEnded(
  agentId: string,
  overlayId: string,
  reason: string,
  worldMinute: number,
  runtimeEventId: string
): LifeSimEvent {
  return makeEvent(
    "schedule.overlay_ended",
    worldMinute,
    { agentId, overlayId, reason, endedAtWorldMinute: worldMinute },
    { runtimeEventId }
  );
}

function dayEvent(
  type: string,
  worldMinute: number,
  payload: unknown,
  runtimeEventId: string | null = null
): LifeSimEvent {
  return makeEvent(type, worldMinute, payload, runtimeEventId ? { runtimeEventId } : {});
}

describe("computeDaySummary", () => {
  it("aggregates the full sample day from the event log", () => {
    seq = 0;
    const snapshot = {
      ...createEmptySnapshot(config, "2026-07-05T08:00:00Z"),
      baseSchedules: sampleDayBaseSchedules,
    };
    const eventLogTail: LifeSimEvent[] = [
      // 08:00 day start + arrive
      makeEvent("world.day_started", 480, { day: 1, dayOfWeek: 1, startedAtWorldMinute: 480 }),
      activityStarted("orchestrator-1", "orch-arrive", "arrive", "qclaw-room-command", 480),
      activityStarted("worker-1", "worker-arrive", "arrive", "qclaw-room-command", 480),
      activityStarted("reviewer-1", "reviewer-arrive", "arrive", "qclaw-room-command", 480),

      // 08:30 arrive -> work/review
      activityCompleted("orchestrator-1", "orch-arrive", 510),
      activityStarted("orchestrator-1", "orch-work-am", "work", "qclaw-room-command", 510),
      activityCompleted("worker-1", "worker-arrive", 510),
      activityStarted("worker-1", "worker-work-am", "work", "qclaw-room-execution", 510),
      activityCompleted("reviewer-1", "reviewer-arrive", 510),
      activityStarted("reviewer-1", "reviewer-review-am", "review", "qclaw-room-review", 510),

      // 09:00 task assigned to worker
      dayEvent("day.task_created", 540, { taskId: "t-1" }, "evt-task-created-1"),
      activityInterrupted("worker-1", "worker-work-am", "t-1", 540, "evt-task-assigned-t-1"),
      activityStarted("worker-1", "overlay-t-1", "work", "qclaw-room-execution", 540, "evt-task-assigned-t-1"),

      // 10:30 approval requested -> reviewer overlay
      dayEvent("day.approval_requested", 630, { approvalId: "ap-1", taskId: "t-1" }, "evt-approval-requested-ap-1"),
      activityInterrupted("reviewer-1", "reviewer-review-am", "t-1", 630, "evt-approval-requested-ap-1"),
      activityStarted("reviewer-1", "overlay-ap-1", "review", "qclaw-room-review", 630, "evt-approval-requested-ap-1"),

      // 11:00 approval resolved + task completed
      dayEvent("day.approval_resolved", 660, { approvalId: "ap-1", taskId: "t-1", status: "approved" }, "evt-approval-resolved-ap-1"),
      dayEvent("day.task_completed", 660, { taskId: "t-1" }, "evt-task-completed-t-1"),
      overlayEnded("worker-1", "overlay-t-1", "task.completed", 660, "evt-task-completed-t-1"),
      activityResumed("worker-1", "worker-work-am", 660),
      overlayEnded("reviewer-1", "overlay-ap-1", "task.completed", 660, "evt-task-completed-t-1"),
      activityResumed("reviewer-1", "reviewer-review-am", 660),

      // 12:00 lunch break
      activityCompleted("orchestrator-1", "orch-work-am", 720),
      activityStarted("orchestrator-1", "orch-break", "break", null, 720),
      activityCompleted("worker-1", "worker-work-am", 720),
      activityStarted("worker-1", "worker-break", "break", null, 720),
      activityCompleted("reviewer-1", "reviewer-review-am", 720),
      activityStarted("reviewer-1", "reviewer-break", "break", null, 720),

      // 13:00 afternoon work
      activityCompleted("orchestrator-1", "orch-break", 780),
      activityStarted("orchestrator-1", "orch-work-pm", "work", "qclaw-room-command", 780),
      activityCompleted("worker-1", "worker-break", 780),
      activityStarted("worker-1", "worker-work-pm", "work", "qclaw-room-execution", 780),
      activityCompleted("reviewer-1", "reviewer-break", 780),
      activityStarted("reviewer-1", "reviewer-review-pm", "review", "qclaw-room-review", 780),

      // 17:00 evening wrap-up
      activityCompleted("orchestrator-1", "orch-work-pm", 1020),
      activityStarted("orchestrator-1", "orch-review-pm", "review", "qclaw-room-review", 1020),
      activityCompleted("worker-1", "worker-work-pm", 1020),
      activityStarted("worker-1", "worker-idle", "idle", null, 1020),
      activityCompleted("reviewer-1", "reviewer-review-pm", 1020),
      activityStarted("reviewer-1", "reviewer-work-pm", "work", "qclaw-room-review", 1020),

      // 18:00 leave
      activityCompleted("orchestrator-1", "orch-review-pm", 1080),
      activityStarted("orchestrator-1", "orch-leave", "leave", null, 1080),
      activityCompleted("worker-1", "worker-idle", 1080),
      activityStarted("worker-1", "worker-leave", "leave", null, 1080),
      activityCompleted("reviewer-1", "reviewer-work-pm", 1080),
      activityStarted("reviewer-1", "reviewer-leave", "leave", null, 1080),

      // 18:30 leave complete
      activityCompleted("orchestrator-1", "orch-leave", 1110),
      activityCompleted("worker-1", "worker-leave", 1110),
      activityCompleted("reviewer-1", "reviewer-leave", 1110),

      makeEvent("world.day_ending", 1110, { day: 1, endedAtWorldMinute: 1110 }),
    ];

    const { summary, events } = computeDaySummary(snapshot, eventLogTail, 1, 480, 1110);

    expect(events).toEqual([]);
    expect(summary).toEqual({
      day: 1,
      startedAtWorldMinute: 480,
      endedAtWorldMinute: 1110,
      truncated: false,
      agentActivities: [
        {
          agentId: "orchestrator-1",
          activityMinutes: { arrive: 30, work: 450, break: 60, review: 60, leave: 30 },
          roomsVisited: ["qclaw-room-command", "qclaw-room-review"],
        },
        {
          agentId: "worker-1",
          activityMinutes: { arrive: 30, work: 450, break: 60, idle: 60, leave: 30 },
          roomsVisited: ["qclaw-room-command", "qclaw-room-execution"],
        },
        {
          agentId: "reviewer-1",
          activityMinutes: { arrive: 30, review: 450, work: 60, break: 60, leave: 30 },
          roomsVisited: ["qclaw-room-command", "qclaw-room-review"],
        },
      ],
      taskCounts: { created: 1, completed: 1, blocked: 0, failed: 0 },
      approvalCounts: { requested: 1, approved: 1, rejected: 0 },
      notableEventIds: [
        "evt-task-assigned-t-1",
        "evt-approval-requested-ap-1",
        "evt-approval-resolved-ap-1",
        "evt-task-completed-t-1",
      ],
    });
  });
});
