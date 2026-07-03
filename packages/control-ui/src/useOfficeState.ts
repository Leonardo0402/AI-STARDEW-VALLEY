/**
 * useOfficeState — React Hook，连接 SnapshotStore 和 CommandGateway。
 *
 * 核心链路：
 * SnapshotStore.subscribe → setState → React 重渲染
 * React UI Action → CommandGateway.execute → Adapter → Event → SnapshotStore
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type {
  OfficeProjection,
  RuntimeSnapshot,
  DomainEvent,
} from "@agent-office/protocol";
import {
  SnapshotStore,
  CommandGateway,
  projectSnapshot,
} from "@agent-office/core";
import type { RuntimeAdapter } from "@agent-office/protocol";

export interface OfficeState {
  projection: OfficeProjection;
  eventLog: DomainEvent[];
  errors: string[];
  sendCommand: (
    commandType: string,
    payload: unknown,
    targetId?: string | null
  ) => Promise<void>;
}

export function useOfficeState(
  adapter: RuntimeAdapter,
  store: SnapshotStore,
  gateway: CommandGateway,
  runtimeId: string
): OfficeState {
  const [projection, setProjection] = useState<OfficeProjection>(() =>
    projectSnapshot(store.getSnapshot())
  );
  const [eventLog, setEventLog] = useState<DomainEvent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const cmdCounter = useRef(0);

  useEffect(() => {
    // 订阅 store 变更
    const unsubStore = store.subscribe((snap: RuntimeSnapshot) => {
      const storeErrors = store.getErrors();
      const projErrors = storeErrors.slice(-20).map((msg) => ({
        taskId: null,
        agentId: null,
        message: msg,
        severity: "warning",
      }));
      setProjection(projectSnapshot(snap, projErrors));
      gateway.updateSnapshot(snap);
    });

    // 订阅 adapter 事件
    const unsubAdapter = adapter.subscribe((event: DomainEvent) => {
      store.applyEvent(event);
      setEventLog((prev) => [...prev, event]);
      const storeErrors = store.getErrors();
      if (storeErrors.length > 0) {
        setErrors(storeErrors.slice(-10));
      }
    });

    // 初始 snapshot
    adapter.getSnapshot().then((snap) => {
      store.setSnapshot(snap);
      gateway.updateSnapshot(snap);
      setProjection(projectSnapshot(snap));
    });

    return () => {
      unsubStore();
      unsubAdapter();
    };
  }, [adapter, store, gateway]);

  const sendCommand = useCallback(
    async (
      commandType: string,
      payload: unknown,
      targetId: string | null = null
    ) => {
      cmdCounter.current++;
      const command = {
        commandId: `cmd-${Date.now()}-${cmdCounter.current}`,
        commandType,
        timestamp: new Date().toISOString(),
        source: "user" as const,
        actorId: "user-1",
        runtimeId,
        targetId,
        payload,
      };
      const result = await gateway.execute(command);
      if (result.status !== "accepted" && result.error) {
        setErrors((prev) => [
          ...prev.slice(-9),
          `[${commandType}] ${result.error!.message}`,
        ]);
      }
    },
    [gateway, runtimeId]
  );

  return { projection, eventLog, errors, sendCommand };
}
