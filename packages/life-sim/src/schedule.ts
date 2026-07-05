import type { ActiveAgentActivity, AgentScheduleEntry, LifeSimEvent, LifeSimSnapshot } from "./types.js";

export function findEffectiveEntry(
  snapshot: LifeSimSnapshot,
  agentId: string,
  minute: number
): AgentScheduleEntry | null {
  const overlays = snapshot.activeOverlays
    .filter((o) => o.agentId === agentId && o.entry.startMinute <= minute && o.entry.endMinute > minute)
    .sort((a, b) => b.entry.priority - a.entry.priority);
  if (overlays.length > 0) return overlays[0].entry;
  const base = snapshot.baseSchedules.filter(
    (e) => e.agentId === agentId && e.startMinute <= minute && e.endMinute > minute
  );
  return base.length > 0 ? base[0] : null;
}

export function buildActiveActivity(
  snapshot: LifeSimSnapshot,
  agentId: string,
  minute: number,
  startedAtWorldMinute: number,
  interruptedByTaskId: string | null = null
): ActiveAgentActivity | null {
  const entry = findEffectiveEntry(snapshot, agentId, minute);
  if (!entry) return null;
  return {
    agentId,
    scheduleEntryId: entry.entryId,
    activity: entry.activity,
    roomId: entry.roomId,
    startedAtWorldMinute,
    interruptedByTaskId,
  };
}

export interface TransitionResult {
  snapshot: LifeSimSnapshot;
  events: LifeSimEvent[];
}

export function transitionToMinute(
  snapshot: LifeSimSnapshot,
  nextMinute: number,
  nextSequence: () => number,
  now: string,
  causationId: string
): TransitionResult {
  const events: LifeSimEvent[] = [];
  let nextSnapshot = snapshot;
  const currentMinute = snapshot.worldClock.minuteOfDay;
  // End any base entries whose endMinute <= nextMinute
  for (const activity of snapshot.activeActivities) {
    const entry = findEffectiveEntry(snapshot, activity.agentId, currentMinute);
    if (entry && entry.endMinute <= nextMinute) {
      const seq = nextSequence();
      events.push({
        eventId: `evt-completed-${seq}`,
        worldId: snapshot.worldId,
        lifeSimSequence: seq,
        type: "schedule.activity_completed",
        occurredAt: now,
        worldMinute: entry.endMinute,
        day: snapshot.worldClock.day,
        causationId,
        runtimeEventId: null,
        runtimeSequence: null,
        payload: { agentId: activity.agentId, entryId: entry.entryId, completedAtWorldMinute: entry.endMinute },
      });
    }
  }
  // Start new effective entries
  const activeAgents = new Set(snapshot.activeActivities.map((a) => a.agentId));
  const agentIds = new Set(snapshot.baseSchedules.map((e) => e.agentId));
  for (const agentId of agentIds) {
    if (activeAgents.has(agentId)) continue;
    const entry = findEffectiveEntry(snapshot, agentId, nextMinute);
    if (entry && entry.startMinute <= nextMinute) {
      const seq = nextSequence();
      events.push({
        eventId: `evt-started-${seq}`,
        worldId: snapshot.worldId,
        lifeSimSequence: seq,
        type: "schedule.activity_started",
        occurredAt: now,
        worldMinute: nextMinute,
        day: snapshot.worldClock.day,
        causationId,
        runtimeEventId: null,
        runtimeSequence: null,
        payload: {
          agentId,
          entryId: entry.entryId,
          activity: entry.activity,
          roomId: entry.roomId,
          startedAtWorldMinute: nextMinute,
        },
      });
    }
  }
  const newActivities = Array.from(agentIds)
    .map((agentId) => buildActiveActivity(snapshot, agentId, nextMinute, nextMinute))
    .filter((a): a is ActiveAgentActivity => a !== null);
  nextSnapshot = { ...snapshot, activeActivities: newActivities };
  return { snapshot: nextSnapshot, events };
}
