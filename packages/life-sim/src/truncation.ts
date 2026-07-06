import type { RuntimeSnapshot } from "@agent-office/protocol";
import type { LifeSimSnapshot, ScheduleOverlay } from "./types.js";

/**
 * Phase 1 skeleton for truncation recovery.
 *
 * `reconcileOverlays` is a pure helper that closes stale overlays and rebuilds
 * active ones from a RuntimeSnapshot. It is NOT wired into LifeSimEngine in
 * Phase 1, so production truncation recovery is not yet implemented. The
 * function is exported only for testing and as a foundation for Phase 2 work.
 */

const TERMINAL_OVERLAY_STATUSES = new Set(["completed", "failed", "blocked", "cancelled"]);
const ACTIVE_OVERLAY_STATUSES = new Set(["assigned", "planning", "running", "reviewing", "revision_required"]);

export function reconcileOverlays(
  snapshot: LifeSimSnapshot,
  runtimeSnapshot: RuntimeSnapshot,
  endOfDayMinute: number
): { snapshot: LifeSimSnapshot; closedIds: string[]; created: ScheduleOverlay[] } {
  const closedIds: string[] = [];
  const kept: ScheduleOverlay[] = [];
  for (const overlay of snapshot.activeOverlays) {
    const task = runtimeSnapshot.tasks.find((t) => t.taskId === overlay.createdByTaskId);
    if (!task || TERMINAL_OVERLAY_STATUSES.has(task.status)) {
      closedIds.push(overlay.overlayId);
    } else {
      kept.push(overlay);
    }
  }
  const created: ScheduleOverlay[] = [];
  for (const task of runtimeSnapshot.tasks) {
    if (!task.assigneeId) continue;
    if (!ACTIVE_OVERLAY_STATUSES.has(task.status) && task.status !== "waiting_approval") continue;
    const exists = kept.some((o) => o.createdByTaskId === task.taskId);
    if (!exists) {
      const activity = task.status === "waiting_approval" ? "review" : "work";
      const overlay: ScheduleOverlay = {
        overlayId: `overlay-${task.taskId}`,
        agentId: task.assigneeId,
        entry: {
          entryId: `overlay-${task.taskId}`,
          agentId: task.assigneeId,
          startMinute: snapshot.worldClock.minuteOfDay,
          endMinute: endOfDayMinute,
          activity,
          roomId: task.roomId,
          priority: 10,
          source: "task_overlay",
        },
        createdBy: "task",
        createdAtWorldMinute: snapshot.worldClock.minuteOfDay,
        createdByTaskId: task.taskId,
        // TODO(phase-2): use the runtime snapshot/event sequence that caused this overlay.
        // Phase 1 stores a skeleton placeholder because truncation recovery is not yet wired.
        createdByRuntimeSequence: 0,
        originalStartMinute: null,
      };
      created.push(overlay);
    }
  }
  return {
    snapshot: { ...snapshot, activeOverlays: [...kept, ...created] },
    closedIds,
    created,
  };
}
