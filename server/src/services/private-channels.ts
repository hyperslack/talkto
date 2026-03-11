/**
 * Private channel access control.
 *
 * Private channels are only visible/accessible to their members.
 * Uses the existing channel_members table for membership.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

/** Ensure the is_private column exists on channels. */
export function ensurePrivateColumnExists(): void {
  const db = getDb();
  try {
    db.run(sql`ALTER TABLE channels ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists
  }
}

/** Set a channel as private or public. */
export function setChannelPrivacy(channelId: string, isPrivate: boolean): void {
  const db = getDb();
  ensurePrivateColumnExists();
  db.run(sql`UPDATE channels SET is_private = ${isPrivate ? 1 : 0} WHERE id = ${channelId}`);
}

/** Check if a channel is private. */
export function isChannelPrivate(channelId: string): boolean {
  const db = getDb();
  ensurePrivateColumnExists();
  const row = db.all(sql`SELECT is_private FROM channels WHERE id = ${channelId}`) as Array<{ is_private: number }>;
  return row[0]?.is_private === 1;
}

/** Check if a user has access to a channel (always true for public channels). */
export function hasChannelAccess(channelId: string, userId: string): boolean {
  const db = getDb();
  ensurePrivateColumnExists();

  const channel = db.all(sql`SELECT is_private FROM channels WHERE id = ${channelId}`) as Array<{ is_private: number }>;
  if (!channel[0] || channel[0].is_private !== 1) return true; // public

  // Check channel_members
  const member = db.all(sql`SELECT 1 FROM channel_members
    WHERE channel_id = ${channelId} AND user_id = ${userId}`);
  return member.length > 0;
}

/** Add a user to a private channel. */
export function addPrivateChannelMember(channelId: string, userId: string): boolean {
  const db = getDb();
  const existing = db.all(sql`SELECT 1 FROM channel_members
    WHERE channel_id = ${channelId} AND user_id = ${userId}`);
  if (existing.length > 0) return false;

  const now = new Date().toISOString();
  db.run(sql`INSERT INTO channel_members (channel_id, user_id, joined_at)
    VALUES (${channelId}, ${userId}, ${now})`);
  return true;
}

/** Remove a user from a private channel. */
export function removePrivateChannelMember(channelId: string, userId: string): boolean {
  const db = getDb();
  const result = db.run(sql`DELETE FROM channel_members
    WHERE channel_id = ${channelId} AND user_id = ${userId}`);
  return (result as unknown as { changes: number }).changes > 0;
}
