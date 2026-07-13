import { useMemo, useCallback, useRef } from "react";
import type { SnapshotStore, CommandGateway, RuntimeSession } from "@agent-office/core";
import type { RuntimeAdapter } from "@agent-office/protocol";
import { useOfficeState, type OfficeState } from "@agent-office/control-ui";
import {
  useIntegrationState,
  type IntegrationState,
} from "@agent-office/control-ui/integration";
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
  integration: IntegrationState;
  lifeSim: UseLifeSimStateResult;
  sendLifeSimCommand(commandType: string, payload: unknown): Promise<void>;
}

export function useComposedOfficeState(
  session: RuntimeSession,
  store: SnapshotStore,
  gateway: CommandGateway,
  runtimeId: string,
  lifeSimSession: LifeSimSession,
  adapter: RuntimeAdapter,
  worldId: string = "default"
): ComposedOfficeState {
  const office = useOfficeState(session, store, gateway, runtimeId);
  const lifeSim = useLifeSimState(lifeSimSession);
  const integration = useIntegrationState(adapter, store);
  const seqRef = useRef(0);

  const projection = useMemo(
    () => composeProjections(office.projection, lifeSim.projection, integration.projection),
    [office.projection, lifeSim.projection, integration.projection]
  );

  const sendLifeSimCommand = useCallback(
    async (commandType: string, payload: unknown): Promise<void> => {
      const command: LifeSimCommand = {
        commandId: `life-sim-cmd-${++seqRef.current}`,
        commandType,
        timestamp: "1970-01-01T00:00:00.000Z",
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
    integration,
    lifeSim,
    sendLifeSimCommand,
  };
}
