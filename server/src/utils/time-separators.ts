/**
 * Time separator utilities — inserts date separators between messages
 * when the conversation crosses a day boundary (e.g., "— Today —",
 * "— Yesterday —", "— March 15, 2026 —").
 */

export interface TimeSeparator {
  type: "separator";
  label: string;
  date: string; // ISO date string (YYYY-MM-DD)
}

export interface MessageItem {
  type: "message";
  message: { id: string; created_at: string };
}

export type FeedItem = TimeSeparator | MessageItem;

/**
 * Insert date separators into a chronologically sorted message list.
 * Returns a mixed array of messages and separator items for rendering.
 */
export function insertTimeSeparators<T extends { id: string; created_at: string }>(
  messages: T[],
  now: Date = new Date(),
): (T | TimeSeparator)[] {
  if (messages.length === 0) return [];

  const result: (T | TimeSeparator)[] = [];
  let lastDateStr: string | null = null;

  for (const msg of messages) {
    const msgDate = toDateString(msg.created_at);
    if (msgDate && msgDate !== lastDateStr) {
      result.push({
        type: "separator" as const,
        label: formatDateLabel(msgDate, now),
        date: msgDate,
      });
      lastDateStr = msgDate;
    }
    result.push(msg);
  }

  return result;
}

/**
 * Check if an item is a time separator (type guard).
 */
export function isTimeSeparator(item: unknown): item is TimeSeparator {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    (item as TimeSeparator).type === "separator"
  );
}

/**
 * Format a date string as a human-readable label relative to now.
 */
export function formatDateLabel(dateStr: string, now: Date = new Date()): string {
  const todayStr = toDateString(now.toISOString());
  if (!todayStr) return dateStr;

  if (dateStr === todayStr) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toDateString(yesterday.toISOString());
  if (dateStr === yesterdayStr) return "Yesterday";

  // Within last 7 days — show day name
  const msgDate = new Date(dateStr + "T00:00:00Z");
  const diffDays = Math.floor((now.getTime() - msgDate.getTime()) / 86_400_000);
  if (diffDays > 0 && diffDays < 7) {
    return msgDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  }

  // Older — show full date
  return msgDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: msgDate.getUTCFullYear() !== now.getFullYear() ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/**
 * Extract YYYY-MM-DD from an ISO timestamp.
 */
function toDateString(isoTimestamp: string): string | null {
  const match = isoTimestamp.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Count how many date separators would be inserted.
 */
export function countSeparators<T extends { created_at: string }>(messages: T[]): number {
  const dates = new Set<string>();
  for (const msg of messages) {
    const d = toDateString(msg.created_at);
    if (d) dates.add(d);
  }
  return dates.size;
}
