/**
 * Agent response time metrics — calculates how quickly agents respond
 * to human messages that mention them.
 *
 * Analyzes message pairs: human @mention → agent reply in same channel.
 */

import { getDb } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import { agents, messages, users } from "../db/schema";

export interface ResponseTimeMetrics {
  agent_name: string;
  avg_response_ms: number | null;
  median_response_ms: number | null;
  min_response_ms: number | null;
  max_response_ms: number | null;
  sample_count: number;
}

/**
 * Calculate response time metrics for an agent.
 *
 * Looks at messages mentioning the agent and finds the next message
 * by that agent in the same channel. The time difference is the response time.
 */
export function getAgentResponseTime(agentName: string, limit: number = 50): ResponseTimeMetrics {
  const db = getDb();

  const agent = db
    .select()
    .from(agents)
    .where(eq(agents.agentName, agentName))
    .get();

  if (!agent) {
    return {
      agent_name: agentName,
      avg_response_ms: null,
      median_response_ms: null,
      min_response_ms: null,
      max_response_ms: null,
      sample_count: 0,
    };
  }

  // Find messages that mention this agent (from other users)
  const mentionPattern = `%"${agentName}"%`;
  const mentionMessages = db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        sql`${messages.mentions} LIKE ${mentionPattern}`,
        sql`${messages.senderId} != ${agent.id}`,
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all();

  const responseTimes: number[] = [];

  for (const mention of mentionMessages) {
    // Find the first response by this agent in the same channel after the mention
    const response = db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, mention.channelId),
          eq(messages.senderId, agent.id),
          sql`${messages.createdAt} > ${mention.createdAt}`,
        )
      )
      .orderBy(messages.createdAt)
      .limit(1)
      .get();

    if (response) {
      const mentionTime = new Date(mention.createdAt).getTime();
      const responseTime = new Date(response.createdAt).getTime();
      const diff = responseTime - mentionTime;
      if (diff > 0 && diff < 3600000) { // Ignore responses > 1 hour (likely unrelated)
        responseTimes.push(diff);
      }
    }
  }

  if (responseTimes.length === 0) {
    return {
      agent_name: agentName,
      avg_response_ms: null,
      median_response_ms: null,
      min_response_ms: null,
      max_response_ms: null,
      sample_count: 0,
    };
  }

  responseTimes.sort((a, b) => a - b);
  const avg = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
  const median = responseTimes[Math.floor(responseTimes.length / 2)];

  return {
    agent_name: agentName,
    avg_response_ms: avg,
    median_response_ms: median,
    min_response_ms: responseTimes[0],
    max_response_ms: responseTimes[responseTimes.length - 1],
    sample_count: responseTimes.length,
  };
}

/** Calculate response times for all agents in a workspace. */
export function getAllAgentResponseTimes(workspaceId: string): ResponseTimeMetrics[] {
  const db = getDb();
  const allAgents = db
    .select({ agentName: agents.agentName })
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId))
    .all();

  return allAgents.map((a) => getAgentResponseTime(a.agentName));
}
