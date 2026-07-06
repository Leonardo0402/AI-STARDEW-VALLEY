import type { DaySummary, LifeSimEvent, LifeSimSnapshot } from "./types.js";

export function computeDaySummary(
  snapshot: LifeSimSnapshot,
  day: number,
  startedAtWorldMinute: number,
  endedAtWorldMinute: number
): { summary: DaySummary; events: LifeSimEvent[] } {
  const agentActivities = aggregateAgentActivities(snapshot, day);
  const taskCounts = { created: 0, completed: 0, blocked: 0, failed: 0 };
  const approvalCounts = { requested: 0, approved: 0, rejected: 0 };
  const notableEventIds: string[] = [];
  for (const event of snapshot.completedDaySummaries.flatMap((s) => s.notableEventIds)) {
    // summary of prior days; ignore
    void event;
  }
  return {
    summary: {
      day,
      startedAtWorldMinute,
      endedAtWorldMinute,
      truncated: snapshot.truncatedHistory.truncated,
      agentActivities,
      taskCounts,
      approvalCounts,
      notableEventIds,
    },
    events: [],
  };
}

function aggregateAgentActivities(_snapshot: LifeSimSnapshot, _day: number) {
  // TODO(phase-2): aggregate minute-by-minute activity from the event log.
  // Phase 1 keeps the summary skeleton empty; the Golden Flow test asserts shape only.
  return [] as Array<{
    agentId: string;
    activityMinutes: Record<string, number>;
    roomsVisited: string[];
  }>;
}
