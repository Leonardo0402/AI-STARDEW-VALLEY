import type {
  RuntimeAdapter,
  RuntimeSnapshot,
  OfficeCommand,
  CommandResult,
  AdapterCapabilities,
  DomainEvent,
  RuntimeStreamObserver,
  RuntimeSubscription,
  RuntimeStreamError,
  SubscribeOptions,
} from "@agent-office/protocol";
import { fetchSnapshot } from "./snapshot-client.js";
import { fetchCapabilities } from "./capabilities-client.js";
import { postCommand } from "./command-client.js";
import { openEventStream } from "./stream-client.js";
import { createSseParser } from "./sse-parser.js";
import { validateEvent } from "./validators.js";

export const defaultEndpoints = {
  snapshot: "/runtime/snapshot",
  events: "/runtime/events",
  commands: "/runtime/commands",
  capabilities: "/runtime/capabilities",
};

export interface HttpSseAdapterOptions {
  runtimeId: string;
  baseUrl: string;
  endpoints?: Partial<typeof defaultEndpoints>;
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  credentials?: RequestCredentials;
  fallbackCapabilities?: AdapterCapabilities;
  commandTimeoutMs?: number;
  streamTimeoutMs?: number;
}

type StreamPhase = "REPLAY" | "LIVE";

export class HttpSseRuntimeAdapter implements RuntimeAdapter {
  private opts: HttpSseAdapterOptions;
  private endpoints: typeof defaultEndpoints;
  private cachedCapabilities: AdapterCapabilities | null = null;
  private connected = false;
  /** Unified lifecycle abort — aborted exactly once in disconnect(). Cancels all in-flight fetches. */
  private lifecycleAbort = new AbortController();
  /** Active subscription's stream abort (per-subscription). Aborted in close() or disconnect(). */
  private streamAbort: AbortController | null = null;

  constructor(opts: HttpSseAdapterOptions) {
    this.opts = opts;
    this.endpoints = { ...defaultEndpoints, ...opts.endpoints };
  }

  async connect(): Promise<void> {
    // Plan Review Fix 16, v3: explicit one-time-adapter guard. Without this,
    // calling connect() after disconnect() would silently no-op (because
    // lifecycleAbort.signal is already aborted → fetchCapabilities rejects
    // with AbortError) OR worse, race with a fresh subscribe() call. Make the
    // contract from Architecture Decision I enforceable at runtime: a
    // disconnected adapter CANNOT be reconnected — construct a new instance.
    if (this.lifecycleAbort.signal.aborted) {
      throw new Error(
        "HttpSseRuntimeAdapter.connect() called after disconnect(): " +
        "adapter is one-time per Architecture Decision I. " +
        "Construct a new HttpSseRuntimeAdapter instance to reconnect."
      );
    }
    if (this.connected) {
      return; // idempotent — connect() called twice without disconnect()
    }
    // Capabilities are immutable per runtime — cache once.
    this.cachedCapabilities = await fetchCapabilities(
      this.opts.baseUrl + this.endpoints.capabilities,
      {
        headers: await this.resolveHeaders(),
        credentials: this.opts.credentials,
        signal: this.lifecycleAbort.signal,
        fallbackCapabilities: this.opts.fallbackCapabilities,
      }
    );
    // NOTE: snapshot is NOT cached here. getSnapshot() fetches fresh on every call
    // so resynchronize() gets the latest checkpoint, not a stale connect-time snapshot.
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    // Per Architecture Decision I sequence:
    // 1. lifecycleAbort aborts ALL in-flight fetches (snapshot, capabilities, command, stream open).
    this.lifecycleAbort.abort();
    // 2. streamAbort aborts the active reader (if any).
    this.streamAbort?.abort();
    this.streamAbort = null;
  }

  async getSnapshot(): Promise<RuntimeSnapshot> {
    // NO CACHE — every call performs a fresh HTTP fetch.
    // This ensures resynchronize() gets the latest checkpoint, not a stale connect-time snapshot.
    return fetchSnapshot(
      this.opts.baseUrl + this.endpoints.snapshot,
      this.opts.runtimeId,
      {
        headers: await this.resolveHeaders(),
        credentials: this.opts.credentials,
        signal: this.lifecycleAbort.signal,
      }
    );
  }

  getCapabilities(): AdapterCapabilities {
    if (!this.cachedCapabilities) {
      throw new Error("connect() must be called before getCapabilities()");
    }
    return this.cachedCapabilities;
  }

