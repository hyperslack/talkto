/**
 * Cursor IDE/CLI SDK wrapper — Phase 1 (MCP-only, session tracking).
 *
 * Provides session-liveness and busy-state tracking for Cursor agents,
 * matching the interface exposed by claude.ts and codex.ts.
 *
 * Phase 1: Cursor agents connect to TalkTo as MCP clients and participate
 * proactively via MCP tools (send_message, get_messages, etc.). TalkTo
 * cannot push prompts to Cursor agents yet — they are "proactive-only".
 *
 * Phase 2 (future): Will add promptSession() / promptSessionWithEvents()
 * via a Cursor extension bridge that exposes the internal AnthropicProxy
 * port and auth token, allowing TalkTo to drive the embedded Claude Code
 * CLI through the Cursor subscription.
 *
 * Key characteristics (same as Claude Code and Codex):
 * - No server URL — Cursor agents register via MCP, not REST
 * - Session liveness tracked locally via in-process Set (no REST health endpoint)
 * - Busy state tracked via in-process Set (no status API)
 * - Cleared on TalkTo restart — agents become ghosts until re-register
 */

// ---------------------------------------------------------------------------
// Session state tracking — in-process (no REST API available)
// ---------------------------------------------------------------------------

/**
 * Set of session IDs that are currently being prompted.
 * Reserved for Phase 2 when TalkTo can invoke Cursor agents.
 */
const busySessions = new Set<string>();

/**
 * Set of session IDs known to be alive (registered via MCP).
 * Cleared on TalkTo restart — agents become ghosts until re-register.
 */
const knownAliveSessions = new Set<string>();

/**
 * Mark a session as known-alive (e.g., after successful MCP registration).
 */
export function markSessionAlive(sessionId: string): void {
  knownAliveSessions.add(sessionId);
}

/**
 * Mark a session as dead (e.g., after deregistration or disconnect).
 */
export function markSessionDead(sessionId: string): void {
  knownAliveSessions.delete(sessionId);
  busySessions.delete(sessionId);
}

// ---------------------------------------------------------------------------
// Session operations — mirror claude.ts / codex.ts interface
// ---------------------------------------------------------------------------

/**
 * Check if a Cursor session is alive.
 *
 * Since Cursor agents connect via MCP (no REST API for session lookups),
 * we rely on local tracking. A session is considered alive if the agent
 * has registered since the last TalkTo restart.
 */
export async function isSessionAlive(sessionId: string): Promise<boolean> {
  return knownAliveSessions.has(sessionId);
}

/**
 * Check if a Cursor session is currently busy (processing a prompt).
 * Always returns false in Phase 1 since TalkTo cannot invoke Cursor agents.
 */
export async function isSessionBusy(sessionId: string): Promise<boolean> {
  return busySessions.has(sessionId);
}
