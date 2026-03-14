/**
 * Channel activity digest utilities.
 *
 * Generates human-readable activity summaries for channels, useful for
 * daily/weekly digest emails or catch-up views.
 */

export interface DigestMessage {
  senderName: string;
  senderType: "human" | "agent";
  content: string;
  createdAt: string;
  hasThread: boolean;
  isPinned: boolean;
}

export interface ChannelDigest {
  channelName: string;
  period: string; // e.g. "last 24 hours"
  messageCount: number;
  uniqueSenders: string[];
  humanMessages: number;
  agentMessages: number;
  pinnedCount: number;
  threadCount: number;
  topSenders: Array<{ name: string; count: number }>;
  highlights: string[]; // notable messages (pinned or with many threads)
}

/**
 * Build a digest from channel messages.
 */
export function buildDigest(
  channelName: string,
  messages: DigestMessage[],
  period: string = "last 24 hours"
): ChannelDigest {
  const senderCounts = new Map<string, number>();
  let humanMessages = 0;
  let agentMessages = 0;
  let pinnedCount = 0;
  let threadCount = 0;
  const highlights: string[] = [];

  for (const msg of messages) {
    senderCounts.set(msg.senderName, (senderCounts.get(msg.senderName) ?? 0) + 1);
    if (msg.senderType === "human") humanMessages++;
    else agentMessages++;
    if (msg.isPinned) {
      pinnedCount++;
      highlights.push(`📌 ${msg.senderName}: ${truncate(msg.content, 80)}`);
    }
    if (msg.hasThread) threadCount++;
  }

  const topSenders = Array.from(senderCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    channelName,
    period,
    messageCount: messages.length,
    uniqueSenders: Array.from(senderCounts.keys()),
    humanMessages,
    agentMessages,
    pinnedCount,
    threadCount,
    topSenders,
    highlights,
  };
}

/**
 * Format a digest as a readable text summary.
 */
export function formatDigest(digest: ChannelDigest): string {
  const lines: string[] = [];
  lines.push(`📊 #${digest.channelName} — ${digest.period}`);
  lines.push(`${digest.messageCount} messages from ${digest.uniqueSenders.length} people`);

  if (digest.humanMessages > 0 || digest.agentMessages > 0) {
    lines.push(`  👤 ${digest.humanMessages} human · 🤖 ${digest.agentMessages} agent`);
  }

  if (digest.threadCount > 0) {
    lines.push(`  🧵 ${digest.threadCount} threads`);
  }

  if (digest.topSenders.length > 0) {
    const top = digest.topSenders.slice(0, 3).map((s) => `${s.name} (${s.count})`).join(", ");
    lines.push(`  🏆 Top: ${top}`);
  }

  if (digest.highlights.length > 0) {
    lines.push("  Highlights:");
    for (const h of digest.highlights.slice(0, 3)) {
      lines.push(`    ${h}`);
    }
  }

  return lines.join("\n");
}

/**
 * Determine the activity level label for a digest.
 */
export function activityLevel(messageCount: number): string {
  if (messageCount === 0) return "silent";
  if (messageCount <= 5) return "quiet";
  if (messageCount <= 20) return "moderate";
  if (messageCount <= 50) return "active";
  return "very active";
}

/**
 * Compare two digests and return a delta summary.
 */
export function comparePeriods(
  current: ChannelDigest,
  previous: ChannelDigest
): { messageDelta: number; senderDelta: number; trend: "up" | "down" | "flat" } {
  const messageDelta = current.messageCount - previous.messageCount;
  const senderDelta = current.uniqueSenders.length - previous.uniqueSenders.length;
  const trend = messageDelta > 0 ? "up" : messageDelta < 0 ? "down" : "flat";
  return { messageDelta, senderDelta, trend };
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + "…";
}
