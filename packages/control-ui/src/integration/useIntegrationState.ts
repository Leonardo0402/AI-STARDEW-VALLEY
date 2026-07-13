import { useState, useEffect } from "react";
import type { SnapshotStore } from "@agent-office/core";
import type { RuntimeAdapter, RuntimeSnapshot } from "@agent-office/protocol";
import type { IntegrationProjection } from "./types.js";
import { projectIntegration, emptyIntegrationProjection } from "./projection.js";

export interface IntegrationState {
  projection: IntegrationProjection;
}

export function useIntegrationState(
  adapter: RuntimeAdapter,
  store: SnapshotStore
): IntegrationState {
  const [projection, setProjection] = useState<IntegrationProjection>(() =>
    projectIntegration(adapter, store.getSnapshot())
  );

  useEffect(() => {
    return store.subscribe((snap: RuntimeSnapshot) => {
      setProjection(projectIntegration(adapter, snap));
    });
  }, [adapter, store]);

  return { projection };
}
