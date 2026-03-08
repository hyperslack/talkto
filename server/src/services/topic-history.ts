/**
 * Channel topic history — track topic changes with who/when.
 *
 * Uses a new `channel_topic_history` table to log every topic change.
 */

import { eq, desc } from "drizzle-orm";
import { getDb } from "../db/index";
import { sql } from "drizzle-orm";

export interface TopicHistoryEntry {
  id: string;
  channel_id: string;
  old_topic: string | null;
  new_topic: string | null;
  changed_by: string;
  changed_by_name: string | null;
  changed_at: string;
}

/**
 * Ensure the topic history table exists (auto-migration).
 */
export function ensureTopicHistoryTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS channel_topic_history (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    old_topic TEXT,
    new_topic TEXT,
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_topic_history_channel ON channel_topic_history(channel_id)`);
}

/**
 * Log a topic change.
 */
export function logTopicChange(
  channelId: string,
  oldTopic: string | null,
  newTopic: string | null,
  changedBy: string
): TopicHistoryEntry {
  const db = getDb();
  ensureTopicHistoryTable();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.run(
    sql`INSERT INTO channel_topic_history (id, channel_id, old_topic, new_topic, changed_by, changed_at)
        VALUES (${id}, ${channelId}, ${oldTopic}, ${newTopic}, ${changedBy}, ${now})`
  );

  return {
    id,
    channel_id: channelId,
    old_topic: oldTopic,
    new_topic: newTopic,
    changed_by: changedBy,
    changed_by_name: null,
    changed_at: now,
  };
}

/**
 * Get topic change history for a channel.
 */
export function getTopicHistory(channelId: string, limit = 20): TopicHistoryEntry[] {
  const db = getDb();
  ensureTopicHistoryTable();

  const rows = db.all(
    sql`SELECT h.id, h.channel_id, h.old_topic, h.new_topic, h.changed_by, h.changed_at,
               COALESCE(u.display_name, u.name) as changed_by_name
        FROM channel_topic_history h
        LEFT JOIN users u ON h.changed_by = u.id
        WHERE h.channel_id = ${channelId}
        ORDER BY h.changed_at DESC
        LIMIT ${limit}`
  ) as any[];

  return rows.map((r) => ({
    id: r.id,
    channel_id: r.channel_id,
    old_topic: r.old_topic,
    new_topic: r.new_topic,
    changed_by: r.changed_by,
    changed_by_name: r.changed_by_name ?? null,
    changed_at: r.changed_at,
  }));
}
