import { createRuntime } from "./create-runtime.js";
import type { DemoRuntimeConfig, RuntimeComposition } from "./types.js";

/**
 * Dispose the current Runtime Composition and build a fresh one.
 *
 * This is used by the StatusStrip "Retry" action to recover from a
 * `failed` / `disconnected` session without a full page reload.
 */
export async function rebuildRuntime(
  config: DemoRuntimeConfig,
  currentComposition: RuntimeComposition,
  renderApp: (composition: RuntimeComposition) => void
): Promise<RuntimeComposition> {
  await currentComposition.dispose();

  const composition = createRuntime(config);
  await composition.session.connect();

  renderApp(composition);
  return composition;
}
