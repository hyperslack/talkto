/**
 * Tests for message bookmark endpoints.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8161";
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
    const chRes = await app.fetch(
      req("POST", "/api/channels", { name: `bookmarks-test-${Date.now()}` })
    );
    const ch = await chRes.json();
    channelId = ch.id;

    const msgRes = await app.fetch(
      req("POST", `/api/channels/${channelId}/messages`, {
        content: "Bookmark this important message",
      })
    );
    const msg = await msgRes.json();
    messageId = msg.id;
  });

  it("bookmarks a message", async () => {
    const res = await app.fetch(
      req("POST", "/api/bookmarks", { message_id: messageId, note: "important" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message_id).toBe(messageId);
    expect(data.note).toBe("important");
  });

  it("rejects duplicate bookmark", async () => {
    const res = await app.fetch(
      req("POST", "/api/bookmarks", { message_id: messageId })
    );
    expect(res.status).toBe(409);
  });

  it("lists bookmarks", async () => {
    const res = await app.fetch(req("GET", "/api/bookmarks"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    const found = data.find((b: any) => b.message_id === messageId);
    expect(found).toBeDefined();
    expect(found.content_preview).toContain("Bookmark this");
    expect(found.note).toBe("important");
  });

  it("returns 404 for nonexistent message", async () => {
    const res = await app.fetch(
      req("POST", "/api/bookmarks", { message_id: "nonexistent" })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 without message_id", async () => {
    const res = await app.fetch(req("POST", "/api/bookmarks", {}));
    expect(res.status).toBe(400);
  });

  it("removes a bookmark", async () => {
    const res = await app.fetch(req("DELETE", `/api/bookmarks/${messageId}`));
    expect(res.status).toBe(204);
  });

  it("returns 404 when removing nonexistent bookmark", async () => {
    const res = await app.fetch(req("DELETE", `/api/bookmarks/${messageId}`));
    expect(res.status).toBe(404);
  });

  it("list is empty after removal", async () => {
    const res = await app.fetch(req("GET", "/api/bookmarks"));
    const data = await res.json();
    const found = data.find((b: any) => b.message_id === messageId);
    expect(found).toBeUndefined();
  });
});
