import type { RuntimeSnapshot, DomainEvent } from "@agent-office/protocol";

export interface GoldenFlowResult {
  finalSnapshot: RuntimeSnapshot;
  events: DomainEvent[];
}

/**
 * Drives the QClaw test runtime through the golden workflow:
 *   task.create → (auto-dispatch: task.assigned + task.started)
 *   → internal: artifact.created
 *   → internal: artifact.reviewed(approved)
 *   → internal: approval.requested
 *   → approval.accept → (auto: approval.resolved + task.completed)
 *
 * The internal steps (artifact/review/approval-request) are triggered
 * via the runtime's demo endpoint `POST /runtime/demo/trigger-artifact-review`,
 * which simulates the worker producing an artifact and the reviewer
 * approving it. In a real runtime these would be agent-driven.
 *
 * The approval.accept is sent as a real HTTP command (human-in-the-loop).
 */
export async function playGoldenFlow(baseUrl: string): Promise<GoldenFlowResult> {
  // Step 1: Create task (auto-dispatches)
  const createCmd = {
    commandId: `cmd-golden-create-${Date.now()}`,
    commandType: "task.create",
    timestamp: new Date().toISOString(),
    source: "user",
    actorId: "qclaw-agent-orchestrator",
    runtimeId: "qclaw-swarm-runtime-001",
    targetId: null,
    payload: {
      title: "Golden workflow task",
      description: "End-to-end demo: task → artifact → review → approval",
      priority: "high",
      parentTaskId: null,
    },
  };
  await fetch(`${baseUrl}/runtime/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": createCmd.commandId },
    body: JSON.stringify(createCmd),
  });

  // Step 2: Trigger artifact creation + review (simulated worker/reviewer actions)
  await fetch(`${baseUrl}/runtime/demo/trigger-artifact-review`, { method: "POST" });

  // Step 3: Get current state to find the approval
  const snapRes = await fetch(`${baseUrl}/runtime/snapshot`);
  const snapBeforeApproval = await snapRes.json();
  const approvalId = snapBeforeApproval.approvals[0].approvalId;

  // Step 4: Accept approval (auto-completes task)
  const acceptCmd = {
    commandId: `cmd-golden-accept-${Date.now()}`,
    commandType: "approval.accept",
    timestamp: new Date().toISOString(),
    source: "user",
    actorId: "qclaw-agent-orchestrator",
    runtimeId: "qclaw-swarm-runtime-001",
    targetId: null,
    payload: { approvalId },
  };
  await fetch(`${baseUrl}/runtime/commands`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": acceptCmd.commandId },
    body: JSON.stringify(acceptCmd),
  });

  // Step 5: Fetch final snapshot and event log
  const finalSnapRes = await fetch(`${baseUrl}/runtime/snapshot`);
  const finalSnapshot = await finalSnapRes.json();
  const eventsRes = await fetch(`${baseUrl}/runtime/demo/event-log`);
  const events = await eventsRes.json();

  return { finalSnapshot, events };
}
