/**
 * Agent listing and DM endpoints (for UI).
 */

import { Hono } from "hono";
import { eq, asc, desc, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { agents, channels, channelMembers, messages, sessions, users } from "../db/schema";
import { AgentAdminUpdateSchema } from "../types";
import type { AgentResponse, AppBindings, ChannelResponse } from "../types";
import { requireAdmin } from "../middleware/auth";
import {
  deleteAgentFromWorkspace,
  updateAgentAdminProfile,
} from "../services/admin-manager";
import { reconcileWorkspaceAgents } from "../services/agent-reconciler";

const app = new Hono<AppBindings>();

function isAgentInvocable(agent: typeof agents.$inferSelect): boolean {
  if (agent.agentType === "system") return false;

  if (agent.agentType === "opencode") {
    return Boolean(agent.serverUrl && agent.providerSessionId);
  }

  return Boolean(agent.providerSessionId);
}

function agentToResponse(
  agent: typeof agents.$inferSelect
): AgentResponse {
  const isInvocable = isAgentInvocable(agent);
  const effectiveStatus =
    agent.agentType === "system" ? agent.status : isInvocable ? "online" : "offline";

  return {
    id: agent.id,
    agent_name: agent.agentName,
    agent_type: agent.agentType,
    project_path: agent.projectPath,
    project_name: agent.projectName,
    status: effectiveStatus,
    description: agent.description,
    personality: agent.personality,
    current_task: agent.currentTask,
    gender: agent.gender,
    server_url: agent.serverUrl,
    provider_session_id: agent.providerSessionId,
    is_invocable: isInvocable,
    is_ghost: agent.agentType === "system" ? false : !isInvocable,
  };
}

// GET /agents
app.get("/", async (c) => {
  const auth = c.get("auth");
  if (c.req.query("reconcile") === "1") {
    await reconcileWorkspaceAgents(auth.workspaceId);
  }
  const db = getDb();
  const allAgents = db
    .select()
    .from(agents)
    .where(eq(agents.workspaceId, auth.workspaceId))
    .orderBy(asc(agents.agentName))
    .all();

  // Batch-fetch message counts and last message timestamps for all agents
  const stats = db
    .select({
      senderId: messages.senderId,
      count: sql<number>`count(*)`,
      lastAt: sql<string>`max(${messages.createdAt})`,
    })
    .from(messages)
    .groupBy(messages.senderId)
    .all();

  const statsMap = new Map(stats.map((s) => [s.senderId, s]));

  const responses = allAgents.map((a) => {
    const agentStats = statsMap.get(a.id);
    return {
      ...agentToResponse(a),
      message_count: agentStats?.count ?? 0,
      last_message_at: agentStats?.lastAt ?? null,
    };
  });
  return c.json(responses);
});

// GET /agents/health — aggregated health summary
app.get("/health", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const allAgents = db
    .select()
    .from(agents)
    .where(eq(agents.workspaceId, auth.workspaceId))
    .all();

  let online = 0;
  let offline = 0;
  let ghost = 0;

  const agentStatuses = allAgents.map((a) => {
    const isGhost = ghostCache.get(a.id) ?? false;
    if (isGhost) ghost++;
    else if (a.status === "online") online++;
    else offline++;

    return {
      agent_name: a.agentName,
      agent_type: a.agentType,
      status: a.status,
      is_ghost: isGhost,
    };
  });

  return c.json({
    total: allAgents.length,
    online,
    offline,
    ghost,
    agents: agentStatuses,
  });
});

// GET /agents/leaderboard — rank agents by message count
app.get("/leaderboard", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10) || 20, 100);

  const rows = db
    .select({
      agentName: agents.agentName,
      agentType: agents.agentType,
      agentId: agents.id,
      messageCount: sql<number>`count(${messages.id})`,
      lastMessageAt: sql<string>`max(${messages.createdAt})`,
      channelCount: sql<number>`count(DISTINCT ${messages.channelId})`,
    })
    .from(agents)
    .leftJoin(messages, eq(agents.id, messages.senderId))
    .where(eq(agents.workspaceId, auth.workspaceId))
    .groupBy(agents.id)
    .orderBy(sql`count(${messages.id}) DESC`)
    .limit(limit)
    .all();

  return c.json({
    count: rows.length,
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      agent_name: r.agentName,
      agent_type: r.agentType,
      message_count: r.messageCount,
      channel_count: r.channelCount,
      last_message_at: r.lastMessageAt,
    })),
  });
});

