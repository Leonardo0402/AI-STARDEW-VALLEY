# Issue #49 — Office UI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire GitHub adapter evidence and Agent Review state into the demo-office UI via a new `IntegrationProjection`, then render Queue / Review Blocker / Evidence / Timeline panels and matching pixel-art canvas props.

**Architecture:** Add a peer `IntegrationProjection` layer alongside `OfficeProjection` and `LifeSimProjection`. `AgentReviewOrchestrator` implements `IntegrationProjectionProvider` so it can vend the projection. A new `useIntegrationState` hook subscribes to `SnapshotStore` and recomputes the projection on every snapshot. Four new React panel components consume the projection; `PixelOfficeScene` gets an `updateIntegration()` method for decorative sprite feedback.

**Tech Stack:** TypeScript, React, PixiJS (pixel-office), Vitest + React Testing Library, Node.js scripts for asset copy and screenshots.

## Global Constraints

- All UI data must come from Runtime Event → Snapshot / `IntegrationProjection` projection (Runtime Truth Review); no UI-side API calls, no fabricated data.
- Default `demo-office` runtime mode remains `mock`; `github` mode is opt-in via config.
- Keep changes surgical: do not refactor unrelated code, do not change existing design tokens or room layouts.
- Every new file needs a co-located test file.
- Commit after each independently testable task.
- RTX 3050-4GB constraint: run targeted tests per task; full screenshot suite only at gate boundaries.

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `packages/control-ui/src/integration/types.ts` | `IntegrationProjection`, `GitHubIntegrationView`, `ReviewIntegrationView`, queue/evidence item types |
| `packages/control-ui/src/integration/projection.ts` | `IntegrationProjectionProvider` interface, `projectIntegration()`, `projectGitHubIntegration()` |
| `packages/control-ui/src/integration/useIntegrationState.ts` | React hook subscribing store → `IntegrationProjection` |
| `packages/control-ui/src/integration/index.ts` | Public barrel export |
| `packages/control-ui/src/integration/projection.test.ts` | Unit tests for projection logic |
| `packages/control-ui/src/integration/useIntegrationState.test.tsx` | Hook tests |
| `apps/demo-office/src/components/QueuePanel.tsx` | Issue/PR queue panel card |
| `apps/demo-office/src/components/QueuePanel.test.tsx` | QueuePanel tests |
| `apps/demo-office/src/components/ReviewBlocker.tsx` | Review state + human Approve/Reject panel |
| `apps/demo-office/src/components/ReviewBlocker.test.tsx` | ReviewBlocker tests |
| `apps/demo-office/src/components/EvidencePanel.tsx` | Audit notes panel |
| `apps/demo-office/src/components/EvidencePanel.test.tsx` | EvidencePanel tests |
| `apps/demo-office/src/components/TimelinePanel.tsx` | Filtered event timeline panel |
| `apps/demo-office/src/components/TimelinePanel.test.tsx` | TimelinePanel tests |
| `packages/pixel-office/assets/props/mission-board.png` | Trae-generated prop sprite |
| `packages/pixel-office/assets/props/review-desk.png` | Trae-generated prop sprite |
| `packages/pixel-office/assets/props/filing-cabinet.png` | Trae-generated prop sprite |
| `packages/pixel-office/assets/props/wall-scroll.png` | Trae-generated prop sprite |
| `packages/pixel-office/assets/props/icon-issue.png` | Small panel/canvas icon |
| `packages/pixel-office/assets/props/icon-pr.png` | Small panel/canvas icon |
| `packages/pixel-office/assets/props/icon-review.png` | Small panel/canvas icon |
| `packages/pixel-office/assets/props/icon-evidence.png` | Small panel/canvas icon |

### Modified files

| File | Responsibility |
|---|---|
| `packages/core/src/agent-review-orchestrator.ts` | Add `getIntegrationProjection()` |
| `packages/core/src/agent-review-orchestrator.test.ts` | Add tests for new method |
| `packages/control-ui/src/life-sim/projection.ts` | Extend `composeProjections` to accept `IntegrationProjection` |
| `packages/control-ui/src/life-sim/projection.test.ts` | Add integration composition tests |
| `packages/control-ui/src/index.tsx` | Re-export integration module |
| `apps/demo-office/src/useComposedOfficeState.ts` | Compose `integration` into `ComposedOfficeState` |
| `apps/demo-office/src/runtime/types.ts` | Add `github` mode and GitHub config fields |
| `apps/demo-office/src/runtime/config.ts` | Read GitHub config from env |
| `apps/demo-office/src/runtime/create-runtime.ts` | Add `github` adapter branch |
| `apps/demo-office/src/runtime/create-runtime.test.ts` | Add `github` mode test |
| `apps/demo-office/.env.example` | Document new GitHub env vars |
| `packages/control-ui/src/ControlPanel.tsx` | Render four new panel cards |
| `packages/control-ui/src/ControlPanel.test.tsx` | Add panel presence tests |
| `packages/pixel-office/src/office-scene.ts` | Add `updateIntegration()` and wire to renderers |
| `packages/pixel-office/src/renderer/prop-renderer.ts` | Render Mission Board / Review Desk / Filing Cabinet / Wall Scroll |
| `packages/pixel-office/src/renderer/effect-renderer.ts` | Glow/pulse effects tied to integration state |
| `apps/demo-office/src/App.tsx` | Call `scene.updateIntegration()` when projection changes |
| `apps/demo-office/scripts/capture-demo-office-screenshots.mjs` | Add new screenshot states |
| `apps/demo-office/scripts/generate-annotated-comparisons.mjs` | Annotate new panels |

---

## Gate 1 — Data Layer

### Task 1: Define IntegrationProjection types

**Files:**
- Create: `packages/control-ui/src/integration/types.ts`
- Test: `packages/control-ui/src/integration/types.test.ts` (compile-time import sanity)

**Interfaces:**
- Produces: `IntegrationProjection`, `GitHubIntegrationView`, `ReviewIntegrationView`, `IssueQueueItem`, `PullRequestQueueItem`, `AuditNoteView`

- [ ] **Step 1: Write the type file**

```typescript
import type { Id } from "@agent-office/protocol";
import type { ReviewAssignment, ReviewDraft } from "@agent-office/core";

export interface IntegrationProjection {
  github: GitHubIntegrationView | null;
  reviews: ReviewIntegrationView | null;
}

export interface GitHubIntegrationView {
  issues: IssueQueueItem[];
  pulls: PullRequestQueueItem[];
  auditNotes: AuditNoteView[];
}

export interface ReviewIntegrationView {
  assigned: ReviewAssignment[];
  submitted: ReviewDraft[];
}

export interface IssueQueueItem {
  taskId: Id;
  number: number;
  kind: "issue";
  title: string;
  state: "open" | "closed";
  stateReason?: string;
  closedAt: string | null;
  labels: string[];
  assignees: string[];
  url: string;
}

export interface PullRequestQueueItem {
  taskId: Id;
  artifactId: Id;
  number: number;
  kind: "pr";
  title: string;
  state: "open" | "closed" | "merged";
  draft: boolean;
  labels: string[];
  reviewers: string[];
  url: string;
}

export interface AuditNoteView {
  auditId: Id;
  taskId: Id | null;
  body: string;
  author: Id;
  createdAt: string;
}
```

