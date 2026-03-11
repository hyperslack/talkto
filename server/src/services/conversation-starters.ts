/**
 * Agent conversation starters — suggested prompts per agent.
 *
 * Allows agents to define conversation starter prompts that humans
 * can click to start conversations (like ChatGPT suggestions).
 */

import { getDb } from "../db";
import { sql } from "drizzle-orm";

export interface ConversationStarter {
  id: string;
  agent_id: string;
  prompt: string;
  label: string | null;
  position: number;
  created_at: string;
}

/** Ensure the conversation_starters table exists. */
export function ensureConversationStartersTable(): void {
  const db = getDb();
  db.run(sql`CREATE TABLE IF NOT EXISTS conversation_starters (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    label TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
  db.run(sql`CREATE INDEX IF NOT EXISTS idx_conv_starters_agent ON conversation_starters(agent_id)`);
}

/** Set conversation starters for an agent (replaces existing). */
export function setConversationStarters(
  agentId: string,
  starters: Array<{ prompt: string; label?: string }>
): ConversationStarter[] {
  const db = getDb();
  ensureConversationStartersTable();

  if (starters.length > 10) {
    throw new Error("Maximum 10 conversation starters per agent");
  }

  // Delete existing
  db.run(sql`DELETE FROM conversation_starters WHERE agent_id = ${agentId}`);

  const now = new Date().toISOString();
  const results: ConversationStarter[] = [];

  for (let i = 0; i < starters.length; i++) {
    const s = starters[i];
    if (!s.prompt || s.prompt.length > 500) {
      throw new Error("Each prompt must be 1-500 characters");
    }
    const id = crypto.randomUUID();
    db.run(sql`INSERT INTO conversation_starters (id, agent_id, prompt, label, position, created_at)
      VALUES (${id}, ${agentId}, ${s.prompt}, ${s.label ?? null}, ${i}, ${now})`);
    results.push({
      id,
      agent_id: agentId,
      prompt: s.prompt,
      label: s.label ?? null,
      position: i,
      created_at: now,
    });
  }

  return results;
}

/** Get conversation starters for an agent. */
export function getConversationStarters(agentId: string): ConversationStarter[] {
  const db = getDb();
  ensureConversationStartersTable();
  return db.all(sql`SELECT id, agent_id, prompt, label, position, created_at
    FROM conversation_starters WHERE agent_id = ${agentId}
    ORDER BY position ASC`) as ConversationStarter[];
}
