// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { App } from "./App.js";
import { DemoControls } from "./DemoControls.js";
import { ControlPanel } from "@agent-office/control-ui";
import { LifeSimControlPanel } from "@agent-office/control-ui/life-sim";
import { PixelOfficeScene } from "@agent-office/pixel-office";
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
  PixelOfficeScene: vi.fn().mockImplementation(() => {
    let onSelectCallback: ((selection: { kind: string; id: string }) => void) | null = null;
    return {
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      updateProjection: vi.fn(),
      updateIntegration: vi.fn(),
      setReduceMotion: vi.fn(),
      selectAgent: vi.fn(),
      selectAgents: vi.fn(),
      selectRoom: vi.fn(),
      clearSelection: vi.fn(),
      setOnSelect: vi.fn((cb: typeof onSelectCallback) => {
        onSelectCallback = cb;
      }),
      simulateAgentSelect: (id: string) => {
        onSelectCallback?.({ kind: "agent", id });
      },
    };
  }),
}));

let resizeCallback: ((entries: { contentRect: { width: number } }[]) => void) | null = null;

class ResizeObserverMock {
  constructor(callback: (entries: { contentRect: { width: number } }[]) => void) {
    resizeCallback = callback;
  }
  observe() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const defaultPixelOfficeSceneImpl = (PixelOfficeScene as Mock).getMockImplementation();

function setBodyWidth(width: number) {
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      width,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: width,
      x: 0,
      y: 0,
      toJSON() {
        return this;
      },
    }),
  });
}

function triggerResize(width: number) {
  resizeCallback?.([{ contentRect: { width } }]);
}

const mockSession = {
  resynchronize: vi.fn().mockResolvedValue(undefined),
};

const mockStore = {};
const mockGateway = {};

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
  sessionState: "connected",
  diagnostics: {
    state: "connected",
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
  clearErrors: vi.fn(),
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
      session={mockSession as any}
      store={mockStore as any}
      gateway={mockGateway as any}
      runtimeId="runtime-001"
      adapter={mockAdapter as any}
      capabilities={{ supportedCommands: Object.values({}), supportedEvents: [], features: { snapshot: true, sse: false, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } } as any}
      demoControls={<div data-testid="demo-controls">DemoControls</div>}
      lifeSimSession={mockLifeSimSession as any}
      {...overrides}
    />
  );
}

