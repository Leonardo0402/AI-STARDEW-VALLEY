import type { AgentScheduleEntry } from "../types.js";

export function sampleDay1Schedules(): AgentScheduleEntry[] {
  return [
    { entryId: "orch-arrive", agentId: "orchestrator-1", startMinute: 480, endMinute: 510, activity: "arrive", roomId: "room-command", priority: 1, source: "base" },
    { entryId: "orch-work-am", agentId: "orchestrator-1", startMinute: 510, endMinute: 720, activity: "work", roomId: "room-command", priority: 1, source: "base" },
    { entryId: "worker-arrive", agentId: "worker-1", startMinute: 480, endMinute: 510, activity: "arrive", roomId: "room-command", priority: 1, source: "base" },
    { entryId: "worker-work-am", agentId: "worker-1", startMinute: 510, endMinute: 720, activity: "work", roomId: "room-execution", priority: 1, source: "base" },
    { entryId: "reviewer-arrive", agentId: "reviewer-1", startMinute: 480, endMinute: 510, activity: "arrive", roomId: "room-command", priority: 1, source: "base" },
    { entryId: "reviewer-review-am", agentId: "reviewer-1", startMinute: 510, endMinute: 720, activity: "review", roomId: "room-review", priority: 1, source: "base" },
  ];
}
