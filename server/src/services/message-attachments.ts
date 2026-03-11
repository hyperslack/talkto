/**
 * Message attachments — metadata tracking for file attachments.
 *
 * Stores attachment metadata (URL, filename, mime type, size) per message.
 * Actual file storage is handled externally; this tracks references.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface Attachment {
  id: string;
  message_id: string;
  filename: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

/** Ensure the message_attachments table exists. */
export function ensureAttachmentsTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS message_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    mime_type TEXT,
    size_bytes INTEGER,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_attachments_message ON message_attachments(message_id)`);
}

/** Add an attachment to a message. */
export function addAttachment(
  messageId: string,
  filename: string,
  url: string,
  mimeType?: string | null,
  sizeBytes?: number | null
): Attachment {
  const db = getDb();
  ensureAttachmentsTable();

  if (!filename || filename.length > 255) {
    throw new Error("Filename must be 1-255 characters");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.run(sql`INSERT INTO message_attachments (id, message_id, filename, url, mime_type, size_bytes, created_at)
    VALUES (${id}, ${messageId}, ${filename}, ${url}, ${mimeType ?? null}, ${sizeBytes ?? null}, ${now})`);

  return {
    id,
    message_id: messageId,
    filename,
    url,
    mime_type: mimeType ?? null,
    size_bytes: sizeBytes ?? null,
    created_at: now,
  };
}

/** Get all attachments for a message. */
export function getMessageAttachments(messageId: string): Attachment[] {
  const db = getDb();
  ensureAttachmentsTable();
  return db.all(sql`SELECT id, message_id, filename, url, mime_type, size_bytes, created_at
    FROM message_attachments WHERE message_id = ${messageId}
    ORDER BY created_at ASC`) as Attachment[];
}

/** Get all attachments in a channel. */
export function getChannelAttachments(channelId: string, limit: number = 50): Attachment[] {
  const db = getDb();
  ensureAttachmentsTable();
  return db.all(sql`
    SELECT a.id, a.message_id, a.filename, a.url, a.mime_type, a.size_bytes, a.created_at
    FROM message_attachments a
    JOIN messages m ON a.message_id = m.id
    WHERE m.channel_id = ${channelId}
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `) as Attachment[];
}

/** Delete an attachment by ID. */
export function deleteAttachment(attachmentId: string): boolean {
  const db = getDb();
  ensureAttachmentsTable();
  const result = db.run(sql`DELETE FROM message_attachments WHERE id = ${attachmentId}`);
  return (result as unknown as { changes: number }).changes > 0;
}
