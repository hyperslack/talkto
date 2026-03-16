/**
 * Message quoting utilities — format quoted replies with attribution.
 *
 * Supports creating blockquote-style quoted content with sender attribution,
 * truncation for long quotes, and extraction of quote metadata from messages.
 */

/** Maximum characters to include in a quote before truncating. */
export const MAX_QUOTE_LENGTH = 300;

/** Default truncation suffix. */
export const TRUNCATION_SUFFIX = "…";

export interface QuoteBlock {
  /** Original message ID being quoted. */
  originalMessageId: string;
  /** Display name of the original sender. */
  originalSender: string;
  /** Quoted content (may be truncated). */
  quotedContent: string;
  /** Whether the quote was truncated. */
  isTruncated: boolean;
  /** The user's reply text. */
  replyContent: string;
}

/**
 * Format a message as a blockquote with sender attribution.
 * Uses `> ` prefix (markdown blockquote style).
 */
export function formatQuote(
  senderName: string,
  content: string,
  maxLength: number = MAX_QUOTE_LENGTH
): string {
  const truncated = truncateQuote(content, maxLength);
  const lines = truncated.split("\n");
  const quoted = lines.map((line) => `> ${line}`).join("\n");
  return `> **${senderName}** wrote:\n${quoted}`;
}

/**
 * Build a full quoted reply message combining quote + reply.
 */
export function buildQuotedReply(
  senderName: string,
  originalContent: string,
  replyContent: string,
  maxLength: number = MAX_QUOTE_LENGTH
): string {
  const quote = formatQuote(senderName, originalContent, maxLength);
  return `${quote}\n\n${replyContent}`;
}

/**
 * Truncate content to maxLength, breaking at word boundary.
 */
export function truncateQuote(
  content: string,
  maxLength: number = MAX_QUOTE_LENGTH
): string {
  if (content.length <= maxLength) return content;

  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const breakPoint = lastSpace > maxLength * 0.5 ? lastSpace : maxLength;
  return truncated.slice(0, breakPoint) + TRUNCATION_SUFFIX;
}

/**
 * Check if a message contains a blockquote (starts with `> `).
 */
export function hasQuote(content: string): boolean {
  return /^>\s/m.test(content);
}

/**
 * Extract the reply portion from a quoted message (everything after the quote block).
 */
export function extractReply(content: string): string {
  const lines = content.split("\n");
  let lastQuoteLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("> ")) {
      lastQuoteLine = i;
    }
  }
  if (lastQuoteLine === -1) return content;

  const replyLines = lines.slice(lastQuoteLine + 1);
  // Skip leading blank lines after quote
  while (replyLines.length > 0 && replyLines[0].trim() === "") {
    replyLines.shift();
  }
  return replyLines.join("\n");
}

/**
 * Parse a QuoteBlock from formatted quoted reply content.
 */
export function parseQuoteBlock(content: string): QuoteBlock | null {
  const headerMatch = content.match(/^> \*\*(.+?)\*\* wrote:\n/);
  if (!headerMatch) return null;

  const senderName = headerMatch[1];
  const lines = content.split("\n");

  const quotedLines: string[] = [];
  let lastQuoteLine = 0;
  // Skip first line (header)
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith("> ")) {
      quotedLines.push(lines[i].slice(2));
      lastQuoteLine = i;
    } else {
      break;
    }
  }

  const quotedContent = quotedLines.join("\n");
  const isTruncated = quotedContent.endsWith(TRUNCATION_SUFFIX);

  const replyLines = lines.slice(lastQuoteLine + 1);
  while (replyLines.length > 0 && replyLines[0].trim() === "") {
    replyLines.shift();
  }
  const replyContent = replyLines.join("\n");

  return {
    originalMessageId: "", // Cannot determine from formatted text alone
    originalSender: senderName,
    quotedContent,
    isTruncated,
    replyContent,
  };
}

/**
 * Count the number of quote blocks in a message.
 */
export function countQuotes(content: string): number {
  const matches = content.match(/^> \*\*.+?\*\* wrote:/gm);
  return matches ? matches.length : 0;
}

/**
 * Strip all blockquotes from a message, leaving only the reply text.
 */
export function stripQuotes(content: string): string {
  const lines = content.split("\n");
  const nonQuoteLines = lines.filter((line) => !line.startsWith("> "));
  return nonQuoteLines.join("\n").trim();
}