describe("App shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resizeCallback = null;
    setBodyWidth(1280);
    (useComposedOfficeState as Mock).mockReturnValue(baseState);
  });

  afterEach(() => {
    if (defaultPixelOfficeSceneImpl) {
      (PixelOfficeScene as Mock).mockImplementation(defaultPixelOfficeSceneImpl);
    }
  });

  it("renders status strip, header, and body regions", () => {
    renderApp();
    expect(screen.getByTestId("status-strip")).toBeInTheDocument();
    expect(screen.getByText("Swarm Office")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Command" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Focus" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Debrief" })).toBeInTheDocument();
    expect(document.querySelector(".app-body")).toBeInTheDocument();
    expect(screen.getByTestId("control-panel")).toBeInTheDocument();
  });

  it("mode switcher updates the ControlPanel mode and hides it in focus mode", () => {
    renderApp();
    expect(screen.getByTestId("control-panel").getAttribute("data-mode")).toBe("command");
    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));
    expect(screen.queryByTestId("control-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("focus-urgent-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Debrief" }));
    expect(screen.getByTestId("control-panel").getAttribute("data-mode")).toBe("debrief");
  });

  it("view toggle switches between pixel canvas and list view", () => {
    renderApp();
    expect(document.querySelector("canvas")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard 视图（传统列表）")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard 视图（传统列表）")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pixel" }));
    expect(document.querySelector("canvas")).toBeInTheDocument();
  });

  it("toggling reduceMotion does not re-create the PixelOfficeScene", () => {
    renderApp();
    const scene = (PixelOfficeScene as Mock).mock.results[0].value;
    expect(PixelOfficeScene).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Motion on" }));
    expect(PixelOfficeScene).toHaveBeenCalledTimes(1);
    expect(scene.destroy).not.toHaveBeenCalled();
    expect(scene.setReduceMotion).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Motion off" }));
    expect(PixelOfficeScene).toHaveBeenCalledTimes(1);
    expect(scene.destroy).not.toHaveBeenCalled();
    expect(scene.setReduceMotion).toHaveBeenLastCalledWith(false);
  });

  it("focus mode keeps the canvas visible, dims the stage, and shows the ambient overlay", () => {
    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));
    expect(screen.getByText("Focus Mode")).toBeInTheDocument();
    expect(document.querySelector("canvas")).toBeInTheDocument();
    expect(document.querySelector(".app-stage")?.classList.contains("app-stage--dimmed")).toBe(true);
  });

  it("focus mode still allows switching to list view", () => {
    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard 视图（传统列表）")).toBeInTheDocument();
    expect(screen.getByText("Focus Mode")).toBeInTheDocument();
  });

  it("focus mode collapses the right panel to urgent-only counts", () => {
    (useComposedOfficeState as Mock).mockReturnValue({
      ...baseState,
      projection: {
        ...baseState.projection,
        pendingApprovals: [{ approvalId: "a1" }, { approvalId: "a2" }] as any,
        blockedTasks: [{ taskId: "t1" }] as any,
        agents: [{ status: "failed" }] as any,
        tasks: [{ status: "failed" }, { status: "working" }] as any,
      },
    });

    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));

    expect(screen.queryByTestId("demo-controls")).not.toBeInTheDocument();
    expect(screen.queryByTestId("life-sim-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("control-panel")).not.toBeInTheDocument();

    const counts = screen.getAllByTestId("focus-urgent-count");
    expect(counts.map((el) => el.textContent)).toEqual(["2", "1", "2"]);

    const urgentPanel = screen.getByTestId("focus-urgent-panel");
    expect(urgentPanel).toHaveTextContent("Pending approvals");
    expect(urgentPanel).toHaveTextContent("Blocked tasks");
    expect(urgentPanel).toHaveTextContent("Failed");

    expect(screen.queryByTestId("focus-indicator-count")).not.toBeInTheDocument();
  });

  it("debrief mode replaces the canvas with the DebriefTimeline", () => {
    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Debrief" }));
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByTestId("debrief-timeline")).toBeInTheDocument();
  });

  it("list view remains available in debrief mode", () => {
    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Debrief" }));
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByText("Dashboard 视图（传统列表）")).toBeInTheDocument();
    expect(screen.queryByTestId("debrief-timeline")).not.toBeInTheDocument();
  });

  it("passes retryable and onRetry through to the status strip", () => {
    const onRetry = vi.fn();
    (useComposedOfficeState as Mock).mockReturnValue({
      ...baseState,
      sessionState: "failed",
      diagnostics: { ...baseState.diagnostics, state: "failed" },
    });

    renderApp({ retryable: true, onRetry });
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
  });

  it("surfaces the real projection error code in the status strip", () => {
    (useComposedOfficeState as Mock).mockReturnValue({
      ...baseState,
      projection: {
        ...baseState.projection,
        agents: [{ status: "failed" }] as any,
        errors: [
          {
            taskId: "t-1",
            agentId: null,
            message: "agent not found",
            severity: "error",
            code: "entity_not_found",
          },
        ],
      },
    });

    renderApp();
    expect(screen.getByText("entity_not_found")).toBeInTheDocument();
    expect(screen.getByText("agent not found")).toBeInTheDocument();
    expect(screen.queryByText("PROJECTION_FAILURE")).not.toBeInTheDocument();
  });

  it("auto-switches to list view when the body becomes narrow and restores when wide", async () => {
    renderApp();
    expect(document.querySelector("canvas")).toBeInTheDocument();

    await act(async () => {
      triggerResize(900);
    });
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard 视图（传统列表）")).toBeInTheDocument();

    await act(async () => {
      triggerResize(1280);
    });
    expect(document.querySelector("canvas")).toBeInTheDocument();
  });

  it("remembers a manually chosen view and restores it when returning to wide", async () => {
    renderApp();
    await act(async () => {
      triggerResize(900);
    });
    expect(document.querySelector("canvas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    await act(async () => {
      triggerResize(1280);
    });
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard 视图（传统列表）")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pixel" }));
    await act(async () => {
      triggerResize(900);
    });
    await act(async () => {
      triggerResize(1280);
    });
    expect(document.querySelector("canvas")).toBeInTheDocument();
  });

  it("renders the canvas with an aria-label", () => {
    renderApp();
    const canvas = document.querySelector("canvas");
    expect(canvas).toHaveAttribute("aria-label", "Pixel office map showing agent rooms and tasks");
  });

  it("marks the app body as the main landmark", () => {
    renderApp();
    const body = document.querySelector(".app-body");
    expect(body).toHaveAttribute("role", "main");
    expect(body).toHaveAttribute("aria-label", "Swarm Office workspace");
  });

  it("supports arrow-key navigation between mode tabs", () => {
    renderApp();
    const tabs = ["Command", "Focus", "Debrief"].map((name) =>
      screen.getByRole("tab", { name })
    );

    tabs[0].focus();
    fireEvent.keyDown(screen.getByRole("tablist", { name: "Experience mode" }), {
      key: "ArrowRight",
    });
    expect(tabs[1]).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("tablist", { name: "Experience mode" }), {
      key: "ArrowRight",
    });
    expect(tabs[2]).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("tablist", { name: "Experience mode" }), {
      key: "ArrowLeft",
    });
    expect(tabs[1]).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("tablist", { name: "Experience mode" }), {
      key: "End",
    });
    expect(tabs[2]).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("tablist", { name: "Experience mode" }), {
      key: "Home",
    });
    expect(tabs[0]).toHaveFocus();
  });

  it("marks the active mode tab with the segmented-control active class", () => {
    renderApp();
    const commandTab = screen.getByRole("tab", { name: "Command" });
    const focusTab = screen.getByRole("tab", { name: "Focus" });
    const debriefTab = screen.getByRole("tab", { name: "Debrief" });

    expect(commandTab.classList.contains("mode-switcher__btn--active")).toBe(true);
    expect(focusTab.classList.contains("mode-switcher__btn--active")).toBe(false);
    expect(debriefTab.classList.contains("mode-switcher__btn--active")).toBe(false);

    fireEvent.click(focusTab);
    expect(commandTab.classList.contains("mode-switcher__btn--active")).toBe(false);
    expect(focusTab.classList.contains("mode-switcher__btn--active")).toBe(true);
    expect(debriefTab.classList.contains("mode-switcher__btn--active")).toBe(false);
  });

  it("pushes the initial projection and selection only after PixelOfficeScene init resolves", async () => {
    let initResolve: (() => void) | undefined;
    const scene = {
      init: vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
        initResolve = resolve;
      })),
      destroy: vi.fn(),
      updateProjection: vi.fn(),
      updateIntegration: vi.fn(),
      setReduceMotion: vi.fn(),
      selectAgent: vi.fn(),
      selectAgents: vi.fn(),
      selectRoom: vi.fn(),
      clearSelection: vi.fn(),
      setOnSelect: vi.fn(),
    };
    (PixelOfficeScene as Mock).mockReturnValue(scene);

    renderApp();

    // Wait for the effect to start init.
    await act(async () => {
      await Promise.resolve();
    });

    expect(scene.init).toHaveBeenCalled();
    expect(scene.updateProjection).not.toHaveBeenCalled();
    expect(scene.clearSelection).not.toHaveBeenCalled();

    await act(async () => {
      initResolve?.();
      await Promise.resolve();
    });

    expect(scene.updateProjection).toHaveBeenCalledWith(baseState.projection);
    expect(scene.clearSelection).toHaveBeenCalled();
  });

  it("creates a replacement scene when React StrictMode remounts the canvas", async () => {
    render(
      <React.StrictMode>
        <App
          session={mockSession as any}
          store={mockStore as any}
          gateway={mockGateway as any}
          runtimeId="runtime-001"
          adapter={mockAdapter as any}
          capabilities={{ supportedCommands: Object.values({}), supportedEvents: [], features: { snapshot: true, sse: false, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } } as any}
          demoControls={<div data-testid="demo-controls">DemoControls</div>}
          lifeSimSession={mockLifeSimSession as any}
        />
      </React.StrictMode>
    );

    // StrictMode mounts, unmounts, and remounts. If cleanup leaves sceneRef
    // pointing at the destroyed scene, the remount early-returns and only one
    // PixelOfficeScene is constructed, leaving the canvas blank.
    await waitFor(() => expect(PixelOfficeScene).toHaveBeenCalledTimes(2));

    const results = (PixelOfficeScene as Mock).mock.results;
    const scene = results[results.length - 1].value as Record<string, ReturnType<typeof vi.fn>>;
    await waitFor(() => expect(scene.updateProjection).toHaveBeenCalledWith(baseState.projection));
  });
});

