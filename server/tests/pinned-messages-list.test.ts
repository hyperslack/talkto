/**
 * Tests for pinned messages list endpoint.
 */

import { describe, expect, it, beforeAll } from "bun:test";
import { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.TALKTO_PORT = "8099";
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

describe("Pinned Messages List", () => {
  it("returns array for valid channel", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/messages/pinned`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("returns 404 for nonexistent channel", async () => {
    const res = await app.fetch(req("GET", "/api/channels/fake-id/messages/pinned"));
    expect(res.status).toBe(404);
  });

  it("pinned messages have is_pinned=true", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    // Pin a message first
    const msgsRes = await app.fetch(req("GET", `/api/channels/${ch.id}/messages`));
    const msgs = await msgsRes.json();
    if (msgs.length > 0) {
      await app.fetch(req("POST", `/api/channels/${ch.id}/messages/${msgs[0].id}/pin`));

      const res = await app.fetch(req("GET", `/api/channels/${ch.id}/messages/pinned`));
      const data = await res.json();
      for (const msg of data) {
        expect(msg.is_pinned).toBe(true);
        expect(msg.pinned_at).not.toBeNull();
      }
    }
  });

  it("pinned messages have required fields", async () => {
    const chRes = await app.fetch(req("GET", "/api/channels"));
    const channels = await chRes.json();
    const ch = channels[0];

    const res = await app.fetch(req("GET", `/api/channels/${ch.id}/messages/pinned`));
    const data = await res.json();
    for (const msg of data) {
      expect(msg.id).toBeDefined();
      expect(msg.content).toBeDefined();
      expect(msg.sender_name).toBeDefined();
      expect(msg.created_at).toBeDefined();
    }
  });
});
