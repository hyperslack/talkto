/**
 * API route tests — test Hono routes via app.fetch().
 *
 * Uses an isolated temp database for integration testing.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";
import "./test-env";
import { eq } from "drizzle-orm";
import { DEFAULT_WORKSPACE_ID, getDb } from "../src/db";
import { agents, channels, users } from "../src/db/schema";

// We test against the actual app
let app: Hono;

beforeAll(async () => {
  // Set a different port to avoid conflicts
  process.env.TALKTO_PORT = "8099";
  const mod = await import("../src/index");
  app = mod.app;

  const onboardRes = await app.fetch(req("POST", "/api/users/onboard", {
    name: "api-test-boss",
    display_name: "the Boss",
  }));
  expect(onboardRes.status).toBe(201);
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Health", () => {
  it("GET /api/health returns 200", async () => {
    const res = await app.fetch(req("GET", "/api/health"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
  });
});

describe("Channels API", () => {
  it("GET /api/channels returns list", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    // All channels should have required fields
    for (const ch of data) {
      expect(ch.id).toBeDefined();
      expect(ch.name).toBeDefined();
      expect(ch.type).toBeDefined();
    }
  });

  it("GET /api/channels includes #general", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const data = await res.json();
    const general = data.find((ch: { name: string }) => ch.name === "#general");
    expect(general).toBeDefined();
    expect(general.type).toBe("general");
  });

  it("GET /api/channels/:id returns single channel", async () => {
    // First get all channels
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const first = channels[0];

    const res = await app.fetch(req("GET", `/api/channels/${first.id}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(first.id);
    expect(data.name).toBe(first.name);
  });

  it("GET /api/channels/:id returns 404 for unknown", async () => {
    const res = await app.fetch(
      req("GET", "/api/channels/nonexistent-uuid")
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /api/channels/:id removes a custom channel", async () => {
    const createRes = await app.fetch(req("POST", "/api/channels", {
      name: `delete-me-${Date.now()}`,
    }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const deleteRes = await app.fetch(req("DELETE", `/api/channels/${created.id}`));
    expect(deleteRes.status).toBe(200);
    const deleted = await deleteRes.json();
    expect(deleted.deleted).toBe(true);

    const getRes = await app.fetch(req("GET", `/api/channels/${created.id}`));
    expect(getRes.status).toBe(404);
  });
});

describe("Agents API", () => {
  it("GET /api/agents returns list", async () => {
    const res = await app.fetch(req("GET", "/api/agents"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    // All agents should have required fields
    for (const agent of data) {
      expect(agent.id).toBeDefined();
      expect(agent.agent_name).toBeDefined();
      expect(agent.agent_type).toBeDefined();
      expect(typeof agent.is_invocable).toBe("boolean");
      expect(typeof agent.is_ghost).toBe("boolean");
    }
  });

  it("GET /api/agents includes the_creator", async () => {
    const res = await app.fetch(req("GET", "/api/agents"));
    const data = await res.json();
    const creator = data.find(
      (a: { agent_name: string }) => a.agent_name === "the_creator"
    );
    expect(creator).toBeDefined();
    expect(creator.agent_type).toBe("system");
    expect(creator.is_invocable).toBe(false);
    expect(creator.is_ghost).toBe(false);
  });

  it("GET /api/agents/:name returns single agent", async () => {
    const res = await app.fetch(req("GET", "/api/agents/the_creator"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agent_name).toBe("the_creator");
  });

  it("GET /api/agents derives online status from invocability", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const agentName = `api-derived-status-${Date.now()}`;

    db.insert(users)
      .values({ id: userId, name: agentName, type: "agent", createdAt: now })
      .run();
    db.insert(agents)
      .values({
        id: userId,
        agentName,
        agentType: "codex",
        projectPath: "/tmp/api-derived-status",
        projectName: "api-derived-status",
        status: "offline",
        providerSessionId: "still-resumable",
        workspaceId: DEFAULT_WORKSPACE_ID,
      })
      .run();

    const res = await app.fetch(req("GET", `/api/agents/${agentName}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_invocable).toBe(true);
    expect(data.status).toBe("online");
  });

  it("GET /api/agents/:name returns 404 for unknown", async () => {
    const res = await app.fetch(req("GET", "/api/agents/nonexistent-agent"));
    expect(res.status).toBe(404);
  });

  it("PATCH /api/agents/:name updates an agent profile", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const agentName = `api-update-agent-${Date.now()}`;

    db.insert(users)
      .values({ id: userId, name: agentName, type: "agent", createdAt: now })
      .run();
    db.insert(agents)
      .values({
        id: userId,
        agentName,
        agentType: "claude_code",
        projectPath: "/tmp/api-update-agent",
        projectName: "api-update-agent",
        status: "online",
        providerSessionId: "api-update-session",
        workspaceId: DEFAULT_WORKSPACE_ID,
      })
      .run();

    const res = await app.fetch(req("PATCH", `/api/agents/${agentName}`, {
      description: "updated from api test",
      current_task: "route verification",
      agent_type: "cursor",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agent_name).toBe(agentName);
    expect(data.agent_type).toBe("cursor");
    expect(data.current_task).toBe("route verification");

    const stored = db.select().from(agents).where(eq(agents.agentName, agentName)).get();
    expect(stored?.description).toBe("updated from api test");
    expect(stored?.agentType).toBe("cursor");
    expect(stored?.providerSessionId).toBeNull();
    expect(stored?.serverUrl).toBeNull();
    expect(stored?.status).toBe("offline");
  });

  it("DELETE /api/agents/:name removes a non-system agent", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const agentName = `api-delete-agent-${Date.now()}`;
    const dmChannelId = crypto.randomUUID();

    db.insert(users)
      .values({ id: userId, name: agentName, type: "agent", createdAt: now })
      .run();
    db.insert(agents)
      .values({
        id: userId,
        agentName,
        agentType: "claude_code",
        projectPath: "/tmp/api-delete-agent",
        projectName: "api-delete-agent",
        status: "online",
        providerSessionId: "delete-session",
        workspaceId: DEFAULT_WORKSPACE_ID,
      })
      .run();
    db.insert(channels)
      .values({
        id: dmChannelId,
        name: `#dm-${agentName}`,
        type: "dm",
        createdBy: userId,
        createdAt: now,
        workspaceId: DEFAULT_WORKSPACE_ID,
      })
      .run();

    const res = await app.fetch(req("DELETE", `/api/agents/${agentName}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);

    const storedAgent = db.select().from(agents).where(eq(agents.agentName, agentName)).get();
    expect(storedAgent).toBeUndefined();
    const storedDm = db.select().from(channels).where(eq(channels.id, dmChannelId)).get();
    expect(storedDm).toBeUndefined();
  });

  it("POST /api/agents/cleanup-unavailable removes unreachable agents in bulk", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const unavailableId = crypto.randomUUID();
    const availableId = crypto.randomUUID();
    const unavailableName = `api-cleanup-unavailable-${Date.now()}`;
    const availableName = `api-cleanup-available-${Date.now()}`;

    db.insert(users)
      .values([
        { id: unavailableId, name: unavailableName, type: "agent", createdAt: now },
        { id: availableId, name: availableName, type: "agent", createdAt: now },
      ])
      .run();

    db.insert(agents)
      .values([
        {
          id: unavailableId,
          agentName: unavailableName,
          agentType: "claude_code",
          projectPath: "/tmp/api-cleanup-unavailable",
          projectName: "api-cleanup-unavailable",
          status: "offline",
          providerSessionId: null,
          workspaceId: DEFAULT_WORKSPACE_ID,
        },
        {
          id: availableId,
          agentName: availableName,
          agentType: "codex",
          projectPath: "/tmp/api-cleanup-available",
          projectName: "api-cleanup-available",
          status: "offline",
          providerSessionId: "still-valid",
          workspaceId: DEFAULT_WORKSPACE_ID,
        },
      ])
      .run();

    const res = await app.fetch(req("POST", "/api/agents/cleanup-unavailable"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBeGreaterThanOrEqual(1);
    expect(data.agent_names).toContain(unavailableName);

    const removed = db.select().from(agents).where(eq(agents.id, unavailableId)).get();
    const kept = db.select().from(agents).where(eq(agents.id, availableId)).get();
    expect(removed).toBeUndefined();
    expect(kept?.agentName).toBe(availableName);
  });
});

describe("Features API", () => {
  it("GET /api/features returns list with vote counts", async () => {
    const res = await app.fetch(req("GET", "/api/features"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const f of data) {
      expect(f.id).toBeDefined();
      expect(f.title).toBeDefined();
      expect(typeof f.vote_count).toBe("number");
    }
  });
});

describe("Messages API", () => {
  it("GET /api/channels/:id/messages returns messages", async () => {
    // Find #general channel
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const general = channels.find((ch: { name: string }) => ch.name === "#general");

    const res = await app.fetch(
      req("GET", `/api/channels/${general.id}/messages`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // Should have at least the creator's welcome message
    expect(data.length).toBeGreaterThan(0);
    for (const msg of data) {
      expect(msg.id).toBeDefined();
      expect(msg.content).toBeDefined();
      expect(msg.sender_name).toBeDefined();
    }
  });

  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(
      req("GET", "/api/channels/nonexistent/messages")
    );
    expect(res.status).toBe(404);
  });
});