describe("DemoControls panel card", () => {
  const mockAdapter = {
    playNormalFlow: vi.fn(),
    playErrorFlow: vi.fn(),
    playRevisionFlow: vi.fn(),
    reset: vi.fn(),
  };

  const mockStore = { reset: vi.fn(), rebuildFromLog: vi.fn() };
  const mockSession = { resynchronize: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders as a design-system panel card", () => {
    render(
      <DemoControls
        adapter={mockAdapter as any}
        store={mockStore as any}
        session={mockSession as any}
      />
    );

    const card = document.querySelector(".demo-controls");
    expect(card).toBeInTheDocument();
    expect(card?.classList.contains("panel-card")).toBe(true);
    expect(screen.getByText("运行演示（Mock 专用）")).toBeInTheDocument();
  });

  it("uses token-driven button styles instead of inline styles", () => {
    render(
      <DemoControls
        adapter={mockAdapter as any}
        store={mockStore as any}
        session={mockSession as any}
      />
    );

    const button = screen.getByRole("button", { name: "正常流程" });
    expect(button.classList.contains("demo-controls__btn")).toBe(true);
    expect(button).not.toHaveAttribute("style");
  });

  it("still invokes adapter and store actions on button clicks", () => {
    render(
      <DemoControls
        adapter={mockAdapter as any}
        store={mockStore as any}
        session={mockSession as any}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "正常流程" }));
    expect(mockAdapter.playNormalFlow).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "重置" }));
    expect(mockAdapter.reset).toHaveBeenCalled();
    expect(mockStore.reset).toHaveBeenCalled();
    expect(mockSession.resynchronize).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "回放事件" }));
    expect(mockStore.rebuildFromLog).toHaveBeenCalled();
  });
});

