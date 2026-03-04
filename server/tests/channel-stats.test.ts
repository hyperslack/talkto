/**
 * Tests for GET /channels/:channelId/stats endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8152";
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

describe("Channel Stats", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `stats-test-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;
  });

  it("returns stats for an empty channel", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/stats`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(channelId);
    expect(data.message_count).toBe(0);
    expect(data.member_count).toBe(0);
    expect(data.pinned_count).toBe(0);
    expect(data.last_message_at).toBeNull();
    expect(data.created_at).toBeDefined();
  });

  it("reflects message count after posting", async () => {
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "msg 1" })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "msg 2" })
    );

    const res = await app.fetch(req("GET", `/api/channels/${channelId}/stats`));
    const data = await res.json();
    expect(data.message_count).toBe(2);
    expect(data.last_message_at).toBeDefined();
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/stats"));
    expect(res.status).toBe(404);
  });
});
