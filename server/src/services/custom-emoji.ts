/**
 * Custom emoji registry — workspace-scoped custom emoji management.
 *
 * Allows workspaces to define custom emoji with shortcodes and image URLs.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface CustomEmoji {
  id: string;
  workspace_id: string;
  shortcode: string;
  image_url: string;
  created_by: string;
  created_at: string;
}

/** Ensure the custom_emoji table exists (auto-migration). */
export function ensureCustomEmojiTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS custom_emoji (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    shortcode TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(workspace_id, shortcode)
  )`);
}

/** Add a custom emoji to a workspace. */
export function addCustomEmoji(
  workspaceId: string,
  shortcode: string,
  imageUrl: string,
  createdBy: string
): CustomEmoji {
  const db = getDb();
  ensureCustomEmojiTable();

  const normalized = shortcode.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!normalized || normalized.length > 32) {
    throw new Error("Shortcode must be 1-32 alphanumeric/underscore/hyphen characters");
  }

  const existing = db.all(sql`SELECT id FROM custom_emoji WHERE workspace_id = ${workspaceId} AND shortcode = ${normalized}`);
  if (existing.length > 0) {
    throw new Error("Shortcode already exists in this workspace");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.run(sql`INSERT INTO custom_emoji (id, workspace_id, shortcode, image_url, created_by, created_at)
    VALUES (${id}, ${workspaceId}, ${normalized}, ${imageUrl}, ${createdBy}, ${now})`);

  return { id, workspace_id: workspaceId, shortcode: normalized, image_url: imageUrl, created_by: createdBy, created_at: now };
}

/** List all custom emoji in a workspace. */
export function listCustomEmoji(workspaceId: string): CustomEmoji[] {
  const db = getDb();
  ensureCustomEmojiTable();
  return db.all(sql`SELECT id, workspace_id, shortcode, image_url, created_by, created_at
    FROM custom_emoji WHERE workspace_id = ${workspaceId} ORDER BY shortcode ASC`) as CustomEmoji[];
}

/** Delete a custom emoji by ID. */
export function deleteCustomEmoji(workspaceId: string, emojiId: string): boolean {
  const db = getDb();
  ensureCustomEmojiTable();
  const result = db.run(sql`DELETE FROM custom_emoji WHERE id = ${emojiId} AND workspace_id = ${workspaceId}`);
  return (result as unknown as { changes: number }).changes > 0;
}

/** Get a single custom emoji by shortcode. */
export function getCustomEmojiByShortcode(workspaceId: string, shortcode: string): CustomEmoji | null {
  const db = getDb();
  ensureCustomEmojiTable();
  const rows = db.all(sql`SELECT id, workspace_id, shortcode, image_url, created_by, created_at
    FROM custom_emoji WHERE workspace_id = ${workspaceId} AND shortcode = ${shortcode}`) as CustomEmoji[];
  return rows[0] ?? null;
}
