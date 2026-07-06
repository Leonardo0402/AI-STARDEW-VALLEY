# Issue #18 Phase 2 — LifeSimSession, Minimal UI Projection, and Day Summary Completion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a browser-side `LifeSimSession` that projects server-side life-sim state into the demo-office UI, completes `DaySummary` statistics from the event log, and exposes a minimal control panel for Start Day / Advance / Run to EOD / End Day.

**Architecture:** The server-side `LifeSimEngine` remains the canonical owner of `LifeSimSnapshot` and the life-sim event log. A new HTTP route layer exposes snapshot, event stream, and command endpoints per `docs/life-sim/client-session-contract.md`. The browser `LifeSimSession` fetches the snapshot, applies the event-log tail, subscribes to SSE, and recovers gracefully from reconnections. A composed projection merges `OfficeProjection` (operational) with `LifeSimProjection` (schedule/clock) for the UI. A minimal `LifeSimControlPanel` displays the virtual clock and day controls.

**Tech Stack:** TypeScript 5.6, ESM, Vitest, React 18, Vite. Server-side routes use Node `http`. Browser event transport uses Server-Sent Events (SSE). No new runtime dependencies beyond existing workspace packages.

## Global Constraints

- All server-side life-sim code lives in `packages/life-sim`; all browser-side session/projection/UI code lives in `packages/control-ui/src/life-sim/`.
- Manual mode is deterministic: no `Date.now`, `setTimeout`, or `Math.random` in reducer or projection logic.
- Browser-side code never owns canonical life-sim state or persistence; it is a projection cache and command forwarder.
- `LifeSimEngine` remains single-threaded per world; concurrent commands/runtime events are serialized on the server.
- No visual redesign: reuse existing control-ui components, CSS tokens, and pixel-office renderer. Pixel-office consumes unchanged `OfficeProjection` in this phase.
- No new town buildings, no memory/relationship/farming systems.
- Every task ends with passing tests and a commit.

---

## File Structure

### Server-side additions (`packages/life-sim`)

- `packages/life-sim/src/summary.ts` — complete `computeDaySummary` with event-log aggregation.
- `packages/life-sim/src/reducer-runtime.ts` — emit summary facts (`day.task_created`, `day.task_completed`, `day.approval_requested`, etc.).
- `packages/life-sim/src/http-router.ts` — framework-agnostic route handlers for `GET /snapshot`, `GET /events`, `POST /command`.
- `packages/life-sim/src/http-server.ts` — tiny standalone dev server that mounts the router and bridges runtime events.
- `packages/life-sim/src/__fixtures__/summary-events.ts` — deterministic runtime events for summary tests.
- `packages/life-sim/src/summary.test.ts` — replace Phase 1 skeleton test.
- `packages/life-sim/src/engine-summary.test.ts` — end-to-end summary via engine commands/events.
- `packages/life-sim/src/http-router.test.ts` — HTTP contract tests.

### Browser-side additions (`packages/control-ui/src/life-sim/`)

- `packages/control-ui/src/life-sim/types.ts` — `LifeSimClient`, `LifeSimSessionState`, `LifeSimProjection`, `ComposedOfficeProjection`.
- `packages/control-ui/src/life-sim/client.ts` — `HttpLifeSimClient` (snapshot, SSE, command).
- `packages/control-ui/src/life-sim/session.ts` — `LifeSimSession`: bootstrap, tail application, reconnect, command forwarding.
- `packages/control-ui/src/life-sim/projection.ts` — `projectLifeSim`, `composeProjections`.
- `packages/control-ui/src/life-sim/useLifeSimState.ts` — React hook binding `LifeSimSession` to React state.
- `packages/control-ui/src/life-sim/LifeSimControlPanel.tsx` — minimal day-control UI.
- `packages/control-ui/src/life-sim/LifeSimControlPanel.test.tsx` — component tests.
- `packages/control-ui/src/life-sim/session.test.ts` — session/reconnect tests.
- `packages/control-ui/src/life-sim/index.ts` — public exports.

### Demo-office integration (`apps/demo-office`)

- `apps/demo-office/src/runtime/types.ts` — add `lifeSimBaseUrl?: string` to config.
- `apps/demo-office/src/runtime/config.ts` — read `VITE_LIFE_SIM_BASE_URL` from env.
- `apps/demo-office/src/useComposedOfficeState.ts` — compose `useOfficeState` with `useLifeSimState`.
- `apps/demo-office/src/App.tsx` — wire `LifeSimControlPanel` into the side panel.
- `apps/demo-office/src/main.tsx` — create `LifeSimSession` and pass to `App`.
- `apps/demo-office/vite.config.ts` — add `configureServer` route handler for `/life-sim/*` (dev only).
- `apps/demo-office/.env.example` — document `VITE_LIFE_SIM_BASE_URL`.
- `apps/demo-office/src/life-sim-server.ts` — Vite plugin helper that creates an in-process `LifeSimEngine` for dev.

---

### Task 1: Emit summary facts from runtime events

**Files:**
- Modify: `packages/life-sim/src/reducer-runtime.ts`
- Modify: `packages/life-sim/src/types.ts` (add event types only if needed)
- Test: `packages/life-sim/src/engine-summary.test.ts`

**Interfaces:**
- Consumes: `DomainEvent` from `@agent-office/protocol`, `LifeSimSnapshot`, `LifeSimEvent` from `types.ts`.
- Produces: `reduceRuntimeEvent` now emits additional `LifeSimEvent` types: `day.task_created`, `day.task_completed`, `day.task_failed`, `day.task_blocked`, `day.approval_requested`, `day.approval_resolved`.

