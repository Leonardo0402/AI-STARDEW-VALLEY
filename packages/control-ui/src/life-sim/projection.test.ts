import { describe, expect, test } from "vitest";
import type {
  ActiveAgentActivity,
  AgentScheduleEntry,
  LifeSimCapabilities,
  LifeSimSnapshot,
  ScheduleOverlay,
} from "@agent-office/life-sim";
import type { OfficeProjection } from "@agent-office/protocol";
import {
  composeProjections,
  projectLifeSim,
  type AgentLifeSimView,
  type ComposedOfficeProjection,
  type LifeSimProjection,
} from "./projection.js";

const defaultCapabilities: LifeSimCapabilities = {
  world: {
    startDay: true,
    pause: false,
    resume: false,
    endDay: false,
    advanceTime: false,
    runToEndOfDay: false,
  },
  schedule: { override: false, clearOverride: false },
  clock: { mode: "manual", maxSpeed: 0 },
};

function makeSnapshot(
  overrides: Partial<LifeSimSnapshot> = {}
): LifeSimSnapshot {
  return {
    worldId: "world-1",
    schemaVersion: "1",
    checkpointLifeSimSequence: 0,
    lastObservedRuntimeSequence: 0,
    lastAppliedRuntimeSequence: 0,
    worldClock: {
      worldId: "world-1",
      day: 1,
      dayOfWeek: 1,
      minuteOfDay: 600,
      phase: "morning",
      status: "running",
      speed: 0,
      fractionalMinute: 0,
      updatedAt: "2026-01-01T00:00:00Z",
    },
    baseSchedules: [],
    activeActivities: [],
    activeOverlays: [],
    completedDaySummaries: [],
    truncatedHistory: { truncated: false, lostRuntimeRange: null },
    ...overrides,
  };
}

function makeBaseEntry(
  overrides: Partial<AgentScheduleEntry> = {}
): AgentScheduleEntry {
  return {
    entryId: "entry-1",
    agentId: "agent-1",
    startMinute: 540,
    endMinute: 720,
    activity: "work",
    roomId: "room-execution",
    priority: 1,
    source: "base",
    ...overrides,
  };
}

function makeOverlay(
  overrides: Partial<ScheduleOverlay> = {},
  entryOverrides: Partial<AgentScheduleEntry> = {}
): ScheduleOverlay {
  const entry: AgentScheduleEntry = {
    entryId: "overlay-1",
    agentId: "agent-2",
    startMinute: 600,
    endMinute: 660,
    activity: "review",
    roomId: "room-review",
    priority: 10,
    source: "task_overlay",
    ...entryOverrides,
  };
  return {
    overlayId: entry.entryId,
    agentId: entry.agentId,
    entry,
    createdBy: "task",
    createdAtWorldMinute: 600,
    createdByTaskId: "task-1",
    createdByRuntimeSequence: 5,
    originalStartMinute: null,
    ...overrides,
  };
}

