import type { RuntimeSnapshot, RuntimeStreamError } from "@agent-office/protocol";
import { httpGet, type HttpGetOptions } from "./http-client.js";
import { validateSnapshot } from "./validators.js";

export async function fetchSnapshot(
  url: string,
  expectedRuntimeId: string,
  opts: HttpGetOptions
): Promise<RuntimeSnapshot> {
  let resp;
  try {
    resp = await httpGet(url, opts);
  } catch (e) {
    throw e as RuntimeStreamError;
  }
  if (!resp.ok) {
    throw {
      code: "http_error",
      message: `Snapshot fetch failed: HTTP ${resp.status}`,
      recoverable: resp.status >= 500,
      status: resp.status,
    } satisfies RuntimeStreamError;
  }
  const result = validateSnapshot(resp.body, expectedRuntimeId);
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}
