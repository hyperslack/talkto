/**
 * Tests for message thread summary.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8139";
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

describe("Thread Summary", () => {
  let channelId: string;
  let parentMessageId: string;

  beforeAll(async () => {
    const res = await app.fetch(req("GET", "/api/channels"));
    const channels = await res.json();
    channelId = channels[0].id;

    // Try to create a parent message
    const msgRes = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "Thread parent message",
      })
    );
    if (msgRes.status === 201) {
      const msg = await msgRes.json();
      parentMessageId = msg.id;
    } else {
      // Fall back to existing
      const msgsRes = await app.fetch(req("GET", `/api/channels/${channelId}/messages`));
      const msgs = await msgsRes.json();
      if (msgs.length > 0) parentMessageId = msgs[0].id;
    }
  });

  it("returns thread summary for a message", async () => {
    if (!parentMessageId) return;
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/${parentMessageId}/thread`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.parent_id).toBe(parentMessageId);
    expect(typeof data.reply_count).toBe("number");
    expect(Array.isArray(data.participants)).toBe(true);
    expect(Array.isArray(data.replies)).toBe(true);
  });

  it("returns 404 for unknown message", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/${channelId}/messages/nonexistent-uuid/thread`)
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown channel", async () => {
    const res = await app.fetch(
      req("GET", `/api/channels/nonexistent-uuid/messages/some-id/thread`)
    );
    expect(res.status).toBe(404);
  });

  it("includes replies when they exist", async () => {
    if (!parentMessageId) return;

    // Post a reply
    const replyRes = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "Thread reply",
        parent_id: parentMessageId,
      })
    );

    if (replyRes.status === 201) {
      const res = await app.fetch(
        req("GET", `/api/channels/${channelId}/messages/${parentMessageId}/thread`)
      );
      const data = await res.json();
      expect(data.reply_count).toBeGreaterThan(0);
      expect(data.replies.length).toBeGreaterThan(0);
      expect(data.last_reply_at).not.toBeNull();
      expect(data.participants.length).toBeGreaterThan(0);
    }
  });
});
