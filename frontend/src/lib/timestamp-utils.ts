/** Timestamp formatting and clipboard utilities for messages. */

/**
 * Format an ISO timestamp as a full absolute datetime string.
 * Example: "March 10, 2026 at 2:05 AM"
 */
export function formatAbsoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format an ISO timestamp as a short time string.
 * Example: "2:05 AM"
 */
export function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Build a message permalink URL for copying.
 */
export function buildMessagePermalink(channelName: string, messageId: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/?channel=${encodeURIComponent(channelName)}&message=${encodeURIComponent(messageId)}`;
}

/**
 * Format an ISO timestamp for display in tooltip:
 * Shows both relative and absolute time.
 */
export function formatTimestampTooltip(iso: string): string {
  const abs = formatAbsoluteTime(iso);
  return abs;
}
