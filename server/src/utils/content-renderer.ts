/**
 * Message content renderer — transform raw message content for display.
 *
 * Handles markdown-lite formatting, emoji shortcodes, and content
 * type detection for rendering decisions.
 */

export interface ContentBlock {
  type: "text" | "code" | "mention" | "emoji" | "link";
  content: string;
  language?: string; // for code blocks
  url?: string; // for links
}

/** Detect if content contains code blocks. */
export function hasCodeBlock(content: string): boolean {
  return /```[\s\S]*?```/.test(content);
}

/** Detect if content contains inline code. */
export function hasInlineCode(content: string): boolean {
  return /`[^`]+`/.test(content);
}

/** Detect if content is a single emoji (or up to 3 emojis with no text). */
export function isEmojiOnly(content: string): boolean {
  const stripped = content.trim();
  // Match 1-3 emoji sequences
  const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F){1,3}$/u;
  return emojiRegex.test(stripped);
}

/** Detect if content is a single-line message. */
export function isSingleLine(content: string): boolean {
  return !content.includes("\n");
}

/** Count the number of lines in content. */
export function lineCount(content: string): number {
  if (content.length === 0) return 0;
  return content.split("\n").length;
}

/** Extract all URLs from content. */
export function extractUrls(content: string): string[] {
  const regex = /https?:\/\/[^\s<>)]+/g;
  return content.match(regex) ?? [];
}

/** Convert common text emoticons to emoji. */
export function convertEmoticons(content: string): string {
  const map: Record<string, string> = {
    ":)": "🙂",
    ":(": "😞",
    ":D": "😄",
    ";)": "😉",
    ":P": "😛",
    "<3": "❤️",
    ":O": "😮",
    ":/": "😕",
  };
  let result = content;
  for (const [emoticon, emoji] of Object.entries(map)) {
    // Only replace when surrounded by spaces or at boundaries
    const escaped = emoticon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(?<=^|\\s)${escaped}(?=$|\\s)`, "g"), emoji);
  }
  return result;
}

/** Estimate the rendering height class for a message. */
export function heightClass(content: string): "compact" | "normal" | "tall" {
  const lines = lineCount(content);
  if (lines <= 1 && content.length < 80) return "compact";
  if (lines <= 5) return "normal";
  return "tall";
}

/** Check if content looks like it should be collapsed (long code, etc). */
export function shouldCollapse(content: string, maxLines: number = 15): boolean {
  return lineCount(content) > maxLines;
}

/** Generate a plain-text preview of content (strip formatting). */
export function plainTextPreview(content: string, maxLength: number = 100): string {
  let plain = content
    .replace(/```[\s\S]*?```/g, "[code]") // code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/__([^_]+)__/g, "$1") // bold alt
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1") // italic alt
    .replace(/~~([^~]+)~~/g, "$1") // strikethrough
    .replace(/\n+/g, " ")
    .trim();
  if (plain.length > maxLength) {
    plain = plain.slice(0, maxLength - 3) + "...";
  }
  return plain;
}

/** Detect the primary content type. */
export function detectContentType(content: string): "emoji" | "code" | "link" | "text" {
  if (isEmojiOnly(content)) return "emoji";
  if (hasCodeBlock(content) && content.trim().startsWith("```")) return "code";
  const urls = extractUrls(content);
  if (urls.length > 0 && content.trim() === urls[0]) return "link";
  return "text";
}
