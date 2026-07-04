import type { OfficeCommand, CommandResult } from "@agent-office/protocol";
import { validateCommandResult } from "./validators.js";

export interface PostCommandOptions {
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function errorResult(commandId: string, code: string, message: string): CommandResult {
  return {
    commandId,
    status: "error",
    error: { code, message },
    affectedEventIds: [],
  };
}

export async function postCommand(
  url: string,
  command: OfficeCommand,
  opts: PostCommandOptions
): Promise<CommandResult> {
  // Resolve auth headers (refreshed each call)
  let authHeaders: Record<string, string> = {};
  if (typeof opts.headers === "function") {
    try {
      authHeaders = await opts.headers();
    } catch {
      // auth resolution failure → error result
      return errorResult(command.commandId, "AUTH_RESOLUTION_FAILED", "Failed to resolve auth headers");
    }
  } else if (opts.headers) {
    authHeaders = opts.headers;
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "Idempotency-Key": command.commandId,
    ...authHeaders,
  });

  const ac = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30000;
  // Plan Review Fix 9, v3: track which signal fired first to correctly
  // distinguish TIMEOUT from ABORTED. Without this, if both the timeout timer
  // and the lifecycle abort fire in the same tick, `opts.signal.aborted` could
  // be true even though the timeout fired first — misclassifying TIMEOUT as
  // ABORTED.
  // Typed as `string | null` (not the literal union) so TypeScript does not
  // narrow away "timeout" at the catch-block comparison: the setTimeout
  // callback assigns "timeout" asynchronously, which TS control-flow analysis
  // cannot track across the closure boundary.
  let abortReason: string | null = null;
  const timer = setTimeout(() => { abortReason = "timeout"; ac.abort(); }, timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) { abortReason = "external"; ac.abort(); }
    else opts.signal.addEventListener("abort", () => { abortReason = "external"; ac.abort(); }, { once: true });
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(command),
      credentials: opts.credentials ?? "omit",
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      // Classify by which signal fired first (Plan Review Fix 9, v3).
      if (abortReason === "timeout") {
        return errorResult(command.commandId, "TIMEOUT", `Command timed out after ${timeoutMs}ms`);
      }
      return errorResult(command.commandId, "ABORTED", "Command aborted");
    }
    return errorResult(command.commandId, "NETWORK_ERROR", err instanceof Error ? err.message : String(err));
  }
  clearTimeout(timer);

  // Parse body — wrapped in try/catch because the connection may drop during
  // body read (after headers arrived), causing resp.text() to throw. Without
  // this, the exception propagates through adapter.execute() → gateway.execute()
  // as an unhandled exception, violating the CommandResult { status: "error" }
  // contract for network failures.
  let text: string;
  try {
    text = await resp.text();
  } catch (err) {
    return errorResult(command.commandId, "NETWORK_ERROR", err instanceof Error ? err.message : String(err));
  }

  // Non-2xx → map to error result (checked BEFORE requiring JSON so a non-JSON
  // error body is classified by HTTP status, not as COMMAND_RESPONSE_INVALID)
  if (!resp.ok) {
    let errBody: unknown = text;
    try {
      errBody = JSON.parse(text);
    } catch {
      // keep errBody as text
    }
    const code = `HTTP_${resp.status}`;
    const message = typeof (errBody as { error?: { message?: string } })?.error?.message === "string"
      ? (errBody as { error: { message: string } }).error.message
      : `Server returned HTTP ${resp.status}`;
    return errorResult(command.commandId, code, message);
  }

  // 2xx → must be valid JSON
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResult(command.commandId, "COMMAND_RESPONSE_INVALID", `Non-JSON response (HTTP ${resp.status})`);
  }

  // Validate response shape
  const result = validateCommandResult(body, command.commandId);
  if (!result.ok) {
    return errorResult(command.commandId, "COMMAND_RESPONSE_INVALID", result.error.message);
  }
  return result.value;
}
