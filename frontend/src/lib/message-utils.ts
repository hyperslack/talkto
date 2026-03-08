/** Shared message utility functions.
 *
 * Extracted from component files so they can be exported without
 * triggering react-refresh/only-export-components warnings, and
 * imported by both components and tests.
 */

/**
 * Detect if content is "plain" — no markdown syntax at all.
 * Plain messages render as a simple span (no markdown overhead).
 */
const MARKDOWN_PATTERN = /[*_~`#\-[\]!|>]|^\d+\.\s|^-\s/m;

export function isPlainText(content: string): boolean {
  return !MARKDOWN_PATTERN.test(content);
}

/** Format an ISO timestamp as a full localized date+time string for tooltips. */
export function formatFullTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Format an ISO timestamp as a localized time string (HH:MM). */
export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Format an ISO timestamp as a human-readable date separator label.
 * - "Today", "Yesterday", or "Mon, Jan 6" for older dates.
 */
export function formatDateSeparator(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();

    // Strip time for day comparison
    const strip = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    const dayMs = 86_400_000;
    const diff = strip(now) - strip(date);

    if (diff === 0) return "Today";
    if (diff === dayMs) return "Yesterday";

    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Check whether a date separator should be shown between two messages.
 * Returns true if the two ISO timestamps fall on different calendar days,
 * or if `prevIso` is undefined (first message).
 */
export function shouldShowDateSeparator(
  prevIso: string | undefined,
  currentIso: string,
): boolean {
  if (!prevIso) return true;
  try {
    const prev = new Date(prevIso);
    const curr = new Date(currentIso);
    return (
      prev.getFullYear() !== curr.getFullYear() ||
      prev.getMonth() !== curr.getMonth() ||
      prev.getDate() !== curr.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Count words in a text string.
 * Splits on whitespace and filters out empty entries.
 */
export function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Estimate reading time in minutes for a given text.
 * Average reading speed: ~200 words per minute.
 */
export function estimateReadingTime(text: string): number {
  const words = countWords(text);
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Format a word/character count for display.
 * Returns a compact string like "42 words · 256 chars".
 */
export function formatTextStats(text: string): string {
  const words = countWords(text);
  const chars = text.length;
  return `${words} word${words !== 1 ? "s" : ""} · ${chars} char${chars !== 1 ? "s" : ""}`;
 * Format an ISO timestamp as a relative time string ("just now", "5m ago", "2h ago", "3d ago").
 */
export function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = Date.now();
    const diffMs = now - d.getTime();
    if (diffMs < 0) return "just now";

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;

    const years = Math.floor(months / 12);
    return `${years}y ago`;
  } catch {
    return "";
  }
}

/** Extract the @-mention query being typed at the cursor position. */
export function getMentionQuery(
  text: string,
  cursorPos: number,
): { query: string; start: number } | null {
  // Walk backwards from cursor to find the @ trigger
  const before = text.slice(0, cursorPos);
  const match = before.match(/@([\w-]*)$/);
  if (!match) return null;
  return { query: match[1].toLowerCase(), start: cursorPos - match[0].length };
}
