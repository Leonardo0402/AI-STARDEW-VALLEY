import type {
  LifeSimSnapshotResponse,
  LifeSimEvent,
  LifeSimCommand,
  LifeSimCommandResult,
} from "@agent-office/life-sim";
import type { LifeSimClient, LifeSimStreamObserver } from "./types.js";

interface SseMessage {
  type: string;
  data: string;
  lastEventId?: string;
}

interface EventSourceInstance {
  readonly url: string;
  readonly readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  close(): void;
  addEventListener(type: string, listener: ((ev: unknown) => void) | null): void;
  removeEventListener(type: string, listener: ((ev: unknown) => void) | null): void;
}

export interface EventSourceConstructor {
  new (url: string): EventSourceInstance;
  readonly CONNECTING: number;
  readonly OPEN: number;
  readonly CLOSED: number;
}

export interface HttpLifeSimClientOptions {
  baseUrl: string;
  worldId: string;
  fetch?: typeof fetch;
  EventSource?: EventSourceConstructor;
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  return `${trimmed}${path}`;
}

export class HttpLifeSimClient implements LifeSimClient {
  private baseUrl: string;
  private worldId: string;
  private fetchImpl: typeof fetch;
  private EventSourceImpl: EventSourceConstructor;

  constructor(opts: HttpLifeSimClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.worldId = opts.worldId;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    const GlobalEventSource = (globalThis as Record<string, unknown>).EventSource as
      | EventSourceConstructor
      | undefined;
    if (!opts.EventSource && !GlobalEventSource) {
      throw new Error("EventSource is not available; provide one in the constructor options");
    }
    this.EventSourceImpl = opts.EventSource ?? GlobalEventSource!;
  }

  async getSnapshot(): Promise<LifeSimSnapshotResponse> {
    const url = joinUrl(this.baseUrl, `/life-sim/${this.worldId}/snapshot`);
    const resp = await this.fetchImpl(url);
    if (!resp.ok) {
      throw new Error(`Snapshot fetch failed: HTTP ${resp.status}`);
    }
    return (await resp.json()) as LifeSimSnapshotResponse;
  }

  async execute(command: LifeSimCommand): Promise<LifeSimCommandResult> {
    const url = joinUrl(this.baseUrl, `/life-sim/${this.worldId}/command`);
    const resp = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!resp.ok) {
      throw new Error(`Command execution failed: HTTP ${resp.status}`);
    }
    return (await resp.json()) as LifeSimCommandResult;
  }

  subscribe(
    afterLifeSimSequence: number,
    observer: LifeSimStreamObserver
  ): { close(): void } {
    const url = joinUrl(
      this.baseUrl,
      `/life-sim/${this.worldId}/events?afterLifeSimSequence=${afterLifeSimSequence}`
    );
    const es = new this.EventSourceImpl(url);

    observer.onState?.("opening");

    es.onopen = () => {
      observer.onState?.("ready");
    };

    const handleEvent = (ev: unknown) => {
      const msg = ev as SseMessage;
      let parsed: LifeSimEvent;
      try {
        parsed = JSON.parse(msg.data) as LifeSimEvent;
      } catch (err) {
        observer.onError?.({
          code: "parse_error",
          message: err instanceof Error ? err.message : "Failed to parse event data",
          recoverable: true,
        });
        return;
      }
      observer.onEvent(parsed);
    };

    const handleReset = () => {
      observer.onState?.("reset_required");
      es.close();
    };

    es.addEventListener("life-sim-event", handleEvent);
    es.addEventListener("reset", handleReset);
    es.addEventListener("reset_required", handleReset);

    es.onerror = () => {
      observer.onError?.({
        code: "network_error",
        message: "SSE connection error",
        recoverable: true,
      });
    };

    return {
      close: () => {
        es.close();
        observer.onState?.("closed");
      },
    };
  }
}
