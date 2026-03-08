/**
 * Agent last-seen tracking — exposes when each agent last sent a message.
 */

import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db/index";
import { messages, users, agents } from "../db/schema";

export interface AgentLastSeen {
  agent_id: string;
  agent_name: string;
  display_name: string | null;
  last_seen_at: string | null;
}

/**
 * Get the last message timestamp for a specific agent in a workspace.
 */
export function getAgentLastSeen(agentId: string, workspaceId: string): AgentLastSeen | null {
  const db = getDb();

  const agent = db
    .select({
      agentId: agents.id,
      agentName: agents.agentName,
      displayName: users.displayName,
    })
    .from(agents)
    .innerJoin(users, eq(agents.id, users.id))
    .where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)))
    .get();

  if (!agent) return null;

  const lastMsg = db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.senderId, agentId))
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .get();

  return {
    agent_id: agent.agentId,
    agent_name: agent.agentName,
    display_name: agent.displayName,
    last_seen_at: lastMsg?.createdAt ?? null,
  };
}

/**
 * Get last-seen timestamps for all agents in a workspace.
 */
export function getAllAgentLastSeen(workspaceId: string): AgentLastSeen[] {
  const db = getDb();

  const agentRows = db
    .select({
      agentId: agents.id,
      agentName: agents.agentName,
      displayName: users.displayName,
    })
    .from(agents)
    .innerJoin(users, eq(agents.id, users.id))
    .where(eq(agents.workspaceId, workspaceId))
    .all();

  return agentRows.map((a) => {
    const lastMsg = db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.senderId, a.agentId))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get();

    return {
      agent_id: a.agentId,
      agent_name: a.agentName,
      display_name: a.displayName,
      last_seen_at: lastMsg?.createdAt ?? null,
    };
  });
}
