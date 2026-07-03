/**
 * Event Dedup — 基于 eventId 的去重器。
 * 使用 LRU 策略，保留最近 N 个 eventId。
 */
export class EventDeduplicator {
  private seen = new Set<string>();
  private order: string[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  /** 返回 true 表示是重复事件（已见过），false 表示是新事件 */
  isDuplicate(eventId: string): boolean {
    return this.seen.has(eventId);
  }

  /** 记录 eventId，如已存在则不重复添加 */
  markSeen(eventId: string): void {
    if (this.seen.has(eventId)) return;
    this.seen.add(eventId);
    this.order.push(eventId);
    if (this.order.length > this.maxSize) {
      const removed = this.order.shift()!;
      this.seen.delete(removed);
    }
  }

  /** 检查并记录，返回 true 表示是重复事件 */
  checkAndMark(eventId: string): boolean {
    if (this.isDuplicate(eventId)) return true;
    this.markSeen(eventId);
    return false;
  }

  clear(): void {
    this.seen.clear();
    this.order = [];
  }

  get size(): number {
    return this.seen.size;
  }
}
