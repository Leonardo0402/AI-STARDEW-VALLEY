// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SnapshotStore } from "@agent-office/core";
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  AdapterCapabilities,
  RuntimeSubscription,
  OfficeCommand,
  CommandResult,
} from "@agent-office/protocol";
import { createEmptySnapshot } from "@agent-office/core";
import { useIntegrationState } from "./useIntegrationState.js";

class StubAdapter implements RuntimeAdapter {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async execute(): Promise<CommandResult> { throw new Error("unused"); }
  async getSnapshot(): Promise<RuntimeSnapshot> { return createEmptySnapshot("r"); }
  getCapabilities(): AdapterCapabilities {
    return {
      supportedEvents: [],
      supportedCommands: [],
      features: {
        snapshot: false,
        sse: false,
        websocket: false,
        commandExecution: false,
        softMapping: false,
        hardOrchestration: false,
      },
    };
  }
  subscribe(): RuntimeSubscription {
    return { ready: Promise.resolve(), close: () => {} };
  }
}

describe("useIntegrationState", () => {
  it("returns empty projection initially", async () => {
    const adapter = new StubAdapter();
    const store = new SnapshotStore("r");
    store.setSnapshot(await adapter.getSnapshot());
    const { result } = renderHook(() => useIntegrationState(adapter, store));
    expect(result.current.projection.github).toBeNull();
    expect(result.current.projection.reviews).toBeNull();
  });

  it("updates when store snapshot changes", async () => {
    const adapter = new StubAdapter();
    const store = new SnapshotStore("r");
    store.setSnapshot(await adapter.getSnapshot());
    const { result } = renderHook(() => useIntegrationState(adapter, store));
    const next = await adapter.getSnapshot();
    next.sequence = 1;
    store.setSnapshot(next);
    await waitFor(() => expect(result.current.projection).toBeDefined());
  });
});
