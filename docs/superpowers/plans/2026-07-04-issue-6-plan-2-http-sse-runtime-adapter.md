# Issue #6 Plan 2: Generic HTTP Snapshot + SSE Events + REST Commands RuntimeAdapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `packages/adapters/http-sse` — a framework-neutral `RuntimeAdapter` that fetches `RuntimeSnapshot` over HTTP, parses SSE DomainEvent streams via `fetch + ReadableStream`, executes `OfficeCommand` over REST with `Idempotency-Key`, and reports stream errors to `RuntimeSession` which owns bounded single-flight reconnect/resync.

**Architecture:** New package `@agent-office/adapter-http-sse` depends only on `@agent-office/protocol` and `@agent-office/core`. It performs **one stream attempt per `subscribe()`** and reports state/errors via the Plan 1 `RuntimeStreamObserver` / `RuntimeSubscription` contract. `RuntimeSession` (in core) is extended to observe `onError`/`onState("reset_required")` and drive bounded exponential-backoff reconnect. Validators are repository-owned (zero new deps). Auth is injectable (`headers | () => Promise<headers>` + `credentials`), tokens never enter URLs/logs/errors. SSE parsing is a standalone module with exhaustive chunk-boundary tests. Commands are POST with `Idempotency-Key: commandId`, no automatic retry.

**Tech Stack:** TypeScript 5.6+, `fetch` + `ReadableStream` (Node 20+ — `fetch`, `ReadableStream`, `AbortController`, `TextDecoder` are all native in Node 20), vitest 2.1+, no new third-party deps.

> **Node version:** This plan targets **Node 20** to match the current CI (`@types/node` is already pinned to `^22` for types only, but runtime is Node 20). Plan 1's tests already pass on Node 20. No `engines` bump, no CI change, no doc change required.

---

## Global Constraints

The following are project-wide invariants that every task implicitly must satisfy. Violations are review blockers.

