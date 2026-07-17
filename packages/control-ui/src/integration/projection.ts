import { EventType, type RuntimeAdapter, type RuntimeSnapshot, type DomainEvent } from "@agent-office/protocol";
import type { IntegrationProjection, TimelineIntegrationView } from "./types.js";

export interface IntegrationProjectionProvider {
  getIntegrationProjection(snapshot: RuntimeSnapshot): IntegrationProjection;
}

const TIMELINE_EVENT_TYPES: Set<string> = new Set([
  EventType.TASK_CREATED,
  EventType.ARTIFACT_CREATED,
  EventType.ARTIFACT_DRAFTED,
  EventType.ARTIFACT_REVIEW_REQUESTED,
  EventType.REVIEW_ASSIGNED,
  EventType.REVIEW_SUBMITTED,
  EventType.ARTIFACT_REVIEWED,
  EventType.AUDIT_NOTE_ADDED,
]);

export function emptyIntegrationProjection(): IntegrationProjection {
  return { github: null, reviews: null, timeline: null };
}

export function projectTimelineIntegration(eventLog: DomainEvent[]): TimelineIntegrationView {
  const events = eventLog
    .filter((e) => TIMELINE_EVENT_TYPES.has(e.type))
    .sort((a, b) => a.sequence - b.sequence)
    .map((e) => ({
      eventId: e.eventId,
      type: e.type,
      timestamp: e.occurredAt,
      payload: e.payload as Record<string, unknown>,
    }));
  return { events };
}

export function projectIntegration(
  adapter: RuntimeAdapter,
  snapshot: RuntimeSnapshot,
  eventLog: DomainEvent[] = []
): IntegrationProjection {
  const provider = adapter as RuntimeAdapter & Partial<IntegrationProjectionProvider>;
  if (typeof provider.getIntegrationProjection === "function") {
    const base = provider.getIntegrationProjection(snapshot);
    return {
      ...base,
      timeline: projectTimelineIntegration(eventLog),
    };
  }
  return emptyIntegrationProjection();
}
