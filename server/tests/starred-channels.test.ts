/**
 * Tests for starred channels feature.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8200";
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

describe("Starred Channels", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `star-test-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;
  });

  it("stars a channel", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/star`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.starred).toBe(true);
  });

  it("returns 200 when already starred", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/star`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.starred).toBe(true);
  });

  it("lists starred channels", async () => {
    const res = await app.fetch(req("GET", "/api/channels/starred"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((s: { channel_id: string }) => s.channel_id === channelId)).toBe(true);
  });

  it("unstars a channel", async () => {
    const res = await app.fetch(
      req("DELETE", `/api/channels/${channelId}/star`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.starred).toBe(false);
  });

  it("returns 200 when unstarring non-starred channel", async () => {
    const res = await app.fetch(
      req("DELETE", `/api/channels/${channelId}/star`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.starred).toBe(false);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("POST", "/api/channels/nonexistent-id/star")
    );
    expect(res.status).toBe(404);
  });
});