- **No new dependencies.** Validators must be repository-owned (hand-written TypeScript in `packages/adapters/http-sse/src/validators.ts`). No `zod`, `ajv`, `valibot`, etc. If a dep is judged necessary, the task must explicitly justify it with bundle-size impact and alternatives — and this plan does not authorize any.
- **No new package manager scripts.** `npm test` and `npm run build` from the repo root must continue to drive everything. Per-package `build` is `tsc --noEmit`.
- **Protocol version stays `"1.0"`.** No `schemaVersion` bump. New fields are additive and optional.
- **`RuntimeStreamState` has NO `"reconnecting"` state.** (Plan 1 invariant, preserved.) `RuntimeSession` owns reconnect via existing `resynchronizing` / `degraded` session states.
- **Adapter performs ONE stream attempt per `subscribe()` call.** No competing reconnect loop inside the adapter. Only `RuntimeSession` retries.
- **`subscribe()` must NOT synchronously call `observer` before returning.** (Plan 1 invariant, preserved.) Replay in the HTTP/SSE adapter is naturally async (awaits fetch + reader), so this holds.
- **`removeSubscription()` is `async` and `await`s `subscription.close()`.** (Plan 1 invariant, preserved.) All call sites in session already `await` it (verified in Plan 1).
- **Tokens never enter URLs, query parameters, error messages, snapshots, or logs.** Auth headers are stripped from any diagnostic structure before it reaches `SessionDiagnostics` or test output.
- **`Idempotency-Key: <commandId>` header on every `POST /runtime/commands`.** No automatic retry of POST commands. **Manual retry MUST generate a new `commandId`** — `CommandGateway` caches completed results by `commandId`, so reusing the same ID returns the cached result without calling the adapter. The original `commandId` is only for querying the original operation's result.
- **`AbortController` is the unified cancellation mechanism for ALL in-flight network operations**: snapshot fetch, capabilities fetch, command POST, SSE stream open, SSE reader, and the reconnect timer. Each adapter instance owns one `AbortController` that is aborted on `disconnect()`. See Architecture Decision I (Abort Ownership).
- **Existing Mock adapter behavior and full test suite remain green.** Plan 1's 118/118 tests must still pass after every commit. No regression in `packages/adapters/mock` or `packages/core` existing tests (new tests in core are allowed for the reconnect integration).
- **`useOfficeState` and `CommandGateway` must NOT be modified.** (Carried from Plan 1.) Reconnect logic lives in `RuntimeSession`, not in UI or gateway.
- **No QClaw/Swarm field mapping, OpenClaw/Hermes, WebSocket, real LLM, multi-runtime UI, pixel art, new rooms, study features, or production auth UI.** (Issue #6 "Out of scope".)
- **Endpoint paths are configurable** via `HttpSseAdapterOptions.endpoints`. Defaults are `/runtime/snapshot`, `/runtime/events`, `/runtime/commands`, `/runtime/capabilities`.
- **Replay completion is signaled by an explicit `event: replay-complete` control frame**, NOT by `reader.done`. The SSE stream is a long-lived connection; `reader.done` only fires on server-side close or abort. See Architecture Decision H (Replay Completion Protocol).
- **Replay sequence continuity is enforced inside `subscription.ready`.** A non-contiguous replay, runtime mismatch, malformed event, SSE-id/sequence mismatch, trimmed history, auth failure, or protocol failure MUST reject `ready` with a typed `RuntimeStreamError`. The session treats `ready` rejection as `subscribe_failed`.
- **Invalid DomainEvent is NEVER silently dropped.** During replay: reject `ready` with `event_invalid`. During live: call `onError({ code: "event_invalid", recoverable: false })` and close the stream; the session transitions to `failed` (or `resynchronizing` if a reset is deemed recoverable by policy). Silent drop is forbidden — it would leave Core permanently behind with no signal.
- **Capabilities fallback is restricted to HTTP 404 and 501 only.** A 401/403 (auth), 500 (server), network failure, JSON corruption, or validation failure MUST NOT trigger fallback — the adapter reports the real error. See Task 3.
- **POST command is never auto-retried by the adapter or session.** A network failure on POST surfaces as `CommandResult { status: "error" }` with `error.code` describing the failure. Manual retry requires a new `commandId` (see above).
- **Tests must use the real public API.** No accessing `private` fields via type casts, no inventing `reportError()`/`reportState()` methods, no adding `getStore()`/`getGateway()` accessors. Tests inject failures through the `FakeServer` (network errors, malformed frames, gaps, auth failures). State assertions use `getState()` / `getDiagnostics()`; state-change subscription uses `onStateChange()`; the `SnapshotStore` is constructed with `new SnapshotStore(runtimeId)`.

---

## File Structure

Locked in before tasks. Each file has one clear responsibility.

### New package: `packages/adapters/http-sse/`

- **`packages/adapters/http-sse/package.json`** — package manifest (`@agent-office/adapter-http-sse`, deps: `@agent-office/protocol` only — it does NOT need core for production code; tests may import core's `RuntimeSession`/`SnapshotStore` for integration).
- **`packages/adapters/http-sse/tsconfig.json`** — extends `../../../tsconfig.base.json`, references protocol.
- **`packages/adapters/http-sse/src/index.ts`** — public exports: `HttpSseRuntimeAdapter`, `HttpSseAdapterOptions`, `SseParseError`, `defaultEndpoints`, type re-exports of validators.
- **`packages/adapters/http-sse/src/sse-parser.ts`** — standalone SSE frame parser. Pure function `createSseParser(handlers) => { feed(chunk: string): void; finish(): void }`. Zero deps. Handles UTF-8 chunk boundaries by operating on strings (caller decodes bytes via `TextDecoder` with `stream: true`).
- **`packages/adapters/http-sse/src/sse-parser.test.ts`** — exhaustive parser tests (12+ cases).
- **`packages/adapters/http-sse/src/validators.ts`** — runtime validators for `RuntimeSnapshot`, `DomainEvent`, `AdapterCapabilities`, `CommandResult`. Each returns `Ok<T> | ValidationError`. Zero deps.
- **`packages/adapters/http-sse/src/validators.test.ts`** — validator tests (valid + each rejection path).
- **`packages/adapters/http-sse/src/auth.ts`** — `AuthHeaderProvider` type, `resolveAuthHeaders()` helper, `sanitizeHeadersForLog()` (strips `Authorization`, `Cookie`, redacts `Bearer *`).
- **`packages/adapters/http-sse/src/auth.test.ts`** — auth resolution + sanitization tests.
- **`packages/adapters/http-sse/src/http-client.ts`** — thin fetch wrapper: `httpGet(url, { headers, signal, timeoutMs })`, `httpPostJson(url, body, { headers, signal, timeoutMs })`. Wraps fetch with `AbortController` + timeout. Maps HTTP errors to `RuntimeStreamError`.
- **`packages/adapters/http-sse/src/http-client.test.ts`** — HTTP client tests using mocked `fetch`.
- **`packages/adapters/http-sse/src/snapshot-client.ts`** — `fetchSnapshot(client, url, expectedRuntimeId): Promise<RuntimeSnapshot>`. Calls validator.
- **`packages/adapters/http-sse/src/capabilities-client.ts`** — `fetchCapabilities(client, url): Promise<AdapterCapabilities>`. Calls validator, applies configured fallback.
- **`packages/adapters/http-sse/src/command-client.ts`** — `postCommand(client, url, command, signal): Promise<CommandResult>`. Sets `Idempotency-Key`, validates response, no retry.
- **`packages/adapters/http-sse/src/stream-client.ts`** — `openEventStream(client, url, { afterSequence, signal }): Promise<{ response, reader, decoder }>`. Validates HTTP status + Content-Type. Returns raw reader for the parser to consume.
- **`packages/adapters/http-sse/src/adapter.ts`** — `HttpSseRuntimeAdapter` implementing `RuntimeAdapter`. Orchestrates snapshot/capabilities/command/stream clients. `subscribe()` returns `RuntimeSubscription` whose `ready` resolves only after replay continuity validation.
- **`packages/adapters/http-sse/src/adapter.test.ts`** — unit tests of the adapter with mocked clients (snapshot fetch, stream open, command post).
- **`packages/adapters/http-sse/src/fake-server.ts`** — test-only in-memory HTTP server fixture: controllable snapshot, event log, command handler, SSE frame writer. Uses Node's `http` module (already available via `@types/node`).
- **`packages/adapters/http-sse/src/integration.test.ts`** — end-to-end tests against `FakeServer` covering all "Hard test scenarios" (see Task 8).

### Modified in `packages/protocol/src/`

- **`packages/protocol/src/index.ts`** — (Task 1 only) export `ReconnectPolicy` type and `defaultReconnectPolicy` const (additive). No other protocol changes. `RuntimeStreamError`, `RuntimeErrorCode`, `RuntimeStreamState`, `RuntimeStreamObserver`, `RuntimeSubscription` already exist from Plan 1.

### Modified in `packages/core/src/`

- **`packages/core/src/session.ts`** — (Task 6) add `onError`/`onState("reset_required")` handling, bounded backoff reconnect, `ReconnectPolicy` option, `reconnectCount` diagnostic, `scheduleReconnect()` private method (single-flight via `reconnectTimer`), abort-on-disconnect. No changes to existing public API signatures.
- **`packages/core/src/session.ts`** — (Task 9, Plan 1 cleanup) `triggerResync()` rejection handler, fix the unawaited assertion warning carried as a comment for the test file fix.
- **`packages/core/src/subscription-lifecycle.test.ts`** — (Task 9) fix the unawaited `expect().resolves` at line 98.
- **`packages/core/src/session-reconnect.test.ts`** — (Task 6, new) reconnect/reset/abort tests.

### Modified in `packages/adapters/mock/src/`

- **`packages/adapters/mock/src/mock-adapter.ts`** — (Task 9) align mid-replay `if (closed) { throw }` → `if (closed) { return }` for 2nd and 3rd closed checks (consistency with TestRuntimeAdapter from Plan 1).

### Modified in `packages/protocol/src/`

- **`packages/protocol/src/index.ts`** — (Task 9) mark `DomainEventHandler` and `Unsubscribe` type aliases as `@deprecated` in JSDoc but keep them (still used internally by mock adapter historically; removal would be a breaking change to any external consumer). Decision: keep but document.

### Docs

- **`docs/protocol/runtime-contract.md`** — (Task 9) add Section 4.3 "HTTP/SSE Wire Protocol" with endpoint paths, snapshot response shape, SSE frame shape, command request shape, auth header rules, error mapping table.
- **`docs/adr/0003-stream-lifecycle-ownership.md`** — (Task 9, new) ADR documenting that RuntimeSession owns reconnect/resync; adapter performs one attempt.
- **`docs/adr/0004-http-sse-validation-strategy.md`** — (Task 9, new) ADR documenting repository-owned validators, no external dep.

---

## Architecture Decisions (read before tasks)

These resolve the 7 mandatory design decisions from Issue #6's Plan 2 gate comment.

### A. Validation Strategy

**Decision:** Repository-owned validators in `packages/adapters/http-sse/src/validators.ts`. Zero new dependencies.

**What gets validated at the runtime boundary:**

1. **`RuntimeSnapshot`** (`validateSnapshot(raw, expectedRuntimeId)`) — **DEEP structural validation** (revised per Plan Review):
   - Top-level: `runtimeId` is a string and equals `expectedRuntimeId` (mismatch → `snapshot_invalid`).
   - `sequence` is a non-negative finite integer (negative / NaN / non-integer → `snapshot_invalid`).
   - `schemaVersion === "1.0"` (otherwise → `snapshot_invalid`).
   - `snapshotId`, `createdAt`, `lastEventId` are strings.
   - `agents`, `tasks`, `artifacts`, `approvals`, `rooms` are arrays.
   - **Each entity in each array is structurally validated** (NOT deferred to the reducer):
     - **`AgentSnapshot`**: `agentId`/`runtimeId`/`name`/`lastEventAt` strings; `runtimeId === expectedRuntimeId`; `role` ∈ `{"orchestrator","worker","reviewer"}`; `status` ∈ `AgentStatus` enum (9 values); `currentTaskId`/`currentRoomId`/`blockedReason` are `string | null`; `capabilityGrants` is an array of `CapabilityGrant` (each with `grantId`/`principalId`/`capability`/`issuedBy` strings, `effect` ∈ `{"allow","deny","require_approval"}`, `scope` is object, `expiresAt` is `string | null`, `state` ∈ 5 values).
     - **`TaskSnapshot`**: `taskId`/`runtimeId`/`title`/`description`/`createdAt` strings; `runtimeId === expectedRuntimeId`; `status` ∈ `TaskStatus` (12 values); `priority` ∈ `Priority` (4 values); `parentTaskId`/`assigneeId`/`roomId`/`approvalId`/`startedAt`/`completedAt`/`blockedReason` are `string | null`; `dependencyIds`/`artifactIds` are string arrays.
     - **`ArtifactSnapshot`**: `artifactId`/`runtimeId`/`taskId`/`producerAgentId`/`type`/`title`/`createdAt` strings; `runtimeId === expectedRuntimeId`; `status` ∈ `ArtifactStatus` (7 values); `uri` is `string | null`; `version` is non-negative integer; `reviewResult` is `null` or `ArtifactReviewResult` (`reviewerId`/`comment`/`reviewedAt` strings, `verdict` ∈ 3 values).
     - **`ApprovalSnapshot`**: `approvalId`/`runtimeId`/`taskId`/`requestedBy`/`payloadRef`/`reason`/`createdAt` strings; `runtimeId === expectedRuntimeId`; `kind` ∈ 3 values; `status` ∈ `ApprovalStatus` (5 values); `resolvedBy`/`resolvedAt`/`expiresAt` are `string | null`.
     - **`RoomSnapshot`**: `roomId`/`runtimeId`/`name` strings; `runtimeId === expectedRuntimeId`; `type` ∈ `RoomType` (4 values); `bounds` is `{ x: number, y: number, width: number, height: number }` (all finite numbers, `width >= 0`, `height >= 0`); `activeAgentIds` is string array; `visualState` is object.
   - **Why deep (revised):** `SnapshotStore.setSnapshot()` installs the snapshot directly without re-validating entities through the reducer. A malformed `AgentSnapshot` (e.g. `{ agentId: 123, status: "banana" }`) would bypass the reducer entirely and corrupt Core state. The reducer only runs on subsequent events, not on the checkpoint itself. Deep validation at the boundary is therefore mandatory.
   - **Cross-entity referential integrity** (e.g. `currentTaskId` pointing to a non-existent task) is NOT validated here — it's a semantic concern, not a structural one, and may be added later as a separate pass.

2. **`DomainEvent`** (`validateEvent(raw, expectedRuntimeId)`):
   - `eventId`, `runtimeId`, `type`, `occurredAt`, `receivedAt`, `correlationId`, `traceId` are strings.
   - `runtimeId === expectedRuntimeId` (mismatch → `event_invalid`, NOT forwarded to `onEvent`).
   - `schemaVersion === "1.0"`.
   - `sequence` is a positive integer.
   - `causationId` is string or null.
   - `payload` is an object (deep shape left to reducer — events flow through `applyEvent` which does validate).
   - Returns `event_invalid` `RuntimeStreamError` on any failure.

3. **`AdapterCapabilities`** (`validateCapabilities(raw)`):
   - `supportedEvents`, `supportedCommands` are arrays of strings.
   - `features` is an object with the 6 boolean fields defined in `AdapterCapabilities`.
   - **Fallback is restricted to HTTP 404 and 501 only** (revised per Plan Review): a 401/403/500/network error/JSON corruption/validation failure MUST NOT trigger fallback — the adapter reports the real error. Only 404/501 (endpoint not implemented) may use `HttpSseAdapterOptions.fallbackCapabilities`; if no fallback configured → `capabilities_invalid`.

4. **`CommandResult`** (`validateCommandResult(raw, expectedCommandId)`):
   - `commandId === expectedCommandId` (mismatch → `command_response_invalid`).
   - `status` is `"accepted" | "rejected" | "error"`.
   - `affectedEventIds` is an array of strings.
   - If `status === "error"` or `"rejected"`, `error` must be present with `code: string` and `message: string`.

**Why not a dep:** `zod` adds ~8KB minified+gzipped, `ajv` adds JSON Schema draft overhead. The four validators above are ~400 lines total (the bulk being the deep snapshot entity checks). The shapes are stable (protocol v1.0). Adding a dep would violate the global constraint and provide no marginal safety over hand-written checks for this small surface area.

**Invalid payloads never reach Core:** validators are called in the adapter before `observer.onEvent(event)`, before `getSnapshot()` returns, before `execute()` returns, and before `getCapabilities()` returns. A validation failure on a snapshot/capabilities/command surfaces as a typed `RuntimeStreamError` (or `CommandResult { status: "error" }` for commands). A validation failure on an SSE event during replay rejects `ready` with `event_invalid`; during live it triggers `onError({ code: "event_invalid", recoverable: false })` and stream closure — **never silently dropped** (revised per Plan Review).

### B. Stream Ownership

**Decision:** Adapter performs **one stream attempt per `subscribe()`**. RuntimeSession is the **only** retry/resync owner.

**Adapter responsibilities:**
- Open the SSE stream via `fetch + ReadableStream`.
- Parse frames, validate events, deliver replay then live events via `observer.onEvent`.
- Resolve `ready` after replay continuity validation.
- On post-ready stream error: call `observer.onError(error)` then `observer.onState("error" | "reset_required")`. Do NOT attempt to reconnect.
- On `close()`: abort fetch, release reader, become idempotent.

**Session responsibilities:**
- Observe `onError` and `onState` from the subscription.
- On `recoverable=true` error: schedule a reconnect via `scheduleReconnect()` (single-flight, bounded backoff).
- On `reset_required` / `event_log_trimmed`: call `resynchronize()` (which fetches a new checkpoint and re-subscribes).
- On `recoverable=false` (auth_failed, protocol error): transition to `failed`, no retry.
- On `disconnect()`: abort the subscription (which aborts the fetch) and clear any pending reconnect timer.

**Why single owner:** Issue #6 explicitly warns "Do not let both the adapter and RuntimeSession independently run competing reconnect loops." Two owners would cause double-subscriptions, leaked fetches, and non-deterministic state. The Plan 1 `RuntimeStreamState` already excludes `"reconnecting"` — this decision is its enforcement.

### C. Ready Contract

`subscription.ready` resolves ONLY after ALL of:

1. HTTP response status is 2xx and `Content-Type` is `text/event-stream` (otherwise → `ready` rejects with `stream_open_failed`).
2. All replay frames (events with `sequence > afterSequence`) have been parsed and validated.
3. Replay sequences are contiguous starting from `afterSequence + 1`. First replay event must have `sequence === afterSequence + 1`. Each subsequent event's `sequence` must equal previous + 1. Gap → `ready` rejects with `event_log_trimmed` (`recoverable: true` — triggers resync).
4. Every replay event's `runtimeId === expectedRuntimeId`. Mismatch → `ready` rejects with `event_invalid` (`recoverable: false` — runtime corruption).
5. SSE `id:` field (when present) equals the event's `sequence`. Mismatch → `ready` rejects with `stream_protocol_error` (`recoverable: false`).
6. **An `event: replay-complete` control frame has been received** (see Architecture Decision H). This is the explicit end-of-replay signal — `reader.done` is NOT used (the stream is long-lived; `reader.done` only fires on server close or abort).
7. All replay events have been delivered to `observer.onEvent` (in order).
8. `observer.onState("ready")` has been called.
9. **The same reader continues receiving live frames** — no second reader, no second fetch, no second read loop. The single read loop transitions from "replay mode" to "live mode" upon receiving `replay-complete`.

**Ready rejects on:**
- Replay gap (non-contiguous sequence) → `event_log_trimmed`, `recoverable: true`.
- Runtime mismatch in a replay event → `event_invalid`, `recoverable: false`.
- Malformed event JSON → `event_invalid`, `recoverable: false` (the event is dropped; if it was a required replay event, `ready` rejects; if it was a live event, parsing continues).
- SSE `id` ≠ event `sequence` → `stream_protocol_error`, `recoverable: false`.
- Event log trimmed (server signals via SSE `event: reset-required` frame or HTTP 410) → `event_log_trimmed`, `recoverable: true`.
- Authentication failure (HTTP 401/403 during stream open) → `authentication_failed`, `recoverable: false`.
- Protocol failure (non-SSE response, malformed headers) → `stream_protocol_error`, `recoverable: false`.
- `close()` called before `ready` resolves → `aborted`, `recoverable: false`.
- **`replay-complete` frame missing** (stream closes or errors before `replay-complete` arrives) → `stream_protocol_error`, `recoverable: false` (server violated protocol).

**Ready rejection means no active stream remains:** the adapter aborts the fetch, releases the reader, and the session's `doConnect`/`doResynchronize` catch path calls `removeSubscription()` (which `await`s `close()` — idempotent on an already-aborted subscription).

### D. Post-Ready Error Mapping (revised per Plan Review)

| Stream condition | `RuntimeStreamError.code` | `recoverable` | Session state | `lastError.code` | Resync? | Retry? | Backoff | Max attempts | Terminal? |
|---|---|---|---|---|---|---|---|---|---|
| Network interruption (fetch rejects, reader returns `{ done: true }` unexpectedly) | `http_error` | `true` | `degraded` → reconnecting internally | (set on terminal only) | No | Yes — `scheduleReconnect()` | Exponential: 500ms, 1s, 2s, 4s, 8s, 16s, 30s cap, ±20% jitter | 10 | Yes — after 10 failures, transition to `failed` |
| Server sends `event: reset-required` | `event_log_trimmed` | `true` | `resynchronizing` | (cleared on success) | Yes — `resynchronize()` | No | None (immediate) | N/A | No (resync may itself fail → `failed`) |
| `event_log_trimmed` from gap in replay (caught at ready) | `event_log_trimmed` | `true` | (ready rejects → `doConnect` catch) | `subscribe_failed` | Yes — `resynchronize()` triggered by `doConnect`'s catch | No | None | N/A | No |
| Auth failure post-ready (server closes stream with 401 in keep-alive) | `authentication_failed` | `false` | `failed` | `subscribe_failed` (or `runtime_mismatch` if more specific) | No | No | N/A | N/A | Yes |
| `stream_protocol_error` (malformed SSE frame after ready) | `stream_protocol_error` | `false` | `failed` | `subscribe_failed` | No | No | N/A | N/A | Yes |
| `event_invalid` (malformed DomainEvent in live phase) | `event_invalid` | `false` | `failed` | `subscribe_failed` | No | No | N/A | N/A | Yes |
| `aborted` (intentional `close()` during ready) | `aborted` | `false` | (session is already in `resynchronizing` or `disconnected`) | (not set — intentional) | No | No | N/A | N/A | No |
| Post-ready stream error with `recoverable=true` but reconnect succeeds | (cleared) | — | `connected` | (cleared) | No | (n/a) | — | — | No |

**Backoff schedule:** `Math.min(30000, 500 * 2^attempt) * (0.8 + Math.random() * 0.4)` — base doubles each attempt, capped at 30s, jittered ±20%.

**Reconnect single-flight (revised per Plan Review):** single-flight is enforced by BOTH `reconnectTimer` (no duplicate timers) AND `reconnectPromise` (no overlapping resync attempts). See Architecture Decision J for the full state machine. The previous design relied only on `reconnectTimer`, which left a window: timer fires → clears `reconnectTimer` → resync starts → second error arrives → schedules a new timer → two concurrent resync attempts. The new `reconnectPromise` closes this window.

**Reconnect flow (revised — see Decision J for full state machine):**
1. Stream errors with `recoverable=true` → `observer.onError(error)` + `observer.onState("error")`.
2. Session observes `onError` → closes the current subscription first (to ensure no stale stream), then sets state `degraded`, then calls `scheduleReconnect()`.
3. `scheduleReconnect()` checks `reconnectPromise !== null` (in-flight) or `reconnectTimer !== null` (pending) → if either, return (single-flight). Otherwise sets `reconnectTimer`.
4. On timer fire: clears `reconnectTimer`, sets `reconnectPromise = doReconnect()`.
5. `doReconnect()` calls `resynchronizeOrThrow()` (new private method — see Decision J). On success: reset `reconnectAttempts`, state → `connected`. On failure: if `reconnectAttempts < maxAttempts`, `scheduleReconnect()` again; else state → `failed`.
6. `doReconnect()` finally block: clears `reconnectPromise`.
7. `disconnect()` at any point: clears `reconnectTimer`, awaits `reconnectPromise` if present (with epoch guard), aborts subscription, increments epoch.

**Why this is safe with Plan 1's `triggerResync()`:** `triggerResync()` is for replay-time gaps during `doConnect`'s `await ready`. Post-ready errors go through `onError` → `scheduleReconnect()` → `resynchronizeOrThrow()`. The two paths share `resyncPromise` (single-flight), so they cannot race. Plan 1's `connectPromise` guard in `resynchronize()` is bypassed only by `triggerResync()`, not by `scheduleReconnect()` — so an in-flight connect still blocks external resync, and post-ready reconnect waits for connect to settle.

### E. SSE Parser Contract

**Input:** string chunks (caller decodes `Uint8Array` via `new TextDecoder("utf-8", { fatal: false })` with `decoder.decode(chunk, { stream: true })` to handle UTF-8 boundaries).

**Output:** calls `handlers.onEvent(eventType, id, data)` for each complete frame; `handlers.onComment(text)` for heartbeats; `handlers.onError(error)` for malformed frames.

**Frame grammar (SSE spec compliant):**
```
frame := line* blank-line
line := field colon [space] value
field := "event" | "data" | "id" | "retry" | ":" (comment)
blank-line := (CR LF | LF | CR)
```

**Cases covered (each is a test in `sse-parser.test.ts`):**

1. **Fragmented chunks:** a single frame split across 3 `feed()` calls → one `onEvent`.
2. **Multiple frames per chunk:** 3 frames in one `feed()` → 3 `onEvent`.
3. **LF only:** frames separated by `\n` (not `\r\n`).
4. **CRLF:** frames separated by `\r\n`.
5. **Multi-line `data:`:** `data: line1\ndata: line2\n\n` → `data === "line1\nline2"` (per SSE spec, multiple `data:` fields join with `\n`).
6. **`id:` field:** `id: 42\ndata: {...}\n\n` → `id === "42"`.
7. **`event:` field:** `event: domain-event\ndata: {...}\n\n` → `eventType === "domain-event"`.
8. **Comment / heartbeat:** `: ping\n\n` → `onComment("ping")`, no `onEvent`.
9. **UTF-8 across chunks:** a multi-byte emoji split across two `feed()` calls → the `data` field contains the intact emoji. (Handled by `TextDecoder` with `stream: true` at the caller level — the parser itself only sees strings. Test verifies caller-level integration.)
10. **Blank line ends frame:** `data: x\n\n` → one `onEvent` with `data === "x"`.
11. **Final incomplete frame:** `feed("data: partial")` then `finish()` → `onEvent` is NOT called (incomplete frame is dropped per SSE spec).
12. **Malformed frame then valid frame:** `feed("garbage:not-a-field\n\n")` then `feed("data: ok\n\n")` → first yields `onError` (unknown field), second yields `onEvent` with `data === "ok"`. Parsing continues.
13. **JSON parse error in `data`:** the parser does NOT parse JSON — it delivers the raw `data` string to `handlers.onEvent`. The caller (adapter) parses JSON and validates. A JSON parse failure → `event_invalid` `RuntimeStreamError`, the event is dropped, parsing continues with the next frame.
14. **SSE `id` vs event `sequence` mismatch:** the adapter (not parser) compares `id` to `event.sequence` after JSON parse. Mismatch → `stream_protocol_error`.
15. **Reset-required response:** server sends `event: reset-required\ndata: {"reason":"trimmed"}\n\n` → parser yields `onEvent("reset-required", undefined, '{"reason":"trimmed"}')`. The adapter interprets this special event type and calls `handlers.onResetRequired(reason)` (or equivalently `observer.onError({ code: "event_log_trimmed", recoverable: true })`).

**Why a custom parser:** `EventSource` doesn't support custom headers (Issue #6 P0 requires auth headers). Existing SSE parser deps (`eventsource-parser`, `parse-sse`) would work but violate the "no new deps" constraint. The parser is ~100 lines.

### F. Command Contract

**Request:**
- Method: `POST`
- URL: `<baseUrl><endpoints.commands>` (default `/runtime/commands`)
- Headers:
  - `Content-Type: application/json`
  - `Idempotency-Key: <command.commandId>` (always, even if the server doesn't enforce it — for proxy/logging idempotency)
  - Auth headers from `resolveAuthHeaders()` (refreshed each call when a provider function is used)
- Body: `JSON.stringify(command)` (the `OfficeCommand` shape)
- `credentials`: from `HttpSseAdapterOptions.credentials` (default `"omit"` — no cookies unless explicitly configured)
- `signal`: `AbortController.signal` with a timeout

**Timeout:** `HttpSseAdapterOptions.commandTimeoutMs` (default 30000). On timeout, abort the fetch and return `CommandResult { status: "error", error: { code: "TIMEOUT", message: "Command timed out after 30000ms" }, affectedEventIds: [] }`.

**Response validation:** `validateCommandResult(raw, command.commandId)`. On validation failure: return `CommandResult { status: "error", error: { code: "COMMAND_RESPONSE_INVALID", message: "<detail>" }, affectedEventIds: [] }`.

**HTTP error mapping:**
- 2xx → parse and validate body.
- 4xx → `CommandResult { status: "error", error: { code: "HTTP_<status>", message: "<sanitized body>" } }`.
- 5xx → `CommandResult { status: "error", error: { code: "HTTP_<status>", message: "Server error" } }`.
- Network error / abort → `CommandResult { status: "error", error: { code: "NETWORK_ERROR" | "TIMEOUT" | "ABORTED", message: "..." } }`.

**No automatic retry:** the adapter returns whatever `CommandResult` it gets (including network errors). The `CommandGateway` already dedupes by `commandId` (pending + completed LRU cache), so a retry by the same caller would hit the cache or the pending-set. Retrying at the adapter level would bypass the gateway's idempotency cache and could double-execute on the server if the server doesn't enforce `Idempotency-Key`. The human may manually re-issue with a new `commandId` if they want to retry.

**Why no retry:** Issue #6 explicitly says "Never retry a command automatically unless the server contract proves the same `commandId` is idempotent." We do not assume server-side idempotency. Even if the server does enforce it, retrying in the adapter would add latency and complexity for marginal benefit — the human can retry in O(1s) by clicking again.

### G. Authentication

**Configuration:**
```ts
interface HttpSseAdapterOptions {
  // ... other fields ...
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  credentials?: RequestCredentials; // default "omit"
}
```

**Resolution (`resolveAuthHeaders`):**
- If `headers` is an object, return a shallow copy.
- If `headers` is a function, `await headers()` and return the result.
- If `headers` is undefined, return `{}`.
- Called fresh on every reconnect (so dynamic tokens refresh) and on every command POST.

**Token safety rules:**
1. **Never in URL:** auth headers go in the `Headers` object, never in query parameters.
2. **Never in logs:** `sanitizeHeadersForLog(headers)` returns a copy with `Authorization` → `"<redacted>"`, `Cookie` → `"<redacted>"`, `Set-Cookie` → `"<redacted>"`. Any header whose value starts with `Bearer ` becomes `"Bearer <redacted>"`. This is used in all diagnostic logging.
3. **Never in error messages:** `RuntimeStreamError.message` must not contain tokens. If a server returns `WWW-Authenticate: Bearer error="invalid_token"` in a response, the adapter's error message is `"Authentication failed (HTTP 401)"`, not the raw header.
4. **Never in `SessionDiagnostics`:** the `SessionError.message` field is whatever the adapter produces (already sanitized). The session does not add headers or request objects to diagnostics.
5. **Refreshed on reconnect:** `scheduleReconnect()` → `resynchronize()` → `doResynchronize()` → `adapter.subscribe()` → `subscribe()` calls `resolveAuthHeaders()` again. So a token expiring mid-session is recovered on the next reconnect.

**Test assertion:** a test in `auth.test.ts` constructs an adapter with `headers: { Authorization: "Bearer secret-token-123" }`, triggers an error, and asserts that `session.getDiagnostics().lastError.message` does not contain `"secret-token-123"` and that `console.error` spy (if used) never receives the token.

### H. Replay Completion Protocol (NEW per Plan Review)

**Problem:** The original plan used `reader.done` to mark the end of replay. But real SSE is a long-lived connection — `reader.done` only fires on server close or abort. On a healthy server, `reader.done` never fires during replay, so `ready` would never resolve and the session would hang in `synchronizing` forever. Conversely, if the server closed the stream to signal replay end, there would be no live stream afterward.

**Decision:** Introduce an explicit SSE control frame `event: replay-complete` to mark the boundary between replay and live. The adapter uses a **single read loop** that transitions from "replay mode" to "live mode" upon receiving this frame — no second reader, no second fetch, no second loop.

**Wire format:**
```
event: replay-complete
id: <lastReplayedSequence>
data: {"lastSequence": <lastReplayedSequence>}

```

- `event:` field is the literal string `replay-complete`.
- `id:` field is the sequence of the last replayed event (or `afterSequence` if no events were replayed — i.e. the checkpoint was already up-to-date).
- `data:` is a JSON object with a single field `lastSequence` (integer). This MUST equal the `id:` field. Mismatch → `stream_protocol_error`.
- The frame ends with a blank line (per SSE spec).

**Single Read Loop State Machine (Stream Pump):**

```
                  ┌─────────────────┐
                  │   OPENING       │
                  │ (fetch + reader │
                  │   acquired)     │
                  └────────┬────────┘
                           │ first chunk
                           ▼
                  ┌─────────────────┐
                  │   REPLAY        │
                  │ - parse frames  │
                  │ - validate      │
                  │ - deliver       │
                  │   onEvent       │
                  │ - check         │
                  │   contiguity    │
                  └────────┬────────┘
                           │ event: replay-complete
                           │ (validate lastSequence)
                           ▼
                  ┌─────────────────┐
                  │   READY         │
                  │ - onState("ready")
                  │ - ready.resolve()
                  └────────┬────────┘
                           │ continue same loop
                           ▼
                  ┌─────────────────┐
                  │   LIVE          │
                  │ - parse frames  │
                  │ - validate      │
                  │ - deliver       │
                  │   onEvent       │
                  │ - on reset-req: │
                  │   onError +     │
                  │   onState       │
                  │ - on error:     │
                  │   onError +     │
                  │   onState       │
                  └────────┬────────┘
                           │ reader.done / abort / error
                           ▼
                  ┌─────────────────┐
                  │   CLOSED        │
                  │ (terminal)      │
                  └─────────────────┘
```

**Transitions:**

| From | To | Trigger | Action |
|---|---|---|---|
| OPENING | REPLAY | first `reader.read()` returns chunk | start parsing |
| OPENING | CLOSED | fetch rejects / HTTP non-2xx / wrong content-type | reject `ready` with `stream_open_failed` |
| REPLAY | READY | `event: replay-complete` frame received, `lastSequence` matches last delivered sequence | `onState("ready")`, `ready.resolve()` |
| REPLAY | CLOSED | gap / runtime mismatch / malformed event / SSE id mismatch / auth failure | reject `ready` with typed error, abort fetch |
| REPLAY | CLOSED | `reader.done` before `replay-complete` | reject `ready` with `stream_protocol_error` (server violated protocol) |
| READY | LIVE | (implicit — same loop continues) | none |
| LIVE | CLOSED | `reader.done` (server closed) | `onError({ code: "http_error", recoverable: true })`, `onState("error")` |
| LIVE | CLOSED | `event: reset-required` frame | `onError({ code: "event_log_trimmed", recoverable: true })`, `onState("reset_required")` |
| LIVE | CLOSED | malformed frame / event_invalid | `onError({ code: ..., recoverable: false })`, `onState("error")` |
| LIVE | CLOSED | `close()` called | abort fetch, `onState("closed")` |

**Critical rules (revised per Plan Review):**
1. **One fetch, one reader, one loop.** The same `reader.read()` loop handles both replay and live frames. There is no "replay loop" followed by a "live loop" — there is one loop whose behavior changes when it sees `replay-complete`.
2. **`reader.done` is NOT a replay boundary.** It's a stream-close signal, handled as `http_error` (recoverable) in LIVE mode or `stream_protocol_error` (non-recoverable) in REPLAY mode.
3. **No second reader.** Creating a second reader would require a second `fetch`, which would open a second SSE connection — violating single-stream ownership.
4. **`replay-complete` is mandatory.** If the server closes the stream before sending it, `ready` rejects with `stream_protocol_error`. The server MUST send it even if the replay set is empty (in which case `lastSequence === afterSequence`).

**SSE Parser integration:** the parser's `onEvent(eventType, id, data)` callback receives `eventType === "replay-complete"` for this frame. The stream client handles it specially (transition state), not as a regular DomainEvent.

### I. Abort Ownership (NEW per Plan Review)

**Problem:** The original plan only aborted the SSE reader on `disconnect()`. But `disconnect()` must cancel ALL in-flight network operations: snapshot fetch, capabilities fetch, command POST, SSE stream open, SSE reader, and the reconnect timer. Leaving any of these running after `disconnect()` would leak resources and could cause post-disconnect state mutations.

**Decision:** Each `HttpSseRuntimeAdapter` instance owns a single `AbortController` (`lifecycleAbort`) that governs all in-flight operations. `disconnect()` calls `lifecycleAbort.abort()`. Each operation passes `lifecycleAbort.signal` to `fetch` (in addition to any per-operation timeout signal).

**Abort Ownership Table:**

| Operation | AbortController | Who creates it | Who aborts it | Cancellation behavior |
|---|---|---|---|---|
| `connect()` → `getCapabilities()` | `lifecycleAbort` (shared) | adapter constructor | `disconnect()` | `fetch` rejects with `AbortError` → adapter returns gracefully |
| `getSnapshot()` (called by session bootstrap & resync) | `lifecycleAbort` (shared) | adapter constructor | `disconnect()` | `fetch` rejects with `AbortError` → session surfaces `snapshot_failed` / `resync_failed` |
| `subscribe()` → stream open `fetch` | `lifecycleAbort` (shared) + `streamAbort` (per-subscription) | `subscribe()` | `close()` or `disconnect()` | both signals abort the stream `fetch` |
| `subscribe()` → `reader.read()` loop | `streamAbort` (per-subscription) | `subscribe()` | `close()` or `disconnect()` | `reader.read()` rejects with `AbortError` → loop exits |
| `execute()` → command POST `fetch` | `lifecycleAbort` (shared) + per-call timeout `AbortController` | `execute()` | timeout OR `disconnect()` | `fetch` rejects → returns `CommandResult { status: "error", error: { code: "TIMEOUT" \| "ABORTED" } }` |
| `resynchronize()` (in session) | n/a (delegates to adapter ops above) | session | `disconnect()` (epoch guard) | each delegated op checks abort |
| Reconnect timer | `reconnectTimer` handle | `scheduleReconnect()` | `disconnect()` or timer fire | `clearTimeout(reconnectTimer)` |
| Reconnect in-flight | `reconnectPromise` | `doReconnect()` | `disconnect()` (epoch guard) | epoch mismatch → bail out |

**Lifecycle:**
- `lifecycleAbort` is created in the adapter constructor and aborted exactly once in `disconnect()`. It is NOT reset on reconnect (a disconnected adapter stays disconnected — `connect()` must be called on a fresh adapter instance, matching the `RuntimeAdapter` contract). **Plan Review Fix 16, v3:** this one-time contract is enforced at runtime by an `if (this.lifecycleAbort.signal.aborted) throw …` guard at the top of `connect()`, so misuse fails loudly instead of producing a confusing silent `AbortError` from `fetchCapabilities`. Session-owned reconnect (Task 6) does NOT call `adapter.disconnect()` between attempts — only `subscription.close()` + `adapter.subscribe()` — so the same adapter instance survives across reconnects. Only a full session `disconnect()` aborts `lifecycleAbort`.
- `streamAbort` is created per-`subscribe()` call. It's aborted in `close()` (idempotent). A new subscription gets a fresh `streamAbort`.
- Per-call command timeout `AbortController` is created in each `execute()` call and discarded after. It's combined with `lifecycleAbort.signal` via `AbortSignal.any([lifecycleAbort.signal, timeoutSignal])` (Node 20 supports `AbortSignal.any`).

**`disconnect()` sequence:**
1. `lifecycleAbort.abort()` — cancels all in-flight fetches (snapshot, capabilities, command, stream open).
2. `streamAbort.abort()` (if a subscription is active) — cancels the reader.
3. `clearTimeout(reconnectTimer)` — cancels pending reconnect.
4. Await `reconnectPromise` (with epoch guard) — let any in-flight resync settle before final state transition.
5. `await removeSubscription()` — awaits `subscription.close()` (idempotent).

**Test coverage (Task 8):** integration tests MUST cover `disconnect()` during each of: snapshot fetch, command POST, stream opening, live read, reconnect backoff. The FakeServer can simulate slow responses to keep operations in-flight when `disconnect()` fires.

### J. Reconnect State Machine (NEW per Plan Review)

**Problem:** The original plan's reconnect logic had three flaws:
1. `resynchronize()` swallows errors internally (sets `failed` state but doesn't re-throw), so `doReconnect()`'s `await this.resynchronize()` would return normally even on failure, then incorrectly reset `reconnectAttempts` to 0.
2. `reconnectTimer` alone doesn't guarantee single-flight: after the timer fires and clears `reconnectTimer`, a second error arriving during the resync would schedule a second timer → two concurrent resync attempts.
3. Non-recoverable errors transitioned to `failed` without first closing the current subscription, potentially leaving a stale stream.

**Decision:** Introduce a private `resynchronizeOrThrow()` that re-throws on failure (for the reconnect controller's use), keep public `resynchronize()` swallow-compatible (for Plan 1 API compat), and enforce single-flight via `reconnectPromise`.

**New private method:**
```ts
private async resynchronizeOrThrow(): Promise<void> {
  // Same as doResynchronize() but does NOT catch — re-throws on failure.
  // Used by doReconnect() which needs to know success/failure.
  // The catch-and-set-failed logic stays in public resynchronize() for
  // external callers (Plan 1 API).
}
```

(Implementation: extract the body of `doResynchronize()` into `resynchronizeOrThrow()`. Public `resynchronize()` wraps it in try/catch and sets `failed` on error, preserving Plan 1 behavior. `doReconnect()` calls `resynchronizeOrThrow()` directly.)

**Reconnect State Machine:**

```
                  ┌─────────────────┐
                  │   CONNECTED     │
                  │ (steady state)  │
                  └────────┬────────┘
                           │ onError(recoverable=true)
                           │ (close subscription first)
                           ▼
                  ┌─────────────────┐
                  │   DEGRADED      │
                  │ reconnectTimer  │
                  │ pending         │
                  └────────┬────────┘
                           │ timer fires
                           │ (clear timer, set reconnectPromise)
                           ▼
                  ┌─────────────────┐
                  │   RECONNECTING  │
                  │ reconnectPromise│
                  │ in-flight       │
                  │ (resynchronize) │
                  └────────┬────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌─────────────────┐       ┌─────────────────┐
    │   CONNECTED     │       │   DEGRADED      │
    │ (success: reset │       │ (failure:       │
    │  attempts, clear│       │  attempts++,    │
    │  reconnectPromise)│     │  if < max:      │
    └─────────────────┘       │   scheduleReconnect()
                              │  else: FAILED)  │
                              └────────┬────────┘
                                       │ attempts >= max
                                       ▼
                              ┌─────────────────┐
                              │   FAILED        │
                              │ (terminal)      │
                              └─────────────────┘
```

**Single-flight rules (revised):**
- `scheduleReconnect()` checks BOTH `reconnectTimer !== null` AND `reconnectPromise !== null`. If either is set, it returns immediately (no-op). This closes the window where timer-fire → clear timer → resync starts → second error → new timer.
- `doReconnect()` sets `reconnectPromise` at entry, clears it in `finally`.
- `disconnect()` clears `reconnectTimer` and awaits `reconnectPromise` (with epoch guard) before final state transition.

**Non-recoverable error handling (revised):**
- On `onError(recoverable=false)`: the session FIRST calls `await removeSubscription()` (closes the stream), THEN sets `lastError`, THEN transitions to `failed`. This ensures no stale stream remains in a `failed` session.

**Reset-required handling:**
- On `onState("reset_required")`: the session calls `resynchronizeOrThrow()` directly (not `scheduleReconnect()` — reset is immediate, no backoff). If a `reconnectPromise` is already in-flight, the reset-required is queued (or coalesced — see implementation note in Task 6).

**Public API compatibility:**
- `resynchronize()` (public) — unchanged signature, swallows errors, sets `failed`. For external callers (e.g. UI "retry" button).
- `resynchronizeOrThrow()` (private) — re-throws. For internal reconnect controller.
- `scheduleReconnect()` (private) — unchanged signature, but adds `reconnectPromise` check.
- `doReconnect()` (private) — calls `resynchronizeOrThrow()`, resets `reconnectAttempts` on success, re-schedules on failure.

**ReconnectPolicy fields:**
```ts
interface ReconnectPolicy {
  initialDelayMs: number;   // default 500
  maxDelayMs: number;       // default 30000
  maxAttempts: number;      // default 10
  jitterRatio: number;      // default 0.2 (±20%)
}
```

---

## Tasks

9 tasks. Each ends with an independently testable deliverable and its own commit.

---

### Task 1: Wire Validators and Typed Transport Errors

**Goal:** Add repository-owned validators for `RuntimeSnapshot` (deep structural), `DomainEvent`, `AdapterCapabilities`, `CommandResult` and the `ReconnectPolicy` type to the protocol, with full test coverage. Also scaffold the new `http-sse` package and wire it into the root TypeScript project references so `npm run build` actually compiles it.

**Files:**
- Create: `packages/adapters/http-sse/package.json`
- Create: `packages/adapters/http-sse/tsconfig.json`
- Create: `packages/adapters/http-sse/src/validators.ts`
- Create: `packages/adapters/http-sse/src/validators.test.ts`
- Modify: `packages/protocol/src/index.ts` (additive: append `ReconnectPolicy` type + `defaultReconnectPolicy` const at end of file)
- Modify: `tsconfig.json` (root — add `packages/adapters/http-sse` to `references`)
- Modify: `package-lock.json` (regenerated by `npm install` after adding the workspace package)

**Interfaces:**
- Produces: `validateSnapshot(raw, expectedRuntimeId): Ok<RuntimeSnapshot> | ValidationError` (DEEP validation per Decision A), `validateEvent(raw, expectedRuntimeId): Ok<DomainEvent> | ValidationError`, `validateCapabilities(raw): Ok<AdapterCapabilities> | ValidationError`, `validateCommandResult(raw, expectedCommandId): Ok<CommandResult> | ValidationError`, `ReconnectPolicy` (in protocol), `defaultReconnectPolicy` (in protocol).
- `Ok<T>` = `{ ok: true; value: T }`, `ValidationError` = `{ ok: false; error: RuntimeStreamError }`.

- [ ] **Step 1: Create the http-sse package scaffold**

Create `packages/adapters/http-sse/package.json`:

```json
{
  "name": "@agent-office/adapter-http-sse",
  "version": "1.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "@agent-office/protocol": "1.0.0"
  },
  "devDependencies": {
    "@agent-office/core": "1.0.0"
  }
}
```

> Note: `@agent-office/core` is a `devDependency` because the package's production code depends only on `protocol`, but its tests (integration tests in Task 8) import `RuntimeSession`/`SnapshotStore`/`CommandGateway` from core.

Create `packages/adapters/http-sse/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"],
  "references": [
    { "path": "../../protocol" },
    { "path": "../../core" }
  ]
}
```

> Note: `core` is referenced because the integration tests (Task 8) import from `@agent-office/core`. Production code in this package only imports `@agent-office/protocol`.

- [ ] **Step 1b: Wire the new package into the root TypeScript project references**

Modify `tsconfig.json` (root) to add the new package to `references`:

```json
{
  "files": [],
  "references": [
    { "path": "packages/protocol" },
    { "path": "packages/core" },
    { "path": "packages/adapters/mock" },
    { "path": "packages/adapters/http-sse" },
    { "path": "packages/pixel-office" },
    { "path": "packages/control-ui" }
  ]
}
```

> This is critical: without this entry, `npm run build` (which runs `tsc -b`) would NOT compile the new package, masking type errors. (Plan Review P0 item 6.)

After creating the package and modifying the root tsconfig, run `npm install` from the repo root to update `package-lock.json` with the new workspace package. Verify the package is recognized:

```bash
npm ls @agent-office/adapter-http-sse
```

- [ ] **Step 2: Write the failing test for `validateSnapshot`** (DEEP validation per Decision A)

Create `packages/adapters/http-sse/src/validators.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  validateSnapshot,
  validateEvent,
  validateCapabilities,
  validateCommandResult,
} from "./validators.js";
import type {
  RuntimeSnapshot,
  DomainEvent,
  AdapterCapabilities,
  CommandResult,
} from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";

const RUNTIME_ID = "rt-test";

function makeValidSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID,
    snapshotId: `snap-${seq}`,
    sequence: seq,
    schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z",
    lastEventId: "",
    agents: [],
    tasks: [],
    artifacts: [],
    approvals: [],
    rooms: [],
  };
}

function makeValidEvent(seq: number): DomainEvent {
  return {
    eventId: `evt-${seq}`,
    runtimeId: RUNTIME_ID,
    sequence: seq,
    schemaVersion: "1.0",
    type: EventType.TASK_CREATED,
    occurredAt: "2026-07-04T00:00:00.000Z",
    receivedAt: "2026-07-04T00:00:00.000Z",
    correlationId: `corr-${seq}`,
    causationId: null,
    traceId: `trace-${seq}`,
    payload: {},
  };
}

function makeValidCapabilities(): AdapterCapabilities {
  return {
    supportedEvents: ["task.created"],
    supportedCommands: ["task.create"],
    features: {
      snapshot: true,
      sse: true,
      websocket: false,
      commandExecution: true,
      softMapping: false,
      hardOrchestration: false,
    },
  };
}

function makeValidCommandResult(): CommandResult {
  return {
    commandId: "cmd-1",
    status: "accepted",
    affectedEventIds: ["evt-1"],
  };
}

describe("validateSnapshot", () => {
  it("accepts a valid snapshot", () => {
    const r = validateSnapshot(makeValidSnapshot(5), RUNTIME_ID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sequence).toBe(5);
  });

  it("rejects runtimeId mismatch", () => {
    const snap = makeValidSnapshot();
    snap.runtimeId = "other-runtime";
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("snapshot_invalid");
  });

  it("rejects negative sequence", () => {
    const snap = makeValidSnapshot();
    snap.sequence = -1;
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("snapshot_invalid");
  });

  it("rejects non-integer sequence", () => {
    const snap = makeValidSnapshot();
    (snap as { sequence: number }).sequence = 1.5;
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects unsupported schemaVersion", () => {
    const snap = makeValidSnapshot();
    snap.schemaVersion = "2.0";
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("snapshot_invalid");
  });

  it("rejects missing agents array", () => {
    const snap = makeValidSnapshot();
    delete (snap as { agents?: unknown }).agents;
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects null input", () => {
    const r = validateSnapshot(null, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  // === DEEP validation tests (per Plan Review P0 item 2) ===

  it("rejects AgentSnapshot with non-string agentId", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: 123 as unknown as string, runtimeId: RUNTIME_ID, name: "a",
      role: "worker", status: "idle", currentTaskId: null, currentRoomId: null,
      capabilityGrants: [], lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("snapshot_invalid");
  });

  it("rejects AgentSnapshot with invalid status enum", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: "a1", runtimeId: RUNTIME_ID, name: "a",
      role: "worker", status: "banana" as unknown as string,
      currentTaskId: null, currentRoomId: null,
      capabilityGrants: [], lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects AgentSnapshot with invalid role enum", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: "a1", runtimeId: RUNTIME_ID, name: "a",
      role: "superuser" as unknown as string, status: "idle",
      currentTaskId: null, currentRoomId: null,
      capabilityGrants: [], lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects AgentSnapshot with runtimeId mismatch on entity", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: "a1", runtimeId: "other-runtime", name: "a",
      role: "worker", status: "idle", currentTaskId: null, currentRoomId: null,
      capabilityGrants: [], lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects CapabilityGrant with invalid effect enum", () => {
    const snap = makeValidSnapshot();
    snap.agents = [{
      agentId: "a1", runtimeId: RUNTIME_ID, name: "a",
      role: "worker", status: "idle", currentTaskId: null, currentRoomId: null,
      capabilityGrants: [{
        grantId: "g1", principalId: "p1", capability: "c",
        effect: "maybe" as unknown as "allow", scope: {},
        expiresAt: null, issuedBy: "u1", state: "active",
      }],
      lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects TaskSnapshot with invalid priority enum", () => {
    const snap = makeValidSnapshot();
    snap.tasks = [{
      taskId: "t1", runtimeId: RUNTIME_ID, title: "t", description: "d",
      status: "created", priority: "critical" as unknown as string,
      parentTaskId: null, assigneeId: null, roomId: null,
      dependencyIds: [], artifactIds: [], approvalId: null,
      createdAt: "2026-07-04T00:00:00Z", startedAt: null, completedAt: null,
      blockedReason: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects ArtifactSnapshot with negative version", () => {
    const snap = makeValidSnapshot();
    snap.artifacts = [{
      artifactId: "ar1", runtimeId: RUNTIME_ID, taskId: "t1",
      producerAgentId: "a1", type: "doc", title: "t", status: "draft",
      uri: null, version: -1, createdAt: "2026-07-04T00:00:00Z", reviewResult: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects ArtifactReviewResult with invalid verdict", () => {
    const snap = makeValidSnapshot();
    snap.artifacts = [{
      artifactId: "ar1", runtimeId: RUNTIME_ID, taskId: "t1",
      producerAgentId: "a1", type: "doc", title: "t", status: "draft",
      uri: null, version: 1, createdAt: "2026-07-04T00:00:00Z",
      reviewResult: {
        reviewerId: "r1", verdict: "maybe" as unknown as "approved",
        comment: "c", reviewedAt: "2026-07-04T00:00:00Z",
      },
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects ApprovalSnapshot with invalid kind enum", () => {
    const snap = makeValidSnapshot();
    snap.approvals = [{
      approvalId: "ap1", runtimeId: RUNTIME_ID, taskId: "t1",
      kind: "other" as unknown as "artifact_delivery", status: "requested",
      requestedBy: "u1", resolvedBy: null, payloadRef: "p", reason: "r",
      createdAt: "2026-07-04T00:00:00Z", resolvedAt: null, expiresAt: null,
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects RoomSnapshot with invalid bounds (negative width)", () => {
    const snap = makeValidSnapshot();
    snap.rooms = [{
      roomId: "r1", runtimeId: RUNTIME_ID, name: "r", type: "command",
      bounds: { x: 0, y: 0, width: -10, height: 10 },
      activeAgentIds: [], visualState: {},
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects RoomSnapshot with non-finite bounds.x", () => {
    const snap = makeValidSnapshot();
    snap.rooms = [{
      roomId: "r1", runtimeId: RUNTIME_ID, name: "r", type: "command",
      bounds: { x: NaN, y: 0, width: 10, height: 10 },
      activeAgentIds: [], visualState: {},
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects RoomSnapshot with invalid type enum", () => {
    const snap = makeValidSnapshot();
    snap.rooms = [{
      roomId: "r1", runtimeId: RUNTIME_ID, name: "r",
      type: "kitchen" as unknown as string,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      activeAgentIds: [], visualState: {},
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("accepts a fully-populated valid snapshot with all entity types", () => {
    const snap = makeValidSnapshot(5);
    snap.agents = [{
      agentId: "a1", runtimeId: RUNTIME_ID, name: "Alice",
      role: "orchestrator", status: "idle", currentTaskId: null, currentRoomId: "r1",
      capabilityGrants: [{
        grantId: "g1", principalId: "a1", capability: "task.create",
        effect: "allow", scope: {}, expiresAt: null, issuedBy: "system", state: "active",
      }],
      lastEventAt: "2026-07-04T00:00:00Z", blockedReason: null,
    }];
    snap.tasks = [{
      taskId: "t1", runtimeId: RUNTIME_ID, title: "Task 1", description: "desc",
      status: "created", priority: "normal",
      parentTaskId: null, assigneeId: "a1", roomId: "r1",
      dependencyIds: [], artifactIds: ["ar1"], approvalId: null,
      createdAt: "2026-07-04T00:00:00Z", startedAt: null, completedAt: null,
      blockedReason: null,
    }];
    snap.artifacts = [{
      artifactId: "ar1", runtimeId: RUNTIME_ID, taskId: "t1",
      producerAgentId: "a1", type: "document", title: "Doc", status: "draft",
      uri: "file:///doc.md", version: 1, createdAt: "2026-07-04T00:00:00Z",
      reviewResult: null,
    }];
    snap.approvals = [];
    snap.rooms = [{
      roomId: "r1", runtimeId: RUNTIME_ID, name: "Command",
      type: "command", bounds: { x: 0, y: 0, width: 100, height: 100 },
      activeAgentIds: ["a1"], visualState: {},
    }];
    const r = validateSnapshot(snap, RUNTIME_ID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.agents.length).toBe(1);
  });
});

describe("validateEvent", () => {
  it("accepts a valid event", () => {
    const r = validateEvent(makeValidEvent(1), RUNTIME_ID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sequence).toBe(1);
  });

  it("rejects runtimeId mismatch", () => {
    const ev = makeValidEvent(1);
    ev.runtimeId = "other";
    const r = validateEvent(ev, RUNTIME_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("event_invalid");
  });

  it("rejects zero sequence", () => {
    const ev = makeValidEvent(0);
    const r = validateEvent(ev, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects missing eventId", () => {
    const ev = makeValidEvent(1);
    delete (ev as { eventId?: string }).eventId;
    const r = validateEvent(ev, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });

  it("rejects non-string type", () => {
    const ev = makeValidEvent(1);
    (ev as { type: unknown }).type = 42;
    const r = validateEvent(ev, RUNTIME_ID);
    expect(r.ok).toBe(false);
  });
});

describe("validateCapabilities", () => {
  it("accepts valid capabilities", () => {
    const r = validateCapabilities(makeValidCapabilities());
    expect(r.ok).toBe(true);
  });

  it("rejects missing features", () => {
    const caps = makeValidCapabilities();
    delete (caps as { features?: unknown }).features;
    const r = validateCapabilities(caps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("capabilities_invalid");
  });

  it("rejects non-array supportedEvents", () => {
    const caps = makeValidCapabilities();
    (caps as { supportedEvents: unknown }).supportedEvents = "not-an-array";
    const r = validateCapabilities(caps);
    expect(r.ok).toBe(false);
  });
});

describe("validateCommandResult", () => {
  it("accepts a valid accepted result", () => {
    const r = validateCommandResult(makeValidCommandResult(), "cmd-1");
    expect(r.ok).toBe(true);
  });

  it("rejects commandId mismatch", () => {
    const r = validateCommandResult(makeValidCommandResult(), "cmd-other");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("command_response_invalid");
  });

  it("rejects invalid status", () => {
    const cr = makeValidCommandResult();
    (cr as { status: unknown }).status = "weird";
    const r = validateCommandResult(cr, "cmd-1");
    expect(r.ok).toBe(false);
  });

  it("rejects error status without error field", () => {
    const cr = makeValidCommandResult();
    cr.status = "error";
    delete (cr as { error?: unknown }).error;
    const r = validateCommandResult(cr, "cmd-1");
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/adapters/http-sse/src/validators.test.ts`
Expected: FAIL with "Cannot find module './validators.js'" (file does not exist yet).

- [ ] **Step 4: Implement the validators**

Create `packages/adapters/http-sse/src/validators.ts`:

```ts
import type {
  RuntimeSnapshot,
  DomainEvent,
  AdapterCapabilities,
  CommandResult,
  RuntimeStreamError,
} from "@agent-office/protocol";

export type Ok<T> = { ok: true; value: T };
export type ValidationError = { ok: false; error: RuntimeStreamError };

function fail(code: RuntimeStreamError["code"], message: string): ValidationError {
  return {
    ok: false,
    error: { code, message, recoverable: code === "event_log_trimmed" ? true : false },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isPosInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isBool(v: unknown): v is boolean {
  return typeof v === "boolean";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isOneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

const AGENT_ROLES = ["orchestrator", "worker", "reviewer"] as const;
const AGENT_STATUSES = [
  "offline", "idle", "planning", "working", "waiting",
  "reviewing", "blocked", "paused", "failed",
] as const;
const TASK_STATUSES = [
  "created", "queued", "assigned", "planning", "running",
  "waiting_approval", "reviewing", "revision_required",
  "blocked", "completed", "failed", "cancelled",
] as const;
const ARTIFACT_STATUSES = [
  "draft", "generated", "under_review", "revision_required",
  "approved", "rejected", "delivered",
] as const;
const APPROVAL_STATUSES = ["requested", "approved", "rejected", "expired", "cancelled"] as const;
const APPROVAL_KINDS = ["artifact_delivery", "tool_use", "data_writeback"] as const;
const CAPABILITY_EFFECTS = ["allow", "deny", "require_approval"] as const;
const CAPABILITY_STATES = ["requested", "active", "expired", "revoked", "denied"] as const;
const ROOM_TYPES = ["command", "execution", "review", "approval_delivery"] as const;
const REVIEW_VERDICTS = ["approved", "revision_required", "rejected"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

function validateCapabilityGrant(raw: unknown, expectedRuntimeId: string, idx: number): ValidationError | null {
  if (!isObject(raw)) return fail("snapshot_invalid", `agents.capabilityGrants[${idx}] is not an object`);
  if (!isString(raw.grantId)) return fail("snapshot_invalid", `capabilityGrants[${idx}].grantId missing`);
  if (!isString(raw.principalId)) return fail("snapshot_invalid", `capabilityGrants[${idx}].principalId missing`);
  if (!isString(raw.capability)) return fail("snapshot_invalid", `capabilityGrants[${idx}].capability missing`);
  if (!isOneOf(raw.effect, CAPABILITY_EFFECTS)) return fail("snapshot_invalid", `capabilityGrants[${idx}].effect invalid`);
  if (!isObject(raw.scope)) return fail("snapshot_invalid", `capabilityGrants[${idx}].scope must be object`);
  if (!isNullableString(raw.expiresAt)) return fail("snapshot_invalid", `capabilityGrants[${idx}].expiresAt must be string|null`);
  if (!isString(raw.issuedBy)) return fail("snapshot_invalid", `capabilityGrants[${idx}].issuedBy missing`);
  if (!isOneOf(raw.state, CAPABILITY_STATES)) return fail("snapshot_invalid", `capabilityGrants[${idx}].state invalid`);
  // principalId/issuedBy runtimeId check omitted (cross-entity semantic concern)
  return null;
}

function validateAgentSnapshot(raw: unknown, expectedRuntimeId: string, idx: number): ValidationError | null {
  if (!isObject(raw)) return fail("snapshot_invalid", `agents[${idx}] is not an object`);
  if (!isString(raw.agentId)) return fail("snapshot_invalid", `agents[${idx}].agentId missing`);
  if (!isString(raw.runtimeId)) return fail("snapshot_invalid", `agents[${idx}].runtimeId missing`);
  if (raw.runtimeId !== expectedRuntimeId) return fail("snapshot_invalid", `agents[${idx}].runtimeId mismatch`);
  if (!isString(raw.name)) return fail("snapshot_invalid", `agents[${idx}].name missing`);
  if (!isOneOf(raw.role, AGENT_ROLES)) return fail("snapshot_invalid", `agents[${idx}].role invalid`);
  if (!isOneOf(raw.status, AGENT_STATUSES)) return fail("snapshot_invalid", `agents[${idx}].status invalid`);
  if (!isNullableString(raw.currentTaskId)) return fail("snapshot_invalid", `agents[${idx}].currentTaskId must be string|null`);
  if (!isNullableString(raw.currentRoomId)) return fail("snapshot_invalid", `agents[${idx}].currentRoomId must be string|null`);
  if (!isNullableString(raw.blockedReason)) return fail("snapshot_invalid", `agents[${idx}].blockedReason must be string|null`);
  if (!isString(raw.lastEventAt)) return fail("snapshot_invalid", `agents[${idx}].lastEventAt missing`);
  if (!Array.isArray(raw.capabilityGrants)) return fail("snapshot_invalid", `agents[${idx}].capabilityGrants must be array`);
  for (let i = 0; i < raw.capabilityGrants.length; i++) {
    const e = validateCapabilityGrant(raw.capabilityGrants[i], expectedRuntimeId, i);
    if (e) return e;
  }
  return null;
}

function validateTaskSnapshot(raw: unknown, expectedRuntimeId: string, idx: number): ValidationError | null {
  if (!isObject(raw)) return fail("snapshot_invalid", `tasks[${idx}] is not an object`);
  if (!isString(raw.taskId)) return fail("snapshot_invalid", `tasks[${idx}].taskId missing`);
  if (!isString(raw.runtimeId)) return fail("snapshot_invalid", `tasks[${idx}].runtimeId missing`);
  if (raw.runtimeId !== expectedRuntimeId) return fail("snapshot_invalid", `tasks[${idx}].runtimeId mismatch`);
  if (!isString(raw.title)) return fail("snapshot_invalid", `tasks[${idx}].title missing`);
  if (!isString(raw.description)) return fail("snapshot_invalid", `tasks[${idx}].description missing`);
  if (!isOneOf(raw.status, TASK_STATUSES)) return fail("snapshot_invalid", `tasks[${idx}].status invalid`);
  if (!isOneOf(raw.priority, PRIORITIES)) return fail("snapshot_invalid", `tasks[${idx}].priority invalid`);
  if (!isNullableString(raw.parentTaskId)) return fail("snapshot_invalid", `tasks[${idx}].parentTaskId must be string|null`);
  if (!isNullableString(raw.assigneeId)) return fail("snapshot_invalid", `tasks[${idx}].assigneeId must be string|null`);
  if (!isNullableString(raw.roomId)) return fail("snapshot_invalid", `tasks[${idx}].roomId must be string|null`);
  if (!isNullableString(raw.approvalId)) return fail("snapshot_invalid", `tasks[${idx}].approvalId must be string|null`);
  if (!isString(raw.createdAt)) return fail("snapshot_invalid", `tasks[${idx}].createdAt missing`);
  if (!isNullableString(raw.startedAt)) return fail("snapshot_invalid", `tasks[${idx}].startedAt must be string|null`);
  if (!isNullableString(raw.completedAt)) return fail("snapshot_invalid", `tasks[${idx}].completedAt must be string|null`);
  if (!isNullableString(raw.blockedReason)) return fail("snapshot_invalid", `tasks[${idx}].blockedReason must be string|null`);
  if (!isStringArray(raw.dependencyIds)) return fail("snapshot_invalid", `tasks[${idx}].dependencyIds must be string array`);
  if (!isStringArray(raw.artifactIds)) return fail("snapshot_invalid", `tasks[${idx}].artifactIds must be string array`);
  return null;
}

function validateArtifactReviewResult(raw: unknown, idx: number): ValidationError | null {
  if (!isObject(raw)) return fail("snapshot_invalid", `artifacts[${idx}].reviewResult is not an object`);
  if (!isString(raw.reviewerId)) return fail("snapshot_invalid", `artifacts[${idx}].reviewResult.reviewerId missing`);
  if (!isOneOf(raw.verdict, REVIEW_VERDICTS)) return fail("snapshot_invalid", `artifacts[${idx}].reviewResult.verdict invalid`);
  if (!isString(raw.comment)) return fail("snapshot_invalid", `artifacts[${idx}].reviewResult.comment missing`);
  if (!isString(raw.reviewedAt)) return fail("snapshot_invalid", `artifacts[${idx}].reviewResult.reviewedAt missing`);
  return null;
}

function validateArtifactSnapshot(raw: unknown, expectedRuntimeId: string, idx: number): ValidationError | null {
  if (!isObject(raw)) return fail("snapshot_invalid", `artifacts[${idx}] is not an object`);
  if (!isString(raw.artifactId)) return fail("snapshot_invalid", `artifacts[${idx}].artifactId missing`);
  if (!isString(raw.runtimeId)) return fail("snapshot_invalid", `artifacts[${idx}].runtimeId missing`);
  if (raw.runtimeId !== expectedRuntimeId) return fail("snapshot_invalid", `artifacts[${idx}].runtimeId mismatch`);
  if (!isString(raw.taskId)) return fail("snapshot_invalid", `artifacts[${idx}].taskId missing`);
  if (!isString(raw.producerAgentId)) return fail("snapshot_invalid", `artifacts[${idx}].producerAgentId missing`);
  if (!isString(raw.type)) return fail("snapshot_invalid", `artifacts[${idx}].type missing`);
  if (!isString(raw.title)) return fail("snapshot_invalid", `artifacts[${idx}].title missing`);
  if (!isOneOf(raw.status, ARTIFACT_STATUSES)) return fail("snapshot_invalid", `artifacts[${idx}].status invalid`);
  if (!isNullableString(raw.uri)) return fail("snapshot_invalid", `artifacts[${idx}].uri must be string|null`);
  if (!isNonNegInt(raw.version)) return fail("snapshot_invalid", `artifacts[${idx}].version must be non-negative integer`);
  if (!isString(raw.createdAt)) return fail("snapshot_invalid", `artifacts[${idx}].createdAt missing`);
  if (raw.reviewResult !== null) {
    if (!isObject(raw.reviewResult)) return fail("snapshot_invalid", `artifacts[${idx}].reviewResult must be object|null`);
    const e = validateArtifactReviewResult(raw.reviewResult, idx);
    if (e) return e;
  }
  return null;
}

function validateApprovalSnapshot(raw: unknown, expectedRuntimeId: string, idx: number): ValidationError | null {
  if (!isObject(raw)) return fail("snapshot_invalid", `approvals[${idx}] is not an object`);
  if (!isString(raw.approvalId)) return fail("snapshot_invalid", `approvals[${idx}].approvalId missing`);
  if (!isString(raw.runtimeId)) return fail("snapshot_invalid", `approvals[${idx}].runtimeId missing`);
  if (raw.runtimeId !== expectedRuntimeId) return fail("snapshot_invalid", `approvals[${idx}].runtimeId mismatch`);
  if (!isString(raw.taskId)) return fail("snapshot_invalid", `approvals[${idx}].taskId missing`);
  if (!isOneOf(raw.kind, APPROVAL_KINDS)) return fail("snapshot_invalid", `approvals[${idx}].kind invalid`);
  if (!isOneOf(raw.status, APPROVAL_STATUSES)) return fail("snapshot_invalid", `approvals[${idx}].status invalid`);
  if (!isString(raw.requestedBy)) return fail("snapshot_invalid", `approvals[${idx}].requestedBy missing`);
  if (!isNullableString(raw.resolvedBy)) return fail("snapshot_invalid", `approvals[${idx}].resolvedBy must be string|null`);
  if (!isString(raw.payloadRef)) return fail("snapshot_invalid", `approvals[${idx}].payloadRef missing`);
  if (!isString(raw.reason)) return fail("snapshot_invalid", `approvals[${idx}].reason missing`);
  if (!isString(raw.createdAt)) return fail("snapshot_invalid", `approvals[${idx}].createdAt missing`);
  if (!isNullableString(raw.resolvedAt)) return fail("snapshot_invalid", `approvals[${idx}].resolvedAt must be string|null`);
  if (!isNullableString(raw.expiresAt)) return fail("snapshot_invalid", `approvals[${idx}].expiresAt must be string|null`);
  return null;
}

function validateRoomSnapshot(raw: unknown, expectedRuntimeId: string, idx: number): ValidationError | null {
  if (!isObject(raw)) return fail("snapshot_invalid", `rooms[${idx}] is not an object`);
  if (!isString(raw.roomId)) return fail("snapshot_invalid", `rooms[${idx}].roomId missing`);
  if (!isString(raw.runtimeId)) return fail("snapshot_invalid", `rooms[${idx}].runtimeId missing`);
  if (raw.runtimeId !== expectedRuntimeId) return fail("snapshot_invalid", `rooms[${idx}].runtimeId mismatch`);
  if (!isString(raw.name)) return fail("snapshot_invalid", `rooms[${idx}].name missing`);
  if (!isOneOf(raw.type, ROOM_TYPES)) return fail("snapshot_invalid", `rooms[${idx}].type invalid`);
  if (!isObject(raw.bounds)) return fail("snapshot_invalid", `rooms[${idx}].bounds must be object`);
  const b = raw.bounds;
  if (!isFiniteNumber(b.x)) return fail("snapshot_invalid", `rooms[${idx}].bounds.x must be finite number`);
  if (!isFiniteNumber(b.y)) return fail("snapshot_invalid", `rooms[${idx}].bounds.y must be finite number`);
  if (!isFiniteNumber(b.width) || b.width < 0) return fail("snapshot_invalid", `rooms[${idx}].bounds.width must be >= 0`);
  if (!isFiniteNumber(b.height) || b.height < 0) return fail("snapshot_invalid", `rooms[${idx}].bounds.height must be >= 0`);
  if (!isStringArray(raw.activeAgentIds)) return fail("snapshot_invalid", `rooms[${idx}].activeAgentIds must be string array`);
  if (!isObject(raw.visualState)) return fail("snapshot_invalid", `rooms[${idx}].visualState must be object`);
  return null;
}

export function validateSnapshot(
  raw: unknown,
  expectedRuntimeId: string
): Ok<RuntimeSnapshot> | ValidationError {
  if (!isObject(raw)) return fail("snapshot_invalid", "snapshot is not an object");
  if (!isString(raw.runtimeId)) return fail("snapshot_invalid", "runtimeId missing or not string");
  if (raw.runtimeId !== expectedRuntimeId) {
    return fail("snapshot_invalid", `runtimeId mismatch: expected ${expectedRuntimeId}, got ${raw.runtimeId}`);
  }
  if (!isString(raw.snapshotId)) return fail("snapshot_invalid", "snapshotId missing");
  if (!isNonNegInt(raw.sequence)) return fail("snapshot_invalid", "sequence must be a non-negative integer");
  if (raw.schemaVersion !== "1.0") return fail("snapshot_invalid", `unsupported schemaVersion: ${String(raw.schemaVersion)}`);
  if (!isString(raw.createdAt)) return fail("snapshot_invalid", "createdAt missing");
  if (!isString(raw.lastEventId)) return fail("snapshot_invalid", "lastEventId missing");
  if (!Array.isArray(raw.agents)) return fail("snapshot_invalid", "agents must be an array");
  if (!Array.isArray(raw.tasks)) return fail("snapshot_invalid", "tasks must be an array");
  if (!Array.isArray(raw.artifacts)) return fail("snapshot_invalid", "artifacts must be an array");
  if (!Array.isArray(raw.approvals)) return fail("snapshot_invalid", "approvals must be an array");
  if (!Array.isArray(raw.rooms)) return fail("snapshot_invalid", "rooms must be an array");
  // DEEP structural validation per Plan Review (Issue 1, v3):
  // Validate every entity — SnapshotStore.setSnapshot() installs directly without
  // routing entities through the reducer, so shallow "is array" checks would let
  // malformed entities (e.g. { agentId: 123, status: "banana" }) corrupt Core.
  for (let i = 0; i < raw.agents.length; i++) {
    const e = validateAgentSnapshot(raw.agents[i], expectedRuntimeId, i);
    if (e) return e;
  }
  for (let i = 0; i < raw.tasks.length; i++) {
    const e = validateTaskSnapshot(raw.tasks[i], expectedRuntimeId, i);
    if (e) return e;
  }
  for (let i = 0; i < raw.artifacts.length; i++) {
    const e = validateArtifactSnapshot(raw.artifacts[i], expectedRuntimeId, i);
    if (e) return e;
  }
  for (let i = 0; i < raw.approvals.length; i++) {
    const e = validateApprovalSnapshot(raw.approvals[i], expectedRuntimeId, i);
    if (e) return e;
  }
  for (let i = 0; i < raw.rooms.length; i++) {
    const e = validateRoomSnapshot(raw.rooms[i], expectedRuntimeId, i);
    if (e) return e;
  }
  return { ok: true, value: raw as RuntimeSnapshot };
}

export function validateEvent(
  raw: unknown,
  expectedRuntimeId: string
): Ok<DomainEvent> | ValidationError {
  if (!isObject(raw)) return fail("event_invalid", "event is not an object");
  if (!isString(raw.eventId)) return fail("event_invalid", "eventId missing");
  if (!isString(raw.runtimeId)) return fail("event_invalid", "runtimeId missing");
  if (raw.runtimeId !== expectedRuntimeId) {
    return fail("event_invalid", `runtimeId mismatch: expected ${expectedRuntimeId}, got ${raw.runtimeId}`);
  }
  if (!isPosInt(raw.sequence)) return fail("event_invalid", "sequence must be a positive integer");
  if (raw.schemaVersion !== "1.0") return fail("event_invalid", `unsupported schemaVersion: ${String(raw.schemaVersion)}`);
  if (!isString(raw.type)) return fail("event_invalid", "type missing or not string");
  if (!isString(raw.occurredAt)) return fail("event_invalid", "occurredAt missing");
  if (!isString(raw.receivedAt)) return fail("event_invalid", "receivedAt missing");
  if (!isString(raw.correlationId)) return fail("event_invalid", "correlationId missing");
  if (raw.causationId !== null && !isString(raw.causationId)) return fail("event_invalid", "causationId must be string or null");
  if (!isString(raw.traceId)) return fail("event_invalid", "traceId missing");
  if (!isObject(raw.payload)) return fail("event_invalid", "payload must be an object");
  return { ok: true, value: raw as DomainEvent };
}

export function validateCapabilities(raw: unknown): Ok<AdapterCapabilities> | ValidationError {
  if (!isObject(raw)) return fail("capabilities_invalid", "capabilities is not an object");
  if (!isStringArray(raw.supportedEvents)) return fail("capabilities_invalid", "supportedEvents must be a string array");
  if (!isStringArray(raw.supportedCommands)) return fail("capabilities_invalid", "supportedCommands must be a string array");
  if (!isObject(raw.features)) return fail("capabilities_invalid", "features missing");
  const f = raw.features;
  const boolFields = ["snapshot", "sse", "websocket", "commandExecution", "softMapping", "hardOrchestration"];
  for (const k of boolFields) {
    if (!isBool(f[k])) return fail("capabilities_invalid", `features.${k} must be boolean`);
  }
  return { ok: true, value: raw as AdapterCapabilities };
}

export function validateCommandResult(
  raw: unknown,
  expectedCommandId: string
): Ok<CommandResult> | ValidationError {
  if (!isObject(raw)) return fail("command_response_invalid", "result is not an object");
  if (!isString(raw.commandId)) return fail("command_response_invalid", "commandId missing");
  if (raw.commandId !== expectedCommandId) {
    return fail("command_response_invalid", `commandId mismatch: expected ${expectedCommandId}, got ${raw.commandId}`);
  }
  if (raw.status !== "accepted" && raw.status !== "rejected" && raw.status !== "error") {
    return fail("command_response_invalid", `invalid status: ${String(raw.status)}`);
  }
  if (!isStringArray(raw.affectedEventIds)) return fail("command_response_invalid", "affectedEventIds must be a string array");
  if (raw.status === "error" || raw.status === "rejected") {
    if (!isObject(raw.error)) return fail("command_response_invalid", "error field required for error/rejected status");
    if (!isString(raw.error.code)) return fail("command_response_invalid", "error.code must be string");
    if (!isString(raw.error.message)) return fail("command_response_invalid", "error.message must be string");
  }
  return { ok: true, value: raw as CommandResult };
}
```

- [ ] **Step 5: Add `ReconnectPolicy` to the protocol**

Append to `packages/protocol/src/index.ts` (after the existing `RuntimeSubscription` block, before `EventApplyResult`):

```ts
// ─── Reconnect Policy (Issue #6 Plan 2) ─────────────────────

/**
 * Reconnect 退避策略。RuntimeSession 在 post-ready recoverable 错误时使用。
 *
 * - initialDelayMs: 首次重连等待时间（默认 500ms）
 * - maxDelayMs: 单次重连最大等待时间（默认 30000ms）
 * - maxAttempts: 最大重连次数（默认 10）；超过后转 failed
 * - jitterRatio: 抖动比例（默认 0.2，即 ±20%）
 *
 * 退避公式：delay = min(maxDelayMs, initialDelayMs * 2^attempt) * (1 ± jitterRatio)
 */
export interface ReconnectPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
  maxAttempts: number;
  jitterRatio: number;
}

export const defaultReconnectPolicy: ReconnectPolicy = {
  initialDelayMs: 500,
  maxDelayMs: 30000,
  maxAttempts: 10,
  jitterRatio: 0.2,
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run packages/adapters/http-sse/src/validators.test.ts`
Expected: PASS — all validator tests green.

- [ ] **Step 7: Run full suite + build gate**

Run: `npm test`
Expected: PASS — 118 (Plan 1) + 16 (new validator tests) = 134 tests.

Run: `npm run build`
Expected: PASS — `tsc -b` succeeds (protocol has new types, http-sse package compiles).

- [ ] **Step 8: Commit**

```bash
git add packages/adapters/http-sse/package.json packages/adapters/http-sse/tsconfig.json packages/adapters/http-sse/src/validators.ts packages/adapters/http-sse/src/validators.test.ts packages/protocol/src/index.ts tsconfig.json package-lock.json
git commit -m "feat(protocol,http-sse): add runtime validators and ReconnectPolicy (#6 Plan 2 Task 1)"
```

**Compatibility:** Pure additive. No existing types changed. No existing tests touched. Mock/Core packages unaffected.

**Rollback:** `git revert <commit>` — removes the new package directory and the protocol additions. No downstream code depends on `ReconnectPolicy` yet.

---

### Task 2: Standalone SSE Parser

**Goal:** Implement a spec-compliant SSE frame parser that handles all chunk-boundary edge cases. Zero deps. Tested exhaustively.

**Files:**
- Create: `packages/adapters/http-sse/src/sse-parser.ts`
- Create: `packages/adapters/http-sse/src/sse-parser.test.ts`

**Interfaces:**
- Produces: `createSseParser(handlers: SseParserHandlers): SseParser`
- `SseParserHandlers` = `{ onEvent(eventType: string | undefined, id: string | undefined, data: string): void; onComment(text: string): void; onError(error: Error): void }`
- `SseParser` = `{ feed(chunk: string): void; finish(): void }`

- [ ] **Step 1: Write the failing test**

Create `packages/adapters/http-sse/src/sse-parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createSseParser } from "./sse-parser.js";

function capture() {
  const events: Array<{ event?: string; id?: string; data: string }> = [];
  const comments: string[] = [];
  const errors: Error[] = [];
  const parser = createSseParser({
    onEvent: (eventType, id, data) => events.push({ event: eventType, id, data }),
    onComment: (text) => comments.push(text),
    onError: (err) => errors.push(err),
  });
  return { parser, events, comments, errors };
}

describe("SSE parser", () => {
  it("parses a single complete frame in one chunk", () => {
    const c = capture();
    c.parser.feed("event: domain-event\ndata: {\"seq\":1}\n\n");
    expect(c.events).toHaveLength(1);
    expect(c.events[0].event).toBe("domain-event");
    expect(c.events[0].data).toBe('{"seq":1}');
  });

  it("parses a frame fragmented across 3 chunks", () => {
    const c = capture();
    c.parser.feed("event: domain-e");
    c.parser.feed("vent\ndata: {\"seq\"");
    c.parser.feed(":1}\n\n");
    expect(c.events).toHaveLength(1);
    expect(c.events[0].event).toBe("domain-event");
    expect(c.events[0].data).toBe('{"seq":1}');
  });

  it("parses 3 frames in one chunk", () => {
    const c = capture();
    c.parser.feed("data: a\n\ndata: b\n\ndata: c\n\n");
    expect(c.events).toHaveLength(3);
    expect(c.events.map((e) => e.data)).toEqual(["a", "b", "c"]);
  });

  it("handles LF-only line endings", () => {
    const c = capture();
    c.parser.feed("data: x\n\n");
    expect(c.events).toHaveLength(1);
  });

  it("handles CRLF line endings", () => {
    const c = capture();
    c.parser.feed("data: x\r\n\r\n");
    expect(c.events).toHaveLength(1);
  });

  it("joins multi-line data fields with \\n", () => {
    const c = capture();
    c.parser.feed("data: line1\ndata: line2\n\n");
    expect(c.events[0].data).toBe("line1\nline2");
  });

  it("captures id field", () => {
    const c = capture();
    c.parser.feed("id: 42\ndata: x\n\n");
    expect(c.events[0].id).toBe("42");
  });

  it("captures event field", () => {
    const c = capture();
    c.parser.feed("event: reset-required\ndata: {}\n\n");
    expect(c.events[0].event).toBe("reset-required");
  });

  it("treats comment lines (starting with :) as comments, not events", () => {
    const c = capture();
    c.parser.feed(": heartbeat\n\n");
    expect(c.events).toHaveLength(0);
    expect(c.comments).toHaveLength(1);
    expect(c.comments[0]).toBe("heartbeat");
  });

  it("drops incomplete final frame on finish()", () => {
    const c = capture();
    c.parser.feed("data: partial");
    c.parser.finish();
    expect(c.events).toHaveLength(0);
  });

  it("continues parsing after a malformed frame", () => {
    const c = capture();
    c.parser.feed("garbage:not-a-field\n\ndata: ok\n\n");
    expect(c.errors).toHaveLength(1);
    expect(c.events).toHaveLength(1);
    expect(c.events[0].data).toBe("ok");
  });

  it("handles empty data field", () => {
    const c = capture();
    c.parser.feed("data:\n\n");
    expect(c.events).toHaveLength(1);
    expect(c.events[0].data).toBe("");
  });

  it("handles UTF-8 emoji in data (already decoded to string)", () => {
    const c = capture();
    c.parser.feed("data: 🎉\n\n");
    expect(c.events[0].data).toBe("🎉");
  });

  it("resets event type after dispatching (next frame has no event unless set)", () => {
    const c = capture();
    c.parser.feed("event: domain-event\ndata: a\n\ndata: b\n\n");
    expect(c.events[0].event).toBe("domain-event");
    expect(c.events[1].event).toBeUndefined();
  });

  it("ignores retry field (per spec, but does not error)", () => {
    const c = capture();
    c.parser.feed("retry: 5000\ndata: x\n\n");
    expect(c.events).toHaveLength(1);
    expect(c.errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/http-sse/src/sse-parser.test.ts`
Expected: FAIL — "Cannot find module './sse-parser.js'".

- [ ] **Step 3: Implement the parser**

Create `packages/adapters/http-sse/src/sse-parser.ts`:

```ts
/**
 * Standalone SSE frame parser. Operates on strings (caller decodes bytes via
 * TextDecoder with stream:true to handle UTF-8 chunk boundaries).
 *
 * Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export interface SseParserHandlers {
  onEvent(eventType: string | undefined, id: string | undefined, data: string): void;
  onComment(text: string): void;
  onError(error: Error): void;
}

export interface SseParser {
  feed(chunk: string): void;
  finish(): void;
}

export function createSseParser(handlers: SseParserHandlers): SseParser {
  let buffer = "";
  let currentEvent: string | undefined = undefined;
  let currentId: string | undefined = undefined;
  let currentData: string[] = [];

  function dispatchFrame(): void {
    // Empty frame (no data, no event, no id) — per spec, still dispatches with empty data
    // But if data array is empty and no event/id, treat as no-op to avoid noise.
    if (currentData.length === 0 && currentEvent === undefined && currentId === undefined) {
      // reset for next frame
      currentEvent = undefined;
      currentId = undefined;
      currentData = [];
      return;
    }
    const data = currentData.join("\n");
    try {
      handlers.onEvent(currentEvent, currentId, data);
    } finally {
      // Per spec: event type resets after dispatch; id persists; data resets.
      currentEvent = undefined;
      currentData = [];
      // currentId persists per spec (Last-Event-ID), but for our use case we reset per frame
      // since each frame carries its own id.
      currentId = undefined;
    }
  }

  function processLine(line: string): void {
    if (line === "") {
      // blank line = frame dispatch
      dispatchFrame();
      return;
    }
    if (line.startsWith(":")) {
      // comment — per SSE spec, strip exactly one leading space after the colon
      // (Plan Review Fix 10, v3: previously `line.slice(1)` left the leading
      // space, so `: heartbeat` produced ` heartbeat` instead of `heartbeat`.)
      let comment = line.slice(1);
      if (comment.startsWith(" ")) comment = comment.slice(1);
      handlers.onComment(comment);
      return;
    }
    let field: string;
    let value: string;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      field = line;
      value = "";
    } else {
      field = line.slice(0, colonIdx);
      // per spec, if value starts with a space, strip exactly one leading space
      value = line.slice(colonIdx + 1);
      if (value.startsWith(" ")) value = value.slice(1);
    }
    switch (field) {
      case "event":
        currentEvent = value;
        break;
      case "data":
        currentData.push(value);
        break;
      case "id":
        currentId = value;
        break;
      case "retry":
        // ignored — we don't use server-suggested retry intervals
        break;
      default:
        // Per SSE spec, unknown fields MUST be ignored (not fatal).
        // (Plan Review Fix 11, v3: previously called handlers.onError, which
        // could trigger stream_protocol_error on servers sending extensions
        // like `:foo` or future SSE fields. Now silently ignored.)
        break;
    }
  }

  function feed(chunk: string): void {
    buffer += chunk;
    // Process complete lines (terminated by \n, \r\n, or \r)
    let idx: number;
    while ((idx = findLineEnd(buffer)) !== -1) {
      const line = buffer.slice(0, idx);
      // strip trailing \r if it was \r\n
      let lineContent = line;
      if (lineContent.endsWith("\r")) lineContent = lineContent.slice(0, -1);
      // advance buffer past the line terminator
      buffer = buffer.slice(idx + 1);
      processLine(lineContent);
    }
  }

  function finish(): void {
    // Per spec: if buffer ends without a blank line, the incomplete frame is dropped.
    // But if the buffer has content followed by what would be a frame terminator, process it.
    // We do NOT dispatch the partial frame.
    buffer = "";
  }

  return { feed, finish };
}

/** Find the index of the next \n or \r (line terminator). Returns -1 if none. */
function findLineEnd(s: string): number {
  const ln = s.indexOf("\n");
  const cr = s.indexOf("\r");
  if (ln === -1) return cr;
  if (cr === -1) return ln;
  return Math.min(ln, cr);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/adapters/http-sse/src/sse-parser.test.ts`
Expected: PASS — all 14 parser tests green.

- [ ] **Step 5: Run full suite + build gate**

Run: `npm test`
Expected: PASS — 134 (Task 1) + 14 = 148 tests.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/http-sse/src/sse-parser.ts packages/adapters/http-sse/src/sse-parser.test.ts
git commit -m "feat(http-sse): standalone SSE frame parser with exhaustive tests (#6 Plan 2 Task 2)"
```

**Compatibility:** New file, no existing code touched.

**Rollback:** `git revert <commit>`.

---

### Task 3: HTTP Snapshot and Capabilities Client

**Goal:** Implement `httpGet`, `fetchSnapshot`, `fetchCapabilities` with HTTP error mapping, timeout, abort, and validator integration. **Critical (Plan Review P0 item 1):** `getSnapshot()` in the adapter MUST fetch a fresh checkpoint on EVERY call — it must NOT cache the snapshot from `connect()`. `RuntimeSession.resynchronize()` calls `getSnapshot()` expecting the latest checkpoint; a cached snapshot would install a stale sequence and defeat resync.

**Files:**
- Create: `packages/adapters/http-sse/src/http-client.ts`
- Create: `packages/adapters/http-sse/src/http-client.test.ts`
- Create: `packages/adapters/http-sse/src/snapshot-client.ts`
- Create: `packages/adapters/http-sse/src/capabilities-client.ts`

**Interfaces:**
- Consumes: `validateSnapshot`, `validateCapabilities` from Task 1.
- Produces: `httpGet(url, opts): Promise<HttpResponse>`, `fetchSnapshot(url, expectedRuntimeId, opts): Promise<RuntimeSnapshot>` (always fetches fresh — no caching), `fetchCapabilities(url, opts): Promise<AdapterCapabilities>` (cached at adapter level since capabilities rarely change — but see note).
- `HttpResponse` = `{ ok: boolean; status: number; body: unknown; headers: Headers }`.
- `httpGet` opts: `{ headers?: Record<string, string>; signal?: AbortSignal; timeoutMs?: number }`.

> **Caching policy (Plan Review):**
> - `getSnapshot()` → NO caching. Every call performs an HTTP GET. The session calls this on `connect()` AND on every `resynchronize()`. Returning a cached snapshot on resync would install a stale checkpoint and leave Core permanently behind.
> - `getCapabilities()` → MAY cache at the adapter level (capabilities are static for a runtime's lifetime). Cache is populated on first `connect()` and returned on subsequent calls. A forced refresh is not needed for Plan 2.

- [ ] **Step 1: Write the failing test for httpGet**

Create `packages/adapters/http-sse/src/http-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpGet } from "./http-client.js";
import type { RuntimeStreamError } from "@agent-office/protocol";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  if (response instanceof Error) {
    fn.mockRejectedValue(response);
  } else {
    fn.mockResolvedValue(response);
  }
  return fn;
}

beforeEach(() => {
  globalThis.fetch = mockFetch(new Response('{"ok":true}', { status: 200 })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("httpGet", () => {
  it("returns 200 body as parsed JSON", async () => {
    const r = await httpGet("https://example.com/test");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual({ ok: true });
  });

  it("returns ok:false with status on 4xx", async () => {
    globalThis.fetch = mockFetch(new Response("nope", { status: 404 })) as unknown as typeof fetch;
    const r = await httpGet("https://example.com/missing");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("returns ok:false with status on 5xx", async () => {
    globalThis.fetch = mockFetch(new Response("err", { status: 500 })) as unknown as typeof fetch;
    const r = await httpGet("https://example.com/err");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(500);
  });

  it("rejects with NETWORK_ERROR on fetch throw", async () => {
    globalThis.fetch = mockFetch(new TypeError("failed to fetch")) as unknown as typeof fetch;
    await expect(httpGet("https://example.com/throw")).rejects.toMatchObject({
      code: "http_error",
    });
  });

  it("rejects with TIMEOUT when signal aborts due to timeout", async () => {
    // Use a real AbortController that aborts immediately
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 0);
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err: RuntimeStreamError = {
            code: "http_error",
            message: "TIMEOUT",
            recoverable: true,
          };
          reject(err);
        });
      });
    }) as unknown as typeof fetch;
    await expect(
      httpGet("https://example.com/slow", { signal: ac.signal, timeoutMs: 10 })
    ).rejects.toMatchObject({ code: "http_error" });
  });
});
```

Create `packages/adapters/http-sse/src/snapshot-client.test.ts` (inline in http-client.test.ts for simplicity, or separate):

```ts
// appended to http-client.test.ts
import { fetchSnapshot } from "./snapshot-client.js";
import { fetchCapabilities } from "./capabilities-client.js";

describe("fetchSnapshot", () => {
  it("returns validated snapshot on 200", async () => {
    const snap = {
      runtimeId: "rt-1",
      snapshotId: "s1",
      sequence: 5,
      schemaVersion: "1.0",
      createdAt: "2026-07-04T00:00:00.000Z",
      lastEventId: "",
      agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
    };
    globalThis.fetch = mockFetch(new Response(JSON.stringify(snap), { status: 200 })) as unknown as typeof fetch;
    const r = await fetchSnapshot("https://example.com/snap", "rt-1", {});
    expect(r.sequence).toBe(5);
  });

  it("rejects with snapshot_invalid on runtimeId mismatch", async () => {
    const snap = { ...makeValidSnap(), runtimeId: "other" };
    globalThis.fetch = mockFetch(new Response(JSON.stringify(snap), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchSnapshot("https://example.com/snap", "rt-1", {})).rejects.toMatchObject({
      code: "snapshot_invalid",
    });
  });

  it("rejects with http_error on 500", async () => {
    globalThis.fetch = mockFetch(new Response("err", { status: 500 })) as unknown as typeof fetch;
    await expect(fetchSnapshot("https://example.com/snap", "rt-1", {})).rejects.toMatchObject({
      code: "http_error",
    });
  });

  it("rejects with snapshot_invalid on malformed JSON", async () => {
    globalThis.fetch = mockFetch(new Response("not json", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchSnapshot("https://example.com/snap", "rt-1", {})).rejects.toMatchObject({
      code: "snapshot_invalid",
    });
  });
});

describe("fetchCapabilities", () => {
  it("returns validated capabilities on 200", async () => {
    const caps = {
      supportedEvents: ["task.created"],
      supportedCommands: ["task.create"],
      features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false },
    };
    globalThis.fetch = mockFetch(new Response(JSON.stringify(caps), { status: 200 })) as unknown as typeof fetch;
    const r = await fetchCapabilities("https://example.com/caps", {});
    expect(r.features.sse).toBe(true);
  });

  it("returns fallback when configured and endpoint 404s", async () => {
    globalThis.fetch = mockFetch(new Response("", { status: 404 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    const r = await fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback });
    expect(r.features.sse).toBe(true);
  });

  it("returns fallback when configured and endpoint returns 501", async () => {
    globalThis.fetch = mockFetch(new Response("", { status: 501 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    const r = await fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback });
    expect(r.features.sse).toBe(true);
  });

  // === Revised per Plan Review: fallback must NOT mask non-404/501 errors ===

  it("rejects with http_error on 500 even when fallback configured", async () => {
    globalThis.fetch = mockFetch(new Response("server err", { status: 500 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    await expect(fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback })).rejects.toMatchObject({
      code: "http_error", status: 500,
    });
  });

  it("rejects with authentication_failed on 401 even when fallback configured", async () => {
    globalThis.fetch = mockFetch(new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    await expect(fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback })).rejects.toMatchObject({
      code: "authentication_failed", status: 401,
    });
  });

  it("rejects with http_error on network failure even when fallback configured", async () => {
    globalThis.fetch = mockFetch(new TypeError("failed to fetch")) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    await expect(fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback })).rejects.toMatchObject({
      code: "http_error",
    });
  });

  it("rejects with capabilities_invalid on malformed body even when fallback configured", async () => {
    globalThis.fetch = mockFetch(new Response("garbage", { status: 200 })) as unknown as typeof fetch;
    const fallback = { supportedEvents: [], supportedCommands: [], features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false } };
    await expect(fetchCapabilities("https://example.com/caps", { fallbackCapabilities: fallback })).rejects.toMatchObject({
      code: "capabilities_invalid",
    });
  });

  it("rejects with capabilities_invalid on malformed body and no fallback", async () => {
    globalThis.fetch = mockFetch(new Response("garbage", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchCapabilities("https://example.com/caps", {})).rejects.toMatchObject({
      code: "capabilities_invalid",
    });
  });
});

function makeValidSnap() {
  return {
    runtimeId: "rt-1",
    snapshotId: "s1",
    sequence: 0,
    schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z",
    lastEventId: "",
    agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/http-sse/src/http-client.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement http-client**

Create `packages/adapters/http-sse/src/http-client.ts`:

```ts
import type { RuntimeStreamError } from "@agent-office/protocol";

export interface HttpResponse {
  ok: boolean;
  status: number;
  body: unknown;
  headers: Headers;
}

export interface HttpGetOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials; // Plan Review Fix 7, v3: support Cookie Auth
}

function makeStreamError(code: RuntimeStreamError["code"], message: string, recoverable: boolean, status?: number): RuntimeStreamError {
  return { code, message, recoverable, status };
}

export async function httpGet(url: string, opts: HttpGetOptions = {}): Promise<HttpResponse> {
  const ac = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  // Link external signal to our AbortController
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: opts.headers,
      credentials: opts.credentials ?? "omit",
      signal: ac.signal,
    });
    const text = await resp.text();
    let body: unknown = text;
    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
      try {
        body = JSON.parse(text);
      } catch {
        // keep body as text
      }
    }
    return { ok: resp.ok, status: resp.status, body, headers: resp.headers };
  } catch (err) {
    if (ac.signal.aborted && (!opts.signal || !opts.signal.aborted)) {
      // our timeout fired
      throw makeStreamError("http_error", `Request timed out after ${timeoutMs}ms`, true);
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw makeStreamError("aborted", "Request aborted", false);
    }
    throw makeStreamError("http_error", err instanceof Error ? err.message : String(err), true);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Implement snapshot-client**

Create `packages/adapters/http-sse/src/snapshot-client.ts`:

```ts
import type { RuntimeSnapshot, RuntimeStreamError } from "@agent-office/protocol";
import { httpGet, type HttpGetOptions } from "./http-client.js";
import { validateSnapshot } from "./validators.js";

export async function fetchSnapshot(
  url: string,
  expectedRuntimeId: string,
  opts: HttpGetOptions
): Promise<RuntimeSnapshot> {
  let resp;
  try {
    resp = await httpGet(url, opts);
  } catch (e) {
    throw e as RuntimeStreamError;
  }
  if (!resp.ok) {
    throw {
      code: "http_error",
      message: `Snapshot fetch failed: HTTP ${resp.status}`,
      recoverable: resp.status >= 500,
      status: resp.status,
    } satisfies RuntimeStreamError;
  }
  const result = validateSnapshot(resp.body, expectedRuntimeId);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}
```

- [ ] **Step 5: Implement capabilities-client** (revised per Plan Review — fallback restricted to 404/501 ONLY)

Create `packages/adapters/http-sse/src/capabilities-client.ts`:

```ts
import type { AdapterCapabilities, RuntimeStreamError } from "@agent-office/protocol";
import { httpGet, type HttpGetOptions } from "./http-client.js";
import { validateCapabilities } from "./validators.js";

export interface CapabilitiesOptions extends HttpGetOptions {
  fallbackCapabilities?: AdapterCapabilities;
}

export async function fetchCapabilities(
  url: string,
  opts: CapabilitiesOptions
): Promise<AdapterCapabilities> {
  let resp;
  try {
    resp = await httpGet(url, opts);
  } catch (e) {
    // Network error / timeout / abort — NEVER use fallback (revised per Plan Review).
    // Fallback only applies to 404/501 below. Auth failures, server errors,
    // network failures, JSON corruption, and validation failures MUST surface.
    throw e as RuntimeStreamError;
  }
  if (!resp.ok) {
    // Fallback is RESTRICTED to HTTP 404 and 501 only (endpoint not implemented).
    // A 401/403 (auth), 500 (server), or any other status MUST NOT trigger fallback.
    if (opts.fallbackCapabilities && (resp.status === 404 || resp.status === 501)) {
      return opts.fallbackCapabilities;
    }
    throw {
      code: resp.status === 401 || resp.status === 403 ? "authentication_failed" : "http_error",
      message: `Capabilities fetch failed: HTTP ${resp.status}`,
      recoverable: resp.status >= 500,
      status: resp.status,
    } satisfies RuntimeStreamError;
  }
  const result = validateCapabilities(resp.body);
  if (!result.ok) {
    // Validation failure — NEVER use fallback (revised per Plan Review).
    // A malformed body indicates a server bug; fallback would hide it.
    throw result.error;
  }
  return result.value;
}
```

> **Critical change (Plan Review):** the previous implementation used fallback on ANY error (network, 500, JSON corruption, validation failure). This hid real failures and "invented" capabilities. The revised version restricts fallback to HTTP 404 and 501 only — the only statuses that genuinely mean "this endpoint is not implemented".

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run packages/adapters/http-sse/src/http-client.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suite + build gate**

Run: `npm test`
Expected: PASS — 148 + ~9 = ~157 tests.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/adapters/http-sse/src/http-client.ts packages/adapters/http-sse/src/http-client.test.ts packages/adapters/http-sse/src/snapshot-client.ts packages/adapters/http-sse/src/capabilities-client.ts
git commit -m "feat(http-sse): HTTP client with snapshot and capabilities fetch (#6 Plan 2 Task 3)"
```

**Compatibility:** New files only.

**Rollback:** `git revert <commit>`.

---

### Task 4: REST Command Client

**Goal:** Implement `postCommand` with `Idempotency-Key`, timeout, abort, response validation, and NO automatic retry.

**Files:**
- Create: `packages/adapters/http-sse/src/command-client.ts`
- Create: `packages/adapters/http-sse/src/command-client.test.ts`

**Interfaces:**
- Consumes: `validateCommandResult` from Task 1, `httpGet`'s sibling `httpPostJson` (added to http-client.ts).
- Produces: `postCommand(url, command, opts): Promise<CommandResult>`. Always resolves (never rejects) — network/timeout errors are mapped to `CommandResult { status: "error" }`.

- [ ] **Step 1: Write the failing test**

Create `packages/adapters/http-sse/src/command-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { postCommand } from "./command-client.js";
import type { OfficeCommand } from "@agent-office/protocol";
import { CommandType } from "@agent-office/protocol";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  if (response instanceof Error) fn.mockRejectedValue(response);
  else fn.mockResolvedValue(response);
  return fn;
}

function makeCommand(): OfficeCommand {
  return {
    commandId: "cmd-1",
    commandType: CommandType.TASK_CREATE,
    timestamp: "2026-07-04T00:00:00.000Z",
    source: "user",
    actorId: "user-1",
    runtimeId: "rt-1",
    targetId: null,
    payload: { title: "t", description: "d", priority: "normal", parentTaskId: null },
  };
}

beforeEach(() => {
  globalThis.fetch = mockFetch(
    new Response(JSON.stringify({ commandId: "cmd-1", status: "accepted", affectedEventIds: ["e1"] }), { status: 200, headers: { "content-type": "application/json" } })
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("postCommand", () => {
  it("sends Idempotency-Key header equal to commandId", async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Response(JSON.stringify({ commandId: "cmd-1", status: "accepted", affectedEventIds: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;
    await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(fetchSpy).toHaveBeenCalled();
    const init = (fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Idempotency-Key")).toBe("cmd-1");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns validated CommandResult on 200", async () => {
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("accepted");
    expect(r.commandId).toBe("cmd-1");
  });

  it("returns error CommandResult on 500 (no retry)", async () => {
    globalThis.fetch = mockFetch(new Response("err", { status: 500 })) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("error");
    expect(r.error?.code).toContain("500");
  });

  it("returns error CommandResult on network failure (no retry)", async () => {
    globalThis.fetch = mockFetch(new TypeError("network")) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("NETWORK_ERROR");
  });

  it("returns error CommandResult on timeout", async () => {
    // Use a fetch that never resolves; abort via short timeout
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 5);
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), { timeoutMs: 5 });
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("TIMEOUT");
  }, 5000);

  it("returns error CommandResult on malformed response body", async () => {
    globalThis.fetch = mockFetch(new Response("not json", { status: 200 })) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("COMMAND_RESPONSE_INVALID");
  });

  it("returns error CommandResult on commandId mismatch", async () => {
    globalThis.fetch = mockFetch(
      new Response(JSON.stringify({ commandId: "other", status: "accepted", affectedEventIds: [] }), { status: 200 })
    ) as unknown as typeof fetch;
    const r = await postCommand("https://example.com/cmd", makeCommand(), {});
    expect(r.status).toBe("error");
    expect(r.error?.code).toBe("COMMAND_RESPONSE_INVALID");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/http-sse/src/command-client.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement postCommand**

Create `packages/adapters/http-sse/src/command-client.ts`:

```ts
import type { OfficeCommand, CommandResult, RuntimeStreamError } from "@agent-office/protocol";
import { validateCommandResult } from "./validators.js";

export interface PostCommandOptions {
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function errorResult(commandId: string, code: string, message: string): CommandResult {
  return {
    commandId,
    status: "error",
    error: { code, message },
    affectedEventIds: [],
  };
}

export async function postCommand(
  url: string,
  command: OfficeCommand,
  opts: PostCommandOptions
): Promise<CommandResult> {
  // Resolve auth headers (refreshed each call)
  let authHeaders: Record<string, string> = {};
  if (typeof opts.headers === "function") {
    try {
      authHeaders = await opts.headers();
    } catch {
      // auth resolution failure → error result
      return errorResult(command.commandId, "AUTH_RESOLUTION_FAILED", "Failed to resolve auth headers");
    }
  } else if (opts.headers) {
    authHeaders = opts.headers;
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "Idempotency-Key": command.commandId,
    ...authHeaders,
  });

  const ac = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30000;
  // Plan Review Fix 9, v3: track which signal fired first to correctly
  // distinguish TIMEOUT from ABORTED. Without this, if both the timeout timer
  // and the lifecycle abort fire in the same tick, `opts.signal.aborted` could
  // be true even though the timeout fired first — misclassifying TIMEOUT as
  // ABORTED.
  let abortReason: "timeout" | "external" | null = null;
  const timer = setTimeout(() => { abortReason = "timeout"; ac.abort(); }, timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) { abortReason = "external"; ac.abort(); }
    else opts.signal.addEventListener("abort", () => { abortReason = "external"; ac.abort(); }, { once: true });
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(command),
      credentials: opts.credentials ?? "omit",
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      // Classify by which signal fired first (Plan Review Fix 9, v3).
      if (abortReason === "timeout") {
        return errorResult(command.commandId, "TIMEOUT", `Command timed out after ${timeoutMs}ms`);
      }
      return errorResult(command.commandId, "ABORTED", "Command aborted");
    }
    return errorResult(command.commandId, "NETWORK_ERROR", err instanceof Error ? err.message : String(err));
  }
  clearTimeout(timer);

  // Parse body
  let body: unknown;
  const text = await resp.text();
  try {
    body = JSON.parse(text);
  } catch {
    return errorResult(command.commandId, "COMMAND_RESPONSE_INVALID", `Non-JSON response (HTTP ${resp.status})`);
  }

  // Non-2xx → map to error result
  if (!resp.ok) {
    const code = `HTTP_${resp.status}`;
    const message = typeof (body as { error?: { message?: string } })?.error?.message === "string"
      ? (body as { error: { message: string } }).error.message
      : `Server returned HTTP ${resp.status}`;
    return errorResult(command.commandId, code, message);
  }

  // Validate response shape
  const result = validateCommandResult(body, command.commandId);
  if (!result.ok) {
    return errorResult(command.commandId, "COMMAND_RESPONSE_INVALID", result.error.message);
  }
  return result.value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/adapters/http-sse/src/command-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite + build gate**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/http-sse/src/command-client.ts packages/adapters/http-sse/src/command-client.test.ts
git commit -m "feat(http-sse): REST command client with Idempotency-Key and no retry (#6 Plan 2 Task 4)"
```

**Compatibility:** New files only.

**Rollback:** `git revert <commit>`.

---

### Task 5: HttpSseRuntimeAdapter (subscribe lifecycle — single Read Loop with replay-complete)

**Goal:** Implement the `HttpSseRuntimeAdapter` class implementing `RuntimeAdapter`. The `subscribe()` method:
- Opens ONE fetch, ONE reader, ONE loop (per Architecture Decision H). `reader.done` is NEVER used as a replay boundary.
- Uses the explicit `event: replay-complete` control frame to transition REPLAY → READY → LIVE. The same `reader.read()` loop continues in LIVE mode — no second reader, no second fetch, no second loop.
- Validates replay continuity inside `ready`; rejects `ready` on gap / runtime mismatch / malformed event / SSE-id mismatch / `event_invalid` / auth failure / protocol failure / `reader.done` before `replay-complete`.
- After `replay-complete`: emits `onState("ready")`, resolves `ready`, and CONTINUES the same loop in LIVE mode.
- In LIVE mode: invalid events emit `onError({ code: "event_invalid", recoverable: false })` + `onState("error")` and close the stream — NEVER silently dropped (per Global Constraint).
- `getSnapshot()` performs a fresh HTTP fetch on every call (NO permanent cache) so resync gets the latest checkpoint.
- All in-flight operations are cancelable via the unified `lifecycleAbort` (Architecture Decision I); `disconnect()` aborts `lifecycleAbort` → `streamAbort` → clears timer.

**Files:**
- Create: `packages/adapters/http-sse/src/stream-client.ts`
- Create: `packages/adapters/http-sse/src/adapter.ts`
- Create: `packages/adapters/http-sse/src/adapter.test.ts`
- Create: `packages/adapters/http-sse/src/index.ts`

**Interfaces:**
- Consumes: `httpGet`, `fetchSnapshot`, `fetchCapabilities`, `postCommand`, `createSseParser`, `validateEvent`, `validateSnapshot`, `defaultReconnectPolicy`, `lifecycleAbort` (adapter-owned).
- Produces: `HttpSseRuntimeAdapter` (implements `RuntimeAdapter`), `HttpSseAdapterOptions`.

- [ ] **Step 1: Implement stream-client (SSE opener only — no read loop here)**

The stream-client's ONLY responsibility is to open the SSE fetch, validate HTTP status + Content-Type, and return `{ response, reader, decoder }`. The single read loop lives in `adapter.ts` (Step 4) because it needs to coordinate REPLAY → LIVE state transitions with `replay-complete` and the observer.

Create `packages/adapters/http-sse/src/stream-client.ts`:

```ts
import type { RuntimeStreamError } from "@agent-office/protocol";

export interface OpenStreamOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials; // Plan Review Fix 7, v3: support Cookie Auth
}

export interface OpenedStream {
  response: Response;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  decoder: TextDecoder;
}

export async function openEventStream(
  url: string,
  opts: OpenStreamOptions
): Promise<OpenedStream> {
  const ac = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "GET",
      credentials: opts.credentials ?? "omit",
      headers: { Accept: "text/event-stream", ...opts.headers },
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      if (!opts.signal?.aborted) {
        throw { code: "stream_open_failed", message: `Stream open timed out after ${timeoutMs}ms`, recoverable: true } satisfies RuntimeStreamError;
      }
      throw { code: "aborted", message: "Stream open aborted", recoverable: false } satisfies RuntimeStreamError;
    }
    throw { code: "stream_open_failed", message: err instanceof Error ? err.message : String(err), recoverable: true } satisfies RuntimeStreamError;
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const code = resp.status === 401 || resp.status === 403 ? "authentication_failed" : "stream_open_failed";
    const recoverable = resp.status >= 500;
    throw { code, message: `Stream open failed: HTTP ${resp.status}`, recoverable, status: resp.status } satisfies RuntimeStreamError;
  }
  const ct = resp.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream")) {
    throw { code: "stream_protocol_error", message: `Expected text/event-stream, got ${ct}`, recoverable: false, status: resp.status } satisfies RuntimeStreamError;
  }
  if (!resp.body) {
    throw { code: "stream_protocol_error", message: "Response has no body", recoverable: false } satisfies RuntimeStreamError;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return { response: resp, reader, decoder };
}
```

- [ ] **Step 2: Write the failing adapter test**

Create `packages/adapters/http-sse/src/adapter.test.ts`. Tests use `globalThis.fetch` mocking at unit level; Task 8 covers end-to-end via `FakeServer`. Per Global Constraint: no private field access, no invented methods, no `reportError`/`reportState`.

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpSseRuntimeAdapter } from "./adapter.js";
import type { RuntimeSnapshot, DomainEvent } from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";

const RUNTIME_ID = "rt-adapter-test";
const BASE_URL = "https://example.com";

function makeSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID, snapshotId: `snap-${seq}`, sequence: seq, schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z", lastEventId: "",
    agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
  };
}

function makeEvent(seq: number): DomainEvent {
  return {
    eventId: `evt-${seq}`, runtimeId: RUNTIME_ID, sequence: seq, schemaVersion: "1.0",
    type: EventType.TASK_CREATED, occurredAt: "2026-07-04T00:00:00.000Z",
    receivedAt: "2026-07-04T00:00:00.000Z", correlationId: `c-${seq}`,
    causationId: null, traceId: `t-${seq}`, payload: {},
  };
}

function sseFrame(event: DomainEvent): string {
  return `event: domain-event\nid: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`;
}

function replayCompleteFrame(lastSequence: number): string {
  return `event: replay-complete\nid: ${lastSequence}\ndata: {"lastSequence":${lastSequence}}\n\n`;
}

const CAPS_BODY = JSON.stringify({
  supportedEvents: [], supportedCommands: [],
  features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false },
});

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("HttpSseRuntimeAdapter", () => {
  it("connect fetches capabilities (no snapshot cache — getSnapshot fetches fresh)", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200, headers: { "content-type": "application/json" } });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(5)), { status: 200, headers: { "content-type": "application/json" } });
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const snap = await adapter.getSnapshot();
    expect(snap.runtimeId).toBe(RUNTIME_ID);
    const caps = adapter.getCapabilities();
    expect(caps.features.sse).toBe(true);
  });

  it("subscribe ready resolves after replay-complete with empty replay", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(replayCompleteFrame(0)));
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await sub.ready;
    await expect(sub.ready).resolves.toBeUndefined();
    await sub.close();
  });

  it("subscribe delivers replay events then resolves ready on replay-complete", async () => {
    const ev1 = makeEvent(1);
    const ev2 = makeEvent(2);
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseFrame(ev1) + sseFrame(ev2) + replayCompleteFrame(2)));
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const received: DomainEvent[] = [];
    const sub = adapter.subscribe({ onEvent: (e) => received.push(e) }, { afterSequence: 0 });
    await sub.ready;
    expect(received.map((e) => e.sequence)).toEqual([1, 2]);
    await sub.close();
  });

  it("subscribe ready rejects when stream closes before replay-complete (reader.done is NOT a replay boundary)", async () => {
    const ev1 = makeEvent(1);
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseFrame(ev1)));
            controller.close(); // close WITHOUT replay-complete → protocol violation
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "stream_protocol_error" });
  });

  it("subscribe ready rejects on replay gap", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            // first event seq=2 (gap: expected 1, got 2)
            controller.enqueue(new TextEncoder().encode(sseFrame(makeEvent(2))));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "event_log_trimmed" });
  });

  it("subscribe ready rejects on invalid event in replay (event_invalid, never silently dropped)", async () => {
    const ev = makeEvent(1);
    ev.runtimeId = "other-runtime"; // runtime mismatch → event_invalid
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseFrame(ev)));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "event_invalid" });
  });

  it("subscribe ready rejects on SSE id/sequence mismatch in replay", async () => {
    const ev = makeEvent(1);
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const frame = `event: domain-event\nid: 99\ndata: ${JSON.stringify(ev)}\n\n`; // id=99 but seq=1
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(frame));
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "stream_protocol_error" });
  });

  it("subscribe ready rejects on replay-complete id/data mismatch", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        // id=2 but data.lastSequence=5 → mismatch
        const frame = `event: replay-complete\nid: 2\ndata: {"lastSequence":5}\n\n`;
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(frame));
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "stream_protocol_error" });
  });

  it("subscribe ready rejects on 401 stream open", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) return new Response("unauthorized", { status: 401 });
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await expect(sub.ready).rejects.toMatchObject({ code: "authentication_failed" });
  });

  it("close before ready rejects ready with aborted", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        // stream that never sends data — ready won't resolve
        const stream = new ReadableStream({ start() { /* never close */ } });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    await sub.close();
    await expect(sub.ready).rejects.toMatchObject({ code: "aborted" });
  });

  it("LIVE invalid event: onError(event_invalid, recoverable=false) + onState(error), never silently dropped", async () => {
    const ev1 = makeEvent(1);
    const bad = makeEvent(2);
    bad.runtimeId = "other-runtime"; // invalid in live
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(
              sseFrame(ev1) + replayCompleteFrame(1) + sseFrame(bad)
            ));
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const errors: unknown[] = [];
    const states: string[] = [];
    const sub = adapter.subscribe({
      onEvent: () => {},
      onError: (e) => errors.push(e),
      onState: (s) => states.push(s),
    }, { afterSequence: 0 });
    await sub.ready;
    // give the live loop a tick to process the bad frame
    await new Promise((r) => setTimeout(r, 50));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "event_invalid", recoverable: false });
    expect(states).toContain("error");
    await sub.close();
  });

  it("LIVE stream close (reader.done) emits onError(http_error, recoverable=true) + onState(error)", async () => {
    const ev1 = makeEvent(1);
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseFrame(ev1) + replayCompleteFrame(1)));
            controller.close(); // server closes during live
          },
        });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const errors: unknown[] = [];
    const states: string[] = [];
    const sub = adapter.subscribe({
      onEvent: () => {},
      onError: (e) => errors.push(e),
      onState: (s) => states.push(s),
    }, { afterSequence: 0 });
    await sub.ready;
    await new Promise((r) => setTimeout(r, 50));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "http_error", recoverable: true });
    expect(states).toContain("error");
  });

  it("getSnapshot() performs a fresh fetch on every call (no permanent cache)", async () => {
    let snapshotSeq = 5;
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) {
        const current = snapshotSeq;
        return new Response(JSON.stringify({ ...makeSnapshot(current), sequence: current }), {
          status: 200, headers: { "content-type": "application/json" }
        });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const snap1 = await adapter.getSnapshot();
    expect(snap1.sequence).toBe(5);
    snapshotSeq = 20; // server advances
    const snap2 = await adapter.getSnapshot();
    expect(snap2.sequence).toBe(20); // fresh fetch — NOT cached
  });

  it("disconnect() aborts in-flight stream open (lifecycleAbort)", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = url.toString();
      if (u.endsWith("/runtime/capabilities")) return new Response(CAPS_BODY, { status: 200 });
      if (u.endsWith("/runtime/snapshot")) return new Response(JSON.stringify(makeSnapshot(0)), { status: 200 });
      if (u.includes("/runtime/events")) {
        // stream that never sends data — disconnect during this window
        const stream = new ReadableStream({ start() { /* never close */ } });
        return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return new Response("", { status: 404 });
    }) as unknown as typeof fetch;
    const adapter = new HttpSseRuntimeAdapter({ runtimeId: RUNTIME_ID, baseUrl: BASE_URL });
    await adapter.connect();
    const sub = adapter.subscribe({ onEvent: () => {} }, { afterSequence: 0 });
    // disconnect while subscription is OPENING/REPLAY (ready not yet resolved)
    await adapter.disconnect();
    await expect(sub.ready).rejects.toMatchObject({ code: "aborted" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/adapters/http-sse/src/adapter.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the adapter with single Read Loop + replay-complete**

Create `packages/adapters/http-sse/src/adapter.ts`. Key design points (per Architecture Decisions H, I):

- **ONE fetch, ONE reader, ONE loop** — the loop's behavior branches on `phase: "REPLAY" | "LIVE"`.
- **`replay-complete` triggers state transition but does NOT break the loop** — the same `reader.read()` keeps going in LIVE mode.
- **`lifecycleAbort`** is owned by the adapter and aborted in `disconnect()`; combined with `streamAbort` via `AbortSignal.any([...])` for the stream open + read.
- **`getSnapshot()` always fetches fresh** — NO `cachedSnapshot` field. `connect()` only fetches + caches `capabilities` (capabilities are immutable per runtime).
- **Invalid event handling**:
  - REPLAY phase → `readyReject(...)` (no `onError` call, per protocol contract §4.1.1: ready-then-onError ordering).
  - LIVE phase → `onError({ code: "event_invalid", recoverable: false })` + `onState("error")` + close the stream — never silently dropped.

```ts
import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  OfficeCommand,
  CommandResult,
  AdapterCapabilities,
  DomainEvent,
  RuntimeStreamObserver,
  RuntimeSubscription,
  RuntimeStreamError,
  SubscribeOptions,
} from "@agent-office/protocol";
import { fetchSnapshot } from "./snapshot-client.js";
import { fetchCapabilities } from "./capabilities-client.js";
import { postCommand } from "./command-client.js";
import { openEventStream } from "./stream-client.js";
import { createSseParser } from "./sse-parser.js";
import { validateEvent } from "./validators.js";

