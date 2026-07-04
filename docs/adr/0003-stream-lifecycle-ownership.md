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
