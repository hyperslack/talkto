/**
 * Channel member limits — restrict the maximum number of members in a channel.
 *
 * Uses a separate table to store limits (avoids schema migration on channels).
 * No limit entry = unlimited members.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface ChannelMemberLimit {
  channel_id: string;
  max_members: number;
  updated_at: string;
}

export function ensureMemberLimitTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS channel_member_limits (
    channel_id TEXT PRIMARY KEY,
    max_members INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`);
}

/** Set the member limit for a channel. Pass null to remove the limit. */
export function setMemberLimit(channelId: string, maxMembers: number | null): ChannelMemberLimit | null {
  ensureMemberLimitTable();
  const db = getDb();
  const now = new Date().toISOString();

  if (maxMembers === null) {
    db.run(sql`DELETE FROM channel_member_limits WHERE channel_id = ${channelId}`);
    return null;
  }

  if (maxMembers < 1) throw new Error("Max members must be at least 1");
  if (maxMembers > 10000) throw new Error("Max members cannot exceed 10000");

  const existing = db.get<ChannelMemberLimit>(sql`SELECT * FROM channel_member_limits WHERE channel_id = ${channelId}`);
  if (existing) {
    db.run(sql`UPDATE channel_member_limits SET max_members = ${maxMembers}, updated_at = ${now} WHERE channel_id = ${channelId}`);
  } else {
    db.run(sql`INSERT INTO channel_member_limits (channel_id, max_members, updated_at) VALUES (${channelId}, ${maxMembers}, ${now})`);
  }

  return { channel_id: channelId, max_members: maxMembers, updated_at: now };
}

/** Get the member limit for a channel. Returns null if no limit is set. */
export function getMemberLimit(channelId: string): number | null {
  ensureMemberLimitTable();
  const db = getDb();
  const row = db.get<ChannelMemberLimit>(sql`SELECT * FROM channel_member_limits WHERE channel_id = ${channelId}`);
  return row?.max_members ?? null;
}

/** Check if a channel can accept more members. */
export function canAddMember(channelId: string): boolean {
  const limit = getMemberLimit(channelId);
  if (limit === null) return true; // No limit

  const db = getDb();
  const count = db.get<{ count: number }>(sql`SELECT COUNT(*) as count FROM channel_members WHERE channel_id = ${channelId}`);
  return (count?.count ?? 0) < limit;
}