// GET /agents/:agentName/stats — activity stats for an agent
app.get("/:agentName/stats", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.agentName, c.req.param("agentName")), eq(agents.workspaceId, auth.workspaceId)))
    .get();
  if (!agent) {
    return c.json({ detail: "Agent not found" }, 404);
  }

  // Count messages sent by this agent
  const messageCount = db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(eq(messages.senderId, agent.id))
    .get();

  // Get channels this agent is a member of
  const memberChannels = db
    .select({ count: sql<number>`count(*)` })
    .from(channelMembers)
    .where(eq(channelMembers.userId, agent.id))
    .get();

  // Last message timestamp
  const lastMessage = db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.senderId, agent.id))
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .get();

  // Session history — total sessions and current active session
  const totalSessions = db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(eq(sessions.agentId, agent.id))
    .get();

  const activeSession = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.agentId, agent.id), eq(sessions.isActive, 1)))
    .orderBy(desc(sessions.startedAt))
    .limit(1)
    .get();

  return c.json({
    agent_name: agent.agentName,
    agent_type: agent.agentType,
    message_count: messageCount?.count ?? 0,
    channel_count: memberChannels?.count ?? 0,
    last_message_at: lastMessage?.createdAt ?? null,
    total_sessions: totalSessions?.count ?? 0,
    current_session_started: activeSession?.startedAt ?? null,
    last_heartbeat: activeSession?.lastHeartbeat ?? null,
  });
});

// POST /agents/cleanup-unavailable — bulk-remove unreachable agents in this workspace
app.post("/cleanup-unavailable", requireAdmin, async (c) => {
  const auth = c.get("auth");
  return c.json(await reconcileWorkspaceAgents(auth.workspaceId));
});

// GET /agents/:agentName
app.get("/:agentName", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.agentName, c.req.param("agentName")), eq(agents.workspaceId, auth.workspaceId)))
    .get();
  if (!agent) {
    return c.json({ detail: "Agent not found" }, 404);
  }
  return c.json(agentToResponse(agent));
});

// PATCH /agents/:agentName — admin update for agent profile/provider metadata
app.patch("/:agentName", requireAdmin, async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json();
  const parsed = AgentAdminUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ detail: parsed.error.message }, 400);
  }

  const db = getDb();
  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.agentName, c.req.param("agentName")), eq(agents.workspaceId, auth.workspaceId)))
    .get();
  if (!agent) {
    return c.json({ detail: "Agent not found" }, 404);
  }

  const result = updateAgentAdminProfile(agent, {
    description: parsed.data.description,
    personality: parsed.data.personality,
    currentTask: parsed.data.current_task,
    gender: parsed.data.gender,
    agentType: parsed.data.agent_type,
  });
  if (result.error) {
    return c.json({ detail: result.error }, 400);
  }
  return c.json(result);
});

// DELETE /agents/:agentName — admin removal of an agent identity
app.delete("/:agentName", requireAdmin, (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.agentName, c.req.param("agentName")), eq(agents.workspaceId, auth.workspaceId)))
    .get();
  if (!agent) {
    return c.json({ detail: "Agent not found" }, 404);
  }

  const result = deleteAgentFromWorkspace(agent);
  if (result.error) {
    return c.json({ detail: result.error }, 400);
  }
  return c.json(result);
});

// POST /agents/:agentName/dm — get or create DM channel
app.post("/:agentName/dm", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const agentName = c.req.param("agentName");

  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.agentName, agentName), eq(agents.workspaceId, auth.workspaceId)))
    .get();
  if (!agent) {
    return c.json({ detail: "Agent not found" }, 404);
  }

  const dmName = `#dm-${agentName}`;
  const now = new Date().toISOString();

  // Check if DM channel already exists in this workspace
  const existing = db
    .select()
    .from(channels)
    .where(and(eq(channels.name, dmName), eq(channels.workspaceId, auth.workspaceId)))
    .get();
  if (existing) {
    const resp: ChannelResponse = {
      id: existing.id,
      name: existing.name,
      type: existing.type,
      project_path: existing.projectPath,
      created_by: existing.createdBy,
      created_at: existing.createdAt,
    };
    return c.json(resp);
  }

  // Create DM channel
  const channelId = crypto.randomUUID();
  db.insert(channels)
    .values({
      id: channelId,
      name: dmName,
      type: "dm",
      createdBy: auth.userId ?? "human",
      createdAt: now,
      workspaceId: auth.workspaceId,
    })
    .run();

  // Auto-join agent
  db.insert(channelMembers)
    .values({ channelId, userId: agent.id, joinedAt: now })
    .run();

  // Auto-join human from auth context
  if (auth.userId) {
    db.insert(channelMembers)
      .values({ channelId, userId: auth.userId, joinedAt: now })
      .run();
  }

  const channel = db.select().from(channels).where(eq(channels.id, channelId)).get()!;
  const resp: ChannelResponse = {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    project_path: channel.projectPath,
    created_by: channel.createdBy,
    created_at: channel.createdAt,
  };
  return c.json(resp);
});

export default app;
