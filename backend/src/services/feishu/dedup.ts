/**
 * 消息去重：防止飞书平台重试投递导致消息被重复处理
 * 基于消息 ID + 时间窗口的内存缓存
 */
import logger from '../../utils/logger.js';

const DEFAULT_DEDUP_WINDOW_MS = 30_000; // 30 秒窗口

interface DedupEntry {
  processedAt: number;
}

export class FeishuDedup {
  private cache = new Map<string, DedupEntry>();
  private windowMs: number;

  constructor(windowMs = DEFAULT_DEDUP_WINDOW_MS) {
    this.windowMs = windowMs;
  }

  /**
   * 检查消息是否已处理过
   * @returns true=重复，false=新消息
   */
  isDuplicate(messageId: string): boolean {
    const entry = this.cache.get(messageId);
    if (!entry) return false;

    // 超过窗口期，清理旧条目
    if (Date.now() - entry.processedAt > this.windowMs) {
      this.cache.delete(messageId);
      return false;
    }

    return true;
  }

  /** 标记消息为已处理 */
  mark(messageId: string): void {
    this.cache.set(messageId, { processedAt: Date.now() });
  }

  /** 清理过期条目，返回清理数量 */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.processedAt > this.windowMs) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  get size(): number {
    return this.cache.size;
  }
}

// 全局去重实例（每个 appId 一个）
const dedupInstances = new Map<string, FeishuDedup>();

export function getDedupInstance(appId: string, windowMs?: number): FeishuDedup {
  if (!dedupInstances.has(appId)) {
    dedupInstances.set(appId, new FeishuDedup(windowMs));
  }
  return dedupInstances.get(appId)!;
}

export function clearDedupInstance(appId?: string): void {
  if (appId) {
    dedupInstances.delete(appId);
  } else {
    dedupInstances.clear();
  }
}
