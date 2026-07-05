import type { WorldClockState } from "./types.js";

export function computePhase(minute: number): WorldClockState["phase"] {
  if (minute < 360) return "dawn";
  if (minute < 720) return "morning";
  if (minute < 1080) return "afternoon";
  if (minute < 1260) return "evening";
  return "night";
}

