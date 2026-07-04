import { describe, it, expect, afterEach } from "vitest";
import { QclawTestRuntime } from "./qclaw-runtime.js";

describe("QclawTestRuntime skeleton", () => {
  let runtime: QclawTestRuntime;

  afterEach(async () => {
    if (runtime) await runtime.stop();
  });

  it("starts and responds to GET /runtime/snapshot with 200 JSON", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    const body = await res.json();
    expect(body.runtimeId).toBe("qclaw-swarm-runtime-001");
    expect(body.sequence).toBe(0);
  });

  it("responds to GET /runtime/capabilities with 200 JSON", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/capabilities`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.features.sse).toBe(true);
    expect(body.features.websocket).toBe(false);
  });

  it("returns 404 for unknown paths", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/unknown`);
    expect(res.status).toBe(404);
  });

  it("stop() closes the server", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const baseUrl = runtime.getBaseUrl();
    await runtime.stop();
    await expect(fetch(`${baseUrl}/runtime/snapshot`)).rejects.toThrow();
    runtime = undefined as any;
  });
});

describe("QclawTestRuntime state machine", () => {
  let runtime: QclawTestRuntime;

  afterEach(async () => {
    if (runtime) await runtime.stop();
  });

  it("initial snapshot has 4 agents (orchestrator + 2 workers + reviewer)", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`);
    const snap = await res.json();
    expect(snap.agents).toHaveLength(4);
    expect(snap.agents.map((a: any) => a.role).sort()).toEqual([
      "orchestrator",
      "reviewer",
      "worker",
      "worker",
    ]);
  });

  it("initial snapshot has 4 rooms (command, execution, review, delivery)", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`);
    const snap = await res.json();
    expect(snap.rooms).toHaveLength(4);
    expect(snap.rooms.map((r: any) => r.type).sort()).toEqual([
      "approval_delivery",
      "command",
      "execution",
      "review",
    ]);
  });

  it("all entities have runtimeId qclaw-swarm-runtime-001", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`);
    const snap = await res.json();
    for (const a of snap.agents) expect(a.runtimeId).toBe("qclaw-swarm-runtime-001");
    for (const r of snap.rooms) expect(r.runtimeId).toBe("qclaw-swarm-runtime-001");
  });
});

describe("QclawTestRuntime command handling", () => {
  let runtime: QclawTestRuntime;

  afterEach(async () => {
    if (runtime) await runtime.stop();
  });

  async function postCommand(cmd: any): Promise<any> {
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/commands`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": cmd.commandId },
      body: JSON.stringify(cmd),
    });
    return res.json();
  }

  function makeCommand(type: string, payload: any, commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`): any {
    return {
      commandId,
      commandType: type,
      timestamp: new Date().toISOString(),
      source: "user",
      actorId: "qclaw-agent-orchestrator",
      runtimeId: "qclaw-swarm-runtime-001",
      targetId: null,
      payload,
    };
  }

  it("task.create emits task.created + task.assigned + task.started (auto-dispatch)", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const result = await postCommand(makeCommand("task.create", {
      title: "Test task",
      description: "Test",
      priority: "normal",
      parentTaskId: null,
    }));
    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds.length).toBe(3);

    const snap = await (await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`)).json();
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].status).toBe("running");
    expect(snap.tasks[0].assigneeId).toMatch(/qclaw-agent-worker-\d/);
  });

  it("agent.pause emits agent.status_changed(paused)", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const result = await postCommand(makeCommand("agent.pause", { agentId: "qclaw-agent-worker-1" }));
    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds.length).toBe(1);

    const snap = await (await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`)).json();
    const agent = snap.agents.find((a: any) => a.agentId === "qclaw-agent-worker-1");
    expect(agent.status).toBe("paused");
  });

  it("approval.accept emits approval.resolved + task.completed (auto-complete)", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    // Drive to approval.requested state via test helper
    runtime.driveToApprovalRequestedForTest();
    const snapBefore = await (await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`)).json();
    const approvalId = snapBefore.approvals[0].approvalId;

    const result = await postCommand(makeCommand("approval.accept", { approvalId }));
    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds.length).toBe(2);

    const snapAfter = await (await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`)).json();
    expect(snapAfter.approvals[0].status).toBe("approved");
    expect(snapAfter.tasks[0].status).toBe("completed");
  });

  it("approval.reject emits approval.resolved + task.blocked (auto-block)", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    runtime.driveToApprovalRequestedForTest();
    const snapBefore = await (await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`)).json();
    const approvalId = snapBefore.approvals[0].approvalId;

    const result = await postCommand(makeCommand("approval.reject", {
      approvalId,
      reason: "rejected by user",
    }));
    expect(result.status).toBe("accepted");
    expect(result.affectedEventIds.length).toBe(2);

    const snapAfter = await (await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`)).json();
    expect(snapAfter.approvals[0].status).toBe("rejected");
    expect(snapAfter.tasks[0].status).toBe("blocked");
  });

  it("unknown command returns rejected", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    const result = await postCommand(makeCommand("unknown.command", {}));
    expect(result.status).toBe("rejected");
    expect(result.error.code).toBe("UNSUPPORTED_COMMAND");
  });
});

describe("QclawTestRuntime SSE stream", () => {
  let runtime: QclawTestRuntime;

  afterEach(async () => {
    if (runtime) await runtime.stop();
  });

  it("replays events with sequence > afterSequence and sends replay-complete", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    // Emit 6 events via the test helper
    runtime.driveToApprovalRequestedForTest();
    const snap = await (await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`)).json();
    const afterSeq = snap.sequence - 2; // replay last 2 events

    const res = await fetch(`${runtime.getBaseUrl()}/runtime/events?afterSequence=${afterSeq}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventCount = 0;
    let gotReplayComplete = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        if (frame.includes("event: domain-event")) eventCount++;
        if (frame.includes("event: replay-complete")) gotReplayComplete = true;
      }
      if (gotReplayComplete) break;
    }
    expect(eventCount).toBe(2);
    expect(gotReplayComplete).toBe(true);
    reader.cancel();
  });

  it("replay-complete has matching id and data.lastSequence", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    runtime.driveToApprovalRequestedForTest();
    const snap = await (await fetch(`${runtime.getBaseUrl()}/runtime/snapshot`)).json();
    const lastSeq = snap.sequence;

    const res = await fetch(`${runtime.getBaseUrl()}/runtime/events?afterSequence=0`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let replayFrame = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        if (frame.includes("event: replay-complete")) {
          replayFrame = frame;
          break;
        }
      }
      if (replayFrame) break;
    }
    // Extract id: and data.lastSequence
    const idMatch = replayFrame.match(/^id: (\d+)$/m);
    const dataMatch = replayFrame.match(/"lastSequence":(\d+)/);
    expect(idMatch).not.toBeNull();
    expect(dataMatch).not.toBeNull();
    expect(idMatch![1]).toBe(dataMatch![1]);
    expect(idMatch![1]).toBe(String(lastSeq));
    reader.cancel();
  });

  it("pushes live events to connected clients after replay-complete", async () => {
    runtime = new QclawTestRuntime({ port: 0 });
    await runtime.start();
    // Open stream with afterSequence=0 (no events to replay yet)
    const res = await fetch(`${runtime.getBaseUrl()}/runtime/events?afterSequence=0`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Wait for replay-complete
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes("event: replay-complete")) break;
    }

    // Emit a live event via a command
    await fetch(`${runtime.getBaseUrl()}/runtime/commands`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "cmd-live-1" },
      body: JSON.stringify({
        commandId: "cmd-live-1",
        commandType: "agent.pause",
        timestamp: new Date().toISOString(),
        source: "user",
        actorId: "qclaw-agent-orchestrator",
        runtimeId: "qclaw-swarm-runtime-001",
        targetId: null,
        payload: { agentId: "qclaw-agent-worker-1" },
      }),
    });

    // Read the live event
    buffer = "";
    let gotLiveEvent = false;
    const timeout = new Promise((r) => setTimeout(r, 2000));
    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: domain-event")) {
          gotLiveEvent = true;
          break;
        }
      }
    })();
    await Promise.race([readLoop, timeout]);
    expect(gotLiveEvent).toBe(true);
    reader.cancel();
  });
});
