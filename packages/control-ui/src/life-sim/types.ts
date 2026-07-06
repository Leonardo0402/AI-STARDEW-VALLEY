import type {
  LifeSimEvent,
  LifeSimSnapshotResponse,
  LifeSimCommand,
  LifeSimCommandResult,
} from "@agent-office/life-sim";

export interface LifeSimStreamObserver {
  onEvent(event: LifeSimEvent): void;
  onState?(
    state: "opening" | "ready" | "reset_required" | "closed"
  ): void;
  onError?(error: { code: string; message: string; recoverable: boolean }): void;
}

export interface LifeSimClient {
  getSnapshot(): Promise<LifeSimSnapshotResponse>;
  execute(command: LifeSimCommand): Promise<LifeSimCommandResult>;
  subscribe(
    afterLifeSimSequence: number,
    observer: LifeSimStreamObserver
  ): { close(): void };
}

export type LifeSimSessionState =
  | "idle"
  | "bootstrapping"
  | "live"
  | "reconnecting"
  | "error";