export const defaultEndpoints = {
  snapshot: "/runtime/snapshot",
  events: "/runtime/events",
  commands: "/runtime/commands",
  capabilities: "/runtime/capabilities",
};

export interface HttpSseAdapterOptions {
  runtimeId: string;
  baseUrl: string;
  endpoints?: Partial<typeof defaultEndpoints>;
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  credentials?: RequestCredentials;
  fallbackCapabilities?: AdapterCapabilities;
  commandTimeoutMs?: number;
  streamTimeoutMs?: number;
}

type StreamPhase = "REPLAY" | "LIVE";

export class HttpSseRuntimeAdapter implements RuntimeAdapter {
  private opts: HttpSseAdapterOptions;
  private endpoints: typeof defaultEndpoints;
  private cachedCapabilities: AdapterCapabilities | null = null;
  private connected = false;
  /** Unified lifecycle abort — aborted exactly once in disconnect(). Cancels all in-flight fetches. */
  private lifecycleAbort = new AbortController();
  /** Active subscription's stream abort (per-subscription). Aborted in close() or disconnect(). */
  private streamAbort: AbortController | null = null;

  constructor(opts: HttpSseAdapterOptions) {
    this.opts = opts;
    this.endpoints = { ...defaultEndpoints, ...opts.endpoints };
  }

