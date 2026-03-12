/**
 * Channel engagement scoring — computes a 0-100 engagement score
 * based on message frequency, unique senders, reactions, and threads.
 *
 * Pure functions operating on provided data (no DB dependency).
 */

export interface EngagementInput {
  messageCount: number;
  uniqueSenders: number;
  reactionCount: number;
  threadCount: number;
  memberCount: number;
  daysSinceCreation: number;
}

export interface EngagementScore {
  score: number; // 0-100
  level: "dead" | "low" | "moderate" | "active" | "thriving";
  breakdown: {
    activity: number; // 0-30 points
    diversity: number; // 0-25 points
    interaction: number; // 0-25 points
    threading: number; // 0-20 points
  };
}

/** Compute engagement score for a channel. */
export function computeEngagement(input: EngagementInput): EngagementScore {
  const { messageCount, uniqueSenders, reactionCount, threadCount, memberCount, daysSinceCreation } = input;

  // Activity: messages per day, capped at 30 points
  const messagesPerDay = daysSinceCreation > 0 ? messageCount / daysSinceCreation : messageCount;
  const activity = Math.min(30, Math.round(messagesPerDay * 3));

  // Diversity: ratio of unique senders to members, capped at 25
  const diversity = memberCount > 0
    ? Math.min(25, Math.round((uniqueSenders / memberCount) * 25))
    : 0;

  // Interaction: reactions per message ratio, capped at 25
  const reactionRatio = messageCount > 0 ? reactionCount / messageCount : 0;
  const interaction = Math.min(25, Math.round(reactionRatio * 50));

  // Threading: thread ratio, capped at 20
  const threadRatio = messageCount > 0 ? threadCount / messageCount : 0;
  const threading = Math.min(20, Math.round(threadRatio * 100));

  const score = activity + diversity + interaction + threading;

  return {
    score,
    level: scoreToLevel(score),
    breakdown: { activity, diversity, interaction, threading },
  };
}

/** Map score to engagement level. */
export function scoreToLevel(score: number): EngagementScore["level"] {
  if (score <= 10) return "dead";
  if (score <= 30) return "low";
  if (score <= 60) return "moderate";
  if (score <= 85) return "active";
  return "thriving";
}

/** Format engagement score for display. */
export function formatEngagement(score: EngagementScore): string {
  const emoji = levelEmoji(score.level);
  return `${emoji} ${score.score}/100 (${score.level})`;
}

/** Get emoji for engagement level. */
export function levelEmoji(level: EngagementScore["level"]): string {
  switch (level) {
    case "dead": return "💀";
    case "low": return "😴";
    case "moderate": return "👍";
    case "active": return "🔥";
    case "thriving": return "🚀";
  }
}

/** Compare two channels by engagement. Returns positive if a > b. */
export function compareEngagement(a: EngagementScore, b: EngagementScore): number {
  return a.score - b.score;
}
