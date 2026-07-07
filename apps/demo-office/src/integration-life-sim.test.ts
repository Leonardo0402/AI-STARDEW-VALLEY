import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockRuntimeAdapter } from "@agent-office/adapter-mock";
import { RuntimeSession, SnapshotStore, CommandGateway } from "@agent-office/core";
import { CommandType } from "@agent-office/protocol";
import type { OfficeCommand, ApprovalSnapshot } from "@agent-office/protocol";
import { createLifeSimServer, sampleDay1Schedules } from "@agent-office/life-sim";
import type { LifeSimCommand, LifeSimEngineConfig, DaySummary } from "@agent-office/life-sim";
import { HttpLifeSimClient } from "@agent-office/control-ui/life-sim";

const RUNTIME_ID = "mock-runtime-001";

const config: LifeSimEngineConfig = {
  worldId: "demo-office-integration",
  startOfDayMinute: 480,
  endOfDayMinute: 1110,
  baseSchedules: sampleDay1Schedules(),
};

function makeLifeSimCommand(type: string, payload: unknown): LifeSimCommand {
  return {
    commandId: `cmd-${type}-${JSON.stringify(payload)}`,
    commandType: type,
    timestamp: "2026-07-05T08:00:00Z",
    source: "user",
    actorId: "operator",
    worldId: config.worldId,
    payload,
  };
}

function makeOfficeCommand(commandType: string, payload: unknown, targetId: string | null = null): OfficeCommand {
  return {
    commandId: `cmd-office-${commandType}-${JSON.stringify(payload)}`,
    commandType,
    timestamp: "2026-07-05T08:00:00Z",
    source: "user",
    actorId: "operator",
    runtimeId: RUNTIME_ID,
    targetId,
    payload,
  };
}

async function waitForRequestedApproval(store: SnapshotStore, maxAttempts = 100, intervalMs = 50): Promise<ApprovalSnapshot> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const approval = store.getSnapshot().approvals.find((a) => a.status === "requested");
    if (approval) {
      return approval;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for requested approval");
}

class NoOpEventSource {
  readonly url: string;
  readonly readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  constructor(url: string) {
    this.url = url;
  }
  close(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}

describe("LifeSim end-to-end integration", () => {
  let server: Awaited<ReturnType<typeof createLifeSimServer>>;
  let client: HttpLifeSimClient;
  let adapter: MockRuntimeAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;

  beforeEach(async () => {
    adapter = new MockRuntimeAdapter({ eventDelayMs: 0 });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway);

    server = await createLifeSimServer(config, { port: 0, runtimeSession: session });
    await server.start();
    await session.connect();

    client = new HttpLifeSimClient({
      baseUrl: server.getBaseUrl(),
      worldId: config.worldId,
      EventSource: NoOpEventSource,
    });
  });

  afterEach(async () => {
    await server.stop();
    await session.disconnect();
  });

  it("runs Start Day → Advance 30 min → Run to EOD → End Day and verifies DaySummary", async () => {
    // Start the day
    const startResult = await client.execute(makeLifeSimCommand("world.start_day", { day: 1 }));
    expect(startResult.status).toBe("accepted");
    let snapshot = await client.getSnapshot();
    expect(snapshot.snapshot.worldClock.status).toBe("running");
    expect(snapshot.snapshot.worldClock.minuteOfDay).toBe(config.startOfDayMinute);

    // Advance 30 minutes
    const advanceResult = await client.execute(makeLifeSimCommand("world.advance_time", { minutes: 30 }));
    expect(advanceResult.status).toBe("accepted");
    snapshot = await client.getSnapshot();
    expect(snapshot.snapshot.worldClock.minuteOfDay).toBe(config.startOfDayMinute + 30);

    // Inject mock runtime events through the connected mock runtime
    adapter.playNormalFlow();

    const pendingApproval = await waitForRequestedApproval(store);

    const approveResult = await gateway.execute(
      makeOfficeCommand(CommandType.APPROVAL_ACCEPT, { approvalId: pendingApproval.approvalId }, pendingApproval.approvalId)
    );
    expect(approveResult.status).toBe("accepted");

    // Run to end of day
    const runResult = await client.execute(makeLifeSimCommand("world.run_to_end_of_day", {}));
    expect(runResult.status).toBe("accepted");
    snapshot = await client.getSnapshot();
    expect(snapshot.snapshot.worldClock.minuteOfDay).toBe(config.endOfDayMinute);

    // End day
    const endResult = await client.execute(makeLifeSimCommand("world.end_day", {}));
    expect(endResult.status).toBe("accepted");
    snapshot = await client.getSnapshot();
    expect(snapshot.snapshot.worldClock.status).toBe("not_started");

    // Verify DaySummary
    const summary: DaySummary | undefined = snapshot.snapshot.completedDaySummaries[0];
    expect(summary).toBeDefined();
    expect(summary!.day).toBe(1);
    expect(summary!.startedAtWorldMinute).toBe(config.startOfDayMinute);
    expect(summary!.endedAtWorldMinute).toBe(config.endOfDayMinute);
    expect(summary!.truncated).toBe(false);
    expect(summary!.taskCounts.completed).toBeGreaterThanOrEqual(0);
  });
});
