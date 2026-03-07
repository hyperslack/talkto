/**
 * Channel auto-archive — automatically archive channels after a period of inactivity.
 *
 * Configurable per-channel inactivity threshold. When the last message
 * in a channel is older than the threshold, the channel is auto-archived.
 */

import { getDb } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { channels, messages } from "../db/schema";

export interface AutoArchiveConfig {
  channel_id: string;
  inactive_days: number;
  enabled: boolean;
  created_at: string;
}

export function ensureAutoArchiveTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS channel_auto_archive (
    channel_id TEXT PRIMARY KEY,
    inactive_days INTEGER NOT NULL DEFAULT 30,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`);
}

/** Set auto-archive config for a channel. */
export function setAutoArchive(channelId: string, inactiveDays: number, enabled: boolean = true): AutoArchiveConfig {
  ensureAutoArchiveTable();
  if (inactiveDays < 1) throw new Error("Inactive days must be at least 1");
  if (inactiveDays > 365) throw new Error("Inactive days cannot exceed 365");

  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.get<AutoArchiveConfig>(sql`SELECT * FROM channel_auto_archive WHERE channel_id = ${channelId}`);
  if (existing) {
    db.run(sql`UPDATE channel_auto_archive SET inactive_days = ${inactiveDays}, enabled = ${enabled ? 1 : 0} WHERE channel_id = ${channelId}`);
  } else {
    db.run(sql`INSERT INTO channel_auto_archive (channel_id, inactive_days, enabled, created_at) VALUES (${channelId}, ${inactiveDays}, ${enabled ? 1 : 0}, ${now})`);
  }

  return { channel_id: channelId, inactive_days: inactiveDays, enabled, created_at: now };
}

/** Remove auto-archive config for a channel. */
export function removeAutoArchive(channelId: string): boolean {
  ensureAutoArchiveTable();
  const db = getDb();
  const existing = db.get<AutoArchiveConfig>(sql`SELECT * FROM channel_auto_archive WHERE channel_id = ${channelId}`);
  if (!existing) return false;
  db.run(sql`DELETE FROM channel_auto_archive WHERE channel_id = ${channelId}`);
  return true;
}

/** Get auto-archive config for a channel. */
export function getAutoArchiveConfig(channelId: string): AutoArchiveConfig | null {
  ensureAutoArchiveTable();
  const db = getDb();
  const row = db.get<any>(sql`SELECT * FROM channel_auto_archive WHERE channel_id = ${channelId}`);
  if (!row) return null;
  return { ...row, enabled: !!row.enabled };
}

/**
 * Run the auto-archive check. Archives channels that have been inactive
 * longer than their configured threshold.
 *
 * Returns list of channel IDs that were archived.
 */
export function runAutoArchive(workspaceId: string): string[] {
  ensureAutoArchiveTable();
  const db = getDb();
  const archived: string[] = [];

  // Get all enabled auto-archive configs
  const configs = db.all<any>(sql`SELECT * FROM channel_auto_archive WHERE enabled = 1`);

  for (const config of configs) {
    // Get the channel (must be in the right workspace and not already archived)
    const channel = db
      .select()
      .from(channels)
      .where(and(eq(channels.id, config.channel_id), eq(channels.workspaceId, workspaceId), eq(channels.isArchived, 0)))
      .get();

    if (!channel) continue;
    if (channel.type === "general") continue; // Never auto-archive #general

    // Find the last message in this channel
    const lastMsg = db.get<{ created_at: string }>(
      sql`SELECT created_at FROM messages WHERE channel_id = ${channel.id} ORDER BY created_at DESC LIMIT 1`
    );

    const cutoffMs = config.inactive_days * 24 * 60 * 60 * 1000;
    const lastActivityTime = lastMsg
      ? new Date(lastMsg.created_at).getTime()
      : new Date(channel.createdAt).getTime();

    if (Date.now() - lastActivityTime > cutoffMs) {
      const now = new Date().toISOString();
      db.update(channels)
        .set({ isArchived: 1, archivedAt: now })
        .where(eq(channels.id, channel.id))
        .run();
      archived.push(channel.id);
    }
  }

  return archived;
}
