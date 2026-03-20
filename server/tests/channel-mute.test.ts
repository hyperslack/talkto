/**
 * Tests for channel mute/unmute endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8181";
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

describe("Channel Mute", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `mute-test-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;
  });

  it("mutes a channel", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/mute`));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.muted).toBe(true);
    expect(data.channel_id).toBe(channelId);
  });

  it("returns 409 when already muted", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/mute`));
    expect(res.status).toBe(409);
  });

  it("lists muted channels", async () => {
    const res = await app.fetch(req("GET", "/api/channels/muted/list"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const muted = data.find((m: any) => m.channel_id === channelId);
    expect(muted).toBeDefined();
    expect(muted.muted_at).toBeDefined();
  });

  it("unmutes a channel", async () => {
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/mute`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.muted).toBe(false);
  });

  it("returns 404 when unmuting non-muted channel", async () => {
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/mute`));
    expect(res.status).toBe(404);
  });

  it("supports mute with expiry", async () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/mute`, { expires_at: future })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.expires_at).toBe(future);

    // Cleanup
    await app.fetch(req("DELETE", `/api/channels/${channelId}/mute`));
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("POST", "/api/channels/nonexistent/mute"));
    expect(res.status).toBe(404);
  });
});