  async connect(): Promise<void> {
    // Plan Review Fix 16, v3: explicit one-time-adapter guard. Without this,
    // calling connect() after disconnect() would silently no-op (because
    // lifecycleAbort.signal is already aborted → fetchCapabilities rejects
    // with AbortError) OR worse, race with a fresh subscribe() call. Make the
    // contract from Architecture Decision I enforceable at runtime: a
    // disconnected adapter CANNOT be reconnected — construct a new instance.
    if (this.lifecycleAbort.signal.aborted) {
      throw new Error(
        "HttpSseRuntimeAdapter.connect() called after disconnect(): " +
        "adapter is one-time per Architecture Decision I. " +
        "Construct a new HttpSseRuntimeAdapter instance to reconnect."
      );
    }
    if (this.connected) {
      return; // idempotent — connect() called twice without disconnect()
    }
    // Capabilities are immutable per runtime — cache once.
    this.cachedCapabilities = await fetchCapabilities(
      this.opts.baseUrl + this.endpoints.capabilities,
      {
        headers: await this.resolveHeaders(),
        credentials: this.opts.credentials,
        signal: this.lifecycleAbort.signal,
        fallbackCapabilities: this.opts.fallbackCapabilities,
      }
    );
    // NOTE: snapshot is NOT cached here. getSnapshot() fetches fresh on every call
    // so resynchronize() gets the latest checkpoint, not a stale connect-time snapshot.
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    // Per Architecture Decision I sequence:
    // 1. lifecycleAbort aborts ALL in-flight fetches (snapshot, capabilities, command, stream open).
    this.lifecycleAbort.abort();
    // 2. streamAbort aborts the active reader (if any).
    this.streamAbort?.abort();
    this.streamAbort = null;
  }

