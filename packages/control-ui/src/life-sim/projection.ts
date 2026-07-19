import type {
  AgentScheduleEntry,
  LifeSimCapabilities,
  LifeSimSnapshot,
} from "@agent-office/life-sim";
import type { OfficeProjection } from "@agent-office/protocol";
import type { IntegrationProjection } from "../integration/types.js";

export interface WorldClockView {
  day: number;
  dayOfWeek: number;
  minuteOfDay: number;
  phase: "dawn" | "morning" | "afternoon" | "evening" | "night";
  status: "not_started" | "running" | "paused" | "ending";
  speed: number;
}

export interface AgentLifeSimView {
  agentId: string;
  currentActivity: string;
  currentRoomId: string | null;
  currentEntryId: string;
  nextEntryId: string | null;
  nextEntryAtMinute: number | null;
  isOverridden: boolean;
  overrideReason: "task" | "operator" | null;
}

export interface LifeSimProjection {
  world: WorldClockView;
  agents: AgentLifeSimView[];
  nextTransition: { agentId: string; entryId: string; atMinute: number } | null;
  previousDaySummaries: LifeSimSnapshot["completedDaySummaries"];
  capabilities: LifeSimCapabilities;
  truncated: boolean;
  lostRuntimeRange: { from: number; to: number } | null;
}

export interface ComposedOfficeProjection extends OfficeProjection {
  lifeSim: LifeSimProjection;
  integration: IntegrationProjection;
}

function deriveDayOfWeek(day: number): number {
  return ((day - 1) % 7) + 1;
}

function getAllAgentIds(snapshot: LifeSimSnapshot): string[] {
  const ids = new Set<string>();
  for (const activity of snapshot.activeActivities) ids.add(activity.agentId);
  for (const overlay of snapshot.activeOverlays) ids.add(overlay.agentId);
  for (const entry of snapshot.baseSchedules) ids.add(entry.agentId);
  return Array.from(ids).sort();
}

function isEntryActive(entry: AgentScheduleEntry, minute: number): boolean {
  return entry.startMinute <= minute && entry.endMinute > minute;
}