describe("App selection", () => {
  const projectionWithEntities = {
    ...baseState.projection,
    agents: [
      {
        agentId: "agent-1",
        name: "Agent One",
        role: "orchestrator",
        status: "idle",
        currentTaskId: null,
        currentRoomId: "room-1",
        blockedReason: null,
      },
      {
        agentId: "agent-2",
        name: "Agent Two",
        role: "worker",
        status: "working",
        currentTaskId: "task-1",
        currentRoomId: "room-2",
        blockedReason: null,
      },
    ],
    tasks: [
      {
        taskId: "task-1",
        title: "Task One",
        description: "",
        status: "running",
        priority: "high",
        assigneeId: "agent-2",
        roomId: "room-2",
        artifactIds: ["art-1"],
        approvalId: null,
        blockedReason: null,
      },
    ],
    artifacts: [
      {
        artifactId: "art-1",
        taskId: "task-1",
        producerAgentId: "agent-2",
        type: "document",
        title: "Artifact One",
        status: "generated",
        version: 1,
        reviewResult: null,
      },
    ],
    approvals: [
      {
        approvalId: "approval-1",
        taskId: "task-1",
        kind: "artifact_delivery",
        status: "requested",
        requestedBy: "agent-2",
        reason: "Approve delivery",
      },
    ],
    rooms: [
      {
        roomId: "room-1",
        name: "Command",
        type: "command",
        bounds: { x: 0, y: 0, width: 200, height: 150 },
        activeAgentIds: ["agent-1"],
      },
      {
        roomId: "room-2",
        name: "Execution",
        type: "execution",
        bounds: { x: 220, y: 0, width: 200, height: 150 },
        activeAgentIds: ["agent-2"],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setBodyWidth(1280);
    (useComposedOfficeState as Mock).mockReturnValue({
      ...baseState,
      projection: projectionWithEntities,
    });
  });

  function getControlPanelProps(): Record<string, unknown> {
    const calls = (ControlPanel as Mock).mock.calls;
    return calls[calls.length - 1][0] as Record<string, unknown>;
  }

  function getSceneInstance(): Record<string, ReturnType<typeof vi.fn>> {
    return (PixelOfficeScene as Mock).mock.results[(PixelOfficeScene as Mock).mock.results.length - 1]
      .value as Record<string, ReturnType<typeof vi.fn>>;
  }

  it("passes selection and onSelect to ControlPanel and applies agent selection to the scene", () => {
    renderApp();
    const props = getControlPanelProps();
    expect(typeof props.onSelect).toBe("function");

    const scene = getSceneInstance();
    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
    });

    expect(scene.selectAgent).toHaveBeenCalledWith("agent-1");

    const nextProps = getControlPanelProps();
    expect(nextProps.selection).toEqual({ kind: "agent", id: "agent-1" });
  });

  it("selection survives mode switches", () => {
    renderApp();
    const props = getControlPanelProps();
    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
    });

    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));
    fireEvent.click(screen.getByRole("tab", { name: "Command" }));

    expect(getControlPanelProps().selection).toEqual({ kind: "agent", id: "agent-1" });
  });

  it("selection survives pixel/list view switches", async () => {
    renderApp();
    const props = getControlPanelProps();
    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
    });

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: "Pixel" }));

    // The new scene's init promise resolves asynchronously before selection is applied.
    await act(async () => {
      await Promise.resolve();
    });

    const scene = getSceneInstance();
    expect(scene.selectAgent).toHaveBeenCalledWith("agent-1");
    expect(getControlPanelProps().selection).toEqual({ kind: "agent", id: "agent-1" });
  });

  it("clears selection when the selected entity disappears from the projection", () => {
    renderApp();
    const props = getControlPanelProps();
    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
    });

    expect(getSceneInstance().selectAgent).toHaveBeenCalledWith("agent-1");

    (useComposedOfficeState as Mock).mockReturnValue({
      ...baseState,
      projection: { ...projectionWithEntities, agents: projectionWithEntities.agents.slice(1) },
    });

    // Trigger a re-render while still in pixel view so the scene stays alive.
    fireEvent.click(screen.getByRole("button", { name: "Motion on" }));

    expect(getSceneInstance().clearSelection).toHaveBeenCalled();
    expect(getControlPanelProps().selection).toBeNull();
  });

  it("clears selection when Escape is pressed", () => {
    renderApp();
    const props = getControlPanelProps();
    const scene = getSceneInstance();
    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
    });

    scene.selectAgent.mockClear();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(scene.clearSelection).toHaveBeenCalled();
    expect(getControlPanelProps().selection).toBeNull();
  });

  it("updates selection when an agent is selected on the canvas", () => {
    renderApp();
    const scene = getSceneInstance();
    act(() => {
      scene.simulateAgentSelect("agent-2");
    });

    expect(getControlPanelProps().selection).toEqual({ kind: "agent", id: "agent-2" });
    expect(scene.selectAgent).toHaveBeenCalledWith("agent-2");
  });

  it("highlights the assignee agent when a task is selected", () => {
    renderApp();
    const props = getControlPanelProps();
    const scene = getSceneInstance();

    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "task", id: "task-1" });
    });

    expect(scene.selectAgent).toHaveBeenCalledWith("agent-2");
  });

  it("highlights the producer agent when an artifact is selected", () => {
    renderApp();
    const props = getControlPanelProps();
    const scene = getSceneInstance();

    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "artifact", id: "art-1" });
    });

    expect(scene.selectAgent).toHaveBeenCalledWith("agent-2");
  });

  it("highlights the requesting agent when an approval is selected", () => {
    renderApp();
    const props = getControlPanelProps();
    const scene = getSceneInstance();

    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "approval", id: "approval-1" });
    });

    expect(scene.selectAgent).toHaveBeenCalledWith("agent-2");
  });

  it("highlights the room and its active agents when a room is selected", () => {
    renderApp();
    const props = getControlPanelProps();
    const scene = getSceneInstance();

    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "room", id: "room-1" });
    });

    expect(scene.selectRoom).toHaveBeenCalledWith("room-1");
    expect(scene.selectAgents).toHaveBeenCalledWith(["agent-1"]);
  });

  it("falls back to room highlight when a task has no assignee", () => {
    (useComposedOfficeState as Mock).mockReturnValue({
      ...baseState,
      projection: {
        ...projectionWithEntities,
        tasks: [
          {
            ...projectionWithEntities.tasks[0],
            assigneeId: null,
          },
        ],
      },
    });

    renderApp();
    const props = getControlPanelProps();
    const scene = getSceneInstance();

    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "task", id: "task-1" });
    });

    expect(scene.selectRoom).toHaveBeenCalledWith("room-2");
  });

  it("clears canvas highlight when the selected entity has no related agent or room", () => {
    (useComposedOfficeState as Mock).mockReturnValue({
      ...baseState,
      projection: {
        ...projectionWithEntities,
        tasks: [
          {
            ...projectionWithEntities.tasks[0],
            assigneeId: null,
            roomId: null,
          },
        ],
      },
    });

    renderApp();
    const props = getControlPanelProps();
    const scene = getSceneInstance();

    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "task", id: "task-1" });
    });

    expect(scene.clearSelection).toHaveBeenCalled();
  });

  it("clears selection when Reset is triggered", () => {
    const adapter = {
      playNormalFlow: vi.fn(),
      playErrorFlow: vi.fn(),
      playRevisionFlow: vi.fn(),
      reset: vi.fn(),
    };
    const store = { reset: vi.fn() };
    const resetSession = { resynchronize: vi.fn().mockResolvedValue(undefined) };

    renderApp({
      demoControls: (
        <DemoControls
          adapter={adapter as any}
          store={store as any}
          session={resetSession as any}
        />
      ),
    });

    const props = getControlPanelProps();
    const scene = getSceneInstance();

    act(() => {
      (props.onSelect as (s: { kind: string; id: string }) => void)({ kind: "agent", id: "agent-1" });
    });

    expect(getControlPanelProps().selection).toEqual({ kind: "agent", id: "agent-1" });

    fireEvent.click(screen.getByRole("button", { name: "重置" }));

    expect(adapter.reset).toHaveBeenCalled();
    expect(store.reset).toHaveBeenCalled();
    expect(resetSession.resynchronize).toHaveBeenCalled();
    expect(scene.clearSelection).toHaveBeenCalled();
    expect(getControlPanelProps().selection).toBeNull();
  });
});
