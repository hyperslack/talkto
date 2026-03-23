/**
 * Tests for GET /api/channels/:channelId/contributors.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8206";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "contrib-user" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("GET /api/channels/:channelId/contributors", () => {
  let channelId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `contrib-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;
  });

  it("returns empty contributors for channel with no messages", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/contributors`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(channelId);
    expect(data.contributor_count).toBe(0);
    expect(data.contributors).toEqual([]);
  });

  it("returns contributors after posting messages", async () => {
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "hello" }));
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "world" }));

    const res = await app.fetch(req("GET", `/api/channels/${channelId}/contributors`));
    const data = await res.json();
    expect(data.contributor_count).toBe(1);
    expect(data.contributors[0].message_count).toBe(2);
    expect(data.contributors[0].sender_name).toBeDefined();
    expect(data.contributors[0].first_message_at).toBeDefined();
    expect(data.contributors[0].last_message_at).toBeDefined();
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/contributors"));
    expect(res.status).toBe(404);
  });
});
