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
  return { ok: true, value: raw as unknown as RuntimeSnapshot };
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
  return { ok: true, value: raw as unknown as DomainEvent };
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
  return { ok: true, value: raw as unknown as AdapterCapabilities };
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
  return { ok: true, value: raw as unknown as CommandResult };
}
