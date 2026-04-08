/** Utilities for compact unread badge labels in the sidebar. */

/**
 * Format unread count for badges.
 * - 0 or less: empty string (hide badge)
 * - 1..99: exact number
 * - 100+: "99+"
 */
export function formatUnreadBadge(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count >= 100) return "99+";
  return String(Math.floor(count));
}
