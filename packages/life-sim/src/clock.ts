import type { WorldClockState } from "./types.js";

export function computePhase(minute: number): WorldClockState["phase"] {
  if (minute < 360) return "dawn";
  if (minute < 720) return "morning";
  if (minute < 1080) return "afternoon";
  if (minute < 1260) return "evening";
  return "night";
}

export function advanceClock(
  clock: WorldClockState,
  minutes: number,
  endOfDayMinute: number
): { clock: WorldClockState; phaseChanged: boolean } {
  const nextMinute = Math.min(clock.minuteOfDay + minutes, endOfDayMinute);
  const nextPhase = computePhase(nextMinute);
  const phaseChanged = nextPhase !== clock.phase;
  return {
    clock: {
      ...clock,
      minuteOfDay: nextMinute,
      phase: nextPhase,
      updatedAt: new Date().toISOString(),
    },
    phaseChanged,
  };
}