**What to implement:**
Extend `reduceRuntimeEvent` to recognize the runtime event types below and emit matching life-sim summary facts. Each fact carries only the identifiers and status needed for aggregation; it does not duplicate operational truth.

| Runtime event | Life-sim event emitted | Payload |
|---|---|---|
| `task.created` | `day.task_created` | `{ taskId }` |
| `task.completed` | `day.task_completed` | `{ taskId }` |
| `task.failed` | `day.task_failed` | `{ taskId }` |
| `task.blocked` | `day.task_blocked` | `{ taskId }` |
| `approval.requested` | `day.approval_requested` | `{ approvalId, taskId }` |
| `approval.resolved` | `day.approval_resolved` | `{ approvalId, taskId, status: "approved" \| "rejected" \| "expired" }` |

These events are appended to the life-sim event log with `runtimeEventId` and `runtimeSequence` set from the triggering runtime event.

- [ ] **Step 1: Add summary-fact event handlers to `reduceRuntimeEvent`**

Add a `case` branch for each runtime event type above. Emit one life-sim event per fact. Do not change existing overlay logic.

- [ ] **Step 2: Write `engine-summary.test.ts`**

Create a test that:
1. Starts day 1 with `sampleDay1Schedules`.
2. Applies the runtime events from `docs/life-sim/examples/sample-day.md` in order:
   - `task.created` (task `t-1`)
   - `task.assigned` (worker-1)
   - `artifact.created`
   - `approval.requested`
   - `approval.resolved` (approved)
   - `task.completed`
3. Ends the day.
4. Asserts that the resulting `DaySummary.taskCounts` and `approvalCounts` match the sample day (`created: 1`, `completed: 1`, `requested: 1`, `approved: 1`).

Run: `npm test -- packages/life-sim/src/engine-summary.test.ts`
Expected: PASS (taskCounts and approvalCounts only; agent activities will pass after Task 2).

- [ ] **Step 3: Commit**

```bash
git add packages/life-sim/src/reducer-runtime.ts packages/life-sim/src/engine-summary.test.ts
git commit -m "feat(life-sim): emit summary facts for task and approval events"
```

---

### Task 2: Complete `DaySummary` event-log aggregation

**Files:**
- Modify: `packages/life-sim/src/summary.ts`
- Modify: `packages/life-sim/src/reducer-world.ts` (record startedAtWorldMinute on `world.day_started`)
- Test: `packages/life-sim/src/summary.test.ts`
- Test: `packages/life-sim/src/engine-summary.test.ts` (expand)

**Interfaces:**
- Consumes: `LifeSimSnapshot`, `LifeSimEvent`, `DaySummary` from `types.ts`.
- Produces: `computeDaySummary(snapshot, day, startedAtWorldMinute, endedAtWorldMinute)` returns `{ summary: DaySummary; events: LifeSimEvent[] }`.

**What to implement:**
Replace the Phase 1 skeleton `aggregateAgentActivities` with a deterministic scan of the life-sim event log for the requested day. Compute:

1. **Agent activity minutes:** For each agent, track active intervals. Start an interval on `schedule.activity_started` or `schedule.activity_resumed`. End an interval on `schedule.activity_completed`, `schedule.activity_interrupted`, or `schedule.overlay_ended`. Credit `(endMinute - startMinute)` minutes to the activity name. If an activity is still active at `endedAtWorldMinute`, credit up to that boundary.
2. **Rooms visited:** Collect distinct non-null `roomId` values from entries the agent was in during the day.
3. **Task counts:** Count `day.task_created`, `day.task_completed`, `day.task_failed`, `day.task_blocked`.
4. **Approval counts:** Count `day.approval_requested`, `day.approval_resolved` with status `approved`, `day.approval_resolved` with status `rejected`.
5. **Notable event IDs:** Up to 10 runtime event IDs selected deterministically: first `task.assigned`, first `approval.requested`, first `approval.resolved`, first `task.completed`, first `task.failed`/`task.blocked`.
6. **Truncated flag:** Copy from `snapshot.truncatedHistory.truncated`.

- [ ] **Step 1: Implement interval-based activity aggregation**

Implement `aggregateAgentActivities(snapshot, day)` that scans `snapshot.completedDaySummaries`? No — it scans the current event log. The day being summarized is the current day; completed-day summaries for prior days are immutable and not re-aggregated.

The scan range is all `LifeSimEvent`s with `event.day === day` and `event.worldMinute` between `startedAtWorldMinute` and `endedAtWorldMinute`.

- [ ] **Step 2: Implement task/approval/notable aggregation**

Use the summary-fact events emitted in Task 1. For notable events, collect the `runtimeEventId` of the first occurrence of each shaping event type.

- [ ] **Step 3: Update `summary.test.ts`**

Replace the Phase 1 skeleton test with a test that builds a populated `LifeSimSnapshot` (or creates one via `createLifeSimEngine`) and asserts exact `agentActivities`, `taskCounts`, `approvalCounts`, and `notableEventIds` matching `docs/life-sim/examples/sample-day.md`.

Run: `npm test -- packages/life-sim/src/summary.test.ts`
Expected: PASS.

- [ ] **Step 4: Expand `engine-summary.test.ts`**

Assert the full `DaySummary` shape after `world.end_day`, including agent activity minutes and rooms visited.

