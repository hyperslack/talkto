/**
 * Tests for GET /api/channels/:channelId/sender-type-stats.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8208";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "sender-type-user" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("GET /api/channels/:channelId/sender-type-stats", () => {
  let channelId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `sender-type-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;
  });

  it("returns zero stats for empty channel", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/sender-type-stats`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(channelId);
    expect(data.total_messages).toBe(0);
    expect(data.human_messages).toBe(0);
    expect(data.agent_messages).toBe(0);
    expect(data.agent_ratio).toBe(0);
  });

  it("shows human message after posting", async () => {
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "hello from human" }));
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/sender-type-stats`));
    const data = await res.json();
    expect(data.total_messages).toBe(1);
    expect(data.human_messages).toBe(1);
    expect(data.agent_ratio).toBe(0);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/sender-type-stats"));
    expect(res.status).toBe(404);
  });
});
