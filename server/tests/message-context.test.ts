/**
 * Tests for GET /api/channels/:channelId/messages/:messageId/context.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8203";
  const mod = await import("../src/index");
  app = mod.app;
  await app.fetch(req("POST", "/api/users/onboard", { name: "ctx-user" }));
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("GET message context", () => {
  let channelId: string;
  let messageIds: string[] = [];

  beforeAll(async () => {
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `ctx-test-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;

    // Post 7 messages
    for (let i = 0; i < 7; i++) {
      const msgRes = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, { content: `msg-${i}` }));
      const msg = await msgRes.json();
      messageIds.push(msg.id);
    }
  });

  it("returns target with before/after context", async () => {
    const targetId = messageIds[3]; // middle message
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${targetId}/context`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.target.id).toBe(targetId);
    expect(data.before.length).toBe(3);
    expect(data.after.length).toBe(3);
  });

  it("handles edge — first message has no before", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${messageIds[0]}/context`));
    const data = await res.json();
    expect(data.before.length).toBe(0);
    expect(data.after.length).toBe(3);
  });

  it("handles edge — last message has no after", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${messageIds[6]}/context`));
    const data = await res.json();
    expect(data.before.length).toBe(3);
    expect(data.after.length).toBe(0);
  });

  it("respects surrounding param", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${messageIds[3]}/context?surrounding=1`));
    const data = await res.json();
    expect(data.before.length).toBe(1);
    expect(data.after.length).toBe(1);
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/nonexistent/context`));
    expect(res.status).toBe(404);
  });
});
