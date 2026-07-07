import { describe, it, expect } from "vitest";
import { artifactStatusIntent } from "./intents.js";
import type { BadgeIntent } from "./Badge.js";

describe("artifactStatusIntent", () => {
  it("maps known artifact statuses to distinct intents", () => {
    const cases: Array<{ status: Parameters<typeof artifactStatusIntent>[0]; intent: BadgeIntent }> = [
      { status: "draft", intent: "idle" },
      { status: "generated", intent: "info" },
      { status: "under_review", intent: "waiting" },
      { status: "revision_required", intent: "revision_required" },
      { status: "approved", intent: "approved" },
      { status: "rejected", intent: "rejected" },
      { status: "delivered", intent: "running" },
    ];

    for (const { status, intent } of cases) {
      expect(artifactStatusIntent(status)).toBe(intent);
    }
  });

  it("falls back to info for unknown statuses", () => {
    expect(artifactStatusIntent("unknown_status" as Parameters<typeof artifactStatusIntent>[0])).toBe("info");
  });
});
