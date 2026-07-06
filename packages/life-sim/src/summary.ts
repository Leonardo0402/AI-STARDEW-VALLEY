import type { DaySummary, LifeSimEvent, LifeSimSnapshot } from "./types.js";

export function computeDaySummary(
  snapshot: LifeSimSnapshot,
  eventLogTail: LifeSimEvent[],
  day: number,
  startedAtWorldMinute: number,
  endedAtWorldMinute: number
): { summary: DaySummary; events: LifeSimEvent[] } {
  const agentActivities = aggregateAgentActivities(snapshot, day);
  const counts = aggregateSummaryCounts(eventLogTail, day);
  const notableEventIds: string[] = [];
  return {
    summary: {
      day,
      startedAtWorldMinute,
      endedAtWorldMinute,
      truncated: snapshot.truncatedHistory.truncated,
      agentActivities,
      taskCounts: counts.taskCounts,
      approvalCounts: counts.approvalCounts,
      notableEventIds,
    },
    events: [],
  };
}

function aggregateSummaryCounts(
  eventLogTail: LifeSimEvent[],
  day: number
): { taskCounts: DaySummary["taskCounts"]; approvalCounts: DaySummary["approvalCounts"] } {
  const taskCounts = { created: 0, completed: 0, blocked: 0, failed: 0 };
  const approvalCounts = { requested: 0, approved: 0, rejected: 0 };

  for (const event of eventLogTail) {
    if (event.day !== day) continue;
    switch (event.type) {
      case "day.task_created":
        taskCounts.created++;
        break;
      case "day.task_completed":
        taskCounts.completed++;
        break;
      case "day.task_failed":
        taskCounts.failed++;
        break;
      case "day.task_blocked":
        taskCounts.blocked++;
        break;
      case "day.approval_requested":
        approvalCounts.requested++;
        break;
      case "day.approval_resolved": {
        const status = (event.payload as { status: "approved" | "rejected" | "expired" }).status;
        if (status === "approved") {
          approvalCounts.approved++;
        } else if (status === "rejected") {
          approvalCounts.rejected++;
        }
        break;
      }
    }
  }

  return { taskCounts, approvalCounts };
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
