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
  let commandResults = loaded?.commandResults ?? new Map<string, LifeSimCommandResult>();
  let currentSnapshot = snapshot;
  let currentTail = eventLogTail;
  let nextLifeSimSequence = Math.max(snapshot.checkpointLifeSimSequence, ...eventLogTail.map((e) => e.lifeSimSequence)) + 1;
  const listeners = new Set<(event: LifeSimEvent) => void>();
  let queueTail: Promise<unknown> = Promise.resolve();

  const notifyListeners = (events: LifeSimEvent[]): void => {
    for (const event of events) {
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
      now(),
      currentTail
    );
    const stagedSnapshot = next;
    const stagedTail = [...currentTail, ...events];
    const stagedCommandResults = new Map(commandResults);
    stagedCommandResults.set(command.commandId, result);
    await store.save(stagedSnapshot, stagedTail, stagedCommandResults);
    currentSnapshot = stagedSnapshot;
    currentTail = stagedTail;
    commandResults = stagedCommandResults;
    notifyListeners(events);
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
      startOfDayMinute: config.startOfDayMinute,
      endOfDayMinute: config.endOfDayMinute,
      snapshot: structuredClone(currentSnapshot),
      eventLogTail: structuredClone(currentTail),
    }),
    getCapabilities: (): LifeSimCapabilities => ({
      world: {
        startDay: currentSnapshot.worldClock.status === "not_started",
        // Phase 1 is manual-only; pause/resume commands are not implemented yet.
        pause: false,
        resume: false,
        endDay:
          (currentSnapshot.worldClock.status === "running" || currentSnapshot.worldClock.status === "paused") &&
          currentSnapshot.worldClock.minuteOfDay === config.endOfDayMinute,
        advanceTime:
          currentSnapshot.worldClock.status === "running" &&
          currentSnapshot.worldClock.speed === 0 &&
          currentSnapshot.worldClock.minuteOfDay < config.endOfDayMinute,
        runToEndOfDay:
          currentSnapshot.worldClock.status === "running" &&
          currentSnapshot.worldClock.minuteOfDay < config.endOfDayMinute,
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
        let stagedSnapshot: LifeSimSnapshot = {
          ...next,
          lastObservedRuntimeSequence: event.sequence,
        };
        if (events.length > 0) {
          stagedSnapshot = {
            ...stagedSnapshot,
            lastAppliedRuntimeSequence: event.sequence,
          };
        }
        const stagedTail = [...currentTail, ...events];
        await store.save(stagedSnapshot, stagedTail, commandResults);
        currentSnapshot = stagedSnapshot;
        currentTail = stagedTail;
        notifyListeners(events);
      });
      queueTail = promise.catch(() => undefined);
      return promise;
    },
    observeRuntimeSequence: (sequence: number) => {
      const promise = queueTail.then(async () => {
        const stagedSnapshot: LifeSimSnapshot = {
          ...currentSnapshot,
          lastObservedRuntimeSequence: Math.max(currentSnapshot.lastObservedRuntimeSequence, sequence),
        };
        await store.save(stagedSnapshot, currentTail, commandResults);
        currentSnapshot = stagedSnapshot;
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
