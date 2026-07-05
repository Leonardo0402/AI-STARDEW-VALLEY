import { computePhase, PHASE_BOUNDARIES } from "./clock.js";
import type { ActiveAgentActivity, AgentScheduleEntry, LifeSimEvent, LifeSimSnapshot } from "./types.js";

export function findEffectiveEntry(
  snapshot: LifeSimSnapshot,
  agentId: string,
  minute: number
): AgentScheduleEntry | null {
  const candidates: AgentScheduleEntry[] = [];
  for (const entry of snapshot.baseSchedules) {
    if (entry.agentId === agentId && entry.startMinute <= minute && entry.endMinute > minute) {
      candidates.push(entry);
    }
  }
  for (const overlay of snapshot.activeOverlays) {
    if (
      overlay.agentId === agentId &&
      overlay.entry.startMinute <= minute &&
      overlay.entry.endMinute > minute
    ) {
      candidates.push(overlay.entry);
    }
  }
  candidates.sort((a, b) => {
    if (a.source === "system" && b.source !== "system") return -1;
    if (b.source === "system" && a.source !== "system") return 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.entryId.localeCompare(b.entryId);
  });
  return candidates[0] ?? null;
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
  const currentMinute = snapshot.worldClock.minuteOfDay;
  const day = snapshot.worldClock.day;

  const makeEvent = (type: string, worldMinute: number, payload: unknown): LifeSimEvent => {
    const seq = nextSequence();
    return {
      eventId: `evt-${type}-${seq}`,
      worldId: snapshot.worldId,
      lifeSimSequence: seq,
      type,
      occurredAt: now,
      worldMinute,
      day,
      causationId,
      runtimeEventId: null,
      runtimeSequence: null,
      payload,
    };
  };

  const agentIds = Array.from(
    new Set([
      ...snapshot.baseSchedules.map((e) => e.agentId),
      ...snapshot.activeOverlays.map((o) => o.agentId),
    ])
  ).sort();

  const previousActivities = new Map(snapshot.activeActivities.map((a) => [a.agentId, a]));
  const previousEntries = new Map<string, AgentScheduleEntry | null>();
  const entryStartedAt = new Map<string, number>();
  for (const agentId of agentIds) {
    if (currentMinute === nextMinute) {
      previousEntries.set(agentId, null);
    } else {
      const entry = findEffectiveEntry(snapshot, agentId, currentMinute);
      previousEntries.set(agentId, entry);
      const previousActivity = previousActivities.get(agentId);
      if (entry && previousActivity && previousActivity.scheduleEntryId === entry.entryId) {
        entryStartedAt.set(agentId, previousActivity.startedAtWorldMinute);
      } else if (entry) {
        entryStartedAt.set(agentId, currentMinute);
      }
    }
  }

  const startMinute = currentMinute === nextMinute ? nextMinute : currentMinute + 1;

  for (let m = startMinute; m <= nextMinute; m++) {
    // 2. Existing overlays that end early at minute m (handled by runtime/overlay commands).

    // 3. Activity completions for entries ending at minute m.
    for (const agentId of agentIds) {
      const prev = previousEntries.get(agentId);
      if (prev && prev.endMinute === m) {
        events.push(
          makeEvent("schedule.activity_completed", m, {
            agentId,
            entryId: prev.entryId,
            completedAtWorldMinute: m,
          })
        );
      }
    }

    // 4. Phase changes if minute m crosses a phase boundary.
    if (PHASE_BOUNDARIES.includes(m)) {
      events.push(
        makeEvent("world.phase_changed", m, {
          oldPhase: computePhase(m - 1),
          newPhase: computePhase(m),
          minute: m,
        })
      );
    }

    // 5. Activity starts for entries beginning at minute m.
    // 6. Location changes implied by the above, only when the room actually changes.
    for (const agentId of agentIds) {
      const prev = previousEntries.get(agentId);
      const nextEntry = findEffectiveEntry(snapshot, agentId, m);

      if (nextEntry && nextEntry.startMinute === m && (!prev || prev.entryId !== nextEntry.entryId)) {
        entryStartedAt.set(agentId, m);
        events.push(
          makeEvent("schedule.activity_started", m, {
            agentId,
            entryId: nextEntry.entryId,
            activity: nextEntry.activity,
            roomId: nextEntry.roomId,
            startedAtWorldMinute: m,
          })
        );
      }

      const oldRoomId = prev?.roomId ?? null;
      const newRoomId = nextEntry?.roomId ?? null;
      if (oldRoomId !== newRoomId) {
        events.push(
          makeEvent("agent.location_changed", m, {
            agentId,
            oldRoomId,
            newRoomId,
            reason: "schedule_transition",
          })
        );
      }

      previousEntries.set(agentId, nextEntry);
    }
  }

  const newActivities: ActiveAgentActivity[] = [];
  for (const agentId of agentIds) {
    const entry = findEffectiveEntry(snapshot, agentId, nextMinute);
    if (!entry) continue;

    const startedAtWorldMinute = entryStartedAt.get(agentId) ?? nextMinute;

    newActivities.push({
      agentId,
      scheduleEntryId: entry.entryId,
      activity: entry.activity,
      roomId: entry.roomId,
      startedAtWorldMinute,
      interruptedByTaskId: null,
    });
  }

  return { snapshot: { ...snapshot, activeActivities: newActivities }, events };
}
