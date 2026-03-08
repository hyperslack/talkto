/**
 * Tests for read-only (announcement) channels.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8140";
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

describe("Read-Only Channels", () => {
  let channelId: string;

  beforeAll(async () => {
    // Create a channel for testing
    const createRes = await app.fetch(req("POST", "/api/channels", { name: `readonly-test-${Date.now()}` }));
    if (createRes.status === 201) {
      const ch = await createRes.json();
      channelId = ch.id;
    } else {
      const res = await app.fetch(req("GET", "/api/channels"));
      const channels = await res.json();
      channelId = channels[0].id;
    }
  });

  it("channels are not read-only by default", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_read_only).toBe(false);
  });

  it("sets channel to read-only", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/read-only`, { read_only: true })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_read_only).toBe(true);
  });

  it("removes read-only mode", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/read-only`, { read_only: false })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_read_only).toBe(false);
  });

  it("rejects non-boolean value", async () => {
    const res = await app.fetch(
      req("PATCH", `/api/channels/${channelId}/read-only`, { read_only: "yes" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(
      req("PATCH", "/api/channels/nonexistent/read-only", { read_only: true })
    );
    expect(res.status).toBe(404);
  });
});
