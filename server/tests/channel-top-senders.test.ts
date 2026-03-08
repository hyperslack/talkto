/**
 * Tests for GET /channels/:channelId/top-senders endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8156";
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

describe("Channel Top Senders", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `topsend-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;
  });

  it("returns empty array for channel with no messages", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/top-senders`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it("returns sender stats after posting messages", async () => {
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "msg1" }));
    await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: "msg2" }));

    const res = await app.fetch(req("GET", `/api/channels/${channelId}/top-senders`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].message_count).toBe(2);
    expect(data[0].sender_name).toBeDefined();
    expect(data[0].sender_type).toBeDefined();
    expect(data[0].last_message_at).toBeDefined();
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/top-senders"));
    expect(res.status).toBe(404);
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/top-senders?limit=1`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(1);
  });
});
