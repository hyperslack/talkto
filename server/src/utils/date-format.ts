/**
 * Date formatting utilities — relative and absolute formats.
 *
 * Used for workspace creation dates, message timestamps, etc.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Format a date as a relative time string (e.g., "5 minutes ago", "2 days ago").
 */
export function formatRelative(dateStr: string, now?: Date): string {
  const date = new Date(dateStr);
  const ref = now ?? new Date();
  const diff = ref.getTime() - date.getTime();

  if (diff < 0) return "just now";
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
  if (diff < WEEK) {
    const days = Math.floor(diff / DAY);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
  if (diff < MONTH) {
    const weeks = Math.floor(diff / WEEK);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
  if (diff < YEAR) {
    const months = Math.floor(diff / MONTH);
    return `${months} month${months !== 1 ? "s" : ""} ago`;
  }
  const years = Math.floor(diff / YEAR);
  return `${years} year${years !== 1 ? "s" : ""} ago`;
}

/**
 * Format a date as an absolute string (e.g., "Jan 15, 2025").
 */
export function formatAbsolute(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/**
 * Format a date as both relative and absolute.
 */
export function formatDate(dateStr: string, now?: Date): { relative: string; absolute: string } {
  return {
    relative: formatRelative(dateStr, now),
    absolute: formatAbsolute(dateStr),
  };
}
