/**
 * Reaction summary utilities — aggregate and analyze emoji reactions.
 *
 * Provides tools for ranking reactions, computing engagement metrics,
 * and formatting reaction displays.
 */

export interface ReactionData {
  messageId: string;
  emoji: string;
  userId: string;
  userName: string;
}

export interface EmojiSummary {
  emoji: string;
  count: number;
  users: string[];
}

export interface MessageReactionSummary {
  messageId: string;
  totalReactions: number;
  uniqueReactors: number;
  emojis: EmojiSummary[];
}

/** Summarize reactions for a single message. */
export function summarizeMessage(reactions: ReactionData[]): MessageReactionSummary {
  const messageId = reactions[0]?.messageId ?? "";
  const emojiMap = new Map<string, string[]>();
  const reactors = new Set<string>();

  for (const r of reactions) {
    reactors.add(r.userId);
    const users = emojiMap.get(r.emoji) ?? [];
    users.push(r.userName);
    emojiMap.set(r.emoji, users);
  }

  const emojis: EmojiSummary[] = [];
  for (const [emoji, users] of emojiMap) {
    emojis.push({ emoji, count: users.length, users });
  }
  emojis.sort((a, b) => b.count - a.count);

  return {
    messageId,
    totalReactions: reactions.length,
    uniqueReactors: reactors.size,
    emojis,
  };
}

/** Rank emojis by total usage across multiple messages. */
export function rankEmojis(reactions: ReactionData[]): EmojiSummary[] {
  const map = new Map<string, Set<string>>();
  for (const r of reactions) {
    const set = map.get(r.emoji) ?? new Set();
    set.add(r.userName);
    map.set(r.emoji, set);
  }
  const result: EmojiSummary[] = [];
  for (const [emoji, userSet] of map) {
    result.push({ emoji, count: userSet.size, users: [...userSet] });
  }
  return result.sort((a, b) => b.count - a.count);
}

/** Get the top N most-reacted messages. */
export function topReactedMessages(reactions: ReactionData[], limit: number = 5): { messageId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.messageId, (counts.get(r.messageId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([messageId, count]) => ({ messageId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Format a reaction summary as compact text (e.g., "👍 3  🔥 2  ❤️ 1"). */
export function formatCompact(summary: MessageReactionSummary): string {
  return summary.emojis.map((e) => `${e.emoji} ${e.count}`).join("  ");
}

/** Get the most popular emoji from a set of reactions. */
export function mostPopularEmoji(reactions: ReactionData[]): string | null {
  if (reactions.length === 0) return null;
  const ranked = rankEmojis(reactions);
  return ranked[0]?.emoji ?? null;
}

/** Count unique users who reacted across all messages. */
export function uniqueReactorCount(reactions: ReactionData[]): number {
  return new Set(reactions.map((r) => r.userId)).size;
}
