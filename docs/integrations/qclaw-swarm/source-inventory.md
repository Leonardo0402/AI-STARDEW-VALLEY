# QClaw/Swarm Source Inventory

## Discovery Context

Issue #8 requires evidence-driven discovery of the QClaw/Swarm runtime contract.
A search of the connected GitHub workspace (`Leonardo0402/AI-STARDEW-VALLEY`)
found **no QClaw/Swarm source code, API definitions, or protocol specifications**.

## What Was Found

The local project (`AI-STARDEW-VALLEY` / "Agent Office") contains only
**market research references** to QClaw/Swarm in:

- `docx/AI-像素 Agent Office 深度研究报告.md` — market research mentioning
  QClaw/Swarm alongside OpenClaw, Hermes, Claude Code, Codex as external
  Agent Runtimes. The report notes (line 62) that QClaw/Swarm's public
  control protocol, approval state, tool permissions, and event streams
  are "not as clear as Codex/Claude/OpenClaw" in public materials.
- `docs/product/mvp-scope.md` — lists QClaw/Swarm as a future extension
  point via `QClawAdapter` / `SwarmAdapter` implementing `RuntimeAdapter`.
- `docs/adr/0001-runtime-session-in-core.md` — mentions QClaw/Swarm as
  future adapter implementations.

## What Was NOT Found

- No QClaw/Swarm source repository.
- No QClaw/Swarm API specification or OpenAPI definition.
- No QClaw/Swarm event catalog or command catalog.
- No QClaw/Swarm authentication documentation.
- No QClaw/Swarm test fixtures or recorded payloads.

## Decision

Per project owner direction (session 2026-07-04), a **QClaw/Swarm-style
test runtime** will be constructed in `packages/adapters/qclaw-swarm/`
as the contract discovery target. This runtime will expose the generic
HTTP/SSE wire protocol (§4.3) with QClaw-style execution semantics
documented in `mapping-table.md`.

This is a controlled test runtime, not a reverse-engineered contract.
The evidence is: (1) the generic wire protocol defined in
`runtime-contract.md §4.3`, (2) the `MockRuntimeAdapter` as the
reference in-memory runtime, (3) `FakeServer` as the reference HTTP
wire protocol implementation.
