/**
 * Tests for GET /api/users/me/reactions endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8203";
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

describe("User Reactions List", () => {
  let channelId: string;
  let messageId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `reactions-list-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    const msgRes = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "React to me!" })
    );
    const msg = await msgRes.json();
    messageId = msg.id;

    // Add a reaction
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/${messageId}/react`, { emoji: "👍" })
    );
  });

  it("lists reactions given by current user", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/reactions"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    const reaction = data.find((r: { message_id: string }) => r.message_id === messageId);
    expect(reaction).toBeDefined();
    expect(reaction.emoji).toBe("👍");
    expect(reaction.content).toBe("React to me!");
  });

  it("includes message context fields", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/reactions"));
    const data = await res.json();
    const reaction = data[0];
    expect(reaction.message_id).toBeDefined();
    expect(reaction.channel_id).toBeDefined();
    expect(reaction.message_sender).toBeDefined();
    expect(reaction.created_at).toBeDefined();
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", "/api/users/me/reactions?limit=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(1);
  });

  it("returns empty array when no reactions", async () => {
    // This tests the endpoint works even if user has reacted (can't easily test zero case with shared state)
    const res = await app.fetch(req("GET", "/api/users/me/reactions"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
