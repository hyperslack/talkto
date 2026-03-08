/**
 * Mention count service — counts unread mentions for a user.
 */

import { eq, and, gt, like } from "drizzle-orm";
import { getDb } from "../db/index";
import { messages, channels, readReceipts } from "../db/schema";

export interface MentionCountResult {
  total_mentions: number;
  by_channel: Array<{
    channel_id: string;
    channel_name: string;
    mention_count: number;
  }>;
}

/**
 * Count unread mentions for a user across all workspace channels.
 * A mention is a message containing the user's name in the mentions JSON array.
 */
export function getUnreadMentionCount(
  userId: string,
  userName: string,
  workspaceId: string
): MentionCountResult {
  const db = getDb();

  // Get all channels in workspace
  const workspaceChannels = db
    .select({ id: channels.id, name: channels.name })
    .from(channels)
    .where(eq(channels.workspaceId, workspaceId))
    .all();

  const byChannel: MentionCountResult["by_channel"] = [];
  let total = 0;

  for (const ch of workspaceChannels) {
    // Get last read timestamp for this channel
    const receipt = db
      .select({ lastReadAt: readReceipts.lastReadAt })
      .from(readReceipts)
      .where(
        and(
          eq(readReceipts.userId, userId),
          eq(readReceipts.channelId, ch.id)
        )
      )
      .get();

    const lastRead = receipt?.lastReadAt ?? "1970-01-01T00:00:00.000Z";

    // Count messages after last read that mention this user
    const mentionMessages = db
      .select({ mentions: messages.mentions })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, ch.id),
          gt(messages.createdAt, lastRead)
        )
      )
      .all();

    const count = mentionMessages.filter((m) => {
      if (!m.mentions) return false;
      try {
        const arr = JSON.parse(m.mentions);
        return Array.isArray(arr) && arr.includes(userName);
      } catch {
        return false;
      }
    }).length;

    if (count > 0) {
      byChannel.push({
        channel_id: ch.id,
        channel_name: ch.name,
        mention_count: count,
      });
      total += count;
    }
  }

  return { total_mentions: total, by_channel: byChannel };
}
