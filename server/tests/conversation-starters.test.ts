/**
 * Tests for agent conversation starters endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8252";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Agent Conversation Starters", () => {
  it("returns empty array for agent with no starters", async () => {
    // List agents first to get a valid name
    const listRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await listRes.json();
    if (agents.length === 0) return; // skip if no agents

    const res = await app.fetch(req("GET", `/api/agents/${agents[0].agent_name}/conversation-starters`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 404 for nonexistent agent", async () => {
    const res = await app.fetch(req("GET", "/api/agents/nonexistent-agent/conversation-starters"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when setting starters for nonexistent agent", async () => {
    const res = await app.fetch(req("PUT", "/api/agents/nonexistent-agent/conversation-starters", {
      starters: [{ prompt: "Hello" }]
    }));
    expect(res.status).toBe(404);
  });

  it("rejects invalid body", async () => {
    const listRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await listRes.json();
    if (agents.length === 0) return;

    const res = await app.fetch(req("PUT", `/api/agents/${agents[0].agent_name}/conversation-starters`, {
      notStarters: true
    }));
    expect(res.status).toBe(400);
  });
});
