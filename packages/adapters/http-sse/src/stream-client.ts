import type { RuntimeStreamError } from "@agent-office/protocol";

export interface OpenStreamOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials; // Plan Review Fix 7, v3: support Cookie Auth
}

export interface OpenedStream {
  response: Response;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  decoder: TextDecoder;
}

export async function openEventStream(
  url: string,
  opts: OpenStreamOptions
): Promise<OpenedStream> {
  const ac = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "GET",
      credentials: opts.credentials ?? "omit",
      headers: { Accept: "text/event-stream", ...opts.headers },
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      if (!opts.signal?.aborted) {
        throw { code: "stream_open_failed", message: `Stream open timed out after ${timeoutMs}ms`, recoverable: true } satisfies RuntimeStreamError;
      }
      throw { code: "aborted", message: "Stream open aborted", recoverable: false } satisfies RuntimeStreamError;
    }
    throw { code: "stream_open_failed", message: err instanceof Error ? err.message : String(err), recoverable: true } satisfies RuntimeStreamError;
  }
  clearTimeout(timer);

  if (!resp.ok) {
    const code = resp.status === 401 || resp.status === 403 ? "authentication_failed" : "stream_open_failed";
    const recoverable = resp.status >= 500;
    throw { code, message: `Stream open failed: HTTP ${resp.status}`, recoverable, status: resp.status } satisfies RuntimeStreamError;
  }
  const ct = resp.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream")) {
    throw { code: "stream_protocol_error", message: `Expected text/event-stream, got ${ct}`, recoverable: false, status: resp.status } satisfies RuntimeStreamError;
  }
  if (!resp.body) {
    throw { code: "stream_protocol_error", message: "Response has no body", recoverable: false, status: resp.status } satisfies RuntimeStreamError;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return { response: resp, reader, decoder };
}
