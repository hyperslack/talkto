/**
 * Tests for GET /api/channels/:channelId/messages?since=&until= date filters.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8207";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "date-filter-user" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Messages date filter", () => {
  let channelId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `date-filt-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;

    // Post some messages
    for (let i = 0; i < 5; i++) {
      await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: `date-msg-${i}` }));
    }
  });

  it("returns all messages without date filter", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(5);
  });

  it("filters with since param (future date returns empty)", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages?since=${future}`));
    const data = await res.json();
    expect(data.length).toBe(0);
  });

  it("filters with until param (past date returns empty)", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages?until=${past}`));
    const data = await res.json();
    expect(data.length).toBe(0);
  });

  it("returns messages within date range", async () => {
    const since = new Date(Date.now() - 60000).toISOString();
    const until = new Date(Date.now() + 60000).toISOString();
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages?since=${since}&until=${until}`));
    const data = await res.json();
    expect(data.length).toBe(5);
  });
});
