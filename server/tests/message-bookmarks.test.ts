/**
 * Tests for message bookmark endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8180";
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

describe("Message Bookmarks", () => {
  let channelId: string;
  let messageId: string;

  beforeAll(async () => {
    // Create channel
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `bookmark-test-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    // Post a message
    const msgRes = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, { content: "bookmark me" })
    );
    const msg = await msgRes.json();
    messageId = msg.id;
  });

  it("bookmarks a message", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/${messageId}/bookmark`, { note: "important" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.bookmarked).toBe(true);
    expect(data.message_id).toBe(messageId);
    expect(data.note).toBe("important");
  });

  it("lists bookmarks for channel", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/bookmarks`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].message_id).toBe(messageId);
    expect(data[0].note).toBe("important");
    expect(data[0].content).toBe("bookmark me");
    expect(data[0].bookmarked_at).toBeDefined();
  });

  it("toggles bookmark off", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/${messageId}/bookmark`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bookmarked).toBe(false);

    // Verify list is now empty
    const listRes = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/bookmarks`)
    );
    const list = await listRes.json();
    expect(list.length).toBe(0);
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/nonexistent/bookmark`)
    );
    expect(res.status).toBe(404);
  });

  it("bookmarks without a note", async () => {
    const res = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages/${messageId}/bookmark`)
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.bookmarked).toBe(true);
    expect(data.note).toBeNull();
  });
});
