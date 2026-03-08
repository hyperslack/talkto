/**
 * Channel message count — with optional date filters.
 */

import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getDb } from "../db/index";
import { messages } from "../db/schema";

export interface MessageCountResult {
  channel_id: string;
  total: number;
  after?: string;
  before?: string;
}

/**
 * Count messages in a channel, optionally filtered by date range.
 */
export function getChannelMessageCount(
  channelId: string,
  after?: string,
  before?: string
): MessageCountResult {
  const db = getDb();

  const conditions = [eq(messages.channelId, channelId)];
  if (after) conditions.push(gte(messages.createdAt, after));
  if (before) conditions.push(lte(messages.createdAt, before));

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(and(...conditions))
    .get();

  const response: MessageCountResult = {
    channel_id: channelId,
    total: Number(result?.count ?? 0),
  };
  if (after) response.after = after;
  if (before) response.before = before;

  return response;
}
