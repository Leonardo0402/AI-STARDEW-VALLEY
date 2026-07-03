# AI-STARDEW-VALLEY

> A spatial, executable Agent Office for observing, coordinating, and governing real agent runtimes through a pixel-world interface.

## Project status

This repository is in the **product-contract and vertical-slice prototype** stage.

The first milestone is not an open-world game. It is a small, executable Agent Office that proves one real workflow:

```text
User goal
→ Orchestrator creates and assigns work
→ Worker executes
→ Artifact is produced
→ Reviewer reviews
→ Human approves or rejects
→ Task completes or returns for revision
```

## Core principles

- Runtime state is the source of truth.
- Pixel space is a projection and control surface, not a fictional simulation.
- Rooms may participate in tool, permission, context, and workflow policies.
- Runtime state, presentation state, and ambient state must remain separate.
- Artifacts and approvals are first-class objects.
- Every real state change comes from an event; every user control action becomes a command.
- The MVP starts with a mock runtime before adapting real systems.

## Planned MVP stack

- TypeScript
- React
- PixiJS
- HTTP snapshot
- SSE incremental events
- REST command gateway
- Mock runtime adapter

## Repository plan

```text
docs/
  product/
  protocol/
  research/
  decisions/
apps/
packages/
adapters/
```

Development begins only after the first product contract, runtime contract, and MVP scope are reviewed and accepted.
