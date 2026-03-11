/**
 * Tests for private channel access control.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8254";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Private Channels", () => {
  let channelId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `private-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;
  });

  it("sets a channel as private", async () => {
    const res = await app.fetch(req("PATCH", `/api/channels/${channelId}/privacy`, { is_private: true }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_private).toBe(true);
  });

  it("gets channel privacy status", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/privacy`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_private).toBe(true);
  });

  it("sets a channel back to public", async () => {
    const res = await app.fetch(req("PATCH", `/api/channels/${channelId}/privacy`, { is_private: false }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_private).toBe(false);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/nonexistent/privacy"));
    expect(res.status).toBe(404);
  });

  it("rejects invalid body", async () => {
    const res = await app.fetch(req("PATCH", `/api/channels/${channelId}/privacy`, { bad: true }));
    expect(res.status).toBe(400);
  });
});
