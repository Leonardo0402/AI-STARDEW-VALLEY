# Issue #49 — Phase 2.7: Office UI Integration — Design Spec

> **Status:** Approved (all design sections reviewed and confirmed by user)
> **Date:** 2026-07-13
> **Branch:** `feat/github-office-ui-integration-issue-49`
> **Refs:** #47 (Agent Review Loop), #45 (Safe GitHub Actions), #43 (Command Gateway), #41 (Incremental Sync), #39 (Real API Source), #34 (GitHub Runtime Adapter v0)

## Context

Phase 2.6 completed the Agent Review Loop: `AgentReviewOrchestrator`, 5 review commands, adapter handlers, `ReviewStrategy` interface, and 851/851 tests passing. Phase 2.7 builds the Office UI layer on top of that backend infrastructure, connecting GitHub adapter data and review state into the pixel-art office visualization.

Current baseline:
- `GitHubRuntimeAdapter` supports read sync + 12 safe write commands (including review commands)
- `AgentReviewOrchestrator` manages review lifecycle (assign → submit → approve/reject)
- `OfficeProjection` exposes agents / tasks / artifacts / approvals / rooms
- `demo-office` has a two-pane layout: left Pixel canvas / right `ControlPanel`
- 851/851 tests passing
- Pixel-art style established (Direction 1: Cozy Pixel Operations Room)

## Goal

Build Office UI Integration that visualizes Issue/PR Queue, Review Blocker, Evidence, and Timeline as pixel-art office interface components. All UI data must come from Runtime Event → Snapshot / IntegrationProjection projection (Runtime Truth Review). No external API calls from the UI, no fabricated data.

## Delivery Strategy

This spec uses **three Readiness Gates inside Issue #49**. Each gate merges independently after verification, reducing risk on RTX 3050 hardware and matching the project's phased delivery preference.

| Gate | Focus | Merge Criteria |
|---|---|---|
| Gate 1 — Data Layer | `IntegrationProjection` + runtime mode + hook | Type tests + unit tests + CI pass |
| Gate 2 — Panel UI | Queue / Review Blocker / Evidence / Timeline cards | Component tests + interaction tests pass |
| Gate 3 — Pixel Scene + Assets | Canvas extensions + Trae-generated sprites | Screenshot scripts pass + visual QA |

## §1 — Architecture & Data Flow

### 1.1 IntegrationProjection as a peer projection

`IntegrationProjection` lives in `packages/control-ui/src/integration/` and is composed into `ComposedOfficeState` alongside `OfficeProjection` and `LifeSimProjection`.

```
RuntimeAdapter (GitHubRuntimeAdapter wrapped by AgentReviewOrchestrator)
  │ emits DomainEvent
  ▼
SnapshotStore ──subscribe──► useOfficeState ──► OfficeProjection
  │
  └── adapter also implements IntegrationProjectionProvider
        │
        └── getIntegrationProjection(snapshot) ──► useIntegrationState ──► IntegrationProjection
```

### 1.2 Type boundaries

