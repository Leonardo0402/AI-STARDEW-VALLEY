import type { RuntimeSession } from "@agent-office/core";
import type { EventApplyResult, DomainEvent } from "@agent-office/protocol";
import type { LifeSimEngine } from "./types.js";

export class RuntimeLifeSimBridge {
  private session: RuntimeSession;
  private engine: LifeSimEngine;
  private unsubscribe: (() => void) | null = null;

  constructor(session: RuntimeSession, engine: LifeSimEngine) {
    this.session = session;
    this.engine = engine;
  }

  connect(): void {
    this.unsubscribe = this.session.onAcceptedEvent((event: DomainEvent, result: EventApplyResult) => {
      if (result.code === "applied") {
        void this.engine.applyRuntimeEvent(event);
      } else if (result.code === "reducer_rejected") {
        void this.engine.observeRuntimeSequence(event.sequence);
      }
    });
  }

  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
