/**
 * Agent uptime calculation — derives uptime from session records.
 *
 * Uses the sessions table (start/end timestamps) to compute total online time.
 */

import { sql } from "drizzle-orm";
import { getDb } from "../db";

export interface AgentUptimeResult {
  agent_id: string;
  agent_name: string;
  total_sessions: number;
  total_uptime_seconds: number;
  current_session_start: string | null;
  is_online: boolean;
}

/** Get uptime stats for a single agent. */
export function getAgentUptime(agentId: string): AgentUptimeResult | null {
  const db = getDb();

  const agentRow = db.all(
    sql`SELECT a.id, a.agent_name, a.status FROM agents a WHERE a.id = ${agentId}`
  ) as Array<{ id: string; agent_name: string; status: string }>;

  if (agentRow.length === 0) return null;
  const agent = agentRow[0];

  // Get all sessions for this agent
  const sessions = db.all(
    sql`SELECT started_at, ended_at, is_active FROM sessions WHERE agent_id = ${agentId}`
  ) as Array<{ started_at: string; ended_at: string | null; is_active: number }>;

  let totalSeconds = 0;
  let currentSessionStart: string | null = null;

  for (const session of sessions) {
    const start = new Date(session.started_at).getTime();
    const end = session.ended_at
      ? new Date(session.ended_at).getTime()
      : Date.now();
    totalSeconds += (end - start) / 1000;

    if (session.is_active === 1 && !session.ended_at) {
      currentSessionStart = session.started_at;
    }
  }

  return {
    agent_id: agent.id,
    agent_name: agent.agent_name,
    total_sessions: sessions.length,
    total_uptime_seconds: Math.round(totalSeconds),
    current_session_start: currentSessionStart,
    is_online: agent.status === "online",
  };
}

/** Get uptime stats for all agents in a workspace. */
export function getAllAgentUptime(workspaceId: string): AgentUptimeResult[] {
  const db = getDb();

  const agents = db.all(
    sql`SELECT id, agent_name, status FROM agents WHERE workspace_id = ${workspaceId}`
  ) as Array<{ id: string; agent_name: string; status: string }>;

  return agents.map((agent) => {
    const result = getAgentUptime(agent.id);
    return result!;
  }).filter(Boolean);
}
