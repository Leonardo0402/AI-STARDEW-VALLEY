import type { DomainEvent, RuntimeSnapshot } from "@agent-office/protocol";

export type LifeSimStatus = "not_started" | "running" | "paused" | "ending";

export interface WorldClockState {
  worldId: string;
  day: number;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  minuteOfDay: number;
  phase: "dawn" | "morning" | "afternoon" | "evening" | "night";
  status: LifeSimStatus;
  speed: number;
  fractionalMinute: number;
  updatedAt: string;
}

export interface AgentScheduleEntry {
  entryId: string;
  agentId: string;
  startMinute: number;
  endMinute: number;
  activity: "arrive" | "work" | "review" | "break" | "social" | "idle" | "leave";
  roomId: string | null;
  priority: number;
  source: "base" | "task_overlay" | "operator_overlay" | "system";
}

export interface ActiveAgentActivity {
  agentId: string;
  scheduleEntryId: string;
  activity: string;
  roomId: string | null;
  startedAtWorldMinute: number;
  interruptedByTaskId: string | null;
}

export interface ScheduleOverlay {
  overlayId: string;
  agentId: string;
  entry: AgentScheduleEntry;
  createdBy: "task" | "operator";
  createdAtWorldMinute: number;
  createdByTaskId: string | null;
  createdByRuntimeSequence: number;
  originalStartMinute: number | null;
}

export interface DaySummary {
  day: number;
  startedAtWorldMinute: number;
  endedAtWorldMinute: number;
  truncated: boolean;
  agentActivities: Array<{
    agentId: string;
    activityMinutes: Record<string, number>;
    roomsVisited: string[];
  }>;
  taskCounts: {
    created: number;
    completed: number;
    blocked: number;
    failed: number;
  };
  approvalCounts: {
    requested: number;
    approved: number;
    rejected: number;
  };
  notableEventIds: string[];
}

export interface TruncatedHistory {
  truncated: boolean;
  lostRuntimeRange: { from: number; to: number } | null;
}

export interface LifeSimSnapshot {
  worldId: string;
  schemaVersion: string;
  checkpointLifeSimSequence: number;
  lastObservedRuntimeSequence: number;
  lastAppliedRuntimeSequence: number;
  worldClock: WorldClockState;
  baseSchedules: AgentScheduleEntry[];
  activeActivities: ActiveAgentActivity[];
  activeOverlays: ScheduleOverlay[];
  completedDaySummaries: DaySummary[];
  truncatedHistory: TruncatedHistory;
}

export interface LifeSimEvent<P = unknown> {
  eventId: string;
  worldId: string;
  lifeSimSequence: number;
  type: string;
  occurredAt: string;
  worldMinute: number;
  day: number;
  causationId: string | null;
  runtimeEventId: string | null;
  runtimeSequence: number | null;
  payload: P;
}

export interface LifeSimCommand<P = unknown> {
  commandId: string;
  commandType: string;
  timestamp: string;
  source: "user" | "system";
  actorId: string;
  worldId: string;
  payload: P;
}

export type LifeSimCommandErrorCode =
  | "invalid_command"
  | "invalid_day"
  | "invalid_time"
  | "day_not_started"
  | "day_already_started"
  | "day_already_ended"
  | "end_of_day_not_reached"
  | "advance_not_allowed_in_realtime"
  | "invalid_schedule"
  | "overlay_not_found"
  | "history_truncated"
  | "not_implemented"
  | "internal_error";

export interface LifeSimCommandResult {
  commandId: string;
  status: "accepted" | "rejected";
  lifeSimSequence: number | null;
  events: LifeSimEvent[];
  error: {
    code: LifeSimCommandErrorCode;
    message: string;
  } | null;
}

export interface LifeSimSnapshotResponse {
  worldId: string;
  schemaVersion: string;
  checkpointLifeSimSequence: number;
  snapshot: LifeSimSnapshot;
  eventLogTail: LifeSimEvent[];
}

export interface LifeSimCapabilities {
  world: {
    startDay: boolean;
    pause: boolean;
    resume: boolean;
    endDay: boolean;
    advanceTime: boolean;
  };
  schedule: {
    override: boolean;
    clearOverride: boolean;
  };
  clock: {
    mode: "manual" | "realtime";
    maxSpeed: number;
  };
}

export interface OperationalReplayResult {
  events: Array<{ runtimeEvent: DomainEvent; runtimeSequence: number }>;
  nextRuntimeSequence: number;
  truncated: boolean;
  lostRuntimeRange: { from: number; to: number } | null;
}

export interface OperationalEventJournal {
  replay(fromRuntimeSequence: number): Promise<OperationalReplayResult>;
}

export interface LifeSimStore {
  load(): Promise<{ snapshot: LifeSimSnapshot; eventLogTail: LifeSimEvent[]; commandResults: Map<string, LifeSimCommandResult> } | null>;
  save(snapshot: LifeSimSnapshot, eventLogTail: LifeSimEvent[], commandResults: Map<string, LifeSimCommandResult>): Promise<void>;
}

export interface LifeSimEngine {
  execute(command: LifeSimCommand): Promise<LifeSimCommandResult>;
  getSnapshot(): LifeSimSnapshotResponse;
  getCapabilities(): LifeSimCapabilities;
  applyRuntimeEvent(event: DomainEvent): Promise<void>;
  observeRuntimeSequence(sequence: number): Promise<void>;
  onLifeSimEvent(listener: (event: LifeSimEvent) => void): () => void;
}

export interface LifeSimEngineConfig {
  worldId: string;
  startOfDayMinute: number;
  endOfDayMinute: number;
  baseSchedules?: AgentScheduleEntry[];
}
