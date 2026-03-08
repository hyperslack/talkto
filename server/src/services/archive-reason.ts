/**
 * Channel archive reason — store why a channel was archived.
 */

import { sql } from "drizzle-orm";
import { getDb } from "../db/index";

export interface ArchiveReasonEntry {
  channel_id: string;
  reason: string | null;
  archived_by: string | null;
  archived_at: string;
}

/**
 * Ensure the archive reasons table exists (auto-migration).
 */
export function ensureArchiveReasonTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS channel_archive_reasons (
    channel_id TEXT PRIMARY KEY,
    reason TEXT,
    archived_by TEXT,
    archived_at TEXT NOT NULL
  )`);
}

/**
 * Set archive reason for a channel.
 */
export function setArchiveReason(
  channelId: string,
  reason: string | null,
  archivedBy: string | null
): ArchiveReasonEntry {
  const db = getDb();
  ensureArchiveReasonTable();

  const now = new Date().toISOString();

  // Upsert
  db.run(
    sql`INSERT INTO channel_archive_reasons (channel_id, reason, archived_by, archived_at)
        VALUES (${channelId}, ${reason}, ${archivedBy}, ${now})
        ON CONFLICT(channel_id) DO UPDATE SET reason = ${reason}, archived_by = ${archivedBy}, archived_at = ${now}`
  );

  return { channel_id: channelId, reason, archived_by: archivedBy, archived_at: now };
}

/**
 * Get archive reason for a channel.
 */
export function getArchiveReason(channelId: string): ArchiveReasonEntry | null {
  const db = getDb();
  ensureArchiveReasonTable();

  const row = db.get(
    sql`SELECT channel_id, reason, archived_by, archived_at
        FROM channel_archive_reasons
        WHERE channel_id = ${channelId}`
  ) as any;

  if (!row) return null;

  return {
    channel_id: row.channel_id,
    reason: row.reason,
    archived_by: row.archived_by,
    archived_at: row.archived_at,
  };
}

/**
 * Remove archive reason (when channel is unarchived).
 */
export function clearArchiveReason(channelId: string): void {
  const db = getDb();
  ensureArchiveReasonTable();
  db.run(sql`DELETE FROM channel_archive_reasons WHERE channel_id = ${channelId}`);
}
