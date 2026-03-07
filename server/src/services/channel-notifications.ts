/**
 * Per-channel notification level preferences.
 *
 * Levels:
 * - "all": notify on every message
 * - "mentions": only when @mentioned
 * - "none": muted (no notifications)
 *
 * Different from channel mute (PR #55) which is a simple boolean.
 * This provides granular control over notification behavior.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export type NotificationLevel = "all" | "mentions" | "none";

export interface ChannelNotificationPref {
  user_id: string;
  channel_id: string;
  level: NotificationLevel;
  updated_at: string;
}

export function ensureNotificationPrefsTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS channel_notification_prefs (
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'all',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, channel_id)
  )`);
}

/** Set notification level for a user in a channel. */
export function setNotificationLevel(
  userId: string,
  channelId: string,
  level: NotificationLevel,
): ChannelNotificationPref {
  ensureNotificationPrefsTable();
  if (!["all", "mentions", "none"].includes(level)) {
    throw new Error("Level must be all, mentions, or none");
  }
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.get<ChannelNotificationPref>(
    sql`SELECT * FROM channel_notification_prefs WHERE user_id = ${userId} AND channel_id = ${channelId}`
  );
  if (existing) {
    db.run(sql`UPDATE channel_notification_prefs SET level = ${level}, updated_at = ${now} WHERE user_id = ${userId} AND channel_id = ${channelId}`);
  } else {
    db.run(sql`INSERT INTO channel_notification_prefs (user_id, channel_id, level, updated_at) VALUES (${userId}, ${channelId}, ${level}, ${now})`);
  }

  return { user_id: userId, channel_id: channelId, level, updated_at: now };
}

/** Get notification level for a user in a channel. Defaults to "all". */
export function getNotificationLevel(userId: string, channelId: string): NotificationLevel {
  ensureNotificationPrefsTable();
  const db = getDb();
  const row = db.get<ChannelNotificationPref>(
    sql`SELECT * FROM channel_notification_prefs WHERE user_id = ${userId} AND channel_id = ${channelId}`
  );
  return (row?.level as NotificationLevel) ?? "all";
}

/** List all notification preferences for a user. */
export function listNotificationPrefs(userId: string): ChannelNotificationPref[] {
  ensureNotificationPrefsTable();
  const db = getDb();
  return db.all<ChannelNotificationPref>(
    sql`SELECT * FROM channel_notification_prefs WHERE user_id = ${userId} ORDER BY updated_at DESC`
  );
}

/** Check if a user should be notified for a message in a channel. */
export function shouldNotify(userId: string, channelId: string, isMentioned: boolean): boolean {
  const level = getNotificationLevel(userId, channelId);
  if (level === "all") return true;
  if (level === "mentions") return isMentioned;
  return false; // "none"
}
