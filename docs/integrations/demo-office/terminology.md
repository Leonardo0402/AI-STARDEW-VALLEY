# Runtime Terminology

## Mock

`MockRuntimeAdapter` — an in-memory, deterministic adapter that simulates a runtime within the browser process. Used for local development, regression tests, and demos. No network involved. Supports scripted scenarios (`playNormalFlow`, `playErrorFlow`, `playRevisionFlow`, `reset`).

## Reference Swarm

The synthetic QClaw-style test runtime (`@agent-office/qclaw-swarm`), accessed over the generic HTTP/SSE wire protocol via `HttpSseRuntimeAdapter`. It is NOT a real QClaw/Swarm integration — it is a contract discovery target that mimics QClaw execution semantics (auto-dispatch, approval-gated completion) for testing the remote transport path.

## Real QClaw Integration

A future, real QClaw/Swarm backend speaking the same generic wire protocol. NOT implemented in this project. The app layer (`demo-office`) is transport-agnostic and would connect to a real QClaw runtime the same way it connects to the Reference Swarm — by pointing `VITE_RUNTIME_BASE_URL` at the real server.

## Why the distinction matters

The app must never label the Reference Swarm as "real QClaw." The `StatusStrip` and subtitle reflect the actual mode (`Mock` or `Reference Swarm (HTTP/SSE)`), never claiming real integration.