  async getSnapshot(): Promise<RuntimeSnapshot> {
    // NO CACHE — every call performs a fresh HTTP fetch.
    // This ensures resynchronize() gets the latest checkpoint, not a stale connect-time snapshot.
    return fetchSnapshot(
      this.opts.baseUrl + this.endpoints.snapshot,
      this.opts.runtimeId,
      {
        headers: await this.resolveHeaders(),
        credentials: this.opts.credentials,
        signal: this.lifecycleAbort.signal,
      }
    );
  }

  getCapabilities(): AdapterCapabilities {
    if (!this.cachedCapabilities) {
      throw new Error("connect() must be called before getCapabilities()");
    }
    return this.cachedCapabilities;
  }

  async execute(command: OfficeCommand): Promise<CommandResult> {
    // Per-call timeout AbortController combined with lifecycle signal (Architecture Decision I).
    const timeoutAc = new AbortController();
    const timeoutMs = this.opts.commandTimeoutMs ?? 10000;
    const timer = setTimeout(() => timeoutAc.abort(), timeoutMs);
    const combinedSignal = AbortSignal.any([this.lifecycleAbort.signal, timeoutAc.signal]);
    try {
      return await postCommand(
        this.opts.baseUrl + this.endpoints.commands,
        command,
        {
          headers: await this.resolveHeaders(),
          credentials: this.opts.credentials,
          signal: combinedSignal,
        }
      );
    } finally {
      clearTimeout(timer);
    }
  }

  subscribe(
    observer: RuntimeStreamObserver,
    options?: SubscribeOptions
  ): RuntimeSubscription {
    const afterSequence = options?.afterSequence ?? 0;
    const streamAbort = new AbortController();
    this.streamAbort = streamAbort;
    const combinedSignal = AbortSignal.any([this.lifecycleAbort.signal, streamAbort.signal]);

    let closed = false;
    let opened: {
      response: Response;
      reader: ReadableStreamDefaultReader<Uint8Array>;
      decoder: TextDecoder;
    } | null = null;

    // readyResolve/readyReject captured so the loop can resolve/reject at replay-complete.
    let readyResolve!: () => void;
    let readyReject!: (err: RuntimeStreamError) => void;
    let readySettled = false;
    const ready = new Promise<void>((res, rej) => {
      readyResolve = (v: void) => { if (!readySettled) { readySettled = true; res(v); } };
      readyReject = (err: RuntimeStreamError) => { if (!readySettled) { readySettled = true; rej(err); } };
    });

    // `terminated` is set whenever the stream must die — either because `ready`
    // was rejected (replay error) or because a LIVE-phase error closed the stream.
    // The read loop checks this after every `parser.feed(chunk)` and aborts the
    // reader immediately. Without this, a subsequent frame in the same chunk
    // (e.g. `replay-complete` after a gap rejection) could keep the loop alive
    // even though `ready` was already rejected — violating the "no stale stream
    // after ready failure" contract (Plan Review Issue 2, v3).
    let terminated = false;

    // Single read loop. Started async; runs REPLAY then LIVE without breaking.
    const loopPromise = (async () => {
      try {
        opened = await openEventStream(
          this.opts.baseUrl + this.endpoints.events + `?afterSequence=${afterSequence}`,
          {
            headers: await this.resolveHeaders(),
            credentials: this.opts.credentials,
            signal: combinedSignal,
            timeoutMs: this.opts.streamTimeoutMs,
          }
        );
      } catch (err) {
        // close() may have won the race — closeFn rejects ready independently,
        // so we only reject here if close hasn't already settled ready.
        readyReject(err as RuntimeStreamError);
        return;
      }
      if (closed) {
        await this.cleanupReader(opened.reader, streamAbort);
        // closeFn already rejected ready — no-op here.
        return;
      }

      const { reader, decoder } = opened;
      let phase: StreamPhase = "REPLAY";
      let expectedSeq = afterSequence + 1;
      let lastDeliveredSeq = afterSequence;

      // The single parser instance handles BOTH replay and live frames.
      // For LIVE invalid events, we must defer onError until after ready resolves
      // (protocol §4.1.1: ready-then-onError ordering). Use a queue for live-phase errors.
      const liveErrorQueue: RuntimeStreamError[] = [];

      // Helper: reject ready AND mark stream for termination. All replay-phase
      // error paths MUST go through this (Plan Review Issue 2, v3) — otherwise
      // the parser keeps consuming the rest of the current chunk and the stream
      // stays alive after `ready` was already rejected.
      const rejectReadyAndTerminate = (err: RuntimeStreamError): void => {
        readyReject(err);
        terminated = true;
      };

      const parser = createSseParser({
        onEvent: (eventType, id, data) => {
          if (closed || terminated) return;

          // ─── replay-complete control frame ─────────────────────────────
          if (eventType === "replay-complete") {
            if (phase !== "REPLAY") {
              // Duplicate replay-complete in LIVE → protocol violation.
              liveErrorQueue.push({
                code: "stream_protocol_error",
                message: "Duplicate replay-complete frame in LIVE phase",
                recoverable: false,
              });
              return;
            }
            // Validate id === data.lastSequence === lastDeliveredSeq.
            let parsed: { lastSequence?: unknown };
            try {
              parsed = JSON.parse(data);
            } catch {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: "replay-complete data is not valid JSON",
                recoverable: false,
              });
              return;
            }
            const ls = parsed.lastSequence;
            if (typeof ls !== "number" || !Number.isFinite(ls) || !Number.isInteger(ls)) {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: "replay-complete.lastSequence must be an integer",
                recoverable: false,
              });
              return;
            }
            if (id !== undefined && Number(id) !== ls) {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: `replay-complete id ${id} !== data.lastSequence ${ls}`,
                recoverable: false,
              });
              return;
            }
            if (ls !== lastDeliveredSeq) {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: `replay-complete.lastSequence ${ls} !== last delivered ${lastDeliveredSeq}`,
                recoverable: false,
              });
              return;
            }
            // Transition REPLAY → READY → LIVE (same loop continues).
            phase = "LIVE";
            observer.onState?.("ready");
            readyResolve();
            return;
          }

          // ─── reset-required control frame (LIVE only) ──────────────────
          if (eventType === "reset-required") {
            if (phase === "REPLAY") {
              rejectReadyAndTerminate({
                code: "event_log_trimmed",
                message: "reset-required during replay",
                recoverable: true,
              });
              return;
            }
            liveErrorQueue.push({
              code: "event_log_trimmed",
              message: "Server signaled reset-required",
              recoverable: true,
            });
            return;
          }

          // ─── regular domain-event frame ────────────────────────────────
          let parsedEvent: unknown;
          try {
            parsedEvent = JSON.parse(data);
          } catch {
            // Malformed JSON: replay → reject ready + terminate; live → event_invalid + close (never silent).
            if (phase === "REPLAY") {
              rejectReadyAndTerminate({
                code: "event_invalid",
                message: "Malformed JSON in replay event",
                recoverable: false,
              });
            } else {
              liveErrorQueue.push({
                code: "event_invalid",
                message: "Malformed JSON in live event",
                recoverable: false,
              });
            }
            return;
          }
          const result = validateEvent(parsedEvent, this.opts.runtimeId);
          if (!result.ok) {
            // Invalid event: replay → reject ready + terminate; live → onError + close (never silent).
            if (phase === "REPLAY") {
              rejectReadyAndTerminate(result.error);
            } else {
              liveErrorQueue.push(result.error);
            }
            return;
          }
          const event = result.value;

          if (phase === "REPLAY") {
            // Enforce strict contiguity during replay.
            if (event.sequence !== expectedSeq) {
              rejectReadyAndTerminate({
                code: "event_log_trimmed",
                message: `Replay gap: expected sequence ${expectedSeq}, got ${event.sequence}`,
                recoverable: true,
              });
              return;
            }
            // Enforce SSE id === event.sequence (when id present).
            if (id !== undefined && id !== String(event.sequence)) {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: `SSE id ${id} !== event.sequence ${event.sequence}`,
                recoverable: false,
              });
              return;
            }
            expectedSeq = event.sequence + 1;
            lastDeliveredSeq = event.sequence;
            observer.onEvent(event);
          } else {
            // LIVE phase: contiguity is enforced by SnapshotStore.applyEvent in the session,
            // not by the adapter. The adapter only validates structural integrity.
            // SSE id/sequence mismatch in LIVE → stream_protocol_error + close.
            if (id !== undefined && id !== String(event.sequence)) {
              liveErrorQueue.push({
                code: "stream_protocol_error",
                message: `LIVE SSE id ${id} !== event.sequence ${event.sequence}`,
                recoverable: false,
              });
              return;
            }
            observer.onEvent(event);
          }
        },
        onComment: () => {
          // heartbeat — ignore
        },
        onError: () => {
          // Parser-level non-fatal error (e.g. malformed frame boundary).
          // Replay → reject ready + terminate; Live → queue event_invalid.
          if (phase === "REPLAY") {
            rejectReadyAndTerminate({
              code: "stream_protocol_error",
              message: "SSE parser error during replay",
              recoverable: false,
            });
          } else {
            liveErrorQueue.push({
              code: "stream_protocol_error",
              message: "SSE parser error during live",
              recoverable: false,
            });
          }
        },
      });

      // ─── The single read loop ──────────────────────────────────────
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (closed || terminated) {
            await this.cleanupReader(reader, streamAbort);
            return;
          }
          const { done, value } = await reader.read();
          if (done) {
            if (phase === "REPLAY") {
              // Server closed before sending replay-complete — protocol violation.
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: "Stream closed during replay without replay-complete frame",
                recoverable: false,
              });
            } else {
              // LIVE stream closed unexpectedly — recoverable.
              observer.onError?.({
                code: "http_error",
                message: "Live stream closed",
                recoverable: true,
              });
              observer.onState?.("error");
            }
            return;
          }
          const chunk = decoder.decode(value, { stream: true });
          parser.feed(chunk);

          // After feed: if ready was rejected during this chunk, terminate the
          // stream immediately (Plan Review Issue 2, v3). Without this, a later
          // frame in the same chunk (e.g. `replay-complete`) could keep the loop
          // alive even though `ready` was already rejected.
          if (terminated) {
            await this.cleanupReader(reader, streamAbort);
            return;
          }

          // Drain any LIVE-phase errors queued during this chunk.
          // (No-op during REPLAY — errors there reject ready + terminate directly.)
          if (phase === "LIVE" && liveErrorQueue.length > 0) {
            const err = liveErrorQueue.shift()!;
            observer.onError?.(err);
            observer.onState?.("error");
            // Close the stream on LIVE error (invalid event / protocol error).
            terminated = true;
            await this.cleanupReader(reader, streamAbort);
            return;
          }
        }
      } catch (err) {
        // reader.read() threw — typically AbortError from close()/disconnect().
        if (closed) return; // expected — closeFn settled ready
        if (phase === "REPLAY") {
          rejectReadyAndTerminate({
            code: "stream_protocol_error",
            message: err instanceof Error ? err.message : String(err),
            recoverable: false,
          });
        } else {
          observer.onError?.({
            code: "http_error",
            message: err instanceof Error ? err.message : String(err),
            recoverable: true,
          });
          observer.onState?.("error");
        }
      } finally {
        // Drain any remaining LIVE errors after loop exit (best-effort).
        while (liveErrorQueue.length > 0) {
          const err = liveErrorQueue.shift()!;
          observer.onError?.(err);
        }
      }
    })();

    const closeFn = async (): Promise<void> => {
      if (closed) return;
      closed = true;
      streamAbort.abort();
      // close-before-ready MUST reject pending ready (Plan Review Issue 3, v3).
      // Without this, `await subscription.ready` after `close()` would hang forever
      // — the Promise was neither resolved (replay didn't finish) nor rejected.
      // readyReject is a no-op if ready was already settled.
      readyReject({ code: "aborted", message: "closed before ready", recoverable: false });
      if (opened?.reader) {
        try { await opened.reader.cancel(); } catch { /* best-effort */ }
      }
      observer.onState?.("closed");
      // Avoid unhandled rejection if loopPromise rejects after close.
      loopPromise.catch(() => {});
    };

    return {
      ready,
      close: closeFn,
    };
  }

  private async cleanupReader(
    reader: ReadableStreamDefaultReader<Uint8Array> | null,
    ac: AbortController
  ): Promise<void> {
    ac.abort();
    if (reader) {
      try { await reader.cancel(); } catch { /* best-effort */ }
    }
  }

  private async resolveHeaders(): Promise<Record<string, string>> {
    if (typeof this.opts.headers === "function") {
      return await this.opts.headers();
    }
    return this.opts.headers ?? {};
  }
}
```

- [ ] **Step 5: Create index.ts**

Create `packages/adapters/http-sse/src/index.ts`:

```ts
export { HttpSseRuntimeAdapter } from "./adapter.js";
export type { HttpSseAdapterOptions } from "./adapter.js";
export { defaultEndpoints } from "./adapter.js";
export {
  validateSnapshot,
  validateEvent,
  validateCapabilities,
  validateCommandResult,
} from "./validators.js";
export type { Ok, ValidationError } from "./validators.js";
export { createSseParser } from "./sse-parser.js";
export type { SseParser, SseParserHandlers } from "./sse-parser.js";
export { httpGet } from "./http-client.js";
export type { HttpResponse, HttpGetOptions } from "./http-client.js";
export { postCommand } from "./command-client.js";
export type { PostCommandOptions } from "./command-client.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run packages/adapters/http-sse/src/adapter.test.ts`
Expected: PASS — all 13 adapter tests green.

- [ ] **Step 7: Run full suite + build gate**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/adapters/http-sse/src/stream-client.ts packages/adapters/http-sse/src/adapter.ts packages/adapters/http-sse/src/adapter.test.ts packages/adapters/http-sse/src/index.ts
git commit -m "feat(http-sse): HttpSseRuntimeAdapter with single Read Loop + replay-complete protocol (#6 Plan 2 Task 5)"
```

**Compatibility:** New package. Does not touch Mock/Core. Existing tests unaffected.

**Rollback:** `git revert <commit>`.

---

### Task 6: RuntimeSession Stream Error / Reset / Reconnect Integration (revised per Plan Review)

**Goal:** Extend `RuntimeSession` to observe `onError`/`onState("reset_required")` from the subscription, drive bounded single-flight reconnect with exponential backoff, abort on disconnect, and expose `reconnectCount` in diagnostics. Per Architecture Decision J (Plan Review):

- Introduce **`resynchronizeOrThrow()` (private)** that re-throws on failure — used by `doReconnect()` so the reconnect controller knows success/failure. Public `resynchronize()` wraps it in try/catch (Plan 1 API compat — swallows errors, sets `failed`).
- Add **`reconnectPromise`** for true single-flight. `scheduleReconnect()` checks BOTH `reconnectTimer !== null` AND `reconnectPromise !== null` — if either is set, no-op. This closes the window where timer-fire → clear timer → resync starts → second error → new timer.
- **Non-recoverable errors close the subscription BEFORE entering `failed`** — `await removeSubscription()` THEN `recordError` THEN `setState("failed")`. No stale stream remains in a `failed` session.
- `reconnectCount` (diagnostics) is **cumulative** — never resets. `reconnectAttempts` (private, used for backoff) resets to 0 on success.

**Files:**
- Modify: `packages/core/src/session.ts`
- Modify: `packages/core/src/index.ts` (re-export `ReconnectPolicy`, `defaultReconnectPolicy`)
- Create: `packages/core/src/session-reconnect.test.ts`

**Interfaces:**
- Consumes: `ReconnectPolicy`, `defaultReconnectPolicy` from protocol (Task 1), `RuntimeStreamObserver`, `RuntimeStreamState`, `RuntimeSubscription` (Plan 1).
- Produces: `RuntimeSession` with new `onError`/`onState` handling in `installSubscription`, `scheduleReconnect()` private method (single-flight via `reconnectTimer` + `reconnectPromise`), `resynchronizeOrThrow()` private method, `reconnectCount` in `SessionDiagnostics`, `reconnectPolicy` in `RuntimeSessionOptions`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/session-reconnect.test.ts`. Tests use `TestRuntimeAdapter` (already public) and a thin `ErrorAfterReadyAdapter` subclass that exposes `injectError`/`injectResetRequired` — these are public methods on the TEST ADAPTER, NOT on the session. Per Global Constraint: no accessing session private fields, no invented session methods, state assertions via `getState()`/`getDiagnostics()`, state subscription via `onStateChange()`.

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestRuntimeAdapter } from "./test-adapter.js";
import { RuntimeSession } from "./session.js";
import { SnapshotStore } from "./store.js";
import { CommandGateway } from "./gateway.js";
import type { RuntimeSnapshot, DomainEvent, RuntimeStreamError, RuntimeStreamObserver, RuntimeSubscription } from "@agent-office/protocol";
import { EventType } from "@agent-office/protocol";

const RUNTIME_ID = "rt-reconnect";

function makeSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID, snapshotId: `snap-${seq}`, sequence: seq, schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z", lastEventId: "",
    agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
  };
}

function makeEvent(seq: number): DomainEvent {
  return {
    eventId: `evt-${seq}`, runtimeId: RUNTIME_ID, sequence: seq, schemaVersion: "1.0",
    type: EventType.TASK_CREATED, occurredAt: "2026-07-04T00:00:00.000Z",
    receivedAt: "2026-07-04T00:00:00.000Z", correlationId: `c-${seq}`,
    causationId: null, traceId: `t-${seq}`, payload: {},
  };
}

/**
 * Test adapter that captures the live observer so tests can inject post-ready
 * errors/reset-required through the adapter (simulating what a real adapter does
 * when the stream drops). This does NOT access any session private field.
 */
class ErrorAfterReadyAdapter extends TestRuntimeAdapter {
  private liveObs: RuntimeStreamObserver | null = null;

  subscribe(observer: RuntimeStreamObserver, options?: { afterSequence?: number }): RuntimeSubscription {
    const sub = super.subscribe(observer, options);
    // Capture observer after subscribe returns; the adapter will add it to subscribers
    // once ready resolves. We stash it for injection.
    this.liveObs = observer;
    return sub;
  }

  /** Inject a post-ready error (simulates adapter detecting stream drop). */
  injectError(err: RuntimeStreamError): void {
    this.liveObs?.onError?.(err);
    this.liveObs?.onState?.(err.recoverable ? "error" : "error");
  }

  /** Inject a reset-required signal (simulates adapter detecting trimmed log). */
  injectResetRequired(): void {
    this.liveObs?.onState?.("reset_required");
  }

  /** Inject a live event (simulates adapter delivering a post-ready event). */
  injectEvent(event: DomainEvent): void {
    this.liveObs?.onEvent?.(event);
  }
}

