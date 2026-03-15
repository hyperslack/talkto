/**
 * Tests for POST /channels/:channelId/join and /leave endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8169";
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
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `joinleave-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;
  });

  it("joins a channel", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/join`));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.channel_id).toBe(channelId);
    expect(data.joined_at).toBeDefined();
  });

  it("rejects duplicate join", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/join`));
    expect(res.status).toBe(409);
  });

  it("user appears in members list", async () => {
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

  it("rejects leaving when not a member", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/leave`));
    expect(res.status).toBe(404);
  });

  it("cannot leave #general", async () => {
    // Find #general
    const listRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await listRes.json();
    const general = channels.find((c: any) => c.name === "#general");

    const res = await app.fetch(req("POST", `/api/channels/${general.id}/leave`));
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("POST", "/api/channels/nonexistent/join"));
    expect(res.status).toBe(404);
  });
});
