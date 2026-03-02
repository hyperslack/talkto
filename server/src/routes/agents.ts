/**
 * Agent listing and DM endpoints (for UI).
 */

import { Hono } from "hono";
import { eq, asc, desc, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { agents, channels, channelMembers, messages, sessions, users } from "../db/schema";
import { AgentAdminUpdateSchema } from "../types";
import type { AgentResponse, AppBindings, ChannelResponse } from "../types";
import { AgentDisplayNameSchema } from "../types";
import { broadcastEvent } from "../services/broadcaster";
import type { WsEvent } from "../services/broadcaster";
import { isSessionAlive as isClaudeSessionAlive } from "../sdk/claude";
import { isSessionAlive as isCodexSessionAlive } from "../sdk/codex";
import { isSessionAlive as isCursorSessionAlive } from "../sdk/cursor";
import { requireAdmin } from "../middleware/auth";
import { deleteAgentFromWorkspace, updateAgentAdminProfile } from "../services/admin-manager";

const app = new Hono<AppBindings>();

// ---------------------------------------------------------------------------
// Ghost cache — updated every 30s by background interval
// ---------------------------------------------------------------------------

const ghostCache = new Map<string, boolean>();
let livenessInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check if a process with the given PID is alive.
 *
 * On Unix, `process.kill(pid, 0)` sends signal 0 which checks existence
 * without killing. On Windows, signal 0 can actually kill the process in
 * some Node.js versions, so we skip the PID-based check entirely and
 * return `true` (optimistic) — the SDK-based `isSessionAliveViaGet()`
 * is the primary liveness check and works cross-platform.
 */
function isPidAlive(pid: number): boolean {
  if (process.platform === "win32") {
    // On Windows, process.kill(pid, 0) behavior is unreliable.
    // Return true to avoid false ghost detection; the SDK-based
    // session check (isSessionAliveViaGet) is the authoritative source.
    return true;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an agent's session is alive via direct GET /session/{id}.
 * Uses session.get() which works cross-project (unlike session.list()
 * which is project-scoped and misses sessions from other projects).
 */
async function isSessionAliveViaGet(
  serverUrl: string,
  sessionId: string
): Promise<boolean> {
  try {
    const resp = await fetch(`${serverUrl}/session/${sessionId}`, {
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function computeGhost(
  agent: typeof agents.$inferSelect
): Promise<boolean> {
  if (agent.agentType === "system") return false;

  // Claude Code agents — subprocess model, no server URL
  if (agent.agentType === "claude_code" && agent.providerSessionId) {
    return !(await isClaudeSessionAlive(agent.providerSessionId));
  }

  // Codex CLI agents — subprocess model, no server URL
  if (agent.agentType === "codex" && agent.providerSessionId) {
    return !(await isCodexSessionAlive(agent.providerSessionId));
  }

  // Cursor agents — MCP-only model, no server URL
  if (agent.agentType === "cursor" && agent.providerSessionId) {
    return !(await isCursorSessionAlive(agent.providerSessionId));
  }

  // OpenCode agents — REST client-server model
  if (agent.serverUrl && agent.providerSessionId) {
    // Direct session lookup — works cross-project
    return !(await isSessionAliveViaGet(agent.serverUrl, agent.providerSessionId));
  }

  // Offline agents aren't ghosts — they explicitly disconnected
  if (agent.status === "offline") return false;

  // No invocation credentials — check for active session with live PID
  const db = getDb();
  const activeSession = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.agentId, agent.id), eq(sessions.isActive, 1)))
    .orderBy(desc(sessions.startedAt))
    .limit(1)
    .get();

  if (!activeSession) return true;
  return !isPidAlive(activeSession.pid);
}

async function refreshGhostCache(): Promise<void> {
  try {
    const db = getDb();
    const allAgents = db.select().from(agents).all();
    const newCache = new Map<string, boolean>();

    // Check all agents in parallel
    const results = await Promise.allSettled(
      allAgents.map(async (agent) => ({
        id: agent.id,
        isGhost: await computeGhost(agent),
      }))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        newCache.set(result.value.id, result.value.isGhost);
      }
    }

    ghostCache.clear();
    for (const [k, v] of newCache) ghostCache.set(k, v);
  } catch (e) {
    console.error("Failed to refresh ghost cache:", e);
  }
}

export function startLivenessTask(): void {
  if (!livenessInterval) {
    // Run immediately, then every 30s
    refreshGhostCache();
    livenessInterval = setInterval(refreshGhostCache, 30_000);
  }
}

export function stopLivenessTask(): void {
  if (livenessInterval) {
    clearInterval(livenessInterval);
    livenessInterval = null;
  }
}

function agentToResponse(
  agent: typeof agents.$inferSelect,
  isGhost: boolean,
  displayName?: string | null
): AgentResponse {
  return {
    id: agent.id,
    agent_name: agent.agentName,
    agent_type: agent.agentType,
    project_path: agent.projectPath,
    project_name: agent.projectName,
    status: agent.status,
    description: agent.description,
    personality: agent.personality,
    current_task: agent.currentTask,
    gender: agent.gender,
    server_url: agent.serverUrl,
    provider_session_id: agent.providerSessionId,
    is_ghost: isGhost,
    display_name: displayName ?? null,
  };
}

// GET /agents
app.get("/", (c) => {
  const auth = c.get("auth");
  const db = getDb();
  const allAgents = db
    .select()
    .from(agents)
    .where(eq(agents.workspaceId, auth.workspaceId))
    .orderBy(asc(agents.agentName))
    .all();

  // Batch-fetch display names from users table
  const agentIds = allAgents.map((a) => a.id);
  const userRows = agentIds.length > 0
    ? db.select({ id: users.id, displayName: users.displayName }).from(users).all()
    : [];
  const displayNameMap = new Map(userRows.map((u) => [u.id, u.displayName]));

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
      ...agentToResponse(a, ghostCache.get(a.id) ?? false, displayNameMap.get(a.id)),
      message_count: agentStats?.count ?? 0,
      last_message_at: agentStats?.lastAt ?? null,
    };
  });
  return c.json(responses);
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
  const user = db.select().from(users).where(eq(users.id, agent.id)).get();
  return c.json(agentToResponse(agent, ghostCache.get(agent.id) ?? false, user?.displayName));
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
  ghostCache.delete(agent.id);
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

// PATCH /agents/:agentId/display-name — rename an agent's display name (human-only)
app.patch("/:agentId/display-name", async (c) => {
  const auth = c.get("auth");

  // Require authenticated human user
  if (!auth.userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Verify caller is a human
  const db = getDb();
  const caller = db.select().from(users).where(eq(users.id, auth.userId)).get();
  if (!caller || caller.type !== "human") {
    return c.json({ error: "Only humans can rename agents" }, 403);
  }

  const agentId = c.req.param("agentId");
  const body = await c.req.json();
  const parsed = AgentDisplayNameSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid display name", details: parsed.error.flatten() }, 400);
  }

  const { display_name } = parsed.data;

  // Find the agent
  const agent = db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.workspaceId, auth.workspaceId)))
    .get();
  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  // Update the display_name on the users table
  db.update(users)
    .set({ displayName: display_name })
    .where(eq(users.id, agentId))
    .run();

  // Broadcast WS event so frontend updates in real-time
  broadcastEvent(
    {
      type: "agent_display_name",
      data: {
        agent_id: agentId,
        agent_name: agent.agentName,
        display_name,
      },
    },
    auth.workspaceId
  );

  return c.json({
    status: "updated",
    agent_id: agentId,
    agent_name: agent.agentName,
    display_name,
  });
});

export default app;
