import { computePhase } from "@agent-office/life-sim/clock";
import type {
  LifeSimEvent,
  LifeSimCommand,
  LifeSimCommandResult,
  LifeSimSnapshot,
  LifeSimCapabilities,
} from "@agent-office/life-sim";
import type {
  LifeSimClient,
  LifeSimStreamObserver,
  LifeSimSessionState,
} from "./types.js";
import { projectLifeSim, type LifeSimProjection } from "./projection.js";

export interface LifeSimSessionOptions {
  reconnect?: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
  };
}

export class LifeSimSession {
  private client: LifeSimClient;
  private state: LifeSimSessionState = "idle";
  private localSnapshot: LifeSimSnapshot | null = null;
  private startOfDayMinute: number = 0;
  private endOfDayMinute: number = 1439;
  private lastAppliedLifeSimSequence: number | null = null;
  private subscription: { close(): void } | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private stopped = false;
  private initialDelayMs: number;
  private maxDelayMs: number;
  private maxAttempts: number;
  private stateListeners = new Set<(state: LifeSimSessionState) => void>();
  private projectionListeners = new Set<(projection: LifeSimProjection) => void>();

  constructor(client: LifeSimClient, options: LifeSimSessionOptions = {}) {
    this.client = client;
    this.initialDelayMs = options.reconnect?.initialDelayMs ?? 100;
    this.maxDelayMs = options.reconnect?.maxDelayMs ?? 5000;
    this.maxAttempts = options.reconnect?.maxAttempts ?? 5;
  }

  async start(): Promise<void> {
    if (this.state === "live" || this.state === "bootstrapping") {
      return;
    }
    this.stopped = false;
    try {
      await this.bootstrap();
    } catch (err) {
      this.scheduleReconnect();
      throw err;
    }
  }

  stop(): void {
    this.stopped = true;
    this.clearReconnect();
    this.closeSubscription();
    this.setState("idle");
  }

  getState(): LifeSimSessionState {
    return this.state;
  }

  getProjection(): LifeSimProjection {
    if (!this.localSnapshot) {
      throw new Error("Session has not been started");
    }
    return projectLifeSim(this.localSnapshot, this.getCapabilities());
  }

  getCapabilities(): LifeSimCapabilities {
    if (!this.localSnapshot) {
      throw new Error("Session has not been started");
    }
    const clock = this.localSnapshot.worldClock;
    const isRunning = clock.status === "running";
    const canActOnDay = isRunning && clock.minuteOfDay < this.endOfDayMinute;
    return {
      world: {
        startDay: clock.status === "not_started",
        pause: false,
        resume: false,
        endDay:
          (clock.status === "running" || clock.status === "paused") &&
          clock.minuteOfDay === this.endOfDayMinute,
        advanceTime: canActOnDay && clock.speed === 0,
        runToEndOfDay: canActOnDay,
      },
      schedule: { override: false, clearOverride: false },
      clock: { mode: "manual", maxSpeed: 0 },
    };
  }

  execute(command: LifeSimCommand): Promise<LifeSimCommandResult> {
    return this.client.execute(command);
  }

