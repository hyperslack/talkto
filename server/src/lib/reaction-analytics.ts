/**
 * Reaction analytics — compute per-user and per-channel emoji reaction
 * statistics for engagement insights and trending emojis.
 */

export interface ReactionData {
  emoji: string;
  userId: string;
  messageId: string;
  channelId: string;
  createdAt: string;
}

export interface EmojiRanking {
  emoji: string;
  count: number;
  percentage: number;
}

export interface UserReactionProfile {
  userId: string;
  totalReactions: number;
  uniqueEmojis: number;
  favoriteEmoji: string | null;
  topEmojis: EmojiRanking[];
  reactionsGiven: number;
  reactionsReceived: number;
}

export interface ChannelReactionSummary {
  channelId: string;
  totalReactions: number;
  uniqueEmojis: number;
  topEmojis: EmojiRanking[];
  mostReactedMessageId: string | null;
  avgReactionsPerMessage: number;
}

/**
 * Compute emoji rankings from a list of reactions.
 */
export function computeEmojiRankings(reactions: ReactionData[], limit: number = 10): EmojiRanking[] {
  const counts = new Map<string, number>();
  for (const r of reactions) {
    counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
  }

  const total = reactions.length || 1;
  return [...counts.entries()]
    .map(([emoji, count]) => ({
      emoji,
      count,
      percentage: Math.round((count / total) * 100 * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Build a reaction profile for a specific user.
 */
export function buildUserProfile(
  userId: string,
  givenReactions: ReactionData[],
  receivedReactions: ReactionData[]
): UserReactionProfile {
  const uniqueEmojis = new Set(givenReactions.map((r) => r.emoji)).size;
  const topEmojis = computeEmojiRankings(givenReactions, 5);

  return {
    userId,
    totalReactions: givenReactions.length + receivedReactions.length,
    uniqueEmojis,
    favoriteEmoji: topEmojis.length > 0 ? topEmojis[0].emoji : null,
    topEmojis,
    reactionsGiven: givenReactions.length,
    reactionsReceived: receivedReactions.length,
  };
}

/**
 * Build a reaction summary for a channel.
 */
export function buildChannelSummary(
  channelId: string,
  reactions: ReactionData[],
  messageCount: number
): ChannelReactionSummary {
  const channelReactions = reactions.filter((r) => r.channelId === channelId);
  const topEmojis = computeEmojiRankings(channelReactions, 10);
  const uniqueEmojis = new Set(channelReactions.map((r) => r.emoji)).size;

  // Find most reacted message
  const messageCounts = new Map<string, number>();
  for (const r of channelReactions) {
    messageCounts.set(r.messageId, (messageCounts.get(r.messageId) || 0) + 1);
  }
  let mostReactedMessageId: string | null = null;
  let maxCount = 0;
  for (const [msgId, count] of messageCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostReactedMessageId = msgId;
    }
  }

  return {
    channelId,
    totalReactions: channelReactions.length,
    uniqueEmojis,
    topEmojis,
    mostReactedMessageId,
    avgReactionsPerMessage: messageCount > 0 ? Math.round((channelReactions.length / messageCount) * 100) / 100 : 0,
  };
}

/**
 * Find trending emojis — emojis with increasing usage in recent period vs previous.
 */
export function findTrendingEmojis(
  recentReactions: ReactionData[],
  previousReactions: ReactionData[]
): Array<{ emoji: string; recentCount: number; previousCount: number; growth: number }> {
  const recentCounts = new Map<string, number>();
  const prevCounts = new Map<string, number>();

  for (const r of recentReactions) recentCounts.set(r.emoji, (recentCounts.get(r.emoji) || 0) + 1);
  for (const r of previousReactions) prevCounts.set(r.emoji, (prevCounts.get(r.emoji) || 0) + 1);

  const allEmojis = new Set([...recentCounts.keys(), ...prevCounts.keys()]);

  return [...allEmojis]
    .map((emoji) => {
      const recent = recentCounts.get(emoji) || 0;
      const previous = prevCounts.get(emoji) || 0;
      const growth = previous > 0 ? ((recent - previous) / previous) * 100 : recent > 0 ? 100 : 0;
      return { emoji, recentCount: recent, previousCount: previous, growth: Math.round(growth) };
    })
    .filter((e) => e.growth > 0)
    .sort((a, b) => b.growth - a.growth);
}

/**
 * Compute a "reaction diversity score" (0-100) based on emoji variety.
 * Higher = more diverse emoji usage.
 */
export function diversityScore(reactions: ReactionData[]): number {
  if (reactions.length === 0) return 0;
  const unique = new Set(reactions.map((r) => r.emoji)).size;
  // Shannon diversity normalized to 0-100
  const ratio = unique / reactions.length;
  return Math.round(Math.min(ratio * 200, 100));
}
