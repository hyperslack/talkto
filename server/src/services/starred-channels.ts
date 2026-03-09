/**
 * Starred channels — per-user channel starring for quick access.
 *
 * Uses a simple table with composite PK (user_id, channel_id).
 */

import { sql } from "drizzle-orm";
import { getDb } from "../db";

/** Ensure the starred_channels table exists. */
export function ensureStarredChannelsTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS starred_channels (
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    starred_at TEXT NOT NULL,
    PRIMARY KEY (user_id, channel_id)
  )`);
}

/** Star a channel for a user. Returns true if newly starred, false if already starred. */
export function starChannel(userId: string, channelId: string): boolean {
  const db = getDb();
  ensureStarredChannelsTable();

  const existing = db.all(
    sql`SELECT 1 FROM starred_channels WHERE user_id = ${userId} AND channel_id = ${channelId}`
  );
  if (existing.length > 0) return false;

  db.run(
    sql`INSERT INTO starred_channels (user_id, channel_id, starred_at) VALUES (${userId}, ${channelId}, ${new Date().toISOString()})`
  );
  return true;
}

/** Unstar a channel for a user. Returns true if was starred, false if wasn't. */
export function unstarChannel(userId: string, channelId: string): boolean {
  const db = getDb();
  ensureStarredChannelsTable();

  const existing = db.all(
    sql`SELECT 1 FROM starred_channels WHERE user_id = ${userId} AND channel_id = ${channelId}`
  );
  if (existing.length === 0) return false;

  db.run(
    sql`DELETE FROM starred_channels WHERE user_id = ${userId} AND channel_id = ${channelId}`
  );
  return true;
}

/** Check if a channel is starred by a user. */
export function isChannelStarred(userId: string, channelId: string): boolean {
  const db = getDb();
  ensureStarredChannelsTable();

  const rows = db.all(
    sql`SELECT 1 FROM starred_channels WHERE user_id = ${userId} AND channel_id = ${channelId}`
  );
  return rows.length > 0;
}

/** List all starred channel IDs for a user, ordered by starred_at. */
export function listStarredChannels(userId: string): Array<{ channel_id: string; starred_at: string }> {
  const db = getDb();
  ensureStarredChannelsTable();

  return db.all(
    sql`SELECT channel_id, starred_at FROM starred_channels WHERE user_id = ${userId} ORDER BY starred_at ASC`
  ) as Array<{ channel_id: string; starred_at: string }>;
}
