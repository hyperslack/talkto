/**
 * User block list — allows users to block other users.
 *
 * Blocked users' messages can be hidden client-side.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface UserBlock {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export function ensureBlocksTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id)`);
}

/** Block a user. Returns true if newly blocked, false if already blocked. */
export function blockUser(blockerId: string, blockedId: string): boolean {
  ensureBlocksTable();
  if (blockerId === blockedId) throw new Error("Cannot block yourself");
  const db = getDb();
  const existing = db.get<UserBlock>(sql`SELECT * FROM user_blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}`);
  if (existing) return false;
  const now = new Date().toISOString();
  db.run(sql`INSERT INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (${blockerId}, ${blockedId}, ${now})`);
  return true;
}

/** Unblock a user. Returns true if was blocked, false if wasn't. */
export function unblockUser(blockerId: string, blockedId: string): boolean {
  ensureBlocksTable();
  const db = getDb();
  const existing = db.get<UserBlock>(sql`SELECT * FROM user_blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}`);
  if (!existing) return false;
  db.run(sql`DELETE FROM user_blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}`);
  return true;
}

/** Check if a user is blocked. */
export function isBlocked(blockerId: string, blockedId: string): boolean {
  ensureBlocksTable();
  const db = getDb();
  const row = db.get<UserBlock>(sql`SELECT * FROM user_blocks WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}`);
  return !!row;
}

/** List all users blocked by a given user. */
export function listBlocked(blockerId: string): UserBlock[] {
  ensureBlocksTable();
  const db = getDb();
  return db.all<UserBlock>(sql`SELECT * FROM user_blocks WHERE blocker_id = ${blockerId} ORDER BY created_at DESC`);
}
