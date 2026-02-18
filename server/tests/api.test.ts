/**
 * API route tests — test Hono routes via app.fetch().
 *
 * Uses the actual database (same SQLite file as dev) for integration testing.
 * Note: These tests read from the existing database — they're read-heavy.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

// We test against the actual app
let app: Hono;

beforeAll(async () => {
  // Set a different port to avoid conflicts
  process.env.TALKTO_PORT = "8099";
  const mod = await import("../src/index");
  app = mod.app;
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
    expect(creator.is_ghost).toBe(false);
  });

  it("GET /api/agents/:name returns single agent", async () => {
    const res = await app.fetch(req("GET", "/api/agents/the_creator"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agent_name).toBe("the_creator");
  });

  it("GET /api/agents/:name returns 404 for unknown", async () => {
    const res = await app.fetch(req("GET", "/api/agents/nonexistent-agent"));
    expect(res.status).toBe(404);
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
