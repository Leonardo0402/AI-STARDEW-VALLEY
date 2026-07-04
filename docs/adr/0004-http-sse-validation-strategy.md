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