function findEffectiveEntry(
  snapshot: LifeSimSnapshot,
  agentId: string,
  minute: number
): AgentScheduleEntry | null {
  const candidates: AgentScheduleEntry[] = [];
  for (const entry of snapshot.baseSchedules) {
    if (entry.agentId === agentId && isEntryActive(entry, minute)) {
      candidates.push(entry);
    }
  }
  for (const overlay of snapshot.activeOverlays) {
    if (
      overlay.agentId === agentId &&
      isEntryActive(overlay.entry, minute)
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

function findOverlayForEntry(
  snapshot: LifeSimSnapshot,
  agentId: string,
  entryId: string
): LifeSimSnapshot["activeOverlays"][number] | null {
  for (const overlay of snapshot.activeOverlays) {
    if (
      overlay.agentId === agentId &&
      overlay.entry.entryId === entryId
    ) {
      return overlay;
    }
  }
  return null;
}

function computeNextEntryForAgent(
  snapshot: LifeSimSnapshot,
  agentId: string,
  minute: number
): { entryId: string; atMinute: number } | null {
  const candidates: Array<{ entryId: string; startMinute: number }> = [];
  for (const entry of snapshot.baseSchedules) {
    if (entry.agentId === agentId && entry.startMinute > minute) {
      candidates.push({ entryId: entry.entryId, startMinute: entry.startMinute });
    }
  }
  for (const overlay of snapshot.activeOverlays) {
    if (overlay.agentId === agentId && overlay.entry.startMinute > minute) {
      candidates.push({
        entryId: overlay.entry.entryId,
        startMinute: overlay.entry.startMinute,
      });
    }
  }
  candidates.sort((a, b) => {
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.entryId.localeCompare(b.entryId);
  });
  const next = candidates[0];
  if (!next) return null;
  return { entryId: next.entryId, atMinute: next.startMinute };
}

function computeNextTransition(
  snapshot: LifeSimSnapshot
): LifeSimProjection["nextTransition"] {
  const minute = snapshot.worldClock.minuteOfDay;
  const agentIds = getAllAgentIds(snapshot);

  let candidate: { agentId: string; entryId: string; atMinute: number } | null =
    null;

  for (const agentId of agentIds) {
    const entry = findEffectiveEntry(snapshot, agentId, minute);
    if (entry && entry.endMinute > minute) {
      if (
        !candidate ||
        entry.endMinute < candidate.atMinute ||
        (entry.endMinute === candidate.atMinute &&
          (agentId < candidate.agentId ||
            (agentId === candidate.agentId &&
              entry.entryId < candidate.entryId)))
      ) {
        candidate = {
          agentId,
          entryId: entry.entryId,
          atMinute: entry.endMinute,
        };
      }
    }
  }

  if (candidate) return candidate;

  for (const agentId of agentIds) {
    const futures: Array<{ entryId: string; startMinute: number }> = [];
    for (const entry of snapshot.baseSchedules) {
      if (entry.agentId === agentId && entry.startMinute > minute) {
        futures.push({ entryId: entry.entryId, startMinute: entry.startMinute });
      }
    }
    for (const overlay of snapshot.activeOverlays) {
      if (overlay.agentId === agentId && overlay.entry.startMinute > minute) {
        futures.push({
          entryId: overlay.entry.entryId,
          startMinute: overlay.entry.startMinute,
        });
      }
    }
    futures.sort((a, b) => {
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      return a.entryId.localeCompare(b.entryId);
    });
    const future = futures[0];
    if (future) {
      if (
        !candidate ||
        future.startMinute < candidate.atMinute ||
        (future.startMinute === candidate.atMinute &&
          (agentId < candidate.agentId ||
            (agentId === candidate.agentId &&
              future.entryId < candidate.entryId)))
      ) {
        candidate = {
          agentId,
          entryId: future.entryId,
          atMinute: future.startMinute,
        };
      }
    }
  }

  return candidate;
}

function buildAgentView(
  snapshot: LifeSimSnapshot,
  agentId: string
): AgentLifeSimView | null {
  const minute = snapshot.worldClock.minuteOfDay;
  const active = snapshot.activeActivities.find((a) => a.agentId === agentId);

  let currentEntryId: string;
  let currentActivity: string;
  let currentRoomId: string | null;

  if (active) {
    currentEntryId = active.scheduleEntryId;
    currentActivity = active.activity;
    currentRoomId = active.roomId;
  } else {
    const entry = findEffectiveEntry(snapshot, agentId, minute);
    if (!entry) return null;
    currentEntryId = entry.entryId;
    currentActivity = entry.activity;
    currentRoomId = entry.roomId;
  }

  const overlay = findOverlayForEntry(snapshot, agentId, currentEntryId);
  const isOverridden = overlay !== null;
  const overrideReason = overlay?.createdBy ?? null;

  const next = computeNextEntryForAgent(snapshot, agentId, minute);

  return {
    agentId,
    currentActivity,
    currentRoomId,
    currentEntryId,
    nextEntryId: next?.entryId ?? null,
    nextEntryAtMinute: next?.atMinute ?? null,
    isOverridden,
    overrideReason,
  };
}

export function projectLifeSim(
  snapshot: LifeSimSnapshot,
  capabilities: LifeSimCapabilities
): LifeSimProjection {
  const agentIds = getAllAgentIds(snapshot);
  const agents: AgentLifeSimView[] = [];
  for (const agentId of agentIds) {
    const view = buildAgentView(snapshot, agentId);
    if (view) agents.push(view);
  }

  return {
    world: {
      day: snapshot.worldClock.day,
      dayOfWeek: deriveDayOfWeek(snapshot.worldClock.day),
      minuteOfDay: snapshot.worldClock.minuteOfDay,
      phase: snapshot.worldClock.phase,
      status: snapshot.worldClock.status,
      speed: snapshot.worldClock.speed,
    },
    agents,
    nextTransition: computeNextTransition(snapshot),
    previousDaySummaries: snapshot.completedDaySummaries,
    capabilities,
    truncated: snapshot.truncatedHistory.truncated,
    lostRuntimeRange: snapshot.truncatedHistory.lostRuntimeRange,
  };
}

export function composeProjections(
  office: OfficeProjection,
  lifeSim: LifeSimProjection,
  integration: IntegrationProjection
): ComposedOfficeProjection {
  return { ...office, lifeSim, integration };
}
