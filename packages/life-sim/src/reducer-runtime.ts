import type { DomainEvent, TaskSnapshot } from "@agent-office/protocol";
import type { ActiveAgentActivity, LifeSimEvent, LifeSimSnapshot, ScheduleOverlay } from "./types.js";
import { closeOverlaysForTask, createTaskOverlay } from "./overlay.js";
import { buildActiveActivity } from "./schedule.js";

export interface RuntimeReduceOutput {
  snapshot: LifeSimSnapshot;
  events: LifeSimEvent[];
}

function getAgentRole(snapshot: LifeSimSnapshot, agentId: string): string | null {
  // For now base schedule fixtures know roles by convention; extend when runtime agent list is needed.
  const entry = snapshot.baseSchedules.find((e) => e.agentId === agentId);
  return entry?.activity === "review" ? "reviewer" : "worker";
}

export function reduceRuntimeEvent(
  snapshot: LifeSimSnapshot,
  runtimeEvent: DomainEvent,
  endOfDayMinute: number,
  bindingMinute: number,
  nextSequence: () => number,
  now: string
): RuntimeReduceOutput {
  const events: LifeSimEvent[] = [];
  let nextSnapshot = snapshot;

  const baseEvent = (type: string, payload: unknown): LifeSimEvent => ({
    eventId: `evt-ls-${nextSequence()}`,
    worldId: snapshot.worldId,
    lifeSimSequence: nextSequence() - 1,
    type,
    occurredAt: now,
    worldMinute: bindingMinute,
    day: snapshot.worldClock.day,
    causationId: runtimeEvent.eventId,
    runtimeEventId: runtimeEvent.eventId,
    runtimeSequence: runtimeEvent.sequence,
    payload,
  });

  switch (runtimeEvent.type) {
    case "task.assigned": {
      const { taskId, agentId, roomId } = runtimeEvent.payload as { taskId: string; agentId: string; roomId: string };
      const overlay = createTaskOverlay(
        snapshot,
        agentId,
        taskId,
        getAgentRole(snapshot, agentId) === "reviewer" ? "review" : "work",
        roomId,
        runtimeEvent.sequence,
        bindingMinute,
        endOfDayMinute,
        bindingMinute
      );
      nextSnapshot = { ...snapshot, activeOverlays: [...snapshot.activeOverlays, overlay] };
      const oldActivity = snapshot.activeActivities.find((a) => a.agentId === agentId);
      if (oldActivity) {
        events.push(baseEvent("schedule.activity_interrupted", {
          agentId,
          entryId: oldActivity.scheduleEntryId,
          interruptedByTaskId: taskId,
          interruptedAtWorldMinute: bindingMinute,
        }));
      }
      const newActivity = buildActiveActivity(nextSnapshot, agentId, bindingMinute, bindingMinute);
      if (newActivity) {
        events.push(baseEvent("schedule.activity_started", {
          agentId,
          entryId: newActivity.scheduleEntryId,
          activity: newActivity.activity,
          roomId: newActivity.roomId,
          startedAtWorldMinute: bindingMinute,
        }));
      }
      nextSnapshot = { ...nextSnapshot, activeActivities: reconcileActivities(nextSnapshot, bindingMinute) };
      break;
    }

    case "task.completed":
    case "task.failed":
    case "task.blocked":
    case "task.cancelled": {
      const { taskId } = runtimeEvent.payload as { taskId: string };
      const { overlays, closedIds } = closeOverlaysForTask(snapshot, taskId, runtimeEvent.type, bindingMinute);
      nextSnapshot = { ...snapshot, activeOverlays: overlays };
      for (const closedId of closedIds) {
        const overlay = snapshot.activeOverlays.find((o) => o.overlayId === closedId)!;
        events.push(baseEvent("schedule.overlay_ended", {
          agentId: overlay.agentId,
          overlayId: closedId,
          reason: runtimeEvent.type,
          endedAtWorldMinute: bindingMinute,
        }));
      }
      nextSnapshot = { ...nextSnapshot, activeActivities: reconcileActivities(nextSnapshot, bindingMinute) };
      break;
    }

    default:
      // Unknown runtime events are observed but produce no life-sim events in V1.
      break;
  }

  return { snapshot: nextSnapshot, events };
}

function reconcileActivities(snapshot: LifeSimSnapshot, minute: number): ActiveAgentActivity[] {
  const agentIds = new Set([
    ...snapshot.baseSchedules.map((e) => e.agentId),
    ...snapshot.activeOverlays.map((o) => o.agentId),
  ]);
  return Array.from(agentIds)
    .map((agentId) => buildActiveActivity(snapshot, agentId, minute, minute))
    .filter((a): a is ActiveAgentActivity => a !== null);
}
