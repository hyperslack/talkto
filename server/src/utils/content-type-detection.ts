/**
 * Message content type detection — classifies message content for
 * optimized rendering (e.g., large emoji, code blocks, rich text).
 */

export type ContentType =
  | "text"           // Plain text
  | "emoji_only"     // Only emoji characters (render large)
  | "code_block"     // Contains fenced code blocks
  | "inline_code"    // Contains inline code only
  | "link_only"      // Just a URL (show link preview)
  | "mixed";         // Multiple content types

export interface ContentAnalysis {
  type: ContentType;
  hasCodeBlocks: boolean;
  hasInlineCode: boolean;
  hasLinks: boolean;
  hasMentions: boolean;
  hasEmoji: boolean;
  isShort: boolean;       // ≤ 50 chars
  lineCount: number;
  wordCount: number;
}

const EMOJI_REGEX = /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\u200D\s]+$/u;
const CODE_BLOCK_REGEX = /```[\s\S]*?```/;
const INLINE_CODE_REGEX = /`[^`]+`/;
const URL_REGEX = /https?:\/\/[^\s<]+/;
const MENTION_REGEX = /@[\w.-]+/;

/**
 * Analyze message content and determine its type for rendering.
 */
export function analyzeContent(content: string): ContentAnalysis {
  const trimmed = content.trim();

  const hasCodeBlocks = CODE_BLOCK_REGEX.test(trimmed);
  const hasInlineCode = !hasCodeBlocks && INLINE_CODE_REGEX.test(trimmed);
  const hasLinks = URL_REGEX.test(trimmed);
  const hasMentions = MENTION_REGEX.test(trimmed);
  const hasEmoji = containsEmoji(trimmed);
  const isShort = trimmed.length <= 50;
  const lineCount = trimmed === "" ? 0 : trimmed.split("\n").length;
  const wordCount = trimmed === "" ? 0 : trimmed.split(/\s+/).filter(Boolean).length;

  let type: ContentType = "text";

  if (trimmed.length === 0) {
    type = "text";
  } else if (isEmojiOnly(trimmed)) {
    type = "emoji_only";
  } else if (isLinkOnly(trimmed)) {
    type = "link_only";
  } else if (hasCodeBlocks) {
    type = "code_block";
  } else if (hasInlineCode && !hasLinks && !hasMentions && wordCount <= 3) {
    type = "inline_code";
  } else if ((hasCodeBlocks || hasInlineCode) && hasLinks) {
    type = "mixed";
  } else {
    type = "text";
  }

  return {
    type,
    hasCodeBlocks,
    hasInlineCode,
    hasLinks,
    hasMentions,
    hasEmoji,
    isShort,
    lineCount,
    wordCount,
  };
}

/**
 * Check if the content is emoji-only (renders large).
 */
export function isEmojiOnly(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) return false;
  // Must be short (≤ 8 emoji) and match emoji-only pattern
  const withoutSpaces = trimmed.replace(/\s/g, "");
  if (withoutSpaces.length > 32) return false; // Rough char limit for emoji
  return EMOJI_REGEX.test(trimmed);
}

/**
 * Check if the content is just a URL (for link previews).
 */
export function isLinkOnly(content: string): boolean {
  const trimmed = content.trim();
  return URL_REGEX.test(trimmed) && trimmed.split(/\s+/).length === 1;
}

/**
 * Check if content contains any emoji.
 */
function containsEmoji(content: string): boolean {
  return /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u.test(content);
}

/**
 * Get a suggested render mode based on content analysis.
 */
export function getRenderMode(content: string): "large_emoji" | "code" | "link_preview" | "default" {
  const analysis = analyzeContent(content);
  switch (analysis.type) {
    case "emoji_only": return "large_emoji";
    case "code_block": return "code";
    case "link_only": return "link_preview";
    default: return "default";
  }
}
