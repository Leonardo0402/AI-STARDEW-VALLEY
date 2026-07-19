// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook } from "@testing-library/react";
import { useComposedOfficeState, type ComposedOfficeState } from "./useComposedOfficeState.js";

vi.mock("@agent-office/control-ui", () => ({
  useOfficeState: vi.fn(),
}));

vi.mock("@agent-office/control-ui/integration", () => ({
  useIntegrationState: vi.fn(),
}));

vi.mock("@agent-office/control-ui/life-sim", async () => {
  const actual = await vi.importActual<object>("@agent-office/control-ui/life-sim");
  return {
    ...actual,
    useLifeSimState: vi.fn(),
    composeProjections: vi.fn((office, lifeSim, integration) => ({
      ...office,
      lifeSim,
      integration,
    })),
  };
});

import { useOfficeState } from "@agent-office/control-ui";
import { useIntegrationState } from "@agent-office/control-ui/integration";
import { useLifeSimState } from "@agent-office/control-ui/life-sim";

const officeProjection = {
  agents: [],
  tasks: [],
  artifacts: [],
  approvals: [],
  rooms: [],
  pendingApprovals: [],
  blockedTasks: [],
  errors: [],
};

const lifeSimProjection = {
  world: {
    day: 1,
    dayOfWeek: 1,
    minuteOfDay: 600,
    phase: "morning" as const,
    status: "running" as const,
    speed: 0,
  },
  agents: [],
  nextTransition: null,
  previousDaySummaries: [],
  capabilities: {
    world: {
      startDay: true,
      pause: false,
      resume: false,
      endDay: false,
      advanceTime: false,
      runToEndOfDay: false,
    },
    schedule: { override: false, clearOverride: false },
    clock: { mode: "manual" as const, maxSpeed: 0 },
  },
  truncated: false,
  lostRuntimeRange: null,
};

const integrationProjection = { github: null, reviews: null };

const mockSession = { getState: vi.fn(), getDiagnostics: vi.fn(), onStateChange: vi.fn(), onAcceptedEvent: vi.fn() } as any;
const mockStore = { getSnapshot: vi.fn(), subscribe: vi.fn(() => vi.fn()) } as any;
const mockGateway = {} as any;
const mockLifeSimSession = {
  getProjection: vi.fn().mockReturnValue(lifeSimProjection),
  getState: vi.fn().mockReturnValue("live"),
  onProjectionChange: vi.fn().mockReturnValue(() => {}),
  onStateChange: vi.fn().mockReturnValue(() => {}),
  execute: vi.fn(),
} as any;
const mockAdapter = { getCapabilities: vi.fn() } as any;

describe("useComposedOfficeState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useOfficeState as Mock).mockReturnValue({
      projection: officeProjection,
      eventLog: [],
      errors: [],
      sessionState: "connected",
      diagnostics: { state: "connected" },
      sendCommand: vi.fn(),
    });
    (useLifeSimState as Mock).mockReturnValue({
      projection: lifeSimProjection,
      state: "live",
      errors: [],
      execute: vi.fn(),
    });
    (useIntegrationState as Mock).mockReturnValue({
      projection: integrationProjection,
    });
  });

  it("consumes useIntegrationState with the provided adapter and store", () => {
    renderHook(() =>
      useComposedOfficeState(
        mockSession,
        mockStore,
        mockGateway,
        "runtime-001",
        mockLifeSimSession,
        mockAdapter,
        "default"
      )
    );

    expect(useIntegrationState).toHaveBeenCalledWith(mockAdapter, mockStore);
  });

  it("composes the integration projection into the office projection", () => {
    const { result } = renderHook<ComposedOfficeState, unknown>(() =>
      useComposedOfficeState(
        mockSession,
        mockStore,
        mockGateway,
        "runtime-001",
        mockLifeSimSession,
        mockAdapter,
        "default"
      )
    );

    expect(result.current.projection.lifeSim).toBe(lifeSimProjection);
    expect(result.current.projection.integration).toBe(integrationProjection);
    expect(result.current.integration.projection).toBe(integrationProjection);
  });
});
