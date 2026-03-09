/**
 * Tests for last message preview in channel list.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8201";
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

describe("Channel Last Message Preview", () => {
  let channelId: string;

  beforeAll(async () => {
    const res = await app.fetch(
      req("POST", "/api/channels", { name: `lastmsg-test-${Date.now()}` })
    );
    const ch = await res.json();
    channelId = ch.id;
  });

  it("returns null last_message for empty channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    expect(res.status).toBe(200);
    const channels = await res.json();
    const ch = channels.find((c: { id: string }) => c.id === channelId);
    expect(ch).toBeDefined();
    expect(ch.last_message).toBeNull();
  });

  it("returns last_message after posting", async () => {
    // Post a message
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Hello world" })
    );

    const res = await app.fetch(req("GET", "/api/channels"));
    expect(res.status).toBe(200);
    const channels = await res.json();
    const ch = channels.find((c: { id: string }) => c.id === channelId);
    expect(ch.last_message).toBeDefined();
    expect(ch.last_message.content).toBe("Hello world");
    expect(ch.last_message.sender_name).toBeDefined();
    expect(ch.last_message.sent_at).toBeDefined();
  });

  it("truncates long messages to 100 chars", async () => {
    const longContent = "x".repeat(200);
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: longContent })
    );

    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    const ch = channels.find((c: { id: string }) => c.id === channelId);
    expect(ch.last_message.content.length).toBeLessThanOrEqual(101); // 100 + "…"
  });

  it("shows the most recent message", async () => {
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "First" })
    );
    await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "Second" })
    );

    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    const ch = channels.find((c: { id: string }) => c.id === channelId);
    expect(ch.last_message.content).toBe("Second");
  });
});
