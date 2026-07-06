import type { AgentScheduleEntry, LifeSimSnapshot, ScheduleOverlay } from "./types.js";

export function createTaskOverlay(
  _snapshot: LifeSimSnapshot,
  agentId: string,
  taskId: string,
  activity: AgentScheduleEntry["activity"],
  roomId: string | null,
  runtimeSequence: number,
  createdAtWorldMinute: number,
  endMinute: number,
  originalStartMinute: number | null
): ScheduleOverlay {
  const entry: AgentScheduleEntry = {
    entryId: `overlay-${taskId}`,
    agentId,
    startMinute: createdAtWorldMinute,
    endMinute,
    activity,
    roomId,
    priority: 10,
    source: "task_overlay",
  };
  return {
    overlayId: entry.entryId,
    agentId,
    entry,
    createdBy: "task",
    createdAtWorldMinute,
    createdByTaskId: taskId,
    createdByRuntimeSequence: runtimeSequence,
    originalStartMinute,
  };
}

export function closeOverlaysForTask(
  snapshot: LifeSimSnapshot,
  taskId: string,
  _reason: string,
  _endedAtWorldMinute: number
): { overlays: ScheduleOverlay[]; closedIds: string[] } {
  const remaining: ScheduleOverlay[] = [];
  const closedIds: string[] = [];
  for (const overlay of snapshot.activeOverlays) {
    if (overlay.createdByTaskId === taskId) {
      closedIds.push(overlay.overlayId);
    } else {
      remaining.push(overlay);
    }
  }
  return { overlays: remaining, closedIds };
}
