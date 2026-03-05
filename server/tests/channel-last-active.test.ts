/**
 * Tests for channel last_active_at field.
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

describe("Channel Last Active", () => {
  it("GET /channels list includes last_active_at field", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
    // Every channel should have last_active_at (may be null for empty channels)
    for (const ch of data) {
      expect("last_active_at" in ch).toBe(true);
    }
  });

  it("GET /channels/:id includes last_active_at field", async () => {
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const first = channels[0];

    const res = await app.fetch(req("GET", `/api/channels/${first.id}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect("last_active_at" in data).toBe(true);
  });

  it("#general has last_active_at set (has messages from seed)", async () => {
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const general = channels.find((ch: { name: string }) => ch.name === "#general");
    expect(general).toBeDefined();
    // #general should have messages from seeding
    expect(general.last_active_at).not.toBeNull();
  });

  it("last_active_at is a valid ISO timestamp", async () => {
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const withActivity = channels.find((ch: { last_active_at: string | null }) => ch.last_active_at !== null);
    if (withActivity) {
      const date = new Date(withActivity.last_active_at);
      expect(date.getTime()).not.toBeNaN();
    }
  });
});
