import { useMemo, useCallback } from "react";
import type { SnapshotStore, CommandGateway, RuntimeSession } from "@agent-office/core";
import { useOfficeState, type OfficeState } from "@agent-office/control-ui";
import {
  useLifeSimState,
  composeProjections,
  type UseLifeSimStateResult,
  type LifeSimSession,
  type ComposedOfficeProjection,
} from "@agent-office/control-ui/life-sim";
import type { LifeSimCommand } from "@agent-office/life-sim";

export interface ComposedOfficeState extends OfficeState {
  projection: ComposedOfficeProjection;
  lifeSim: UseLifeSimStateResult;
  sendLifeSimCommand(commandType: string, payload: unknown): Promise<void>;
}

export function useComposedOfficeState(
  session: RuntimeSession,
  store: SnapshotStore,
  gateway: CommandGateway,
  runtimeId: string,
  lifeSimSession: LifeSimSession,
  worldId: string = "default"
): ComposedOfficeState {
  const office = useOfficeState(session, store, gateway, runtimeId);
  const lifeSim = useLifeSimState(lifeSimSession);

  const projection = useMemo(
    () => composeProjections(office.projection, lifeSim.projection),
    [office.projection, lifeSim.projection]
  );

  const sendLifeSimCommand = useCallback(
    async (commandType: string, payload: unknown): Promise<void> => {
      const command: LifeSimCommand = {
        commandId: `life-sim-cmd-${Date.now()}`,
        commandType,
        timestamp: new Date().toISOString(),
        source: "user",
        actorId: "user-1",
        worldId,
        payload,
      };
      const result = await lifeSim.execute(command);
      if (result.status === "rejected" && result.error) {
        throw new Error(`[${commandType}] ${result.error.message}`);
      }
    },
    [lifeSim, worldId]
  );

  return {
    ...office,
    projection,
    lifeSim,
    sendLifeSimCommand,
  };
}
