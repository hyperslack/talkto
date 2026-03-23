/**
 * Tests for POST/DELETE /api/channels/:channelId/members.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8201";
  const mod = await import("../src/index");
  app = mod.app;

  await app.fetch(req("POST", "/api/users/onboard", { name: "member-mgmt-user", display_name: "Manager" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel member management", () => {
  let channelId: string;
  let agentUserId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `member-mgmt-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;

    // Get an agent user ID
    const agentsRes = await app.fetch(req("GET", "/api/agents"));
    const agents = await agentsRes.json();
    if (agents.length > 0) agentUserId = agents[0].id;
  });

  it("adds a member to channel", async () => {
    if (!agentUserId) return;
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/members`, { user_id: agentUserId }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user_id).toBe(agentUserId);
    expect(data.joined_at).toBeDefined();
  });

  it("rejects duplicate add (409)", async () => {
    if (!agentUserId) return;
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/members`, { user_id: agentUserId }));
    expect(res.status).toBe(409);
  });

  it("removes a member from channel", async () => {
    if (!agentUserId) return;
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/members/${agentUserId}`));
    expect(res.status).toBe(204);
  });

  it("returns 404 removing non-member", async () => {
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/members/nonexistent`));
    expect(res.status).toBe(404);
  });

  it("returns 400 when user_id missing", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/members`, {}));
    expect(res.status).toBe(400);
  });
});
