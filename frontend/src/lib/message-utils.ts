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
