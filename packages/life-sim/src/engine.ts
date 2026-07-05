import type { DomainEvent } from "@agent-office/protocol";
import type {
  LifeSimCommand,
  LifeSimCommandResult,
  LifeSimEngine,
  LifeSimEngineConfig,
  LifeSimEvent,
  LifeSimSnapshot,
  LifeSimSnapshotResponse,
  LifeSimStore,
  LifeSimCapabilities,
} from "./types.js";
import { createEmptySnapshot, InMemoryLifeSimStore } from "./store.js";
import { reduceWorldCommand } from "./reducer-world.js";
import { reduceRuntimeEvent } from "./reducer-runtime.js";

export interface LifeSimEngineOptions {
  store?: LifeSimStore;
  now?: () => string;
}

export async function createLifeSimEngine(
  config: LifeSimEngineConfig,
  options: LifeSimEngineOptions = {}
): Promise<LifeSimEngine> {
  const store = options.store ?? new InMemoryLifeSimStore();
  const now = options.now ?? (() => new Date().toISOString());
  const loaded = await store.load();
  const snapshot = loaded?.snapshot ?? {
    ...createEmptySnapshot(config, now()),
    baseSchedules: config.baseSchedules ?? [],
  };
  const eventLogTail = loaded?.eventLogTail ?? [];
  const commandResults = loaded?.commandResults ?? new Map<string, LifeSimCommandResult>();
  let currentSnapshot = snapshot;
  let currentTail = eventLogTail;
  let nextLifeSimSequence = Math.max(snapshot.checkpointLifeSimSequence, ...eventLogTail.map((e) => e.lifeSimSequence)) + 1;
  const listeners = new Set<(event: LifeSimEvent) => void>();
  let queueTail: Promise<unknown> = Promise.resolve();

  const persist = async (): Promise<void> => {
    await store.save(currentSnapshot, currentTail, commandResults);
  };

  const appendEvents = (events: LifeSimEvent[]): void => {
    for (const event of events) {
      currentTail.push(event);
      for (const listener of listeners) {
        listener(event);
      }
    }
  };

  const runCommand = async (command: LifeSimCommand): Promise<LifeSimCommandResult> => {
    const cached = commandResults.get(command.commandId);
    if (cached) return cached;
    const { snapshot: next, events, result } = reduceWorldCommand(
      currentSnapshot,
      command,
      config,
      () => nextLifeSimSequence++,
      now()
    );
    currentSnapshot = next;
    appendEvents(events);
    commandResults.set(command.commandId, result);
    await persist();
    return result;
  };

  const engine: LifeSimEngine = {
    execute: (command) => {
      const promise = queueTail.then(() => runCommand(command));
      queueTail = promise.catch(() => undefined);
      return promise;
    },
    getSnapshot: (): LifeSimSnapshotResponse => ({
      worldId: currentSnapshot.worldId,
      schemaVersion: currentSnapshot.schemaVersion,
      checkpointLifeSimSequence: currentSnapshot.checkpointLifeSimSequence,
      snapshot: currentSnapshot,
      eventLogTail: [...currentTail],
    }),
    getCapabilities: (): LifeSimCapabilities => ({
      world: {
        startDay: currentSnapshot.worldClock.status === "not_started",
        pause: currentSnapshot.worldClock.status === "running",
        resume: currentSnapshot.worldClock.status === "paused",
        endDay:
          (currentSnapshot.worldClock.status === "running" || currentSnapshot.worldClock.status === "paused") &&
          currentSnapshot.worldClock.minuteOfDay === config.endOfDayMinute,
        advanceTime: currentSnapshot.worldClock.status === "running" && currentSnapshot.worldClock.speed === 0,
      },
      schedule: { override: false, clearOverride: false },
      clock: { mode: "manual", maxSpeed: 0 },
    }),
    applyRuntimeEvent: (event: DomainEvent) => {
      const promise = queueTail.then(async () => {
        const bindingMinute = currentSnapshot.worldClock.minuteOfDay;
        const { snapshot: next, events } = reduceRuntimeEvent(
          currentSnapshot,
          event,
          config.endOfDayMinute,
          bindingMinute,
          () => nextLifeSimSequence++,
          now()
        );
        currentSnapshot = {
          ...next,
          lastObservedRuntimeSequence: event.sequence,
        };
        if (events.length > 0) {
          currentSnapshot = {
            ...currentSnapshot,
            lastAppliedRuntimeSequence: event.sequence,
          };
        }
        appendEvents(events);
        await persist();
      });
      queueTail = promise.catch(() => undefined);
      return promise;
    },
    observeRuntimeSequence: (sequence: number) => {
      const promise = queueTail.then(async () => {
        currentSnapshot = {
          ...currentSnapshot,
          lastObservedRuntimeSequence: Math.max(currentSnapshot.lastObservedRuntimeSequence, sequence),
        };
        await persist();
      });
      queueTail = promise.catch(() => undefined);
      return promise;
    },
    onLifeSimEvent: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return engine;
}
