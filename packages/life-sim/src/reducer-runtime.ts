import type { DomainEvent } from "@agent-office/protocol";
import type { ActiveAgentActivity, LifeSimEvent, LifeSimSnapshot } from "./types.js";
import { closeOverlaysForTask, createTaskOverlay } from "./overlay.js";
import { buildActiveActivity } from "./schedule.js";

export interface RuntimeReduceOutput {
  snapshot: LifeSimSnapshot;
  events: LifeSimEvent[];
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

  const baseEvent = (type: string, payload: unknown): LifeSimEvent => {
    const seq = nextSequence();
    return {
      eventId: `evt-ls-${seq}`,
      worldId: snapshot.worldId,
      lifeSimSequence: seq,
      type,
      occurredAt: now,
      worldMinute: bindingMinute,
      day: snapshot.worldClock.day,
      causationId: runtimeEvent.eventId,
      runtimeEventId: runtimeEvent.eventId,
      runtimeSequence: runtimeEvent.sequence,
      payload,
    };
  };

  switch (runtimeEvent.type) {
    case "task.assigned": {
      const { taskId, agentId, roomId } = runtimeEvent.payload as { taskId: string; agentId: string; roomId: string };

      // V1: a later task assignment for the same agent wins; close any existing task overlay first.
      const existingTaskOverlayIds = new Set(
        snapshot.activeOverlays
          .filter((o) => o.agentId === agentId && o.createdBy === "task")
          .map((o) => o.overlayId)
      );
      for (const overlay of snapshot.activeOverlays) {
        if (existingTaskOverlayIds.has(overlay.overlayId)) {
          events.push(baseEvent("schedule.overlay_ended", {
            agentId: overlay.agentId,
            overlayId: overlay.overlayId,
            reason: runtimeEvent.type,
            endedAtWorldMinute: bindingMinute,
          }));
        }
      }
      const overlaysAfterClose = snapshot.activeOverlays.filter(
        (o) => !existingTaskOverlayIds.has(o.overlayId)
      );

      const overlay = createTaskOverlay(
        snapshot,
        agentId,
        taskId,
        "work",
        roomId,
        runtimeEvent.sequence,
        bindingMinute,
        endOfDayMinute,
        bindingMinute
      );
      nextSnapshot = { ...snapshot, activeOverlays: [...overlaysAfterClose, overlay] };
      const oldActivity = snapshot.activeActivities.find((a) => a.agentId === agentId);
      const newActivity = buildActiveActivity(nextSnapshot, agentId, bindingMinute, bindingMinute);
      if (
        oldActivity &&
        !existingTaskOverlayIds.has(oldActivity.scheduleEntryId) &&
        oldActivity.scheduleEntryId !== newActivity?.scheduleEntryId
      ) {
        events.push(baseEvent("schedule.activity_interrupted", {
          agentId,
          entryId: oldActivity.scheduleEntryId,
          interruptedByTaskId: taskId,
          interruptedAtWorldMinute: bindingMinute,
        }));
      }
      if (newActivity && oldActivity?.scheduleEntryId !== newActivity.scheduleEntryId) {
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
      const closedOverlays = snapshot.activeOverlays.filter((o) => o.createdByTaskId === taskId);
      const { overlays } = closeOverlaysForTask(snapshot, taskId, runtimeEvent.type, bindingMinute);
      nextSnapshot = { ...snapshot, activeOverlays: overlays };
      for (const overlay of closedOverlays) {
        events.push(baseEvent("schedule.overlay_ended", {
          agentId: overlay.agentId,
          overlayId: overlay.overlayId,
          reason: runtimeEvent.type,
          endedAtWorldMinute: bindingMinute,
        }));
      }
      nextSnapshot = { ...nextSnapshot, activeActivities: reconcileActivities(nextSnapshot, bindingMinute) };
      for (const overlay of closedOverlays) {
        const resumedActivity = buildActiveActivity(nextSnapshot, overlay.agentId, bindingMinute, bindingMinute);
        if (resumedActivity && resumedActivity.scheduleEntryId !== overlay.entry.entryId) {
          events.push(baseEvent("schedule.activity_resumed", {
            agentId: overlay.agentId,
            entryId: resumedActivity.scheduleEntryId,
            resumedAtWorldMinute: bindingMinute,
          }));
        }
      }
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
  const previousByAgent = new Map(snapshot.activeActivities.map((a) => [a.agentId, a]));
  return Array.from(agentIds)
    .map((agentId) => {
      const previous = previousByAgent.get(agentId);
      const next = buildActiveActivity(snapshot, agentId, minute, minute);
      if (!next) return null;
      if (previous && previous.scheduleEntryId === next.scheduleEntryId) {
        return { ...next, startedAtWorldMinute: previous.startedAtWorldMinute };
      }
      return next;
    })
    .filter((a): a is ActiveAgentActivity => a !== null);
}
