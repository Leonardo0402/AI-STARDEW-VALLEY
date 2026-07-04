# QClaw/Swarm Test Runtime — Local Run Guide

## Prerequisites

- Node.js 22 (per CI)
- npm workspace dependencies installed (`npm install` at repo root)

## Starting the Runtime

```typescript
import { QclawTestRuntime } from "@agent-office/qclaw-swarm";

const runtime = new QclawTestRuntime({ port: 3456 });
await runtime.start();
console.log(`QClaw runtime at ${runtime.getBaseUrl()}`);
// Runtime is now serving the generic wire protocol at http://localhost:3456
```

## Connecting via HttpSseRuntimeAdapter

```typescript
import { HttpSseRuntimeAdapter } from "@agent-office/adapter-http-sse";
import { RuntimeSession, SnapshotStore, CommandGateway } from "@agent-office/core";

const adapter = new HttpSseRuntimeAdapter({
  baseUrl: "http://localhost:3456",
  runtimeId: "qclaw-swarm-runtime-001",
});
const store = new SnapshotStore("qclaw-swarm-runtime-001");
const gateway = new CommandGateway(adapter);
const session = new RuntimeSession(adapter, store, gateway);
await session.connect();
const snapshot = store.getSnapshot();
console.log(snapshot.agents); // 4 agents
```

## Running the Golden Workflow

```typescript
import { playGoldenFlow } from "@agent-office/qclaw-swarm";

const result = await playGoldenFlow("http://localhost:3456");
console.log(result.finalSnapshot.tasks[0].status); // "completed"
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /runtime/snapshot | Fetch RuntimeSnapshot |
| GET | /runtime/capabilities | Fetch AdapterCapabilities |
| GET | /runtime/events?afterSequence=N | Open SSE stream |
| POST | /runtime/commands | Submit OfficeCommand |
| POST | /runtime/demo/trigger-artifact-review | Demo: trigger artifact+review+approval |
| GET | /runtime/demo/event-log | Demo: fetch event log |

## Stopping

```typescript
await runtime.stop();
```

## Process Startup Order

1. Start `QclawTestRuntime`
2. Create `HttpSseRuntimeAdapter` pointing to the runtime URL
3. Create `SnapshotStore` and `CommandGateway`
4. Create `RuntimeSession` with `(adapter, store, gateway)`
5. Call `session.connect()`
6. Call `store.getSnapshot()` for initial state

## Health Check

`GET /runtime/snapshot` returning 200 indicates the runtime is healthy.
