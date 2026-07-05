// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { App } from "./App.js";
import { useOfficeState, ControlPanel } from "@agent-office/control-ui";
import { PixelOfficeScene } from "@agent-office/pixel-office";

vi.mock("@agent-office/control-ui", async () => {
  const actual = await vi.importActual<object>("@agent-office/control-ui");
  return {
    ...actual,
    useOfficeState: vi.fn(),
    ControlPanel: vi.fn(({ mode }) => (
      <div data-testid="control-panel" data-mode={mode}>ControlPanel:{mode}</div>
    )),
  };
});

vi.mock("@agent-office/pixel-office", () => ({
  PixelOfficeScene: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    updateProjection: vi.fn(),
    setReduceMotion: vi.fn(),
  })),
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
  },
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
};

function renderApp(overrides: Partial<Parameters<typeof App>[0]> = {}) {
  return render(
    <App
      session={mockSession as any}
      store={mockStore as any}
      gateway={mockGateway as any}
      runtimeId="runtime-001"
      capabilities={{ supportedCommands: Object.values({}), supportedEvents: [], features: { snapshot: true, sse: false, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } } as any}
      demoControls={<div data-testid="demo-controls">DemoControls</div>}
      {...overrides}
    />
  );
}

describe("App shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resizeCallback = null;
    setBodyWidth(1280);
    (useOfficeState as Mock).mockReturnValue(baseState);
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

  it("mode switcher updates the ControlPanel mode", () => {
    renderApp();
    expect(screen.getByTestId("control-panel").getAttribute("data-mode")).toBe("command");
    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));
    expect(screen.getByTestId("control-panel").getAttribute("data-mode")).toBe("focus");
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
    (useOfficeState as Mock).mockReturnValue({
      ...baseState,
      sessionState: "failed",
      diagnostics: { ...baseState.diagnostics, state: "failed" },
    });

    renderApp({ retryable: true, onRetry });
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
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
});
