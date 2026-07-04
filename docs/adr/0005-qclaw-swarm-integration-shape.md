# ADR 0005: QClaw/Swarm Integration Shape — Server Compatibility Bridge

**Status:** Accepted
**Date:** 2026-07-04
**Issue:** #8

## Context

Issue #8 requires choosing exactly one integration shape:
- Option A: Server compatibility bridge (backend exposes generic wire protocol)
- Option B: Client mapping adapter (new `packages/adapters/qclaw-swarm/` mapping package)

The QClaw/Swarm test runtime is under our project control. No real
QClaw/Swarm backend exists to map from.

## Decision

Choose **Option A — Server compatibility bridge**.

The QClaw test runtime directly exposes the generic HTTP/SSE wire
protocol defined in `runtime-contract.md §4.3`. The existing
`@agent-office/adapter-http-sse` connects to it unchanged.

## Rationale

1. The test runtime is our own code — we control its API surface.
2. Option B (mapping adapter) would require inventing a QClaw-native API
   solely to map it back to the generic protocol — pure overhead with
   no evidence value.
3. Option A lets us reuse the fully-tested `HttpSseRuntimeAdapter`
   (252 passing tests) without modification.
4. QClaw-specific execution semantics (auto-dispatch, approval-gated
   completion) are documented in `mapping-table.md` and implemented
   inside the runtime, not in a mapping layer.

## Consequences

- `packages/adapters/qclaw-swarm/` contains a test runtime server,
  not an adapter.
- `HttpSseRuntimeAdapter` remains unchanged.
- No QClaw-specific types leak into Core/protocol/UI.
- Future real QClaw integration (if a real backend appears) may
  require Option B — this ADR applies only to the test runtime.
