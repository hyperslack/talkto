/** Unread message count utilities for channel badges. */

export interface UnreadInfo {
  count: number;
  hasUnread: boolean;
  /** Formatted badge text: "99+" for large counts */
  badge: string;
}

const MAX_BADGE = 99;

/**
 * Compute unread count from last-read timestamp and messages.
 */
export function computeUnread(
  messages: Array<{ created_at: string; sender_id: string }>,
  lastReadAt: string | null,
  currentUserId: string,
): UnreadInfo {
  if (!lastReadAt) {
    // Never read — all messages from others are unread
    const count = messages.filter((m) => m.sender_id !== currentUserId).length;
    return formatUnread(count);
  }

  const count = messages.filter(
    (m) => m.created_at > lastReadAt && m.sender_id !== currentUserId,
  ).length;

  return formatUnread(count);
}

function formatUnread(count: number): UnreadInfo {
  return {
    count,
    hasUnread: count > 0,
    badge: count > MAX_BADGE ? `${MAX_BADGE}+` : String(count),
  };
}

/**
 * Format a count for display as a badge.
 */
export function formatBadgeCount(count: number): string {
  if (count <= 0) return "";
  if (count > MAX_BADGE) return `${MAX_BADGE}+`;
  return String(count);
}
