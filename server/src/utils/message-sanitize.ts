/** Message content sanitization utilities.
 *
 * Cleans up message content before storage:
 * - Trims leading/trailing whitespace
 * - Collapses excessive blank lines (max 2 consecutive)
 * - Removes null bytes and other control characters
 * - Enforces max length
 */

export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Sanitize message content for storage.
 */
export function sanitizeContent(raw: string): string {
  let text = raw;

  // Remove null bytes and most control chars (keep \n, \t)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Trim leading/trailing whitespace
  text = text.trim();

  // Collapse 3+ consecutive newlines into 2
  text = text.replace(/\n{3,}/g, "\n\n");

  // Enforce max length
  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_MESSAGE_LENGTH);
  }

  return text;
}

/**
 * Validate that content is non-empty after sanitization.
 */
export function isValidContent(content: string): boolean {
  return sanitizeContent(content).length > 0;
}
