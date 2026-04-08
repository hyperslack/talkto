/** Mention token extraction for composer helpers. */
export function extractMentionTokens(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_-]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}