describe("RuntimeSession reconnect integration", () => {
  let adapter: ErrorAfterReadyAdapter;
  let store: SnapshotStore;
  let gateway: CommandGateway;
  let session: RuntimeSession;

  beforeEach(() => {
    adapter = new ErrorAfterReadyAdapter({ initialSnapshot: makeSnapshot() });
    store = new SnapshotStore(RUNTIME_ID);
    gateway = new CommandGateway(adapter);
    session = new RuntimeSession(adapter, store, gateway, {
      reconnectPolicy: { initialDelayMs: 10, maxDelayMs: 50, maxAttempts: 3, jitterRatio: 0 },
    });
  });

  it("post-ready recoverable error triggers reconnect with backoff", async () => {
    await session.connect();
    expect(session.getState()).toBe("connected");
    expect(session.getDiagnostics().reconnectCount).toBe(0);

    adapter.injectError({ code: "http_error", message: "simulated network drop", recoverable: true });

    // Wait for backoff (10ms initial) + resync
    await new Promise((r) => setTimeout(r, 80));
    expect(session.getDiagnostics().reconnectCount).toBeGreaterThanOrEqual(1);
    // After successful resync, state returns to connected
    expect(session.getState()).toBe("connected");
  });

  it("multiple rapid errors produce only one reconnect (single-flight via reconnectPromise + reconnectTimer)", async () => {
    await session.connect();
    const states: SessionState[] = [];
    session.onStateChange((s) => states.push(s));

    adapter.injectError({ code: "http_error", message: "drop 1", recoverable: true });
    adapter.injectError({ code: "http_error", message: "drop 2", recoverable: true });
    adapter.injectError({ code: "http_error", message: "drop 3", recoverable: true });

    await new Promise((r) => setTimeout(r, 120));
    // Only one reconnect should have been scheduled (single-flight)
    expect(session.getDiagnostics().reconnectCount).toBe(1);
    expect(session.getState()).toBe("connected");
  });

  it("disconnect cancels pending reconnect timer and awaits in-flight reconnectPromise", async () => {
    await session.connect();
    adapter.injectError({ code: "http_error", message: "drop", recoverable: true });
    // disconnect before the timer fires / while reconnectPromise is in-flight
    await session.disconnect();
    const countAfterDisconnect = session.getDiagnostics().reconnectCount;
    await new Promise((r) => setTimeout(r, 120));
    // reconnectCount should NOT have increased after disconnect
    expect(session.getDiagnostics().reconnectCount).toBe(countAfterDisconnect);
    expect(session.getState()).toBe("disconnected");
  });

  it("exceeding maxAttempts transitions to failed (resynchronizeOrThrow re-throws)", async () => {
    // Adapter that always fails getSnapshot during resync
    const failAdapter = new ErrorAfterReadyAdapter({ initialSnapshot: makeSnapshot() });
    failAdapter.snapshotError = new Error("resync fails");
    const failSession = new RuntimeSession(failAdapter, new SnapshotStore(RUNTIME_ID), new CommandGateway(failAdapter), {
      reconnectPolicy: { initialDelayMs: 5, maxDelayMs: 10, maxAttempts: 2, jitterRatio: 0 },
    });
    await failSession.connect();
    failAdapter.injectError({ code: "http_error", message: "drop", recoverable: true });

    // Wait for 2 reconnect attempts to fail
    await new Promise((r) => setTimeout(r, 200));
    expect(failSession.getState()).toBe("failed");
    expect(failSession.getDiagnostics().reconnectCount).toBe(2);
    expect(failSession.getDiagnostics().lastError?.code).toBe("reconnect_failed");
  });

  it("reset_required triggers immediate resync (no backoff)", async () => {
    await session.connect();
    expect(session.getDiagnostics().resyncCount).toBe(0);

    adapter.injectResetRequired();

    await new Promise((r) => setTimeout(r, 80));
    expect(session.getDiagnostics().resyncCount).toBe(1);
    expect(session.getState()).toBe("connected");
  });

  it("non-recoverable error closes subscription BEFORE entering failed (no stale stream)", async () => {
    await session.connect();
    // Verify subscription is active
    expect(session.getDiagnostics().hasActiveSubscription).toBe(true);

    adapter.injectError({ code: "authentication_failed", message: "token expired", recoverable: false });

    await new Promise((r) => setTimeout(r, 50));
    expect(session.getState()).toBe("failed");
    expect(session.getDiagnostics().reconnectCount).toBe(0);
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    // Subscription must be closed (no stale stream in failed session)
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  it("reconnectCount is cumulative (never resets on success)", async () => {
    await session.connect();
    adapter.injectError({ code: "http_error", message: "drop 1", recoverable: true });
    await new Promise((r) => setTimeout(r, 80));
    expect(session.getDiagnostics().reconnectCount).toBe(1);

    // Second drop — count should increment to 2, not reset
    adapter.injectError({ code: "http_error", message: "drop 2", recoverable: true });
    await new Promise((r) => setTimeout(r, 80));
    expect(session.getDiagnostics().reconnectCount).toBe(2);
    expect(session.getState()).toBe("connected");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/session-reconnect.test.ts`
Expected: FAIL — `reconnectPolicy` not in options, `reconnectCount` not in diagnostics.

- [ ] **Step 3: Implement reconnect in session.ts (with resynchronizeOrThrow + reconnectPromise)**

Modify `packages/core/src/session.ts`:

Add imports at top (after existing protocol imports):

```ts
import type {
  RuntimeAdapter,
  DomainEvent,
  EventApplyResult,
  RuntimeStreamObserver,
  RuntimeStreamState,
  RuntimeSubscription,
  RuntimeStreamError,
  ReconnectPolicy,
} from "@agent-office/protocol";
import { defaultReconnectPolicy } from "@agent-office/protocol";
```

Update `RuntimeSessionOptions`:

```ts
export interface RuntimeSessionOptions {
  autoResume?: boolean;
  reconnectPolicy?: ReconnectPolicy;
}
```

Update `SessionDiagnostics` (add `reconnectCount`):

```ts
export interface SessionDiagnostics {
  state: SessionState;
  lastSequence: number;
  lastError: SessionError | null;
  lastGap: GapDiagnostic | null;
  resyncCount: number;
  reconnectCount: number;          // NEW — cumulative, never resets
  hasActiveSubscription: boolean;
  activeSubscriptionCursor: number | null;
}
```

Update `SessionErrorCode` (add `reconnect_failed`):

```ts
export type SessionErrorCode =
  | "runtime_mismatch"
  | "connect_failed"
  | "snapshot_failed"
  | "subscribe_failed"
  | "resync_failed"
  | "disconnect_failed"
  | "reconnect_failed";            // NEW
```

Add fields to `RuntimeSession` class (after `resyncPromise`):

```ts
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Single-flight: in-flight reconnect Promise. scheduleReconnect() checks BOTH timer AND this. */
  private reconnectPromise: Promise<void> | null = null;
  /** Current backoff counter (resets to 0 on successful reconnect). */
  private reconnectAttempts = 0;
  private reconnectPolicy: ReconnectPolicy;
```

Update constructor:

```ts
  constructor(
    adapter: RuntimeAdapter,
    store: SnapshotStore,
    gateway: CommandGateway,
    options: RuntimeSessionOptions = {}
  ) {
    this.adapter = adapter;
    this.store = store;
    this.gateway = gateway;
    this.options = { autoResume: true, ...options };
    this.reconnectPolicy = options.reconnectPolicy ?? defaultReconnectPolicy;
  }
```

Update `diagnostics` initializer to include `reconnectCount: 0`.

**Refactor `resynchronize()` into `resynchronizeOrThrow()` (Architecture Decision J):**

Extract the body of `doResynchronize()` into `resynchronizeOrThrow()` that re-throws on failure. Public `resynchronize()` wraps it in try/catch (Plan 1 compat — swallows errors, sets `failed`):

```ts
  /**
   * Public resynchronize (Plan 1 API compat).
   * Wraps resynchronizeOrThrow() in try/catch — swallows errors, sets failed state.
   * External callers (e.g. UI "retry" button) use this.
   */
  async resynchronize(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;
    if (this.resyncPromise) return this.resyncPromise;
    this.resyncPromise = this.resynchronizeOrThrow();
    try {
      await this.resyncPromise;
    } catch (err) {
      // Swallow — Plan 1 compat. State already set to failed inside resynchronizeOrThrow.
      void err;
    } finally {
      this.resyncPromise = null;
    }
  }

  /**
   * Private resynchronize that RE-THROWS on failure.
   * Used by doReconnect() which needs to know success/failure to decide
   * whether to reset reconnectAttempts or schedule another retry.
   *
   * On failure: sets state to "failed", records error, then THROWS.
   * (Caller decides whether to catch — public resynchronize() catches;
   *  doReconnect() catches to schedule retry.)
   */
  private async resynchronizeOrThrow(): Promise<void> {
    const myEpoch = this.epoch;
    this.setState("resynchronizing");
    await this.removeSubscription();

    try {
      const snapshot = await this.adapter.getSnapshot();
      if (this.epoch !== myEpoch) return; // disconnect 已发生

      const installResult = this.store.setSnapshot(snapshot);
      if (!installResult.ok) {
        throw this.makeSessionError(
          "resync_failed",
          `Resync checkpoint rejected: ${installResult.reason}`
        );
      }
      this.gateway.updateSnapshot(this.store.getSnapshot());
      this.diagnostics.lastSequence = snapshot.sequence;
      this.diagnostics.resyncCount += 1;
      if (this.diagnostics.lastGap) {
        this.diagnostics.lastGap.resyncedToSequence = snapshot.sequence;
      }

      if (this.options.autoResume) {
        if (this.epoch !== myEpoch) return;
        let subscription: RuntimeSubscription;
        try {
          subscription = this.installSubscription(snapshot.sequence);
        } catch (err) {
          throw this.makeSessionError(
            "subscribe_failed",
            err instanceof Error ? err.message : String(err)
          );
        }
        try {
          await subscription.ready;
        } catch (err) {
          await this.removeSubscription();
          throw this.makeSessionError(
            "subscribe_failed",
            err instanceof Error ? err.message : String(err)
          );
        }
        if (this.epoch !== myEpoch) {
          await this.removeSubscription();
          return;
        }
        if (this.subscription !== subscription) return;
        if (this.state === "degraded" || this.state === "failed") return;
        this.setState("connected");
      } else {
        this.setState("connected");
      }
    } catch (err) {
      // On failure: ensure no stale subscription, set failed, then RE-THROW.
      await this.removeSubscription();
      if (this.epoch !== myEpoch) return; // disconnect caused the failure — don't set failed
      this.recordError(err);
      this.setState("failed");
      throw err;
    }
  }
```

Update `installSubscription` to wire `onError`/`onState`:

```ts
  private installSubscription(afterSequence: number): RuntimeSubscription {
    const observer: RuntimeStreamObserver = {
      onEvent: (event) => this.handleEvent(event),
      onError: (error) => this.handleStreamError(error),
      onState: (state) => this.handleStreamState(state),
    };
    const subscription = this.adapter.subscribe(observer, { afterSequence });
    this.subscription = subscription;
    this.activeSubscriptionCursor = afterSequence;
    this.diagnostics.hasActiveSubscription = true;
    this.diagnostics.activeSubscriptionCursor = afterSequence;
    return subscription;
  }

  private handleStreamError(error: RuntimeStreamError): void {
    if (!this.subscription) return;
    // event_log_trimmed is paired with onState("reset_required") — route it to
    // the single reset-recovery path, NOT the backoff-reconnect path.
    // (Plan Review Issue 5, v3: share one recovery lock for reset/trimmed.)
    if (error.code === "event_log_trimmed") {
      // The adapter will also call onState("reset_required") — that triggers
      // triggerResetRecovery(). Just close the subscription here; don't schedule
      // a competing backoff reconnect.
      return;
    }
    if (error.recoverable) {
      // Recoverable: degrade + schedule reconnect (single-flight).
      this.setState("degraded");
      this.scheduleReconnect();
    } else {
      // Non-recoverable: CLOSE SUBSCRIPTION FIRST, then set failed.
      // (Architecture Decision J: no stale stream in failed session.)
      void this.handleNonRecoverableError(error);
    }
  }

  private async handleNonRecoverableError(error: RuntimeStreamError): Promise<void> {
    const myEpoch = this.epoch;
    await this.removeSubscription();
    if (this.epoch !== myEpoch) return; // disconnect won the race
    // Map transport error code to SessionErrorCode. (Plan Review Issue 6, v3:
    // reconnect_failed is a SessionErrorCode, NOT a RuntimeErrorCode — it must
    // never appear as RuntimeStreamError.code. handleNonRecoverableError is only
    // called with real RuntimeStreamError codes from the adapter.)
    const sessionCode: SessionErrorCode =
      error.code === "authentication_failed" ? "subscribe_failed" :
      error.code === "stream_protocol_error" ? "subscribe_failed" :
      "subscribe_failed";
    this.recordError(this.makeSessionError(sessionCode, error.message));
    this.setState("failed");
  }

  private handleStreamState(state: RuntimeStreamState): void {
    if (state === "reset_required") {
      // Immediate resync, no backoff. Shares the reconnectPromise lock with
      // backoff reconnect so reset_required and event_log_trimmed can't fire
      // two competing recovery operations. (Plan Review Issue 5, v3)
      void this.triggerResetRecovery();
    }
  }

  /**
   * Single-flight reset recovery. Shares `reconnectPromise` with `doReconnect()`
   * so reset_required (from onState) and event_log_trimmed (from onError) can't
   * fire two competing recovery operations. (Plan Review Issue 5, v3)
   *
   * If a backoff timer is pending, cancel it — reset is immediate, no backoff.
   * If recovery fails, fall back to `scheduleReconnect()` (which may itself
   * give up at maxAttempts via `handleTerminalReconnectFailure`).
   */
  private async triggerResetRecovery(): Promise<void> {
    if (this.reconnectPromise !== null) return; // recovery already in-flight
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.state === "disconnected" || this.state === "failed") return;

    const myEpoch = this.epoch;
    const p = (async () => {
      try {
        await this.resynchronizeOrThrow();
        if (this.epoch !== myEpoch) return;
        // Success — reset backoff counter (reconnectCount stays cumulative).
        this.reconnectAttempts = 0;
      } catch (err) {
        if (this.epoch !== myEpoch) return;
        void err;
        // Reset failed — clear the lock BEFORE scheduleReconnect, otherwise the
        // single-flight guard (reconnectPromise !== null) blocks the next retry.
        // (Plan Review Issue 4, v3)
        if (this.reconnectPromise === p) this.reconnectPromise = null;
        this.setState("degraded");
        this.scheduleReconnect();
      }
    })();
    this.reconnectPromise = p;
    try {
      await p;
    } catch {
      // swallow — handled above
    } finally {
      // Only clear if not already cleared by the inner catch (which may have
      // already nulled it before calling scheduleReconnect).
      if (this.reconnectPromise === p) this.reconnectPromise = null;
    }
  }

  /**
   * Schedule a reconnect with exponential backoff.
   * Single-flight: checks BOTH reconnectTimer AND reconnectPromise.
   * If either is set, no-op (closes the timer-fire → clear → resync → second-error → new-timer window).
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;   // timer pending
    if (this.reconnectPromise !== null) return; // resync in-flight
    if (this.state === "disconnected" || this.state === "failed") return;

    if (this.reconnectAttempts >= this.reconnectPolicy.maxAttempts) {
      // Max attempts exceeded — terminal. Don't construct a RuntimeStreamError
      // with reconnect_failed (that's a SessionErrorCode, not a RuntimeErrorCode).
      // (Plan Review Issue 6, v3)
      void this.handleTerminalReconnectFailure();
      return;
    }
    const policy = this.reconnectPolicy;
    const base = Math.min(policy.maxDelayMs, policy.initialDelayMs * Math.pow(2, this.reconnectAttempts));
    const jitter = base * policy.jitterRatio * (Math.random() * 2 - 1);
    const delay = Math.max(0, base + jitter);
    this.reconnectAttempts += 1;
    this.diagnostics.reconnectCount += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.doReconnect();
    }, delay);
  }

  /**
   * Terminal reconnect failure — max attempts exceeded.
   * Records `reconnect_failed` (SessionErrorCode) and transitions to `failed`.
   * Closes subscription BEFORE failed (no stale stream).
   * (Plan Review Issue 6, v3: separate from handleNonRecoverableError which is
   *  for RuntimeStreamError; this is a session-level terminal condition.)
   */
  private async handleTerminalReconnectFailure(): Promise<void> {
    const myEpoch = this.epoch;
    await this.removeSubscription();
    if (this.epoch !== myEpoch) return; // disconnect won the race
    this.recordError(this.makeSessionError(
      "reconnect_failed",
      `Exceeded max reconnect attempts (${this.reconnectPolicy.maxAttempts})`
    ));
    this.setState("failed");
  }

  /**
   * Perform a single backoff reconnect attempt.
   * Uses resynchronizeOrThrow() so failure is visible (re-throws).
   * Sets reconnectPromise at entry, clears in finally (single-flight).
   *
   * CRITICAL (Plan Review Issue 4, v3): the inner catch MUST clear
   * reconnectPromise BEFORE calling scheduleReconnect(), otherwise the
   * single-flight guard (reconnectPromise !== null) blocks the next retry and
   * the session can only ever attempt one reconnect.
   */
  private async doReconnect(): Promise<void> {
    if (this.reconnectPromise !== null) return; // single-flight
    const myEpoch = this.epoch;
    const p = (async () => {
      try {
        await this.resynchronizeOrThrow();
        if (this.epoch !== myEpoch) return; // disconnect
        // Success — reset backoff counter (reconnectCount stays cumulative).
        this.reconnectAttempts = 0;
        // State already set to "connected" inside resynchronizeOrThrow on success.
      } catch (err) {
        if (this.epoch !== myEpoch) return; // disconnect
        void err;
        // Resync failed — clear the lock BEFORE scheduleReconnect, otherwise the
        // single-flight guard blocks the next retry. (Plan Review Issue 4, v3)
        if (this.reconnectPromise === p) this.reconnectPromise = null;
        // Override the "failed" set by resynchronizeOrThrow — we want to retry,
        // not give up immediately. Only `handleTerminalReconnectFailure` may
        // set `failed` for reconnect exhaustion.
        this.setState("degraded");
        this.scheduleReconnect();
      }
    })();
    this.reconnectPromise = p;
    try {
      await p;
    } catch {
      // swallow — handled above
    } finally {
      // Only clear if not already cleared by the inner catch.
      if (this.reconnectPromise === p) this.reconnectPromise = null;
    }
  }
```

Update `disconnect()` to clear reconnect timer + await reconnectPromise (with epoch guard):

```ts
  async disconnect(): Promise<void> {
    this.epoch += 1;
    // 1. Clear reconnect timer (cancels pending backoff).
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // 2. Await in-flight reconnect (with epoch guard — epoch already incremented,
    //    so doReconnectInner will bail out on its epoch check; but we still await
    //    to ensure no post-disconnect state mutation).
    if (this.reconnectPromise) {
      try { await this.reconnectPromise; } catch { /* epoch guard handles */ }
    }
    // 3. Reset backoff counter (reconnectCount stays cumulative in diagnostics).
    this.reconnectAttempts = 0;
    // 4. Remove subscription + disconnect adapter.
    await this.removeSubscription();
    try {
      await this.adapter.disconnect();
    } catch (err) {
      this.recordError(
        this.makeSessionError(
          "disconnect_failed",
          err instanceof Error ? err.message : String(err)
        )
      );
      this.setState("disconnected");
      return;
    }
    this.setState("disconnected");
  }
```

- [ ] **Step 4: Re-export ReconnectPolicy from core index**

Add to `packages/core/src/index.ts` (after existing protocol re-exports):

```ts
export type { ReconnectPolicy } from "@agent-office/protocol";
export { defaultReconnectPolicy } from "@agent-office/protocol";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/core/src/session-reconnect.test.ts`
Expected: PASS — all 7 reconnect tests green.

- [ ] **Step 6: Run full suite + build gate**

Run: `npm test`
Expected: PASS — all previous tests + 7 new = +7 tests. Verify Plan 1's 118 tests still green.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/session.ts packages/core/src/index.ts packages/core/src/session-reconnect.test.ts
git commit -m "feat(core): RuntimeSession reconnect with resynchronizeOrThrow + reconnectPromise single-flight (#6 Plan 2 Task 6)"
```

**Compatibility:** Additive to RuntimeSession. `RuntimeSessionOptions` gains an optional field — existing callers passing no options are unaffected. `SessionDiagnostics` gains `reconnectCount` — existing readers get `0` via fresh `getDiagnostics()`. `SessionErrorCode` gains `"reconnect_failed"` — exhaustive switch statements must be updated (verify with `npm run build`; none exist in the codebase per a Grep). Public `resynchronize()` signature unchanged — still `Promise<void>`, still swallows errors (Plan 1 compat). The internal refactor (`doResynchronize` → `resynchronizeOrThrow`) is private and does not affect any external caller.

**Rollback:** `git revert <commit>` — restores session.ts to Plan 1 state.

---

### Task 7: Auth and Sanitized Diagnostics

**Goal:** Implement auth header provider resolution and log/error sanitization. Verify tokens never appear in diagnostics.

**Files:**
- Create: `packages/adapters/http-sse/src/auth.ts`
- Create: `packages/adapters/http-sse/src/auth.test.ts`
- Modify: `packages/adapters/http-sse/src/adapter.ts` (use `resolveAuthHeaders` + sanitize errors)

**Interfaces:**
- Produces: `AuthHeaderProvider = Record<string, string> | (() => Promise<Record<string, string>>)`, `resolveAuthHeaders(provider): Promise<Record<string, string>>`, `sanitizeHeadersForLog(headers): Record<string, string>`, `sanitizeErrorMessage(message: string, secret: string): string`.

- [ ] **Step 1: Write the failing test**

Create `packages/adapters/http-sse/src/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveAuthHeaders, sanitizeHeadersForLog, sanitizeErrorMessage } from "./auth.js";

describe("resolveAuthHeaders", () => {
  it("returns object headers as-is (shallow copy)", async () => {
    const h = { Authorization: "Bearer abc", "X-Custom": "x" };
    const r = await resolveAuthHeaders(h);
    expect(r).toEqual(h);
    expect(r).not.toBe(h); // different reference
  });

  it("awaits function provider", async () => {
    const provider = async () => ({ Authorization: "Bearer dynamic" });
    const r = await resolveAuthHeaders(provider);
    expect(r.Authorization).toBe("Bearer dynamic");
  });

  it("returns empty object for undefined", async () => {
    const r = await resolveAuthHeaders(undefined);
    expect(r).toEqual({});
  });

  it("propagates provider errors", async () => {
    const provider = async () => { throw new Error("token endpoint down"); };
    await expect(resolveAuthHeaders(provider)).rejects.toThrow("token endpoint down");
  });
});

describe("sanitizeHeadersForLog", () => {
  it("redacts Authorization header", () => {
    const r = sanitizeHeadersForLog({ Authorization: "Bearer secret-token-123" });
    expect(r.Authorization).toBe("<redacted>");
  });

  it("redacts Cookie header", () => {
    const r = sanitizeHeadersForLog({ Cookie: "session=abc123" });
    expect(r.Cookie).toBe("<redacted>");
  });

  it("preserves non-sensitive headers", () => {
    const r = sanitizeHeadersForLog({ "Content-Type": "application/json", "X-Request-Id": "abc" });
    expect(r["Content-Type"]).toBe("application/json");
    expect(r["X-Request-Id"]).toBe("abc");
  });

  it("handles case-insensitive Authorization", () => {
    const r = sanitizeHeadersForLog({ authorization: "Bearer x" });
    expect(r.authorization).toBe("<redacted>");
  });
});

describe("sanitizeErrorMessage", () => {
  it("removes token from message", () => {
    const msg = `Request failed with token=secret-token-123`;
    const r = sanitizeErrorMessage(msg, "secret-token-123");
    expect(r).not.toContain("secret-token-123");
  });

  it("returns message unchanged if secret not present", () => {
    const r = sanitizeErrorMessage("plain error", "secret-token-123");
    expect(r).toBe("plain error");
  });
});

describe("HttpSseRuntimeAdapter token safety", () => {
  // Plan Review Fix 12, v3: connect() now fetches Capabilities only (NOT Snapshot).
  // The test name is about the *snapshot fetch* error message, so call getSnapshot()
  // directly — no connect() needed (getSnapshot performs its own fresh HTTP fetch
  // and does not require cached capabilities).
  it("auth header does not appear in snapshot fetch error message", async () => {
    const { HttpSseRuntimeAdapter } = await import("./adapter.js");
    const adapter = new HttpSseRuntimeAdapter({
      runtimeId: "rt-1",
      baseUrl: "https://example.com",
      headers: { Authorization: "Bearer secret-token-XYZ" },
    });
    // Force a 500 error on snapshot fetch (no connect() — see Fix 12 above).
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response("err", { status: 500 }))) as unknown as typeof fetch;
    try {
      await adapter.getSnapshot();
      expect.fail("getSnapshot should have thrown");
    } catch (err) {
      const e = err as { message?: string };
      expect(e.message).not.toContain("secret-token-XYZ");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Plan Review Fix 12, v3: companion test — connect() now fetches Capabilities,
  // so the same secret-safety guarantee must hold for the capabilities fetch path.
  it("auth header does not appear in capabilities fetch error message", async () => {
    const { HttpSseRuntimeAdapter } = await import("./adapter.js");
    const adapter = new HttpSseRuntimeAdapter({
      runtimeId: "rt-1",
      baseUrl: "https://example.com",
      headers: { Authorization: "Bearer secret-token-XYZ" },
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => Promise.resolve(new Response("err", { status: 500 }))) as unknown as typeof fetch;
    try {
      await adapter.connect();
      expect.fail("connect should have thrown");
    } catch (err) {
      const e = err as { message?: string };
      expect(e.message).not.toContain("secret-token-XYZ");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/http-sse/src/auth.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement auth.ts**

Create `packages/adapters/http-sse/src/auth.ts`:

```ts
export type AuthHeaderProvider = Record<string, string> | (() => Promise<Record<string, string>>);

export async function resolveAuthHeaders(
  provider: AuthHeaderProvider | undefined
): Promise<Record<string, string>> {
  if (provider === undefined) return {};
  if (typeof provider === "function") {
    return await provider();
  }
  return { ...provider };
}

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "set-cookie", "proxy-authorization"]);

export function sanitizeHeadersForLog(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(k.toLowerCase())) {
      out[k] = "<redacted>";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function sanitizeErrorMessage(message: string, ...secrets: string[]): string {
  let result = message;
  for (const secret of secrets) {
    if (secret && result.includes(secret)) {
      result = result.split(secret).join("<redacted>");
    }
  }
  return result;
}
```

- [ ] **Step 4: Verify token safety in adapter**

The adapter's `connect()` calls `fetchSnapshot`, which on HTTP 500 throws `RuntimeStreamError { message: "Snapshot fetch failed: HTTP 500", ... }`. The message does not include headers. So the test should pass already. But to be defensive, the adapter's `resolveHeaders` results never enter error messages. Verify by running the test.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/adapters/http-sse/src/auth.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full suite + build gate**

Run: `npm test`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/adapters/http-sse/src/auth.ts packages/adapters/http-sse/src/auth.test.ts
git commit -m "feat(http-sse): auth header provider and sanitized diagnostics (#6 Plan 2 Task 7)"
```

**Compatibility:** New file. Adapter already uses `resolveAuthHeaders` pattern internally (inline); no behavior change.

**Rollback:** `git revert <commit>`.

---

### Task 8: Fake Server Integration Tests (revised per Plan Review)

**Goal:** End-to-end tests against an in-memory HTTP server covering all "Hard test scenarios" from the issue. **Revised per Plan Review** to:
- Use the **real public API only**: `onStateChange()`, `getState()`, `getDiagnostics()`, `onAcceptedEvent()`, `new SnapshotStore(runtimeId)`. No `onState()` (does not exist), no `waitForState()` added to `RuntimeSession`, no `getStore()`/`getGateway()` accessors.
- Assert `SessionState` values only (`disconnected`/`connecting`/`synchronizing`/`connected`/`resynchronizing`/`degraded`/`failed`). `subscribe_failed` is a `SessionErrorCode`, NOT a state — assert via `getDiagnostics().lastError?.code`.
- Inject failures **exclusively through the FakeServer** (network errors, malformed frames, gaps, auth failures, slow responses, stream drops). No accessing `session.subscription` or `reconnectTimer` via type casts. No invented `reportError()`/`reportState()` methods.
- FakeServer sends `event: replay-complete` after replay (per Architecture Decision H).
- Cover `disconnect()` during each lifecycle phase (snapshot fetch, command POST, stream opening, live read, reconnect backoff) per Architecture Decision I.
- Verify `getSnapshot()` makes a fresh HTTP fetch on every call (no permanent cache) by asserting `server.snapshotRequestCount` increments on resync.
- Verify `reconnectCount` is **cumulative** (never resets on success).
- Use real `OfficeCommand` field names (`commandId`, `commandType`, `timestamp`, `source`, `actorId`, `runtimeId`, `targetId`, `payload`) and `CommandType.TASK_CREATE`.
- Verify manual command retry requires a new `commandId` (gateway caches by `commandId`).

**Files:**
- Create: `packages/adapters/http-sse/src/fake-server.ts`
- Create: `packages/adapters/http-sse/src/integration.test.ts`

**Interfaces:**
- Produces: `FakeServer` class (test-only) with replay-complete support, request counters, delay controls, and error-injection hooks.

- [ ] **Step 1: Implement fake-server (with replay-complete + counters + delay controls)**

Create `packages/adapters/http-sse/src/fake-server.ts`. The server sends `event: replay-complete` after replay (per Architecture Decision H), tracks request counts for no-cache verification, supports delay/error injection for disconnect-during-X tests, and exposes live-client controls for stream-drop simulation.

```ts
import http from "node:http";
import type { RuntimeSnapshot, DomainEvent, OfficeCommand, CommandResult, AdapterCapabilities } from "@agent-office/protocol";

export interface FakeServerOptions {
  port?: number;
  runtimeId: string;
}

/**
 * Test-only in-memory HTTP server. Implements the Plan 2 wire protocol:
 *   GET  /runtime/snapshot       — returns snapshot JSON
 *   GET  /runtime/capabilities   — returns capabilities JSON
 *   GET  /runtime/events?afterSequence=N — opens SSE stream, replays events
 *                                          with seq > N, sends replay-complete,
 *                                          then registers as live client
 *   POST /runtime/commands       — dispatches to commandHandler
 *
 * Sends `event: replay-complete` after replay (Architecture Decision H).
 * Exposes counters and delay/error hooks for integration tests.
 */
export class FakeServer {
  private server: http.Server;
  private port: number;
  private snapshot: RuntimeSnapshot;
  private events: DomainEvent[] = [];
  private capabilities: AdapterCapabilities;
  private commandHandler: (cmd: OfficeCommand) => Promise<CommandResult>;
  private liveClients: Array<{ res: http.ServerResponse; afterSequence: number }> = [];

  // ─── Request counters (for no-cache and single-flight assertions) ───
  public snapshotRequestCount = 0;
  public capabilitiesRequestCount = 0;
  public commandRequestCount = 0;
  public streamOpenRequestCount = 0;
  public lastEventRequestHeaders: Record<string, string> = {};

  // ─── Delay controls (for disconnect-during-X tests) ───
  public snapshotDelayMs = 0;
  public commandDelayMs = 0;
  public streamOpenDelayMs = 0;

  // ─── Error injection hooks ───
  public snapshotErrorStatus: number | null = null;
  public capabilitiesErrorStatus: number | null = null;
  /** If true, do NOT send replay-complete (protocol violation test). */
  public omitReplayComplete = false;
  /** If set, send replay-complete with this lastSequence (for id/data mismatch test). */
  public replayCompleteLastSequenceOverride: number | null = null;
  /** If set, send a malformed event frame during replay (for event_invalid test). */
  public malformedReplayFrame: string | null = null;

  constructor(opts: FakeServerOptions) {
    this.port = opts.port ?? 0; // 0 = ephemeral
    const emptySnap: RuntimeSnapshot = {
      runtimeId: opts.runtimeId, snapshotId: "snap-init", sequence: 0, schemaVersion: "1.0",
      createdAt: new Date().toISOString(), lastEventId: "",
      agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
    };
    this.snapshot = emptySnap;
    this.capabilities = {
      supportedEvents: [], supportedCommands: [],
      features: { snapshot: true, sse: true, websocket: false, commandExecution: true, softMapping: false, hardOrchestration: false },
    };
    this.commandHandler = async (cmd) => ({
      commandId: cmd.commandId, status: "accepted" as const, affectedEventIds: [],
    });
    this.server = http.createServer((req, res) => this.handle(req, res));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        const addr = this.server.address();
        if (addr && typeof addr === "object") this.port = addr.port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const c of this.liveClients) {
      try { c.res.end(); } catch { /* best-effort */ }
    }
    this.liveClients = [];
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  getBaseUrl(): string { return `http://localhost:${this.port}`; }

  // ─── State setters ───
  setSnapshot(snap: RuntimeSnapshot): void { this.snapshot = snap; }
  setEvents(events: DomainEvent[]): void { this.events = events; }
  setCapabilities(caps: AdapterCapabilities): void { this.capabilities = caps; }
  setCommandHandler(fn: (cmd: OfficeCommand) => Promise<CommandResult>): void { this.commandHandler = fn; }

  // ─── Live client controls ───

  /** Push a live event to all live clients (after replay-complete). */
  pushEvent(event: DomainEvent): void {
    for (const c of this.liveClients) {
      if (event.sequence > c.afterSequence) {
        try {
          c.res.write(`event: domain-event\nid: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);
        } catch { /* best-effort */ }
      }
    }
  }

  /** Push a raw SSE frame string to all live clients (for malformed event injection). */
  pushRawFrame(frame: string): void {
    for (const c of this.liveClients) {
      try { c.res.write(frame); } catch { /* best-effort */ }
    }
  }

  /** Destroy all live SSE connections (simulates server-side network drop). */
  async disconnectAllLiveClients(): Promise<void> {
    for (const c of this.liveClients) {
      try { c.res.destroy(); } catch { /* best-effort */ }
    }
    this.liveClients = [];
  }

  getLiveClientCount(): number { return this.liveClients.length; }
  getLastEventRequestHeader(name: string): string | undefined {
    return this.lastEventRequestHeaders[name.toLowerCase()];
  }

  // ─── Request handler ───

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url ?? "";

    // GET /runtime/snapshot
    if (req.method === "GET" && url.endsWith("/runtime/snapshot")) {
      this.snapshotRequestCount += 1;
      if (this.snapshotDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.snapshotDelayMs));
      }
      if (this.snapshotErrorStatus !== null) {
        res.writeHead(this.snapshotErrorStatus);
        res.end(`{"error":"snapshot ${this.snapshotErrorStatus}"}`);
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.snapshot));
      return;
    }

    // GET /runtime/capabilities
    if (req.method === "GET" && url.endsWith("/runtime/capabilities")) {
      this.capabilitiesRequestCount += 1;
      if (this.capabilitiesErrorStatus !== null) {
        res.writeHead(this.capabilitiesErrorStatus);
        res.end(`{"error":"capabilities ${this.capabilitiesErrorStatus}"}`);
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(this.capabilities));
      return;
    }

    // GET /runtime/events?afterSequence=N
    if (req.method === "GET" && url.includes("/runtime/events")) {
      this.streamOpenRequestCount += 1;
      // Capture request headers (for auth-refresh assertions)
      this.lastEventRequestHeaders = {};
      for (const key of Object.keys(req.headers)) {
        this.lastEventRequestHeaders[key.toLowerCase()] = String(req.headers[key]);
      }
      if (this.streamOpenDelayMs > 0) {
        await new Promise((r) => setTimeout(r, this.streamOpenDelayMs));
      }
      const afterSeq = parseInt(new URL(`http://x${url}`).searchParams.get("afterSequence") ?? "0", 10);
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });

      // ─── Replay phase ───
      let lastReplayedSeq = afterSeq;
      for (const ev of this.events) {
        if (ev.sequence > afterSeq) {
          res.write(`event: domain-event\nid: ${ev.sequence}\ndata: ${JSON.stringify(ev)}\n\n`);
          lastReplayedSeq = ev.sequence;
        }
      }
      // Optional malformed frame during replay (for event_invalid test)
      if (this.malformedReplayFrame !== null) {
        res.write(this.malformedReplayFrame);
      }
      // ─── replay-complete control frame (Architecture Decision H) ───
      if (!this.omitReplayComplete) {
        const lastSeq = this.replayCompleteLastSequenceOverride ?? lastReplayedSeq;
        res.write(`event: replay-complete\nid: ${lastSeq}\ndata: {"lastSequence":${lastSeq}}\n\n`);
        // Register as live client for subsequent pushEvent/pushRawFrame calls.
        // Also listen for client-side disconnect so liveClients stays clean
        // (Plan Review Fix 15, v3) — without this, an adapter that closes
        // mid-stream leaves a stale entry that pollutes connection-count
        // assertions and later pushEvent calls.
        const clientEntry = { res, afterSequence: afterSeq };
        this.liveClients.push(clientEntry);
        res.on("close", () => {
          const idx = this.liveClients.indexOf(clientEntry);
          if (idx >= 0) this.liveClients.splice(idx, 1);
        });
      } else {
        // Plan Review Fix 13, v3: when omitReplayComplete is set, the server
        // MUST close the connection after sending the replay events (without
        // the replay-complete frame). Without this, the stream stays open,
        // `ready` never settles, and the Session is stuck in `synchronizing`
        // forever — never reaching `failed`. Closing here causes the adapter's
        // reader to see `done=true` without a `replay-complete` frame, which
        // per Architecture Decision H rejects `ready` with `stream_protocol_error`,
        // transitioning the Session to `failed` as the test expects.
        // Do NOT register as a live client — the stream is intentionally terminal.
        try { res.end(); } catch { /* best-effort */ }
      }
      return;
    }

    // POST /runtime/commands
    if (req.method === "POST" && url.endsWith("/runtime/commands")) {
      this.commandRequestCount += 1;
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        if (this.commandDelayMs > 0) {
          await new Promise((r) => setTimeout(r, this.commandDelayMs));
        }
        try {
          const cmd = JSON.parse(body) as OfficeCommand;
          const result = await this.commandHandler(cmd);
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500);
          res.end(String(err));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("not found");
  }
}
```

- [ ] **Step 2: Write integration tests (real public API only)**

Create `packages/adapters/http-sse/src/integration.test.ts`. Tests use a **local** `waitForState` helper built on `onStateChange()` — it is NOT added to `RuntimeSession`. The `store` and `gateway` references are kept directly (no `getStore()`/`getGateway()` accessors). All failures are injected through `FakeServer` controls.

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FakeServer } from "./fake-server.js";
import { HttpSseRuntimeAdapter, defaultEndpoints } from "./index.js";
import { RuntimeSession, SnapshotStore, CommandGateway } from "@agent-office/core";
import type { SessionState } from "@agent-office/core";
import type { RuntimeSnapshot, DomainEvent, OfficeCommand, ReconnectPolicy } from "@agent-office/protocol";
import { EventType, CommandType } from "@agent-office/protocol";

const RUNTIME_ID = "rt-integration";

function makeSnapshot(seq = 0): RuntimeSnapshot {
  return {
    runtimeId: RUNTIME_ID, snapshotId: `snap-${seq}`, sequence: seq, schemaVersion: "1.0",
    createdAt: "2026-07-04T00:00:00.000Z", lastEventId: "",
    agents: [], tasks: [], artifacts: [], approvals: [], rooms: [],
  };
}

function makeEvent(seq: number): DomainEvent {
  return {
    eventId: `evt-${seq}`, runtimeId: RUNTIME_ID, sequence: seq, schemaVersion: "1.0",
    type: EventType.TASK_CREATED, occurredAt: "2026-07-04T00:00:00.000Z",
    receivedAt: "2026-07-04T00:00:00.000Z", correlationId: `c-${seq}`,
    causationId: null, traceId: `t-${seq}`, payload: {},
  };
}

function makeCommand(id: string): OfficeCommand {
  return {
    commandId: id,
    commandType: CommandType.TASK_CREATE,
    timestamp: "2026-07-04T00:00:00.000Z",
    source: "user",
    actorId: "user-1",
    runtimeId: RUNTIME_ID,
    targetId: null,
    payload: { title: "t", description: "d" },
  };
}

/** Local helper — NOT added to RuntimeSession. Uses onStateChange() (the real API). */
function waitForState(session: RuntimeSession, target: SessionState, timeoutMs = 5000): Promise<void> {
  if (session.getState() === target) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`waitForState(${target}) timed out after ${timeoutMs}ms (current=${session.getState()})`));
    }, timeoutMs);
    const off = session.onStateChange((s) => {
      if (s === target) {
        clearTimeout(timer);
        off();
        resolve();
      }
    });
  });
}

let server: FakeServer;
let baseUrl: string;

beforeAll(async () => {
  server = new FakeServer({ runtimeId: RUNTIME_ID });
  await server.start();
  baseUrl = server.getBaseUrl();
});

afterAll(async () => {
  await server.stop();
});

beforeEach(() => {
  server.setSnapshot(makeSnapshot(0));
  server.setEvents([]);
  server.snapshotRequestCount = 0;
  server.capabilitiesRequestCount = 0;
  server.commandRequestCount = 0;
  server.streamOpenRequestCount = 0;
  server.snapshotDelayMs = 0;
  server.commandDelayMs = 0;
  server.streamOpenDelayMs = 0;
  server.snapshotErrorStatus = null;
  server.capabilitiesErrorStatus = null;
  server.omitReplayComplete = false;
  server.replayCompleteLastSequenceOverride = null;
  server.malformedReplayFrame = null;
});

function makeAdapter(opts: {
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  fallbackCapabilities?: import("@agent-office/protocol").AdapterCapabilities;
} = {}): HttpSseRuntimeAdapter {
  return new HttpSseRuntimeAdapter({
    runtimeId: RUNTIME_ID,
    baseUrl,
    endpoints: defaultEndpoints,
    headers: opts.headers,
    fallbackCapabilities: opts.fallbackCapabilities,
  });
}

function makeSession(
  adapter: HttpSseRuntimeAdapter,
  reconnectPolicy?: ReconnectPolicy
): { session: RuntimeSession; store: SnapshotStore; gateway: CommandGateway } {
  const store = new SnapshotStore(RUNTIME_ID);
  const gateway = new CommandGateway(adapter);
  const session = new RuntimeSession(adapter, store, gateway, {
    autoResume: true,
    reconnectPolicy,
  });
  return { session, store, gateway };
}

const FAST_POLICY: ReconnectPolicy = { initialDelayMs: 10, maxDelayMs: 50, maxAttempts: 5, jitterRatio: 0 };

describe("integration: HttpSseRuntimeAdapter + RuntimeSession", () => {
  // ─── Hard scenario 1 & 2: replay delivered exactly once (with replay-complete) ───
  it("replays events between snapshot and subscribe exactly once", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1), makeEvent(2), makeEvent(3)]);

    const adapter = makeAdapter();
    const { session } = makeSession(adapter);
    const received: number[] = [];
    session.onAcceptedEvent((e) => received.push(e.sequence));
    await session.connect();
    await waitForState(session, "connected");
    await new Promise((r) => setTimeout(r, 50)); // flush replay microtasks
    expect(received).toEqual([1, 2, 3]);
    await session.disconnect();
  });

  // ─── Hard scenario 3: replay gap rejects ready → failed + subscribe_failed code ───
  it("replay gap rejects ready: state=failed, lastError.code=subscribe_failed", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1), makeEvent(3)]); // gap at 2

    const adapter = makeAdapter();
    const { session } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "failed");
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
    await session.disconnect();
  });

  // ─── Hard scenario 4: runtime mismatch rejects ready ───
  it("runtime mismatch in stream rejects ready and prevents events entering Core", async () => {
    server.setSnapshot(makeSnapshot(0));
    const wrongEvent: DomainEvent = { ...makeEvent(1), runtimeId: "rt-other" };
    server.setEvents([wrongEvent]);

    const adapter = makeAdapter();
    const { session, store } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "failed");
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    expect(store.getSnapshot().sequence).toBe(0); // Core untouched
    await session.disconnect();
  });

  // ─── Hard scenario 5: ready failure leaves no active stream ───
  it("ready failure leaves no active stream (reader aborted)", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1), makeEvent(3)]); // gap

    const adapter = makeAdapter();
    const { session } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "failed");
    // Push a live event — must NOT be delivered (no active reader)
    const received: number[] = [];
    session.onAcceptedEvent((e) => received.push(e.sequence));
    server.pushEvent(makeEvent(4));
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toEqual([]);
    await session.disconnect();
  });

  // ─── Hard scenario 6: replay-complete omitted → stream_protocol_error ───
  it("server omitting replay-complete rejects ready with stream_protocol_error", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1)]);
    server.omitReplayComplete = true;

    const adapter = makeAdapter();
    const { session } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "failed");
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    await session.disconnect();
  });

  // ─── Hard scenario 7: post-ready network drop triggers single-flight reconnect ───
  it("post-ready network drop triggers reconnect and returns to connected", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    expect(session.getDiagnostics().reconnectCount).toBe(0);

    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: MUST first wait for `degraded` to prove the drop
    // was actually detected by the adapter. Without this gate, `waitForState(
    // "connected")` could pass immediately because the session is STILL in
    // `connected` (the reader-error → onError → scheduleReconnect chain hasn't
    // run yet) — a false positive. Only after `degraded` is observed do we
    // wait for recovery to `connected`.
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    expect(session.getDiagnostics().reconnectCount).toBeGreaterThanOrEqual(1);
    await session.disconnect();
  });

  // ─── Hard scenario 8: multiple rapid drops produce only one reconnect (single-flight) ───
  it("multiple rapid drops produce only one reconnect (single-flight via reconnectPromise)", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    const countBefore = session.getDiagnostics().reconnectCount;

    // Three rapid drops — only one reconnect should be scheduled
    await server.disconnectAllLiveClients();
    await new Promise((r) => setTimeout(r, 5));
    await server.disconnectAllLiveClients();
    await new Promise((r) => setTimeout(r, 5));
    await server.disconnectAllLiveClients();

    // Plan Review Fix 14, v3: gate on `degraded` first (see scenario 7 for
    // rationale) — the burst of drops must be observed before asserting
    // recovery. Otherwise `waitForState("connected")` could return immediately
    // off the pre-drop `connected` state.
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    const countAfter = session.getDiagnostics().reconnectCount;
    // Single-flight: at most one reconnect increment from the burst
    expect(countAfter - countBefore).toBeLessThanOrEqual(2);
    await session.disconnect();
  });

  // ─── Hard scenario 9: disconnect cancels fetch, reader, and timer ───
  it("disconnect during live read cancels reader and clears reconnect timer", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const slowPolicy: ReconnectPolicy = { initialDelayMs: 5000, maxDelayMs: 10000, maxAttempts: 5, jitterRatio: 0 };
    const { session } = makeSession(adapter, slowPolicy);
    await session.connect();
    await waitForState(session, "connected");

    // Trigger a stream drop — schedules a reconnect timer (5s backoff)
    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: wait for `degraded` to PROVE the drop was
    // detected and the reconnect timer was actually scheduled. The previous
    // 20ms fixed sleep was non-deterministic — if the reader-error hadn't
    // propagated yet, disconnect() would clean up nothing and the test would
    // still pass (false positive). Gating on `degraded` guarantees the timer
    // exists before we disconnect and assert it's canceled.
    await waitForState(session, "degraded", 1000);
    // disconnect before the timer fires
    await session.disconnect();

    expect(session.getState()).toBe("disconnected");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
    // Wait past when the timer would have fired — no state change
    await new Promise((r) => setTimeout(r, 100));
    expect(session.getState()).toBe("disconnected");
  });

  // ─── Hard scenario 10: reset_required triggers immediate resync with new checkpoint ───
  it("reset_required triggers immediate resync pulling fresh checkpoint", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([makeEvent(1), makeEvent(2)]);
    const adapter = makeAdapter();
    const { session, store } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "connected");
    const snapshotCountBefore = server.snapshotRequestCount;

    // Server advances checkpoint; signal reset via event_log_trimmed frame
    server.setSnapshot(makeSnapshot(5));
    server.setEvents([makeEvent(3), makeEvent(4), makeEvent(5)]);
    // Push a reset-required frame to live clients
    server.pushRawFrame(`event: reset-required\nid: 2\ndata: {}\n\n`);

    await waitForState(session, "resynchronizing", 1000);
    await waitForState(session, "connected", 3000);

    // getSnapshot() must have fetched fresh checkpoint (no cache)
    expect(server.snapshotRequestCount).toBeGreaterThan(snapshotCountBefore);
    expect(store.getSnapshot().sequence).toBe(5);
    await session.disconnect();
  });

  // ─── Hard scenario 11: after resync only one active stream ───
  it("after resync only one active stream exists", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    expect(server.getLiveClientCount()).toBe(1);

    // Trigger resync via reset-required
    server.setSnapshot(makeSnapshot(2));
    server.setEvents([makeEvent(1), makeEvent(2)]);
    server.pushRawFrame(`event: reset-required\nid: 0\ndata: {}\n\n`);

    await waitForState(session, "resynchronizing", 1000);
    await waitForState(session, "connected", 3000);
    expect(server.getLiveClientCount()).toBe(1);
    await session.disconnect();
  });

  // ─── Hard scenario 12: auth header refreshed on every reconnect ───
  it("auth header is refreshed on every reconnect", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    let tokenGen = 0;
    const headers = () => Promise.resolve({ Authorization: `Bearer token-${++tokenGen}` });
    const adapter = makeAdapter({ headers });
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    expect(server.getLastEventRequestHeader("authorization")).toBe("Bearer token-1");

    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: gate on `degraded` first to prove the drop was
    // detected and a reconnect was actually triggered (otherwise the auth
    // header assertion below could flake on the pre-drop state).
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    expect(server.getLastEventRequestHeader("authorization")).toBe("Bearer token-2");
    await session.disconnect();
  });

  // ─── Hard scenario 13: Authorization never appears in diagnostics ───
  it("Authorization header never appears in session diagnostics", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter({ headers: { Authorization: "Bearer secret-token-XYZ" } });
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");

    // Trigger an error via server-side drop; inspect diagnostics
    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: gate on `degraded` to PROVE the drop was
    // detected and an error diagnostic was actually recorded. The previous
    // 50ms sleep was non-deterministic — if the drop hadn't been processed
    // yet, the diagnostics might have no error at all, and the "Authorization
    // never appears" assertion would pass vacuously (false positive).
    await waitForState(session, "degraded", 1000);
    const diag = session.getDiagnostics();
    const serialized = JSON.stringify(diag);
    expect(serialized).not.toContain("secret-token-XYZ");
    expect(serialized).not.toContain("Bearer");
    await session.disconnect();
  });

  // ─── Hard scenario 14: POST command is never auto-retried ───
  it("POST command is never auto-retried by adapter", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    let postCount = 0;
    server.setCommandHandler(async (cmd) => {
      postCount += 1;
      throw new Error("transient 503"); // adapter must NOT retry
    });
    const adapter = makeAdapter();
    const { session, gateway } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "connected");

    const result = await gateway.execute(makeCommand("cmd-1"));
    expect(postCount).toBe(1); // no retry
    expect(result.status).toBe("error");
    await session.disconnect();
  });

  // ─── Hard scenario 15: manual retry requires new commandId (gateway caches) ───
  it("manual retry with same commandId returns cached result (no new POST)", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    let postCount = 0;
    server.setCommandHandler(async (cmd) => {
      postCount += 1;
      return { commandId: cmd.commandId, status: "accepted" as const, affectedEventIds: [] };
    });
    const adapter = makeAdapter();
    const { session, gateway } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "connected");

    const r1 = await gateway.execute(makeCommand("cmd-1"));
    expect(postCount).toBe(1);
    // Same commandId → gateway returns cached result, no new POST
    const r2 = await gateway.execute(makeCommand("cmd-1"));
    expect(postCount).toBe(1); // still 1
    expect(r2).toEqual(r1);
    // New commandId → new POST
    await gateway.execute(makeCommand("cmd-2"));
    expect(postCount).toBe(2);
    await session.disconnect();
  });

  // ─── Hard scenario 16: getSnapshot() fresh fetch (no permanent cache) ───
  it("getSnapshot() fetches fresh checkpoint on every call (no cache)", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    const countAfterConnect = server.snapshotRequestCount;

    // Trigger resync — getSnapshot() must fetch fresh
    server.setSnapshot(makeSnapshot(3));
    server.setEvents([makeEvent(1), makeEvent(2), makeEvent(3)]);
    server.pushRawFrame(`event: reset-required\nid: 0\ndata: {}\n\n`);
    await waitForState(session, "resynchronizing", 1000);
    await waitForState(session, "connected", 3000);

    expect(server.snapshotRequestCount).toBeGreaterThan(countAfterConnect);
    await session.disconnect();
  });

  // ─── Hard scenario 17: LIVE invalid event triggers onError + closes stream ───
  it("LIVE invalid event is reported (not silently dropped) and closes stream", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");

    // Push a malformed domain-event frame (invalid JSON in data)
    server.pushRawFrame(`event: domain-event\nid: 99\ndata: {not valid json}\n\n`);
    // The adapter must call onError(event_invalid) and close the stream.
    // Non-recoverable → session enters failed.
    await waitForState(session, "failed", 3000);
    expect(session.getDiagnostics().lastError?.code).toBe("subscribe_failed");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
    await session.disconnect();
  });

  // ─── Hard scenario 18: Capabilities 404 → fallback ───
  it("capabilities 404 uses fallbackCapabilities", async () => {
    server.capabilitiesErrorStatus = 404;
    const fallback = {
      supportedEvents: [], supportedCommands: [],
      features: { snapshot: true, sse: true, websocket: false, commandExecution: false, softMapping: false, hardOrchestration: false },
    };
    const adapter = makeAdapter({ fallbackCapabilities: fallback });
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");
    await session.disconnect();
  });

  // ─── Hard scenario 19: Capabilities 401 → NO fallback (surfaces error) ───
  it("capabilities 401 does NOT use fallback (surfaces error)", async () => {
    server.capabilitiesErrorStatus = 401;
    const fallback = {
      supportedEvents: [], supportedCommands: [],
      features: { snapshot: true, sse: true, websocket: false, commandExecution: false, softMapping: false, hardOrchestration: false },
    };
    const adapter = makeAdapter({ fallbackCapabilities: fallback });
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    // Must NOT reach connected — auth error surfaces
    await waitForState(session, "failed", 3000);
    expect(session.getDiagnostics().lastError?.code).toBe("connect_failed");
    await session.disconnect();
  });

  // ─── Hard scenario 20: disconnect during snapshot fetch ───
  it("disconnect during snapshot fetch aborts cleanly", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    server.snapshotDelayMs = 500;
    const adapter = makeAdapter();
    const { session } = makeSession(adapter);

    const connectP = session.connect();
    await new Promise((r) => setTimeout(r, 50)); // let snapshot fetch start
    await session.disconnect();
    await connectP.catch(() => {}); // connect may reject due to abort
    expect(session.getState()).toBe("disconnected");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  // ─── Hard scenario 21: disconnect during command POST ───
  it("disconnect during command POST aborts cleanly", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    server.commandDelayMs = 500;
    const adapter = makeAdapter();
    const { session, gateway } = makeSession(adapter);
    await session.connect();
    await waitForState(session, "connected");

    const execP = gateway.execute(makeCommand("cmd-x"));
    await new Promise((r) => setTimeout(r, 50)); // let POST start
    await session.disconnect();
    const result = await execP;
    expect(result.status).toBe("error");
    expect(session.getState()).toBe("disconnected");
  });

  // ─── Hard scenario 22: disconnect during stream opening ───
  it("disconnect during stream opening aborts cleanly", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    server.streamOpenDelayMs = 500;
    const adapter = makeAdapter();
    const { session } = makeSession(adapter);

    const connectP = session.connect();
    await new Promise((r) => setTimeout(r, 100)); // let stream open start
    await session.disconnect();
    await connectP.catch(() => {});
    expect(session.getState()).toBe("disconnected");
    expect(session.getDiagnostics().hasActiveSubscription).toBe(false);
  });

  // ─── Hard scenario 23: disconnect during reconnect backoff ───
  it("disconnect during reconnect backoff cancels timer", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const slowPolicy: ReconnectPolicy = { initialDelayMs: 2000, maxDelayMs: 5000, maxAttempts: 5, jitterRatio: 0 };
    const { session } = makeSession(adapter, slowPolicy);
    await session.connect();
    await waitForState(session, "connected");

    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: gate on `degraded` to PROVE the backoff timer
    // was actually scheduled before disconnecting and asserting cancellation.
    // The previous 50ms fixed sleep was non-deterministic.
    await waitForState(session, "degraded", 1000);
    // disconnect during backoff
    await session.disconnect();
    expect(session.getState()).toBe("disconnected");
    // Wait past backoff — no reconnect attempt
    await new Promise((r) => setTimeout(r, 100));
    expect(session.getState()).toBe("disconnected");
  });

  // ─── Hard scenario 24: reconnectCount is cumulative (never resets) ───
  it("reconnectCount is cumulative across multiple successful reconnects", async () => {
    server.setSnapshot(makeSnapshot(0));
    server.setEvents([]);
    const adapter = makeAdapter();
    const { session } = makeSession(adapter, FAST_POLICY);
    await session.connect();
    await waitForState(session, "connected");

    // First drop
    await server.disconnectAllLiveClients();
    // Plan Review Fix 14, v3: gate on `degraded` before `connected` for both
    // drops — without this, `waitForState("connected")` could return immediately
    // off the pre-drop `connected` state, making the count assertion a no-op.
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    const countAfterFirst = session.getDiagnostics().reconnectCount;
    expect(countAfterFirst).toBeGreaterThanOrEqual(1);

    // Second drop — count must increment, NOT reset
    await server.disconnectAllLiveClients();
    await waitForState(session, "degraded", 1000);
    await waitForState(session, "connected", 3000);
    const countAfterSecond = session.getDiagnostics().reconnectCount;
    expect(countAfterSecond).toBeGreaterThan(countAfterFirst);
    await session.disconnect();
  });
});

