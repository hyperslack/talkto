/**
 * Tests for GET /search/messages endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8160";
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

describe("Message Search", () => {
  let channelId: string;

  beforeAll(async () => {
    // Create a channel and post some messages
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `search-test-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    // Post messages with distinct content
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "The quick brown fox jumps over the lazy dog",
      })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "Hello world from search test",
      })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "Another message about foxes and dogs",
      })
    );
  });

  it("returns 400 without query parameter", async () => {
    const res = await app.fetch(req("GET", "/api/search/messages"));
    expect(res.status).toBe(400);
  });

  it("returns 400 with empty query", async () => {
    const res = await app.fetch(req("GET", "/api/search/messages?q="));
    expect(res.status).toBe(400);
  });

  it("finds messages matching query", async () => {
    const res = await app.fetch(req("GET", "/api/search/messages?q=fox"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.query).toBe("fox");
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    for (const r of data.results) {
      expect(r.content.toLowerCase()).toContain("fox");
    }
  });

  it("returns channel info in results", async () => {
    const res = await app.fetch(req("GET", "/api/search/messages?q=fox"));
    const data = await res.json();
    expect(data.results[0].channel_id).toBeDefined();
    expect(data.results[0].channel_name).toBeDefined();
    expect(data.results[0].sender_name).toBeDefined();
  });

  it("filters by channel_id", async () => {
    const res = await app.fetch(
      req("GET", `/api/search/messages?q=fox&channel_id=${channelId}`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const r of data.results) {
      expect(r.channel_id).toBe(channelId);
    }
  });

  it("respects limit parameter", async () => {
    const res = await app.fetch(req("GET", "/api/search/messages?q=fox&limit=1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeLessThanOrEqual(1);
  });

  it("returns empty results for no match", async () => {
    const res = await app.fetch(
      req("GET", "/api/search/messages?q=xyznonexistent12345")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
    expect(data.results).toEqual([]);
  });
});
