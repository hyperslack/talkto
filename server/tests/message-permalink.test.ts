/**
 * Tests for GET /channels/:channelId/messages/:messageId/permalink endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8166";
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

describe("Message Permalink", () => {
  let channelId: string;
  const messageIds: string[] = [];

  beforeAll(async () => {
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `permalink-test-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    for (let i = 0; i < 7; i++) {
      const msgRes = await app.fetch(
        req("POST", `/api/channels/${channelId}/messages`, {
          content: `Permalink test message ${i}`,
        })
      );
      const msg = await msgRes.json();
      messageIds.push(msg.id);
    }
  });

  it("returns message with context", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/${messageIds[3]}/permalink`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message.id).toBe(messageIds[3]);
    expect(data.channel_name).toBeDefined();
    expect(data.permalink).toContain(messageIds[3]);
    expect(data.context_before.length).toBeGreaterThan(0);
    expect(data.context_after.length).toBeGreaterThan(0);
  });

  it("limits context with query param", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/${messageIds[3]}/permalink?context=1`)
    );
    const data = await res.json();
    expect(data.context_before.length).toBeLessThanOrEqual(1);
    expect(data.context_after.length).toBeLessThanOrEqual(1);
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/nonexistent/permalink`)
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/nonexistent/messages/${messageIds[0]}/permalink`)
    );
    expect(res.status).toBe(404);
  });

  it("first message has no context_before", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/${messageIds[0]}/permalink`)
    );
    const data = await res.json();
    expect(data.context_before.length).toBe(0);
  });
});
