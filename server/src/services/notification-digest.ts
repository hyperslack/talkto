/**
 * Notification digest — batches notifications into periodic summaries
 * instead of sending them one-by-one.
 *
 * In-memory accumulator that groups notifications per user.
 */

export interface NotificationItem {
  type: "message" | "mention" | "reaction" | "thread_reply";
  channelId: string;
  channelName: string;
  fromUser: string;
  preview: string; // truncated content
  timestamp: string;
}

export interface DigestSummary {
  userId: string;
  items: NotificationItem[];
  channelSummary: Record<string, number>; // channelName → count
  totalCount: number;
  generatedAt: string;
}

const queues = new Map<string, NotificationItem[]>();

/** Queue a notification for digest delivery. */
export function queueNotification(userId: string, item: NotificationItem): void {
  const list = queues.get(userId) ?? [];
  list.push(item);
  queues.set(userId, list);
}

/** Generate and flush the digest for a user. */
export function flushDigest(userId: string): DigestSummary | null {
  const items = queues.get(userId);
  if (!items || items.length === 0) return null;

  const channelSummary: Record<string, number> = {};
  for (const item of items) {
    channelSummary[item.channelName] = (channelSummary[item.channelName] ?? 0) + 1;
  }

  const digest: DigestSummary = {
    userId,
    items: [...items],
    channelSummary,
    totalCount: items.length,
    generatedAt: new Date().toISOString(),
  };

  queues.delete(userId);
  return digest;
}

/** Check how many pending notifications a user has. */
export function pendingCount(userId: string): number {
  return queues.get(userId)?.length ?? 0;
}

/** Peek at pending notifications without flushing. */
export function peekNotifications(userId: string): NotificationItem[] {
  return [...(queues.get(userId) ?? [])];
}

/** Flush digests for all users who have pending notifications. */
export function flushAll(): DigestSummary[] {
  const digests: DigestSummary[] = [];
  for (const userId of queues.keys()) {
    const d = flushDigest(userId);
    if (d) digests.push(d);
  }
  return digests;
}

/** Format a digest into a human-readable summary string. */
export function formatDigest(digest: DigestSummary): string {
  const lines: string[] = [];
  lines.push(`📬 You have ${digest.totalCount} new notification${digest.totalCount > 1 ? "s" : ""}:`);

  for (const [channel, count] of Object.entries(digest.channelSummary)) {
    lines.push(`  • #${channel}: ${count} message${count > 1 ? "s" : ""}`);
  }

  return lines.join("\n");
}

/** Clear all queues (for testing). */
export function clearAll(): void {
  queues.clear();
}
