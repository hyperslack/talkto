/**
 * Thread subscriptions — follow/unfollow message threads.
 *
 * When a user subscribes to a thread (parent message), they can be
 * notified of new replies. Users are auto-subscribed when they reply.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface ThreadSubscription {
  user_id: string;
  message_id: string;
  subscribed_at: string;
}

/** Ensure the thread_subscriptions table exists. */
export function ensureThreadSubscriptionsTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS thread_subscriptions (
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    subscribed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, message_id)
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_thread_subs_message ON thread_subscriptions(message_id)`);
}

/** Subscribe a user to a thread. Returns true if newly subscribed. */
export function subscribeToThread(userId: string, messageId: string): boolean {
  const db = getDb();
  ensureThreadSubscriptionsTable();

  const existing = db.all(sql`SELECT 1 FROM thread_subscriptions
    WHERE user_id = ${userId} AND message_id = ${messageId}`);
  if (existing.length > 0) return false;

  const now = new Date().toISOString();
  db.run(sql`INSERT INTO thread_subscriptions (user_id, message_id, subscribed_at)
    VALUES (${userId}, ${messageId}, ${now})`);
  return true;
}

/** Unsubscribe a user from a thread. Returns true if was subscribed. */
export function unsubscribeFromThread(userId: string, messageId: string): boolean {
  const db = getDb();
  ensureThreadSubscriptionsTable();
  const result = db.run(sql`DELETE FROM thread_subscriptions
    WHERE user_id = ${userId} AND message_id = ${messageId}`);
  return (result as unknown as { changes: number }).changes > 0;
}

/** Get all subscribers for a thread. */
export function getThreadSubscribers(messageId: string): string[] {
  const db = getDb();
  ensureThreadSubscriptionsTable();
  const rows = db.all(sql`SELECT user_id FROM thread_subscriptions
    WHERE message_id = ${messageId}`) as Array<{ user_id: string }>;
  return rows.map((r) => r.user_id);
}

/** Get all threads a user is subscribed to. */
export function getUserThreadSubscriptions(userId: string): ThreadSubscription[] {
  const db = getDb();
  ensureThreadSubscriptionsTable();
  return db.all(sql`SELECT user_id, message_id, subscribed_at FROM thread_subscriptions
    WHERE user_id = ${userId} ORDER BY subscribed_at DESC`) as ThreadSubscription[];
}

/** Check if a user is subscribed to a thread. */
export function isSubscribedToThread(userId: string, messageId: string): boolean {
  const db = getDb();
  ensureThreadSubscriptionsTable();
  const rows = db.all(sql`SELECT 1 FROM thread_subscriptions
    WHERE user_id = ${userId} AND message_id = ${messageId}`);
  return rows.length > 0;
}
