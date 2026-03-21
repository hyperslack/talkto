import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8161";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Mark all channels read", () => {
  beforeAll(async () => {
    // Create a channel and post a message to ensure there's unread content
    const res = await app.fetch(req("POST", "/api/channels", { name: `read-all-${Date.now()}` }));
    const ch = await res.json();
    await app.fetch(req("POST", `/api/channels/${ch.id}/messages`, { content: "unread msg" }));
  });

  it("POST /channels/read-all marks all channels as read", async () => {
    const res = await app.fetch(req("POST", "/api/channels/read-all"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channels_marked).toBeGreaterThan(0);
    expect(data.last_read_at).toBeDefined();
    expect(data.user_id).toBeDefined();
  });

  it("unread counts are zero after read-all", async () => {
    await app.fetch(req("POST", "/api/channels/read-all"));
    const res = await app.fetch(req("GET", "/api/channels/unread/counts"));
    const data = await res.json();
    for (const ch of data) {
      expect(ch.unread_count).toBe(0);
    }
  });
});
