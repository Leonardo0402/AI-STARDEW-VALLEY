// @vitest-environment jsdom

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIntegrationState } from "./useIntegrationState.js";
import { SnapshotStore, createEmptySnapshot } from "@agent-office/core";
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  AdapterCapabilities,
  RuntimeStreamObserver,
  SubscribeOptions,
  RuntimeSubscription,
  OfficeCommand,
  CommandResult,
} from "@agent-office/protocol";
import type { IntegrationProjection } from "./types.js";
import type { IntegrationProjectionProvider } from "./projection.js";

const fakeCapabilities: AdapterCapabilities = {
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

/**
 * A deterministic integration provider that projects *only* from the
 * RuntimeSnapshot it receives. It never calls out to GitHub or any review
 * system, so it is a valid witness for the Runtime Truth Review constraint.
 */
class FakeIntegrationAdapter implements RuntimeAdapter, IntegrationProjectionProvider {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async getSnapshot(): Promise<RuntimeSnapshot> {
    return createEmptySnapshot("r");
  }
  subscribe(_observer: RuntimeStreamObserver, _options?: SubscribeOptions): RuntimeSubscription {
    return { ready: Promise.resolve(), close: () => {} };
  }
  async execute(_command: OfficeCommand): Promise<CommandResult> {
    throw new Error("unused");
  }
  getCapabilities(): AdapterCapabilities {
    return fakeCapabilities;
  }

  getIntegrationProjection(snapshot: RuntimeSnapshot): IntegrationProjection {
    return {
      github: {
        issues: snapshot.tasks.map((task) => ({
          taskId: task.taskId,
          number: 0,
          kind: "issue" as const,
          title: task.title,
          state: (task.completedAt ? "closed" : "open") as "open" | "closed",
          stateReason: task.completedAt ? "completed" : undefined,
          closedAt: task.completedAt,
          labels: [],
          assignees: task.assigneeId ? [task.assigneeId] : [],
          url: "",
        })),
        pulls: snapshot.artifacts.map((artifact) => ({
          taskId: artifact.taskId,
          artifactId: artifact.artifactId,
          number: 0,
          kind: "pr" as const,
          title: artifact.title,
          state: artifact.status === "delivered" ? "merged" : artifact.status === "rejected" ? "closed" : "open",
          draft: artifact.status === "draft",
          labels: [],
          reviewers: artifact.reviewResult ? [artifact.reviewResult.reviewerId] : [],
          url: artifact.uri ?? "",
        })),
        auditNotes: [],
      },
      reviews: {
        assigned: [],
        submitted: [],
      },
      timeline: null,
    };
  }
}

describe("Runtime Truth Review", () => {
  it("does not call fetch or external APIs during hook usage", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() => Promise.resolve(new Response()));

    const adapter = new FakeIntegrationAdapter();
    const store = new SnapshotStore("r");
    renderHook(() => useIntegrationState(adapter, store));

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("derives IntegrationProjection purely from the snapshot", () => {
    const adapter = new FakeIntegrationAdapter();
    const store = new SnapshotStore("r");
    const { result } = renderHook(() => useIntegrationState(adapter, store));

    expect(result.current.projection.github?.issues).toHaveLength(0);
    expect(result.current.projection.github?.pulls).toHaveLength(0);

    const snapshot = createEmptySnapshot("r");
    snapshot.tasks = [
      {
        taskId: "t1",
        runtimeId: "r",
        title: "Implement login page",
        description: "",
        status: "created",
        priority: "normal",
        parentTaskId: null,
        assigneeId: null,
        roomId: null,
        dependencyIds: [],
        artifactIds: [],
        approvalId: null,
        createdAt: "2026-01-01T00:00:00Z",
        startedAt: null,
        completedAt: null,
        blockedReason: null,
      },
    ];
    act(() => {
      store.setSnapshot(snapshot);
    });

    expect(result.current.projection.github?.issues).toHaveLength(1);
    expect(result.current.projection.github?.issues[0].taskId).toBe("t1");
    expect(result.current.projection.github?.issues[0].title).toBe("Implement login page");
  });

  it("maps every GitHub field in IntegrationProjection to a source field in RuntimeSnapshot", () => {
    const adapter = new FakeIntegrationAdapter();
    const store = new SnapshotStore("r");
    const snapshot = createEmptySnapshot("r");
    snapshot.tasks = [
      {
        taskId: "gh-issue-1",
        runtimeId: "r",
        title: "Issue title",
        description: "",
        status: "completed",
        priority: "high",
        parentTaskId: null,
        assigneeId: "user-1",
        roomId: null,
        dependencyIds: [],
        artifactIds: [],
        approvalId: null,
        createdAt: "2026-01-01T00:00:00Z",
        startedAt: null,
        completedAt: "2026-01-02T00:00:00Z",
        blockedReason: null,
      },
    ];
    snapshot.artifacts = [
      {
        artifactId: "gh-pr-1",
        runtimeId: "r",
        taskId: "gh-issue-1",
        producerAgentId: "user-2",
        type: "github_pr",
        title: "PR title",
        status: "delivered",
        uri: "https://github.com/o/r/pull/1",
        version: 1,
        createdAt: "2026-01-01T00:00:00Z",
        reviewResult: null,
      },
    ];
    store.setSnapshot(snapshot);

    const { result } = renderHook(() => useIntegrationState(adapter, store));
    const { projection } = result.current;

    expect(projection.github).not.toBeNull();
    expect(projection.reviews).not.toBeNull();

    const issue = projection.github!.issues[0];
    expect(issue.taskId).toBe(snapshot.tasks[0].taskId);
    expect(issue.title).toBe(snapshot.tasks[0].title);
    expect(issue.state).toBe("closed");
    expect(issue.closedAt).toBe(snapshot.tasks[0].completedAt);
    expect(issue.assignees).toEqual([snapshot.tasks[0].assigneeId]);

    const pull = projection.github!.pulls[0];
    expect(pull.artifactId).toBe(snapshot.artifacts[0].artifactId);
    expect(pull.taskId).toBe(snapshot.artifacts[0].taskId);
    expect(pull.title).toBe(snapshot.artifacts[0].title);
    expect(pull.state).toBe("merged");
    expect(pull.url).toBe(snapshot.artifacts[0].uri);

    expect(projection.github!.auditNotes).toEqual([]);
    expect(projection.reviews!.assigned).toEqual([]);
    expect(projection.reviews!.submitted).toEqual([]);
  });
});
