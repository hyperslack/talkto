/**
 * Tests for reaction summary endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
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

describe("Reaction Summary", () => {
  it("returns summary for valid channel", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(
      req("GET", `/api/channels/${ch.id}/messages/reactions/summary`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(ch.id);
    expect(Array.isArray(data.emojis)).toBe(true);
    expect(typeof data.total).toBe("number");
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("GET", "/api/channels/fake-id/messages/reactions/summary")
    );
    expect(res.status).toBe(404);
  });

  it("emojis are sorted by count descending", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    // Add some reactions first
    const msgsRes = await app.fetch(req("GET", `/api/channels/${ch.id}/messages`));
    const msgs = await msgsRes.json();
    if (msgs.length > 0) {
      await app.fetch(req("POST", `/api/channels/${ch.id}/messages/${msgs[0].id}/react`, { emoji: "👍" }));
    }

    const res = await app.fetch(
      req("GET", `/api/channels/${ch.id}/messages/reactions/summary`)
    );
    const data = await res.json();
    for (let i = 1; i < data.emojis.length; i++) {
      expect(data.emojis[i - 1].count).toBeGreaterThanOrEqual(data.emojis[i].count);
    }
  });
});
