import type { RuntimeAdapter, RuntimeSnapshot } from "@agent-office/protocol";
import type { IntegrationProjection } from "./types.js";

export interface IntegrationProjectionProvider {
  getIntegrationProjection(snapshot: RuntimeSnapshot): IntegrationProjection;
}

export function emptyIntegrationProjection(): IntegrationProjection {
  return { github: null, reviews: null };
}

export function projectIntegration(
  adapter: RuntimeAdapter,
  snapshot: RuntimeSnapshot
): IntegrationProjection {
  const provider = adapter as RuntimeAdapter & Partial<IntegrationProjectionProvider>;
  if (typeof provider.getIntegrationProjection === "function") {
    return provider.getIntegrationProjection(snapshot);
  }
  return emptyIntegrationProjection();
}
