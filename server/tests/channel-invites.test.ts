/**
 * Tests for channel invite link endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8258";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Channel Invite Links", () => {
  let channelId: string;
  let inviteToken: string;
  let inviteId: string;

  beforeAll(async () => {
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `invite-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;
  });

  it("creates a channel invite", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/invites`, {
      max_uses: 5,
      expires_in_hours: 24
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.token.startsWith("ch_")).toBe(true);
    expect(data.max_uses).toBe(5);
    inviteToken = data.token;
    inviteId = data.id;
  });

  it("lists channel invites", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/invites`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].token).toBe(inviteToken);
  });

  it("validates an invite token", async () => {
    const res = await app.fetch(req("POST", `/api/channels/join-invite/${inviteToken}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.channel_id).toBe(channelId);
  });

  it("rejects invalid token", async () => {
    const res = await app.fetch(req("POST", "/api/channels/join-invite/invalid_token"));
    expect(res.status).toBe(404);
  });

  it("revokes an invite", async () => {
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/invites/${inviteId}`));
    expect(res.status).toBe(200);
  });

  it("revoked invite no longer works", async () => {
    const res = await app.fetch(req("POST", `/api/channels/join-invite/${inviteToken}`));
    expect(res.status).toBe(404);
  });
});
