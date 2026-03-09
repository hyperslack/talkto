/**
 * Saved reply templates — reusable message snippets for quick responses.
 *
 * Templates are per-user and workspace-scoped.
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReplyTemplate {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  content: string;
  shortcut: string | null;
  use_count: number;
  created_at: string;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Table creation (called from setup or migration)
// ---------------------------------------------------------------------------

export function ensureReplyTemplatesTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS reply_templates (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    shortcut TEXT,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    UNIQUE(workspace_id, user_id, name)
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_reply_templates_user ON reply_templates(workspace_id, user_id)`);
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export function createTemplate(
  workspaceId: string,
  userId: string,
  name: string,
  content: string,
  shortcut?: string | null,
): ReplyTemplate {
  ensureReplyTemplatesTable();
  const db = getDb();

  if (!name || name.length === 0) throw new Error("Name is required");
  if (name.length > 100) throw new Error("Name must be 100 characters or less");
  if (!content || content.length === 0) throw new Error("Content is required");
  if (content.length > 4000) throw new Error("Content must be 4000 characters or less");
  if (shortcut && shortcut.length > 50) throw new Error("Shortcut must be 50 characters or less");

  // Check for duplicate name
  const existing = db.run(sql`SELECT id FROM reply_templates WHERE workspace_id = ${workspaceId} AND user_id = ${userId} AND name = ${name}`);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.run(sql`INSERT INTO reply_templates (id, workspace_id, user_id, name, content, shortcut, use_count, created_at)
    VALUES (${id}, ${workspaceId}, ${userId}, ${name}, ${content}, ${shortcut ?? null}, 0, ${now})`);

  return {
    id,
    workspace_id: workspaceId,
    user_id: userId,
    name,
    content,
    shortcut: shortcut ?? null,
    use_count: 0,
    created_at: now,
    updated_at: null,
  };
}

export function listTemplates(workspaceId: string, userId: string): ReplyTemplate[] {
  ensureReplyTemplatesTable();
  const db = getDb();

  const rows = db.all<ReplyTemplate>(sql`SELECT * FROM reply_templates WHERE workspace_id = ${workspaceId} AND user_id = ${userId} ORDER BY name ASC`);
  return rows;
}

export function getTemplate(id: string): ReplyTemplate | null {
  ensureReplyTemplatesTable();
  const db = getDb();
  const row = db.get<ReplyTemplate>(sql`SELECT * FROM reply_templates WHERE id = ${id}`);
  return row ?? null;
}

export function updateTemplate(
  id: string,
  updates: { name?: string; content?: string; shortcut?: string | null },
): ReplyTemplate | null {
  ensureReplyTemplatesTable();
  const db = getDb();

  const existing = db.get<ReplyTemplate>(sql`SELECT * FROM reply_templates WHERE id = ${id}`);
  if (!existing) return null;

  const name = updates.name ?? existing.name;
  const content = updates.content ?? existing.content;
  const shortcut = updates.shortcut !== undefined ? updates.shortcut : existing.shortcut;
  const now = new Date().toISOString();

  if (name.length > 100) throw new Error("Name must be 100 characters or less");
  if (content.length > 4000) throw new Error("Content must be 4000 characters or less");

  db.run(sql`UPDATE reply_templates SET name = ${name}, content = ${content}, shortcut = ${shortcut}, updated_at = ${now} WHERE id = ${id}`);

  return { ...existing, name, content, shortcut: shortcut ?? null, updated_at: now };
}

export function deleteTemplate(id: string): boolean {
  ensureReplyTemplatesTable();
  const db = getDb();
  const existing = db.get<ReplyTemplate>(sql`SELECT id FROM reply_templates WHERE id = ${id}`);
  if (!existing) return false;
  db.run(sql`DELETE FROM reply_templates WHERE id = ${id}`);
  return true;
}

export function incrementUseCount(id: string): void {
  ensureReplyTemplatesTable();
  const db = getDb();
  db.run(sql`UPDATE reply_templates SET use_count = use_count + 1 WHERE id = ${id}`);
}
