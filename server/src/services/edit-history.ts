/**
 * Message edit history — track previous versions of edited messages.
 */

import { sql } from "drizzle-orm";
import { getDb } from "../db/index";

export interface EditHistoryEntry {
  id: string;
  message_id: string;
  old_content: string;
  edited_at: string;
}

/**
 * Ensure the edit history table exists (auto-migration).
 */
export function ensureEditHistoryTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS message_edit_history (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    old_content TEXT NOT NULL,
    edited_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_edit_history_message ON message_edit_history(message_id)`);
}

/**
 * Log a message edit (save the old content before it's overwritten).
 */
export function logEdit(messageId: string, oldContent: string): EditHistoryEntry {
  const db = getDb();
  ensureEditHistoryTable();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.run(
    sql`INSERT INTO message_edit_history (id, message_id, old_content, edited_at)
        VALUES (${id}, ${messageId}, ${oldContent}, ${now})`
  );

  return { id, message_id: messageId, old_content: oldContent, edited_at: now };
}

/**
 * Get edit history for a message (oldest first).
 */
export function getEditHistory(messageId: string): EditHistoryEntry[] {
  const db = getDb();
  ensureEditHistoryTable();

  const rows = db.all(
    sql`SELECT id, message_id, old_content, edited_at
        FROM message_edit_history
        WHERE message_id = ${messageId}
        ORDER BY edited_at ASC`
  ) as any[];

  return rows.map((r) => ({
    id: r.id,
    message_id: r.message_id,
    old_content: r.old_content,
    edited_at: r.edited_at,
  }));
}
