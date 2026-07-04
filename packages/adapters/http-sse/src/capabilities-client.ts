import type { AdapterCapabilities, RuntimeStreamError } from "@agent-office/protocol";
import { httpGet, type HttpGetOptions } from "./http-client.js";
import { validateCapabilities } from "./validators.js";

export interface CapabilitiesOptions extends HttpGetOptions {
  fallbackCapabilities?: AdapterCapabilities;
}

export async function fetchCapabilities(
  url: string,
  opts: CapabilitiesOptions
): Promise<AdapterCapabilities> {
  let resp;
  try {
    resp = await httpGet(url, opts);
  } catch (e) {
    // Network error / timeout / abort — NEVER use fallback (revised per Plan Review).
    // Fallback only applies to 404/501 below. Auth failures, server errors,
    // network failures, JSON corruption, and validation failures MUST surface.
    throw e as RuntimeStreamError;
  }
  if (!resp.ok) {
    // Fallback is RESTRICTED to HTTP 404 and 501 only (endpoint not implemented).
    // A 401/403 (auth), 500 (server), or any other status MUST NOT trigger fallback.
    if (opts.fallbackCapabilities && (resp.status === 404 || resp.status === 501)) {
      return opts.fallbackCapabilities;
    }
    throw {
      code: resp.status === 401 || resp.status === 403 ? "authentication_failed" : "http_error",
      message: `Capabilities fetch failed: HTTP ${resp.status}`,
      recoverable: resp.status >= 500,
      status: resp.status,
    } satisfies RuntimeStreamError;
  }
  const result = validateCapabilities(resp.body);
  if (!result.ok) {
    // Validation failure — NEVER use fallback (revised per Plan Review).
    // A malformed body indicates a server bug; fallback would hide it.
    throw result.error;
  }
  return result.value;
}
