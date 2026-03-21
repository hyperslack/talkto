import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8160";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Search result total_count", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(req("POST", "/api/channels", { name: `src-count-${Date.now()}` }));
    const ch = await res.json();
    channelId = ch.id;

    // Post several messages
    for (let i = 0; i < 5; i++) {
      await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: `searchterm-count-test message ${i}` }));
    }
  });

  it("returns total_count in search results", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=searchterm-count-test"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total_count).toBeGreaterThanOrEqual(5);
    expect(data.count).toBe(data.results.length);
  });

  it("total_count exceeds count when limited", async () => {
    const res = await app.fetch(req("GET", "/api/search?q=searchterm-count-test&limit=2"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(2);
    expect(data.total_count).toBeGreaterThanOrEqual(5);
  });
});