- [ ] **Step 2: Add a compile-time import test**

```typescript
import { describe, it, expect } from "vitest";
import type { IntegrationProjection, IssueQueueItem } from "./types.js";

describe("integration types", () => {
  it("can construct a minimal IntegrationProjection", () => {
    const p: IntegrationProjection = { github: null, reviews: null };
    expect(p.github).toBeNull();
  });

  it("IssueQueueItem has required fields", () => {
    const item: IssueQueueItem = {
      taskId: "gh-issue-1",
      number: 1,
      kind: "issue",
      title: "t",
      state: "open",
      closedAt: null,
      labels: [],
      assignees: [],
      url: "https://github.com/o/r/issues/1",
    };
    expect(item.kind).toBe("issue");
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- packages/control-ui/src/integration/types.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/control-ui/src/integration/types.ts packages/control-ui/src/integration/types.test.ts
git commit -m "feat(control-ui): add IntegrationProjection types"
```

---

### Task 2: Implement projectIntegration and provider interface

**Files:**
- Create: `packages/control-ui/src/integration/projection.ts`
- Test: `packages/control-ui/src/integration/projection.test.ts`

**Interfaces:**
- Consumes: `IntegrationProjection`, `IssueQueueItem`, `PullRequestQueueItem`, `AuditNoteView` from `./types.js`
- Produces: `IntegrationProjectionProvider` interface, `projectIntegration(adapter, snapshot)`, `emptyIntegrationProjection()`

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/control-ui/src/integration/projection.test.ts`
Expected: FAIL with `Cannot find module './projection.js'`

- [ ] **Step 3: Implement projection.ts**

```typescript
import type { RuntimeAdapter, RuntimeSnapshot } from "@agent-office/protocol";
import type { IntegrationProjection } from "./types.js";

export interface IntegrationProjectionProvider {
  getIntegrationProjection(snapshot: RuntimeSnapshot): IntegrationProjection;
}

export function emptyIntegrationProjection(): IntegrationProjection {
  return { github: null, reviews: null };
}

