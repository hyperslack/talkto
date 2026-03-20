/**
 * Tests for channel join/leave endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8186";
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

describe("Channel Join/Leave", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `join-test-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;
  });

  it("joins a channel", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/join`));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.joined).toBe(true);
    expect(data.channel_id).toBe(channelId);
  });

  it("returns 409 when already a member", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/join`));
    expect(res.status).toBe(409);
  });

  it("shows user in channel members", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/members`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("leaves a channel", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/leave`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.left).toBe(true);
  });

  it("returns 404 when leaving a channel not joined", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/leave`));
    expect(res.status).toBe(404);
  });

  it("returns 404 for nonexistent channel join", async () => {
    const res = await app.fetch(req("POST", "/api/channels/nonexistent/join"));
    expect(res.status).toBe(404);
  });

  it("can rejoin after leaving", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/join`));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.joined).toBe(true);
  });
});
