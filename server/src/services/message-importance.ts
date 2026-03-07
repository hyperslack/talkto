/**
 * Message importance markers — flag messages as important/urgent.
 *
 * Different from pinning: importance is per-user (only you see your important messages),
 * while pinning is channel-wide (everyone sees pinned messages).
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export type ImportanceLevel = "normal" | "important" | "urgent";

export interface MessageImportance {
  message_id: string;
  user_id: string;
  level: ImportanceLevel;
  note: string | null;
  created_at: string;
}

export function ensureImportanceTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS message_importance (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'important',
    note TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id)
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_importance_user ON message_importance(user_id)`);
}

/** Mark a message as important. */
export function markImportant(
  messageId: string,
  userId: string,
  level: ImportanceLevel = "important",
  note?: string | null,
): MessageImportance {
  ensureImportanceTable();
  if (!["normal", "important", "urgent"].includes(level)) {
    throw new Error("Level must be normal, important, or urgent");
  }
  if (note && note.length > 500) throw new Error("Note must be 500 characters or less");

  const db = getDb();
  const now = new Date().toISOString();

  // Upsert
  const existing = db.get<MessageImportance>(sql`SELECT * FROM message_importance WHERE message_id = ${messageId} AND user_id = ${userId}`);
  if (existing) {
    db.run(sql`UPDATE message_importance SET level = ${level}, note = ${note ?? null}, created_at = ${now} WHERE message_id = ${messageId} AND user_id = ${userId}`);
  } else {
    db.run(sql`INSERT INTO message_importance (message_id, user_id, level, note, created_at) VALUES (${messageId}, ${userId}, ${level}, ${note ?? null}, ${now})`);
  }

  return { message_id: messageId, user_id: userId, level, note: note ?? null, created_at: now };
}

/** Remove importance marker from a message. */
export function unmarkImportant(messageId: string, userId: string): boolean {
  ensureImportanceTable();
  const db = getDb();
  const existing = db.get<MessageImportance>(sql`SELECT * FROM message_importance WHERE message_id = ${messageId} AND user_id = ${userId}`);
  if (!existing) return false;
  db.run(sql`DELETE FROM message_importance WHERE message_id = ${messageId} AND user_id = ${userId}`);
  return true;
}

/** List all important messages for a user. */
export function listImportant(userId: string, level?: ImportanceLevel): MessageImportance[] {
  ensureImportanceTable();
  const db = getDb();
  if (level) {
    return db.all<MessageImportance>(sql`SELECT * FROM message_importance WHERE user_id = ${userId} AND level = ${level} ORDER BY created_at DESC`);
  }
  return db.all<MessageImportance>(sql`SELECT * FROM message_importance WHERE user_id = ${userId} ORDER BY created_at DESC`);
}
