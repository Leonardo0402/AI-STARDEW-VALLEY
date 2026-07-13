import { describe, it, expect } from "vitest";
import { createEmptySnapshot } from "@agent-office/core";
import type { RuntimeAdapter, RuntimeSnapshot } from "@agent-office/protocol";
import {
  projectIntegration,
  emptyIntegrationProjection,
  type IntegrationProjectionProvider,
} from "./projection.js";
import type { IntegrationProjection } from "./types.js";

class FakeProvider implements RuntimeAdapter, IntegrationProjectionProvider {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async execute(): Promise<never> { throw new Error("unused"); }
  async getSnapshot(): Promise<RuntimeSnapshot> { return createEmptySnapshot("r"); }
  getCapabilities() { return { supportedCommands: [], supportsSubscribe: false }; }
  subscribe() { return { unsubscribe: () => {} }; }
  getIntegrationProjection(): IntegrationProjection {
    return {
      github: { issues: [], pulls: [], auditNotes: [] },
      reviews: { assigned: [], submitted: [] },
    };
  }
}

class FakePlainAdapter implements RuntimeAdapter {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async execute(): Promise<never> { throw new Error("unused"); }
  async getSnapshot(): Promise<RuntimeSnapshot> { return createEmptySnapshot("r"); }
  getCapabilities() { return { supportedCommands: [], supportsSubscribe: false }; }
  subscribe() { return { unsubscribe: () => {} }; }
}

describe("projectIntegration", () => {
  it("returns provider projection when adapter implements IntegrationProjectionProvider", async () => {
    const adapter = new FakeProvider();
    const snapshot = await adapter.getSnapshot();
    const result = projectIntegration(adapter, snapshot);
    expect(result.github).not.toBeNull();
    expect(result.reviews).not.toBeNull();
  });

  it("returns empty projection for plain adapter", async () => {
    const adapter = new FakePlainAdapter();
    const snapshot = await adapter.getSnapshot();
    const result = projectIntegration(adapter, snapshot);
    expect(result).toEqual(emptyIntegrationProjection());
  });
});
