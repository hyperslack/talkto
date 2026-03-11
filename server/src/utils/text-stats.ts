/**
 * Text statistics utilities for message content analysis.
 *
 * Provides word frequency, average message length, and vocabulary analysis.
 */

export interface TextStats {
  total_messages: number;
  total_words: number;
  total_characters: number;
  avg_words_per_message: number;
  avg_chars_per_message: number;
  unique_words: number;
  top_words: Array<{ word: string; count: number }>;
}

/**
 * Compute text statistics from an array of message contents.
 */
export function computeTextStats(contents: string[], topN: number = 20): TextStats {
  const wordFreq = new Map<string, number>();
  let totalWords = 0;
  let totalChars = 0;

  for (const content of contents) {
    totalChars += content.length;
    const words = content
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    totalWords += words.length;
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
  }

  // Sort by frequency descending, take top N
  const topWords = Array.from(wordFreq.entries())
    .filter(([word]) => word.length > 2) // skip very short words
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));

  const n = contents.length || 1;

  return {
    total_messages: contents.length,
    total_words: totalWords,
    total_characters: totalChars,
    avg_words_per_message: Math.round((totalWords / n) * 10) / 10,
    avg_chars_per_message: Math.round((totalChars / n) * 10) / 10,
    unique_words: wordFreq.size,
    top_words: topWords,
  };
}

/**
 * Extract emoji from text content.
 */
export function extractEmoji(content: string): string[] {
  const emojiRe = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  return Array.from(content.matchAll(emojiRe)).map((m) => m[0]);
}

/**
 * Count total emoji usage across messages.
 */
export function countEmojiUsage(contents: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of contents) {
    for (const emoji of extractEmoji(c)) {
      counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
    }
  }
  return counts;
}