Run: `npm test -- packages/life-sim/src/engine-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/life-sim/src/summary.ts packages/life-sim/src/reducer-world.ts packages/life-sim/src/summary.test.ts packages/life-sim/src/engine-summary.test.ts
git commit -m "feat(life-sim): compute real DaySummary from event log"
```

---

### Task 3: Add server-side HTTP route handlers

**Files:**
- Create: `packages/life-sim/src/http-router.ts`
- Create: `packages/life-sim/src/http-router.test.ts`
- Modify: `packages/life-sim/src/index.ts` (export router)

**Interfaces:**
- Consumes: `LifeSimEngine` from `engine.ts`.
- Produces: `createLifeSimRouter(engine)` returning `{ handle(req, res): Promise<void> }`.

**What to implement:**
Implement the HTTP contract from `docs/life-sim/client-session-contract.md`:

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/life-sim/{worldId}/snapshot` | Return `LifeSimSnapshotResponse` JSON. |
| `GET` | `/life-sim/{worldId}/events?afterLifeSimSequence={n}` | Open SSE stream; replay events with `lifeSimSequence > n`; then keep connection alive for live events. |
| `POST` | `/life-sim/{worldId}/command` | Parse `LifeSimCommand`, call `engine.execute(command)`, return `LifeSimCommandResult` JSON. |

Router responsibilities:
- Parse `worldId` from URL.
- Reject requests for a mismatched `worldId` with 404.
- For SSE, set `Content-Type: text/event-stream`, emit `event: life-sim-event\nid: <seq>\ndata: <json>\n\n` per event.
- Keep a list of live SSE responses; push events via `engine.onLifeSimEvent`.
- Clean up live responses on client disconnect.

- [ ] **Step 1: Write `http-router.ts`**

Create `createLifeSimRouter(engine: LifeSimEngine)` with the `handle` method described above. Keep it framework-agnostic (use `http.IncomingMessage` / `http.ServerResponse`).

- [ ] **Step 2: Write `http-router.test.ts`**

Use `node:http` to start a server with the router. Tests:
- `GET /snapshot` returns 200 and valid `LifeSimSnapshotResponse`.
- `POST /command` with `world.start_day` returns accepted result.
- Repeating the same `commandId` returns the same result (idempotency).
- `GET /events` opens SSE and replays tail events.
- `world.advance_time` command causes a live SSE event.
- `GET /events` with `afterLifeSimSequence` too far ahead returns a reset signal or reconnect guidance.

Run: `npm test -- packages/life-sim/src/http-router.test.ts`
Expected: PASS.

- [ ] **Step 3: Export router from `index.ts`**

Add `export * from "./http-router.js";` to `packages/life-sim/src/index.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/life-sim/src/http-router.ts packages/life-sim/src/http-router.test.ts packages/life-sim/src/index.ts
git commit -m "feat(life-sim): add HTTP snapshot/event/command router"
```

---

### Task 4: Add standalone dev server

**Files:**
- Create: `packages/life-sim/src/http-server.ts`
- Create: `packages/life-sim/src/http-server.test.ts`
- Modify: `packages/life-sim/package.json` (add `dev:server` script)

**Interfaces:**
- Consumes: `LifeSimEngineConfig`, `LifeSimEngine`, `RuntimeLifeSimBridge`.
- Produces: `createLifeSimServer(config, options)` returning `{ start(): Promise<void>; stop(): Promise<void>; getBaseUrl(): string }`.

**What to implement:**
Create a small Node HTTP server that:
1. Creates a `LifeSimEngine` from config.
2. Optionally connects a `RuntimeLifeSimBridge` to a provided `RuntimeSession` or `OperationalEventJournal`.
3. Mounts the router from Task 3.
4. Exposes `start`/`stop`/`getBaseUrl`.

For dev usage, the server can be started with a mock runtime session in-process, or with no runtime bridge (manual-only mode) if the runtime is remote.

- [ ] **Step 1: Write `http-server.ts`**

Create `createLifeSimServer(config, options)` where `options` includes `port`, `runtimeSession`, and `dataDir`. The server creates a `FileLifeSimStore` by default and bridges runtime events if a session is provided.

- [ ] **Step 2: Write `http-server.test.ts`**

Start the server with an in-memory store, send `world.start_day` and `world.advance_time`, verify snapshot updates over HTTP.

Run: `npm test -- packages/life-sim/src/http-server.test.ts`
Expected: PASS.

- [ ] **Step 3: Add dev script**

Add to `packages/life-sim/package.json`:
```json
"dev:server": "node --import tsx src/http-server.ts --port=3457"
```

- [ ] **Step 4: Commit**

```bash
git add packages/life-sim/src/http-server.ts packages/life-sim/src/http-server.test.ts packages/life-sim/package.json
git commit -m "feat(life-sim): add standalone life-sim dev server"
```

---

### Task 5: Browser `LifeSimClient` (snapshot, SSE, command)

**Files:**
- Create: `packages/control-ui/src/life-sim/types.ts`
- Create: `packages/control-ui/src/life-sim/client.ts`
- Create: `packages/control-ui/src/life-sim/client.test.ts`
- Modify: `packages/control-ui/package.json` (add `@agent-office/life-sim` dependency)

**Interfaces:**
- Consumes: `LifeSimSnapshotResponse`, `LifeSimEvent`, `LifeSimCommand`, `LifeSimCommandResult` from `@agent-office/life-sim`.
- Produces: `LifeSimClient` interface with `getSnapshot()`, `subscribe(afterLifeSimSequence, observer)`, `execute(command)`.

**What to implement:**
Define and implement `HttpLifeSimClient`:

```ts
export interface LifeSimStreamObserver {
  onEvent(event: LifeSimEvent): void;
  onState?(state: "opening" | "ready" | "reset_required" | "error" | "closed"): void;
  onError?(error: { code: string; message: string; recoverable: boolean }): void;
}