```typescript
// packages/control-ui/src/integration/types.ts
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

### 1.3 IntegrationProjectionProvider interface

```typescript
// packages/control-ui/src/integration/projection.ts
export interface IntegrationProjectionProvider {
  getIntegrationProjection(snapshot: RuntimeSnapshot): IntegrationProjection;
}
```

`AgentReviewOrchestrator` implements `RuntimeAdapter & IntegrationProjectionProvider`:

```typescript
getIntegrationProjection(snapshot: RuntimeSnapshot): IntegrationProjection {
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

### 1.4 Hook: useIntegrationState

```typescript
// packages/control-ui/src/integration/useIntegrationState.ts
export function useIntegrationState(
  adapter: RuntimeAdapter,
  store: SnapshotStore
): IntegrationState {
  const [projection, setProjection] = useState<IntegrationProjection>(() =>
    projectIntegration(adapter, store.getSnapshot())
  );

  useEffect(() => {
    return store.subscribe((snap) => {
      setProjection(projectIntegration(adapter, snap));
    });
  }, [adapter, store]);

  return { projection };
}
```

`projectIntegration` checks whether `adapter` implements `IntegrationProjectionProvider`; if not, returns an empty projection. This keeps the UI working with `mock` and `http-sse` modes.

### 1.5 ComposedOfficeState extension

```typescript
export interface ComposedOfficeState extends OfficeState {
  projection: ComposedOfficeProjection;
  integration: IntegrationState;
  lifeSim: UseLifeSimStateResult;
  sendLifeSimCommand(...): Promise<void>;
}
```

`composeProjections` is extended to accept `IntegrationProjection` or is chained:

```typescript
const projection = useMemo(
  () => composeProjections(office.projection, lifeSim.projection, integration.projection),
  [office.projection, lifeSim.projection, integration.projection]
);
```

### 1.6 Runtime mode: github

`apps/demo-office/src/runtime/create-runtime.ts` adds a `github` mode:

```typescript
case "github": {
  const gh = new GitHubRuntimeAdapter({
    apiClient: config.githubApiClient,
    owner: config.githubOwner,
    repo: config.githubRepo,
    policy: config.githubPolicy,
  });
  return new AgentReviewOrchestrator(gh, {
    strategy: new RuleBasedReviewStrategy(),
  });
}
```

Default mode remains `mock`. The `github` mode requires new optional config fields in `DemoRuntimeConfig` and `.env.example`.

## §2 — Panel UI Components

All four modules live as cards inside `ControlPanel` in Command mode, placed after `ApprovalDrawer` / `Create Task` and before the existing `Agents` section.

```tsx
{mode === "command" && (
  <>
    <ApprovalDrawer />
    <CreateTask />
    <QueuePanel ... />
    <ReviewBlocker ... />
    <EvidencePanel ... />
    <TimelinePanel ... />
    <Agents ... />
    <Tasks ... />
    <Artifacts ... />
    <EventLogViewer ... />
  </>
)}
```

### 2.1 QueuePanel

Displays open and closed Issues and PRs from `integration.github`.

```typescript
interface QueuePanelProps {
  issues: IssueQueueItem[];
  pulls: PullRequestQueueItem[];
  selection: OfficeSelection | null;
  onSelect: (selection: OfficeSelection) => void;
}
```

Each row shows:
- Kind icon (`issue` circle / `pr` fork)
- `#number`
- Title
- State badge (`open` / `closed` / `merged` / `draft`)
- Up to 3 label chips
- Assignees / reviewers as text list

Clicking a row selects the matching task or artifact, which synchronizes with the Pixel canvas.

Empty state: "No open items in queue."

### 2.2 ReviewBlocker

Displays review lifecycle state from `integration.reviews`.

```typescript
interface ReviewBlockerProps {
  assigned: ReviewAssignment[];
  submitted: ReviewDraft[];
  onSendCommand: (commandType: string, payload: unknown) => Promise<void>;
}
```

Two collapsible sections:

**Assigned — Agent reviewing**
- `#{targetNumber}` · `{agentId}` · `reviewing`
- Read-only status

**Submitted — Waiting human approval**
- `#{targetNumber}` · `{verdict}` · `{agentId}`
- Comment summary
- `Approve` → `REVIEW_APPROVE { reviewId }`
- `Reject` → `REVIEW_REJECT { reviewId, reason }`

Empty state: "No active reviews."

### 2.3 EvidencePanel

Displays audit notes from `integration.github.auditNotes`.

```typescript
interface EvidencePanelProps {
  auditNotes: AuditNoteView[];
}
```

Each note shows:
- Timestamp (`formatTime`)
- Author
- Body (single-line truncation; expand on click for full text)
- Linked task ID if present

Empty state: "No audit notes."

### 2.4 TimelinePanel

A filtered, chronological view of `eventLog` focused on GitHub/review events.

```typescript
interface TimelinePanelProps {
  events: DomainEvent[];
}
```

Filtered event types:
- `TASK_CREATED`
- `ARTIFACT_CREATED`
- `ARTIFACT_DRAFTED`
- `ARTIFACT_REVIEW_REQUESTED`
- `REVIEW_ASSIGNED`
- `REVIEW_SUBMITTED`
- `ARTIFACT_REVIEWED`
- `AUDIT_NOTE_ADDED`

Rendered as a vertical timeline: time + sequence on the left, event type + summary on the right.

Empty state: "No relevant events."

## §3 — Pixel Scene Extensions

`PixelOfficeScene` gains a new method:

```typescript
updateIntegration(integration: IntegrationProjection): void
```

This method is purely decorative and does not modify `OfficeProjection` truth state.

### 3.1 Scene mapping

| UI Module | Canvas Element | State Feedback |
|---|---|---|
| Queue | **Mission Board** in Command Room | Shows open issue/PR count; glows when queue non-empty |
| Review Blocker | **Review Desk** in Review Room | File stack height reflects `assigned` count; Reviewer agent faces Approval Room when `submitted > 0` |
| Evidence | **Filing Cabinet** in Command Room corner | Indicator blinks once when a new audit note arrives |
| Timeline | **Wall Scroll** above rooms | Decorative scroll showing the most recent event icon |

### 3.2 New sprite assets

All assets are generated via the Trae image API and placed in `packages/pixel-office/assets/props/`.

| Asset | Size | Prompt direction |
|---|---|---|
| `mission-board.png` | 64×48 | Pixel art wooden mission board with pinned papers, Stardew Valley cozy office style |
| `review-desk.png` | 64×48 | Pixel art round review table with papers and magnifying lamp |
| `filing-cabinet.png` | 32×48 | Pixel art wooden filing cabinet with drawers |
| `wall-scroll.png` | 96×24 | Pixel art wall scroll / timeline tape |
| `icon-issue.png` | 8×8 | Small pixel issue circle icon |
| `icon-pr.png` | 8×8 | Small pixel PR fork icon |
| `icon-review.png` | 8×8 | Small pixel review clipboard icon |
| `icon-evidence.png` | 8×8 | Small pixel document icon |

Endpoint:

```
https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt={url-encoded-prompt}&image_size={size}
```

`copy-pixel-assets.mjs` already copies `packages/pixel-office/assets` into `demo-office/public/assets` at build time; new assets are picked up automatically.

### 3.3 Renderer responsibilities

- `PropRenderer` creates/destroys Mission Board, Review Desk, Filing Cabinet, and Wall Scroll sprites based on integration counts.
- `EffectRenderer` adds glow/pulse overlays tied to integration state changes.
- `AgentRenderer` already supports Reviewer role; it uses integration state to orient the Reviewer toward the Approval Room when reviews are pending human approval.

## §4 — Testing Strategy

### 4.1 Unit tests

| Target | Location | Coverage |
|---|---|---|
| `projectIntegration` | `packages/control-ui/src/integration/projection.test.ts` | Empty adapter, GitHub adapter, orchestrator wrapper, evidence mapping, review state mapping |
| `useIntegrationState` | `packages/control-ui/src/integration/useIntegrationState.test.tsx` | Initial render, store subscription update, unmount cleanup |
| `QueuePanel` | `apps/demo-office/src/components/QueuePanel.test.tsx` | Render issues/PRs, empty state, selection callback |
| `ReviewBlocker` | `apps/demo-office/src/components/ReviewBlocker.test.tsx` | Assigned/submitted sections, Approve/Reject command dispatch, error display |
| `EvidencePanel` | `apps/demo-office/src/components/EvidencePanel.test.tsx` | Render notes, truncation expand, empty state |
| `TimelinePanel` | `apps/demo-office/src/components/TimelinePanel.test.tsx` | Filter event types, chronological order, empty state |

### 4.2 Integration tests

| Target | Location | Coverage |
|---|---|---|
| `create-runtime` github mode | `apps/demo-office/src/runtime/create-runtime.test.ts` | `mode: "github"` returns `AgentReviewOrchestrator`; default remains `mock` |
| End-to-end review flow | `apps/demo-office/src/integration.test.ts` | REVIEW_ASSIGN → REVIEW_SUBMIT → REVIEW_APPROVE reflected in IntegrationProjection and UI |
| Pixel scene integration | `packages/pixel-office/src/__tests__/office-scene.test.ts` | `updateIntegration` triggers prop/effect renderer updates |

### 4.3 Runtime Truth Review verification

A new test helper `verifyRuntimeTruth(projection, integration, eventLog)` asserts that every rendered UI item can be traced back to a Runtime Event or Snapshot entry:

- Each `IssueQueueItem` / `PullRequestQueueItem` has a matching `TASK_CREATED` or `ARTIFACT_CREATED` event.
- Each assigned review has a matching `REVIEW_ASSIGNED` event.
- Each submitted review has a matching `REVIEW_SUBMITTED` event.
- Each audit note has a matching `AUDIT_NOTE_ADDED` event.
- No UI item exists without a runtime source.

### 4.4 Visual regression

- Extend `capture-demo-office-screenshots.mjs` with states: `queue-populated`, `review-pending`, `evidence-added`, `timeline-visible`.
- Extend `generate-annotated-comparisons.mjs` to annotate the new panels and canvas props.

## §5 — Error Handling

| Scenario | Behavior |
|---|---|
| GitHub mode without API config | Network commands return `UNSUPPORTED_COMMAND`; local review commands still work. UI shows "GitHub API not configured" inline in QueuePanel. |
| Review command rejected | `ReviewBlocker` catches error via `runAction` pattern and displays inline action error below the row. |
| Empty integration projection | All four panels show friendly empty states; Pixel scene hides optional props. |
| Unknown adapter | `projectIntegration` returns empty projection; UI degrades gracefully. |
| Reducer errors | Continue through existing `useOfficeState` error path; errors appear in global error list. |

## §6 — Acceptance Criteria

- [ ] `IntegrationProjection` type defined and composed into `ComposedOfficeState`
- [ ] `AgentReviewOrchestrator` exposes `getIntegrationProjection`
- [ ] `demo-office` supports `mode: "github"` in `create-runtime`, default remains `mock`
- [ ] Issue/PR Queue displays real data from `integration.github`
- [ ] Review Blocker reflects `assigned` / `submitted` review states and allows human Approve/Reject
- [ ] Evidence Panel displays `auditNotes`
- [ ] Timeline shows filtered, chronological GitHub/review events
- [ ] All UI data is sourced from Runtime Snapshot / IntegrationProjection (Runtime Truth Review)
- [ ] Pixel canvas extends Mission Board, Review Desk, Filing Cabinet, Wall Scroll based on integration state
- [ ] New sprite assets generated via Trae API and copied by `copy-pixel-assets.mjs`
- [ ] Component + integration + visual tests pass; CI green
- [ ] Documentation updated (this spec + runbook note in `docs/integrations/demo-office/`)

## §7 — Out of Scope

- Real GitHub API data streaming (adapter already provides it; UI only consumes)
- New backend commands or events beyond what #47 defined
- Multi-language support
- Responsive/mobile layout (desktop-first)
- Complex animations / particle effects (reserved for later phases)
- Replacing the existing `EventLogViewer` (TimelinePanel supplements it)

## §8 — Dependencies

- #47 Agent Review Loop (review commands + orchestrator)
- #45 Safe GitHub Actions (draft / audit_note evidence)
- #43 Command Gateway
- #41 Incremental Sync
- #39 Real API Source
- #34 GitHub Runtime Adapter v0

## §9 — Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Large change set on limited VRAM | Three Readiness Gates; each gate has independent test/build/screenshot verification |
| Trae API sprite generation inconsistency | Prompts include style refs; generated assets go through visual QA and manual fallback if needed |
| Adapter-specific projection leaks into generic UI | `IntegrationProjectionProvider` is opt-in; UI components only depend on `IntegrationProjection` types |
| Review state desync between orchestrator and snapshot | `getIntegrationProjection` recomputes from orchestrator maps + inner adapter evidence on every snapshot update |

## §10 — Open Questions

None remaining after design review. All decisions recorded above.
