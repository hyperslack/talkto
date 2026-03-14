/**
 * Message truncation utilities for previews and summaries.
 *
 * Handles smart truncation that respects word boundaries, code blocks,
 * and provides consistent preview text for channel lists and notifications.
 */

export interface TruncationResult {
  text: string;
  truncated: boolean;
  originalLength: number;
}

/**
 * Truncate message content at a word boundary.
 * Avoids cutting mid-word and appends ellipsis when truncated.
 */
export function truncateAtWord(content: string, maxLength: number = 100): TruncationResult {
  if (!content || content.length === 0) {
    return { text: "", truncated: false, originalLength: 0 };
  }

  const originalLength = content.length;

  if (originalLength <= maxLength) {
    return { text: content, truncated: false, originalLength };
  }

  // Find last space before maxLength
  const slice = content.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");

  const breakPoint = lastSpace > maxLength * 0.3 ? lastSpace : maxLength;
  const text = content.slice(0, breakPoint).trimEnd() + "…";

  return { text, truncated: true, originalLength };
}

/**
 * Strip code blocks from content for preview purposes.
 * Replaces fenced code blocks with [code] placeholder.
 */
export function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, "[code]").replace(/`[^`]+`/g, "[code]");
}

/**
 * Collapse whitespace (multiple newlines, spaces) for single-line preview.
 */
export function collapseWhitespace(content: string): string {
  return content.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Generate a clean preview string for notifications and channel lists.
 * Strips code blocks, collapses whitespace, truncates at word boundary.
 */
export function generatePreview(content: string, maxLength: number = 100): TruncationResult {
  const cleaned = collapseWhitespace(stripCodeBlocks(content));
  return truncateAtWord(cleaned, maxLength);
}

/**
 * Count lines in a message. Useful for "show more" UI decisions.
 */
export function countLines(content: string): number {
  if (!content) return 0;
  return content.split("\n").length;
}

/**
 * Check if a message should be collapsed in the UI (too long or too many lines).
 */
export function shouldCollapse(content: string, opts?: {
  maxLength?: number;
  maxLines?: number;
}): boolean {
  const maxLength = opts?.maxLength ?? 500;
  const maxLines = opts?.maxLines ?? 10;

  if (!content) return false;
  return content.length > maxLength || countLines(content) > maxLines;
}

/**
 * Extract the first line of content, suitable for thread preview.
 */
export function firstLine(content: string, maxLength: number = 80): string {
  if (!content) return "";
  const line = content.split("\n")[0].trim();
  if (line.length <= maxLength) return line;
  return truncateAtWord(line, maxLength).text;
}
