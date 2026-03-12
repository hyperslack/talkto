/**
 * Channel access log — records join/leave/kick events per channel.
 *
 * Uses a dedicated SQLite table for persistent tracking.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export type AccessAction = "join" | "leave" | "kick" | "invite";

export interface AccessLogEntry {
  id: string;
  channel_id: string;
  user_id: string;
  action: AccessAction;
  performed_by: string | null;
  created_at: string;
}

/** Ensure the channel_access_log table exists. */
export function ensureAccessLogTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS channel_access_log (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    performed_by TEXT,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_access_log_channel ON channel_access_log(channel_id, created_at)`);
}

/** Record a channel access event. */
export function logAccess(
  channelId: string,
  userId: string,
  action: AccessAction,
  performedBy: string | null = null,
): AccessLogEntry {
  const db = getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.run(sql`INSERT INTO channel_access_log (id, channel_id, user_id, action, performed_by, created_at)
    VALUES (${id}, ${channelId}, ${userId}, ${action}, ${performedBy}, ${createdAt})`);

  return { id, channel_id: channelId, user_id: userId, action, performed_by: performedBy, created_at: createdAt };
}

/** Get access log for a channel, newest first. */
export function getAccessLog(channelId: string, limit: number = 50): AccessLogEntry[] {
  const db = getDb();
  const rows = db.all<AccessLogEntry>(
    sql`SELECT id, channel_id, user_id, action, performed_by, created_at
        FROM channel_access_log
        WHERE channel_id = ${channelId}
        ORDER BY created_at DESC
        LIMIT ${limit}`,
  );
  return rows;
}

/** Get access log entries for a specific user across all channels. */
export function getUserAccessLog(userId: string, limit: number = 50): AccessLogEntry[] {
  const db = getDb();
  return db.all<AccessLogEntry>(
    sql`SELECT id, channel_id, user_id, action, performed_by, created_at
        FROM channel_access_log
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}`,
  );
}

/** Count events by action type for a channel. */
export function countByAction(channelId: string): Record<AccessAction, number> {
  const db = getDb();
  const rows = db.all<{ action: string; count: number }>(
    sql`SELECT action, COUNT(*) as count FROM channel_access_log WHERE channel_id = ${channelId} GROUP BY action`,
  );
  const result: Record<string, number> = { join: 0, leave: 0, kick: 0, invite: 0 };
  for (const row of rows) {
    result[row.action] = row.count;
  }
  return result as Record<AccessAction, number>;
}
