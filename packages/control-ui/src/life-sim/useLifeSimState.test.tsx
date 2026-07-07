// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type {
  LifeSimCommand,
  LifeSimCommandResult,
  LifeSimCapabilities,
} from "@agent-office/life-sim";
import type { LifeSimSessionState } from "./types.js";
import type { LifeSimProjection } from "./projection.js";
import { useLifeSimState } from "./useLifeSimState.js";

const defaultCapabilities: LifeSimCapabilities = {
  world: {
    startDay: true,
    pause: false,
    resume: false,
    endDay: false,
    advanceTime: false,
    runToEndOfDay: false,
  },
  schedule: { override: false, clearOverride: false },
  clock: { mode: "manual", maxSpeed: 0 },
};

function makeProjection(overrides: Partial<LifeSimProjection> = {}): LifeSimProjection {
  return {
    world: {
      day: 1,
      dayOfWeek: 1,
      minuteOfDay: 480,
      phase: "morning",
      status: "running",
      speed: 0,
    },
    agents: [],
    nextTransition: null,
    previousDaySummaries: [],
    capabilities: defaultCapabilities,
    truncated: false,
    lostRuntimeRange: null,
    ...overrides,
  };
}

class MockSession {
  state: LifeSimSessionState = "idle";
  projection: LifeSimProjection;
  projectionListeners = new Set<(projection: LifeSimProjection) => void>();
  stateListeners = new Set<(state: LifeSimSessionState) => void>();
  execute = vi.fn(async (_command: LifeSimCommand): Promise<LifeSimCommandResult> => ({
    commandId: "cmd-1",
    status: "accepted",
    lifeSimSequence: 4,
    events: [],
    error: null,
  }));

  constructor(projection: LifeSimProjection) {
    this.projection = projection;
  }

  getProjection = () => this.projection;

  getState = () => this.state;

  onProjectionChange = (listener: (projection: LifeSimProjection) => void) => {
    this.projectionListeners.add(listener);
    return () => {
      this.projectionListeners.delete(listener);
    };
  };

  onStateChange = (listener: (state: LifeSimSessionState) => void) => {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  };

  simulateProjectionChange(projection: LifeSimProjection): void {
    this.projection = projection;
    for (const listener of this.projectionListeners) {
      listener(projection);
    }
  }

  simulateStateChange(state: LifeSimSessionState): void {
    this.state = state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }
}

const baseCommand: LifeSimCommand = {
  commandId: "cmd-1",
  commandType: "world.start_day",
  timestamp: "2026-07-06T08:00:00.000Z",
  source: "user",
  actorId: "user-1",
  worldId: "world-1",
  payload: {},
};

describe("useLifeSimState", () => {
  let session: MockSession;

  beforeEach(() => {
    session = new MockSession(makeProjection());
  });

  it("returns the initial projection, idle state, and no errors", () => {
    const { result } = renderHook(() => useLifeSimState(session as unknown as Parameters<typeof useLifeSimState>[0]));

    expect(result.current.projection.world.day).toBe(1);
    expect(result.current.state).toBe("idle");
    expect(result.current.errors).toEqual([]);
  });

  it("re-renders when the session projection changes", async () => {
    const { result } = renderHook(() => useLifeSimState(session as unknown as Parameters<typeof useLifeSimState>[0]));

    const nextProjection = makeProjection({
      world: { ...makeProjection().world, day: 2 },
    });

    act(() => {
      session.simulateProjectionChange(nextProjection);
    });

    await waitFor(() => {
      expect(result.current.projection.world.day).toBe(2);
    });
  });

  it("appends command rejection messages to errors and rethrows", async () => {
    session.execute.mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useLifeSimState(session as unknown as Parameters<typeof useLifeSimState>[0]));

    await act(async () => {
      await expect(result.current.execute(baseCommand)).rejects.toThrow("network down");
    });

    expect(result.current.errors).toEqual(["network down"]);
  });

  it("appends errors from rejected command results", async () => {
    session.execute.mockResolvedValueOnce({
      commandId: "cmd-1",
      status: "rejected",
      lifeSimSequence: null,
      events: [],
      error: { code: "invalid_command", message: "bad command" },
    });

    const { result } = renderHook(() => useLifeSimState(session as unknown as Parameters<typeof useLifeSimState>[0]));

    await act(async () => {
      await result.current.execute(baseCommand);
    });

    expect(result.current.errors).toEqual(["[world.start_day] bad command"]);
  });

  it("keeps only the last 10 error messages", async () => {
    for (let i = 0; i < 12; i++) {
      session.execute.mockRejectedValueOnce(new Error(`error-${i}`));
    }

    const { result } = renderHook(() => useLifeSimState(session as unknown as Parameters<typeof useLifeSimState>[0]));

    await act(async () => {
      for (let i = 0; i < 12; i++) {
        await expect(result.current.execute(baseCommand)).rejects.toThrow();
      }
    });

    expect(result.current.errors).toHaveLength(10);
    expect(result.current.errors[0]).toBe("error-2");
    expect(result.current.errors[9]).toBe("error-11");
  });
});
