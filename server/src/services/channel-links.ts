/**
 * Channel links — extract all URLs shared in a channel.
 */

import { eq, desc } from "drizzle-orm";
import { getDb } from "../db/index";
import { messages, users } from "../db/schema";

export interface ChannelLink {
  url: string;
  message_id: string;
  sender_name: string;
  shared_at: string;
}

/** Extract URLs from a text string. */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  return [...new Set(text.match(urlRegex) ?? [])];
}

/**
 * Get all links shared in a channel, ordered by most recent.
 */
export function getChannelLinks(channelId: string, limit = 50): ChannelLink[] {
  const db = getDb();

  const rows = db
    .select({
      id: messages.id,
      content: messages.content,
      senderName: users.name,
      displayName: users.displayName,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.channelId, channelId))
    .orderBy(desc(messages.createdAt))
    .all();

  const links: ChannelLink[] = [];

  for (const row of rows) {
    const urls = extractUrls(row.content);
    for (const url of urls) {
      links.push({
        url,
        message_id: row.id,
        sender_name: row.displayName ?? row.senderName,
        shared_at: row.createdAt,
      });
      if (links.length >= limit) return links;
    }
  }

  return links;
}
