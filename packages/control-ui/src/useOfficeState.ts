/**
 * useOfficeState — React Hook，连接 RuntimeSession 和 CommandGateway。
 *
 * 核心链路：
 *   RuntimeSession（拥有 adapter 订阅、bootstrap、gap 恢复）
 *     → SnapshotStore.subscribe → setState → React 重渲染
 *   React UI Action → CommandGateway.execute → Adapter → Event → SnapshotStore
 *
 * Hook 不再直接订阅 adapter，也不再实现 bootstrap。
 * 仅追加已接受事件（applied / reducer_rejected）到 UI 事件历史，
 * transport 拒绝事件（duplicate / stale / gap / runtime_mismatch）不出现。
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type {
  OfficeProjection,
  RuntimeSnapshot,
  DomainEvent,
  EventApplyResult,
} from "@agent-office/protocol";
import {
  SnapshotStore,
  CommandGateway,
  RuntimeSession,
  projectSnapshot,
} from "@agent-office/core";
import type {
  SessionState,
  SessionDiagnostics,
} from "@agent-office/core";

export interface OfficeState {
  projection: OfficeProjection;
  eventLog: DomainEvent[];
  errors: string[];
  sessionState: SessionState;
  diagnostics: SessionDiagnostics;
  sendCommand: (
    commandType: string,
    payload: unknown,
    targetId?: string | null
  ) => Promise<void>;
}

export function useOfficeState(
  session: RuntimeSession,
  store: SnapshotStore,
  gateway: CommandGateway,
  runtimeId: string
): OfficeState {
  const [projection, setProjection] = useState<OfficeProjection>(() =>
    projectSnapshot(store.getSnapshot())
  );
  const [eventLog, setEventLog] = useState<DomainEvent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [sessionState, setSessionState] = useState<SessionState>(() =>
    session.getState()
  );
  const [diagnostics, setDiagnostics] = useState<SessionDiagnostics>(() =>
    session.getDiagnostics()
  );
  const cmdCounter = useRef(0);

  useEffect(() => {
    // 订阅 store 变更（session 在 handleEvent 中已更新 gateway snapshot，此处只更新 projection）
    const unsubStore = store.subscribe((snap: RuntimeSnapshot) => {
      const storeErrors = store.getErrors();
      const projErrors = storeErrors.slice(-20).map((err) => ({
        taskId: null,
        agentId: null,
        message: err.message,
        severity: "warning" as const,
        code: err.code,
      }));
      setProjection(projectSnapshot(snap, projErrors));
    });

    // 订阅 session 状态变更
    const unsubSessionState = session.onStateChange((state, diag) => {
      setSessionState(state);
      setDiagnostics(diag);
    });

    // 仅追加已接受事件（transport 拒绝事件不进入 UI 历史）
    const unsubAccepted = session.onAcceptedEvent(
      (event: DomainEvent, result: EventApplyResult) => {
        setEventLog((prev) => [...prev, event]);
        // reducer errors 通过 result.reducerErrors 透传（结构化诊断）
        if (result.reducerErrors && result.reducerErrors.length > 0) {
          const errorMessages = result.reducerErrors.map((e) => e.message);
          setErrors((prev) => [...prev.slice(-9), ...errorMessages]);
        }
      }
    );

    return () => {
      unsubStore();
      unsubSessionState();
      unsubAccepted();
    };
  }, [session, store]);

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
        const msg = `[${commandType}] ${result.error!.message}`;
        setErrors((prev) => [...prev.slice(-9), msg]);
        // Throw so callers (e.g. ControlPanel action buttons) can show inline
        // action-level feedback in addition to the global error list.
        throw new Error(msg);
      }
    },
    [gateway, runtimeId]
  );

  return {
    projection,
    eventLog,
    errors,
    sessionState,
    diagnostics,
    sendCommand,
  };
}
