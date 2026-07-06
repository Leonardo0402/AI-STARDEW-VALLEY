import { useState, useEffect, useCallback } from "react";
import type { LifeSimCommand, LifeSimCommandResult } from "@agent-office/life-sim";
import { LifeSimSession } from "./session.js";
import type { LifeSimProjection } from "./projection.js";
import type { LifeSimSessionState } from "./types.js";

export interface UseLifeSimStateResult {
  projection: LifeSimProjection;
  state: LifeSimSessionState;
  errors: string[];
  execute(command: LifeSimCommand): Promise<LifeSimCommandResult>;
}

export function useLifeSimState(session: LifeSimSession): UseLifeSimStateResult {
  const [projection, setProjection] = useState<LifeSimProjection>(() =>
    session.getProjection()
  );
  const [state, setState] = useState<LifeSimSessionState>("idle");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeProjection = session.onProjectionChange(setProjection);
    const unsubscribeState = session.onStateChange(setState);

    return () => {
      unsubscribeProjection();
      unsubscribeState();
    };
  }, [session]);

  const execute = useCallback(
    async (command: LifeSimCommand): Promise<LifeSimCommandResult> => {
      try {
        const result = await session.execute(command);

        if (result.status === "rejected" && result.error) {
          const message = `[${command.commandType}] ${result.error.message}`;
          setErrors((prev) => [...prev.slice(-9), message]);
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setErrors((prev) => [...prev.slice(-9), message]);
        throw error;
      }
    },
    [session]
  );

  return { projection, state, errors, execute };
}
