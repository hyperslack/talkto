/**
 * Conversation summary utilities — extracts key metrics and patterns
 * from a sequence of messages for "catch-up" summaries.
 */

export interface MessageInput {
  id: string;
  senderId: string;
  senderName: string;
  senderType: "human" | "agent";
  content: string;
  createdAt: string;
  parentId?: string | null;
}

export interface ConversationSummary {
  messageCount: number;
  participantCount: number;
  participants: Array<{ name: string; type: string; messageCount: number }>;
  threadCount: number;
  timeSpanMinutes: number;
  topMentioned: string[];
  questionsAsked: number;
  codeBlockCount: number;
  linkCount: number;
  avgMessageLength: number;
}

/**
 * Analyze a sequence of messages and produce a catch-up summary.
 */
export function summarizeConversation(messages: MessageInput[]): ConversationSummary {
  if (messages.length === 0) {
    return {
      messageCount: 0, participantCount: 0, participants: [],
      threadCount: 0, timeSpanMinutes: 0, topMentioned: [],
      questionsAsked: 0, codeBlockCount: 0, linkCount: 0, avgMessageLength: 0,
    };
  }

  // Participants
  const participantMap = new Map<string, { name: string; type: string; count: number }>();
  for (const m of messages) {
    const p = participantMap.get(m.senderId) ?? { name: m.senderName, type: m.senderType, count: 0 };
    p.count++;
    participantMap.set(m.senderId, p);
  }

  // Threads (messages with parentId)
  const threadRoots = new Set<string>();
  for (const m of messages) {
    if (m.parentId) threadRoots.add(m.parentId);
  }

  // Time span
  const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const first = new Date(sorted[0].createdAt).getTime();
  const last = new Date(sorted[sorted.length - 1].createdAt).getTime();
  const timeSpanMinutes = Math.round((last - first) / 60_000);

  // Mentions (@name)
  const mentionCounts = new Map<string, number>();
  for (const m of messages) {
    const mentions = m.content.match(/@(\w+)/g) ?? [];
    for (const mention of mentions) {
      const name = mention.slice(1).toLowerCase();
      mentionCounts.set(name, (mentionCounts.get(name) ?? 0) + 1);
    }
  }
  const topMentioned = [...mentionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Questions
  let questionsAsked = 0;
  for (const m of messages) {
    if (m.content.includes("?")) questionsAsked++;
  }

  // Code blocks
  let codeBlockCount = 0;
  for (const m of messages) {
    const matches = m.content.match(/```/g);
    if (matches) codeBlockCount += Math.floor(matches.length / 2);
  }

  // Links
  let linkCount = 0;
  for (const m of messages) {
    const matches = m.content.match(/https?:\/\/\S+/g);
    if (matches) linkCount += matches.length;
  }

  // Average message length
  const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
  const avgMessageLength = Math.round(totalLength / messages.length);

  const participants = [...participantMap.values()]
    .map((p) => ({ name: p.name, type: p.type, messageCount: p.count }))
    .sort((a, b) => b.messageCount - a.messageCount);

  return {
    messageCount: messages.length,
    participantCount: participantMap.size,
    participants,
    threadCount: threadRoots.size,
    timeSpanMinutes,
    topMentioned,
    questionsAsked,
    codeBlockCount,
    linkCount,
    avgMessageLength,
  };
}

/**
 * Get a human-readable one-line summary.
 */
export function formatSummaryLine(summary: ConversationSummary): string {
  const parts: string[] = [];
  parts.push(`${summary.messageCount} messages`);
  parts.push(`${summary.participantCount} participants`);
  if (summary.threadCount > 0) parts.push(`${summary.threadCount} threads`);
  if (summary.timeSpanMinutes > 0) {
    if (summary.timeSpanMinutes < 60) {
      parts.push(`over ${summary.timeSpanMinutes}min`);
    } else {
      parts.push(`over ${Math.round(summary.timeSpanMinutes / 60)}h`);
    }
  }
  return parts.join(" · ");
}
