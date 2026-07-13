// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { App } from "./App.js";
import { useComposedOfficeState } from "./useComposedOfficeState.js";

vi.mock("@agent-office/control-ui", async () => {
  const actual = await vi.importActual<object>("@agent-office/control-ui");
  return {
    ...actual,
    ControlPanel: vi.fn(({ mode }) => (
      <div data-testid="control-panel" data-mode={mode}>ControlPanel:{mode}</div>
    )),
  };
});

vi.mock("@agent-office/control-ui/life-sim", async () => {
  const actual = await vi.importActual<object>("@agent-office/control-ui/life-sim");
  return {
    ...actual,
    LifeSimControlPanel: vi.fn(() => <div data-testid="life-sim-panel">LifeSimControlPanel</div>),
  };
});

vi.mock("./useComposedOfficeState.js", () => ({
  useComposedOfficeState: vi.fn(),
}));

vi.mock("@agent-office/pixel-office", () => ({
  PixelOfficeScene: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    updateProjection: vi.fn(),
    setReduceMotion: vi.fn(),
    selectAgent: vi.fn(),
    selectAgents: vi.fn(),
    selectRoom: vi.fn(),
    clearSelection: vi.fn(),
    setOnSelect: vi.fn(),
  })),
}));

class ResizeObserverMock {
  constructor() {}
  observe() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const lifeSimProjection = {
  world: {
    day: 0,
    dayOfWeek: 1,
    minuteOfDay: 0,
    phase: "dawn" as const,
    status: "not_started" as const,
    speed: 0,
  },
  agents: [],
  nextTransition: null,
  previousDaySummaries: [],
  capabilities: {
    world: {
      startDay: false,
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

const baseState = {
  projection: {
    agents: [],
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [],
    pendingApprovals: [],
    blockedTasks: [],
    errors: [],
    lifeSim: lifeSimProjection,
    integration: integrationProjection,
  },
  integration: { projection: integrationProjection },
  eventLog: [],
  errors: [],
  sessionState: "connected" as const,
  diagnostics: {
    state: "connected" as const,
    lastSequence: 1,
    lastError: null,
    lastGap: null,
    resyncCount: 0,
    reconnectCount: 0,
    hasActiveSubscription: true,
    activeSubscriptionCursor: 1,
  },
  sendCommand: vi.fn(),
  lifeSim: {
    projection: lifeSimProjection,
    state: "live" as const,
    errors: [],
    execute: vi.fn(),
  },
  sendLifeSimCommand: vi.fn(),
};

const mockLifeSimSession = {
  getProjection: vi.fn().mockReturnValue(lifeSimProjection),
  getState: vi.fn().mockReturnValue("live"),
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  execute: vi.fn(),
  onStateChange: vi.fn().mockReturnValue(() => {}),
  onProjectionChange: vi.fn().mockReturnValue(() => {}),
};

const mockStore = {} as any;
const mockGateway = {} as any;

const mockAdapter = {
  getCapabilities: vi.fn().mockReturnValue({
    supportedCommands: [],
    supportedEvents: [],
    features: {},
  }),
};

function renderApp(overrides: Partial<Parameters<typeof App>[0]> = {}) {
  return render(
    <App
      session={{ resynchronize: vi.fn().mockResolvedValue(undefined) } as any}
      store={mockStore}
      gateway={mockGateway}
      runtimeId="runtime-001"
      adapter={mockAdapter as any}
      capabilities={{ supportedCommands: [], supportedEvents: [], features: { snapshot: true, sse: false, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } } as any}
      demoControls={<div data-testid="demo-controls">DemoControls</div>}
      lifeSimSession={mockLifeSimSession as any}
      {...overrides}
    />
  );
}

describe("Accessibility baseline — shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useComposedOfficeState as Mock).mockReturnValue(baseState);
  });

  it("exposes the workspace as the main landmark", () => {
    renderApp();
    const main = screen.getByRole("main");
    expect(main).toHaveClass("app-body");
    expect(main).toHaveAttribute("aria-label", "Swarm Office workspace");
  });

  it("marks the experience mode switcher as a labeled tablist", () => {
    renderApp();
    const tablist = screen.getByRole("tablist", { name: "Experience mode" });
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Command" })).toHaveAttribute("aria-selected", "true");
  });

  it("uses aria-pressed for the pixel/list view toggles", () => {
    renderApp();
    const pixelBtn = screen.getByRole("button", { name: "Pixel" });
    const listBtn = screen.getByRole("button", { name: "List" });
    expect(pixelBtn).toHaveAttribute("aria-pressed", "true");
    expect(listBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(listBtn);
    expect(pixelBtn).toHaveAttribute("aria-pressed", "false");
    expect(listBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("applies a reduce-motion class to the shell when motion is toggled off", () => {
    renderApp();
    const motionBtn = screen.getByRole("button", { name: "Motion on" });
    expect(document.querySelector(".app-shell")).not.toHaveClass("reduce-motion");

    fireEvent.click(motionBtn);
    expect(document.querySelector(".app-shell")).toHaveClass("reduce-motion");
    expect(screen.getByRole("button", { name: "Motion off" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Motion off" }));
    expect(document.querySelector(".app-shell")).not.toHaveClass("reduce-motion");
  });

  it("surfaces session state with visible text, not color alone", () => {
    renderApp();
    const strip = screen.getByTestId("status-strip");
    expect(strip).toHaveTextContent("connected");
    expect(strip).toHaveTextContent("runtime: runtime-001");
  });

  it("gives the pixel canvas a descriptive aria-label", () => {
    renderApp();
    const canvas = document.querySelector("canvas");
    expect(canvas).toHaveAttribute("aria-label", "Pixel office map showing agent rooms and tasks");
  });
});
