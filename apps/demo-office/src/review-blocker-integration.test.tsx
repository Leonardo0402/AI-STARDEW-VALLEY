// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { GitHubRuntimeAdapter } from "@agent-office/adapter-github";
import {
  AgentReviewOrchestrator,
  CommandGateway,
  RuleBasedReviewStrategy,
  SnapshotStore,
} from "@agent-office/core";
import { ReviewBlocker } from "@agent-office/control-ui/integration";
import type { DomainEvent, OfficeCommand } from "@agent-office/protocol";
import { CommandType, EventType } from "@agent-office/protocol";

const RUNTIME_ID = "github-runtime-001";

interface Composition {
  adapter: GitHubRuntimeAdapter;
  orchestrator: AgentReviewOrchestrator;
  gateway: CommandGateway;
  store: SnapshotStore;
  events: DomainEvent[];
}

async function createComposition(): Promise<Composition> {
  const adapter = new GitHubRuntimeAdapter({ runtimeId: RUNTIME_ID });
  const orchestrator = new AgentReviewOrchestrator(adapter, {
    strategy: new RuleBasedReviewStrategy(),
  });
  const store = new SnapshotStore(RUNTIME_ID);
  const gateway = new CommandGateway(orchestrator);
  const events: DomainEvent[] = [];

  await adapter.connect();
  const snap = await adapter.getSnapshot();
  store.setSnapshot(snap);
  gateway.updateSnapshot(snap);

  orchestrator.subscribe({
    onEvent: (event) => {
      events.push(event);
      store.applyEvent(event);
      gateway.updateSnapshot(store.getSnapshot());
    },
  });

  return { adapter, orchestrator, gateway, store, events };
}

async function sendUserCommand(
  gateway: CommandGateway,
  commandType: string,
  payload: unknown,
  actorId = "user-1"
): Promise<void> {
  const command: OfficeCommand = {
    commandId: `cmd-${commandType}-${Date.now()}`,
    commandType,
    timestamp: new Date().toISOString(),
    source: "user",
    actorId,
    runtimeId: RUNTIME_ID,
    targetId: null,
    payload,
  };
  const result = await gateway.execute(command);
  if (result.status !== "accepted") {
    throw new Error(
      `[${commandType}] ${result.error?.message ?? "rejected"}`
    );
  }
}

function renderReviewBlocker(
  orchestrator: AgentReviewOrchestrator,
  gateway: CommandGateway
): void {
  const draft = orchestrator.getSubmittedReviews()[0];
  render(
    <ReviewBlocker
      assigned={orchestrator.getAssignedReviews()}
      submitted={[draft]}
      onSendCommand={async (commandType, payload) => {
        await sendUserCommand(gateway, commandType, payload as Record<string, unknown>);
      }}
    />
  );
}

describe("ReviewBlocker integration: orchestrator + GitHub adapter + gateway", () => {
  let composition: Composition;

  beforeEach(async () => {
    composition = await createComposition();
  });

  it("human approve dispatches review.approve and emits ARTIFACT_REVIEWED", async () => {
    const { orchestrator, gateway, events } = composition;

    await sendUserCommand(gateway, CommandType.REVIEW_ASSIGN, {
      targetKind: "pr",
      targetNumber: 1,
      agentId: "agent-reviewer-1",
    });

    const reviewId = orchestrator.getAssignedReviews()[0].reviewId;

    await sendUserCommand(
      gateway,
      CommandType.REVIEW_SUBMIT,
      { reviewId, verdict: "approved", comment: "LGTM" },
      "agent-reviewer-1"
    );

    expect(orchestrator.getSubmittedReviews()).toHaveLength(1);

    renderReviewBlocker(orchestrator, gateway);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(orchestrator.getSubmittedReviews()).toHaveLength(0);
    });

    const reviewed = events.find((e) => e.type === EventType.ARTIFACT_REVIEWED);
    expect(reviewed).toBeDefined();
    expect(reviewed!.payload).toMatchObject({
      artifactId: "gh-pr-1",
      verdict: "approved",
      comment: "LGTM",
    });
  });

  it("human reject dispatches review.reject and does not emit ARTIFACT_REVIEWED", async () => {
    const { orchestrator, gateway, events } = composition;

    await sendUserCommand(gateway, CommandType.REVIEW_ASSIGN, {
      targetKind: "pr",
      targetNumber: 2,
      agentId: "agent-reviewer-2",
    });

    const reviewId = orchestrator.getAssignedReviews()[0].reviewId;

    await sendUserCommand(
      gateway,
      CommandType.REVIEW_SUBMIT,
      { reviewId, verdict: "revision_required", comment: "Needs work" },
      "agent-reviewer-2"
    );

    expect(orchestrator.getSubmittedReviews()).toHaveLength(1);

    renderReviewBlocker(orchestrator, gateway);
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => {
      expect(orchestrator.getSubmittedReviews()).toHaveLength(0);
    });

    expect(events.some((e) => e.type === EventType.ARTIFACT_REVIEWED)).toBe(false);
  });
});