  async execute(command: OfficeCommand): Promise<CommandResult> {
    // Per-call timeout AbortController combined with lifecycle signal (Architecture Decision I).
    const timeoutAc = new AbortController();
    const timeoutMs = this.opts.commandTimeoutMs ?? 10000;
    const timer = setTimeout(() => timeoutAc.abort(), timeoutMs);
    const combinedSignal = AbortSignal.any([this.lifecycleAbort.signal, timeoutAc.signal]);
    try {
      return await postCommand(
        this.opts.baseUrl + this.endpoints.commands,
        command,
        {
          headers: await this.resolveHeaders(),
          credentials: this.opts.credentials,
          signal: combinedSignal,
        }
      );
    } finally {
      clearTimeout(timer);
    }
  }

  subscribe(
    observer: RuntimeStreamObserver,
    options?: SubscribeOptions
  ): RuntimeSubscription {
    const afterSequence = options?.afterSequence ?? 0;
    const streamAbort = new AbortController();
    this.streamAbort = streamAbort;
    const combinedSignal = AbortSignal.any([this.lifecycleAbort.signal, streamAbort.signal]);

    let closed = false;
    let opened: {
      response: Response;
      reader: ReadableStreamDefaultReader<Uint8Array>;
      decoder: TextDecoder;
    } | null = null;

    // readyResolve/readyReject captured so the loop can resolve/reject at replay-complete.
    let readyResolve!: () => void;
    let readyReject!: (err: RuntimeStreamError) => void;
    let readySettled = false;
    const ready = new Promise<void>((res, rej) => {
      readyResolve = (v: void) => { if (!readySettled) { readySettled = true; res(v); } };
      readyReject = (err: RuntimeStreamError) => { if (!readySettled) { readySettled = true; rej(err); } };
    });

    // `terminated` is set whenever the stream must die — either because `ready`
    // was rejected (replay error) or because a LIVE-phase error closed the stream.
    // The read loop checks this after every `parser.feed(chunk)` and aborts the
    // reader immediately. Without this, a subsequent frame in the same chunk
    // (e.g. `replay-complete` after a gap rejection) could keep the loop alive
    // even though `ready` was already rejected — violating the "no stale stream
    // after ready failure" contract (Plan Review Issue 2, v3).
    let terminated = false;

    // Lifecycle/stream abort listener. When disconnect() (or close()) aborts
    // the combined signal, reject pending ready with "aborted" and cancel the
    // reader to unblock any in-flight reader.read(). This is necessary because
    // a mocked fetch may not honor the abort signal for the body stream —
    // without explicit cancellation, reader.read() would hang forever on a
    // never-producing stream. The readyReject is idempotent via readySettled,
    // so closeFn's readyReject (called later) is a no-op when close() triggers
    // the abort. (Plan Review Issue 3, v3 — extended to disconnect().)
    combinedSignal.addEventListener(
      "abort",
      () => {
        readyReject({ code: "aborted", message: "Stream aborted", recoverable: false });
        if (opened?.reader) {
          opened.reader.cancel().catch(() => { /* best-effort */ });
        }
      },
      { once: true }
    );

    // Single read loop. Started async; runs REPLAY then LIVE without breaking.
    const loopPromise = (async () => {
      try {
        opened = await openEventStream(
          this.opts.baseUrl + this.endpoints.events + `?afterSequence=${afterSequence}`,
          {
            headers: await this.resolveHeaders(),
            credentials: this.opts.credentials,
            signal: combinedSignal,
            timeoutMs: this.opts.streamTimeoutMs,
          }
        );
      } catch (err) {
        // close() may have won the race — closeFn rejects ready independently,
        // so we only reject here if close hasn't already settled ready.
        readyReject(err as RuntimeStreamError);
        return;
      }
      // If close() or disconnect() fired during openEventStream, clean up the
      // reader (which was just opened) and exit. The abort listener already
      // rejected ready; closeFn already rejected ready if closed.
      if (closed || combinedSignal.aborted) {
        await this.cleanupReader(opened.reader, streamAbort);
        return;
      }

      const { reader, decoder } = opened;
      let phase: StreamPhase = "REPLAY";
      let expectedSeq = afterSequence + 1;
      let lastDeliveredSeq = afterSequence;

      // The single parser instance handles BOTH replay and live frames.
      // For LIVE invalid events, we must defer onError until after ready resolves
      // (protocol §4.1.1: ready-then-onError ordering). Use a queue for live-phase errors.
      const liveErrorQueue: RuntimeStreamError[] = [];

      // Helper: reject ready AND mark stream for termination. All replay-phase
      // error paths MUST go through this (Plan Review Issue 2, v3) — otherwise
      // the parser keeps consuming the rest of the current chunk and the stream
      // stays alive after `ready` was already rejected.
      const rejectReadyAndTerminate = (err: RuntimeStreamError): void => {
        readyReject(err);
        terminated = true;
      };

      const parser = createSseParser({
        onEvent: (eventType, id, data) => {
          if (closed || terminated) return;

          // ─── replay-complete control frame ─────────────────────────────
          if (eventType === "replay-complete") {
            if (phase !== "REPLAY") {
              // Duplicate replay-complete in LIVE → protocol violation.
              liveErrorQueue.push({
                code: "stream_protocol_error",
                message: "Duplicate replay-complete frame in LIVE phase",
                recoverable: false,
              });
              return;
            }
            // Validate id === data.lastSequence === lastDeliveredSeq.
            let parsed: { lastSequence?: unknown };
            try {
              parsed = JSON.parse(data);
            } catch {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: "replay-complete data is not valid JSON",
                recoverable: false,
              });
              return;
            }
            const ls = parsed.lastSequence;
            if (typeof ls !== "number" || !Number.isFinite(ls) || !Number.isInteger(ls)) {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: "replay-complete.lastSequence must be an integer",
                recoverable: false,
              });
              return;
            }
            if (id !== undefined && Number(id) !== ls) {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: `replay-complete id ${id} !== data.lastSequence ${ls}`,
                recoverable: false,
              });
              return;
            }
            if (ls !== lastDeliveredSeq) {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: `replay-complete.lastSequence ${ls} !== last delivered ${lastDeliveredSeq}`,
                recoverable: false,
              });
              return;
            }
            // Transition REPLAY → READY → LIVE (same loop continues).
            phase = "LIVE";
            observer.onState?.("ready");
            readyResolve();
            return;
          }

          // ─── reset-required control frame (LIVE only) ──────────────────
          if (eventType === "reset-required") {
            if (phase === "REPLAY") {
              rejectReadyAndTerminate({
                code: "event_log_trimmed",
                message: "reset-required during replay",
                recoverable: true,
              });
              return;
            }
            liveErrorQueue.push({
              code: "event_log_trimmed",
              message: "Server signaled reset-required",
              recoverable: true,
            });
            return;
          }

          // ─── regular domain-event frame ────────────────────────────────
          let parsedEvent: unknown;
          try {
            parsedEvent = JSON.parse(data);
          } catch {
            // Malformed JSON: replay → reject ready + terminate; live → event_invalid + close (never silent).
            if (phase === "REPLAY") {
              rejectReadyAndTerminate({
                code: "event_invalid",
                message: "Malformed JSON in replay event",
                recoverable: false,
              });
            } else {
              liveErrorQueue.push({
                code: "event_invalid",
                message: "Malformed JSON in live event",
                recoverable: false,
              });
            }
            return;
          }
          const result = validateEvent(parsedEvent, this.opts.runtimeId);
          if (!result.ok) {
            // Invalid event: replay → reject ready + terminate; live → onError + close (never silent).
            if (phase === "REPLAY") {
              rejectReadyAndTerminate(result.error);
            } else {
              liveErrorQueue.push(result.error);
            }
            return;
          }
          const event = result.value;

          if (phase === "REPLAY") {
            // Enforce strict contiguity during replay.
            if (event.sequence !== expectedSeq) {
              rejectReadyAndTerminate({
                code: "event_log_trimmed",
                message: `Replay gap: expected sequence ${expectedSeq}, got ${event.sequence}`,
                recoverable: true,
              });
              return;
            }
            // Enforce SSE id === event.sequence (when id present).
            if (id !== undefined && id !== String(event.sequence)) {
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: `SSE id ${id} !== event.sequence ${event.sequence}`,
                recoverable: false,
              });
              return;
            }
            expectedSeq = event.sequence + 1;
            lastDeliveredSeq = event.sequence;
            observer.onEvent(event);
          } else {
            // LIVE phase: contiguity is enforced by SnapshotStore.applyEvent in the session,
            // not by the adapter. The adapter only validates structural integrity.
            // SSE id/sequence mismatch in LIVE → stream_protocol_error + close.
            if (id !== undefined && id !== String(event.sequence)) {
              liveErrorQueue.push({
                code: "stream_protocol_error",
                message: `LIVE SSE id ${id} !== event.sequence ${event.sequence}`,
                recoverable: false,
              });
              return;
            }
            observer.onEvent(event);
          }
        },
        onComment: () => {
          // heartbeat — ignore
        },
        onError: () => {
          // Parser-level non-fatal error (e.g. malformed frame boundary).
          // Replay → reject ready + terminate; Live → queue event_invalid.
          if (phase === "REPLAY") {
            rejectReadyAndTerminate({
              code: "stream_protocol_error",
              message: "SSE parser error during replay",
              recoverable: false,
            });
          } else {
            liveErrorQueue.push({
              code: "stream_protocol_error",
              message: "SSE parser error during live",
              recoverable: false,
            });
          }
        },
      });

      // ─── The single read loop ──────────────────────────────────────
      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (closed || terminated) {
            await this.cleanupReader(reader, streamAbort);
            return;
          }
          const { done, value } = await reader.read();
          if (done) {
            if (phase === "REPLAY") {
              // Server closed before sending replay-complete — protocol violation.
              rejectReadyAndTerminate({
                code: "stream_protocol_error",
                message: "Stream closed during replay without replay-complete frame",
                recoverable: false,
              });
            } else {
              // LIVE stream closed unexpectedly — recoverable.
              observer.onError?.({
                code: "http_error",
                message: "Live stream closed",
                recoverable: true,
              });
              observer.onState?.("error");
            }
            return;
          }
          const chunk = decoder.decode(value, { stream: true });
          parser.feed(chunk);

          // After feed: if ready was rejected during this chunk, terminate the
          // stream immediately (Plan Review Issue 2, v3). Without this, a later
          // frame in the same chunk (e.g. `replay-complete`) could keep the loop
          // alive even though `ready` was already rejected.
          if (terminated) {
            await this.cleanupReader(reader, streamAbort);
            return;
          }

          // Drain any LIVE-phase errors queued during this chunk.
          // (No-op during REPLAY — errors there reject ready + terminate directly.)
          // NOTE: `phase` is assigned "LIVE" inside the parser's onEvent closure,
          // but TS 5.9 CFA does not widen `phase` after `parser.feed(chunk)`. Cast
          // to `string` to prevent the "no overlap" narrowing error.
          if ((phase as string) === "LIVE" && liveErrorQueue.length > 0) {
            const err = liveErrorQueue.shift()!;
            observer.onError?.(err);
            observer.onState?.("error");
            // Close the stream on LIVE error (invalid event / protocol error).
            terminated = true;
            await this.cleanupReader(reader, streamAbort);
            return;
          }
        }
      } catch (err) {
        // reader.read() threw — typically AbortError from close()/disconnect().
        if (closed) return; // expected — closeFn settled ready
        if (combinedSignal.aborted) return; // disconnect() — abort listener settled ready
        if (phase === "REPLAY") {
          rejectReadyAndTerminate({
            code: "stream_protocol_error",
            message: err instanceof Error ? err.message : String(err),
            recoverable: false,
          });
        } else {
          observer.onError?.({
            code: "http_error",
            message: err instanceof Error ? err.message : String(err),
            recoverable: true,
          });
          observer.onState?.("error");
        }
      } finally {
        // Drain any remaining LIVE errors after loop exit (best-effort).
        while (liveErrorQueue.length > 0) {
          const err = liveErrorQueue.shift()!;
          observer.onError?.(err);
        }
      }
    })();

    const closeFn = async (): Promise<void> => {
      if (closed) return;
      closed = true;
      streamAbort.abort();
      // close-before-ready MUST reject pending ready (Plan Review Issue 3, v3).
      // Without this, `await subscription.ready` after `close()` would hang forever
      // — the Promise was neither resolved (replay didn't finish) nor rejected.
      // readyReject is a no-op if ready was already settled.
      readyReject({ code: "aborted", message: "closed before ready", recoverable: false });
      if (opened?.reader) {
        try { await opened.reader.cancel(); } catch { /* best-effort */ }
      }
      observer.onState?.("closed");
      // Avoid unhandled rejection if loopPromise rejects after close.
      loopPromise.catch(() => {});
    };

    return {
      ready,
      close: closeFn,
    };
  }

  private async cleanupReader(
    reader: ReadableStreamDefaultReader<Uint8Array> | null,
    ac: AbortController
  ): Promise<void> {
    ac.abort();
    if (reader) {
      try { await reader.cancel(); } catch { /* best-effort */ }
    }
  }

  private async resolveHeaders(): Promise<Record<string, string>> {
    if (typeof this.opts.headers === "function") {
      return await this.opts.headers();
    }
    return this.opts.headers ?? {};
  }
}