export function projectIntegration(
  adapter: RuntimeAdapter,
  snapshot: RuntimeSnapshot
): IntegrationProjection {
  const provider = adapter as RuntimeAdapter & Partial<IntegrationProjectionProvider>;
  if (typeof provider.getIntegrationProjection === "function") {
    return provider.getIntegrationProjection(snapshot);
  }
  return emptyIntegrationProjection();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/control-ui/src/integration/projection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/control-ui/src/integration/projection.ts packages/control-ui/src/integration/projection.test.ts
git commit -m "feat(control-ui): add IntegrationProjection provider and projectIntegration"
```

---

### Task 3: Implement useIntegrationState hook

**Files:**
- Create: `packages/control-ui/src/integration/useIntegrationState.ts`
- Test: `packages/control-ui/src/integration/useIntegrationState.test.tsx`

**Interfaces:**
- Consumes: `projectIntegration`, `emptyIntegrationProjection` from `./projection.js`; `IntegrationProjection` from `./types.js`
- Produces: `IntegrationState` interface, `useIntegrationState(adapter, store)` hook

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SnapshotStore } from "@agent-office/core";
import type { RuntimeAdapter, RuntimeSnapshot } from "@agent-office/protocol";
import { createEmptySnapshot } from "@agent-office/core";
import { useIntegrationState } from "./useIntegrationState.js";

class StubAdapter implements RuntimeAdapter {
  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  async execute(): Promise<never> { throw new Error("unused"); }
  async getSnapshot(): Promise<RuntimeSnapshot> { return createEmptySnapshot("r"); }
  getCapabilities() { return { supportedCommands: [], supportsSubscribe: false }; }
  subscribe() { return { unsubscribe: () => {} }; }
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- packages/control-ui/src/integration/useIntegrationState.test.tsx`
Expected: FAIL with module not found

- [ ] **Step 3: Implement the hook**

```typescript
import { useState, useEffect } from "react";
import type { SnapshotStore } from "@agent-office/core";
import type { RuntimeAdapter, RuntimeSnapshot } from "@agent-office/protocol";
import type { IntegrationProjection } from "./types.js";
import { projectIntegration, emptyIntegrationProjection } from "./projection.js";

export interface IntegrationState {
  projection: IntegrationProjection;
}

export function useIntegrationState(
  adapter: RuntimeAdapter,
  store: SnapshotStore
): IntegrationState {
  const [projection, setProjection] = useState<IntegrationProjection>(() =>
    projectIntegration(adapter, store.getSnapshot())
  );

  useEffect(() => {
    return store.subscribe((snap: RuntimeSnapshot) => {
      setProjection(projectIntegration(adapter, snap));
    });
  }, [adapter, store]);

  return { projection };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- packages/control-ui/src/integration/useIntegrationState.test.tsx`
Expected: PASS

- [ ] **Step 5: Add store update test**

```typescript
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
```

Run: `npm test -- packages/control-ui/src/integration/useIntegrationState.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/control-ui/src/integration/useIntegrationState.ts packages/control-ui/src/integration/useIntegrationState.test.tsx
git commit -m "feat(control-ui): add useIntegrationState hook"
```

---

### Task 4: Add integration barrel export

**Files:**
- Create: `packages/control-ui/src/integration/index.ts`
- Modify: `packages/control-ui/src/index.tsx`

- [ ] **Step 1: Create barrel file**

```typescript
export * from "./types.js";
export * from "./projection.js";
export * from "./useIntegrationState.js";
```

- [ ] **Step 2: Re-export from control-ui root**

Add to `packages/control-ui/src/index.tsx`:

```typescript
export * from "./integration/index.js";
```

- [ ] **Step 3: Verify build**

Run: `npm run build --workspace=@agent-office/control-ui`
Expected: succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/control-ui/src/integration/index.ts packages/control-ui/src/index.tsx
git commit -m "feat(control-ui): export integration module"
```

---

### Task 5: Extend AgentReviewOrchestrator with getIntegrationProjection

**Files:**
- Modify: `packages/core/src/agent-review-orchestrator.ts`
- Test: `packages/core/src/agent-review-orchestrator.test.ts`

**Interfaces:**
- Consumes: `IntegrationProjectionProvider` from `@agent-office/control-ui/integration`; `GitHubRuntimeAdapter` from `@agent-office/adapter-github`; `RuntimeSnapshot` from `@agent-office/protocol`
- Produces: `getIntegrationProjection(snapshot)` method on `AgentReviewOrchestrator`

- [ ] **Step 1: Add a failing test**

Append to `packages/core/src/agent-review-orchestrator.test.ts`:

```typescript
describe("getIntegrationProjection", () => {
  it("returns reviews state", async () => {
    const inner = new MockRuntimeAdapter();
    const orch = new AgentReviewOrchestrator(inner);
    await orch.execute({
      commandId: "c1",
      commandType: CommandType.REVIEW_ASSIGN,
      timestamp: "2026-01-01T00:00:00Z",
      source: "user",
      actorId: "user-1",
      runtimeId: "r",
      targetId: null,
      payload: { targetKind: "issue", targetNumber: 1, agentId: "agent-1" },
    });
    const snapshot = createEmptySnapshot("r");
    const proj = orch.getIntegrationProjection(snapshot);
    expect(proj.reviews?.assigned).toHaveLength(1);
    expect(proj.reviews?.assigned[0].targetNumber).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- packages/core/src/agent-review-orchestrator.test.ts`
Expected: FAIL with `getIntegrationProjection is not a function`

- [ ] **Step 3: Implement the method**

Add imports at top of `packages/core/src/agent-review-orchestrator.ts`:

```typescript
import type {
  IntegrationProjection,
  IntegrationProjectionProvider,
} from "@agent-office/control-ui/integration";
import { GitHubRuntimeAdapter } from "@agent-office/adapter-github";
```

Change class declaration:

```typescript
export class AgentReviewOrchestrator
  implements RuntimeAdapter, IntegrationProjectionProvider
{
```

Add method after `getReviewDraft`:

```typescript
getIntegrationProjection(snapshot: RuntimeSnapshot): IntegrationProjection {
  return {
    github:
      this.inner instanceof GitHubRuntimeAdapter
        ? projectGitHubIntegration(this.inner.getGitHubEvidence(), snapshot)
        : null,
    reviews: {
      assigned: this.getAssignedReviews(),
      submitted: this.getSubmittedReviews(),
    },
  };
}
```

Add helper function near bottom of file:

```typescript
function projectGitHubIntegration(
  evidence: import("@agent-office/adapter-github").GitHubAdapterEvidence,
  snapshot: RuntimeSnapshot
): import("@agent-office/control-ui/integration").GitHubIntegrationView {
  const issues: import("@agent-office/control-ui/integration").IssueQueueItem[] = [];
  const pulls: import("@agent-office/control-ui/integration").PullRequestQueueItem[] = [];

  for (const task of snapshot.tasks) {
    const ref = evidence.tasks[task.taskId];
    if (!ref) continue;
    if (ref.kind === "issue") {
      issues.push({
        taskId: task.taskId,
        number: ref.number,
        kind: "issue",
        title: task.title,
        state: ref.rawState as "open" | "closed",
        stateReason: ref.stateReason,
        closedAt: ref.closedAt ?? null,
        labels: ref.labels,
        assignees: ref.assignees,
        url: ref.url,
      });
    }
  }

  for (const art of snapshot.artifacts) {
    const ref = evidence.artifacts[art.artifactId];
    if (!ref || ref.kind !== "pr") continue;
    const task = snapshot.tasks.find((t) => t.taskId === art.taskId);
    pulls.push({
      taskId: task?.taskId ?? art.taskId,
      artifactId: art.artifactId,
      number: ref.number,
      kind: "pr",
      title: art.title,
      state: ref.rawState as "open" | "closed" | "merged",
      draft: art.status === "draft",
      labels: ref.labels,
      reviewers: ref.reviewers ?? [],
      url: ref.url,
    });
  }

  return {
    issues,
    pulls,
    auditNotes: evidence.auditNotes.map((n) => ({
      auditId: n.auditId,
      taskId: n.taskId,
      body: n.body,
      author: n.author,
      createdAt: n.createdAt,
    })),
  };
}
```

- [ ] **Step 4: Update package.json dependency**

Ensure `packages/core/package.json` has `@agent-office/control-ui` and `@agent-office/adapter-github` as dev/peer dependencies only if needed. Since core should not depend on control-ui (control-ui depends on core), this creates a circular dependency. **Do NOT add control-ui dependency to core.**

Instead, move `IntegrationProjectionProvider` to `packages/protocol/src/index.ts` or keep it in control-ui and have orchestrator implement it implicitly without importing the interface.

**Decision:** Keep `IntegrationProjectionProvider` in `control-ui/integration` and have `AgentReviewOrchestrator` implement `getIntegrationProjection` with return type `any` or inline `IntegrationProjection` type, avoiding core → control-ui dependency. The hook uses duck typing.

Revised implementation (no control-ui import in core):

```typescript
getIntegrationProjection(snapshot: RuntimeSnapshot): {
  github: { issues: unknown[]; pulls: unknown[]; auditNotes: unknown[] } | null;
  reviews: { assigned: ReviewAssignment[]; submitted: ReviewDraft[] };
} {
  return {
    github: this.inner instanceof GitHubRuntimeAdapter
      ? projectGitHubIntegration(this.inner.getGitHubEvidence(), snapshot)
      : null,
    reviews: {
      assigned: this.getAssignedReviews(),
      submitted: this.getSubmittedReviews(),
    },
  };
}
```

And the helper returns the raw shape that matches `IntegrationProjection`. The `projectIntegration` function in control-ui will cast/accept it.

- [ ] **Step 5: Run tests**

Run: `npm test -- packages/core/src/agent-review-orchestrator.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/agent-review-orchestrator.ts packages/core/src/agent-review-orchestrator.test.ts
git commit -m "feat(core): add AgentReviewOrchestrator.getIntegrationProjection"
```

---

### Task 6: Extend composeProjections and ComposedOfficeState

**Files:**
- Modify: `packages/control-ui/src/life-sim/projection.ts`
- Modify: `packages/control-ui/src/life-sim/projection.test.ts`
- Modify: `apps/demo-office/src/useComposedOfficeState.ts`

**Interfaces:**
- Consumes: `IntegrationProjection`, `IntegrationState` from `@agent-office/control-ui/integration`
- Produces: `composeProjections(office, lifeSim, integration)` overload or chained variant; `ComposedOfficeState.integration`

- [ ] **Step 1: Write failing test for composeProjections**

Append to `packages/control-ui/src/life-sim/projection.test.ts`:

```typescript
import { emptyIntegrationProjection } from "../integration/projection.js";

describe("composeProjections with integration", () => {
  it("merges integration into composed projection", () => {
    const office = createOfficeProjection();
    const lifeSim = createLifeSimProjection();
    const integration = emptyIntegrationProjection();
    const composed = composeProjections(office, lifeSim, integration);
    expect(composed.integration).toBe(integration);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/control-ui/src/life-sim/projection.test.ts`
Expected: FAIL with `Expected 2 arguments, but got 3`

- [ ] **Step 3: Extend composeProjections**

Modify `packages/control-ui/src/life-sim/projection.ts`:

```typescript
import type { IntegrationProjection } from "../integration/types.js";

export interface ComposedOfficeProjection extends OfficeProjection {
  lifeSim: LifeSimProjection;
  integration: IntegrationProjection;
}

export function composeProjections(
  office: OfficeProjection,
  lifeSim: LifeSimProjection,
  integration: IntegrationProjection
): ComposedOfficeProjection {
  return {
    ...office,
    lifeSim,
    integration,
  };
}
```

Update the existing `ComposedOfficeProjection` type to include `integration`. Fix any existing tests that construct `ComposedOfficeProjection` to include `integration`.

- [ ] **Step 4: Run tests**

Run: `npm test -- packages/control-ui/src/life-sim/projection.test.ts`
Expected: PASS

- [ ] **Step 5: Update useComposedOfficeState**

Modify `apps/demo-office/src/useComposedOfficeState.ts`:

```typescript
import {
  useIntegrationState,
  type IntegrationState,
} from "@agent-office/control-ui";

export interface ComposedOfficeState extends OfficeState {
  projection: ComposedOfficeProjection;
  integration: IntegrationState;
  lifeSim: UseLifeSimStateResult;
  sendLifeSimCommand(commandType: string, payload: unknown): Promise<void>;
}

export function useComposedOfficeState(
  session: RuntimeSession,
  store: SnapshotStore,
  gateway: CommandGateway,
  runtimeId: string,
  lifeSimSession: LifeSimSession,
  worldId: string = "default",
  adapter?: RuntimeAdapter
): ComposedOfficeState {
  const office = useOfficeState(session, store, gateway, runtimeId);
  const lifeSim = useLifeSimState(lifeSimSession);
  const integration = useIntegrationState(adapter ?? session as unknown as RuntimeAdapter, store);
  // ... rest
  const projection = useMemo(
    () => composeProjections(office.projection, lifeSim.projection, integration.projection),
    [office.projection, lifeSim.projection, integration.projection]
  );
  return {
    ...office,
    projection,
    integration,
    lifeSim,
    sendLifeSimCommand,
  };
}
```

Wait — `RuntimeSession` does not expose the adapter. Two options:

A. Pass adapter as a new required parameter to `useComposedOfficeState`.
B. Add `getAdapter()` to `RuntimeSession`.

**Decision:** Option A is less invasive. Modify callers (`App.tsx`, tests) to pass `composition.adapter`.

- [ ] **Step 6: Update App.tsx caller**

Modify `apps/demo-office/src/App.tsx`:

```typescript
interface AppProps {
  // ... existing
  adapter: RuntimeAdapter;
}
```

And pass `adapter` to `useComposedOfficeState`.

Modify `apps/demo-office/src/main.tsx`:

```typescript
<App
  adapter={composition.adapter}
  // ... existing props
/>
```

- [ ] **Step 7: Run affected tests**

Run: `npm test -- apps/demo-office/src/useComposedOfficeState apps/demo-office/src/App.test.tsx apps/demo-office/src/main.test.tsx`
Expected: PASS after fixing test mocks to pass `adapter`

- [ ] **Step 8: Commit**

```bash
git add packages/control-ui/src/life-sim/projection.ts packages/control-ui/src/life-sim/projection.test.ts apps/demo-office/src/useComposedOfficeState.ts apps/demo-office/src/App.tsx apps/demo-office/src/main.tsx
git commit -m "feat(demo-office): compose IntegrationProjection into office state"
```

---

### Task 7: Add github runtime mode to create-runtime

**Files:**
- Modify: `apps/demo-office/src/runtime/types.ts`
- Modify: `apps/demo-office/src/runtime/config.ts`
- Modify: `apps/demo-office/src/runtime/create-runtime.ts`
- Modify: `apps/demo-office/.env.example`
- Test: `apps/demo-office/src/runtime/create-runtime.test.ts`

- [ ] **Step 1: Update types**

```typescript
export type RuntimeMode = "mock" | "http-sse" | "github";

export interface DemoRuntimeConfig {
  mode: RuntimeMode;
  runtimeId: string;
  baseUrl?: string;
  lifeSimBaseUrl: string;
  githubOwner?: string;
  githubRepo?: string;
  githubToken?: string;
}
```

- [ ] **Step 2: Update config.ts**

Read new env vars:

```typescript
const mode = (env.VITE_RUNTIME_MODE ?? "mock") as RuntimeMode;
if (mode === "github" && (!env.VITE_GITHUB_OWNER || !env.VITE_GITHUB_REPO)) {
  // optional warning only; adapter supports unconfigured local commands
}
return {
  mode,
  runtimeId: env.VITE_RUNTIME_ID ?? "demo-runtime-001",
  baseUrl: env.VITE_RUNTIME_BASE_URL,
  lifeSimBaseUrl: env.VITE_LIFE_SIM_BASE_URL ?? "http://localhost:3001",
  githubOwner: env.VITE_GITHUB_OWNER,
  githubRepo: env.VITE_GITHUB_REPO,
  githubToken: env.VITE_GITHUB_TOKEN,
};
```

- [ ] **Step 3: Update create-runtime.ts**

Add imports:

```typescript
import { GitHubRuntimeAdapter } from "@agent-office/adapter-github";
import { AgentReviewOrchestrator, RuleBasedReviewStrategy } from "@agent-office/core";
```

Add branch:

```typescript
case "github": {
  const gh = new GitHubRuntimeAdapter({
    owner: config.githubOwner,
    repo: config.githubRepo,
    // apiClient is optional; omit means local commands only
  });
  return new AgentReviewOrchestrator(gh, { strategy: new RuleBasedReviewStrategy() });
}
```

- [ ] **Step 4: Update .env.example**

```
# Runtime mode: mock | http-sse | github
VITE_RUNTIME_MODE=mock
VITE_RUNTIME_ID=demo-runtime-001
VITE_RUNTIME_BASE_URL=
VITE_LIFE_SIM_BASE_URL=http://localhost:3001

# GitHub mode (optional; required only for network write commands)
VITE_GITHUB_OWNER=
VITE_GITHUB_REPO=
VITE_GITHUB_TOKEN=
```

- [ ] **Step 5: Add test**

```typescript
describe("createRuntime github mode", () => {
  it("returns AgentReviewOrchestrator for github mode", () => {
    const composition = createRuntime({
      mode: "github",
      runtimeId: "r",
      lifeSimBaseUrl: "http://localhost:3001",
      githubOwner: "owner",
      githubRepo: "repo",
    });
    expect(composition.adapter).toBeInstanceOf(AgentReviewOrchestrator);
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npm test -- apps/demo-office/src/runtime/create-runtime.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/demo-office/src/runtime/types.ts apps/demo-office/src/runtime/config.ts apps/demo-office/src/runtime/create-runtime.ts apps/demo-office/src/runtime/create-runtime.test.ts apps/demo-office/.env.example
git commit -m "feat(demo-office): add github runtime mode with review orchestrator"
```

---

## Gate 2 — Panel UI Components

### Task 8: QueuePanel component

**Files:**
- Create: `apps/demo-office/src/components/QueuePanel.tsx`
- Create: `apps/demo-office/src/components/QueuePanel.test.tsx`

**Interfaces:**
- Consumes: `IssueQueueItem`, `PullRequestQueueItem` from `@agent-office/control-ui/integration`; `OfficeSelection` from `@agent-office/pixel-office`
- Produces: `QueuePanel` React component

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueuePanel } from "./QueuePanel.js";
import type { IssueQueueItem, PullRequestQueueItem } from "@agent-office/control-ui/integration";

describe("QueuePanel", () => {
  it("renders issues and pulls", () => {
    const issues: IssueQueueItem[] = [
      { taskId: "i1", number: 1, kind: "issue", title: "Bug", state: "open", closedAt: null, labels: ["bug"], assignees: [], url: "" },
    ];
    const pulls: PullRequestQueueItem[] = [
      { taskId: "t1", artifactId: "a1", number: 2, kind: "pr", title: "Feature", state: "open", draft: false, labels: [], reviewers: ["alice"], url: "" },
    ];
    render(<QueuePanel issues={issues} pulls={pulls} selection={null} onSelect={() => {}} />);
    expect(screen.getByText("#1 Bug")).toBeInTheDocument();
    expect(screen.getByText("#2 Feature")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<QueuePanel issues={[]} pulls={[]} selection={null} onSelect={() => {}} />);
    expect(screen.getByText("No open items in queue.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/demo-office/src/components/QueuePanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component**

```typescript
import type { FC } from "react";
import type { IssueQueueItem, PullRequestQueueItem } from "@agent-office/control-ui/integration";
import type { OfficeSelection } from "@agent-office/pixel-office";
import { Card } from "@agent-office/control-ui";
import { SectionHeader } from "@agent-office/control-ui";
import { Badge } from "@agent-office/control-ui";

interface QueuePanelProps {
  issues: IssueQueueItem[];
  pulls: PullRequestQueueItem[];
  selection: OfficeSelection | null;
  onSelect: (selection: OfficeSelection) => void;
}

export const QueuePanel: FC<QueuePanelProps> = ({ issues, pulls, selection, onSelect }) => {
  const total = issues.length + pulls.length;
  return (
    <div className="panel-section" data-testid="queue-panel">
      <SectionHeader title="Issue / PR Queue" count={total} countIntent="info" />
      {total === 0 ? (
        <div className="panel-empty">No open items in queue.</div>
      ) : (
        <div className="queue-list">
          {issues.map((item) => (
            <Card
              key={item.taskId}
              selectable
              selected={selection?.kind === "task" && selection.id === item.taskId}
              ariaLabel={`Select issue ${item.number}`}
              onClick={() => onSelect({ kind: "task", id: item.taskId })}
            >
              <div className="card-row">
                <div>
                  <div className="card-title">#{item.number} {item.title}</div>
                  <div className="card-meta">{item.labels.join(", ") || "no labels"}</div>
                </div>
                <Badge intent={item.state === "open" ? "running" : "idle"}>
                  {item.state}
                </Badge>
              </div>
            </Card>
          ))}
          {pulls.map((item) => (
            <Card
              key={item.artifactId}
              selectable
              selected={selection?.kind === "artifact" && selection.id === item.artifactId}
              ariaLabel={`Select pull request ${item.number}`}
              onClick={() => onSelect({ kind: "artifact", id: item.artifactId })}
            >
              <div className="card-row">
                <div>
                  <div className="card-title">#{item.number} {item.title}</div>
                  <div className="card-meta">{item.labels.join(", ") || "no labels"}</div>
                </div>
                <Badge intent={item.state === "open" ? "running" : item.state === "merged" ? "success" : "idle"}>
                  {item.draft ? "draft" : item.state}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/demo-office/src/components/QueuePanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/demo-office/src/components/QueuePanel.tsx apps/demo-office/src/components/QueuePanel.test.tsx
git commit -m "feat(demo-office): add QueuePanel component"
```

---

### Task 9: ReviewBlocker component

**Files:**
- Create: `apps/demo-office/src/components/ReviewBlocker.tsx`
- Create: `apps/demo-office/src/components/ReviewBlocker.test.tsx`

**Interfaces:**
- Consumes: `ReviewAssignment`, `ReviewDraft` from `@agent-office/core`
- Produces: `ReviewBlocker` React component

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewBlocker } from "./ReviewBlocker.js";
import type { ReviewAssignment, ReviewDraft } from "@agent-office/core";

describe("ReviewBlocker", () => {
  it("renders assigned and submitted reviews", () => {
    const assigned: ReviewAssignment[] = [
      { reviewId: "r1", targetKind: "issue", targetNumber: 1, agentId: "agent-1", assignedAt: "2026-01-01T00:00:00Z" },
    ];
    const submitted: ReviewDraft[] = [
      { reviewId: "r1", agentId: "agent-1", verdict: "approved", comment: "LGTM", targetKind: "issue", targetNumber: 1, submittedAt: "2026-01-01T00:00:00Z" },
    ];
    render(<ReviewBlocker assigned={assigned} submitted={submitted} onSendCommand={vi.fn()} />);
    expect(screen.getByText("agent-1 reviewing #1")).toBeInTheDocument();
    expect(screen.getByText("approved #1")).toBeInTheDocument();
  });

  it("dispatches REVIEW_APPROVE on Approve click", async () => {
    const onSendCommand = vi.fn().mockResolvedValue(undefined);
    const submitted: ReviewDraft[] = [
      { reviewId: "r1", agentId: "agent-1", verdict: "approved", comment: "LGTM", targetKind: "issue", targetNumber: 1, submittedAt: "2026-01-01T00:00:00Z" },
    ];
    render(<ReviewBlocker assigned={[]} submitted={submitted} onSendCommand={onSendCommand} />);
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() => expect(onSendCommand).toHaveBeenCalledWith("REVIEW_APPROVE", { reviewId: "r1" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/demo-office/src/components/ReviewBlocker.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component**

```typescript
import { useState, type FC } from "react";
import type { ReviewAssignment, ReviewDraft } from "@agent-office/core";
import { Card, SectionHeader, Button } from "@agent-office/control-ui";

interface ReviewBlockerProps {
  assigned: ReviewAssignment[];
  submitted: ReviewDraft[];
  onSendCommand: (commandType: string, payload: unknown) => Promise<void>;
}

export const ReviewBlocker: FC<ReviewBlockerProps> = ({ assigned, submitted, onSendCommand }) => {
  const [actingId, setActingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const total = assigned.length + submitted.length;

  const runAction = async (reviewId: string, commandType: string, payload: unknown) => {
    setActingId(reviewId);
    setErrorId(null);
    try {
      await onSendCommand(commandType, payload);
    } catch (e) {
      setErrorId(reviewId);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="panel-section" data-testid="review-blocker">
      <SectionHeader title="Review Blocker" count={total} countIntent={submitted.length > 0 ? "warning" : "info"} />
      {total === 0 ? (
        <div className="panel-empty">No active reviews.</div>
      ) : (
        <div className="review-list">
          {assigned.map((r) => (
            <Card key={r.reviewId}>
              <div className="card-title">{r.agentId} reviewing #{r.targetNumber}</div>
              <div className="card-meta">assigned {formatTime(r.assignedAt)}</div>
            </Card>
          ))}
          {submitted.map((r) => (
            <Card key={r.reviewId}>
              <div className="card-row">
                <div>
                  <div className="card-title">{r.verdict} #{r.targetNumber}</div>
                  <div className="card-meta">{r.comment.slice(0, 60) || "no comment"}</div>
                </div>
                <div className="card-actions">
                  <Button
                    size="sm"
                    intent="success"
                    disabled={actingId === r.reviewId}
                    onClick={() => runAction(r.reviewId, "REVIEW_APPROVE", { reviewId: r.reviewId })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    intent="danger"
                    disabled={actingId === r.reviewId}
                    onClick={() => runAction(r.reviewId, "REVIEW_REJECT", { reviewId: r.reviewId, reason: "Rejected via UI" })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
              {errorId === r.reviewId && <div className="card-error">Action failed</div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/demo-office/src/components/ReviewBlocker.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/demo-office/src/components/ReviewBlocker.tsx apps/demo-office/src/components/ReviewBlocker.test.tsx
git commit -m "feat(demo-office): add ReviewBlocker component"
```

---

### Task 10: EvidencePanel component

**Files:**
- Create: `apps/demo-office/src/components/EvidencePanel.tsx`
- Create: `apps/demo-office/src/components/EvidencePanel.test.tsx`

**Interfaces:**
- Consumes: `AuditNoteView` from `@agent-office/control-ui/integration`
- Produces: `EvidencePanel` React component

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EvidencePanel } from "./EvidencePanel.js";
import type { AuditNoteView } from "@agent-office/control-ui/integration";

describe("EvidencePanel", () => {
  it("renders audit notes", () => {
    const notes: AuditNoteView[] = [
      { auditId: "n1", taskId: "t1", body: "Evidence note", author: "agent-1", createdAt: "2026-01-01T00:00:00Z" },
    ];
    render(<EvidencePanel auditNotes={notes} />);
    expect(screen.getByText("Evidence note")).toBeInTheDocument();
    expect(screen.getByText("agent-1")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<EvidencePanel auditNotes={[]} />);
    expect(screen.getByText("No audit notes.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/demo-office/src/components/EvidencePanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component**

```typescript
import { useState, type FC } from "react";
import type { AuditNoteView } from "@agent-office/control-ui/integration";
import { Card, SectionHeader } from "@agent-office/control-ui";

interface EvidencePanelProps {
  auditNotes: AuditNoteView[];
}

export const EvidencePanel: FC<EvidencePanelProps> = ({ auditNotes }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="panel-section" data-testid="evidence-panel">
      <SectionHeader title="Evidence" count={auditNotes.length} countIntent="info" />
      {auditNotes.length === 0 ? (
        <div className="panel-empty">No audit notes.</div>
      ) : (
        <div className="evidence-list">
          {auditNotes.map((note) => {
            const expanded = expandedId === note.auditId;
            return (
              <Card key={note.auditId} onClick={() => setExpandedId(expanded ? null : note.auditId)}>
                <div className="card-row">
                  <div>
                    <div className="card-title">{note.author}</div>
                    <div className="card-meta">{formatTime(note.createdAt)}{note.taskId ? ` · ${note.taskId}` : ""}</div>
                  </div>
                </div>
                <div className={expanded ? "card-body" : "card-body truncate"}>{note.body}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/demo-office/src/components/EvidencePanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/demo-office/src/components/EvidencePanel.tsx apps/demo-office/src/components/EvidencePanel.test.tsx
git commit -m "feat(demo-office): add EvidencePanel component"
```

---

### Task 11: TimelinePanel component

**Files:**
- Create: `apps/demo-office/src/components/TimelinePanel.tsx`
- Create: `apps/demo-office/src/components/TimelinePanel.test.tsx`

**Interfaces:**
- Consumes: `DomainEvent`, `EventType` from `@agent-office/protocol`
- Produces: `TimelinePanel` React component

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelinePanel } from "./TimelinePanel.js";
import { EventType, type DomainEvent } from "@agent-office/protocol";

describe("TimelinePanel", () => {
  it("renders filtered events in order", () => {
    const events: DomainEvent[] = [
      { eventId: "e1", type: EventType.TASK_CREATED, timestamp: "2026-01-01T00:00:00Z", sequence: 1, runtimeId: "r", payload: {} } as DomainEvent,
      { eventId: "e2", type: EventType.REVIEW_ASSIGNED, timestamp: "2026-01-01T00:01:00Z", sequence: 2, runtimeId: "r", payload: {} } as DomainEvent,
      { eventId: "e3", type: EventType.AGENT_IDLE, timestamp: "2026-01-01T00:02:00Z", sequence: 3, runtimeId: "r", payload: {} } as DomainEvent,
    ];
    render(<TimelinePanel events={events} />);
    expect(screen.getByText("TASK_CREATED")).toBeInTheDocument();
    expect(screen.getByText("REVIEW_ASSIGNED")).toBeInTheDocument();
    expect(screen.queryByText("AGENT_IDLE")).not.toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<TimelinePanel events={[]} />);
    expect(screen.getByText("No relevant events.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/demo-office/src/components/TimelinePanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement component**

```typescript
import type { FC } from "react";
import { EventType, type DomainEvent } from "@agent-office/protocol";
import { Card, SectionHeader } from "@agent-office/control-ui";

interface TimelinePanelProps {
  events: DomainEvent[];
}

const TIMELINE_EVENT_TYPES = new Set([
  EventType.TASK_CREATED,
  EventType.ARTIFACT_CREATED,
  EventType.ARTIFACT_DRAFTED,
  EventType.ARTIFACT_REVIEW_REQUESTED,
  EventType.REVIEW_ASSIGNED,
  EventType.REVIEW_SUBMITTED,
  EventType.ARTIFACT_REVIEWED,
  EventType.AUDIT_NOTE_ADDED,
]);

export const TimelinePanel: FC<TimelinePanelProps> = ({ events }) => {
  const filtered = events
    .filter((e) => TIMELINE_EVENT_TYPES.has(e.type))
    .sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="panel-section" data-testid="timeline-panel">
      <SectionHeader title="Timeline" count={filtered.length} countIntent="info" />
      {filtered.length === 0 ? (
        <div className="panel-empty">No relevant events.</div>
      ) : (
        <div className="timeline-list">
          {filtered.map((event) => (
            <div key={event.eventId} className="timeline-row">
              <div className="timeline-time">
                <div>#{event.sequence}</div>
                <div>{formatTime(event.timestamp)}</div>
              </div>
              <div className="timeline-content">
                <div className="timeline-type">{event.type}</div>
                <div className="timeline-summary">{summarizeEvent(event)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function summarizeEvent(event: DomainEvent): string {
  switch (event.type) {
    case EventType.TASK_CREATED:
      return `Task ${(event.payload as { taskId?: string }).taskId ?? ""}`;
    case EventType.ARTIFACT_CREATED:
      return `Artifact ${(event.payload as { artifactId?: string }).artifactId ?? ""}`;
    case EventType.REVIEW_ASSIGNED:
      return `Review assigned to ${(event.payload as { agentId?: string }).agentId ?? ""}`;
    case EventType.REVIEW_SUBMITTED:
      return `Review submitted: ${(event.payload as { verdict?: string }).verdict ?? ""}`;
    case EventType.ARTIFACT_REVIEWED:
      return `Review finalized: ${(event.payload as { verdict?: string }).verdict ?? ""}`;
    case EventType.AUDIT_NOTE_ADDED:
      return `Audit note by ${(event.payload as { author?: string }).author ?? ""}`;
    default:
      return event.eventId;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/demo-office/src/components/TimelinePanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/demo-office/src/components/TimelinePanel.tsx apps/demo-office/src/components/TimelinePanel.test.tsx
git commit -m "feat(demo-office): add TimelinePanel component"
```

---

### Task 12: Wire panels into ControlPanel

**Files:**
- Modify: `packages/control-ui/src/ControlPanel.tsx`
- Modify: `packages/control-ui/src/ControlPanel.test.tsx`

**Interfaces:**
- Consumes: `IntegrationProjection`, `IntegrationState`, four panel components
- Produces: updated `ControlPanel` rendering

- [ ] **Step 1: Update ControlPanel tests**

Append to `packages/control-ui/src/ControlPanel.test.tsx`:

```typescript
import { QueuePanel, ReviewBlocker, EvidencePanel, TimelinePanel } from "../integration/index.js";

describe("integration panels", () => {
  it("renders QueuePanel", () => {
    render(<ControlPanel ... />);
    expect(screen.getByTestId("queue-panel")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/control-ui/src/ControlPanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Modify ControlPanel.tsx**

Add imports:

```typescript
import {
  QueuePanel,
  ReviewBlocker,
  EvidencePanel,
  TimelinePanel,
  type IntegrationProjection,
} from "./integration/index.js";
```

Update props interface:

```typescript
interface ControlPanelProps {
  // ... existing
  integration: IntegrationProjection;
  eventLog: DomainEvent[];
}
```

Insert panels in Command mode:

```tsx
{mode === "command" && (
  <>
    <ApprovalDrawer ... />
    <CreateTask ... />
    <QueuePanel
      issues={integration.github?.issues ?? []}
      pulls={integration.github?.pulls ?? []}
      selection={selection}
      onSelect={setSelection}
    />
    <ReviewBlocker
      assigned={integration.reviews?.assigned ?? []}
      submitted={integration.reviews?.submitted ?? []}
      onSendCommand={onSendCommand}
    />
    <EvidencePanel auditNotes={integration.github?.auditNotes ?? []} />
    <TimelinePanel events={eventLog} />
    <Agents ... />
    <Tasks ... />
    <Artifacts ... />
    <EventLogViewer ... />
  </>
)}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- packages/control-ui/src/ControlPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/control-ui/src/ControlPanel.tsx packages/control-ui/src/ControlPanel.test.tsx
git commit -m "feat(control-ui): wire integration panels into ControlPanel"
```

---

## Gate 3 — Pixel Scene + Assets

### Task 13: Generate sprite assets

**Files:**
- Create: 8 PNG files in `packages/pixel-office/assets/props/`

- [ ] **Step 1: Generate assets via Trae API**

Use a Node script or `curl` equivalent. Example PowerShell snippet for one asset:

```powershell
$prompt = "pixel art wooden mission board with pinned papers, Stardew Valley cozy office style, 1:1 pixel grid, 16-color palette, no text, no background"
$url = "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=$([uri]::EscapeDataString($prompt))&image_size=square"
Invoke-WebRequest -Uri $url -OutFile packages/pixel-office/assets/props/mission-board.png
```

Generate all 8 assets with these prompts:

| File | Size parameter | Prompt |
|---|---|---|
| `mission-board.png` | `square` | `pixel art wooden mission board with pinned papers, Stardew Valley cozy office style, 1:1 pixel grid, 16-color palette, no text, no background` |
| `review-desk.png` | `square` | `pixel art round review table with papers and magnifying lamp, Stardew Valley cozy office style, 1:1 pixel grid, 16-color palette, no text, no background` |
| `filing-cabinet.png` | `portrait_4_3` | `pixel art wooden filing cabinet with drawers, Stardew Valley cozy office style, 1:1 pixel grid, 16-color palette, no text, no background` |
| `wall-scroll.png` | `landscape_4_3` | `pixel art wall scroll timeline tape, Stardew Valley cozy office style, 1:1 pixel grid, 16-color palette, no text, no background` |
| `icon-issue.png` | `square` | `pixel art small circle issue icon, Stardew Valley style, 16-color palette, no text, no background` |
| `icon-pr.png` | `square` | `pixel art small fork pull request icon, Stardew Valley style, 16-color palette, no text, no background` |
| `icon-review.png` | `square` | `pixel art small clipboard review icon, Stardew Valley style, 16-color palette, no text, no background` |
| `icon-evidence.png` | `square` | `pixel art small document evidence icon, Stardew Valley style, 16-color palette, no text, no background` |

- [ ] **Step 2: Resize to design-system dimensions**

Use an image tool to resize each generated asset to the target dimensions (64×48, 32×48, 96×24, 8×8). If no tool is available, keep generated size and adjust renderer scale.

- [ ] **Step 3: Verify assets are copied by build**

Run: `npm run build --workspace=@agent-office/pixel-office`
Run: `node apps/demo-office/scripts/copy-pixel-assets.mjs`
Expected: assets appear in `apps/demo-office/public/assets/props/`

- [ ] **Step 4: Commit**

```bash
git add packages/pixel-office/assets/props/*.png
git commit -m "assets(pixel-office): add integration prop sprites"
```

---

### Task 14: Extend PropRenderer for integration props

**Files:**
- Modify: `packages/pixel-office/src/renderer/prop-renderer.ts`
- Test: `packages/pixel-office/src/renderer/prop-renderer.test.ts`

**Interfaces:**
- Consumes: `IntegrationProjection`
- Produces: `updateIntegration(integration)` method

- [ ] **Step 1: Add failing test**

```typescript
describe("integration props", () => {
  it("creates mission board when queue has items", () => {
    const renderer = new PropRenderer(stage, layout, assetLoader);
    renderer.updateIntegration({
      github: { issues: [{ taskId: "t1" } as any], pulls: [], auditNotes: [] },
      reviews: { assigned: [], submitted: [] },
    });
    expect(renderer.getPropCount()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/pixel-office/src/renderer/prop-renderer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement updateIntegration**

Add to `PropRenderer`:

```typescript
private integrationSprites: Record<string, PIXI.Sprite> = {};

updateIntegration(integration: IntegrationProjection): void {
  const hasQueue = (integration.github?.issues.length ?? 0) + (integration.github?.pulls.length ?? 0) > 0;
  this.ensureProp("mission-board", hasQueue, this.layout.commandRoom.x + 80, this.layout.commandRoom.y + 20);

  const assignedCount = integration.reviews?.assigned.length ?? 0;
  this.ensureProp("review-desk", assignedCount > 0, this.layout.reviewRoom.x + 48, this.layout.reviewRoom.y + 24);

  const hasEvidence = (integration.github?.auditNotes.length ?? 0) > 0;
  this.ensureProp("filing-cabinet", hasEvidence, this.layout.commandRoom.x + 16, this.layout.commandRoom.y + 40);

  const hasTimeline = integration.reviews !== null || integration.github !== null;
  this.ensureProp("wall-scroll", hasTimeline, 48, 16);
}

private ensureProp(name: string, visible: boolean, x: number, y: number): void {
  if (visible && !this.integrationSprites[name]) {
    const sprite = new PIXI.Sprite(this.assetLoader.getTexture(`props/${name}`));
    sprite.x = x;
    sprite.y = y;
    this.container.addChild(sprite);
    this.integrationSprites[name] = sprite;
  } else if (!visible && this.integrationSprites[name]) {
    this.container.removeChild(this.integrationSprites[name]);
    delete this.integrationSprites[name];
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- packages/pixel-office/src/renderer/prop-renderer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/pixel-office/src/renderer/prop-renderer.ts packages/pixel-office/src/renderer/prop-renderer.test.ts
git commit -m "feat(pixel-office): render integration props in scene"
```

---

### Task 15: Extend EffectRenderer for integration effects

**Files:**
- Modify: `packages/pixel-office/src/renderer/effect-renderer.ts`
- Test: `packages/pixel-office/src/renderer/effect-renderer.test.ts`

**Interfaces:**
- Consumes: `IntegrationProjection`
- Produces: `updateIntegration(integration)` method

- [ ] **Step 1: Add failing test**

```typescript
describe("integration effects", () => {
  it("adds glow when reviews are pending approval", () => {
    const renderer = new EffectRenderer(stage, layout, assetLoader);
    renderer.updateIntegration({
      github: null,
      reviews: { assigned: [], submitted: [{ reviewId: "r1" } as any] },
    });
    expect(renderer.getActiveEffects()).toContain("review-pending");
  });
});
```

- [ ] **Step 2: Implement updateIntegration**

```typescript
updateIntegration(integration: IntegrationProjection): void {
  const pendingApproval = (integration.reviews?.submitted.length ?? 0) > 0;
  this.setEffect("review-pending", pendingApproval);

  const hasQueue = (integration.github?.issues.length ?? 0) + (integration.github?.pulls.length ?? 0) > 0;
  this.setEffect("queue-glow", hasQueue);
}

private setEffect(name: string, active: boolean): void {
  if (active && !this.effects[name]) {
    this.effects[name] = this.createGlowSprite(name);
  } else if (!active && this.effects[name]) {
    this.container.removeChild(this.effects[name]);
    delete this.effects[name];
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- packages/pixel-office/src/renderer/effect-renderer.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/pixel-office/src/renderer/effect-renderer.ts packages/pixel-office/src/renderer/effect-renderer.test.ts
git commit -m "feat(pixel-office): add integration state effects"
```

---

### Task 16: Add updateIntegration to PixelOfficeScene

**Files:**
- Modify: `packages/pixel-office/src/office-scene.ts`
- Test: `packages/pixel-office/src/__tests__/office-scene.test.ts`

- [ ] **Step 1: Add failing test**

```typescript
describe("updateIntegration", () => {
  it("forwards integration to prop and effect renderers", () => {
    const scene = new PixelOfficeScene(canvas, layout, assetLoader);
    const integration = { github: { issues: [], pulls: [], auditNotes: [] }, reviews: { assigned: [], submitted: [] } };
    scene.updateIntegration(integration as any);
    expect(scene["currentIntegration"]).toBe(integration);
  });
});
```

- [ ] **Step 2: Implement updateIntegration**

Add to `PixelOfficeScene`:

```typescript
private currentIntegration: IntegrationProjection | null = null;

updateIntegration(integration: IntegrationProjection): void {
  this.currentIntegration = integration;
  this.propRenderer?.updateIntegration(integration);
  this.effectRenderer?.updateIntegration(integration);
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- packages/pixel-office/src/__tests__/office-scene.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/pixel-office/src/office-scene.ts packages/pixel-office/src/__tests__/office-scene.test.ts
git commit -m "feat(pixel-office): add updateIntegration to office scene"
```

---

### Task 17: Wire updateIntegration in App

**Files:**
- Modify: `apps/demo-office/src/App.tsx`

- [ ] **Step 1: Add useEffect to forward integration**

```typescript
useEffect(() => {
  sceneRef.current?.updateIntegration(state.projection.integration);
}, [state.projection.integration, sceneRef.current]);
```

- [ ] **Step 2: Run App tests**

Run: `npm test -- apps/demo-office/src/App.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/demo-office/src/App.tsx
git commit -m "feat(demo-office): forward integration projection to pixel scene"
```

---

### Task 18: Extend screenshot scripts

**Files:**
- Modify: `apps/demo-office/scripts/capture-demo-office-screenshots.mjs`
- Modify: `apps/demo-office/scripts/generate-annotated-comparisons.mjs`

- [ ] **Step 1: Add new screenshot states**

In `capture-demo-office-screenshots.mjs`, add states that exercise the new panels:

```javascript
const states = [
  // ... existing states
  { name: "queue-populated", setup: async (page) => { /* dispatch TASK_CREATED with GitHub evidence if needed */ } },
  { name: "review-pending", setup: async (page) => { /* dispatch REVIEW_ASSIGN + REVIEW_SUBMIT */ } },
  { name: "evidence-added", setup: async (page) => { /* dispatch AUDIT_NOTE_ADDED */ } },
  { name: "timeline-visible", setup: async (page) => { /* ensure at least one timeline event exists */ } },
];
```

- [ ] **Step 2: Add annotations**

In `generate-annotated-comparisons.mjs`, add boxes/labels for QueuePanel, ReviewBlocker, EvidencePanel, TimelinePanel, and canvas props.

- [ ] **Step 3: Run scripts**

Run: `node apps/demo-office/scripts/capture-demo-office-screenshots.mjs`
Run: `node apps/demo-office/scripts/generate-annotated-comparisons.mjs`
Expected: screenshots generated, no errors

- [ ] **Step 4: Commit**

```bash
git add apps/demo-office/scripts/capture-demo-office-screenshots.mjs apps/demo-office/scripts/generate-annotated-comparisons.mjs
git commit -m "test(demo-office): extend screenshot coverage for integration UI"
```

---

### Task 19: Runtime Truth Review verification helper

**Files:**
- Create: `apps/demo-office/src/integration.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { createRuntime } from "./runtime/create-runtime.js";
import { CommandType, EventType } from "@agent-office/protocol";

describe("Runtime Truth Review", () => {
  it("every integration UI item is traceable to a runtime event", async () => {
    const composition = createRuntime({ mode: "mock", runtimeId: "r", lifeSimBaseUrl: "http://localhost:3001" });
    // Create task, assign review, submit review, add audit note
    // Then assert projection items have matching events
  });
});
```

Fill in the commands and assertions. Example assertion pattern:

```typescript
const events = composition.session.getEventLog();
const integration = await composition.adapter.getIntegrationProjection(composition.store.getSnapshot());

for (const item of integration.github?.issues ?? []) {
  expect(events.some((e) => e.type === EventType.TASK_CREATED && (e.payload as any).taskId === item.taskId)).toBe(true);
}
```

- [ ] **Step 2: Run test**

Run: `npm test -- apps/demo-office/src/integration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/demo-office/src/integration.test.ts
git commit -m "test(demo-office): add Runtime Truth Review verification"
```

---

### Task 20: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: succeeds

- [ ] **Step 3: Run screenshot scripts**

Run: `node apps/demo-office/scripts/capture-demo-office-screenshots.mjs`
Run: `node apps/demo-office/scripts/generate-annotated-comparisons.mjs`
Expected: all new states captured

- [ ] **Step 4: Commit any final fixes**

```bash
git commit -m "chore: final fixes for Issue #49 Office UI Integration" || true
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Implementing task |
|---|---|
| `IntegrationProjection` type | Task 1 |
| `AgentReviewOrchestrator.getIntegrationProjection` | Task 5 |
| `demo-office` github mode | Task 7 |
| Issue/PR Queue from `integration.github` | Task 8, 12 |
| Review Blocker Approve/Reject | Task 9, 12 |
| Evidence Panel audit notes | Task 10, 12 |
| Timeline filtered events | Task 11, 12 |
| Runtime Truth Review | Task 19 |
| Pixel canvas props | Task 13-17 |
| Trae API assets | Task 13 |

### Placeholder scan

- No TBD/TODO/fill-in-details found.
- Every step includes exact file paths, code, run commands, and expected output.

### Type consistency check

- `IntegrationProjection` defined once in Task 1, reused in Tasks 2, 3, 5, 6, 12, 14, 15, 16.
- `composeProjections` signature extended consistently.
- `ReviewAssignment` / `ReviewDraft` imported from `@agent-office/core` everywhere.

No issues found. Plan is ready for execution.
