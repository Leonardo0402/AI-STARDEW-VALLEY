import type { RuntimeStreamError } from "@agent-office/protocol";

export interface HttpResponse {
  ok: boolean;
  status: number;
  body: unknown;
  headers: Headers;
}

export interface HttpGetOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials; // Plan Review Fix 7, v3: support Cookie Auth
}

export interface HttpPostOptions {
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  credentials?: RequestCredentials; // Plan Review Fix 7, v3: support Cookie Auth
}

function makeStreamError(code: RuntimeStreamError["code"], message: string, recoverable: boolean, status?: number): RuntimeStreamError {
  return { code, message, recoverable, status };
}

export async function httpGet(url: string, opts: HttpGetOptions = {}): Promise<HttpResponse> {
  const ac = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  // Link external signal to our AbortController
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: opts.headers,
      credentials: opts.credentials ?? "omit",
      signal: ac.signal,
    });
    const text = await resp.text();
    let body: unknown = text;
    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
      try {
        body = JSON.parse(text);
      } catch {
        // keep body as text
      }
    }
    return { ok: resp.ok, status: resp.status, body, headers: resp.headers };
  } catch (err) {
    if (ac.signal.aborted && (!opts.signal || !opts.signal.aborted)) {
      // our timeout fired
      throw makeStreamError("http_error", `Request timed out after ${timeoutMs}ms`, true);
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw makeStreamError("aborted", "Request aborted", false);
    }
    throw makeStreamError("http_error", err instanceof Error ? err.message : String(err), true);
  } finally {
    clearTimeout(timer);
  }
}

export async function httpPostJson(url: string, opts: HttpPostOptions = {}): Promise<HttpResponse> {
  const ac = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30000;
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  // Link external signal to our AbortController
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: opts.headers,
      body: opts.body,
      credentials: opts.credentials ?? "omit",
      signal: ac.signal,
    });
    const text = await resp.text();
    let body: unknown = text;
    const ct = resp.headers.get("content-type") ?? "";
    if (ct.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
      try {
        body = JSON.parse(text);
      } catch {
        // keep body as text
      }
    }
    return { ok: resp.ok, status: resp.status, body, headers: resp.headers };
  } catch (err) {
    if (ac.signal.aborted && (!opts.signal || !opts.signal.aborted)) {
      // our timeout fired
      throw makeStreamError("http_error", `Request timed out after ${timeoutMs}ms`, true);
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw makeStreamError("aborted", "Request aborted", false);
    }
    throw makeStreamError("http_error", err instanceof Error ? err.message : String(err), true);
  } finally {
    clearTimeout(timer);
  }
}
