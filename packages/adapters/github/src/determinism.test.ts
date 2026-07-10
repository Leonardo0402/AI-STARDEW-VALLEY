/**
 * Determinism 测试 — 相同 fixture → 相同 snapshot + 相同 event 序列。
 * 覆盖 AC4。
 *
 * 所有 replay 测试断言 reducer errors === []（Fix 6）。
 */
import { describe, it, expect } from "vitest";
import { GitHubRuntimeAdapter } from "./index.js";
import { SAMPLE_FIXTURES } from "./fixtures/index.js";

describe("GitHub adapter determinism", () => {
  it("相同 fixture 产生相同 event 序列（eventId + sequence + type）", () => {
    const a = new GitHubRuntimeAdapter();
    a.syncFromFixtures(SAMPLE_FIXTURES);
    const eventsA = a.getEventLog();

    const b = new GitHubRuntimeAdapter();
    b.syncFromFixtures(SAMPLE_FIXTURES);
    const eventsB = b.getEventLog();

    expect(eventsA.length).toBe(eventsB.length);
    for (let i = 0; i < eventsA.length; i++) {
      expect(eventsA[i].eventId).toBe(eventsB[i].eventId);
      expect(eventsA[i].sequence).toBe(eventsB[i].sequence);
      expect(eventsA[i].type).toBe(eventsB[i].type);
      expect(eventsA[i].occurredAt).toBe(eventsB[i].occurredAt);
    }
  });

  it("相同 fixture 产生相同 snapshot（tasks + artifacts 逐字段比对）", async () => {
    const a = new GitHubRuntimeAdapter();
    a.syncFromFixtures(SAMPLE_FIXTURES);
    const snapA = await a.getSnapshot();
    expect(a.getLastReplayErrors()).toHaveLength(0);

    const b = new GitHubRuntimeAdapter();
    b.syncFromFixtures(SAMPLE_FIXTURES);
    const snapB = await b.getSnapshot();
    expect(b.getLastReplayErrors()).toHaveLength(0);

    expect(snapA.tasks).toEqual(snapB.tasks);
    expect(snapA.artifacts).toEqual(snapB.artifacts);
  });

  it("相同 fixture 产生相同 evidence", () => {
    const a = new GitHubRuntimeAdapter();
    a.syncFromFixtures(SAMPLE_FIXTURES);
    const evidenceA = a.getGitHubEvidence();

    const b = new GitHubRuntimeAdapter();
    b.syncFromFixtures(SAMPLE_FIXTURES);
    const evidenceB = b.getGitHubEvidence();

    expect(evidenceA).toEqual(evidenceB);
  });

  it("event ID 格式为 evt-gh-{seq}-{entityKind}-{entityNumber}", () => {
    const adapter = new GitHubRuntimeAdapter();
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const log = adapter.getEventLog();

    for (const event of log) {
      expect(event.eventId).toMatch(/^evt-gh-\d+-(issue|pr)-\d+$/);
    }
  });

  it("无 Date.now() 污染：occurredAt 全部来自 fixture 或 baseTimestamp", () => {
    const adapter = new GitHubRuntimeAdapter({ baseTimestamp: "2026-01-01T00:00:00Z" });
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const log = adapter.getEventLog();

    for (const event of log) {
      // 所有时间戳应以 2026-01 开头（fixture 时间戳或 baseTimestamp）
      expect(event.occurredAt).toMatch(/^2026-01-/);
    }
  });

  it("syncFromFixtures 幂等：重复调用产生相同结果", async () => {
    const adapter = new GitHubRuntimeAdapter();
    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const snap1 = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    const log1 = adapter.getEventLog();

    adapter.syncFromFixtures(SAMPLE_FIXTURES);
    const snap2 = await adapter.getSnapshot();
    expect(adapter.getLastReplayErrors()).toHaveLength(0);
    const log2 = adapter.getEventLog();

    expect(snap1.tasks).toEqual(snap2.tasks);
    expect(snap1.artifacts).toEqual(snap2.artifacts);
    expect(log1.length).toBe(log2.length);
  });
});
