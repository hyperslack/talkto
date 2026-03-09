/**
 * Tests for search with sender and type filters.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8210";
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

describe("Search By Sender", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `search-sender-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;

    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "searchable message from human" })
    );
  });

  it("filters by sender name with from param", async () => {
    // First get our username
    const meRes = await app.fetch(req("GET", "/api/users/me"));
    const me = await meRes.json();

    const res = await app.fetch(req("GET", `/api/search?q=searchable&from=${me.name}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    for (const result of data.results) {
      expect(result.sender_name).toBeDefined();
    }
  });

  it("returns empty for non-existent sender", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=searchable&from=nobody-exists-12345"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBe(0);
  });

  it("filters by type=human", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=searchable&type=human"));
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const result of data.results) {
      expect(result.sender_type).toBe("human");
    }
  });

  it("filters by type=agent returns only agent messages", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=searchable&type=agent"));
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const result of data.results) {
      expect(result.sender_type).toBe("agent");
    }
  });

  it("combines from and channel filters", async () => {
    const meRes = await app.fetch(req("GET", "/api/users/me"));
    const me = await meRes.json();

    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels.find((c: { id: string }) => c.id === channelId);

    const res = await app.fetch(req("GET", `/api/search?q=searchable&from=${me.name}&channel=${ch.name}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results.length).toBeGreaterThanOrEqual(1);
  });
});
