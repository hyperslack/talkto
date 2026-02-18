/**
 * Agent listing and DM endpoints (for UI).
 */

import { Hono } from "hono";
import { eq, asc } from "drizzle-orm";
import { getDb } from "../db";
import { agents, channels, channelMembers, sessions, users } from "../db/schema";
import type { AgentResponse, ChannelResponse } from "../types";

const app = new Hono();

// ---------------------------------------------------------------------------
// Ghost cache — updated every 30s by background interval
// ---------------------------------------------------------------------------

const ghostCache = new Map<string, boolean>();
let livenessInterval: ReturnType<typeof setInterval> | null = null;

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function fetchOpencodeSessions(serverUrl: string): Promise<Set<string>> {
  try {
    const resp = await fetch(`${serverUrl}/session`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as Array<{ id?: string }>;
      return new Set(data.map((s) => s.id ?? ""));
    }
  } catch {
    // Server unreachable
  }
  return new Set();
}

function computeGhost(
  agent: typeof agents.$inferSelect,
  opencodeSessions: Map<string, Set<string>>
): boolean | Promise<boolean> {
  if (agent.agentType === "system") return false;

  if (agent.serverUrl && agent.providerSessionId) {
    // Check if we need to fetch sessions for this server
    if (!opencodeSessions.has(agent.serverUrl)) {
      // Return a promise — caller must await
      return (async () => {
        const sessions = await fetchOpencodeSessions(agent.serverUrl!);
        opencodeSessions.set(agent.serverUrl!, sessions);
        return !sessions.has(agent.providerSessionId!);
      })();
    }
    return !opencodeSessions.get(agent.serverUrl)!.has(agent.providerSessionId);
  }

  // No invocation credentials — check for active session with live PID
  const db = getDb();
  const activeSession = db
    .select()
    .from(sessions)
    .where(eq(sessions.agentId, agent.id))
    .orderBy(asc(sessions.startedAt))
    .limit(1)
    .get();

  if (!activeSession) return true;
  return !isPidAlive(activeSession.pid);
}

async function refreshGhostCache(): Promise<void> {
  try {
    const db = getDb();
    const allAgents = db.select().from(agents).all();
    const opencodeSessions = new Map<string, Set<string>>();
    const newCache = new Map<string, boolean>();

    for (const agent of allAgents) {
      const result = computeGhost(agent, opencodeSessions);
      const isGhost = result instanceof Promise ? await result : result;
      newCache.set(agent.id, isGhost);
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
  isGhost: boolean
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
  };
}

// GET /agents
app.get("/", (c) => {
  const db = getDb();
  const allAgents = db.select().from(agents).orderBy(asc(agents.agentName)).all();

  const responses = allAgents.map((a) =>
    agentToResponse(a, ghostCache.get(a.id) ?? false)
  );
  return c.json(responses);
});

// GET /agents/:agentName
app.get("/:agentName", (c) => {
  const db = getDb();
  const agent = db
    .select()
    .from(agents)
    .where(eq(agents.agentName, c.req.param("agentName")))
    .get();
  if (!agent) {
    return c.json({ detail: "Agent not found" }, 404);
  }
  return c.json(agentToResponse(agent, ghostCache.get(agent.id) ?? false));
});

// POST /agents/:agentName/dm — get or create DM channel
app.post("/:agentName/dm", (c) => {
  const db = getDb();
  const agentName = c.req.param("agentName");

  const agent = db
    .select()
    .from(agents)
    .where(eq(agents.agentName, agentName))
    .get();
  if (!agent) {
    return c.json({ detail: "Agent not found" }, 404);
  }

  const dmName = `#dm-${agentName}`;
  const now = new Date().toISOString();

  // Check if DM channel already exists
  const existing = db.select().from(channels).where(eq(channels.name, dmName)).get();
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
      createdBy: "human",
      createdAt: now,
    })
    .run();

  // Auto-join agent
  db.insert(channelMembers)
    .values({ channelId, userId: agent.id, joinedAt: now })
    .run();

  // Auto-join human
  const human = db.select().from(users).where(eq(users.type, "human")).get();
  if (human) {
    db.insert(channelMembers)
      .values({ channelId, userId: human.id, joinedAt: now })
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
