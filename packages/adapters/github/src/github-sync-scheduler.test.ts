import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitHubSyncScheduler } from "./github-sync-scheduler.js";
import { GitHubRuntimeAdapter } from "./github-adapter.js";
import { GitHubApiClient } from "./github-api-client.js";
import { GitHubApiError } from "./github-api-client.js";

describe("GitHubSyncScheduler", () => {
  let adapter: GitHubRuntimeAdapter;
  let client: GitHubApiClient;

  beforeEach(() => {
    adapter = new GitHubRuntimeAdapter();
    client = new GitHubApiClient({ token: "" });
    vi.useFakeTimers();
  });

  it("start triggers immediate syncOnce and schedules interval", async () => {
    const syncIncrementalSpy = vi.spyOn(adapter, "syncIncremental").mockResolvedValue(undefined);

    const scheduler = new GitHubSyncScheduler(adapter, client, {
      owner: "owner",
      repo: "repo",
      intervalMs: 60000,
    });

    scheduler.start();

    // Immediate syncOnce was called
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    // Advance 60s → second sync
    await vi.advanceTimersByTimeAsync(60000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it("stop clears interval and prevents further syncs", async () => {
    const syncIncrementalSpy = vi.spyOn(adapter, "syncIncremental").mockResolvedValue(undefined);

    const scheduler = new GitHubSyncScheduler(adapter, client, {
      owner: "owner",
      repo: "repo",
      intervalMs: 60000,
    });

    scheduler.start();
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    scheduler.stop();

    await vi.advanceTimersByTimeAsync(120000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1); // no additional syncs
  });

  it("default intervalMs is 60000", async () => {
    const syncIncrementalSpy = vi.spyOn(adapter, "syncIncremental").mockResolvedValue(undefined);

    const scheduler = new GitHubSyncScheduler(adapter, client, {
      owner: "owner",
      repo: "repo",
      // no intervalMs — should default to 60000
    });

    scheduler.start();
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    // 59s → no second sync yet
    await vi.advanceTimersByTimeAsync(59000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    // 1 more second → second sync
    await vi.advanceTimersByTimeAsync(1000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it("onSyncSuccess callback is called with cursor timestamp", async () => {
    vi.spyOn(adapter, "syncIncremental").mockImplementation(async () => {
      // Simulate cursor being set
      (adapter as unknown as { lastUpdatedAt: string }).lastUpdatedAt = "2026-01-10T08:00:00Z";
    });
    vi.spyOn(adapter, "getCursor").mockReturnValue("2026-01-10T08:00:00Z");

    let capturedTimestamp = "";
    const scheduler = new GitHubSyncScheduler(
      adapter,
      client,
      { owner: "owner", repo: "repo" },
      { onSyncSuccess: (ts) => { capturedTimestamp = ts; } },
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedTimestamp).toBe("2026-01-10T08:00:00Z");
    scheduler.stop();
  });
});

describe("GitHubSyncScheduler — resync on failure", () => {
  let adapter: GitHubRuntimeAdapter;
  let client: GitHubApiClient;

  beforeEach(() => {
    adapter = new GitHubRuntimeAdapter();
    client = new GitHubApiClient({ token: "" });
    vi.useFakeTimers();
  });

  it("calls onSyncFailure and sets lastSyncFailed when syncIncremental throws", async () => {
    const error = new GitHubApiError("Network error", 0);
    vi.spyOn(adapter, "syncIncremental").mockRejectedValue(error);

    let capturedError: Error | null = null;
    let capturedWillResync = false;

    const scheduler = new GitHubSyncScheduler(
      adapter,
      client,
      { owner: "owner", repo: "repo" },
      {
        onSyncFailure: (err, willResync) => {
          capturedError = err;
          capturedWillResync = willResync;
        },
      },
    );

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedError).toBe(error);
    expect(capturedWillResync).toBe(true);
    scheduler.stop();
  });

  it("next syncOnce after failure calls syncFromApi (resync) + onResync", async () => {
    const error = new GitHubApiError("Network error", 0);
    const syncIncrementalSpy = vi.spyOn(adapter, "syncIncremental").mockRejectedValueOnce(error);
    const syncFromApiSpy = vi.spyOn(adapter, "syncFromApi").mockResolvedValue(undefined);
    const resetCursorSpy = vi.spyOn(adapter, "resetCursor").mockReturnValue(undefined);

    let resyncCalled = false;

    const scheduler = new GitHubSyncScheduler(
      adapter,
      client,
      { owner: "owner", repo: "repo" },
      { onResync: () => { resyncCalled = true; } },
    );

    // First syncOnce: fails
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(1);

    // Second syncOnce: resync
    await vi.advanceTimersByTimeAsync(60000);
    expect(syncFromApiSpy).toHaveBeenCalledTimes(1);
    expect(resetCursorSpy).toHaveBeenCalledTimes(1);
    expect(resyncCalled).toBe(true);

    // Third syncOnce: back to normal incremental
    syncIncrementalSpy.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(60000);
    expect(syncIncrementalSpy).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it("resync failure keeps lastSyncFailed true and calls onSyncFailure with willResync=false", async () => {
    const error = new GitHubApiError("Network error", 0);
    vi.spyOn(adapter, "syncIncremental").mockRejectedValueOnce(error);
    vi.spyOn(adapter, "syncFromApi").mockRejectedValue(error);

    let capturedWillResync = true;

    const scheduler = new GitHubSyncScheduler(
      adapter,
      client,
      { owner: "owner", repo: "repo" },
      {
        onSyncFailure: (_err, willResync) => {
          capturedWillResync = willResync;
        },
      },
    );

    // First: incremental fails
    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(capturedWillResync).toBe(true);

    // Second: resync also fails
    capturedWillResync = true;
    await vi.advanceTimersByTimeAsync(60000);
    expect(capturedWillResync).toBe(false);

    scheduler.stop();
  });
});