  onStateChange(listener: (state: LifeSimSessionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onProjectionChange(listener: (projection: LifeSimProjection) => void): () => void {
    this.projectionListeners.add(listener);
    return () => this.projectionListeners.delete(listener);
  }

  isTruncated(): boolean {
    return this.localSnapshot?.truncatedHistory.truncated ?? false;
  }

  private setState(state: LifeSimSessionState): void {
    this.state = state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  private notifyProjectionListeners(): void {
    const projection = this.getProjection();
    for (const listener of this.projectionListeners) {
      listener(projection);
    }
  }

  private closeSubscription(): void {
    this.subscription?.close();
    this.subscription = null;
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async bootstrap(): Promise<void> {
    this.setState("bootstrapping");
    const response = await this.client.getSnapshot();
    if (this.stopped) {
      return;
    }
    this.startOfDayMinute = response.startOfDayMinute;
    this.endOfDayMinute = response.endOfDayMinute;
    let snapshot = structuredClone(response.snapshot);
    let expected = response.checkpointLifeSimSequence + 1;
    let lastSeq = response.checkpointLifeSimSequence;
    for (const event of response.eventLogTail) {
      if (event.lifeSimSequence !== expected) {
        this.scheduleReconnect();
        return;
      }
      snapshot = applyLifeSimEvent(snapshot, event, this.startOfDayMinute);
      lastSeq = event.lifeSimSequence;
      expected++;
    }
    this.localSnapshot = snapshot;
    this.lastAppliedLifeSimSequence = lastSeq;
    this.reconnectAttempt = 0;
    this.setState("live");
    this.notifyProjectionListeners();
    this.openSubscription(lastSeq);
  }

  private openSubscription(afterLifeSimSequence: number): void {
    this.closeSubscription();
    const observer: LifeSimStreamObserver = {
      onEvent: (event) => this.handleLiveEvent(event),
      onState: (state) => {
        if (state === "reset_required") {
          this.handleUnrecoverable();
        }
      },
      onError: (error) => {
        if (error.recoverable) {
          this.scheduleReconnect();
        } else {
          this.handleUnrecoverable();
        }
      },
    };
    this.subscription = this.client.subscribe(afterLifeSimSequence, observer);
  }

  private handleLiveEvent(event: LifeSimEvent): void {
    const expected = (this.lastAppliedLifeSimSequence ?? -1) + 1;
    if (event.lifeSimSequence !== expected) {
      this.closeSubscription();
      this.scheduleReconnect();
      return;
    }
    this.localSnapshot = applyLifeSimEvent(
      structuredClone(this.localSnapshot!),
      event,
      this.startOfDayMinute
    );
    this.lastAppliedLifeSimSequence = event.lifeSimSequence;
    this.setState("live");
    this.notifyProjectionListeners();
  }

  private scheduleReconnect(): void {
    if (this.state === "error") return;
    this.closeSubscription();
    if (this.reconnectAttempt >= this.maxAttempts) {
      this.setState("error");
      return;
    }
    this.setState("reconnecting");
    const delay = Math.min(
      this.initialDelayMs * 2 ** this.reconnectAttempt,
      this.maxDelayMs
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      this.runBootstrap();
    }, delay);
  }

  private runBootstrap(): void {
    this.bootstrap().catch(() => this.scheduleReconnect());
  }

  private handleUnrecoverable(): void {
    this.clearReconnect();
    this.closeSubscription();
    this.setState("error");
  }
}

function applyLifeSimEvent(
  snapshot: LifeSimSnapshot,
  event: LifeSimEvent,
  startOfDayMinute: number
): LifeSimSnapshot {
  const next = structuredClone(snapshot);
  switch (event.type) {
    case "world.day_started": {
      const payload = event.payload as {
        day: number;
        dayOfWeek: number;
        startedAtWorldMinute: number;
      };
      next.worldClock = {
        ...next.worldClock,
        day: payload.day,
        dayOfWeek: payload.dayOfWeek as LifeSimSnapshot["worldClock"]["dayOfWeek"],
        minuteOfDay: payload.startedAtWorldMinute,
        phase: computePhase(payload.startedAtWorldMinute),
        status: "running",
        updatedAt: event.occurredAt,
      };
      break;
    }
    case "world.time_advanced": {
      const payload = event.payload as { newMinute: number };
      next.worldClock = {
        ...next.worldClock,
        minuteOfDay: payload.newMinute,
        phase: computePhase(payload.newMinute),
        fractionalMinute: 0,
        updatedAt: event.occurredAt,
      };
      break;
    }
    case "world.day_ending": {
      next.worldClock = {
        ...next.worldClock,
        status: "ending",
        updatedAt: event.occurredAt,
      };
      break;
    }
    case "world.day_ended": {
      next.worldClock = {
        ...next.worldClock,
        status: "not_started",
        minuteOfDay: startOfDayMinute,
        phase: computePhase(startOfDayMinute),
        fractionalMinute: 0,
        updatedAt: event.occurredAt,
      };
      break;
    }
    case "schedule.activity_started": {
      const payload = event.payload as {
        agentId: string;
        entryId: string;
        activity: string;
        roomId: string | null;
        startedAtWorldMinute: number;
      };
      const existing = next.activeActivities.find(
        (a) => a.agentId === payload.agentId
      );
      const activity = {
        agentId: payload.agentId,
        scheduleEntryId: payload.entryId,
        activity: payload.activity,
        roomId: payload.roomId,
        startedAtWorldMinute: payload.startedAtWorldMinute,
        interruptedByTaskId: null,
      };
      if (existing) {
        Object.assign(existing, activity);
      } else {
        next.activeActivities.push(activity);
      }
      break;
    }
    case "schedule.activity_completed":
    case "schedule.activity_interrupted": {
      const payload = event.payload as { agentId: string; entryId: string };
      next.activeActivities = next.activeActivities.filter(
        (a) => !(a.agentId === payload.agentId && a.scheduleEntryId === payload.entryId)
      );
      break;
    }
    case "schedule.activity_resumed": {
      const payload = event.payload as {
        agentId: string;
        entryId: string;
        resumedAtWorldMinute: number;
      };
      const entry = [...next.baseSchedules, ...next.activeOverlays.map((o) => o.entry)].find(
        (e) => e.entryId === payload.entryId
      );
      if (!entry) break;
      const activity = {
        agentId: payload.agentId,
        scheduleEntryId: payload.entryId,
        activity: entry.activity,
        roomId: entry.roomId,
        startedAtWorldMinute: payload.resumedAtWorldMinute,
        interruptedByTaskId: null,
      };
      const existing = next.activeActivities.find(
        (a) => a.agentId === payload.agentId
      );
      if (existing) {
        Object.assign(existing, activity);
      } else {
        next.activeActivities.push(activity);
      }
      break;
    }
    case "schedule.overlay_created": {
      const overlay = (event.payload as { overlay?: LifeSimSnapshot["activeOverlays"][number] }).overlay;
      if (overlay) {
        next.activeOverlays.push(structuredClone(overlay));
      }
      break;
    }
    case "schedule.overlay_ended": {
      const payload = event.payload as {
        agentId: string;
        overlayId: string;
        reason: string;
        endedAtWorldMinute: number;
      };
      next.activeOverlays = next.activeOverlays.filter(
        (o) => o.overlayId !== payload.overlayId
      );
      next.activeActivities = next.activeActivities.filter(
        (a) => a.scheduleEntryId !== payload.overlayId
      );
      break;
    }
    case "day.summary_recorded": {
      const payload = event.payload as {
        day: number;
        summary: LifeSimSnapshot["completedDaySummaries"][number];
      };
      next.completedDaySummaries = next.completedDaySummaries.filter(
        (s) => s.day !== payload.day
      );
      next.completedDaySummaries.push(structuredClone(payload.summary));
      break;
    }
  }
  return next;
}
