/**
 * Message delivery status tracking.
 *
 * Tracks whether a message was delivered to and seen by recipients.
 * Statuses: sent → delivered → seen
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export type DeliveryState = "sent" | "delivered" | "seen";

export interface DeliveryStatus {
  message_id: string;
  user_id: string;
  status: DeliveryState;
  delivered_at: string | null;
  seen_at: string | null;
}

export function ensureDeliveryStatusTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS message_delivery_status (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    delivered_at TEXT,
    seen_at TEXT,
    PRIMARY KEY (message_id, user_id)
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_delivery_message ON message_delivery_status(message_id)`);
}

/** Mark a message as delivered to a user. */
export function markDelivered(messageId: string, userId: string): DeliveryStatus {
  ensureDeliveryStatusTable();
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.get<DeliveryStatus>(
    sql`SELECT * FROM message_delivery_status WHERE message_id = ${messageId} AND user_id = ${userId}`
  );

  if (existing) {
    if (existing.status === "sent") {
      db.run(sql`UPDATE message_delivery_status SET status = 'delivered', delivered_at = ${now} WHERE message_id = ${messageId} AND user_id = ${userId}`);
    }
    return { ...existing, status: "delivered", delivered_at: now };
  }

  db.run(sql`INSERT INTO message_delivery_status (message_id, user_id, status, delivered_at) VALUES (${messageId}, ${userId}, 'delivered', ${now})`);
  return { message_id: messageId, user_id: userId, status: "delivered", delivered_at: now, seen_at: null };
}

/** Mark a message as seen by a user. */
export function markSeen(messageId: string, userId: string): DeliveryStatus {
  ensureDeliveryStatusTable();
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.get<DeliveryStatus>(
    sql`SELECT * FROM message_delivery_status WHERE message_id = ${messageId} AND user_id = ${userId}`
  );

  if (existing) {
    db.run(sql`UPDATE message_delivery_status SET status = 'seen', seen_at = ${now}, delivered_at = COALESCE(delivered_at, ${now}) WHERE message_id = ${messageId} AND user_id = ${userId}`);
    return { ...existing, status: "seen", seen_at: now, delivered_at: existing.delivered_at ?? now };
  }

  db.run(sql`INSERT INTO message_delivery_status (message_id, user_id, status, delivered_at, seen_at) VALUES (${messageId}, ${userId}, 'seen', ${now}, ${now})`);
  return { message_id: messageId, user_id: userId, status: "seen", delivered_at: now, seen_at: now };
}

/** Get delivery status for a message across all recipients. */
export function getMessageDeliveryStatus(messageId: string): DeliveryStatus[] {
  ensureDeliveryStatusTable();
  const db = getDb();
  return db.all<DeliveryStatus>(
    sql`SELECT * FROM message_delivery_status WHERE message_id = ${messageId}`
  );
}

/** Get delivery summary counts for a message. */
export function getDeliverySummary(messageId: string): { sent: number; delivered: number; seen: number } {
  ensureDeliveryStatusTable();
  const db = getDb();
  const rows = db.all<{ status: string; count: number }>(
    sql`SELECT status, COUNT(*) as count FROM message_delivery_status WHERE message_id = ${messageId} GROUP BY status`
  );
  const summary = { sent: 0, delivered: 0, seen: 0 };
  for (const row of rows) {
    if (row.status in summary) {
      summary[row.status as DeliveryState] = row.count;
    }
  }
  return summary;
}