describe("projectLifeSim", () => {
  test("maps world clock and derives dayOfWeek from day", () => {
    const snapshot = makeSnapshot({
      worldClock: {
        worldId: "world-1",
        day: 8,
        dayOfWeek: 1,
        minuteOfDay: 600,
        phase: "morning",
        status: "running",
        speed: 0,
        fractionalMinute: 0,
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });

    const projection = projectLifeSim(snapshot, defaultCapabilities);

    expect(projection.world).toEqual({
      day: 8,
      dayOfWeek: 1,
      minuteOfDay: 600,
      phase: "morning",
      status: "running",
      speed: 0,
    });
  });

  test("derives dayOfWeek using 1-based Monday", () => {
    const projection = projectLifeSim(
      makeSnapshot({
        worldClock: {
          ...makeSnapshot().worldClock,
          day: 3,
        },
      }),
      defaultCapabilities
    );
    expect(projection.world.dayOfWeek).toBe(3);
  });

  test("builds agent views from active activities and overlays", () => {
    const baseEntry = makeBaseEntry({ entryId: "base-1", agentId: "agent-1" });
    const overlay = makeOverlay(
      {},
      { entryId: "overlay-1", agentId: "agent-2" }
    );
    const activeActivities: ActiveAgentActivity[] = [
      {
        agentId: "agent-1",
        scheduleEntryId: baseEntry.entryId,
        activity: baseEntry.activity,
        roomId: baseEntry.roomId,
        startedAtWorldMinute: 540,
        interruptedByTaskId: null,
      },
      {
        agentId: "agent-2",
        scheduleEntryId: overlay.entry.entryId,
        activity: overlay.entry.activity,
        roomId: overlay.entry.roomId,
        startedAtWorldMinute: 600,
        interruptedByTaskId: "task-1",
      },
    ];
    const snapshot = makeSnapshot({
      worldClock: { ...makeSnapshot().worldClock, minuteOfDay: 600 },
      baseSchedules: [baseEntry],
      activeActivities,
      activeOverlays: [overlay],
    });

    const projection = projectLifeSim(snapshot, defaultCapabilities);

    const agent1 = projection.agents.find((a) => a.agentId === "agent-1");
    const agent2 = projection.agents.find((a) => a.agentId === "agent-2");

    expect(agent1).toEqual<AgentLifeSimView>({
      agentId: "agent-1",
      currentActivity: "work",
      currentRoomId: "room-execution",
      currentEntryId: "base-1",
      nextEntryId: null,
      nextEntryAtMinute: null,
      isOverridden: false,
      overrideReason: null,
    });

    expect(agent2).toEqual<AgentLifeSimView>({
      agentId: "agent-2",
      currentActivity: "review",
      currentRoomId: "room-review",
      currentEntryId: "overlay-1",
      nextEntryId: null,
      nextEntryAtMinute: null,
      isOverridden: true,
      overrideReason: "task",
    });
  });

  test("falls back to effective base/overlay entry when there is no active activity", () => {
    const baseEntry = makeBaseEntry({
      entryId: "base-1",
      agentId: "agent-1",
      startMinute: 540,
      endMinute: 720,
    });
    const overlay = makeOverlay(
      {},
      {
        entryId: "overlay-1",
        agentId: "agent-2",
        startMinute: 600,
        endMinute: 660,
        activity: "review",
        roomId: "room-review",
      }
    );
    const snapshot = makeSnapshot({
      worldClock: { ...makeSnapshot().worldClock, minuteOfDay: 600 },
      baseSchedules: [baseEntry],
      activeActivities: [],
      activeOverlays: [overlay],
    });

    const projection = projectLifeSim(snapshot, defaultCapabilities);

    const agent1 = projection.agents.find((a) => a.agentId === "agent-1");
    const agent2 = projection.agents.find((a) => a.agentId === "agent-2");

    expect(agent1).toEqual<AgentLifeSimView>({
      agentId: "agent-1",
      currentActivity: "work",
      currentRoomId: "room-execution",
      currentEntryId: "base-1",
      nextEntryId: null,
      nextEntryAtMinute: null,
      isOverridden: false,
      overrideReason: null,
    });

    expect(agent2).toEqual<AgentLifeSimView>({
      agentId: "agent-2",
      currentActivity: "review",
      currentRoomId: "room-review",
      currentEntryId: "overlay-1",
      nextEntryId: null,
      nextEntryAtMinute: null,
      isOverridden: true,
      overrideReason: "task",
    });
  });

  test("computes nextEntryId and nextEntryAtMinute per agent", () => {
    const baseEntry = makeBaseEntry({
      entryId: "base-1",
      agentId: "agent-1",
      startMinute: 540,
      endMinute: 720,
    });
    const nextEntry = makeBaseEntry({
      entryId: "base-2",
      agentId: "agent-1",
      startMinute: 730,
      endMinute: 780,
      activity: "break",
    });
    const activeActivities: ActiveAgentActivity[] = [
      {
        agentId: "agent-1",
        scheduleEntryId: baseEntry.entryId,
        activity: baseEntry.activity,
        roomId: baseEntry.roomId,
        startedAtWorldMinute: 540,
        interruptedByTaskId: null,
      },
    ];
    const snapshot = makeSnapshot({
      worldClock: { ...makeSnapshot().worldClock, minuteOfDay: 600 },
      baseSchedules: [baseEntry, nextEntry],
      activeActivities,
    });

    const projection = projectLifeSim(snapshot, defaultCapabilities);

    expect(projection.agents[0].nextEntryId).toBe("base-2");
    expect(projection.agents[0].nextEntryAtMinute).toBe(730);
  });

  test("picks the earliest active entry end as nextTransition", () => {
    const entryA = makeBaseEntry({
      entryId: "base-a",
      agentId: "agent-1",
      startMinute: 540,
      endMinute: 700,
    });
    const entryB = makeBaseEntry({
      entryId: "base-b",
      agentId: "agent-2",
      startMinute: 540,
      endMinute: 650,
    });
    const snapshot = makeSnapshot({
      worldClock: { ...makeSnapshot().worldClock, minuteOfDay: 600 },
      baseSchedules: [entryA, entryB],
      activeActivities: [
        {
          agentId: "agent-1",
          scheduleEntryId: entryA.entryId,
          activity: entryA.activity,
          roomId: entryA.roomId,
          startedAtWorldMinute: 540,
          interruptedByTaskId: null,
        },
        {
          agentId: "agent-2",
          scheduleEntryId: entryB.entryId,
          activity: entryB.activity,
          roomId: entryB.roomId,
          startedAtWorldMinute: 540,
          interruptedByTaskId: null,
        },
      ],
    });

    const projection = projectLifeSim(snapshot, defaultCapabilities);

    expect(projection.nextTransition).toEqual({
      agentId: "agent-2",
      entryId: "base-b",
      atMinute: 650,
    });
  });

  test("falls back to next base schedule entry when no active entry ends after current minute", () => {
    const futureEntry = makeBaseEntry({
      entryId: "future-1",
      agentId: "agent-1",
      startMinute: 700,
      endMinute: 800,
    });
    const snapshot = makeSnapshot({
      worldClock: { ...makeSnapshot().worldClock, minuteOfDay: 600 },
      baseSchedules: [futureEntry],
      activeActivities: [],
    });

    const projection = projectLifeSim(snapshot, defaultCapabilities);

    expect(projection.nextTransition).toEqual({
      agentId: "agent-1",
      entryId: "future-1",
      atMinute: 700,
    });
  });

  test("falls back to active overlay future start when no base schedule entry is active", () => {
    const overlay = makeOverlay(
      {},
      {
        entryId: "overlay-1",
        agentId: "agent-1",
        startMinute: 700,
        endMinute: 800,
        activity: "review",
        roomId: "room-review",
      }
    );
    const snapshot = makeSnapshot({
      worldClock: { ...makeSnapshot().worldClock, minuteOfDay: 600 },
      baseSchedules: [],
      activeActivities: [],
      activeOverlays: [overlay],
    });

    const projection = projectLifeSim(snapshot, defaultCapabilities);

    expect(projection.nextTransition).toEqual({
      agentId: "agent-1",
      entryId: "overlay-1",
      atMinute: 700,
    });
  });

  test("returns null nextTransition when there are no future entries", () => {
    const snapshot = makeSnapshot({
      baseSchedules: [],
      activeActivities: [],
    });

    const projection = projectLifeSim(snapshot, defaultCapabilities);

    expect(projection.nextTransition).toBeNull();
  });

  test("passes through capabilities, summaries, and truncation metadata", () => {
    const capabilities: LifeSimCapabilities = {
      world: {
        startDay: false,
        pause: true,
        resume: false,
        endDay: true,
        advanceTime: true,
        runToEndOfDay: false,
      },
      schedule: { override: true, clearOverride: false },
      clock: { mode: "realtime", maxSpeed: 10 },
    };
    const summaries = [
      {
        day: 1,
        startedAtWorldMinute: 480,
        endedAtWorldMinute: 1200,
        truncated: false,
        agentActivities: [],
        taskCounts: { created: 0, completed: 0, blocked: 0, failed: 0 },
        approvalCounts: { requested: 0, approved: 0, rejected: 0 },
        notableEventIds: [],
      },
    ];
    const snapshot = makeSnapshot({
      completedDaySummaries: summaries,
      truncatedHistory: { truncated: true, lostRuntimeRange: { from: 0, to: 5 } },
    });

    const projection = projectLifeSim(snapshot, capabilities);

    expect(projection.capabilities).toBe(capabilities);
    expect(projection.previousDaySummaries).toBe(summaries);
    expect(projection.truncated).toBe(true);
    expect(projection.lostRuntimeRange).toEqual({ from: 0, to: 5 });
  });
});

describe("composeProjections", () => {
  test("merges office projection with life-sim projection", () => {
    const office: OfficeProjection = {
      agents: [],
      tasks: [],
      artifacts: [],
      approvals: [],
      rooms: [],
      pendingApprovals: [],
      blockedTasks: [],
      errors: [],
    };
    const lifeSim: LifeSimProjection = projectLifeSim(
      makeSnapshot(),
      defaultCapabilities
    );

    const composed: ComposedOfficeProjection = composeProjections(office, lifeSim);

    expect(composed.agents).toBe(office.agents);
    expect(composed.tasks).toBe(office.tasks);
    expect(composed.lifeSim).toBe(lifeSim);
  });
});
