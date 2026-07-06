import type {
  AgentScheduleEntry,
  LifeSimCommand,
  LifeSimCommandErrorCode,
  LifeSimCommandResult,
  LifeSimEngineConfig,
  LifeSimEvent,
  LifeSimSnapshot,
  LifeSimStatus,
  WorldClockState,
} from "./types.js";
import { computePhase } from "./clock.js";
import { transitionToMinute } from "./schedule.js";
import { computeDaySummary } from "./summary.js";

function installBaseSchedules(
  snapshot: LifeSimSnapshot,
  baseSchedules: AgentScheduleEntry[]
): LifeSimSnapshot {
  if (snapshot.baseSchedules.length > 0) return snapshot;
  return { ...snapshot, baseSchedules };
}

export interface WorldReduceOutput {
  snapshot: LifeSimSnapshot;
  events: LifeSimEvent[];
  result: LifeSimCommandResult;
}

export function reduceWorldCommand(
  snapshot: LifeSimSnapshot,
  command: LifeSimCommand,
  config: LifeSimEngineConfig,
  nextSequence: () => number,
  now: string
): WorldReduceOutput {
  const rejected = (code: LifeSimCommandErrorCode, message: string): WorldReduceOutput => ({
    snapshot,
    events: [],
    result: {
      commandId: command.commandId,
      status: "rejected",
      lifeSimSequence: null,
      events: [],
      error: { code, message },
    },
  });

  const clock = snapshot.worldClock;

  switch (command.commandType) {
    case "world.start_day": {
      if (clock.status !== "not_started") {
        return rejected("day_already_started", "A day is already in progress");
      }
      const requestedDay = (command.payload as { day?: number }).day;
      const lastCompletedDay = snapshot.completedDaySummaries.at(-1)?.day ?? 0;
      const expectedDay = lastCompletedDay + 1;
      const day = requestedDay ?? expectedDay;
      if (day !== expectedDay) {
        return rejected("invalid_day", `Day must be ${expectedDay}, got ${day}`);
      }
      const dayOfWeek = (((day - 1) % 7) + 1) as WorldClockState["dayOfWeek"];
      const nextClock = {
        ...clock,
        day,
        dayOfWeek,
        status: "running" as LifeSimStatus,
        minuteOfDay: config.startOfDayMinute,
        phase: computePhase(config.startOfDayMinute),
        updatedAt: now,
      };
      const snapshotWithClock = { ...snapshot, worldClock: nextClock };
      const snapshotWithSchedules = installBaseSchedules(snapshotWithClock, config.baseSchedules ?? []);
      const event: LifeSimEvent = {
        eventId: `evt-start-day-${day}`,
        worldId: snapshot.worldId,
        lifeSimSequence: nextSequence(),
        type: "world.day_started",
        occurredAt: now,
        worldMinute: config.startOfDayMinute,
        day,
        causationId: command.commandId,
        runtimeEventId: null,
        runtimeSequence: null,
        payload: { day, dayOfWeek, startedAtWorldMinute: config.startOfDayMinute },
      };
      const scheduleResult = transitionToMinute(
        snapshotWithSchedules,
        config.startOfDayMinute,
        nextSequence,
        now,
        command.commandId
      );
      const nextSnapshot: LifeSimSnapshot = {
        ...snapshotWithSchedules,
        activeActivities: scheduleResult.snapshot.activeActivities,
      };
      const events = [event, ...scheduleResult.events];
      return {
        snapshot: nextSnapshot,
        events,
        result: {
          commandId: command.commandId,
          status: "accepted",
          lifeSimSequence: event.lifeSimSequence,
          events,
          error: null,
        },
      };
    }

    case "world.advance_time": {
      if (clock.status !== "running") {
        return rejected("day_not_started", "Clock is not running");
      }
      if (clock.speed !== 0) {
        return rejected("advance_not_allowed_in_realtime", "advance_time is only allowed in manual mode");
      }
      const minutes = (command.payload as { minutes: number }).minutes;
      if (!Number.isInteger(minutes) || minutes <= 0) {
        return rejected("invalid_time", "minutes must be a positive integer");
      }
      const targetMinute = Math.min(clock.minuteOfDay + minutes, config.endOfDayMinute);
      const delta = targetMinute - clock.minuteOfDay;
      if (delta <= 0) {
        return rejected("end_of_day_not_reached", "Already at end of day");
      }
      const scheduleResult = transitionToMinute(
        snapshot,
        targetMinute,
        nextSequence,
        now,
        command.commandId
      );
      const nextClock = {
        ...clock,
        minuteOfDay: targetMinute,
        phase: computePhase(targetMinute),
        updatedAt: now,
      };
      const events = [...scheduleResult.events];
      const baseSeq = nextSequence();
      events.push({
        eventId: `evt-advance-${baseSeq}`,
        worldId: snapshot.worldId,
        lifeSimSequence: baseSeq,
        type: "world.time_advanced",
        occurredAt: now,
        worldMinute: targetMinute,
        day: clock.day,
        causationId: command.commandId,
        runtimeEventId: null,
        runtimeSequence: null,
        payload: { oldMinute: clock.minuteOfDay, newMinute: targetMinute, day: clock.day },
      });
      const nextSnapshot: LifeSimSnapshot = {
        ...snapshot,
        worldClock: nextClock,
        activeActivities: scheduleResult.snapshot.activeActivities,
      };
      return {
        snapshot: nextSnapshot,
        events,
        result: {
          commandId: command.commandId,
          status: "accepted",
          lifeSimSequence: events[0].lifeSimSequence,
          events,
          error: null,
        },
      };
    }

    case "world.end_day": {
      const day = clock.day;
      if (snapshot.completedDaySummaries.some((s) => s.day === day)) {
        return {
          snapshot,
          events: [],
          result: {
            commandId: command.commandId,
            status: "accepted",
            lifeSimSequence: null,
            events: [],
            error: null,
          },
        };
      }
      if (clock.status !== "running" && clock.status !== "paused") {
        return rejected("day_not_started", "No day is running");
      }
      if (clock.minuteOfDay !== config.endOfDayMinute) {
        return rejected("end_of_day_not_reached", "End-of-day minute not reached");
      }

      const events: LifeSimEvent[] = [];
      const startedAtWorldMinute = config.startOfDayMinute;
      const endedAtWorldMinute = clock.minuteOfDay;
      const summaryId = `summary-${day}`;

      // 1. Move to "ending".
      let nextSnapshot: LifeSimSnapshot = {
        ...snapshot,
        worldClock: {
          ...clock,
          status: "ending" as LifeSimStatus,
          updatedAt: now,
        },
      };

      // End any remaining active overlays with reason "day_ending".
      for (const overlay of nextSnapshot.activeOverlays) {
        const seq = nextSequence();
        events.push({
          eventId: `evt-overlay-ended-${seq}`,
          worldId: snapshot.worldId,
          lifeSimSequence: seq,
          type: "schedule.overlay_ended",
          occurredAt: now,
          worldMinute: endedAtWorldMinute,
          day,
          causationId: command.commandId,
          runtimeEventId: null,
          runtimeSequence: null,
          payload: {
            agentId: overlay.agentId,
            overlayId: overlay.overlayId,
            reason: "day_ending",
            endedAtWorldMinute,
          },
        });
      }
      nextSnapshot = { ...nextSnapshot, activeOverlays: [] };

      const endingSeq = nextSequence();
      const endingEvent: LifeSimEvent = {
        eventId: `evt-day-ending-${endingSeq}`,
        worldId: snapshot.worldId,
        lifeSimSequence: endingSeq,
        type: "world.day_ending",
        occurredAt: now,
        worldMinute: endedAtWorldMinute,
        day,
        causationId: command.commandId,
        runtimeEventId: null,
        runtimeSequence: null,
        payload: { day, endedAtWorldMinute },
      };
      events.push(endingEvent);

      const { summary } = computeDaySummary(nextSnapshot, day, startedAtWorldMinute, endedAtWorldMinute);
      nextSnapshot = {
        ...nextSnapshot,
        completedDaySummaries: [...nextSnapshot.completedDaySummaries, summary],
      };

      const summarySeq = nextSequence();
      events.push({
        eventId: `evt-summary-recorded-${summarySeq}`,
        worldId: snapshot.worldId,
        lifeSimSequence: summarySeq,
        type: "day.summary_recorded",
        occurredAt: now,
        worldMinute: endedAtWorldMinute,
        day,
        causationId: command.commandId,
        runtimeEventId: null,
        runtimeSequence: null,
        payload: { summaryId, day, summary },
      });

      const endedSeq = nextSequence();
      events.push({
        eventId: `evt-day-ended-${endedSeq}`,
        worldId: snapshot.worldId,
        lifeSimSequence: endedSeq,
        type: "world.day_ended",
        occurredAt: now,
        worldMinute: endedAtWorldMinute,
        day,
        causationId: command.commandId,
        runtimeEventId: null,
        runtimeSequence: null,
        payload: { day, summaryId },
      });

      // Final reset: back to "not_started" for the next day.
      nextSnapshot = {
        ...nextSnapshot,
        worldClock: {
          ...clock,
          status: "not_started" as LifeSimStatus,
          minuteOfDay: config.startOfDayMinute,
          phase: computePhase(config.startOfDayMinute),
          fractionalMinute: 0,
          updatedAt: now,
        },
        activeActivities: [],
      };

      return {
        snapshot: nextSnapshot,
        events,
        result: {
          commandId: command.commandId,
          status: "accepted",
          lifeSimSequence: endingEvent.lifeSimSequence,
          events,
          error: null,
        },
      };
    }

    case "world.run_to_end_of_day": {
      if (clock.status !== "running") {
        return rejected("day_not_started", "Clock is not running");
      }
      if (clock.speed !== 0) {
        return rejected("advance_not_allowed_in_realtime", "run_to_end_of_day is only allowed in manual mode");
      }
      const targetMinute = config.endOfDayMinute;
      const delta = targetMinute - clock.minuteOfDay;
      if (delta <= 0) {
        return rejected("end_of_day_not_reached", "Already at end of day");
      }
      const scheduleResult = transitionToMinute(
        snapshot,
        targetMinute,
        nextSequence,
        now,
        command.commandId
      );
      const nextClock = {
        ...clock,
        minuteOfDay: targetMinute,
        phase: computePhase(targetMinute),
        updatedAt: now,
      };
      const events = [...scheduleResult.events];
      const baseSeq = nextSequence();
      events.push({
        eventId: `evt-run-to-eod-${baseSeq}`,
        worldId: snapshot.worldId,
        lifeSimSequence: baseSeq,
        type: "world.time_advanced",
        occurredAt: now,
        worldMinute: targetMinute,
        day: clock.day,
        causationId: command.commandId,
        runtimeEventId: null,
        runtimeSequence: null,
        payload: { oldMinute: clock.minuteOfDay, newMinute: targetMinute, day: clock.day },
      });
      const nextSnapshot: LifeSimSnapshot = {
        ...snapshot,
        worldClock: nextClock,
        activeActivities: scheduleResult.snapshot.activeActivities,
      };
      return {
        snapshot: nextSnapshot,
        events,
        result: {
          commandId: command.commandId,
          status: "accepted",
          lifeSimSequence: events[0].lifeSimSequence,
          events,
          error: null,
        },
      };
    }

    default:
      return rejected("not_implemented", `Command ${command.commandType} not implemented`);
  }
}
