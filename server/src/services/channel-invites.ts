/**
 * Channel invite links — generate shareable invite tokens for specific channels.
 *
 * Different from workspace invites: these add users to a specific channel.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface ChannelInvite {
  id: string;
  channel_id: string;
  token: string;
  created_by: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
}

/** Ensure the channel_invites table exists. */
export function ensureChannelInvitesTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS channel_invites (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    max_uses INTEGER,
    use_count INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_channel_invites_token ON channel_invites(token)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_channel_invites_channel ON channel_invites(channel_id)`);
}

/** Generate a random invite token. */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "ch_";
  for (let i = 0; i < 16; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/** Create a channel invite link. */
export function createChannelInvite(
  channelId: string,
  createdBy: string,
  options?: { maxUses?: number; expiresInHours?: number }
): ChannelInvite {
  const db = getDb();
  ensureChannelInvitesTable();

  const id = crypto.randomUUID();
  const token = generateToken();
  const now = new Date().toISOString();
  const expiresAt = options?.expiresInHours
    ? new Date(Date.now() + options.expiresInHours * 3600_000).toISOString()
    : null;

  db.run(sql`INSERT INTO channel_invites (id, channel_id, token, created_by, max_uses, use_count, expires_at, created_at)
    VALUES (${id}, ${channelId}, ${token}, ${createdBy}, ${options?.maxUses ?? null}, ${0}, ${expiresAt}, ${now})`);

  return {
    id,
    channel_id: channelId,
    token,
    created_by: createdBy,
    max_uses: options?.maxUses ?? null,
    use_count: 0,
    expires_at: expiresAt,
    created_at: now,
  };
}

/** Get all invites for a channel. */
export function getChannelInvites(channelId: string): ChannelInvite[] {
  const db = getDb();
  ensureChannelInvitesTable();
  return db.all(sql`SELECT id, channel_id, token, created_by, max_uses, use_count, expires_at, created_at
    FROM channel_invites WHERE channel_id = ${channelId}
    ORDER BY created_at DESC`) as ChannelInvite[];
}

/** Validate and use an invite token. Returns channel_id if valid. */
export function useChannelInvite(token: string): string | null {
  const db = getDb();
  ensureChannelInvitesTable();

  const invite = (db.all(sql`SELECT id, channel_id, max_uses, use_count, expires_at
    FROM channel_invites WHERE token = ${token}`) as any[])[0];

  if (!invite) return null;
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) return null;

  db.run(sql`UPDATE channel_invites SET use_count = use_count + 1 WHERE id = ${invite.id}`);
  return invite.channel_id;
}

/** Revoke (delete) a channel invite. */
export function revokeChannelInvite(inviteId: string, channelId: string): boolean {
  const db = getDb();
  ensureChannelInvitesTable();
  const result = db.run(sql`DELETE FROM channel_invites WHERE id = ${inviteId} AND channel_id = ${channelId}`);
  return (result as unknown as { changes: number }).changes > 0;
}
