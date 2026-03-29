/**
 * Message truncation utilities for collapsible long messages.
 *
 * Provides helpers to detect long messages and generate truncated previews,
 * useful for rendering "Show more" / "Show less" toggles in the message feed.
 */

/** Default character threshold for considering a message "long". */
export const DEFAULT_MAX_LENGTH = 500;

/** Default maximum number of lines before truncation. */
export const DEFAULT_MAX_LINES = 8;

/**
 * Check whether a message is considered "long" based on character count or line count.
 */
export function isLongMessage(
  content: string,
  opts?: { maxLength?: number; maxLines?: number },
): boolean {
  const maxLength = opts?.maxLength ?? DEFAULT_MAX_LENGTH;
  const maxLines = opts?.maxLines ?? DEFAULT_MAX_LINES;

  if (content.length > maxLength) return true;

  const lineCount = content.split("\n").length;
  if (lineCount > maxLines) return true;

  return false;
}

/**
 * Truncate a message to a preview, breaking at the nearest word boundary.
 * Returns the original content if it's not long enough to truncate.
 */
export function truncateMessage(
  content: string,
  opts?: { maxLength?: number; maxLines?: number; ellipsis?: string },
): { text: string; wasTruncated: boolean } {
  const maxLength = opts?.maxLength ?? DEFAULT_MAX_LENGTH;
  const maxLines = opts?.maxLines ?? DEFAULT_MAX_LINES;
  const ellipsis = opts?.ellipsis ?? "…";

  if (!isLongMessage(content, { maxLength, maxLines })) {
    return { text: content, wasTruncated: false };
  }

  // First, limit by lines
  const lines = content.split("\n");
  let truncated = lines.length > maxLines
    ? lines.slice(0, maxLines).join("\n")
    : content;

  // Then, limit by character count
  if (truncated.length > maxLength) {
    // Find the last space before maxLength to avoid cutting mid-word
    const lastSpace = truncated.lastIndexOf(" ", maxLength);
    const cutPoint = lastSpace > maxLength * 0.5 ? lastSpace : maxLength;
    truncated = truncated.slice(0, cutPoint).trimEnd();
  }

  return { text: truncated + ellipsis, wasTruncated: true };
}

/**
 * Get a short single-line preview of a message (useful for notifications, tooltips).
 * Strips newlines and limits to the given length.
 */
export function messagePreview(content: string, maxLength = 100): string {
  const oneLine = content.replace(/\n+/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  const lastSpace = oneLine.lastIndexOf(" ", maxLength);
  const cutPoint = lastSpace > maxLength * 0.5 ? lastSpace : maxLength;
  return oneLine.slice(0, cutPoint).trimEnd() + "…";
}
