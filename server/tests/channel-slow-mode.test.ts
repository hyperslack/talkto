/**
 * Tests for channel slow mode.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8136";
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

describe("Channel Slow Mode", () => {
  let channelId: string;

  beforeAll(async () => {
    // Create a channel for testing
    const createRes = await app.fetch(req("POST", "/api/channels", { name: `slow-test-${Date.now()}` }));
    if (createRes.status === 201) {
      const ch = await createRes.json();
      channelId = ch.id;
    } else {
      const res = await app.fetch(req("GET", "/api/channels"));
      const channels = await res.json();
      channelId = channels[0].id;
    }
  });

  it("channels have 0 slow_mode_seconds by default", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slow_mode_seconds).toBe(0);
  });

  it("sets slow mode on a channel", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/slow-mode`, { seconds: 30 })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slow_mode_seconds).toBe(30);
  });

  it("disables slow mode", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/slow-mode`, { seconds: 0 })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slow_mode_seconds).toBe(0);
  });

  it("rejects negative seconds", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/slow-mode`, { seconds: -5 })
    );
    expect(res.status).toBe(400);
  });

  it("rejects seconds over 24h", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/slow-mode`, { seconds: 100000 })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/channels/nonexistent/slow-mode", { seconds: 10 })
    );
    expect(res.status).toBe(404);
  });
});