// Hard scenario (mock adapter regression): covered by full-suite gate (npm test) — no new test here.
```

- [ ] **Step 3: Run integration tests to verify they pass**

Run: `npx vitest run packages/adapters/http-sse/src/integration.test.ts`
Expected: PASS — all 24 integration tests green.

- [ ] **Step 4: Run full suite + build gate**

Run: `npm test`
Expected: PASS — all previous tests + new integration tests. Mock adapter tests still green.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/http-sse/src/fake-server.ts packages/adapters/http-sse/src/integration.test.ts
git commit -m "test(http-sse): fake server integration tests with replay-complete + real API (#6 Plan 2 Task 8)"
```

**Compatibility:** Test-only additions. No production code changes — no `waitForState`/`getStore`/`getGateway` added to `RuntimeSession`. All assertions use the real public API (`onStateChange`, `getState`, `getDiagnostics`, `onAcceptedEvent`). All failures injected via `FakeServer`.

**Rollback:** `git revert <commit>` — removes `fake-server.ts` and `integration.test.ts`.

---

### Task 9: Documentation, ADRs, and Plan 1 Leftover Cleanup

**Goal:** Document the HTTP/SSE wire protocol, record two architecture decision records (stream-lifecycle ownership + validation strategy), fix Plan 1's unawaited test assertion, align MockRuntimeAdapter's close-during-replay semantics, and process the `DomainEventHandler` / `Unsubscribe` orphaned type aliases.

**Files:**
- Modify: `docs/protocol/runtime-contract.md` (new Section 4.3 "HTTP/SSE Wire Protocol")
- Create: `docs/adr/0003-stream-lifecycle-ownership.md`
- Create: `docs/adr/0004-http-sse-validation-strategy.md`
- Modify: `packages/core/src/subscription-lifecycle.test.ts` (fix unawaited `expect().resolves` at line 98)
- Modify: `packages/adapters/mock/src/mock-adapter.ts` (align mid-replay `throw` → `return` on 2nd/3rd closed checks)
- Modify: `packages/protocol/src/index.ts` (mark `DomainEventHandler` / `Unsubscribe` as `@deprecated` in JSDoc)

**Interfaces:**
- No code interfaces changed. Documentation-only for the contract + ADRs. Cleanup-only for the test/adapter/protocol files.

- [ ] **Step 1: Write the failing test (or verify existing failure)**

For the unawaited assertion fix in `packages/core/src/subscription-lifecycle.test.ts` line 98, the line currently reads roughly:

```ts
expect(session.getDiagnostics().state).resolves.toBe("connected"); // WRONG: .resolves on a sync value
```

Replace with:

```ts
expect(session.getDiagnostics().state).toBe("connected");
```

(Read the actual line first; if it's `expect(promise).resolves.toBe(...)`, leave it — that's correct. The fix targets only the case where `.resolves` is applied to a non-Promise.)

Verify the fix doesn't change test outcomes:

Run: `npx vitest run packages/core/src/subscription-lifecycle.test.ts`
Expected: PASS — same 12 tests, no behavior change, but no floating unawaited promise warning.

- [ ] **Step 2: Add Section 4.3 to runtime-contract.md**