export interface LifeSimClient {
  getSnapshot(): Promise<LifeSimSnapshotResponse>;
  execute(command: LifeSimCommand): Promise<LifeSimCommandResult>;
  subscribe(afterLifeSimSequence: number, observer: LifeSimStreamObserver): { close(): void };
}
```

`HttpLifeSimClient` uses `fetch` for snapshot/command and `EventSource` for SSE. It parses SSE frames with `event: life-sim-event` and `data: <json>`. On network error or `reset_required`, the observer is notified; the session layer decides whether to reconnect.

- [ ] **Step 1: Add `@agent-office/life-sim` dependency**

Modify `packages/control-ui/package.json`:
```json
"dependencies": {
  "@agent-office/protocol": "1.0.0",
  "@agent-office/core": "1.0.0",
  "@agent-office/life-sim": "1.0.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0"
}
```

- [ ] **Step 2: Write `types.ts`**

Define `LifeSimClient`, `LifeSimStreamObserver`, `LifeSimSessionState`, and `LifeSimProjection` types.

- [ ] **Step 3: Write `client.ts`**

Implement `HttpLifeSimClient` with:
- `getSnapshot()`
- `execute(command)`
- `subscribe(afterLifeSimSequence, observer)` using `EventSource`

- [ ] **Step 4: Write `client.test.ts`**

Use a local Node HTTP server or a mocked `fetch`/`EventSource` to test:
- `getSnapshot` parses response.
- `execute` sends POST body and parses result.
- `subscribe` receives replayed events and a live event.
- `subscribe` calls `onError` when the SSE connection drops.

Run: `npm test -- packages/control-ui/src/life-sim/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/control-ui/package.json packages/control-ui/src/life-sim/types.ts packages/control-ui/src/life-sim/client.ts packages/control-ui/src/life-sim/client.test.ts
git commit -m "feat(control-ui): add HttpLifeSimClient"
```

---

### Task 6: Browser `LifeSimSession`

**Files:**
- Create: `packages/control-ui/src/life-sim/session.ts`
- Create: `packages/control-ui/src/life-sim/session.test.ts`

**Interfaces:**
- Consumes: `LifeSimClient` from `client.ts`, `LifeSimSnapshotResponse`, `LifeSimEvent`, `LifeSimCommand`, `LifeSimCommandResult`, `LifeSimCapabilities`, `LifeSimSnapshot` from `@agent-office/life-sim`.
- Produces: `LifeSimSession` class with `start()`, `stop()`, `getProjection()`, `getCapabilities()`, `execute(command)`, `onStateChange(listener)`, `onProjectionChange(listener)`, `isTruncated()`.

**What to implement:**
`LifeSimSession` orchestrates the client contract:

1. `start()`:
   - Fetch snapshot.
   - Install snapshot as local projection.
   - Apply `eventLogTail` in order; verify continuity.
   - Compute `lastAppliedLifeSimSequence`.
   - Open subscription from that sequence.
2. On each incoming event:
   - Verify `lifeSimSequence === expectedNextSequence`.
   - On gap, close subscription and re-run `start()`.
   - Apply event to local snapshot copy.
   - Notify listeners.
3. On `reset_required` / unrecoverable error:
   - Set state to `error` and stop auto-reconnect after max attempts.
4. `execute(command)`:
   - Forward to client.
   - On accepted, the resulting events arrive via SSE; do not optimistically mutate local state.
   - On rejected, surface error.
5. `getProjection()` returns a `LifeSimProjection` derived from the local snapshot.

The local snapshot must be a deep clone; events are applied by a pure projection function (not by re-running the reducer). Because the server is canonical, the client only needs to overwrite fields that change per event type.

- [ ] **Step 1: Write `session.ts`**

Implement `LifeSimSession` with:
- State machine: `"idle" | "bootstrapping" | "live" | "reconnecting" | "error"`.
- Exponential backoff for reconnections (configurable).
- Tail continuity verification.
- Projection update on every applied event.

- [ ] **Step 2: Write `session.test.ts`**

Use a mock `LifeSimClient` to test:
- `start()` bootstraps from snapshot + tail.
- Tail gap triggers re-bootstrap.
- Live events update projection.
- Command rejection surfaces error.
- Truncated snapshot sets `isTruncated()`.

Run: `npm test -- packages/control-ui/src/life-sim/session.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/control-ui/src/life-sim/session.ts packages/control-ui/src/life-sim/session.test.ts
git commit -m "feat(control-ui): add LifeSimSession with reconnect and tail continuity"
```

---

### Task 7: `LifeSimProjection` and composed `OfficeProjection`

**Files:**
- Create: `packages/control-ui/src/life-sim/projection.ts`
- Create: `packages/control-ui/src/life-sim/projection.test.ts`

**Interfaces:**
- Consumes: `LifeSimSnapshot`, `LifeSimCapabilities`, `AgentScheduleEntry`, `ActiveAgentActivity`, `ScheduleOverlay` from `@agent-office/life-sim`; `OfficeProjection` from `@agent-office/protocol`.
- Produces: `LifeSimProjection`, `ComposedOfficeProjection`, `projectLifeSim(snapshot, capabilities)`, `composeProjections(office, lifeSim)`.

**What to implement:**
Define projection types from `docs/life-sim/day-cycle-contract.md` § UI projection:

```ts
export interface WorldClockView {
  day: number;
  dayOfWeek: number;
  minuteOfDay: number;
  phase: "dawn" | "morning" | "afternoon" | "evening" | "night";
  status: "not_started" | "running" | "paused" | "ending";
  speed: number;
}

