/**
 * Batch read mark — mark all channels as read at once.
 */

import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "../db/index";
import { channels, readReceipts } from "../db/schema";

export interface BatchReadResult {
  marked_count: number;
  timestamp: string;
}

/**
 * Mark all channels in a workspace as read for a user.
 */
export function markAllChannelsRead(userId: string, workspaceId: string): BatchReadResult {
  const db = getDb();
  const now = new Date().toISOString();

  // Get all non-archived channels in workspace
  const workspaceChannels = db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.workspaceId, workspaceId), eq(channels.isArchived, 0)))
    .all();

  let marked = 0;

  for (const ch of workspaceChannels) {
    // Upsert read receipt
    const existing = db
      .select()
      .from(readReceipts)
      .where(and(eq(readReceipts.userId, userId), eq(readReceipts.channelId, ch.id)))
      .get();

    if (existing) {
      db.update(readReceipts)
        .set({ lastReadAt: now })
        .where(and(eq(readReceipts.userId, userId), eq(readReceipts.channelId, ch.id)))
        .run();
    } else {
      db.insert(readReceipts)
        .values({ userId, channelId: ch.id, lastReadAt: now })
        .run();
    }
    marked++;
  }

  return { marked_count: marked, timestamp: now };
}
