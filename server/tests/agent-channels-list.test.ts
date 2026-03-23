/**
 * Tests for GET /api/agents/:agentName/channels.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8202";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "agent-ch-user" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("GET /api/agents/:agentName/channels", () => {
  it("returns 404 for nonexistent agent", async () => {
    const res = await app.fetch(req("GET", "/api/agents/nonexistent-agent/channels"));
    expect(res.status).toBe(404);
  });

  it("returns channels list for an agent", async () => {
    const agentsRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await agentsRes.json();
    if (agents.length === 0) return;

    const agentName = agents[0].agent_name;
    const res = await app.fetch(req("GET", `/api/agents/${agentName}/channels`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0]).toHaveProperty("channel_id");
      expect(data[0]).toHaveProperty("channel_name");
      expect(data[0]).toHaveProperty("channel_type");
      expect(data[0]).toHaveProperty("joined_at");
    }
  });

  it("includes DM channel after creating one", async () => {
    const agentsRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await agentsRes.json();
    if (agents.length === 0) return;

    const agentName = agents[0].agent_name;
    // Create a DM
    await app.fetch(req("POST", `/api/agents/${agentName}/dm`));

    const res = await app.fetch(req("GET", `/api/agents/${agentName}/channels`));
    const data = await res.json();
    const dmChannel = data.find((ch: any) => ch.channel_name.startsWith("#dm-"));
    expect(dmChannel).toBeDefined();
  });
});
