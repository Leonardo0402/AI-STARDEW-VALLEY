/**
 * GitHubSyncScheduler — polling daemon for incremental GitHub sync.
 *
 * 职责：
 * - 定时驱动 adapter.syncIncremental
 * - 失败时标记 lastSyncFailed，下次 syncOnce 走全量 resync
 * - 可配置 interval（默认 60s）
 *
 * 不持有 cursor —— cursor 在 adapter 上，scheduler 通过 getCursor/resetCursor 访问。
 */
import type { GitHubRuntimeAdapter } from "./github-adapter.js";
import type { GitHubApiClient } from "./github-api-client.js";

export interface GitHubSyncSchedulerOptions {
  intervalMs?: number;
  owner: string;
  repo: string;
}

export interface GitHubSyncSchedulerCallbacks {
  onSyncSuccess?(timestamp: string): void;
  onSyncFailure?(error: Error, willResync: boolean): void;
  onResync?(): void;
}

export class GitHubSyncScheduler {
  private readonly adapter: GitHubRuntimeAdapter;
  private readonly client: GitHubApiClient;
  private readonly owner: string;
  private readonly repo: string;
  private readonly intervalMs: number;
  private readonly callbacks: GitHubSyncSchedulerCallbacks;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSyncFailed = false;

  constructor(
    adapter: GitHubRuntimeAdapter,
    client: GitHubApiClient,
    options: GitHubSyncSchedulerOptions,
    callbacks: GitHubSyncSchedulerCallbacks = {},
  ) {
    this.adapter = adapter;
    this.client = client;
    this.owner = options.owner;
    this.repo = options.repo;
    this.intervalMs = options.intervalMs ?? 60000;
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.timer !== null) return;
    // Immediate sync, then interval
    this.syncOnce();
    this.timer = setInterval(() => this.syncOnce(), this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  async syncOnce(): Promise<void> {
    if (this.lastSyncFailed) {
      try {
        await this.adapter.syncFromApi(this.client, this.owner, this.repo);
        this.adapter.resetCursor();
        this.lastSyncFailed = false;
        this.callbacks.onResync?.();
      } catch (err) {
        this.lastSyncFailed = true;
        this.callbacks.onSyncFailure?.(err as Error, false);
      }
      return;
    }

    try {
      await this.adapter.syncIncremental(this.client, this.owner, this.repo);
      this.callbacks.onSyncSuccess?.(this.adapter.getCursor());
    } catch (err) {
      this.lastSyncFailed = true;
      this.callbacks.onSyncFailure?.(err as Error, true);
    }
  }
}
