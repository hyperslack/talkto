/**
 * Tests for thread subscription service.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8253";
  const mod = await import("../src/index");
  app = mod.app;
});

function req(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return new Request(`http://localhost${path}`, opts);
}

describe("Thread Subscriptions", () => {
  let channelId: string;
  let messageId: string;

  beforeAll(async () => {
    await app.fetch(req("POST", "/api/users/onboard", { name: "thread-sub-tester" }));
    const chRes = await app.fetch(req("POST", "/api/channels", { name: `threadsub-${Date.now()}` }));
    const ch = await chRes.json();
    channelId = ch.id;

    const msgRes = await app.fetch(req("POST", `/api/channels/${channelId}/messages`, {
      content: "Parent message for thread"
    }));
    const msg = await msgRes.json();
    messageId = msg.id;
  });

  it("subscribes to a thread", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/messages/${messageId}/subscribe`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subscribed).toBe(true);
  });

  it("returns already subscribed on duplicate", async () => {
    const res = await app.fetch(req("POST", `/api/channels/${channelId}/messages/${messageId}/subscribe`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.subscribed).toBe(false);
  });

  it("lists thread subscribers", async () => {
    const res = await app.fetch(req("GET", `/api/channels/${channelId}/messages/${messageId}/subscribers`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("unsubscribes from a thread", async () => {
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/messages/${messageId}/subscribe`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unsubscribed).toBe(true);
  });

  it("returns false when unsubscribing from non-subscribed thread", async () => {
    const res = await app.fetch(req("DELETE", `/api/channels/${channelId}/messages/${messageId}/subscribe`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unsubscribed).toBe(false);
  });
});