export interface AgentLifeSimView {
  agentId: string;
  currentActivity: string;
  currentRoomId: string | null;
  currentEntryId: string;
  nextEntryId: string | null;
  nextEntryAtMinute: number | null;
  isOverridden: boolean;
  overrideReason: "task" | "operator" | null;
}

export interface LifeSimProjection {
  world: WorldClockView;
  agents: AgentLifeSimView[];
  nextTransition: { agentId: string; entryId: string; atMinute: number } | null;
  previousDaySummaries: DaySummary[];
  capabilities: LifeSimCapabilities;
  truncated: boolean;
  lostRuntimeRange: { from: number; to: number } | null;
}

export interface ComposedOfficeProjection extends OfficeProjection {
  lifeSim: LifeSimProjection;
}
```

`projectLifeSim` derives:
- `WorldClockView` directly from `snapshot.worldClock`.
- `AgentLifeSimView` from `snapshot.activeActivities`, `activeOverlays`, and `baseSchedules`.
- `nextTransition` by scanning base schedules and overlays for the earliest future boundary after `worldClock.minuteOfDay`.
- `previousDaySummaries` from `snapshot.completedDaySummaries`.
- `truncated` and `lostRuntimeRange` from `snapshot.truncatedHistory`.
- `capabilities` passed through.

`composeProjections` returns `{ ...office, lifeSim }`.

- [ ] **Step 1: Write `projection.ts`**

Implement `projectLifeSim` and `composeProjections`.

- [ ] **Step 2: Write `projection.test.ts`**

Build a `LifeSimSnapshot` fixture and assert:
- `world` view fields match the snapshot.
- Agent views reflect active activities and overlays.
- `nextTransition` picks the earliest future entry boundary.
- `composeProjections` preserves all `OfficeProjection` fields and adds `lifeSim`.

Run: `npm test -- packages/control-ui/src/life-sim/projection.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/control-ui/src/life-sim/projection.ts packages/control-ui/src/life-sim/projection.test.ts
git commit -m "feat(control-ui): add LifeSimProjection and OfficeProjection composition"
```

---

### Task 8: React hook `useLifeSimState`

**Files:**
- Create: `packages/control-ui/src/life-sim/useLifeSimState.ts`
- Create: `packages/control-ui/src/life-sim/useLifeSimState.test.tsx`

**Interfaces:**
- Consumes: `LifeSimSession` from `session.ts`, `LifeSimProjection` from `projection.ts`.
- Produces: `useLifeSimState(session)` returning `{ projection: LifeSimProjection; state: LifeSimSessionState; errors: string[]; execute(command) }`.

**What to implement:**
A thin React hook that:
- Subscribes to `LifeSimSession` projection changes and state changes.
- Manages an `errors` array (last 10 messages) from command rejections and session errors.
- Exposes `execute` that forwards to `session.execute` and appends errors on rejection.

- [ ] **Step 1: Write `useLifeSimState.ts`**

Implement the hook with `useState`, `useEffect`, and `useCallback`.

- [ ] **Step 2: Write `useLifeSimState.test.tsx`**

Use React Testing Library and a mock `LifeSimSession` to verify:
- Hook returns initial projection.
- Projection change triggers re-render.
- Command rejection adds to errors.

Run: `npm test -- packages/control-ui/src/life-sim/useLifeSimState.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/control-ui/src/life-sim/useLifeSimState.ts packages/control-ui/src/life-sim/useLifeSimState.test.tsx
git commit -m "feat(control-ui): add useLifeSimState hook"
```

---

### Task 9: Minimal `LifeSimControlPanel` UI

**Files:**
- Create: `packages/control-ui/src/life-sim/LifeSimControlPanel.tsx`
- Create: `packages/control-ui/src/life-sim/LifeSimControlPanel.test.tsx`
- Create: `packages/control-ui/src/life-sim/life-sim-panel.css`
- Modify: `packages/control-ui/src/life-sim/index.ts` (export)

**Interfaces:**
- Consumes: `LifeSimProjection`, `LifeSimCapabilities`, `DaySummary`.
- Produces: `LifeSimControlPanel` React component with `onSendCommand` callback.

**What to implement:**
A minimal control panel that displays:
- Current day, virtual time (`HH:MM`), phase, status.
- Truncated-history indicator if `projection.truncated` is true.
- Buttons (enabled by capabilities):
  - **Start Day** — `world.start_day` (enabled when `capabilities.world.startDay`).
  - **Advance 30 min** — `world.advance_time { minutes: 30 }` (enabled when `capabilities.world.advanceTime`).
  - **Advance 60 min** — `world.advance_time { minutes: 60 }`.
  - **Advance 120 min** — `world.advance_time { minutes: 120 }`.
  - **Run to EOD** — `world.run_to_end_of_day` (enabled when `capabilities.world.runToEndOfDay`).
  - **End Day** — `world.end_day` (enabled when `capabilities.world.endDay`).
- Most recent `DaySummary` (if any) with task/approval counts.

Styling:
- Reuse existing control-ui tokens and `Card`, `Badge`, `SectionHeader` components.
- Add only the minimal CSS needed for layout in `life-sim-panel.css`.

- [ ] **Step 1: Write `LifeSimControlPanel.tsx`**

Implement the component with local error state per action (similar to `ControlPanel`). Display the virtual clock as `HH:MM` from `projection.world.minuteOfDay` using a small helper such as:

```ts
// packages/control-ui/src/life-sim/format-time.ts
export function formatWorldTime(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
```

Do not use `formatTime` from `packages/control-ui/src/components/format-time.ts`; that helper formats ISO timestamps, not virtual-world minutes.

- [ ] **Step 2: Write `LifeSimControlPanel.test.tsx`**

Test:
- Buttons are disabled/enabled according to capabilities.
- Clicking Start Day calls `onSendCommand("world.start_day", {})`.
- Truncated indicator renders when `truncated` is true.
- Latest summary is displayed.

Run: `npm test -- packages/control-ui/src/life-sim/LifeSimControlPanel.test.tsx`
Expected: PASS.

- [ ] **Step 3: Add CSS and export**

Create `life-sim-panel.css` with layout rules only. Export `LifeSimControlPanel` from `packages/control-ui/src/life-sim/index.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/control-ui/src/life-sim/LifeSimControlPanel.tsx packages/control-ui/src/life-sim/LifeSimControlPanel.test.tsx packages/control-ui/src/life-sim/life-sim-panel.css packages/control-ui/src/life-sim/index.ts
git commit -m "feat(control-ui): add minimal LifeSimControlPanel"
```

---

### Task 10: Integrate into `demo-office`

**Files:**
- Modify: `apps/demo-office/src/runtime/types.ts`
- Modify: `apps/demo-office/src/runtime/config.ts`
- Modify: `apps/demo-office/package.json` (add `@agent-office/life-sim` dependency)
- Create: `apps/demo-office/src/useComposedOfficeState.ts`
- Modify: `apps/demo-office/src/App.tsx`
- Modify: `apps/demo-office/src/main.tsx`
- Modify: `apps/demo-office/vite.config.ts`
- Modify: `apps/demo-office/.env.example`
- Create: `apps/demo-office/src/life-sim-server.ts`

**Interfaces:**
- Consumes: `RuntimeSession`, `SnapshotStore`, `CommandGateway`, `useOfficeState` from `@agent-office/control-ui`; `LifeSimSession`, `HttpLifeSimClient`, `composeProjections` from `@agent-office/control-ui/life-sim`.
- Produces: `useComposedOfficeState` returning `OfficeState & { lifeSim: LifeSimState }`.

**What to implement:**

1. **Config:** Add `VITE_LIFE_SIM_BASE_URL` to `.env.example` and read it in `config.ts`. Default to `/life-sim` so the Vite dev proxy can handle it.

2. **Vite dev server plugin:** Add `configureServer` to `vite.config.ts` that routes `/life-sim/{worldId}/*` to an in-process `LifeSimEngine`. The engine is created in `life-sim-server.ts` and is bridged to the runtime via `RuntimeLifeSimBridge`. For dev, use the mock runtime adapter if the browser runtime is mock, or use an HTTP/SSE adapter to the runtime server if remote.

3. **`useComposedOfficeState`:** Wrap `useOfficeState` and `useLifeSimState`. Return composed projection and both `sendCommand` and `sendLifeSimCommand`.

4. **`App.tsx`:** Accept a `lifeSimSession` prop. Render `LifeSimControlPanel` above the existing `ControlPanel` in the side panel. Pass `composedProjection.lifeSim` to it.

5. **`main.tsx`:** Create `LifeSimSession` with `HttpLifeSimClient` after runtime connection. Pass it to `App`.

- [ ] **Step 1: Update config, env, and dependencies**

Add `lifeSimBaseUrl` to `DemoRuntimeConfig` and read `VITE_LIFE_SIM_BASE_URL` in `config.ts`. Add `@agent-office/life-sim` to `apps/demo-office/package.json` dependencies:
```json
"@agent-office/life-sim": "1.0.0"
```

- [ ] **Step 2: Create `life-sim-server.ts`**

Implement a Vite plugin helper:
```ts
export function createLifeSimDevPlugin(worldId: string): Plugin {
  // configureServer: create engine + bridge, route /life-sim/{worldId}/*
}
```

- [ ] **Step 3: Update `vite.config.ts`**

Import and use `createLifeSimDevPlugin`.

- [ ] **Step 4: Create `useComposedOfficeState.ts`**

Combine `useOfficeState` and `useLifeSimState`:
```ts
export function useComposedOfficeState(
  session: RuntimeSession,
  store: SnapshotStore,
  gateway: CommandGateway,
  runtimeId: string,
  lifeSimSession: LifeSimSession
) {
  const office = useOfficeState(session, store, gateway, runtimeId);
  const lifeSim = useLifeSimState(lifeSimSession);
  const projection = useMemo(
    () => composeProjections(office.projection, lifeSim.projection),
    [office.projection, lifeSim.projection]
  );
  return { ...office, projection, lifeSim, sendLifeSimCommand: lifeSim.execute };
}
```

- [ ] **Step 5: Update `App.tsx`**

Add `lifeSimSession: LifeSimSession` prop. Replace `useOfficeState` with `useComposedOfficeState`. Render `LifeSimControlPanel` in `app-panel`.

- [ ] **Step 6: Update `main.tsx`**

After `composition.session.connect()`, create `HttpLifeSimClient` and `LifeSimSession`, call `session.start()`, then pass to `renderAppComposition`.

- [ ] **Step 7: Commit**

```bash
git add apps/demo-office/src/runtime/types.ts apps/demo-office/src/runtime/config.ts apps/demo-office/src/useComposedOfficeState.ts apps/demo-office/src/App.tsx apps/demo-office/src/main.tsx apps/demo-office/vite.config.ts apps/demo-office/.env.example apps/demo-office/src/life-sim-server.ts
git commit -m "feat(demo-office): integrate LifeSimSession and control panel"
```

---

### Task 11: End-to-end integration test

**Files:**
- Create: `apps/demo-office/src/integration-life-sim.test.ts`

**Interfaces:**
- Consumes: everything built above.
- Produces: a deterministic test that runs through Start Day → Advance → Run to EOD → End Day and verifies DaySummary.

**What to implement:**
A Playwright or Vitest integration test that:
1. Starts the demo-office dev server with mock runtime and life-sim plugin.
2. Opens the page.
3. Clicks **Start Day**.
4. Clicks **Advance 30 min**.
5. Clicks **Run to EOD**.
6. Clicks **End Day**.
7. Asserts that the DaySummary panel shows `taskCounts.completed >= 0` and `truncated === false`.

Because this test requires a browser environment, prefer Playwright. If Playwright setup is not ready, write a Node integration test using `createLifeSimServer` and `HttpLifeSimClient`.

- [ ] **Step 1: Write integration test**

Use `createLifeSimServer` + `HttpLifeSimClient` for a headless integration test:
- Start server with `sampleDay1Schedules` and mock runtime events.
- Run through the day via HTTP commands.
- Verify `DaySummary` over HTTP.

- [ ] **Step 2: Run test**

Run: `npm test -- apps/demo-office/src/integration-life-sim.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/demo-office/src/integration-life-sim.test.ts
git commit -m "test(demo-office): add life-sim day control integration test"
```

---

## Interface Contracts

### Server/browser transport

```ts
// From docs/life-sim/client-session-contract.md
interface LifeSimSnapshotResponse {
  worldId: string;
  schemaVersion: string;
  checkpointLifeSimSequence: number;
  snapshot: LifeSimSnapshot;
  eventLogTail: LifeSimEvent[];
}

// Browser client
interface LifeSimClient {
  getSnapshot(): Promise<LifeSimSnapshotResponse>;
  execute(command: LifeSimCommand): Promise<LifeSimCommandResult>;
  subscribe(
    afterLifeSimSequence: number,
    observer: LifeSimStreamObserver
  ): { close(): void };
}

interface LifeSimStreamObserver {
  onEvent(event: LifeSimEvent): void;
  onState?(state: "opening" | "ready" | "reset_required" | "error" | "closed"): void;
  onError?(error: { code: string; message: string; recoverable: boolean }): void;
}
```

### Browser session

```ts
class LifeSimSession {
  constructor(client: LifeSimClient, options?: { reconnectPolicy?: ReconnectPolicy });
  start(): Promise<void>;
  stop(): void;
  execute(command: LifeSimCommand): Promise<LifeSimCommandResult>;
  getProjection(): LifeSimProjection;
  getCapabilities(): LifeSimCapabilities;
  isTruncated(): boolean;
  onStateChange(listener: (state: LifeSimSessionState) => void): () => void;
  onProjectionChange(listener: (projection: LifeSimProjection) => void): () => void;
}

type LifeSimSessionState =
  | "idle"
  | "bootstrapping"
  | "live"
  | "reconnecting"
  | "error";
```

### Projections

```ts
interface LifeSimProjection {
  world: WorldClockView;
  agents: AgentLifeSimView[];
  nextTransition: { agentId: string; entryId: string; atMinute: number } | null;
  previousDaySummaries: DaySummary[];
  capabilities: LifeSimCapabilities;
  truncated: boolean;
  lostRuntimeRange: { from: number; to: number } | null;
}

interface ComposedOfficeProjection extends OfficeProjection {
  lifeSim: LifeSimProjection;
}

function projectLifeSim(
  snapshot: LifeSimSnapshot,
  capabilities: LifeSimCapabilities
): LifeSimProjection;

function composeProjections(
  office: OfficeProjection,
  lifeSim: LifeSimProjection
): ComposedOfficeProjection;
```

### Summary facts (server reducer)

New life-sim event types emitted by `reduceRuntimeEvent`:
- `day.task_created` `{ taskId }`
- `day.task_completed` `{ taskId }`
- `day.task_failed` `{ taskId }`
- `day.task_blocked` `{ taskId }`
- `day.approval_requested` `{ approvalId, taskId }`
- `day.approval_resolved` `{ approvalId, taskId, status }`

### HTTP routes

- `GET /life-sim/{worldId}/snapshot`
- `GET /life-sim/{worldId}/events?afterLifeSimSequence={n}` (SSE)
- `POST /life-sim/{worldId}/command`

---

## Testing Strategy

### Unit tests

- `packages/life-sim/src/summary.test.ts` — deterministic DaySummary aggregation.
- `packages/life-sim/src/engine-summary.test.ts` — engine produces correct summary end-to-end.
- `packages/life-sim/src/http-router.test.ts` — HTTP contract, idempotency, SSE live push.
- `packages/life-sim/src/http-server.test.ts` — standalone server start/stop and command round-trip.
- `packages/control-ui/src/life-sim/client.test.ts` — `HttpLifeSimClient` snapshot/SSE/command.
- `packages/control-ui/src/life-sim/session.test.ts` — bootstrap, tail gap, reconnect, truncated indicator.
- `packages/control-ui/src/life-sim/projection.test.ts` — projection derivation.
- `packages/control-ui/src/life-sim/useLifeSimState.test.tsx` — React hook state updates.
- `packages/control-ui/src/life-sim/LifeSimControlPanel.test.tsx` — button enabling and callbacks.

### Integration tests

- `apps/demo-office/src/integration-life-sim.test.ts` — full day control flow via HTTP/client.

### Golden flow

- Extend `packages/life-sim/src/day1-golden-flow.test.ts` to assert the complete `DaySummary` from `docs/life-sim/examples/sample-day.md` after `world.end_day`.

---

## Open Questions / Risks

1. **Runtime bridge in dev server:** For mock mode, the runtime adapter currently lives in the browser. Running a server-side life-sim engine with a mock runtime requires either moving the mock runtime to the dev server or using an in-memory engine in the browser for mock mode. The plan proposes a Vite plugin that creates an in-process engine bridged to the runtime; for mock mode this implies the mock runtime must also run in the dev server process. **Decision needed:** Is mock-mode server-side acceptable, or should mock mode keep an in-browser engine as a dev convenience?

2. **Real-time clock mode:** The issue scope includes Start Day / Advance / Run to EOD / End Day (manual mode). Real-time compressed mode (`speed > 0`) is mentioned in contracts but is not explicitly required. The plan implements manual mode first. **Decision needed:** Should `world.pause` and `world.resume` also be implemented in this phase, or deferred?

3. **Schedule override commands:** `schedule.override` and `schedule.clear_override` are in the contract and `LifeSimCapabilities`, but the issue scope lists only day controls. The plan leaves them as out-of-scope. **Decision needed:** Confirm that operator overlays are not required for Phase 2.

4. **EventSource polyfill / testing:** `EventSource` is a browser API. Node tests may need a polyfill or mocked transport. The plan assumes Vitest/jsdom provides `EventSource` or tests use a mocked observer. **Risk:** If jsdom lacks `EventSource`, add a test double.

5. **Truncated-history display:** The plan displays a boolean indicator. A richer "history lost from X to Y" message could be added if desired. **Decision needed:** Is a simple indicator sufficient for Phase 2?

---

## Self-Review

### 1. Spec coverage

| Issue #18 requirement | Implemented by |
|---|---|
| Browser-side `LifeSimSession` | Task 6 |
| Snapshot/tail/event-stream client | Tasks 5, 6 |
| LifeSim + OfficeProjection integration | Tasks 7, 10 |
| Minimal UI control panel (Start Day / Advance / Run to EOD / End Day) | Task 9 |
| `DaySummary` with real statistics | Tasks 1, 2, plus Golden Flow extension |
| Client reconnection and tail continuity | Tasks 5, 6 |
| Truncated-history display | Tasks 6, 7, 9 |
| No visual redesign / no new town buildings / no memory/relationship/farming | Global Constraints |

All explicit requirements are covered. Phase 2 explicitly excludes `world.pause`, `world.resume`, `schedule.override`, and `schedule.clear_override`; those capabilities remain advertised as `false`.

### 2. Placeholder scan

- No literal `TBD`/`TODO` strings remain in executable steps.
- The existing `// TODO(phase-2)` comment in `packages/life-sim/src/summary.ts` is a source marker, not a plan placeholder.
- **Findings:** Many executable steps describe *what* to implement without showing the code/test body (e.g., Task 1 Step 1, Task 2 Steps 1–3, Task 3 Steps 1–2, Task 6 Steps 1–2, Task 10 Steps 2/4/5/6). Before execution, each of these steps should be expanded with concrete code blocks or test cases so an implementer has exact signatures and assertions. The interface-contract and file-structure sections already provide the exact names/types needed to fill them.

### 3. Type consistency

- `LifeSimProjection`, `ComposedOfficeProjection`, `LifeSimClient`, and `LifeSimSession` types are used consistently across Tasks 5–10.
- `DaySummary` shape is unchanged from Phase 1; only its computation changes.
- `LifeSimStreamObserver.onState` uses transport-level names (`opening`/`ready`/`reset_required`/`error`/`closed`) which are intentionally distinct from `LifeSimSessionState` (`idle`/`bootstrapping`/`live`/`reconnecting`/`error`). This is acceptable but should be documented in `types.ts`.

### 4. Corrections applied during review

- Added `@agent-office/life-sim` dependencies to `packages/control-ui/package.json` and `apps/demo-office/package.json`.
- Task 1 Step 2 now includes `task.created` before `task.assigned` so the expected `taskCounts.created === 1` is actually produced.
- Task 9 now uses a virtual-time helper (`formatWorldTime`) instead of the ISO-based `formatTime` helper.
- Task 2's modification to `reducer-world.ts` should persist `startedAtWorldMinute` from the `world.day_started` event (e.g., on `worldClock` or a dedicated field) and `world.end_day` should pass that stored value to `computeDaySummary`, rather than always using `config.startOfDayMinute`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-06-issue-18-phase2-life-sim-client.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
