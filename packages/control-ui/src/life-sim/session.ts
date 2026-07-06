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
  LifeSimProjection,
} from "./types.js";

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
  private lastAppliedLifeSimSequence: number | null = null;
  private subscription: { close(): void } | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
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
    try {
      await this.bootstrap();
    } catch (err) {
      this.scheduleReconnect();
      throw err;
    }
  }

  stop(): void {
    this.clearReconnect();
    this.closeSubscription();
    this.setState("idle");
  }

  getProjection(): LifeSimProjection {
    if (!this.localSnapshot) {
      throw new Error("Session has not been started");
    }
    const snapshot = structuredClone(this.localSnapshot);
    return {
      worldClock: snapshot.worldClock,
      activeActivities: snapshot.activeActivities,
      activeOverlays: snapshot.activeOverlays,
      completedDaySummaries: snapshot.completedDaySummaries,
      truncatedHistory: snapshot.truncatedHistory,
    };
  }

  getCapabilities(): LifeSimCapabilities {
    if (!this.localSnapshot) {
      throw new Error("Session has not been started");
    }
    const clock = this.localSnapshot.worldClock;
    const isRunning = clock.status === "running";
    return {
      world: {
        startDay: clock.status === "not_started",
        pause: false,
        resume: false,
        endDay: false,
        advanceTime: isRunning && clock.speed === 0 && clock.minuteOfDay < 1439,
        runToEndOfDay: isRunning && clock.minuteOfDay < 1439,
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
    let snapshot = structuredClone(response.snapshot);
    let expected = response.checkpointLifeSimSequence + 1;
    let lastSeq = response.checkpointLifeSimSequence;
    for (const event of response.eventLogTail) {
      if (event.lifeSimSequence !== expected) {
        throw new Error(
          `Tail continuity gap: expected ${expected}, got ${event.lifeSimSequence}`
        );
      }
      snapshot = applyLifeSimEvent(snapshot, event);
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
      event
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
  event: LifeSimEvent
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
        status: "running",
      };
      break;
    }
    case "world.day_ended": {
      next.worldClock = {
        ...next.worldClock,
        status: "not_started",
        minuteOfDay: 0,
        fractionalMinute: 0,
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
        next.activeOverlays.push(overlay);
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
      next.completedDaySummaries.push(payload.summary);
      break;
    }
  }
  return next;
}
