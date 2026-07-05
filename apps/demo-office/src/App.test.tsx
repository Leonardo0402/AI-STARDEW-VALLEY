// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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
  })),
}));

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
    fireEvent.click(screen.getByRole("button", { name: "列表视图" }));
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard 视图（传统列表）")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "像素空间" }));
    expect(document.querySelector("canvas")).toBeInTheDocument();
  });

  it("focus mode hides the full stage and shows focus indicator", () => {
    renderApp();
    fireEvent.click(screen.getByRole("tab", { name: "Focus" }));
    expect(screen.getByText("Focus Mode")).toBeInTheDocument();
    expect(document.querySelector("canvas")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard 视图（传统列表）")).not.toBeInTheDocument();
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
});
