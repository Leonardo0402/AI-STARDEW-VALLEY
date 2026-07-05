# demo-office Troubleshooting

## "Configuration error: VITE_RUNTIME_ID is required"

The `VITE_RUNTIME_ID` env var is missing. Set it in `apps/demo-office/.env.local` or in your shell before starting Vite.

## "Configuration error: VITE_RUNTIME_BASE_URL is required when VITE_RUNTIME_MODE=http-sse"

You set `VITE_RUNTIME_MODE=http-sse` but did not provide `VITE_RUNTIME_BASE_URL`. Set it to the runtime's base URL (e.g., `http://localhost:3456`).

## Browser console shows CORS error / fetch blocked

The QClaw runtime rejects cross-origin requests from origins not in its allow-list. By default, only `http://localhost:5173` (Vite's default origin) is allowed.

If your Vite runs on a different port, start the runtime with `--allowed-origins=http://localhost:YOUR_PORT`:

```bash
npm run dev:runtime -- --allowed-origins=http://localhost:5174
```

## "wrong runtimeId" / runtime mismatch errors

The `VITE_RUNTIME_ID` must match the runtime's actual runtimeId. For the QClaw test runtime, this is `qclaw-swarm-runtime-001`. For Mock, it is `mock-runtime-001`.

## SSE stream connects but no events arrive / "missing replay marker"

1. Verify the runtime is running: `curl http://localhost:3456/runtime/snapshot` should return JSON.
2. Check the runtime console for errors.
3. The SSE stream sends a `replay-complete` control frame after replaying history. If you don't see it, the runtime may have crashed mid-stream — check the runtime process.

## Session stuck in "failed" state

The `HttpSseRuntimeAdapter` is one-time: after `disconnect()`, the same adapter cannot reconnect. If the session fails, refresh the browser page (which constructs a new adapter). The `Reconnect` button in `StatusStrip` calls `session.resynchronize()`, which fetches a fresh snapshot and re-subscribes — this works for transient failures but not for a disconnected adapter.

## DemoControls buttons missing in remote mode

This is intentional. `DemoControls` (playNormalFlow, reset, etc.) are Mock-only. In `http-sse` mode, they are not rendered because the remote runtime does not support Mock-specific scenario scripts.
