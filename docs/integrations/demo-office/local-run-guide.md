# demo-office Local Run Guide

## Prerequisites

- Node.js 22
- npm workspace dependencies installed (`npm install` at repo root)

## Option 1: Mock mode (default, no separate runtime)

```bash
npm run dev
```

The app runs at http://localhost:5173 against `MockRuntimeAdapter` (in-memory, deterministic). No separate runtime process needed.

## Option 2: Remote mode (HTTP/SSE + QClaw test runtime)

### Start both processes concurrently (recommended)

```bash
npm run dev:remote-demo
```

This launches:
- QClaw test runtime at http://localhost:3456 (with CORS for http://localhost:5173)
- Vite dev server at http://localhost:5173 (with `VITE_RUNTIME_MODE=http-sse`)

Open http://localhost:5173 — the app connects to the remote runtime via `HttpSseRuntimeAdapter`.

### Start processes separately

Terminal 1 — start the runtime:

```bash
npm run dev:runtime
```

Terminal 2 — start the UI with remote config:

```bash
# Linux/macOS
VITE_RUNTIME_MODE=http-sse VITE_RUNTIME_ID=qclaw-swarm-runtime-001 VITE_RUNTIME_BASE_URL=http://localhost:3456 npm run dev:ui

# Windows PowerShell
$env:VITE_RUNTIME_MODE="http-sse"; $env:VITE_RUNTIME_ID="qclaw-swarm-runtime-001"; $env:VITE_RUNTIME_BASE_URL="http://localhost:3456"; npm run dev:ui
```

## Configuration

See `apps/demo-office/.env.example` for all supported env vars. Create `.env.local` in `apps/demo-office/` to override defaults.

## Health Check

`GET http://localhost:3456/runtime/snapshot` returning 200 indicates the QClaw runtime is healthy.

## Stopping

`Ctrl+C` in the terminal running `dev:remote-demo` stops both processes.