Append to `docs/protocol/runtime-contract.md` (after Section 4.2 / wherever Plan 1's 4.1.1 ends):

```markdown
## 4.3 HTTP/SSE Wire Protocol (Plan 2)

This section normatively describes the HTTP/SSE transport implemented by
`@agent-office/adapter-http-sse`. It is a profile of the generic
RuntimeAdapter contract in §4.

### 4.3.1 Endpoints

| Method | Path                       | Purpose                                    |
|--------|----------------------------|--------------------------------------------|
| GET    | `/runtime/snapshot`        | Fetch current `RuntimeSnapshot`            |
| GET    | `/runtime/capabilities`    | Fetch `AdapterCapabilities`                |
| GET    | `/runtime/events`          | Open SSE stream (query `afterSequence`)    |
| POST   | `/runtime/commands`        | Submit `OfficeCommand`, returns `CommandResult` |

Endpoint paths are configurable via `HttpSseAdapterOptions.endpoints`.
Defaults are the paths above.

### 4.3.2 Snapshot Response

- HTTP 200 with `Content-Type: application/json`
- Body: a single `RuntimeSnapshot` object
- Client validates via `validateSnapshot(raw, expectedRuntimeId)` before
  installing into Core. Invalid snapshot → `snapshot_failed` session error.

### 4.3.3 Capabilities Response

- HTTP 200 with `Content-Type: application/json`
- Body: a single `AdapterCapabilities` object
- Client validates via `validateCapabilities(raw)`.

### 4.3.4 SSE Event Stream

- HTTP 200 with `Content-Type: text/event-stream`
- Query parameter: `afterSequence=<non-negative integer>`
- Each `DomainEvent` is delivered as one SSE frame:
  ```
  event: domain-event
  id: <event.sequence>
  data: <JSON-encoded DomainEvent>
  ```
- Server MAY send heartbeats as SSE comments (`: keep-alive`).
- Server MAY send a named `event: reset-required` frame with empty data
  to signal `reset_required` to the client.
- **Replay Completion (Architecture Decision H):** after replaying all
  events with `sequence > afterSequence`, the server MUST send a
  `replay-complete` control frame:
  ```
  event: replay-complete
  id: <lastReplayedSequence>
  data: {"lastSequence": <lastReplayedSequence>}
  ```
  - `id:` and `data.lastSequence` MUST be equal. Mismatch → `stream_protocol_error`.
  - If no events were replayed, `lastSequence === afterSequence`.
  - The server MUST send this frame even if the replay set is empty.
  - The client uses this frame to resolve `subscription.ready` and
    transition from REPLAY to LIVE mode — **`reader.done` is NOT used
    as a replay boundary** (SSE is long-lived; `reader.done` only fires
    on server close or abort).
  - If the server closes the stream before sending `replay-complete`,
    `ready` rejects with `stream_protocol_error`.
- Replay (events with `sequence > afterSequence`) MUST be contiguous
  starting at `afterSequence + 1`. A gap rejects `subscription.ready`
  with `RuntimeErrorCode.replay_gap`.
- SSE `id:` field MUST equal `event.sequence`. Mismatch rejects `ready`
  with `RuntimeErrorCode.stream_protocol_error`.
- **Invalid DomainEvent handling:** during replay, an invalid event
  rejects `ready` with `event_invalid`. During live, an invalid event
  triggers `onError({ code: "event_invalid", recoverable: false })` and
  closes the stream — invalid events are NEVER silently dropped.

### 4.3.5 Command POST

- HTTP POST with `Content-Type: application/json`
- Required header: `Idempotency-Key: <commandId>`
- Body: a single `OfficeCommand` object
- Response: 2xx with `CommandResult` JSON, OR 4xx/5xx (mapped to
  `CommandResult { status: "error", error: { code, message } }`)
- Client does NOT auto-retry POST. **Manual retry MUST generate a new
  `commandId`** — `CommandGateway` caches completed results by
  `commandId`, so reusing the same ID returns the cached result without
  calling the adapter. The original `commandId` is only for querying
  the original operation's result.

### 4.3.6 Authentication

- Client sends auth via headers, configured through
  `HttpSseAdapterOptions.headers` (static object or async provider) and
  `HttpSseAdapterOptions.credentials` (forwarded to `fetch`).
- Tokens MUST NOT appear in URLs, query parameters, error messages,
  diagnostics, or logs.
- `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization` are
  redacted to `<redacted>` in any diagnostic structure.
- Async header providers are re-invoked on every reconnect and every
  command POST.

### 4.3.7 Stream Lifecycle Ownership

- Adapter performs ONE stream attempt per `subscribe()` call. The same
  read loop handles both replay and live frames (single fetch, single
  reader, single loop — see Architecture Decision H).
- Adapter does NOT auto-reconnect.
- `RuntimeSession` is the sole retry/resync owner.
- On `onError(recoverable=true)`: session enters `degraded` and
  schedules a single-flight reconnect with bounded exponential backoff.
  Single-flight is enforced via BOTH `reconnectTimer` AND
  `reconnectPromise` (Architecture Decision J).
- On `onState("reset_required")`: session triggers immediate
  `resynchronizeOrThrow()` (no backoff).
- On `onError(recoverable=false)`: session FIRST closes the current
  subscription (`await removeSubscription()`), THEN sets `lastError`,
  THEN enters `failed`. No stale stream remains in a `failed` session.
- Reconnect policy: `{ initialDelayMs, maxDelayMs, maxAttempts, jitterRatio }`.
  Delay = `min(maxDelayMs, initialDelayMs * 2^attempt) * (1 ± jitterRatio)`.
  On `maxAttempts` exceeded: session enters `failed`.
- `reconnectCount` in diagnostics is **cumulative** — never resets on
  success. `reconnectAttempts` (private, for backoff) resets to 0.
```

- [ ] **Step 3: Create ADR 0003 — Stream-Lifecycle Ownership**

Create `docs/adr/0003-stream-lifecycle-ownership.md`:

```markdown
# ADR 0003: Stream-Lifecycle Ownership

## Status
Accepted (2026-07-04)

## Context
Plan 1 introduced the async subscription lifecycle where `subscribe()`
returns immediately with a `RuntimeSubscription` whose `ready` Promise
resolves after replay. Plan 2 adds a real network transport (HTTP/SSE).
A naive adapter might try to hide network flakiness by auto-reconnecting
internally, but this competes with `RuntimeSession`'s resync/retry logic
and produces double streams, leaked readers, and unobservable state.

## Decision
- **Adapter performs exactly one stream attempt per `subscribe()` call.**
  The same read loop handles both replay and live frames — one fetch,
  one reader, one loop (Architecture Decision H).
- **Adapter reports errors via `observer.onError(RuntimeStreamError)` and
  state changes via `observer.onState(RuntimeStreamState)`.**
- **`RuntimeSession` is the sole owner of retry and resync.**
- Reconnect is single-flight via BOTH `reconnectTimer` AND
  `reconnectPromise` (Architecture Decision J) with bounded exponential
  backoff and a max-attempts ceiling. `reconnectCount` in diagnostics is
  cumulative — never resets on success.
- Non-recoverable errors close the subscription BEFORE entering `failed`
  (no stale stream in a failed session).
- `reset_required` triggers immediate resync via `resynchronizeOrThrow()`
  (no backoff). Private `resynchronizeOrThrow()` re-throws on failure;
  public `resynchronize()` swallows errors (Plan 1 API compat).
- `disconnect()` aborts all in-flight operations via unified
  `lifecycleAbort` (Architecture Decision I), clears the reconnect timer,
  and awaits `reconnectPromise` before final state transition.

## Consequences
- Adapter stays simple and stateless across attempts.
- All retry policy lives in one place (`RuntimeSession`) — testable,
  observable via `SessionDiagnostics.reconnectCount`.
- A misbehaving adapter cannot cause duplicate streams.
- Reconnect policy is configurable via `RuntimeSessionOptions.reconnectPolicy`.
- `disconnect()` is race-safe: no post-disconnect state mutations from
  in-flight fetches, readers, or reconnect attempts.

## Alternatives Considered
1. **Adapter auto-reconnects:** Rejected — competing retry loops,
   unobservable to session, double-stream risk.
2. **Session retries with no backoff ceiling:** Rejected — server hammering
   on outage.
3. **`reconnecting` stream state:** Rejected (Plan 1 invariant) — session
   already has `degraded`/`resynchronizing` states; adding a stream-level
   state duplicates semantics.
```

- [ ] **Step 4: Create ADR 0004 — HTTP/SSE Validation Strategy**

Create `docs/adr/0004-http-sse-validation-strategy.md`:

```markdown
# ADR 0004: HTTP/SSE Validation Strategy

## Status
Accepted (2026-07-04)

## Context
Plan 2 introduces untrusted network data at the runtime boundary
(HTTP responses + SSE frames). Invalid data must not enter Core
(reducer, store, gateway). The repo has zero third-party validation
dependencies today and the user's hard constraint is "no new deps".

## Decision
- **Repository-owned validators** in
  `packages/adapters/http-sse/src/validators.ts` (zero deps).
- Four validators: `validateSnapshot`, `validateEvent`,
  `validateCapabilities`, `validateCommandResult`.
- Each returns `Ok<T> | ValidationError` (discriminated union).
- **Snapshot validation is DEEP structural** (revised per Plan Review):
  every entity (`AgentSnapshot`, `TaskSnapshot`, `ArtifactSnapshot`,
  `ApprovalSnapshot`, `RoomSnapshot`) is structurally validated at the
  boundary — including all enums, nested objects (`CapabilityGrant`,
  `ArtifactReviewResult`, `RoomBounds`), numeric fields, and entity-level
  `runtimeId`. This is NOT deferred to the reducer — `SnapshotStore.setSnapshot()`
  installs the full snapshot directly, so malformed entities would enter
  Core unchecked without boundary validation.
- Event validation enforces: `runtimeId` match, positive-integer
  `sequence`, string `eventId`/`type`/`schemaVersion`, `payload` is object.
- SSE `id:` field must equal `event.sequence` — enforced in the stream
  client, not the validator (it's a transport-level invariant).
- Invalid data at the boundary → typed `RuntimeStreamError`, never enters
  Core. Invalid events during replay reject `ready` with `event_invalid`;
  during live they trigger `onError(event_invalid)` and close the stream —
  never silently dropped.
- Capabilities fallback is restricted to HTTP 404 and 501 only — auth,
  server, network, and validation errors MUST surface.

## Consequences
- No bundle-size impact, no supply-chain risk.
- Validators are unit-tested in isolation.
- Adding a new field requires a one-line validator update (no schema file).
- Trade-off: less declarative than zod/ajv, but the surface is small
  (4 types) and the cost is paid once.

## Alternatives Considered
1. **zod / ajv / valibot:** Rejected — adds a dependency the user
   explicitly forbade; bundle-size and supply-chain cost not justified
   for 4 simple validators.
2. **Validate in Core:** Rejected — Core is transport-agnostic and
   already trusts its inputs; pushing network validation into Core
   couples it to HTTP.
3. **No validation, trust the server:** Rejected — a single malformed
   event could corrupt the store or crash the reducer.
```

- [ ] **Step 5: Align MockRuntimeAdapter close-during-replay**

In `packages/adapters/mock/src/mock-adapter.ts`, locate the mid-replay
closed checks. The first check (before any replay) correctly throws
`aborted`. Subsequent checks mid-replay (after some events delivered)
currently `throw` — align them to `return` to match
`TestRuntimeAdapter`'s pattern (Plan 1 Task 3 fix):

Find (roughly):
```ts
if (this.closed) {
  throw new Error("aborted");
}
```
…appearing inside the replay loop, and change subsequent occurrences
(after the first) to:
```ts
if (this.closed) {
  return;
}
```

This prevents partial-replay throws from surfacing as `subscribe_failed`
when the close was intentional. The first check (synchronous, before
any replay) keeps throwing `aborted` so `ready` rejects with
`close_before_ready`.

Verify with the existing mock-adapter tests — all should still pass:

Run: `npx vitest run packages/adapters/mock/src/mock-adapter.test.ts`
Expected: PASS.

- [ ] **Step 6: Mark `DomainEventHandler` / `Unsubscribe` as deprecated**

In `packages/protocol/src/index.ts`, locate the two orphaned type
aliases (Plan 1 leftover):

```ts
export type DomainEventHandler = (event: DomainEvent) => void;
export type Unsubscribe = () => void;
```

Add `@deprecated` JSDoc to both — do NOT remove them (backwards-compat
for any external consumer; removal is a separate decision):

```ts
/**
 * @deprecated Plan 1 introduced `RuntimeStreamObserver` and
 * `RuntimeSubscription` as the canonical event-delivery API.
 * `DomainEventHandler` is retained only for backwards compatibility
 * and should not be used in new code.
 */
export type DomainEventHandler = (event: DomainEvent) => void;

/**
 * @deprecated Use `RuntimeSubscription.close()` instead.
 * `Unsubscribe` is retained only for backwards compatibility.
 */
export type Unsubscribe = () => void;
```

- [ ] **Step 7: Run full suite + build gate**

Run: `npm test`
Expected: PASS — 118 (Plan 1) + new Plan 2 tests all green. The
subscription-lifecycle test fix should not change the count.

Run: `npm run build`
Expected: PASS. The `@deprecated` JSDoc tags do not affect compilation.

- [ ] **Step 8: Commit**

```bash
git add docs/protocol/runtime-contract.md docs/adr/0003-stream-lifecycle-ownership.md docs/adr/0004-http-sse-validation-strategy.md packages/core/src/subscription-lifecycle.test.ts packages/adapters/mock/src/mock-adapter.ts packages/protocol/src/index.ts
git commit -m "docs+chore(http-sse): wire protocol, ADRs 0003/0004, Plan 1 cleanup (#6 Plan 2 Task 9)"
```

**Compatibility:**
- Documentation-only additions (contract, ADRs) — no code impact.
- Test fix (unawaited assertion) — no behavior change.
- Mock adapter mid-replay `throw`→`return` — aligns with TestRuntimeAdapter; existing tests verify no regression.
- `@deprecated` JSDoc — compile-time no-op, IDE surfacing only.

**Rollback:** `git revert <commit>` — restores all six files to pre-Task-9 state.

---

## Self-Review

This section is a pre-execution sanity check against the spec (Issue #6)
and the user's hard constraints. The implementer (or subagent controller)
MUST re-verify each item before declaring the plan done.

### Spec Coverage

| Issue #6 requirement | Covered by |
|---|---|
| HTTP Snapshot fetch + validation | Task 3 (`snapshot-client.ts`) + Task 1 (`validateSnapshot` deep structural) |
| Capabilities fetch + validation + cache + fallback (404/501 only) | Task 3 (`capabilities-client.ts`) + Task 1 (`validateCapabilities`) + Global Constraint |
| Fetch + ReadableStream SSE client (single Read Loop) | Task 5 (`adapter.ts` — one fetch, one reader, one loop per Architecture Decision H) |
| Standalone SSE parser | Task 2 (`sse-parser.ts`) |
| Replay sequence continuity + `replay-complete` control frame | Task 5 (Architecture Decision H — `reader.done` is NOT a replay boundary) |
| `subscription.ready` remote transport semantics | Task 5 (Architecture Decision C + H) |
| REST Command request | Task 4 (`command-client.ts`) |
| `Idempotency-Key: commandId` + manual retry needs new commandId | Task 4 + Global Constraint + Task 8 test #15 |
| CommandResult validation | Task 1 (`validateCommandResult`) + Task 4 |
| Static / async Auth Header Provider | Task 7 (`auth.ts`) + Architecture Decision G |
| Token / secret sanitization | Task 7 (`sanitizeHeadersForLog`, `sanitizeErrorMessage`) + Global Constraint |
| `credentials?: RequestCredentials` on GET/POST/stream options (Cookie Auth) | Task 7 + Plan Review Fix 7, v3 (`HttpGetOptions` / `OpenStreamOptions` / `postCommand` all accept `credentials`) |
| `connect()` only fetches Capabilities (NOT Snapshot) | Task 5 (`adapter.ts` — no `cachedSnapshot` field; `getSnapshot()` performs fresh fetch) + Plan Review Fix 12, v3 (Task 7 auth test calls `getSnapshot()` directly) |
| Adapter is one-time (no `connect()` after `disconnect()`) | Task 5 (`lifecycleAbort.signal.aborted` guard at top of `connect()`) + Architecture Decision I + Plan Review Fix 16, v3 |
| Unified AbortController lifecycle (snapshot/caps/command/stream/reconnect) | Task 5 (`lifecycleAbort` + `streamAbort`) + Architecture Decision I |
| Stream / Reader / Timer / Promise cleanup | Task 6 (`disconnect()` clears `reconnectTimer` + awaits `reconnectPromise`) + Task 5 (`close()` aborts reader) |
| RuntimeSession `onError` + `reset_required` | Task 6 (`handleStreamError`, `handleStreamState`, `resynchronizeOrThrow`) |
| Bounded backoff recoverable interruption (single-flight via timer + promise) | Task 6 (`scheduleReconnect` checks BOTH `reconnectTimer` AND `reconnectPromise`) |
| Non-recoverable error closes subscription BEFORE `failed` | Task 6 (`handleNonRecoverableError`) + Architecture Decision J |
| `event_log_trimmed` → re-fetch checkpoint | Task 5 (maps to `reset_required` → Task 6 resync) |
| `getSnapshot()` fresh fetch on every call (no permanent cache) | Task 5 (no `cachedSnapshot` field) + Task 8 test #16 |
| Deep Snapshot validation (all entities, enums, nested objects, runtimeId) | Task 1 (Architecture Decision A) — NOT deferred to reducer |
| Invalid DomainEvent never silently dropped | Task 5 (replay: reject ready; live: onError + close stream) + Task 8 test #17 |
| Reconnect outcome: `resynchronizeOrThrow()` re-throws | Task 6 (Architecture Decision J) |
| `reconnectCount` cumulative (never resets) | Task 6 + Task 8 test #24 |
| Root tsconfig project references for new package | Task 1 Step 1b |
| Node 20 alignment (not 22) | Tech Stack + Global Constraints |
| MockRuntimeAdapter / TestRuntimeAdapter close-during-replay alignment | Task 9 (mock `throw`→`return`) |
| Plan 1 leftover unawaited test assertion | Task 9 (subscription-lifecycle.test.ts line 98) |
| `DomainEventHandler` / `Unsubscribe` type aliases | Task 9 (`@deprecated` JSDoc) |

### Hard Test Scenarios Coverage

| Hard scenario | Integration test in Task 8 |
|---|---|
| Snapshot↔Stream Event 不丢失 | "replays events between snapshot and subscribe exactly once" |
| Replay Event 恰好交付一次 | (same test — `expect(received).toEqual([1, 2, 3])`) |
| Replay gap 不被 connected 覆盖 | "replay gap rejects ready: state=failed, lastError.code=subscribe_failed" |
| Runtime mismatch 不进入 Core | "runtime mismatch in stream rejects ready and prevents events entering Core" |
| ready 失败后无活跃 Stream | "ready failure leaves no active stream (reader aborted)" |
| replay-complete 缺失 → stream_protocol_error | "server omitting replay-complete rejects ready with stream_protocol_error" (Fix 13, v3: FakeServer now `res.end()`s after omission so reader sees `done=true` and the existing REPLAY-phase `done` handler rejects `ready`) |
| Post-ready 网络断开单飞恢复 | "post-ready network drop triggers reconnect and returns to connected" (Fix 14, v3: test now gates on `degraded` BEFORE waiting for `connected` to avoid false positive from pre-drop state) |
| 多次错误不产生多个 Retry Timer | "multiple rapid drops produce only one reconnect (single-flight via reconnectPromise)" (Fix 14, v3: same `degraded`-first gate) |
| disconnect 取消 Fetch/Reader/Timer | "disconnect during live read cancels reader and clears reconnect timer" (Fix 14, v3: gates on `degraded` to PROVE the timer was scheduled before disconnect asserts cancellation) |
| Reset Required 拉取新 Checkpoint | "reset_required triggers immediate resync pulling fresh checkpoint" (Issue 5, v3: `event_log_trimmed` is routed away from the backoff path; `triggerResetRecovery()` shares `reconnectPromise` with `doReconnect()` so the two recovery chains cannot race) |
| Resync 后只存在一条活跃 Stream | "after resync only one active stream exists" |
| Auth Header 在重连时刷新 | "auth header is refreshed on every reconnect" |
| Authorization 不出现在日志 | "Authorization header never appears in session diagnostics" + "auth header does not appear in snapshot fetch error message" + "auth header does not appear in capabilities fetch error message" (Fix 12, v3: snapshot test calls `getSnapshot()` directly; new companion test covers `connect()` capabilities path) |
| POST Command 不自动重试 | "POST command is never auto-retried by adapter" |
| 手动重试需新 commandId | "manual retry with same commandId returns cached result (no new POST)" |
| getSnapshot() 无缓存 | "getSnapshot() fetches fresh checkpoint on every call (no cache)" |
| LIVE 无效事件不静默丢弃 | "LIVE invalid event is reported (not silently dropped) and closes stream" |
| Capabilities 404 → fallback | "capabilities 404 uses fallbackCapabilities" |
| Capabilities 401 → 不 fallback | "capabilities 401 does NOT use fallback (surfaces error)" |
| disconnect during snapshot fetch | "disconnect during snapshot fetch aborts cleanly" |
| disconnect during command POST | "disconnect during command POST aborts cleanly" |
| disconnect during stream opening | "disconnect during stream opening aborts cleanly" |
| disconnect during reconnect backoff | "disconnect during reconnect backoff cancels timer" |
| reconnectCount 累计不重置 | "reconnectCount is cumulative across multiple successful reconnects" |
| Mock Adapter 全部旧测试保持通过 | (covered by full-suite gate in every task) |

### Placeholder Scan

- No `TODO`, `FIXME`, `XXX`, or `…` placeholders in the task specs above.
- All code snippets are complete enough to implement against; the implementer
  may adjust naming and internal helpers, but the public interfaces are
  locked by the File Structure section.

### Type Consistency

- `RuntimeStreamError`, `RuntimeStreamState`, `RuntimeErrorCode`,
  `RuntimeStreamObserver`, `RuntimeSubscription` come from
  `@agent-office/protocol` (Plan 1).
- `ReconnectPolicy` + `defaultReconnectPolicy` are added to protocol in
  Task 1 and re-exported from core in Task 6.
- `SessionDiagnostics` gains `reconnectCount: number` (Task 6).
- `SessionErrorCode` gains `"reconnect_failed"` (Task 6). **Plan Review Issue 6, v3:** `reconnect_failed` is a `SessionErrorCode` ONLY — it is NOT a member of `RuntimeErrorCode` and MUST NOT appear as `RuntimeStreamError.code`. `handleTerminalReconnectFailure()` records it via `makeSessionError("reconnect_failed", ...)` without constructing a `RuntimeStreamError`. `handleNonRecoverableError()` is reserved for adapter-reported non-recoverable stream errors and does NOT overwrite the terminal-failure diagnostic.
- `RuntimeSessionOptions` gains optional `reconnectPolicy` (Task 6).
- All additions are additive — no existing field is removed or renamed.

### Plan Review v3 Round 2 — Issue/Fix Index

This index maps each user-reported v3 Round 2 issue/fix to the file location
where it was addressed. The implementer MUST re-verify each item during
execution.

| # | Issue / Fix | Where addressed |
|---|---|---|
| 1 | `validateSnapshot()` was shallow (array-check + cast) | Task 1 `validators.ts` — full per-entity deep structural validation (`validateAgentSnapshot` / `validateTaskSnapshot` / `validateArtifactSnapshot` / `validateApprovalSnapshot` / `validateRoomSnapshot` / `validateCapabilityGrant` + enum sets) |
| 2 | `readyReject()` didn't terminate Stream | Task 5 `adapter.ts` — `terminated` flag + `rejectReadyAndTerminate()` helper; read loop checks `terminated` after `parser.feed(chunk)` and aborts reader |
| 3 | `close-before-ready` left `ready` pending | Task 5 `adapter.ts` — `closeFn` calls `readyReject({ code: "aborted", message: "closed before ready" })` before returning; `readySettled` idempotent guard prevents double-settle |
| 4 | Second reconnect never scheduled (self-blocking single-flight) | Task 6 `session.ts` — inner catch in `doReconnect()` AND `triggerResetRecovery()` clears `reconnectPromise = null` BEFORE calling `scheduleReconnect()` |
| 5 | `reset_required` triggered two recovery chains | Task 6 `session.ts` — `handleStreamError` short-circuits `event_log_trimmed` (no backoff); `triggerResetRecovery()` shares `reconnectPromise` lock with `doReconnect()` and cancels pending `reconnectTimer` |
| 6 | `reconnect_failed` was in wrong type | Task 6 `session.ts` — `reconnect_failed` is `SessionErrorCode` only; `handleTerminalReconnectFailure()` is separate from `handleNonRecoverableError()` and records the diagnostic without overwriting |
| 7 | `HttpGetOptions` / `OpenStreamOptions` missing `credentials` | Task 5 `http-client.ts` + `stream-client.ts` + `command-client.ts` — `credentials?: RequestCredentials` added; `fetch(..., { credentials: opts.credentials ?? "omit" })` |
| 8 | Task 1 commit missing root `tsconfig.json` / `package-lock.json` | Task 1 commit command — `git add ... tsconfig.json package-lock.json` |
| 9 | Command Timeout misclassified as ABORTED | Task 4 `command-client.ts` — `abortReason: "timeout" \| "external" \| null` tracking; timeout → `TIMEOUT`, external signal → `ABORTED` |
| 10 | SSE comment `: heartbeat` left leading space | Task 2 `sse-parser.ts` — `if (comment.startsWith(" ")) comment = comment.slice(1);` |
| 11 | SSE unknown fields triggered fatal parser error | Task 2 `sse-parser.ts` — `default: break;` (silently ignored per spec) |
| 12 | Task 7 auth test assumed `connect()` pulls Snapshot | Task 7 `auth.test.ts` — snapshot test calls `adapter.getSnapshot()` directly; new companion test covers `connect()` capabilities path |
| 13 | `omitReplayComplete` test kept stream open → Session stuck in `synchronizing` | Task 8 `fake-server.ts` — when `omitReplayComplete === true`, server calls `res.end()` after replay events (no `replay-complete` frame); reader sees `done=true` in REPLAY phase → existing `stream_protocol_error` handler rejects `ready` → Session enters `failed` |
| 14 | Stream drop test passed before drop was processed (false positive) | Task 8 `integration.test.ts` — scenarios 7, 8, 9 now `await waitForState(session, "degraded", 1000)` BEFORE waiting for `connected` / disconnecting, proving the drop was detected |
| 15 | FakeServer didn't remove `liveClients` on client disconnect | Task 8 `fake-server.ts` — `res.on("close", () => splice from liveClients)` listener registered when client is added |
| 16 | `lifecycleAbort` one-time vs reconnect ambiguity | Task 5 `adapter.ts` — `if (this.lifecycleAbort.signal.aborted) throw ...` guard at top of `connect()`; Architecture Decision I Lifecycle section clarifies session-owned reconnect does NOT call `adapter.disconnect()` between attempts |

### Non-Goals Verification

- No QClaw/Swarm field mapping — confirmed.
- No OpenClaw/Hermes — confirmed.
- No WebSocket — `stream-client.ts` uses `fetch + ReadableStream` only.
- No real LLM — confirmed.
- No multi-runtime UI — `useOfficeState` untouched.
- No UI refactor — confirmed.
- No pixel art / new rooms / study features — confirmed.
- No production auth UI — auth is provider-injected, no UI built.

### Plan 1 Non-Duplication

Plan 1 delivered the async `RuntimeSubscription` lifecycle, `ready` Promise,
`RuntimeStreamObserver`, `RuntimeStreamError`, `RuntimeErrorCode`,
single-flight `connectPromise`/`resyncPromise`, epoch race safety,
`triggerResync()` for replay gaps, and async `removeSubscription()`. Plan 2:

- **Reuses** all of the above unchanged.
- **Adds** `onError`/`onState` wiring in `installSubscription` (Plan 1
  wired only `onEvent`).
- **Adds** `scheduleReconnect`/`doReconnect`/`handleStreamError`/`handleStreamState`
  methods (new logic, not in Plan 1).
- **Adds** `reconnectTimer`, `reconnectAttempts`, `reconnectPolicy` fields
  (new state).
- **Does NOT** re-implement `subscribe`/`resynchronize`/`removeSubscription`/
  `triggerResync`/`installSubscription` signature — only extends
  `installSubscription` body and `disconnect` body.

No duplication.

---

## Execution Handoff

This plan is ready for execution via either:

1. **superpowers:subagent-driven-development** (recommended) — dispatch one
   fresh implementer subagent per task, with a task reviewer subagent after
   each, and a final whole-branch reviewer. The plan's checkbox structure
   and per-task file lists are designed for this workflow.

2. **superpowers:executing-plans** — execute in a parallel session with
   review checkpoints. Suitable if the human wants to review each task
   before the next begins.

**Pre-flight plan review (subagent-driven-development only):** Before
dispatching Task 1, scan this plan once for conflicts. Known items to
verify at dispatch time:

- Task 8 tests import `SessionState` from `@agent-office/core` — verify
  it is re-exported there (it is defined in `session.ts`). If not,
  add it to core's `index.ts` re-exports as part of Task 6.
- Task 8 tests use `onStateChange()` (NOT `onState()`) — this is the
  real public API on `RuntimeSession` from Plan 1. Do NOT add a
  `waitForState()` method to `RuntimeSession`; the test file has its
  own local helper built on `onStateChange()`.
- Task 8 tests use `new SnapshotStore(RUNTIME_ID)` (constructor takes
  `runtimeId: string`) — verify this matches the current `SnapshotStore`
  constructor signature (it does, per `packages/core/src/store.ts` line 61).
- Task 8 tests keep direct `store` and `gateway` references from the
  `makeSession()` helper — do NOT add `getStore()`/`getGateway()` to
  `RuntimeSession`.
- Task 8's `FakeServer` sends `event: replay-complete` after replay —
  the adapter (Task 5) must handle this frame per Architecture Decision H.
- The `handleStreamState` parameter type in Task 6 has a wrong
  conditional-type expression in the first code block; the corrective
  snippet appears immediately after. Implementer must use the corrected
  `state: RuntimeStreamState` signature.

**Branch strategy:** Create branch `feat/http-sse-adapter-issue-6-plan-2`
from `main` (which has Plan 1 merged). One commit per task (9 commits total).
Open PR against `main` after Task 9 passes its full-suite gate.

---

## Output Summary

- **Plan file path:** `e:\agent\AI STARDEW VALLEY\docs\superpowers\plans\2026-07-04-issue-6-plan-2-http-sse-runtime-adapter.md`

### Key Architecture Decisions Summary

1. **Validation Strategy (A):** Repository-owned zero-dependency validators
   in `packages/adapters/http-sse/src/validators.ts`. Four validators
   (`validateSnapshot`, `validateEvent`, `validateCapabilities`,
   `validateCommandResult`) returning `Ok<T> | ValidationError`. **Deep
   structural validation** for Snapshot (all entities, enums, nested
   objects, runtimeId) — NOT deferred to reducer. Invalid data never
   enters Core. No zod/ajv/valibot.

2. **Stream Ownership (B):** Adapter performs exactly ONE stream attempt
   per `subscribe()`. No auto-reconnect inside the adapter. `RuntimeSession`
   is the sole retry/resync owner.

3. **Ready Contract (C):** `subscription.ready` resolves only after 8
   conditions (HTTP 2xx + content-type, replay parsed, contiguous from
   `afterSequence+1`, runtimeId match, schemaVersion match, SSE id matches
   sequence, all replay events delivered, **`replay-complete` frame received**).
   Rejects on 8 conditions (replay gap, runtime mismatch, malformed event,
   id/sequence mismatch, trimmed, auth failure, protocol failure,
   close-before-ready).

4. **Post-Ready Error Mapping (D):** 7 error scenarios mapped to
   recoverable/non-recoverable, session state, resync/retry, backoff,
   max attempts. Backoff = `min(maxDelayMs, initialDelayMs * 2^attempt) * (1 ± jitterRatio)`.
   Single-flight reconnect via BOTH `reconnectTimer` AND `reconnectPromise`,
   max 10 attempts (default), then `failed`. Non-recoverable errors close
   subscription BEFORE entering `failed`. `reconnectCount` is cumulative.

5. **SSE Parser Contract (E):** Standalone string-based parser
   (`createSseParser(handlers) => { feed, finish }`). Caller handles UTF-8
   via `TextDecoder` with `stream: true`. 15 test cases covering
   fragmentation, CRLF/LF, multi-line data, comments, malformed frames,
   JSON errors, id/sequence mismatch, reset-required, replay-complete.

6. **Command Contract (F):** POST with `Idempotency-Key: <commandId>`,
   30s default timeout, AbortController, HTTP error mapping to
   `CommandResult { status: "error" }`. No automatic retry. **Manual retry
   MUST generate a new `commandId`** (gateway caches by `commandId`).

7. **Authentication (G):** `headers?: Record<string,string> | (() => Promise<...>)`
   + `credentials?: RequestCredentials`. Tokens never in URLs/logs/errors/
   diagnostics. Refreshed on every reconnect and command POST.

8. **Replay Completion Protocol (H) — NEW per Plan Review:** Explicit
   `event: replay-complete` control frame marks the boundary between
   replay and live. Single Read Loop (one fetch, one reader, one loop)
   transitions from REPLAY to READY to LIVE. `reader.done` is NEVER used
   as a replay boundary. If server closes before `replay-complete`, `ready`
   rejects with `stream_protocol_error`.

9. **Abort Ownership (I) — NEW per Plan Review:** Unified `lifecycleAbort`
   (shared, one per adapter) + `streamAbort` (per-subscription) +
   per-call timeout. `disconnect()` aborts `lifecycleAbort` → `streamAbort`
   → clears `reconnectTimer` → awaits `reconnectPromise`. Covers ALL
   in-flight operations: snapshot, capabilities, command, stream open,
   reader, reconnect.

10. **Reconnect State Machine (J) — NEW per Plan Review:** Private
    `resynchronizeOrThrow()` re-throws on failure (for reconnect controller);
    public `resynchronize()` swallows errors (Plan 1 compat). Single-flight
    via BOTH `reconnectTimer` AND `reconnectPromise`. Non-recoverable
    errors close subscription BEFORE `failed`. `reconnectCount` cumulative.

11. **Replay Error Termination (K) — NEW per Plan Review v3 Round 2:**
    `readyReject()` alone does NOT stop the read loop — a later frame in the
    same chunk (e.g. `replay-complete`) could keep the stream alive after
    `ready` was already rejected. The `rejectReadyAndTerminate()` helper
    rejects `ready` AND sets `terminated = true`; the read loop checks
    `terminated` after every `parser.feed(chunk)` and aborts the reader
    immediately. `closeFn` rejects pending `ready` (via the `readySettled`
    idempotent guard) so `await subscription.ready` after `close()` can
    never hang.

12. **Reconnect Lock Hygiene (L) — NEW per Plan Review v3 Round 2:**
    The inner `catch` in `doReconnect()` AND `triggerResetRecovery()` clears
    `reconnectPromise = null` BEFORE calling `scheduleReconnect()` — otherwise
    the single-flight guard (`if (this.reconnectPromise !== null) return`)
    blocks the next retry, capping attempts at 1. `event_log_trimmed` /
    `reset_required` is routed AWAY from the backoff path
    (`handleStreamError` short-circuits it); `triggerResetRecovery()` shares
    the `reconnectPromise` lock with `doReconnect()` and cancels any pending
    `reconnectTimer`, so the two recovery chains cannot race. Terminal
    reconnect failure is recorded via the separate `handleTerminalReconnectFailure()`
    using `SessionErrorCode "reconnect_failed"` (NOT as a `RuntimeStreamError.code`).

13. **One-Time Adapter Contract (M) — NEW per Plan Review v3 Round 2:**
    `lifecycleAbort` is created once in the constructor and aborted once in
    `disconnect()`. `connect()` enforces this at runtime with an
    `if (this.lifecycleAbort.signal.aborted) throw …` guard, so misuse fails
    loudly instead of producing a confusing silent `AbortError`. Session-owned
    reconnect does NOT call `adapter.disconnect()` between attempts — only
    `subscription.close()` + `adapter.subscribe()` — so one adapter instance
    survives across reconnects. A full session `disconnect()` is the only
    path that aborts `lifecycleAbort`.

### Task Count

**9 tasks**, executed sequentially. Each task is independently testable
and committable. Tasks 1–4 are foundation (validators, parser, snapshot,
command). Tasks 5–6 are integration (adapter + session reconnect).
Tasks 7–9 are hardening (auth, integration tests, docs/cleanup).

### New Files

| Path | Purpose |
|---|---|
| `packages/adapters/http-sse/package.json` | Package manifest |
| `packages/adapters/http-sse/tsconfig.json` | TS config |
| `packages/adapters/http-sse/src/index.ts` | Public exports |
| `packages/adapters/http-sse/src/validators.ts` | 4 runtime validators (deep structural) |
| `packages/adapters/http-sse/src/validators.test.ts` | Validator tests |
| `packages/adapters/http-sse/src/sse-parser.ts` | Standalone SSE parser |
| `packages/adapters/http-sse/src/sse-parser.test.ts` | 14+ parser tests |
| `packages/adapters/http-sse/src/http-client.ts` | Shared fetch wrapper + abort |
| `packages/adapters/http-sse/src/snapshot-client.ts` | Snapshot fetch + validate |
| `packages/adapters/http-sse/src/capabilities-client.ts` | Capabilities fetch + validate + cache (404/501 fallback) |
| `packages/adapters/http-sse/src/command-client.ts` | POST command + Idempotency-Key |
| `packages/adapters/http-sse/src/command-client.test.ts` | Command client tests |
| `packages/adapters/http-sse/src/stream-client.ts` | Fetch + ReadableStream SSE client |
| `packages/adapters/http-sse/src/adapter.ts` | `HttpSseRuntimeAdapter` (single Read Loop + replay-complete) |
| `packages/adapters/http-sse/src/auth.ts` | Auth header provider + sanitization |
| `packages/adapters/http-sse/src/auth.test.ts` | Auth + sanitization tests |
| `packages/adapters/http-sse/src/fake-server.ts` | Test-only in-memory HTTP server (with replay-complete + counters + delay controls) |
| `packages/adapters/http-sse/src/integration.test.ts` | 24 hard-scenario integration tests |
| `packages/core/src/session-reconnect.test.ts` | 7 reconnect unit tests |
| `docs/adr/0003-stream-lifecycle-ownership.md` | ADR for stream ownership |
| `docs/adr/0004-http-sse-validation-strategy.md` | ADR for validation strategy |

### Modified Files

| Path | Change |
|---|---|
| `packages/protocol/src/index.ts` | Add `ReconnectPolicy`, `defaultReconnectPolicy`; mark `DomainEventHandler`/`Unsubscribe` `@deprecated` |
| `packages/core/src/session.ts` | Wire `onError`/`onState`; add `scheduleReconnect`/`doReconnect`/`handleStreamError`/`handleStreamState`/`resynchronizeOrThrow`/`handleNonRecoverableError`; extend `disconnect()`; add `reconnectTimer`/`reconnectPromise`/`reconnectAttempts`/`reconnectPolicy` fields |
| `packages/core/src/index.ts` | Re-export `ReconnectPolicy`, `defaultReconnectPolicy`, `SessionState` |
| `packages/core/src/subscription-lifecycle.test.ts` | Fix unawaited `expect().resolves` at line 98 |
| `packages/adapters/mock/src/mock-adapter.ts` | Align mid-replay `throw` → `return` (2nd/3rd closed checks) |
| `docs/protocol/runtime-contract.md` | Add Section 4.3 "HTTP/SSE Wire Protocol" (with `replay-complete` frame) |
| `tsconfig.json` (root) | Add `packages/adapters/http-sse` to project references |

### Protocol Changes

- **Additive only.** Protocol version stays `"1.0"`.
- New types: `ReconnectPolicy`, `defaultReconnectPolicy` constant.
- No existing type removed or renamed.
- `DomainEventHandler` / `Unsubscribe` retained but marked `@deprecated`.
- `SessionDiagnostics` gains `reconnectCount: number` (cumulative).
- `SessionErrorCode` gains `"reconnect_failed"`.
- `RuntimeSessionOptions` gains optional `reconnectPolicy`.
- New SSE control frame: `event: replay-complete` (wire protocol, not a type).

### Risk List

1. **`fetch + ReadableStream` compatibility:** Node 20 and modern browsers
   support this (Fetch, ReadableStream, AbortController, TextDecoder all
   available in Node 20). Mitigation: lock Node 20+ in `package.json`
   `engines` (aligned with CI).
2. **SSE parser edge cases:** UTF-8 chunk boundaries across multi-byte
   sequences are handled by `TextDecoder` with `stream: true`, but a
   malformed UTF-8 sequence could throw. Mitigation: wrap decoder in
   try/catch and emit `stream_protocol_error`.
3. **Reconnect storm:** A flapping server could cause rapid reconnect
   attempts. Mitigation: single-flight via BOTH `reconnectTimer` AND
   `reconnectPromise` + max-attempts ceiling + jitter.
4. **Test flakiness from timers:** Integration tests use real `setTimeout`.
   Mitigation: use `vi.useFakeTimers()` in unit tests (session-reconnect),
   real timers only in integration tests with generous timeouts (3s reconnect,
   5s default).
5. **`onStateChange` listener registration:** `RuntimeSession` from Plan 1
   exposes `onStateChange()` (NOT `onState()`) and `onAcceptedEvent()`.
   Task 8 tests use the real API — no `waitForState` added to RuntimeSession.
6. **Mock adapter mid-replay `throw`→`return` change:** Could mask a real
   bug if a test relied on the throw. Mitigation: existing mock-adapter
   tests are the regression gate; run them in Task 9 before committing.
7. **`waitForState` timeout flakiness:** Integration tests depend on real
   network I/O against an in-process `FakeServer`. Mitigation: timeouts are
   generous (3s for reconnect, 5s default), and the fake server is
   synchronous within Node's event loop. The `waitForState` helper is local
   to the test file (built on `onStateChange`).
8. **AbortController + `AbortSignal.any` in Node 20:** `AbortSignal.any`
   is available in Node 20.3+. Mitigation: verify CI Node version ≥ 20.3;
   if older, use a manual `AbortController` composition helper.
9. **`Idempotency-Key` header casing:** HTTP headers are case-insensitive,
   but tests should assert on the canonical `Idempotency-Key` form.
   Mitigation: `command-client.ts` sets the header with that exact casing.
10. **Concurrent `disconnect()` during reconnect:** The epoch guard in
    `doReconnect` + `reconnectPromise` await in `disconnect()` handle this.
11. **`replay-complete` frame validation:** If the server sends a mismatched
    `id`/`data.lastSequence`, the adapter must reject `ready` with
    `stream_protocol_error`. Mitigation: Task 5 validates this; Task 8 test #6
    covers the omitted-frame case.
12. **Deep validation performance:** Deep structural validation of large
    snapshots could add latency. Mitigation: validate at the boundary once
    per fetch; the cost is O(n) in entity count and negligible for typical
    office snapshots (dozens of entities, not thousands).

### Status Declaration

**This plan has been revised per the Plan Review comment on GitHub Issue #6.
Implementation has NOT started. No production code has been modified. No
HTTP/SSE adapter has been created. The plan file is the only artifact
produced by this revision. The plan is ready for re-review.**

To begin execution (after re-review approval), the human should choose:
- `subagent-driven-development` (recommended) — fresh subagent per task,
  review after each, final whole-branch review.
- `executing-plans` — parallel session with checkpoints.

Then dispatch Task 1.

### Diff Summary (v1 → v2, per Plan Review)

**Deleted:**
- `reader.done` as replay boundary (replaced by `replay-complete` control frame)
- `cachedSnapshot` field in adapter (getSnapshot now fetches fresh every call)
- Shallow snapshot validation (replaced by deep structural validation)
- Public `resynchronize()` as the only resync method (split into `resynchronizeOrThrow` private + `resynchronize` public)
- `reconnectTimer`-only single-flight (replaced by `reconnectTimer` + `reconnectPromise`)
- `reconnectCount` resetting to 0 on success (now cumulative)
- Non-recoverable error entering `failed` without closing subscription (now closes first)
- `disconnect()` aborting only SSE reader (now aborts all via `lifecycleAbort`)
- Capabilities fallback on any error (now restricted to 404/501)
- `session.waitForState("subscribe_failed")` (subscribe_failed is an error code, not a state)
- `(session as unknown as { subscription: ... }).reportError()` / `reportState()` (private field access)
- `session.getStore()` / `getGateway()` accessors (tests keep direct references)
- `new SnapshotStore()` without runtimeId (now `new SnapshotStore(runtimeId)`)
- `session.onState()` (replaced by real `onStateChange()`)
- Node 22 requirement (aligned to Node 20 per CI)
- Manual retry with same commandId (now requires new commandId)
- ADR 0003 "single-flight (one `reconnectTimer` at a time)" (updated to mention `reconnectPromise`)
- ADR 0004 "shallow on arrays" (updated to deep structural validation)

**Added:**
- Architecture Decision H: Replay Completion Protocol (`event: replay-complete` control frame)
- Architecture Decision I: Abort Ownership table (`lifecycleAbort` + `streamAbort` + per-call timeout)
- Architecture Decision J: Reconnect State Machine (`resynchronizeOrThrow`, `reconnectPromise`, close-before-failed, cumulative `reconnectCount`)
- Single Read Loop state machine (OPENING → REPLAY → READY → LIVE → CLOSED)
- `liveErrorQueue` pattern for deferred LIVE-phase error delivery
- `replay-complete` frame validation (id === data.lastSequence === lastDeliveredSeq)
- Deep structural Snapshot validation (all entities, enums, nested objects, runtimeId)
- `getSnapshot()` no-cache policy
- `handleNonRecoverableError` (close subscription BEFORE `failed`)
- `reconnectPromise` for true single-flight
- Root `tsconfig.json` project reference for `packages/adapters/http-sse`
- FakeServer `replay-complete` support, request counters, delay controls, error-injection hooks
- 11 new integration tests (24 total, up from 13): replay-complete omission, manual retry commandId, getSnapshot no-cache, LIVE invalid event, capabilities 404/401 fallback, disconnect-during-snapshot/command/stream-opening/reconnect-backoff, cumulative reconnectCount
- Section 4.3.4 `replay-complete` wire protocol documentation
- Section 4.3.5 manual retry new-commandId requirement
- Section 4.3.7 `reconnectPromise` + close-before-failed + cumulative `reconnectCount`

**Rewritten:**
- Task 5 (adapter): single Read Loop with `phase: "REPLAY" | "LIVE"`, `replay-complete` handling, `lifecycleAbort` + `streamAbort`, `liveErrorQueue`, no `cachedSnapshot`
- Task 6 (session): `resynchronizeOrThrow()`, `reconnectPromise`, `handleNonRecoverableError`, cumulative `reconnectCount`, `disconnect()` awaits `reconnectPromise`
- Task 8 (integration tests): 24 tests using real public API (`onStateChange`, `getState`, `getDiagnostics`, `new SnapshotStore(runtimeId)`), all failures via FakeServer, no private field access, no invented methods
- ADR 0003: updated to mention `reconnectPromise`, close-before-failed, `resynchronizeOrThrow`
- ADR 0004: updated to deep structural validation, invalid event handling, capabilities fallback restriction
- Self-Review Spec Coverage table: expanded with 12 new rows for Plan Review items
- Self-Review Hard Test Scenarios table: expanded from 14 to 24 rows
- Execution Handoff pre-flight notes: updated to reference real API (`onStateChange`, `SnapshotStore(runtimeId)`, no `getStore`/`getGateway`)
- Risk List: expanded from 10 to 12 items, Node 22→20, `reconnectTimer`→`reconnectTimer`+`reconnectPromise`