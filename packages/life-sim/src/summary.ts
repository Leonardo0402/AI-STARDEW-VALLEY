import type { DaySummary, LifeSimEvent, LifeSimSnapshot } from "./types.js";

export function computeDaySummary(
  snapshot: LifeSimSnapshot,
  eventLogTail: LifeSimEvent[],
  day: number,
  startedAtWorldMinute: number,
  endedAtWorldMinute: number
): { summary: DaySummary; events: LifeSimEvent[] } {
  const agentActivities = aggregateAgentActivities(
    snapshot,
    eventLogTail,
    day,
    startedAtWorldMinute,
    endedAtWorldMinute
  );
  const counts = aggregateSummaryCounts(eventLogTail, day);
  const notableEventIds = aggregateNotableEventIds(eventLogTail, day);
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

function aggregateAgentActivities(
  snapshot: LifeSimSnapshot,
  eventLogTail: LifeSimEvent[],
  day: number,
  startedAtWorldMinute: number,
  endedAtWorldMinute: number
): DaySummary["agentActivities"] {
  type ActiveInterval = { activity: string; roomId: string | null; startMinute: number };
  type AgentResult = {
    activityMinutes: Map<string, number>;
    roomsVisited: Set<string>;
    order: number;
  };

  const activeByAgent = new Map<string, ActiveInterval>();
  const results = new Map<string, AgentResult>();
  let orderCounter = 0;

  const findScheduleEntry = (entryId: string) => {
    for (const entry of snapshot.baseSchedules) {
      if (entry.entryId === entryId) return entry;
    }
    for (const overlay of snapshot.activeOverlays) {
      if (overlay.entry.entryId === entryId) return overlay.entry;
    }
    return null;
  };

  const ensureAgent = (agentId: string) => {
    if (!results.has(agentId)) {
      results.set(agentId, {
        activityMinutes: new Map(),
        roomsVisited: new Set(),
        order: orderCounter++,
      });
    }
  };

  const creditMinutes = (
    agentId: string,
    activity: string,
    startMinute: number,
    endMinute: number
  ) => {
    if (endMinute <= startMinute) return;
    const result = results.get(agentId)!;
    result.activityMinutes.set(activity, (result.activityMinutes.get(activity) ?? 0) + (endMinute - startMinute));
  };

  const endCurrentInterval = (agentId: string, endMinute: number) => {
    const active = activeByAgent.get(agentId);
    if (!active) return;
    creditMinutes(agentId, active.activity, active.startMinute, endMinute);
    activeByAgent.delete(agentId);
  };

  for (const event of eventLogTail) {
    if (event.day !== day) continue;
    if (event.worldMinute < startedAtWorldMinute || event.worldMinute > endedAtWorldMinute) continue;

    switch (event.type) {
      case "schedule.activity_started": {
        const payload = event.payload as {
          agentId: string;
          entryId: string;
          activity: string;
          roomId: string | null;
        };
        const agentId = payload.agentId;
        const startMinute = event.worldMinute;
        ensureAgent(agentId);
        endCurrentInterval(agentId, startMinute);
        activeByAgent.set(agentId, {
          activity: payload.activity,
          roomId: payload.roomId,
          startMinute,
        });
        if (payload.roomId !== null) {
          results.get(agentId)!.roomsVisited.add(payload.roomId);
        }
        break;
      }
      case "schedule.activity_resumed": {
        const payload = event.payload as { agentId: string; entryId: string };
        const agentId = payload.agentId;
        const entry = findScheduleEntry(payload.entryId);
        if (!entry) break;
        const startMinute = event.worldMinute;
        ensureAgent(agentId);
        endCurrentInterval(agentId, startMinute);
        activeByAgent.set(agentId, {
          activity: entry.activity,
          roomId: entry.roomId,
          startMinute,
        });
        if (entry.roomId !== null) {
          results.get(agentId)!.roomsVisited.add(entry.roomId);
        }
        break;
      }
      case "schedule.activity_completed":
      case "schedule.activity_interrupted": {
        const payload = event.payload as { agentId: string; entryId: string };
        endCurrentInterval(payload.agentId, event.worldMinute);
        break;
      }
      case "schedule.overlay_ended": {
        const payload = event.payload as {
          agentId: string;
          overlayId: string;
          reason: string;
          endedAtWorldMinute: number;
        };
        endCurrentInterval(payload.agentId, event.worldMinute);
        break;
      }
    }
  }

  for (const [agentId, active] of activeByAgent) {
    creditMinutes(agentId, active.activity, active.startMinute, endedAtWorldMinute);
  }

  return Array.from(results.entries())
    .sort((a, b) => a[1].order - b[1].order)
    .map(([agentId, result]) => ({
      agentId,
      activityMinutes: Object.fromEntries(result.activityMinutes),
      roomsVisited: Array.from(result.roomsVisited),
    }));
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

function runtimeEventTypeOf(event: LifeSimEvent): string | null {
  switch (event.type) {
    case "day.task_completed":
      return "task.completed";
    case "day.task_failed":
      return "task.failed";
    case "day.task_blocked":
      return "task.blocked";
    case "day.approval_requested":
      return "approval.requested";
    case "day.approval_resolved":
      return "approval.resolved";
    case "schedule.activity_started": {
      const entryId = (event.payload as { entryId?: string }).entryId;
      if (entryId?.startsWith("overlay-")) return "task.assigned";
      return null;
    }
    case "schedule.activity_interrupted": {
      const interruptedByTaskId = (event.payload as { interruptedByTaskId?: string }).interruptedByTaskId;
      if (interruptedByTaskId) return "task.assigned";
      return null;
    }
    case "schedule.overlay_ended": {
      const reason = (event.payload as { reason?: string }).reason;
      if (reason === "task.assigned") return "task.assigned";
      if (reason === "task.completed") return "task.completed";
      if (reason === "task.failed") return "task.failed";
      if (reason === "task.blocked") return "task.blocked";
      return null;
    }
    default:
      return null;
  }
}

function aggregateNotableEventIds(eventLogTail: LifeSimEvent[], day: number): string[] {
  const categories = new Map<string, string>();
  const categoryOrder: string[] = [];

  const getCategory = (runtimeType: string): string | null => {
    if (runtimeType === "task.assigned") return "task.assigned";
    if (runtimeType === "approval.requested") return "approval.requested";
    if (runtimeType === "approval.resolved") return "approval.resolved";
    if (runtimeType === "task.completed") return "task.completed";
    if (runtimeType === "task.failed" || runtimeType === "task.blocked") return "task.failed_or_blocked";
    return null;
  };

  for (const event of eventLogTail) {
    if (event.day !== day) continue;
    if (!event.runtimeEventId) continue;
    const runtimeType = runtimeEventTypeOf(event);
    if (!runtimeType) continue;
    const category = getCategory(runtimeType);
    if (!category) continue;
    if (!categories.has(category)) {
      categories.set(category, event.runtimeEventId);
      categoryOrder.push(category);
      if (categoryOrder.length >= 10) break;
    }
  }

  return categoryOrder.map((category) => categories.get(category)!);
}
