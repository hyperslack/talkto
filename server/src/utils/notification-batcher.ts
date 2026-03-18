/**
 * Notification digest batching utilities.
 *
 * Batch individual notifications by time window and channel
 * for digest-style delivery instead of per-message alerts.
 */

export interface Notification {
  id: string;
  channelId: string;
  channelName: string;
  senderId: string;
  senderName: string;
  content: string;
  type: "message" | "mention" | "reply" | "reaction";
  timestamp: number;
}

export interface NotificationBatch {
  channelId: string;
  channelName: string;
  notifications: Notification[];
  count: number;
  senders: string[];
  types: string[];
  oldest: number;
  newest: number;
}

export interface DigestSummary {
  batches: NotificationBatch[];
  totalCount: number;
  channelCount: number;
  timeSpanMs: number;
}

/**
 * Group notifications into batches by channel.
 */
export function batchByChannel(notifications: Notification[]): NotificationBatch[] {
  const groups = new Map<string, Notification[]>();
  for (const n of notifications) {
    const list = groups.get(n.channelId) ?? [];
    list.push(n);
    groups.set(n.channelId, list);
  }

  const batches: NotificationBatch[] = [];
  for (const [channelId, items] of groups) {
    const sorted = items.sort((a, b) => a.timestamp - b.timestamp);
    batches.push({
      channelId,
      channelName: sorted[0].channelName,
      notifications: sorted,
      count: sorted.length,
      senders: [...new Set(sorted.map((n) => n.senderName))],
      types: [...new Set(sorted.map((n) => n.type))],
      oldest: sorted[0].timestamp,
      newest: sorted[sorted.length - 1].timestamp,
    });
  }

  // Sort batches by newest notification (most recent first)
  return batches.sort((a, b) => b.newest - a.newest);
}

/**
 * Build a digest summary from notifications.
 */
export function buildDigest(notifications: Notification[]): DigestSummary {
  if (notifications.length === 0) {
    return { batches: [], totalCount: 0, channelCount: 0, timeSpanMs: 0 };
  }
  const batches = batchByChannel(notifications);
  const timestamps = notifications.map((n) => n.timestamp);
  return {
    batches,
    totalCount: notifications.length,
    channelCount: batches.length,
    timeSpanMs: Math.max(...timestamps) - Math.min(...timestamps),
  };
}

/**
 * Format a batch as a one-line summary.
 */
export function formatBatchLine(batch: NotificationBatch): string {
  const senderText =
    batch.senders.length === 1
      ? batch.senders[0]
      : `${batch.senders[0]} and ${batch.senders.length - 1} other${batch.senders.length > 2 ? "s" : ""}`;
  return `#${batch.channelName}: ${batch.count} message${batch.count > 1 ? "s" : ""} from ${senderText}`;
}

/**
 * Format full digest as multi-line summary.
 */
export function formatDigest(digest: DigestSummary): string {
  if (digest.totalCount === 0) return "No new notifications";
  const header = `${digest.totalCount} notification${digest.totalCount > 1 ? "s" : ""} in ${digest.channelCount} channel${digest.channelCount > 1 ? "s" : ""}`;
  const lines = digest.batches.map(formatBatchLine);
  return [header, ...lines].join("\n");
}

/**
 * Filter notifications to only mentions and replies (high priority).
 */
export function highPriority(notifications: Notification[]): Notification[] {
  return notifications.filter((n) => n.type === "mention" || n.type === "reply");
}

/**
 * Check if any notification in the batch mentions the user.
 */
export function hasMentions(batch: NotificationBatch): boolean {
  return batch.types.includes("mention");
}

/**
 * Sliding window batcher that accumulates notifications and flushes periodically.
 */
export class NotificationAccumulator {
  private buffer: Notification[] = [];
  private windowMs: number;
  private lastFlush: number = Date.now();

  constructor(windowMs = 60000) {
    this.windowMs = windowMs;
  }

  add(notification: Notification): void {
    this.buffer.push(notification);
  }

  shouldFlush(): boolean {
    return this.buffer.length > 0 && Date.now() - this.lastFlush >= this.windowMs;
  }

  flush(): Notification[] {
    const items = [...this.buffer];
    this.buffer = [];
    this.lastFlush = Date.now();
    return items;
  }

  pending(): number {
    return this.buffer.length;
  }
}
