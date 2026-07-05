import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  LifeSimCommandResult,
  LifeSimEngineConfig,
  LifeSimEvent,
  LifeSimSnapshot,
  LifeSimStore,
  WorldClockState,
} from "./types.js";

export interface StoredWorld {
  snapshot: LifeSimSnapshot;
  eventLogTail: LifeSimEvent[];
  commandResults: Record<string, LifeSimCommandResult>;
}

export function createEmptySnapshot(
  config: LifeSimEngineConfig,
  now: string
): LifeSimSnapshot {
  const worldClock: WorldClockState = {
    worldId: config.worldId,
    day: 0,
    dayOfWeek: 1,
    minuteOfDay: config.startOfDayMinute,
    phase: minuteToPhase(config.startOfDayMinute),
    status: "not_started",
    speed: 0,
    fractionalMinute: 0,
    updatedAt: now,
  };
  return {
    worldId: config.worldId,
    schemaVersion: "1.0",
    checkpointLifeSimSequence: 0,
    lastObservedRuntimeSequence: 0,
    lastAppliedRuntimeSequence: 0,
    worldClock,
    baseSchedules: [],
    activeActivities: [],
    activeOverlays: [],
    completedDaySummaries: [],
    truncatedHistory: { truncated: false, lostRuntimeRange: null },
  };
}

function minuteToPhase(minute: number): WorldClockState["phase"] {
  if (minute < 360) return "dawn";
  if (minute < 720) return "morning";
  if (minute < 1080) return "afternoon";
  if (minute < 1260) return "evening";
  return "night";
}

export class InMemoryLifeSimStore implements LifeSimStore {
  private snapshot: LifeSimSnapshot | null = null;
  private eventLogTail: LifeSimEvent[] = [];
  private commandResults = new Map<string, LifeSimCommandResult>();

  constructor(initial?: { snapshot: LifeSimSnapshot; eventLogTail: LifeSimEvent[]; commandResults: Map<string, LifeSimCommandResult> }) {
    if (initial) {
      this.snapshot = structuredClone(initial.snapshot);
      this.eventLogTail = structuredClone(initial.eventLogTail);
      this.commandResults = new Map(initial.commandResults);
    }
  }

  set(snapshot: LifeSimSnapshot, eventLogTail: LifeSimEvent[], commandResults: Map<string, LifeSimCommandResult>): void {
    this.snapshot = structuredClone(snapshot);
    this.eventLogTail = structuredClone(eventLogTail);
    this.commandResults = new Map(commandResults);
  }

  async load(): Promise<{ snapshot: LifeSimSnapshot; eventLogTail: LifeSimEvent[]; commandResults: Map<string, LifeSimCommandResult> } | null> {
    if (!this.snapshot) return null;
    return {
      snapshot: structuredClone(this.snapshot),
      eventLogTail: structuredClone(this.eventLogTail),
      commandResults: new Map(this.commandResults),
    };
  }

  async save(
    snapshot: LifeSimSnapshot,
    eventLogTail: LifeSimEvent[],
    commandResults: Map<string, LifeSimCommandResult>
  ): Promise<void> {
    this.snapshot = structuredClone(snapshot);
    this.eventLogTail = structuredClone(eventLogTail);
    this.commandResults = new Map(commandResults);
  }
}

export class FileLifeSimStore implements LifeSimStore {
  private path: string;

  constructor(worldId: string, dataDir = "./data/life-sim") {
    this.path = join(dataDir, `${worldId}.json`);
  }

  async load(): Promise<{ snapshot: LifeSimSnapshot; eventLogTail: LifeSimEvent[]; commandResults: Map<string, LifeSimCommandResult> } | null> {
    try {
      const raw = await readFile(this.path, "utf-8");
      const stored: StoredWorld = JSON.parse(raw);
      return {
        snapshot: stored.snapshot,
        eventLogTail: stored.eventLogTail,
        commandResults: new Map(Object.entries(stored.commandResults)),
      };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  async save(
    snapshot: LifeSimSnapshot,
    eventLogTail: LifeSimEvent[],
    commandResults: Map<string, LifeSimCommandResult>
  ): Promise<void> {
    const stored: StoredWorld = {
      snapshot,
      eventLogTail,
      commandResults: Object.fromEntries(commandResults),
    };
    const tmp = `${this.path}.tmp`;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(tmp, JSON.stringify(stored, null, 2));
    await rename(tmp, this.path);
  }
}
